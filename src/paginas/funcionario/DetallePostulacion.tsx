// ============================================================================
//  Ficha de detalle: datos del tutor y del beneficiario, documentos con vista
//  previa, revisión (aprobar / rechazar / observar), notas y ficha de retiro.
// ============================================================================
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, mensajeError } from '../../lib/supabase'
import { documentosDeTutor } from '../../lib/documentos'
import {
  ETIQUETA_ESTADO, ETIQUETA_NACIONALIDAD, ETIQUETA_SEXO, calcularEdad, fechaCorta, fechaHora, sanitizar,
} from '../../lib/formato'
import { formatearRut } from '../../lib/rut'
import { fichaDesdeFila, fichasRetiroPDF } from '../../lib/pdf'
import { useSesion } from '../../contexto/SesionProvider'
import { useNotificacion } from '../../contexto/NotificacionProvider'
import {
  Alerta, AreaTexto, Boton, Campo, Cargando, Insignia, InsigniaEstado, Modal, Tarjeta, Vacio,
} from '../../componentes/ui'
import { ListaDocumentos } from '../../componentes/Documentos'
import type { AuditoriaFila, Documento, Entrega, Estado, FilaPostulacion, Nota } from '../../lib/tipos'

type AccionRevision = Extract<Estado, 'aprobado' | 'rechazado' | 'observado'>

const TITULO_ACCION: Record<AccionRevision, string> = {
  aprobado: 'Aprobar postulación',
  rechazado: 'Rechazar postulación',
  observado: 'Dejar con observación',
}

export function DetallePostulacion() {
  const { id } = useParams()
  const navegar = useNavigate()
  const { perfil, esAdmin, configuracion } = useSesion()
  const { exito, error: avisarError } = useNotificacion()

  const [fila, setFila] = useState<FilaPostulacion | null>(null)
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [notas, setNotas] = useState<Nota[]>([])
  const [entrega, setEntrega] = useState<Entrega | null>(null)
  const [auditoria, setAuditoria] = useState<AuditoriaFila[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [accion, setAccion] = useState<AccionRevision | null>(null)
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)

  const [nuevaNota, setNuevaNota] = useState('')
  const [tipoNota, setTipoNota] = useState<'observacion' | 'opinion_profesional'>('observacion')

  const cargar = useCallback(async () => {
    if (!id) return
    setCargando(true)
    setError('')
    try {
      const { data, error: errorFila } = await supabase
        .from('v_postulaciones').select('*').eq('beneficiario_id', id).maybeSingle()
      if (errorFila) throw errorFila
      if (!data) { setError('La postulación no existe o fue eliminada.'); return }
      const f = data as FilaPostulacion
      setFila(f)

      const [docs, { data: obs }, { data: ent }] = await Promise.all([
        documentosDeTutor(f.tutor_id),
        supabase.from('observaciones').select('*').eq('beneficiario_id', id).order('created_at', { ascending: false }),
        supabase.from('entregas').select('*').eq('beneficiario_id', id).maybeSingle(),
      ])
      setDocumentos(docs)
      setNotas((obs ?? []) as Nota[])
      setEntrega((ent as Entrega) ?? null)

      if (esAdmin) {
        const { data: bitacora } = await supabase
          .from('audit_log').select('*').eq('registro_id', id)
          .order('created_at', { ascending: false }).limit(50)
        setAuditoria((bitacora ?? []) as AuditoriaFila[])
      }
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setCargando(false)
    }
  }, [id, esAdmin])

  useEffect(() => { void cargar() }, [cargar])

  const abrirAccion = (nueva: AccionRevision) => {
    setAccion(nueva)
    setMotivo('')
  }

  const confirmarAccion = async () => {
    if (!accion || !id) return
    const texto = sanitizar(motivo)
    if (accion !== 'aprobado' && texto.length < 5) {
      avisarError('Debe indicar el motivo (al menos 5 caracteres).')
      return
    }
    setGuardando(true)
    try {
      const { error: errorCambio } = await supabase
        .from('beneficiarios')
        .update({ estado: accion, motivo_estado: accion === 'aprobado' ? null : texto })
        .eq('id', id)
      if (errorCambio) throw errorCambio

      // El motivo también queda como observación visible para el tutor.
      if (accion !== 'aprobado') {
        await supabase.from('observaciones').insert({
          beneficiario_id: id,
          autor_id: perfil?.id ?? null,
          autor_nombre: perfil?.nombre ?? '',
          tipo: 'observacion',
          texto,
        })
      }

      exito(`Postulación marcada como “${ETIQUETA_ESTADO[accion]}”.`)
      setAccion(null)
      await cargar()
    } catch (e) {
      avisarError(mensajeError(e))
    } finally {
      setGuardando(false)
    }
  }

  const agregarNota = async () => {
    const texto = sanitizar(nuevaNota)
    if (texto.length < 3) { avisarError('Escriba el texto de la nota.'); return }
    try {
      const { error: errorNota } = await supabase.from('observaciones').insert({
        beneficiario_id: id,
        autor_id: perfil?.id ?? null,
        autor_nombre: perfil?.nombre ?? '',
        tipo: tipoNota,
        texto,
      })
      if (errorNota) throw errorNota
      setNuevaNota('')
      exito('Nota registrada.')
      await cargar()
    } catch (e) {
      avisarError(mensajeError(e))
    }
  }

  const registrarEntrega = async () => {
    if (!fila || !id) return
    if (!window.confirm(`¿Confirmar la entrega del regalo de ${fila.beneficiario_nombre}?`)) return
    try {
      const { error: errorEntrega } = await supabase.from('entregas').insert({
        beneficiario_id: id,
        entregado_por: perfil?.id ?? null,
        entregado_nombre: perfil?.nombre ?? '',
      })
      if (errorEntrega) throw errorEntrega
      exito('Entrega registrada.')
      await cargar()
    } catch (e) {
      avisarError(mensajeError(e))
    }
  }

  const generarFicha = async () => {
    if (!fila) return
    if (!fila.folio) { avisarError('La ficha se genera una vez aprobada la postulación.'); return }
    try {
      await fichasRetiroPDF([fichaDesdeFila(fila)], `ficha-${fila.folio}.pdf`)
    } catch (e) {
      avisarError(mensajeError(e))
    }
  }

  if (cargando) return <Cargando />
  if (error) return <Alerta tipo="error" titulo="No pudimos abrir la ficha">{error}</Alerta>
  if (!fila) return null

  const docsBeneficiario = documentos.filter((d) => d.beneficiario_id === fila.beneficiario_id)
  const docsTutor = documentos.filter((d) => !d.beneficiario_id)
  const opiniones = notas.filter((n) => n.tipo === 'opinion_profesional')
  const observaciones = notas.filter((n) => n.tipo === 'observacion')

  return (
    <div className="flex flex-col gap-6">
      <Tarjeta
        titulo={fila.beneficiario_nombre}
        descripcion={`Folio: ${fila.folio ?? 'se asigna al aprobar'} · Postuló el ${fechaCorta(fila.created_at)}`}
        acciones={
          <>
            <Boton variante="secundario" onClick={() => navegar('/panel/postulaciones')}>Volver</Boton>
            {fila.estado === 'aprobado' && (
              <Boton variante="secundario" onClick={generarFicha}>Ficha de retiro (PDF)</Boton>
            )}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <InsigniaEstado estado={fila.estado} />
          {fila.discapacidad && <Insignia tono="azul">Condición de discapacidad</Insignia>}
          <Insignia>{ETIQUETA_NACIONALIDAD[fila.nacionalidad]}</Insignia>
          {fila.entregado && <Insignia tono="verde">Regalo entregado</Insignia>}
        </div>

        {fila.motivo_estado && (
          <div className="mt-4">
            <Alerta tipo={fila.estado === 'rechazado' ? 'error' : 'aviso'} titulo="Motivo registrado">
              {fila.motivo_estado}
            </Alerta>
          </div>
        )}

        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-marino-600">Beneficiario</h3>
            <dl className="text-sm">
              {[
                ['RUT', formatearRut(fila.beneficiario_rut)],
                ['Sexo', ETIQUETA_SEXO[fila.sexo]],
                ['Fecha de nacimiento', fechaCorta(fila.fecha_nacimiento)],
                ['Edad al ' + fechaCorta(configuracion?.fecha_corte_edad),
                  `${calcularEdad(fila.fecha_nacimiento, configuracion?.fecha_corte_edad)} años`],
                ['Discapacidad', fila.discapacidad ? 'Sí' : 'No'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-slate-100 py-1.5">
                  <dt className="text-slate-600">{k}</dt>
                  <dd className="text-right font-semibold text-marino-900">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-marino-600">Tutor o tutora</h3>
            <dl className="text-sm">
              {[
                ['Nombre', fila.tutor_nombre],
                ['RUT o documento', fila.tutor_rut ?? '—'],
                ['Nacionalidad', ETIQUETA_NACIONALIDAD[fila.nacionalidad]],
                ['Tramo RSH', fila.tramo_rsh ? `${fila.tramo_rsh}%` : 'No aplica'],
                ['Teléfono', fila.telefono],
                ['Correo', fila.email],
                ['Dirección', `${fila.direccion}, ${fila.comuna}`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-slate-100 py-1.5">
                  <dt className="text-slate-600">{k}</dt>
                  <dd className="text-right font-semibold text-marino-900">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Revisión de la postulación"
               descripcion="Al rechazar u observar es obligatorio indicar el motivo.">
        <div className="flex flex-wrap gap-2">
          <Boton variante="exito" onClick={() => abrirAccion('aprobado')} disabled={fila.estado === 'aprobado'}>
            Aprobar
          </Boton>
          <Boton variante="secundario" onClick={() => abrirAccion('observado')} disabled={fila.estado === 'observado'}>
            Dejar con observación
          </Boton>
          <Boton variante="peligro" onClick={() => abrirAccion('rechazado')} disabled={fila.estado === 'rechazado'}>
            Rechazar
          </Boton>
          {fila.estado === 'aprobado' && !fila.entregado && (
            <Boton onClick={registrarEntrega}>Marcar regalo entregado</Boton>
          )}
        </div>
        {entrega && (
          <div className="mt-4">
            <Alerta tipo="exito" titulo="Regalo entregado">
              {fechaHora(entrega.entregado_at)} · Funcionario responsable: {entrega.entregado_nombre || '—'}
            </Alerta>
          </div>
        )}
      </Tarjeta>

      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta titulo="Documentos del beneficiario">
          <ListaDocumentos documentos={docsBeneficiario} />
        </Tarjeta>
        <Tarjeta titulo="Documentos del tutor">
          <ListaDocumentos documentos={docsTutor} />
        </Tarjeta>
      </div>

      <Tarjeta titulo="Observaciones y opinión profesional">
        <div className="flex flex-col gap-4">
          <Campo etiqueta="Nueva nota" htmlFor="nota"
                 ayuda="Las observaciones son visibles para el tutor; la opinión profesional es de uso interno.">
            <AreaTexto id="nota" value={nuevaNota} onChange={(e) => setNuevaNota(e.target.value)} maxLength={1000} />
          </Campo>
          <div className="flex flex-wrap items-center gap-3">
            <fieldset className="flex gap-4 border-0 p-0 text-sm">
              <legend className="sr-only">Tipo de nota</legend>
              <label className="flex items-center gap-2">
                <input type="radio" name="tipo-nota" checked={tipoNota === 'observacion'}
                       onChange={() => setTipoNota('observacion')} />
                Observación (visible para el tutor)
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="tipo-nota" checked={tipoNota === 'opinion_profesional'}
                       onChange={() => setTipoNota('opinion_profesional')} />
                Opinión profesional (interna)
              </label>
            </fieldset>
            <Boton onClick={agregarNota}>Guardar nota</Boton>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-bold text-marino-900">Observaciones</h3>
              {!observaciones.length ? <Vacio mensaje="Sin observaciones." /> : (
                <ul className="flex flex-col gap-2">
                  {observaciones.map((n) => (
                    <li key={n.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                      <p className="text-slate-800">{n.texto}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {n.autor_nombre || 'Municipalidad'} · {fechaHora(n.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-bold text-marino-900">Opinión profesional</h3>
              {!opiniones.length ? <Vacio mensaje="Sin opinión profesional registrada." /> : (
                <ul className="flex flex-col gap-2">
                  {opiniones.map((n) => (
                    <li key={n.id} className="rounded-lg border border-marino-200 bg-marino-50 p-3 text-sm">
                      <p className="text-slate-800">{n.texto}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {n.autor_nombre || 'Municipalidad'} · {fechaHora(n.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </Tarjeta>

      {esAdmin && (
        <Tarjeta titulo="Historial de cambios" descripcion="Registro de auditoría de este beneficiario.">
          {!auditoria.length ? <Vacio mensaje="Sin movimientos registrados." /> : (
            <ul className="flex flex-col gap-2 text-sm">
              {auditoria.map((a) => (
                <li key={a.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="font-semibold text-marino-900">
                    {a.accion} en {a.tabla} · {fechaHora(a.created_at)}
                  </p>
                  <p className="text-xs text-slate-500">Autor: {a.actor_email ?? 'sistema'}</p>
                  {a.valor_anterior && a.valor_nuevo && (
                    <p className="mt-1 text-xs text-slate-600">
                      Estado: {String((a.valor_anterior as Record<string, unknown>).estado ?? '—')} →{' '}
                      {String((a.valor_nuevo as Record<string, unknown>).estado ?? '—')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      )}

      <Modal abierto={accion !== null} titulo={accion ? TITULO_ACCION[accion] : ''} onCerrar={() => setAccion(null)}>
        <div className="flex flex-col gap-4">
          {accion === 'aprobado' ? (
            <p className="text-sm text-slate-700">
              Al aprobar se generará el folio correlativo y la ficha de retiro quedará disponible para imprimir.
            </p>
          ) : (
            <Campo etiqueta="Motivo" requerido htmlFor="motivo"
                   ayuda={accion === 'observado'
                     ? 'El tutor verá este texto y podrá corregir y reenviar.'
                     : 'El tutor verá este texto como motivo del rechazo.'}>
              <AreaTexto id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} />
            </Campo>
          )}
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Boton cargando={guardando} onClick={confirmarAccion}>Confirmar</Boton>
            <Boton variante="secundario" onClick={() => setAccion(null)}>Cancelar</Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
