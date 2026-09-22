// Inicio de sesión (con CAPTCHA y bloque de credenciales demo).
import { useState, useCallback, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase, mensajeError, MODO_DEMO, TURNSTILE_SITE_KEY, verificarTurnstile } from '../../lib/supabase'
import { useSesion } from '../../contexto/SesionProvider'
import { useNotificacion } from '../../contexto/NotificacionProvider'
import { Alerta, Boton, Campo, Entrada, Tarjeta } from '../../componentes/ui'
import { Turnstile } from '../../componentes/Turnstile'

const CUENTAS_DEMO = [
  { rol: 'Tutor (vecino)', email: 'tutor.demo@navidadtocopilla.cl' },
  { rol: 'Funcionario municipal', email: 'funcionario.demo@navidadtocopilla.cl' },
  { rol: 'Administrador', email: 'admin.demo@navidadtocopilla.cl' },
]
const CLAVE_DEMO = 'Demo2026!'

export function Ingresar() {
  const { sesion, perfil } = useSesion()
  const { error: avisarError } = useNotificacion()
  const navegar = useNavigate()
  const ubicacion = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [avisoRecuperar, setAvisoRecuperar] = useState('')

  const recibirToken = useCallback((t: string) => setToken(t), [])

  if (sesion && perfil) {
    const destino = (ubicacion.state as { desde?: string })?.desde
      ?? (perfil.rol === 'tutor' ? '/tutor' : '/panel')
    return <Navigate to={destino} replace />
  }

  const ingresar = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (TURNSTILE_SITE_KEY && !token) {
      setError('Complete la verificación de seguridad antes de continuar.')
      return
    }
    setEnviando(true)
    try {
      await verificarTurnstile(token)
      const { error: errorAuth } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (errorAuth) throw errorAuth
      navegar('/')
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setEnviando(false)
    }
  }

  const recuperar = async () => {
    if (!email.trim()) {
      setError('Escriba su correo electrónico para enviarle el enlace de recuperación.')
      return
    }
    try {
      const { error: errorEnvio } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/nueva-clave`,
      })
      if (errorEnvio) throw errorEnvio
      setAvisoRecuperar('Le enviamos un correo con los pasos para recuperar su contraseña.')
    } catch (e) {
      avisarError(mensajeError(e))
    }
  }

  const usarDemo = (correo: string) => {
    setEmail(correo)
    setPassword(CLAVE_DEMO)
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 lg:grid-cols-2">
      <Tarjeta titulo="Ingresar" descripcion="Acceda con el correo y la contraseña que registró.">
        <form onSubmit={ingresar} className="flex flex-col gap-4" noValidate>
          {error && <Alerta tipo="error">{error}</Alerta>}
          {avisoRecuperar && <Alerta tipo="exito">{avisoRecuperar}</Alerta>}

          <Campo etiqueta="Correo electrónico" requerido htmlFor="email">
            <Entrada
              id="email" type="email" autoComplete="email" required inputMode="email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@correo.cl"
            />
          </Campo>

          <Campo etiqueta="Contraseña" requerido htmlFor="password">
            <Entrada
              id="password" type="password" autoComplete="current-password" required
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </Campo>

          <Turnstile onToken={recibirToken} />

          <Boton type="submit" cargando={enviando}>Ingresar</Boton>

          <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={recuperar} className="text-left font-semibold text-marino-700 underline">
              Olvidé mi contraseña
            </button>
            <p className="text-slate-600">
              ¿No tiene cuenta?{' '}
              <Link to="/registro" className="font-semibold text-marino-700 underline">Inscribirme</Link>
            </p>
          </div>
        </form>
      </Tarjeta>

      {MODO_DEMO && (
        <Tarjeta titulo="Credenciales de demostración" descripcion="Solo para evaluar la plataforma. Los datos son ficticios.">
          <ul className="flex flex-col gap-3">
            {CUENTAS_DEMO.map((c) => (
              <li key={c.email} className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-marino-600">{c.rol}</p>
                <p className="mt-1 break-all font-mono text-sm text-slate-800">{c.email}</p>
                <p className="font-mono text-sm text-slate-800">{CLAVE_DEMO}</p>
                <Boton variante="secundario" className="mt-2" onClick={() => usarDemo(c.email)}>
                  Usar estas credenciales
                </Boton>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </div>
  )
}
