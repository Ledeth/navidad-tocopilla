// ============================================================================
//  Estructura común: banner de demostración, encabezado institucional,
//  navegación según rol y pie de página.
// ============================================================================
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useState, type ReactNode } from 'react'
import { useSesion } from '../contexto/SesionProvider'
import { MODO_DEMO } from '../lib/supabase'

interface Enlace { a: string; texto: string }

function enlacesPorRol(rol: string | undefined): Enlace[] {
  if (rol === 'tutor') {
    return [
      { a: '/tutor', texto: 'Mi postulación' },
      { a: '/tutor/beneficiarios/nuevo', texto: 'Agregar beneficiario' },
    ]
  }
  if (rol === 'funcionario' || rol === 'admin') {
    const base: Enlace[] = [
      { a: '/panel', texto: 'Dashboard' },
      { a: '/panel/postulaciones', texto: 'Postulaciones' },
      { a: '/panel/listados', texto: 'Listados' },
      { a: '/panel/entregas', texto: 'Entregas' },
    ]
    if (rol === 'admin') {
      base.push(
        { a: '/admin/usuarios', texto: 'Usuarios' },
        { a: '/admin/configuracion', texto: 'Configuración' },
        { a: '/admin/importacion', texto: 'Importación' },
        { a: '/admin/auditoria', texto: 'Auditoría' },
      )
    }
    return base
  }
  return []
}

export function BannerDemo() {
  if (!MODO_DEMO) return null
  return (
    <div className="no-imprimir bg-amber-100 px-4 py-1.5 text-center text-xs font-semibold text-amber-900">
      Versión de demostración – datos ficticios
    </div>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const { sesion, perfil, cerrarSesion } = useSesion()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const navegar = useNavigate()
  const enlaces = enlacesPorRol(perfil?.rol)

  const salir = async () => {
    await cerrarSesion()
    navegar('/')
  }

  const claseEnlace = ({ isActive }: { isActive: boolean }) =>
    `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? 'bg-white/15 text-white' : 'text-marino-100 hover:bg-white/10 hover:text-white'
    }`

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#contenido" className="saltar-contenido">Saltar al contenido principal</a>
      <BannerDemo />

      <header className="no-imprimir bg-marino-800 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            {/* El logo institucional va sobre un fondo blanco: sus colores no
                tienen contraste suficiente sobre el azul marino del encabezado. */}
            <img
              src="/logo-tocopilla.png"
              alt="Ilustre Municipalidad de Tocopilla"
              width={738}
              height={312}
              className="h-12 w-auto rounded-lg bg-white px-2.5 py-1.5 sm:h-16"
            />
            <span className="leading-tight">
              <span className="block text-sm font-bold sm:text-base">Navidad 2026</span>
              <span className="block text-xs text-marino-200">Entrega de regalos · Tocopilla</span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            {sesion ? (
              <>
                <span className="hidden text-xs text-marino-100 sm:block">
                  {perfil?.nombre || sesion.user.email}
                  {perfil && <span className="ml-1 rounded bg-white/15 px-1.5 py-0.5 uppercase">{perfil.rol}</span>}
                </span>
                <button onClick={salir} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20">
                  Cerrar sesión
                </button>
              </>
            ) : (
              <Link to="/ingresar" className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-marino-800 hover:bg-marino-50">
                Ingresar
              </Link>
            )}
            {enlaces.length > 0 && (
              <button
                onClick={() => setMenuAbierto((v) => !v)}
                aria-expanded={menuAbierto}
                aria-controls="menu-principal"
                className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold lg:hidden"
              >
                Menú
              </button>
            )}
          </div>
        </div>

        {enlaces.length > 0 && (
          <nav
            id="menu-principal"
            aria-label="Navegación principal"
            className={`border-t border-white/10 bg-marino-900 ${menuAbierto ? 'block' : 'hidden'} lg:block`}
          >
            <ul className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-2 sm:px-6 lg:flex-row lg:items-center">
              {enlaces.map((e) => (
                <li key={e.a}>
                  <NavLink to={e.a} end={e.a === '/panel' || e.a === '/tutor'} className={claseEnlace}
                           onClick={() => setMenuAbierto(false)}>
                    {e.texto}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <main id="contenido" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="no-imprimir border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Ilustre Municipalidad de Tocopilla · Dirección de Desarrollo Comunitario · Región de Antofagasta</p>
          <Link to="/privacidad" className="font-semibold text-marino-700 underline">Política de privacidad</Link>
        </div>
      </footer>
    </div>
  )
}
