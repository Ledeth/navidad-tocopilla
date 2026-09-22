// ============================================================================
//  Módulo 1 — Inscripción del tutor o tutora.
//  Crea la cuenta en Supabase Auth, registra los datos del tutor y adjunta la
//  cartola del Registro Social de Hogares cuando corresponde.
// ============================================================================
import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { esquemaRegistro, validarArchivo, type DatosRegistro } from '../../lib/validaciones'
import { formatearRut, rutParaGuardar } from '../../lib/rut'
import { supabase, mensajeError, TURNSTILE_SITE_KEY, verificarTurnstile } from '../../lib/supabase'
import { subirDocumento } from '../../lib/documentos'
import { sanitizar, fechaCorta } from '../../lib/formato'
import { registrarEnvio, segundosRestantes } from '../../lib/limitador'
import { useSesion } from '../../contexto/SesionProvider'
import { useNotificacion } from '../../contexto/NotificacionProvider'
import { Alerta, Boton, Campo, Entrada, Selector, Tarjeta } from '../../componentes/ui'
import { Turnstile } from '../../componentes/Turnstile'

const TRAMOS = [40, 50, 60, 70, 80, 90, 100]

export function Registro() {
  const { configuracion, postulacionAbierta, sesion } = useSesion()
  const { exito } = useNotificacion()
  const navegar = useNavigate()

  const [token, setToken] = useState('')
  const [cartola, setCartola] = useState<File | null>(null)
  const [errorCartola, setErrorCartola] = useState('')
  const [errorGeneral, setErrorGeneral] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState(false)

  const {
    register, handleSubmit, watch, setValue, formState: { errors },
  } = useForm<DatosRegistro>({
    resolver: zodResolver(esquemaRegistro),
    defaultValues: { nacionalidad: 'chilena', comuna: 'Tocopilla', consentimiento: false },
  })

  const nacionalidad = watch('nacionalidad')
  const esChileno = nacionalidad === 'chilena'
  const recibirToken = useCallback((t: string) => setToken(t), [])

  const alCambiarArchivo = (archivo: File | null) => {
    setErrorCartola('')
    if (!archivo) { setCartola(null); return }
    const problema = validarArchivo(archivo)
    if (problema) { setErrorCartola(problema); setCartola(null); return }
    setCartola(archivo)
  }

  const enviar = async (datos: DatosRegistro) => {
    setErrorGeneral('')

    const espera = segundosRestantes('registro', 30_000)
    if (espera > 0) {
      setErrorGeneral(`Espere ${espera} segundos antes de volver a enviar el formulario.`)
      return
    }
    if (TURNSTILE_SITE_KEY && !token) {
      setErrorGeneral('Complete la verificación de seguridad antes de continuar.')
      return
    }
    if (esChileno && !cartola) {
      setErrorCartola('Adjunte la cartola del Registro Social de Hogares.')
      return
    }

    setEnviando(true)
    try {
      await verificarTurnstile(token)
      registrarEnvio('registro')

      const email = datos.email.trim().toLowerCase()

      // 1. Crear la cuenta. El rol siempre es 'tutor' (lo fuerza el trigger).
      const { data: alta, error: errorAlta } = await supabase.auth.signUp({
        email,
        password: datos.password,
        options: {
          data: { nombre: sanitizar(datos.nombre_completo) },
          emailRedirectTo: `${window.location.origin}/ingresar`,
        },
      })
      if (errorAlta) throw errorAlta

      // Si el proyecto exige confirmación de correo no hay sesión todavía.
      if (!alta.session) {
        setListo(true)
        return
      }

      const perfilId = alta.user?.id ?? null

      // 2. Registrar los datos del tutor.
      const { data: tutor, error: errorTutor } = await supabase
        .from('tutores')
        .insert({
          profile_id: perfilId,
          nombre_completo: sanitizar(datos.nombre_completo),
          nacionalidad: datos.nacionalidad,
          rut: datos.rut ? rutParaGuardar(datos.rut) : null,
          documento_extranjero: datos.documento_extranjero ? sanitizar(datos.documento_extranjero) : null,
          telefono: sanitizar(datos.telefono),
          email,
          direccion: sanitizar(datos.direccion),
          comuna: sanitizar(datos.comuna),
          tramo_rsh: esChileno && datos.tramo_rsh ? Number(datos.tramo_rsh) : null,
          consentimiento: true,
        })
        .select()
        .single()
      if (errorTutor) throw errorTutor

      // 3. Adjuntar la cartola del RSH (solo tutores chilenos).
      if (esChileno && cartola) {
        await subirDocumento({ archivo: cartola, tipo: 'rsh', tutorId: tutor.id, perfilId })
      }

      exito('Su inscripción fue registrada. Ahora puede agregar a sus hijas e hijos.')
      navegar('/tutor')
    } catch (e) {
      setErrorGeneral(mensajeError(e))
    } finally {
      setEnviando(false)
    }
  }

  if (sesion) {
    return (
      <Alerta tipo="info" titulo="Ya tiene una sesión iniciada">
        <Link to="/tutor" className="font-semibold underline">Ir a mi postulación</Link>
      </Alerta>
    )
  }

  if (listo) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <Alerta tipo="exito" titulo="Revise su correo electrónico">
          Le enviamos un mensaje para confirmar su cuenta. Después de confirmarla, ingrese para completar el
          registro de sus hijas e hijos.
          <p className="mt-3">
            <Link to="/ingresar" className="font-semibold underline">Ir a ingresar</Link>
          </p>
        </Alerta>
      </div>
    )
  }

  if (!postulacionAbierta) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Alerta tipo="aviso" titulo="El proceso de postulación está cerrado">
          Las inscripciones se reciben entre el {fechaCorta(configuracion?.fecha_apertura)} y el{' '}
          {fechaCorta(configuracion?.fecha_cierre)}. Si necesita ayuda, acérquese a la Dirección de Desarrollo
          Comunitario de la Municipalidad de Tocopilla.
        </Alerta>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Tarjeta
        titulo="Inscripción del tutor o tutora"
        descripcion="Complete sus datos. Los campos marcados con * son obligatorios."
      >
        <form onSubmit={handleSubmit(enviar)} className="flex flex-col gap-5" noValidate>
          {errorGeneral && <Alerta tipo="error">{errorGeneral}</Alerta>}

          <fieldset className="flex flex-col gap-4 border-0 p-0">
            <legend className="mb-2 text-sm font-bold uppercase tracking-wide text-marino-600">
              Datos personales
            </legend>

            <Campo etiqueta="Nombre completo" requerido htmlFor="nombre" error={errors.nombre_completo?.message}>
              <Entrada id="nombre" autoComplete="name" aria-invalid={!!errors.nombre_completo}
                       {...register('nombre_completo')} />
            </Campo>

            <Campo etiqueta="Nacionalidad" requerido htmlFor="nacionalidad" error={errors.nacionalidad?.message}
                   ayuda="Las familias extranjeras no necesitan el Registro Social de Hogares.">
              <Selector id="nacionalidad" {...register('nacionalidad')}>
                <option value="chilena">Chileno o chilena</option>
                <option value="extranjera">Extranjero o extranjera</option>
              </Selector>
            </Campo>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                etiqueta={esChileno ? 'RUT' : 'RUT chileno (si tiene)'}
                requerido={esChileno}
                htmlFor="rut"
                error={errors.rut?.message}
                ayuda="Ejemplo: 12.345.678-9"
              >
                <Entrada
                  id="rut" inputMode="text" aria-invalid={!!errors.rut}
                  {...register('rut', {
                    onBlur: (e) => setValue('rut', e.target.value ? formatearRut(e.target.value) : ''),
                  })}
                />
              </Campo>

              {!esChileno && (
                <Campo
                  etiqueta="Documento de identidad extranjero"
                  htmlFor="documento"
                  error={errors.documento_extranjero?.message}
                  ayuda="Pasaporte, DNI o cédula de identidad para extranjeros."
                >
                  <Entrada id="documento" aria-invalid={!!errors.documento_extranjero}
                           {...register('documento_extranjero')} />
                </Campo>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Teléfono" requerido htmlFor="telefono" error={errors.telefono?.message}
                     ayuda="Ejemplo: +56 9 8765 4321">
                <Entrada id="telefono" type="tel" inputMode="tel" autoComplete="tel"
                         aria-invalid={!!errors.telefono} {...register('telefono')} />
              </Campo>
              <Campo etiqueta="Correo electrónico" requerido htmlFor="correo" error={errors.email?.message}>
                <Entrada id="correo" type="email" inputMode="email" autoComplete="email"
                         aria-invalid={!!errors.email} {...register('email')} />
              </Campo>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Dirección" requerido htmlFor="direccion" error={errors.direccion?.message}>
                <Entrada id="direccion" autoComplete="street-address" aria-invalid={!!errors.direccion}
                         {...register('direccion')} />
              </Campo>
              <Campo etiqueta="Comuna" requerido htmlFor="comuna" error={errors.comuna?.message}>
                <Entrada id="comuna" aria-invalid={!!errors.comuna} {...register('comuna')} />
              </Campo>
            </div>
          </fieldset>

          {esChileno && (
            <fieldset className="flex flex-col gap-4 rounded-xl bg-marino-50 p-4">
              <legend className="mb-1 px-1 text-sm font-bold uppercase tracking-wide text-marino-600">
                Registro Social de Hogares
              </legend>

              <Campo etiqueta="Tramo RSH" requerido htmlFor="tramo" error={errors.tramo_rsh?.message}>
                <Selector id="tramo" aria-invalid={!!errors.tramo_rsh} {...register('tramo_rsh')}>
                  <option value="">Seleccione su tramo</option>
                  {TRAMOS.map((t) => <option key={t} value={t}>{t}%</option>)}
                </Selector>
              </Campo>

              <Campo
                etiqueta="Cartola del Registro Social de Hogares"
                requerido
                htmlFor="cartola"
                error={errorCartola}
                ayuda="Archivo PDF, JPG o PNG de hasta 5 MB."
              >
                <Entrada
                  id="cartola" type="file" accept="application/pdf,image/jpeg,image/png"
                  aria-invalid={!!errorCartola}
                  onChange={(e) => alCambiarArchivo(e.target.files?.[0] ?? null)}
                />
              </Campo>
              {cartola && <p className="text-xs text-emerald-700">Archivo seleccionado: {cartola.name}</p>}
            </fieldset>
          )}

          <fieldset className="flex flex-col gap-4 border-0 p-0">
            <legend className="mb-2 text-sm font-bold uppercase tracking-wide text-marino-600">
              Datos de acceso
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Contraseña" requerido htmlFor="clave" error={errors.password?.message}
                     ayuda="Mínimo 8 caracteres.">
                <Entrada id="clave" type="password" autoComplete="new-password"
                         aria-invalid={!!errors.password} {...register('password')} />
              </Campo>
              <Campo etiqueta="Repita la contraseña" requerido htmlFor="clave2" error={errors.password2?.message}>
                <Entrada id="clave2" type="password" autoComplete="new-password"
                         aria-invalid={!!errors.password2} {...register('password2')} />
              </Campo>
            </div>
          </fieldset>

          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4">
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input type="checkbox" className="mt-1 h-4 w-4" {...register('consentimiento')} />
              <span>
                Autorizo a la Ilustre Municipalidad de Tocopilla a tratar mis datos personales y los de las niñas
                y niños que inscribo, con el único fin de gestionar esta entrega de regalos, conforme a la
                Ley N° 19.628 y la Ley N° 21.719.{' '}
                <Link to="/privacidad" className="font-semibold text-marino-700 underline" target="_blank">
                  Ver política de privacidad
                </Link>
                .
              </span>
            </label>
            {errors.consentimiento && (
              <p role="alert" className="text-xs font-medium text-navidad-600">{errors.consentimiento.message}</p>
            )}
          </div>

          <Turnstile onToken={recibirToken} />

          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <Boton type="submit" cargando={enviando} className="sm:w-48">Crear mi cuenta</Boton>
            <Link to="/" className="sm:w-48">
              <Boton variante="secundario" type="button" className="w-full">Volver</Boton>
            </Link>
          </div>
        </form>
      </Tarjeta>
    </div>
  )
}
