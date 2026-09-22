// ============================================================================
//  Genera supabase/seed.sql con datos de demostración ficticios pero
//  coherentes: 40 tutores (nacionales y extranjeros), ~70 beneficiarios en
//  todos los estados, observaciones y entregas. Los RUT son válidos según el
//  algoritmo módulo 11, pero no corresponden a personas reales.
//
//  Uso:  npm run seed:demo
// ============================================================================
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const aqui = dirname(fileURLToPath(import.meta.url))
const salida = join(aqui, '..', 'supabase', 'seed.sql')

// ─── Generador pseudoaleatorio determinista (mismos datos en cada ejecución) ──
let semilla = 20261225
const azar = () => {
  semilla = (semilla * 1103515245 + 12345) % 2147483648
  return semilla / 2147483648
}
const elegir = (lista) => lista[Math.floor(azar() * lista.length)]
const entre = (min, max) => min + Math.floor(azar() * (max - min + 1))

function digitoVerificador(numero) {
  let suma = 0, multiplicador = 2
  for (let i = numero.length - 1; i >= 0; i--) {
    suma += Number(numero[i]) * multiplicador
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1
  }
  const resto = 11 - (suma % 11)
  return resto === 11 ? '0' : resto === 10 ? 'K' : String(resto)
}
const rut = (n) => `${n}-${digitoVerificador(String(n))}`

const NOMBRES_F = ['María', 'Camila', 'Valentina', 'Rosa', 'Javiera', 'Antonia', 'Fernanda', 'Gladys', 'Yasna', 'Daniela', 'Paola', 'Karen', 'Ingrid', 'Marisol', 'Nayarett']
const NOMBRES_M = ['Juan', 'Luis', 'Matías', 'Benjamín', 'Cristian', 'Héctor', 'Rodrigo', 'Nicolás', 'Sebastián', 'Álvaro', 'Patricio', 'Ignacio', 'Vicente', 'Bastián', 'Emilio']
const APELLIDOS = ['Rojas', 'Muñoz', 'Araya', 'Tapia', 'Cortés', 'Pizarro', 'Contreras', 'Vega', 'Castro', 'Fuentes', 'Ramírez', 'Alarcón', 'Villalobos', 'Mamani', 'Choque', 'Quispe', 'Bolaños', 'Rivas', 'Salinas', 'Godoy']
const CALLES = ['Av. Arturo Prat', 'Calle 21 de Mayo', 'Av. Serrano', 'Calle Baquedano', 'Pasaje Los Pescadores', 'Av. Bernardo O’Higgins', 'Calle Colón', 'Población Covadonga', 'Villa Gabriela Mistral', 'Calle Sucre']
const DOCS_EXTRANJEROS = ['DNI 45.887.120', 'Pasaporte AB1234567', 'DNI V-21.445.908', 'Cédula E-8.991.244', 'Pasaporte CO9087123']

const escapar = (t) => String(t).replace(/'/g, "''")
const nombreCompleto = (sexo) =>
  `${elegir(sexo === 'femenino' ? NOMBRES_F : NOMBRES_M)} ${elegir(APELLIDOS)} ${elegir(APELLIDOS)}`

// ─── Tutores ────────────────────────────────────────────────────────────────
const TOTAL_TUTORES = 40
const tutores = []
let siguienteRut = 9100000

for (let i = 0; i < TOTAL_TUTORES; i++) {
  const extranjero = i % 4 === 3 // uno de cada cuatro
  const sexo = azar() > 0.35 ? 'femenino' : 'masculino'
  const conRutChileno = !extranjero || azar() > 0.5
  siguienteRut += entre(1500, 9000)
  tutores.push({
    indice: i,
    nombre: nombreCompleto(sexo),
    nacionalidad: extranjero ? 'extranjera' : 'chilena',
    rut: conRutChileno ? rut(siguienteRut) : null,
    documento: !conRutChileno ? elegir(DOCS_EXTRANJEROS) : null,
    telefono: `+56 9 ${entre(4000, 9999)} ${entre(1000, 9999)}`,
    email: `tutor${i + 1}.demo@navidadtocopilla.cl`,
    direccion: `${elegir(CALLES)} ${entre(120, 2480)}`,
    tramo: extranjero ? null : elegir([40, 40, 40, 50, 50, 60, 70, 80, 90, 100]),
  })
}

// El primer tutor es la cuenta demo con la que se inicia sesión.
tutores[0].nombre = 'María Fernanda Rojas Díaz'
tutores[0].email = 'tutor.demo@navidadtocopilla.cl'
tutores[0].nacionalidad = 'chilena'
tutores[0].rut = rut(16482357)
tutores[0].documento = null
tutores[0].tramo = 40

// ─── Beneficiarios ──────────────────────────────────────────────────────────
// Estados: pendiente, aprobado, rechazado y observado, en todas las familias.
const ESTADOS = ['pendiente', 'aprobado', 'aprobado', 'aprobado', 'observado', 'rechazado', 'pendiente']
const MOTIVOS_OBS = [
  'La cartola del Registro Social de Hogares está ilegible. Vuelva a adjuntarla en mejor calidad.',
  'Falta el certificado de nacimiento del beneficiario.',
  'El domicilio informado no coincide con el del Registro Social de Hogares.',
]
const MOTIVOS_RECH = [
  'El beneficiario supera la edad máxima establecida para este proceso.',
  'El grupo familiar no reside en la comuna de Tocopilla.',
  'La postulación está duplicada: el beneficiario ya fue inscrito por otro tutor.',
]

const beneficiarios = []
let siguienteRutNino = 24500000

for (const tutor of tutores) {
  const cantidad = tutor.indice === 0 ? 3 : entre(1, 3)
  for (let j = 0; j < cantidad; j++) {
    if (beneficiarios.length >= 72) break
    siguienteRutNino += entre(900, 5200)
    const sexo = elegir(['femenino', 'masculino', 'masculino', 'femenino', 'otro'])
    const edad = entre(1, 12)
    const anio = 2026 - edad
    const mes = String(entre(1, 12)).padStart(2, '0')
    const dia = String(entre(1, 28)).padStart(2, '0')
    const estado = elegir(ESTADOS)
    beneficiarios.push({
      tutorIndice: tutor.indice,
      rut: rut(siguienteRutNino),
      nombre: nombreCompleto(sexo === 'otro' ? 'femenino' : sexo),
      sexo,
      nacimiento: `${anio}-${mes}-${dia}`,
      discapacidad: azar() > 0.87,
      estado,
      motivo: estado === 'observado' ? elegir(MOTIVOS_OBS) : estado === 'rechazado' ? elegir(MOTIVOS_RECH) : null,
      entregado: estado === 'aprobado' && azar() > 0.6,
    })
  }
}

// ─── Armado del SQL ─────────────────────────────────────────────────────────
const CLAVE_DEMO = 'Demo2026!'
const lineas = []
const l = (texto = '') => lineas.push(texto)

l('-- ============================================================================')
l('--  Navidad 2026 · Ilustre Municipalidad de Tocopilla')
l('--  SEED DE DEMOSTRACIÓN — datos ficticios generados con scripts/generar-seed.mjs')
l('--  NO EJECUTAR EN PRODUCCIÓN: borra los datos existentes de las tablas.')
l('-- ============================================================================')
l('')
l('begin;')
l('')
l('-- ─── 1. Limpieza de los datos anteriores ────────────────────────────────────')
l('truncate table public.audit_log restart identity cascade;')
l('truncate table public.entregas, public.observaciones, public.documentos,')
l('              public.beneficiarios, public.tutores restart identity cascade;')
l('alter sequence public.folio_seq restart with 1;')
l('')
l('-- ─── 2. Ventana de postulación abierta para la demostración ─────────────────')
l('update public.configuracion set')
l("  fecha_apertura = current_date - interval '30 days',")
l("  fecha_cierre   = current_date + interval '60 days',")
l('  edad_maxima    = 12,')
l("  fecha_corte_edad = date '2026-12-25',")
l('  certificado_estudios_obligatorio = false,')
l("  texto_bienvenida = 'Bienvenido y bienvenida al proceso de inscripción para la entrega de regalos de Navidad 2026 de la Ilustre Municipalidad de Tocopilla. Complete el formulario, adjunte sus documentos y siga el estado de su postulación en línea.'")
l('where id = 1;')
l('')
l('-- ─── 3. Cuentas de demostración (los tres roles) ────────────────────────────')
l('--  Contraseña de todas: ' + CLAVE_DEMO)
l('--  Se crean directamente en auth.users con bcrypt (extensión pgcrypto).')
l('do $$')
l('declare')
l('  v_id uuid;')
l('  v_cuenta record;')
l('begin')
l('  for v_cuenta in')
l('    select * from (values')
l("      ('tutor.demo@navidadtocopilla.cl',        'María Fernanda Rojas Díaz', 'tutor'),")
l("      ('funcionario.demo@navidadtocopilla.cl',  'Carolina Herrera Núñez',    'funcionario'),")
l("      ('admin.demo@navidadtocopilla.cl',        'Rodrigo Salinas Pérez',     'admin')")
l('    ) as t(email, nombre, rol)')
l('  loop')
l('    delete from auth.users where email = v_cuenta.email;')
l('    v_id := gen_random_uuid();')
l('    insert into auth.users (')
l('      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,')
l('      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,')
l('      -- Estas columnas de token deben ir vacías, nunca NULL: si quedan')
l('      -- nulas, el servicio de autenticación falla al iniciar sesión.')
l('      confirmation_token, email_change, email_change_token_new, recovery_token')
l('    ) values (')
l("      v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',")
l("      v_cuenta.email, crypt('" + CLAVE_DEMO + "', gen_salt('bf')), now(),")
l('      \'{"provider":"email","providers":["email"]}\'::jsonb,')
l("      jsonb_build_object('nombre', v_cuenta.nombre), now(), now(),")
l("      '', '', '', ''")
l('    );')
l('    -- Identidad de correo (necesaria para el inicio de sesión con contraseña).')
l('    insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)')
l('    values (')
l('      gen_random_uuid(), v_id, v_id::text,')
l("      jsonb_build_object('sub', v_id::text, 'email', v_cuenta.email, 'email_verified', true),")
l("      'email', now(), now(), now()")
l('    );')
l('    -- El trigger crea el perfil como tutor; aquí se ajusta el rol real.')
l('    update public.profiles')
l('       set rol = v_cuenta.rol::rol_usuario, nombre = v_cuenta.nombre, activo = true')
l('     where id = v_id;')
l('  end loop;')
l('end $$;')
l('')
l('-- ─── 4. Tutores ficticios ───────────────────────────────────────────────────')
l('insert into public.tutores')
l('  (id, profile_id, nombre_completo, nacionalidad, rut, documento_extranjero,')
l('   telefono, email, direccion, comuna, tramo_rsh, consentimiento, created_at)')
l('values')

const valoresTutores = tutores.map((t) => {
  const perfil = t.indice === 0
    ? "(select id from public.profiles where email = 'tutor.demo@navidadtocopilla.cl')"
    : 'null'
  const dias = 30 - Math.floor((t.indice / TOTAL_TUTORES) * 28)
  return `  ('${uuidDeterminista('tutor', t.indice)}', ${perfil}, '${escapar(t.nombre)}', '${t.nacionalidad}', ` +
    `${t.rut ? `'${t.rut}'` : 'null'}, ${t.documento ? `'${escapar(t.documento)}'` : 'null'}, ` +
    `'${t.telefono}', '${t.email}', '${escapar(t.direccion)}', 'Tocopilla', ` +
    `${t.tramo ?? 'null'}, true, now() - interval '${dias} days')`
})
l(valoresTutores.join(',\n') + ';')
l('')
l('-- ─── 5. Beneficiarios ───────────────────────────────────────────────────────')
l('insert into public.beneficiarios')
l('  (id, tutor_id, rut, nombre_completo, sexo, fecha_nacimiento, discapacidad,')
l('   observaciones, estado, motivo_estado, revisado_por, revisado_at, created_at)')
l('values')

const funcionarioDemo = "(select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl')"
const valoresBeneficiarios = beneficiarios.map((b, i) => {
  const revisado = b.estado !== 'pendiente'
  const dias = 28 - Math.floor((i / beneficiarios.length) * 26)
  return `  ('${uuidDeterminista('benef', i)}', '${uuidDeterminista('tutor', b.tutorIndice)}', '${b.rut}', ` +
    `'${escapar(b.nombre)}', '${b.sexo}', date '${b.nacimiento}', ${b.discapacidad}, ` +
    `null, '${b.estado}', ${b.motivo ? `'${escapar(b.motivo)}'` : 'null'}, ` +
    `${revisado ? funcionarioDemo : 'null'}, ` +
    `${revisado ? `now() - interval '${Math.max(1, dias - 3)} days'` : 'null'}, ` +
    `now() - interval '${dias} days')`
})
l(valoresBeneficiarios.join(',\n') + ';')
l('')
l('-- ─── 6. Observaciones y opinión profesional ─────────────────────────────────')
l('insert into public.observaciones (beneficiario_id, autor_id, autor_nombre, tipo, texto, created_at)')
l('values')

const notas = []
beneficiarios.forEach((b, i) => {
  if (b.motivo) {
    notas.push(`  ('${uuidDeterminista('benef', i)}', ${funcionarioDemo}, 'Carolina Herrera Núñez', ` +
      `'observacion', '${escapar(b.motivo)}', now() - interval '5 days')`)
  }
  if (b.discapacidad && b.estado === 'aprobado') {
    notas.push(`  ('${uuidDeterminista('benef', i)}', ${funcionarioDemo}, 'Carolina Herrera Núñez', ` +
      `'opinion_profesional', 'Se sugiere priorizar la entrega considerando la condición de discapacidad ` +
      `acreditada del beneficiario.', now() - interval '4 days')`)
  }
})
l(notas.join(',\n') + ';')
l('')
l('-- ─── 7. Entregas ya realizadas ──────────────────────────────────────────────')
l('insert into public.entregas (beneficiario_id, entregado_por, entregado_nombre, entregado_at)')
l('values')
const entregas = beneficiarios
  .map((b, i) => ({ b, i }))
  .filter(({ b }) => b.entregado)
  .map(({ i }) =>
    `  ('${uuidDeterminista('benef', i)}', ${funcionarioDemo}, 'Carolina Herrera Núñez', now() - interval '2 days')`)
l(entregas.join(',\n') + ';')
l('')
l('commit;')
l('')
l('-- ============================================================================')
l('--  Credenciales de demostración (contraseña: ' + CLAVE_DEMO + ')')
l('--    tutor.demo@navidadtocopilla.cl        → vecino')
l('--    funcionario.demo@navidadtocopilla.cl  → funcionario municipal')
l('--    admin.demo@navidadtocopilla.cl        → administrador')
l('-- ============================================================================')

/** UUID determinista y legible a partir de un prefijo y un índice. */
function uuidDeterminista(prefijo, indice) {
  const base = prefijo === 'tutor' ? '11111111' : '22222222'
  const n = String(indice + 1).padStart(12, '0')
  return `${base}-0000-4000-8000-${n}`
}

writeFileSync(salida, lineas.join('\n') + '\n', 'utf8')
console.log(`seed.sql generado: ${tutores.length} tutores, ${beneficiarios.length} beneficiarios, ` +
  `${entregas.length} entregas, ${notas.length} notas.`)
