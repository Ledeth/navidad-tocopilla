// ============================================================================
//  Módulo 2 — Registro y corrección de beneficiarios (hijas e hijos).
//  Incluye la carga de los documentos obligatorios según la configuración
//  del proceso y la condición de discapacidad declarada.
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { esquemaBeneficiario, validarArchivo, type DatosBeneficiario } from '../../lib/validaciones'
import { formatearRut, rutParaGuardar } from '../../lib/rut'
import { supabase, mensajeError } from '../../lib/supabase'
import { subirDocumento, documentosDeTutor } from '../../lib/documentos'
import { calcularEdad, fechaCorta, sanitizar } from '../../lib/formato'
import { useSesion } from '../../contexto/SesionProvider'
import { useNotificacion } from '../../contexto/NotificacionProvider'
import { Alerta, Boton, Campo, Cargando, Entrada, Selector, AreaTexto, Tarjeta } from '../../componentes/ui'
import { ListaDocumentos } from '../../componentes/Documentos'
import type { Beneficiario, Documento, TipoDocumento, Tutor } from '../../lib/tipos'

type Adjuntos = Partial<Record<TipoDocumento, File | null>>

export function BeneficiarioForm() {
  const { id } = useParams()
  const esEdicion = Boolean(id)
  const { sesion, configuracion, postulacionAbierta } = useSesion()
  const { exito, error: avisarError } = useNotificacion()
  const navegar = useNavigate()

  const [tutor, setTutor] = useState<Tutor | null>(null)
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [adjuntos, setAdjuntos] = useState<Adjuntos>({})
  const [erroresArchivo, setErroresArchivo] = useState<Partial<Record<TipoDocumento, string>>>({})
  const [errorGeneral, setErrorGeneral] = useState('')
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<DatosBeneficiario>({
    resolver: zodResolver(esquemaBeneficiario),
    defaultValues: { sexo: 'femenino', discapacidad: false, observaciones: '' },
  })

  const fechaNacimiento = watch('fecha_nacimiento')
  const discapacidad = watch('discapacidad')

  const edad = useMemo(
    () => (fechaNacimiento ? calcularEdad(fechaNacimiento, configuracion?.fecha_corte_edad) : NaN),
    [fechaNacimiento, configuracion],
  )
  const superaEdad = Number.isFinite(edad) && configuracion ? edad > configuracion.edad_maxima : false

  useEffect(() => {
    let activo = true
    ;(async () => {
      if (!sesion) return
      const { data: filaTutor } = await supabase
        .from('tutores').select('*').eq('profile_id', sesion.user.id).maybeSingle()
      if (!activo) return
      if (!filaTutor) { setCargando(false); return }
      const t = filaTutor as Tutor
      setTutor(t)
      setDocumentos(await documentosDeTutor(t.id))

      if (esEdicion && id) {
        const { data } = await supabase.from('beneficiarios').select('*').eq('id', id).maybeSingle()
        if (data && activo) {
          const b = data as Beneficiario
          reset({
            rut: formatearRut(b.rut),
            nombre_completo: b.nombre_completo,
            sexo: b.sexo,
            fecha_nacimiento: b.fecha_nacimiento.slice(0, 10),
            discapacidad: b.discapacidad,
            observaciones: b.observaciones ?? '',
          })
        }
      }
      if (activo) setCargando(false)
    })()
    return () => { activo = false }
  }, [sesion, esEdicion, id, reset])

  const docsDelBeneficiario = documentos.filter((d) => d.beneficiario_id === id)
  const tiene = (tipo: TipoDocumento) => docsDelBeneficiario.some((d) => d.tipo === tipo)

  const elegirArchivo = (tipo: TipoDocumento, archivo: File | null) => {
    setErroresArchivo((prev) => ({ ...prev, [tipo]: '' }))
    if (!archivo) { setAdjuntos((prev) => ({ ...prev, [tipo]: null })); return }
    const problema = validarArchivo(archivo)
    if (problema) {
      setErroresArchivo((prev) => ({ ...prev, [tipo]: problema }))
      setAdjuntos((prev) => ({ ...prev, [tipo]: null }))
      return
    }
    setAdjuntos((prev) => ({ ...prev, [tipo]: archivo }))
  }

  const guardar = async (datos: DatosBeneficiario) => {
    setErrorGeneral('')
    if (!tutor) { setErrorGeneral('Primero debe completar sus datos de tutor.'); return }
    if (superaEdad) {
      setErrorGeneral(
        `La niña o niño supera la edad máxima de ${configuracion?.edad_maxima} años al ` +
        `${fechaCorta(configuracion?.fecha_corte_edad)}, por lo que no puede postular en este proceso.`,
      )
      return
    }

    // Documentos obligatorios según la configuración y lo declarado.
    const faltantes: Partial<Record<TipoDocumento, string>> = {}
    if (!tiene('identidad') && !adjuntos.identidad) {
      faltantes.identidad = 'Adjunte la cédula de identidad o el certificado de nacimiento.'
    }
    if (configuracion?.certificado_estudios_obligatorio && !tiene('estudios') && !adjuntos.estudios) {
      faltantes.estudios = 'En este proceso el certificado de estudios es obligatorio.'
    }
    if (datos.discapacidad && !tiene('discapacidad') && !adjuntos.discapacidad) {
      faltantes.discapacidad = 'Si declara condición de discapacidad, debe adjuntar la credencial o el certificado.'
    }
    if (Object.keys(faltantes).length) {
      setErroresArchivo((prev) => ({ ...prev, ...faltantes }))
      setErrorGeneral('Faltan documentos obligatorios.')
      return
    }

    setEnviando(true)
    try {
      const fila = {
        tutor_id: tutor.id,
        rut: rutParaGuardar(datos.rut),
        nombre_completo: sanitizar(datos.nombre_completo),
        sexo: datos.sexo,
        fecha_nacimiento: datos.fecha_nacimiento,
        discapacidad: datos.discapacidad,
        observaciones: datos.observaciones ? sanitizar(datos.observaciones) : null,
      }

      let beneficiarioId = id
      if (esEdicion && id) {
        // Al corregir, la postulación vuelve a quedar pendiente de revisión.
        const { error } = await supabase
          .from('beneficiarios').update({ ...fila, estado: 'pendiente' }).eq('id', id)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('beneficiarios').insert({ ...fila, estado: 'pendiente' }).select().single()
        if (error) throw error
        beneficiarioId = (data as Beneficiario).id
      }

      // Carga de los documentos seleccionados.
      for (const [tipo, archivo] of Object.entries(adjuntos) as [TipoDocumento, File | null][]) {
        if (!archivo) continue
        await subirDocumento({
          archivo, tipo, tutorId: tutor.id, beneficiarioId, perfilId: sesion?.user.id ?? null,
        })
      }

      exito(esEdicion ? 'Los datos fueron actualizados y enviados a revisión.' : 'El beneficiario fue inscrito.')
      navegar('/tutor')
    } catch (e) {
      setErrorGeneral(mensajeError(e))
    } finally {
      setEnviando(false)
    }
  }

  if (cargando) return <Cargando />

  if (!tutor) {
    return (
      <Alerta tipo="aviso" titulo="Falta completar sus datos">
        Antes de inscribir a una niña o niño debe registrar sus datos de tutor o tutora.
        <p className="mt-3">
          <Boton onClick={() => navegar('/tutor/datos')}>Completar mis datos</Boton>
        </p>
      </Alerta>
    )
  }

  if (!esEdicion && !postulacionAbierta) {
    return (
      <Alerta tipo="aviso" titulo="El proceso de postulación está cerrado">
        No es posible inscribir nuevos beneficiarios fuera del período informado.
      </Alerta>
    )
  }

  const campoArchivo = (tipo: TipoDocumento, etiqueta: string, requerido: boolean, ayuda: string) => (
    <Campo
      etiqueta={etiqueta}
      requerido={requerido && !tiene(tipo)}
      htmlFor={`doc-${tipo}`}
      error={erroresArchivo[tipo]}
      ayuda={tiene(tipo) ? 'Ya hay un archivo adjunto. Suba otro solo si desea reemplazarlo.' : ayuda}
    >
      <Entrada
        id={`doc-${tipo}`} type="file" accept="application/pdf,image/jpeg,image/png"
        onChange={(e) => elegirArchivo(tipo, e.target.files?.[0] ?? null)}
      />
    </Campo>
  )

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Tarjeta
        titulo={esEdicion ? 'Corregir datos del beneficiario' : 'Inscribir a una niña o niño'}
        descripcion={`Edad máxima para postular: ${configuracion?.edad_maxima ?? 12} años al ${fechaCorta(configuracion?.fecha_corte_edad)}.`}
      >
        <form onSubmit={handleSubmit(guardar)} className="flex flex-col gap-5" noValidate>
          {errorGeneral && <Alerta tipo="error">{errorGeneral}</Alerta>}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="RUT del beneficiario" requerido htmlFor="rut" error={errors.rut?.message}
                   ayuda="Ejemplo: 25.678.910-3">
              <Entrada id="rut" aria-invalid={!!errors.rut} {...register('rut', {
                onBlur: (e) => setValue('rut', e.target.value ? formatearRut(e.target.value) : ''),
              })} />
            </Campo>
            <Campo etiqueta="Nombre completo" requerido htmlFor="nombre" error={errors.nombre_completo?.message}>
              <Entrada id="nombre" aria-invalid={!!errors.nombre_completo} {...register('nombre_completo')} />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Sexo" requerido htmlFor="sexo" error={errors.sexo?.message}>
              <Selector id="sexo" {...register('sexo')}>
                <option value="femenino">Femenino</option>
                <option value="masculino">Masculino</option>
                <option value="otro">Otro</option>
              </Selector>
            </Campo>
            <Campo
              etiqueta="Fecha de nacimiento" requerido htmlFor="nacimiento"
              error={errors.fecha_nacimiento?.message}
              ayuda={Number.isFinite(edad) ? `Edad al ${fechaCorta(configuracion?.fecha_corte_edad)}: ${edad} años.` : undefined}
            >
              <Entrada id="nacimiento" type="date" max={new Date().toISOString().slice(0, 10)}
                       aria-invalid={!!errors.fecha_nacimiento} {...register('fecha_nacimiento')} />
            </Campo>
          </div>

          {superaEdad && (
            <Alerta tipo="error" titulo="No cumple el requisito de edad">
              La niña o niño tendrá {edad} años al {fechaCorta(configuracion?.fecha_corte_edad)} y el máximo
              permitido es {configuracion?.edad_maxima} años.
            </Alerta>
          )}

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
            <input type="checkbox" className="mt-1 h-4 w-4" {...register('discapacidad')} />
            <span>
              Declaro que la niña o niño presenta una condición de discapacidad.
              <span className="block text-xs text-slate-500">
                Si marca esta casilla, debe adjuntar la credencial de discapacidad o un certificado.
              </span>
            </span>
          </label>

          <Campo etiqueta="Observaciones" htmlFor="observaciones" error={errors.observaciones?.message}
                 ayuda="Opcional. Cualquier antecedente que la Municipalidad deba considerar.">
            <AreaTexto id="observaciones" maxLength={600} {...register('observaciones')} />
          </Campo>

          <fieldset className="flex flex-col gap-4 rounded-xl bg-marino-50 p-4">
            <legend className="px-1 text-sm font-bold uppercase tracking-wide text-marino-600">
              Documentos
            </legend>
            {campoArchivo('identidad', 'Cédula de identidad o certificado de nacimiento', true,
              'Obligatorio. PDF, JPG o PNG de hasta 5 MB.')}
            {campoArchivo('estudios', 'Certificado de estudios',
              Boolean(configuracion?.certificado_estudios_obligatorio),
              configuracion?.certificado_estudios_obligatorio
                ? 'Obligatorio en este proceso.'
                : 'Opcional en este proceso.')}
            {discapacidad && campoArchivo('discapacidad', 'Credencial o certificado de discapacidad', true,
              'Obligatorio porque declaró condición de discapacidad.')}
          </fieldset>

          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <Boton type="submit" cargando={enviando} disabled={superaEdad} className="sm:w-56">
              {esEdicion ? 'Guardar y reenviar' : 'Inscribir beneficiario'}
            </Boton>
            <Boton variante="secundario" type="button" onClick={() => navegar('/tutor')} className="sm:w-40">
              Cancelar
            </Boton>
          </div>
        </form>
      </Tarjeta>

      {esEdicion && (
        <Tarjeta titulo="Documentos ya adjuntos">
          <ListaDocumentos
            documentos={docsDelBeneficiario}
            permitirEliminar
            onEliminar={async () => setDocumentos(await documentosDeTutor(tutor.id))}
          />
        </Tarjeta>
      )}
    </div>
  )
}
