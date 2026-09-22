// Avisos flotantes (toasts) accesibles.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type Tipo = 'exito' | 'error' | 'info'
interface Aviso { id: number; tipo: Tipo; texto: string }

interface Contexto {
  avisar: (texto: string, tipo?: Tipo) => void
  exito: (texto: string) => void
  error: (texto: string) => void
}

const NotificacionCtx = createContext<Contexto | null>(null)

export function NotificacionProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])

  const avisar = useCallback((texto: string, tipo: Tipo = 'info') => {
    const id = Date.now() + Math.random()
    setAvisos((previos) => [...previos, { id, tipo, texto }])
    setTimeout(() => setAvisos((previos) => previos.filter((a) => a.id !== id)), 6000)
  }, [])

  const valor = useMemo<Contexto>(() => ({
    avisar,
    exito: (texto: string) => avisar(texto, 'exito'),
    error: (texto: string) => avisar(texto, 'error'),
  }), [avisar])

  const colores: Record<Tipo, string> = {
    exito: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    error: 'border-navidad-300 bg-navidad-50 text-navidad-700',
    info: 'border-marino-300 bg-marino-50 text-marino-900',
  }

  return (
    <NotificacionCtx.Provider value={valor}>
      {children}
      <div aria-live="polite" aria-atomic="false"
           className="pointer-events-none fixed inset-x-3 bottom-3 z-[60] flex flex-col gap-2 sm:left-auto sm:right-4 sm:w-96">
        {avisos.map((a) => (
          <div key={a.id} className={`pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-lg ${colores[a.tipo]}`}>
            {a.texto}
          </div>
        ))}
      </div>
    </NotificacionCtx.Provider>
  )
}

export function useNotificacion(): Contexto {
  const ctx = useContext(NotificacionCtx)
  if (!ctx) throw new Error('useNotificacion debe usarse dentro de NotificacionProvider')
  return ctx
}
