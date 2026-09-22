// ============================================================================
//  Edge Function: verificar-turnstile
//  Valida en el servidor el token del CAPTCHA de Cloudflare Turnstile.
//  La secret key nunca sale de este entorno.
//
//  POST { token: string }  →  { ok: true } | { ok: false, error: string }
// ============================================================================
import { corsHeaders, json } from '../_shared/cors.ts'

const ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Método no permitido' }, 405)

  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
  if (!secret) {
    // Sin secret configurada no se bloquea la demo, pero se deja constancia.
    console.warn('TURNSTILE_SECRET_KEY no configurada: se omite la verificación.')
    return json({ ok: true, omitido: true })
  }

  let token = ''
  try {
    const body = await req.json()
    token = typeof body?.token === 'string' ? body.token : ''
  } catch {
    return json({ ok: false, error: 'Cuerpo de la solicitud inválido.' }, 400)
  }
  if (!token) return json({ ok: false, error: 'Falta completar la verificación de seguridad.' }, 400)

  const formulario = new FormData()
  formulario.append('secret', secret)
  formulario.append('response', token)
  const ip = req.headers.get('CF-Connecting-IP')
  if (ip) formulario.append('remoteip', ip)

  const respuesta = await fetch(ENDPOINT, { method: 'POST', body: formulario })
  const datos = await respuesta.json()

  if (!datos.success) {
    return json({ ok: false, error: 'No pudimos validar la verificación de seguridad. Inténtelo nuevamente.' }, 400)
  }
  return json({ ok: true })
})
