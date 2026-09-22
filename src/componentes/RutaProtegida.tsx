// Control de acceso por rol en el cliente (la seguridad real la aplica RLS).
import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useSesion } from '../contexto/SesionProvider'
import { Cargando, Alerta } from './ui'
import type { Rol } from '../lib/tipos'

export function RutaProtegida({ roles, children }: { roles: Rol[]; children: ReactNode }) {
  const { sesion, perfil, cargando } = useSesion()
  const ubicacion = useLocation()

  if (cargando) return <Cargando texto="Verificando su sesión…" />
  if (!sesion) return <Navigate to="/ingresar" replace state={{ desde: ubicacion.pathname }} />
  if (!perfil) return <Cargando texto="Cargando su perfil…" />

  if (!perfil.activo) {
    return (
      <Alerta tipo="error" titulo="Cuenta desactivada">
        Su cuenta fue desactivada. Comuníquese con la Municipalidad de Tocopilla.
      </Alerta>
    )
  }

  if (!roles.includes(perfil.rol)) {
    const destino = perfil.rol === 'tutor' ? '/tutor' : '/panel'
    return <Navigate to={destino} replace />
  }

  return <>{children}</>
}
