// ============================================================================
//  Sesión: usuario autenticado, su perfil (rol) y la configuración del proceso.
// ============================================================================
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigurado } from '../lib/supabase'
import type { Configuracion, Perfil } from '../lib/tipos'

interface Contexto {
  sesion: Session | null
  perfil: Perfil | null
  configuracion: Configuracion | null
  cargando: boolean
  esTutor: boolean
  esFuncionario: boolean
  esAdmin: boolean
  postulacionAbierta: boolean
  refrescarPerfil: () => Promise<void>
  refrescarConfiguracion: () => Promise<void>
  cerrarSesion: () => Promise<void>
}

const SesionCtx = createContext<Contexto | null>(null)

export function SesionProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(null)
  const [cargando, setCargando] = useState(true)

  const cargarPerfil = useCallback(async (userId: string | undefined) => {
    if (!userId) { setPerfil(null); return }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setPerfil((data as Perfil) ?? null)
  }, [])

  const refrescarConfiguracion = useCallback(async () => {
    if (!supabaseConfigurado) return
    const { data } = await supabase.from('configuracion').select('*').eq('id', 1).maybeSingle()
    setConfiguracion((data as Configuracion) ?? null)
  }, [])

  useEffect(() => {
    if (!supabaseConfigurado) { setCargando(false); return }
    let activo = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!activo) return
      setSesion(data.session)
      await cargarPerfil(data.session?.user.id)
      setCargando(false)
    })

    const { data: suscripcion } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSesion(nuevaSesion)
      // No se usa await dentro del callback para no bloquear al cliente de Auth.
      void cargarPerfil(nuevaSesion?.user.id)
    })

    void refrescarConfiguracion()
    return () => { activo = false; suscripcion.subscription.unsubscribe() }
  }, [cargarPerfil, refrescarConfiguracion])

  const cerrarSesion = useCallback(async () => {
    await supabase.auth.signOut()
    setPerfil(null)
    setSesion(null)
  }, [])

  const valor = useMemo<Contexto>(() => {
    const hoy = new Date().toISOString().slice(0, 10)
    return {
      sesion,
      perfil,
      configuracion,
      cargando,
      esTutor: perfil?.rol === 'tutor',
      esFuncionario: perfil?.rol === 'funcionario' || perfil?.rol === 'admin',
      esAdmin: perfil?.rol === 'admin',
      postulacionAbierta: configuracion
        ? hoy >= configuracion.fecha_apertura && hoy <= configuracion.fecha_cierre
        : true,
      refrescarPerfil: () => cargarPerfil(sesion?.user.id),
      refrescarConfiguracion,
      cerrarSesion,
    }
  }, [sesion, perfil, configuracion, cargando, cargarPerfil, refrescarConfiguracion, cerrarSesion])

  return <SesionCtx.Provider value={valor}>{children}</SesionCtx.Provider>
}

export function useSesion(): Contexto {
  const ctx = useContext(SesionCtx)
  if (!ctx) throw new Error('useSesion debe usarse dentro de SesionProvider')
  return ctx
}
