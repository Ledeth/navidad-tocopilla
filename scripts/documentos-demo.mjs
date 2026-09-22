// ============================================================================
//  Sube documentos PDF de ejemplo al bucket privado y registra sus metadatos,
//  para que la demostración muestre la previsualización real de archivos.
//
//  Requiere (variables de entorno o archivo .env):
//    SUPABASE_URL                 URL del proyecto
//    SUPABASE_SERVICE_ROLE_KEY    service role key (solo para este script local)
//
//  Uso:  node scripts/documentos-demo.mjs
// ============================================================================
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { jsPDF } from 'jspdf'

// Carga sencilla del .env (sin dependencias adicionales).
if (existsSync('.env')) {
  for (const linea of readFileSync('.env', 'utf8').split('\n')) {
    const coincidencia = linea.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
    if (coincidencia && !process.env[coincidencia[1]]) process.env[coincidencia[1]] = coincidencia[2].trim()
  }
}

const URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !SERVICE_KEY) {
  console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const supabase = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } })
const BUCKET = 'documentos'

/** Crea un PDF de ejemplo con aspecto de documento oficial. */
function pdfEjemplo(titulo, lineas) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.setFillColor(15, 42, 80)
  doc.rect(0, 0, 210, 26, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(titulo, 14, 16)
  doc.setTextColor(30, 30, 30)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  let y = 42
  for (const linea of lineas) {
    doc.text(linea, 14, y, { maxWidth: 182 })
    y += 9
  }
  doc.setFontSize(9)
  doc.setTextColor(140, 140, 140)
  doc.text('DOCUMENTO DE DEMOSTRACIÓN — DATOS FICTICIOS, SIN VALIDEZ LEGAL', 14, 280)
  return Buffer.from(doc.output('arraybuffer'))
}

const marca = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

async function subir(ruta, contenido) {
  const { error } = await supabase.storage
    .from(BUCKET).upload(ruta, contenido, { contentType: 'application/pdf', upsert: true })
  if (error) throw error
}

async function principal() {
  const { data: tutores, error: errorTutores } = await supabase
    .from('tutores').select('id, nombre_completo, rut, nacionalidad, tramo_rsh').limit(500)
  if (errorTutores) throw errorTutores

  const { data: beneficiarios, error: errorBeneficiarios } = await supabase
    .from('beneficiarios').select('id, tutor_id, nombre_completo, rut, discapacidad').limit(500)
  if (errorBeneficiarios) throw errorBeneficiarios

  // Se limpia lo anterior para poder ejecutarlo varias veces.
  await supabase.from('documentos').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  const registros = []
  let subidos = 0

  for (const tutor of tutores) {
    if (tutor.nacionalidad === 'chilena') {
      const ruta = `${tutor.id}/tutor/rsh-${marca()}.pdf`
      const contenido = pdfEjemplo('Registro Social de Hogares — Cartola Hogar', [
        `Nombre del solicitante: ${tutor.nombre_completo}`,
        `RUT: ${tutor.rut ?? '—'}`,
        `Tramo de Calificación Socioeconómica: ${tutor.tramo_rsh ?? '—'}%`,
        'Comuna: Tocopilla, Región de Antofagasta',
        'Estado del hogar: Vigente',
      ])
      await subir(ruta, contenido)
      subidos++
      registros.push({
        tutor_id: tutor.id, beneficiario_id: null, tipo: 'rsh', ruta,
        nombre_original: 'cartola-rsh.pdf', mime: 'application/pdf', tamano_bytes: contenido.length,
      })
    }
  }

  for (const beneficiario of beneficiarios) {
    const ruta = `${beneficiario.tutor_id}/${beneficiario.id}/identidad-${marca()}.pdf`
    const contenido = pdfEjemplo('Certificado de Nacimiento — Registro Civil', [
      `Nombre: ${beneficiario.nombre_completo}`,
      `RUN: ${beneficiario.rut}`,
      'Circunscripción: Tocopilla',
      'Documento emitido para fines de postulación municipal.',
    ])
    await subir(ruta, contenido)
    subidos++
    registros.push({
      tutor_id: beneficiario.tutor_id, beneficiario_id: beneficiario.id, tipo: 'identidad',
      ruta, nombre_original: 'certificado-nacimiento.pdf', mime: 'application/pdf',
      tamano_bytes: contenido.length,
    })

    if (beneficiario.discapacidad) {
      const rutaDisc = `${beneficiario.tutor_id}/${beneficiario.id}/discapacidad-${marca()}.pdf`
      const contenidoDisc = pdfEjemplo('Credencial de Discapacidad — Registro Nacional', [
        `Nombre: ${beneficiario.nombre_completo}`,
        `RUN: ${beneficiario.rut}`,
        'Inscripción vigente en el Registro Nacional de la Discapacidad.',
      ])
      await subir(rutaDisc, contenidoDisc)
      subidos++
      registros.push({
        tutor_id: beneficiario.tutor_id, beneficiario_id: beneficiario.id, tipo: 'discapacidad',
        ruta: rutaDisc, nombre_original: 'credencial-discapacidad.pdf', mime: 'application/pdf',
        tamano_bytes: contenidoDisc.length,
      })
    }
  }

  // Inserción por lotes de los metadatos.
  for (let i = 0; i < registros.length; i += 100) {
    const { error } = await supabase.from('documentos').insert(registros.slice(i, i + 100))
    if (error) throw error
  }

  console.log(`Listo: ${subidos} archivos subidos y ${registros.length} documentos registrados.`)
}

principal().catch((e) => {
  console.error('Error:', e.message ?? e)
  process.exit(1)
})
