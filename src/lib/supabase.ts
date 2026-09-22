import { createClient } from '@supabase/supabase-js'

// Se normalizan los valores: una barra final en la URL (o un espacio al pegar
// la llave) provoca rutas con doble barra y errores del tipo
// "Invalid path specified in request URL".
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim().replace(/\/+$/, '')
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

/** true cuando faltan las variables de entorno (se muestra un aviso en pantalla). */
export const supabaseConfigurado = Boolean(url && anonKey)

if (!supabaseConfigurado) {
  console.warn(
    'Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. Copie .env.example a .env y complete los valores.',
  )
}

export const supabase = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'clave-no-configurada',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
)

export const MODO_DEMO = String(import.meta.env.VITE_MODO_DEMO ?? 'true') === 'true'
export const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string) ?? ''

/** Invoca la Edge Function que valida el CAPTCHA en el servidor. */
export async function verificarTurnstile(token: string): Promise<void> {
  // Sin site key configurada el widget no se renderiza: no hay nada que validar.
  if (!TURNSTILE_SITE_KEY) return
  const { data, error } = await supabase.functions.invoke('verificar-turnstile', { body: { token } })
  if (error) throw new Error('No pudimos validar la verificación de seguridad. Inténtelo nuevamente.')
  if (data && data.ok === false) throw new Error(data.error ?? 'Verificación de seguridad rechazada.')
}

/** Traduce los errores más comunes de Supabase a mensajes claros en español. */
export function mensajeError(error: unknown): string {
  const bruto = (error as { message?: string })?.message ?? String(error ?? '')
  const m = bruto.toLowerCase()
  if (m.includes('invalid path specified')) {
    return 'La dirección del servidor está mal configurada (revise VITE_SUPABASE_URL: no debe terminar en “/”).'
  }
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (m.includes('email not confirmed')) return 'Debe confirmar su correo electrónico antes de ingresar.'
  if (m.includes('user already registered')) return 'Ya existe una cuenta con ese correo electrónico.'
  if (m.includes('tutores_rut_key')) return 'Ese RUT ya está inscrito como tutor en el proceso.'
  if (m.includes('beneficiarios_rut_key')) return 'Ese RUT ya fue inscrito por otro tutor.'
  if (m.includes('entregas_beneficiario_id_key')) return 'El regalo de este beneficiario ya fue entregado.'
  if (m.includes('row-level security')) return 'No tiene permisos para realizar esta acción.'
  if (m.includes('edad máxima')) return bruto
  if (m.includes('postulación está cerrado')) return bruto
  if (m.includes('failed to fetch')) return 'No pudimos conectarnos al servidor. Revise su conexión a internet.'
  return bruto || 'Ocurrió un error inesperado.'
}
