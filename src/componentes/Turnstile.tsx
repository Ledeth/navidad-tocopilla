// ============================================================================
//  Widget de CAPTCHA Cloudflare Turnstile.
//  Si no hay site key configurada, no se renderiza y el formulario continúa
//  (útil para desarrollo local y para la demo).
// ============================================================================
import { useEffect, useRef } from 'react'
import { TURNSTILE_SITE_KEY } from '../lib/supabase'

declare global {
  interface Window {
    turnstile?: {
      render: (elemento: HTMLElement, opciones: Record<string, unknown>) => string
      reset: (id?: string) => void
      remove: (id?: string) => void
    }
  }
}

const URL_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

function cargarScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  const existente = document.querySelector<HTMLScriptElement>(`script[src="${URL_SCRIPT}"]`)
  if (existente) return new Promise((resolver) => existente.addEventListener('load', () => resolver()))
  return new Promise((resolver, rechazar) => {
    const script = document.createElement('script')
    script.src = URL_SCRIPT
    script.async = true
    script.defer = true
    script.onload = () => resolver()
    script.onerror = () => rechazar(new Error('No se pudo cargar la verificación de seguridad.'))
    document.head.appendChild(script)
  })
}

export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const contenedor = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !contenedor.current) return
    let cancelado = false

    cargarScript()
      .then(() => {
        if (cancelado || !contenedor.current || !window.turnstile) return
        widgetId.current = window.turnstile.render(contenedor.current, {
          sitekey: TURNSTILE_SITE_KEY,
          language: 'es',
          callback: (token: string) => onToken(token),
          'expired-callback': () => onToken(''),
          'error-callback': () => onToken(''),
        })
      })
      .catch(() => { /* el formulario informa el problema al enviar */ })

    return () => {
      cancelado = true
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current)
    }
  }, [onToken])

  if (!TURNSTILE_SITE_KEY) return null
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-semibold text-marino-900">Verificación de seguridad</p>
      <div ref={contenedor} />
    </div>
  )
}
