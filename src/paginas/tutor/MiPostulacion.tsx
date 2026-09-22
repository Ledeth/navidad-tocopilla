// ============================================================================
//  Panel del tutor: estado de la postulación, línea de tiempo y beneficiarios.
// ============================================================================
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, mensajeError } from '../../lib/supabase'
import { documentosDeTutor } from '../../lib/documentos'
import { ETIQUETA_ESTADO, ETIQUETA_SEXO, calcularEdad, fechaCorta, fechaHora } from '../../lib/formato'
import { formatearRut } from '../../lib/rut'
import { useSesion } from '../../contexto/SesionProvider'
import { useNotificacion } from '../../contexto/NotificacionProvider'
import { Alerta, Boton, Cargando, Indicador, InsigniaEstado, Tarjeta, Vacio } from '../../componentes/ui'
import { ListaDocumentos } from '../../componentes/Documentos'
import type { Beneficiario, Documento, Nota, Tutor } from '../../lib/tipos'

/** Línea de tiempo del estado de un beneficiario. */
function LineaTiempo({ beneficiario }: { beneficiario: Beneficiario }) {
  const pasos = [
    { titulo: 'Postulación enviada', fecha: beneficiario.created_at, hecho: true },
    {
      titulo: 'Revisión municipal',
      fecha: beneficiario.revisado_at,
      hecho: beneficiario.estado !== 'pendiente',
    },
    {
      titulo:
        beneficiario.estado === 'rechazado' ? 'Rechazado'
        : beneficiario.estado === 'observado' ? 'Con observación: debe corregir'
        : 'Aprobado',
      fecha: beneficiario.estado === 'pendiente' ? null : beneficiario.revisado_at,
      hecho: beneficiario.estado === 'aprobado',
    },
  ]

  return (
    <ol className="flex flex-col gap-3 border-l-2 border-slate-200 pl-4">
      {pasos.map((p, i) => (
        <li key={i} className="relative">
          <span
            aria-hidden="true"
            className={`absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full border-2 ${
              p.hecho ? 'border-emerald-600 bg-emerald-500' : 'border-slate-300 bg-white'
            }`}
          />
          <p className={`text-sm font-semibold ${p.hecho ? 'text-marino-900' : 'text-slate-500'}`}>{p.titulo}</p>
          <p className="text-xs text-slate-500">{p.fecha ? fechaHora(p.fecha) : 'Pendiente'}</p>
        </li>
      ))}
    </ol>
  )
}

export function MiPostulacion() {
  const { sesion, configuracion, postulacionAbierta } = useSesion()
  const { error: avisarError, exito } = useNotificacion()
  const navegar = useNavigate()

  const [tutor, setTutor] = useState<Tutor | null>(null)
  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([])
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [notas, setNotas] = useState<Nota[]>([])
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    if (!sesion) return
    setCargando(true)
    try {
      const { data: filaTutor, error } = await supabase
        .from('tutores').select('*').eq('profile_id', sesion.user.id).maybeSingle()
      if (error) throw error

      if (!filaTutor) { setTutor(null); return }
      const t = filaTutor as Tutor
      setTutor(t)

      const [{ data: hijos }, docs] = await Promise.all([
        supabase.from('beneficiarios').select('*').eq('tutor_id', t.id).order('created_at'),
        documentosDeTutor(t.id),
      ])
      const lista = (hijos ?? []) as Beneficiario[]
      setBeneficiarios(lista)
      setDocumentos(docs)

      if (lista.length) {
        const { data: obs } = await supabase
          .from('observaciones')
          .select('*')
          .in('beneficiario_id', lista.map((b) => b.id))
          .order('created_at', { ascending: false })
        setNotas(((obs ?? []) as Nota[]).filter((n) => n.tipo === 'observacion'))
      } else {
        setNotas([])
      }
    } catch (e) {
      avisarError(mensajeError(e))
    } finally {
      setCargando(false)
    }
  }, [sesion, avisarError])

  useEffect(() => { void cargar() }, [cargar])

  const reenviar = async (b: Beneficiario) => {
    try {
      const { error } = await supabase
        .from('beneficiarios').update({ estado: 'pendiente' }).eq('id', b.id)
      if (error) throw error
      exito('Su corrección fue enviada. La postulación volvió a “Pendiente de revisión”.')
      void cargar()
    } catch (e) {
      avisarError(mensajeError(e))
    }
  }

  const eliminar = async (b: Beneficiario) => {
    if (!window.confirm(`¿Eliminar a ${b.nombre_completo} de su postulación?`)) return
    try {
      const { error } = await supabase.from('beneficiarios').delete().eq('id', b.id)
      if (error) throw error
      exito('El beneficiario fue eliminado.')
      void cargar()
    } catch (e) {
      avisarError(mensajeError(e))
    }
  }

  if (cargando) return <Cargando />

  if (!tutor) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Alerta tipo="aviso" titulo="Falta completar sus datos">
          Su cuenta está creada, pero todavía no registramos sus datos de tutor o tutora.
          <p className="mt-3">
            <Link to="/tutor/datos" className="font-semibold underline">Completar mis datos ahora</Link>
          </p>
        </Alerta>
      </div>
    )
  }

  const conteo = {
    total: beneficiarios.length,
    aprobados: beneficiarios.filter((b) => b.estado === 'aprobado').length,
    pendientes: beneficiarios.filter((b) => b.estado === 'pendiente').length,
    observados: beneficiarios.filter((b) => b.estado === 'observado').length,
  }

  return (
    <div className="flex flex-col gap-6">
      <Tarjeta
        titulo={`Hola, ${tutor.nombre_completo}`}
        descripcion="Este es el estado de su postulación a la entrega de regalos de Navidad 2026."
        acciones={
          <>
            <Boton variante="secundario" onClick={() => navegar('/tutor/datos')}>Editar mis datos</Boton>
            <Boton onClick={() => navegar('/tutor/beneficiarios/nuevo')} disabled={!postulacionAbierta}>
              Agregar beneficiario
            </Boton>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Indicador etiqueta="Beneficiarios inscritos" valor={conteo.total} />
          <Indicador etiqueta="Aprobados" valor={conteo.aprobados} tono="verde" />
          <Indicador etiqueta="Pendientes de revisión" valor={conteo.pendientes} tono="ambar" />
          <Indicador etiqueta="Con observación" valor={conteo.observados} tono="rojo" />
        </div>

        {!postulacionAbierta && (
          <div className="mt-4">
            <Alerta tipo="aviso">
              El período de postulación está cerrado ({fechaCorta(configuracion?.fecha_apertura)} al{' '}
              {fechaCorta(configuracion?.fecha_cierre)}). Puede seguir revisando el estado de su solicitud.
            </Alerta>
          </div>
        )}

        <dl className="mt-5 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4 border-b border-slate-100 py-1">
            <dt className="text-slate-600">RUT o documento</dt>
            <dd className="font-semibold text-marino-900">
              {tutor.rut ? formatearRut(tutor.rut) : tutor.documento_extranjero}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-slate-100 py-1">
            <dt className="text-slate-600">Nacionalidad</dt>
            <dd className="font-semibold text-marino-900">
              {tutor.nacionalidad === 'chilena' ? 'Chilena' : 'Extranjera'}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-slate-100 py-1">
            <dt className="text-slate-600">Teléfono</dt>
            <dd className="font-semibold text-marino-900">{tutor.telefono}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-slate-100 py-1">
            <dt className="text-slate-600">Tramo RSH</dt>
            <dd className="font-semibold text-marino-900">{tutor.tramo_rsh ? `${tutor.tramo_rsh}%` : 'No aplica'}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-slate-100 py-1 sm:col-span-2">
            <dt className="text-slate-600">Dirección</dt>
            <dd className="font-semibold text-marino-900">{tutor.direccion}, {tutor.comuna}</dd>
          </div>
        </dl>
      </Tarjeta>

      <Tarjeta titulo="Mis documentos" descripcion="Documentos adjuntos a su postulación.">
        <ListaDocumentos documentos={documentos} permitirEliminar onEliminar={cargar} />
      </Tarjeta>

      <Tarjeta titulo="Beneficiarios inscritos">
        {!beneficiarios.length ? (
          <Vacio mensaje="Todavía no ha inscrito a ninguna niña o niño." />
        ) : (
          <ul className="flex flex-col gap-4">
            {beneficiarios.map((b) => {
              const notasBeneficiario = notas.filter((n) => n.beneficiario_id === b.id)
              const docsBeneficiario = documentos.filter((d) => d.beneficiario_id === b.id)
              return (
                <li key={b.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-base font-bold text-marino-900">{b.nombre_completo}</h3>
                      <p className="text-sm text-slate-600">
                        {formatearRut(b.rut)} · {ETIQUETA_SEXO[b.sexo]} ·{' '}
                        {calcularEdad(b.fecha_nacimiento, configuracion?.fecha_corte_edad)} años
                        {b.discapacidad && ' · Con discapacidad'}
                      </p>
                      {b.folio && (
                        <p className="mt-1 text-sm font-semibold text-emerald-700">Folio de retiro: {b.folio}</p>
                      )}
                    </div>
                    <InsigniaEstado estado={b.estado} />
                  </div>

                  {b.motivo_estado && (
                    <div className="mt-3">
                      <Alerta tipo={b.estado === 'rechazado' ? 'error' : 'aviso'}
                              titulo={b.estado === 'rechazado' ? 'Motivo del rechazo' : 'Debe corregir'}>
                        {b.motivo_estado}
                      </Alerta>
                    </div>
                  )}

                  {notasBeneficiario.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-2">
                      {notasBeneficiario.map((n) => (
                        <li key={n.id} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                          <p>{n.texto}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {n.autor_nombre || 'Municipalidad'} · {fechaHora(n.created_at)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <h4 className="mb-2 text-sm font-bold text-marino-900">Seguimiento</h4>
                      <LineaTiempo beneficiario={b} />
                    </div>
                    <div>
                      <h4 className="mb-2 text-sm font-bold text-marino-900">Documentos</h4>
                      <ListaDocumentos
                        documentos={docsBeneficiario}
                        permitirEliminar={b.estado !== 'aprobado'}
                        onEliminar={cargar}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {(b.estado === 'pendiente' || b.estado === 'observado') && (
                      <>
                        <Boton variante="secundario" onClick={() => navegar(`/tutor/beneficiarios/${b.id}`)}>
                          Corregir datos o documentos
                        </Boton>
                        <Boton variante="peligro" onClick={() => eliminar(b)}>Eliminar</Boton>
                      </>
                    )}
                    {b.estado === 'observado' && (
                      <Boton variante="exito" onClick={() => reenviar(b)}>Ya corregí: reenviar</Boton>
                    )}
                    {b.estado === 'rechazado' && (
                      <p className="text-sm text-slate-600">
                        Si cree que se trata de un error, acérquese a la Dirección de Desarrollo Comunitario.
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Tarjeta>

      <p className="text-xs text-slate-500">
        Estado del proceso: {ETIQUETA_ESTADO.pendiente.toLowerCase()} significa que la Municipalidad aún no revisa
        su solicitud. Le avisaremos por correo ante cualquier cambio.
      </p>
    </div>
  )
}
