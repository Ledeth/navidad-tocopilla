// ============================================================================
//  Edge Function: crear-usuario-interno
//  Crea, actualiza o desactiva usuarios internos (funcionario / admin).
//  Usa la SERVICE ROLE KEY, que jamás se expone en el frontend.
//  Solo un administrador autenticado puede invocarla.
//
//  POST { accion: 'crear',     email, nombre, rol, password? }
//  POST { accion: 'actualizar', user_id, nombre?, rol?, activo? }
//  POST { accion: 'password',  user_id, password }
// ============================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const ROLES_VALIDOS = ['funcionario', 'admin'] as const

function passwordAleatoria(): string {
  const base = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  return `Tpl${base}!`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  // 1. Identificar a quien llama con su propio JWT.
  const authorization = req.headers.get('Authorization') ?? ''
  if (!authorization) return json({ error: 'No autenticado.' }, 401)

  const comoUsuario = createClient(URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
  })
  const { data: { user }, error: errorUsuario } = await comoUsuario.auth.getUser()
  if (errorUsuario || !user) return json({ error: 'No autenticado.' }, 401)

  const admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } })

  // 2. Verificar que sea administrador activo.
  const { data: perfil } = await admin
    .from('profiles').select('rol, activo').eq('id', user.id).single()
  if (!perfil || perfil.rol !== 'admin' || !perfil.activo) {
    return json({ error: 'Solo un administrador puede gestionar usuarios internos.' }, 403)
  }

  let cuerpo: Record<string, unknown>
  try { cuerpo = await req.json() } catch { return json({ error: 'Cuerpo inválido.' }, 400) }
  const accion = String(cuerpo.accion ?? 'crear')

  try {
    // ── Crear ───────────────────────────────────────────────────────────────
    if (accion === 'crear') {
      const email = String(cuerpo.email ?? '').trim().toLowerCase()
      const nombre = String(cuerpo.nombre ?? '').trim()
      const rol = String(cuerpo.rol ?? 'funcionario')
      const password = String(cuerpo.password ?? '') || passwordAleatoria()

      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Correo electrónico inválido.' }, 400)
      if (nombre.length < 3) return json({ error: 'El nombre es obligatorio.' }, 400)
      if (!ROLES_VALIDOS.includes(rol as typeof ROLES_VALIDOS[number])) {
        return json({ error: 'El rol debe ser funcionario o admin.' }, 400)
      }
      if (password.length < 8) return json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400)

      const { data: creado, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { nombre },
      })
      if (error) return json({ error: error.message }, 400)

      // El trigger crea el perfil con rol 'tutor'; aquí se eleva al rol real.
      const { error: errorPerfil } = await admin.from('profiles')
        .upsert({ id: creado.user.id, email, nombre, rol, activo: true })
      if (errorPerfil) return json({ error: errorPerfil.message }, 400)

      return json({ ok: true, user_id: creado.user.id, password_temporal: cuerpo.password ? undefined : password })
    }

    // ── Actualizar (nombre, rol, activación) ────────────────────────────────
    if (accion === 'actualizar') {
      const userId = String(cuerpo.user_id ?? '')
      if (!userId) return json({ error: 'Falta el identificador del usuario.' }, 400)
      if (userId === user.id && cuerpo.rol && cuerpo.rol !== 'admin') {
        return json({ error: 'No puede quitarse a sí mismo el rol de administrador.' }, 400)
      }
      if (userId === user.id && cuerpo.activo === false) {
        return json({ error: 'No puede desactivar su propia cuenta.' }, 400)
      }

      const cambios: Record<string, unknown> = {}
      if (typeof cuerpo.nombre === 'string') cambios.nombre = cuerpo.nombre.trim()
      if (typeof cuerpo.activo === 'boolean') cambios.activo = cuerpo.activo
      if (typeof cuerpo.rol === 'string') {
        if (!ROLES_VALIDOS.includes(cuerpo.rol as typeof ROLES_VALIDOS[number])) {
          return json({ error: 'El rol debe ser funcionario o admin.' }, 400)
        }
        cambios.rol = cuerpo.rol
      }
      if (Object.keys(cambios).length === 0) return json({ error: 'Sin cambios que aplicar.' }, 400)

      const { error } = await admin.from('profiles').update(cambios).eq('id', userId)
      if (error) return json({ error: error.message }, 400)

      // Una cuenta desactivada además se bloquea en Auth (no puede iniciar sesión).
      if (typeof cuerpo.activo === 'boolean') {
        await admin.auth.admin.updateUserById(userId, {
          ban_duration: cuerpo.activo ? 'none' : '87600h',
        })
      }
      return json({ ok: true })
    }

    // ── Restablecer contraseña ──────────────────────────────────────────────
    if (accion === 'password') {
      const userId = String(cuerpo.user_id ?? '')
      const password = String(cuerpo.password ?? '') || passwordAleatoria()
      if (!userId) return json({ error: 'Falta el identificador del usuario.' }, 400)
      if (password.length < 8) return json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400)
      const { error } = await admin.auth.admin.updateUserById(userId, { password })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true, password_temporal: cuerpo.password ? undefined : password })
    }

    return json({ error: 'Acción desconocida.' }, 400)
  } catch (e) {
    console.error(e)
    return json({ error: 'Error inesperado en el servidor.' }, 500)
  }
})
