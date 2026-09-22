// ============================================================================
//  Datos del tutor: se usa tanto para completar la ficha (cuando la cuenta se
//  creó con confirmación de correo) como para corregirla más adelante.
// ============================================================================
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { esquemaTutor, validarArchivo, type DatosTutor as Datos } from '../../lib/validaciones'
import { formatearRut, rutParaGuardar } from '../../lib/rut'
import { supabase, mensajeError } from '../../lib/supabase'
import { subirDocumento, documentosDeTutor } from '../../lib/documentos'
import { sanitizar } from '../../lib/formato'
import { useSesion } from '../../contexto/SesionProvider'
import { useNotificacion } from '../../contexto/NotificacionProvider'
import { Alerta, Boton, Campo, Cargando, Entrada, Selector, Tarjeta } from '../../componentes/ui'
import type { Tutor } from '../../lib/tipos'

const TRAMOS = [40, 50, 60, 70, 80, 90, 100]

export function DatosTutor() {
  const { sesion, perfil } = useSesion()
  const { exito } = useNotificacion()
  const navegar = useNavigate()

  const [tutor, setTutor] = useState<Tutor | null>(null)
  const [tieneCartola, setTieneCartola] = useState(false)
  const [cartola, setCartola] = useState<File | null>(null)
  const [errorCartola, setErrorCartola] = useState('')
  const [errorGeneral, setErrorGeneral] = useState('')
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<Datos>({
    resolver: zodResolver(esquemaTutor),
    defaultValues: {
      nacionalidad: 'chilena',
      comuna: 'Tocopilla',
      email: sesion?.user.email ?? '',
      nombre_completo: perfil?.nombre ?? '',
      consentimiento: false,
    },
  })
  const esChileno = watch('nacionalidad') === 'chilena'

  useEffect(() => {
    let activo = true
    ;(async () => {
      if (!sesion) return
      const { data } = await supabase.from('tutores').select('*').eq('profile_id', sesion.user.id).maybeSingle()
      if (!activo) return
      if (data) {
        const t = data as Tutor
        setTutor(t)
        reset({
          nombre_completo: t.nombre_completo,
          nacionalidad: t.nacionalidad,
          rut: t.rut ? formatearRut(t.rut) : '',
          documento_extranjero: t.documento_extranjero ?? '',
          telefono: t.telefono,
          email: t.email,
          direccion: t.direccion,
          comuna: t.comuna,
          tramo_rsh: t.tramo_rsh ? String(t.tramo_rsh) : '',
          consentimiento: true,
        })
        const docs = await documentosDeTutor(t.id)
        if (activo) setTieneCartola(docs.some((d) => d.tipo === 'rsh'))
      }
      setCargando(false)
    })()
    return () => { activo = false }
  }, [sesion, reset])

  const alCambiarArchivo = (archivo: File | null) => {
    setErrorCartola('')
    if (!archivo) { setCartola(null); return }
    const problema = validarArchivo(archivo)
    if (problema) { setErrorCartola(problema); setCartola(null); return }
    setCartola(archivo)
  }

  const guardar = async (datos: Datos) => {
    setErrorGeneral('')
    if (esChileno && !tieneCartola && !cartola) {
      setErrorCartola('Adjunte la cartola del Registro Social de Hogares.')
      return
    }
    setEnviando(true)
    try {
      const fila = {
        profile_id: sesion!.user.id,
        nombre_completo: sanitizar(datos.nombre_completo),
        nacionalidad: datos.nacionalidad,
        rut: datos.rut ? rutParaGuardar(datos.rut) : null,
        documento_extranjero: datos.documento_extranjero ? sanitizar(datos.documento_extranjero) : null,
        telefono: sanitizar(datos.telefono),
        email: datos.email.trim().toLowerCase(),
        direccion: sanitizar(datos.direccion),
        comuna: sanitizar(datos.comuna),
        tramo_rsh: esChileno && datos.tramo_rsh ? Number(datos.tramo_rsh) : null,
        consentimiento: true,
      }

      let tutorId = tutor?.id
      if (tutor) {
        const { error } = await supabase.from('tutores').update(fila).eq('id', tutor.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('tutores').insert(fila).select().single()
        if (error) throw error
        tutorId = (data as Tutor).id
      }

      if (esChileno && cartola && tutorId) {
        await subirDocumento({ archivo: cartola, tipo: 'rsh', tutorId, perfilId: sesion!.user.id })
      }

      exito(tutor ? 'Sus datos fueron actualizados.' : 'Sus datos fueron registrados.')
      navegar('/tutor')
    } catch (e) {
      setErrorGeneral(mensajeError(e))
    } finally {
      setEnviando(false)
    }
  }

  if (cargando) return <Cargando />

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Tarjeta
        titulo={tutor ? 'Editar mis datos' : 'Complete sus datos de tutor o tutora'}
        descripcion="Los campos marcados con * son obligatorios."
      >
        <form onSubmit={handleSubmit(guardar)} className="flex flex-col gap-5" noValidate>
          {errorGeneral && <Alerta tipo="error">{errorGeneral}</Alerta>}

          <Campo etiqueta="Nombre completo" requerido htmlFor="nombre" error={errors.nombre_completo?.message}>
            <Entrada id="nombre" autoComplete="name" {...register('nombre_completo')} />
          </Campo>

          <Campo etiqueta="Nacionalidad" requerido htmlFor="nacionalidad" error={errors.nacionalidad?.message}>
            <Selector id="nacionalidad" {...register('nacionalidad')}>
              <option value="chilena">Chileno o chilena</option>
              <option value="extranjera">Extranjero o extranjera</option>
            </Selector>
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta={esChileno ? 'RUT' : 'RUT chileno (si tiene)'} requerido={esChileno} htmlFor="rut"
                   error={errors.rut?.message} ayuda="Ejemplo: 12.345.678-9">
              <Entrada id="rut" {...register('rut', {
                onBlur: (e) => setValue('rut', e.target.value ? formatearRut(e.target.value) : ''),
              })} />
            </Campo>
            {!esChileno && (
              <Campo etiqueta="Documento de identidad extranjero" htmlFor="documento"
                     error={errors.documento_extranjero?.message}>
                <Entrada id="documento" {...register('documento_extranjero')} />
              </Campo>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Teléfono" requerido htmlFor="telefono" error={errors.telefono?.message}>
              <Entrada id="telefono" type="tel" {...register('telefono')} />
            </Campo>
            <Campo etiqueta="Correo electrónico" requerido htmlFor="correo" error={errors.email?.message}>
              <Entrada id="correo" type="email" {...register('email')} />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Dirección" requerido htmlFor="direccion" error={errors.direccion?.message}>
              <Entrada id="direccion" {...register('direccion')} />
            </Campo>
            <Campo etiqueta="Comuna" requerido htmlFor="comuna" error={errors.comuna?.message}>
              <Entrada id="comuna" {...register('comuna')} />
            </Campo>
          </div>

          {esChileno && (
            <fieldset className="flex flex-col gap-4 rounded-xl bg-marino-50 p-4">
              <legend className="px-1 text-sm font-bold uppercase tracking-wide text-marino-600">
                Registro Social de Hogares
              </legend>
              <Campo etiqueta="Tramo RSH" requerido htmlFor="tramo" error={errors.tramo_rsh?.message}>
                <Selector id="tramo" {...register('tramo_rsh')}>
                  <option value="">Seleccione su tramo</option>
                  {TRAMOS.map((t) => <option key={t} value={t}>{t}%</option>)}
                </Selector>
              </Campo>
              <Campo
                etiqueta="Cartola del Registro Social de Hogares"
                requerido={!tieneCartola}
                htmlFor="cartola"
                error={errorCartola}
                ayuda={tieneCartola
                  ? 'Ya tiene una cartola adjunta. Suba un archivo solo si desea reemplazarla.'
                  : 'Archivo PDF, JPG o PNG de hasta 5 MB.'}
              >
                <Entrada id="cartola" type="file" accept="application/pdf,image/jpeg,image/png"
                         onChange={(e) => alCambiarArchivo(e.target.files?.[0] ?? null)} />
              </Campo>
            </fieldset>
          )}

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
            <input type="checkbox" className="mt-1 h-4 w-4" {...register('consentimiento')} />
            <span>Autorizo el tratamiento de mis datos personales conforme a la Ley N° 19.628 y la Ley N° 21.719.</span>
          </label>
          {errors.consentimiento && (
            <p role="alert" className="text-xs font-medium text-navidad-600">{errors.consentimiento.message}</p>
          )}

          <Boton type="submit" cargando={enviando} className="sm:w-56">Guardar mis datos</Boton>
        </form>
      </Tarjeta>
    </div>
  )
}
