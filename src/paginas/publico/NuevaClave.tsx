// Pantalla de cambio de contraseña tras el enlace de recuperación.
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, mensajeError } from '../../lib/supabase'
import { useNotificacion } from '../../contexto/NotificacionProvider'
import { Alerta, Boton, Campo, Entrada, Tarjeta } from '../../componentes/ui'

export function NuevaClave() {
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const { exito } = useNotificacion()
  const navegar = useNavigate()

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (password !== password2) { setError('Las contraseñas no coinciden.'); return }
    setEnviando(true)
    try {
      const { error: errorCambio } = await supabase.auth.updateUser({ password })
      if (errorCambio) throw errorCambio
      exito('Su contraseña fue actualizada.')
      navegar('/')
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Tarjeta titulo="Definir nueva contraseña">
        <form onSubmit={guardar} className="flex flex-col gap-4" noValidate>
          {error && <Alerta tipo="error">{error}</Alerta>}
          <Campo etiqueta="Nueva contraseña" requerido htmlFor="p1" ayuda="Mínimo 8 caracteres.">
            <Entrada id="p1" type="password" autoComplete="new-password" required
                     value={password} onChange={(e) => setPassword(e.target.value)} />
          </Campo>
          <Campo etiqueta="Repita la nueva contraseña" requerido htmlFor="p2">
            <Entrada id="p2" type="password" autoComplete="new-password" required
                     value={password2} onChange={(e) => setPassword2(e.target.value)} />
          </Campo>
          <Boton type="submit" cargando={enviando}>Guardar contraseña</Boton>
        </form>
      </Tarjeta>
    </div>
  )
}
