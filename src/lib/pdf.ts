// ============================================================================
//  Generación de PDF: fichas de retiro de regalo y reportes municipales.
// ============================================================================
import type { jsPDF } from 'jspdf'
import { ETIQUETA_ESTADO, ETIQUETA_SEXO, calcularEdad, fechaCorta, fechaHora } from './formato'
import { formatearRut } from './rut'
import type { FilaPostulacion } from './tipos'

// Las librerías de PDF se cargan bajo demanda: pesan varios cientos de kB y
// solo las necesita el personal municipal.
async function cargarPdf() {
  // Algunos de estos paquetes son CommonJS: según el entorno el export por
  // defecto queda anidado, así que se desenvuelve hasta encontrar el valor útil.
  const desenvolver = <T>(modulo: unknown): T => {
    let valor = modulo as { default?: unknown }
    while (valor && typeof valor === 'object' && 'default' in valor) valor = valor.default as { default?: unknown }
    return valor as T
  }
  const [moduloJsPdf, moduloAutoTable, moduloQr] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    import('qrcode'),
  ])
  return {
    jsPDF: moduloJsPdf.jsPDF,
    autoTable: desenvolver<typeof import('jspdf-autotable')['default']>(moduloAutoTable),
    QRCode: desenvolver<{ toDataURL: (texto: string, opciones?: Record<string, unknown>) => Promise<string> }>(moduloQr),
  }
}

const AZUL: [number, number, number] = [15, 42, 80]
const ROJO: [number, number, number] = [176, 42, 48]
const GRIS: [number, number, number] = [110, 118, 132]

const MUNICIPIO = 'Ilustre Municipalidad de Tocopilla'
const PROGRAMA = 'Entrega de Regalos de Navidad 2026'

/** Escudo municipal simplificado dibujado con vectores (no requiere imagen). */
function dibujarLogo(doc: jsPDF, x: number, y: number, tamano = 16): void {
  doc.setDrawColor(...AZUL)
  doc.setFillColor(...AZUL)
  doc.setLineWidth(0.6)
  doc.roundedRect(x, y, tamano, tamano, 2, 2, 'S')
  doc.setFillColor(...ROJO)
  doc.circle(x + tamano / 2, y + tamano / 2 - 1.5, tamano / 5, 'F')
  doc.setFillColor(...AZUL)
  doc.rect(x + tamano / 4, y + tamano / 2 + 1.5, tamano / 2, tamano / 6, 'F')
  doc.setFontSize(4.5)
  doc.setTextColor(...AZUL)
  doc.text('TOCOPILLA', x + tamano / 2, y + tamano - 1.2, { align: 'center' })
}

function encabezado(doc: jsPDF, subtitulo: string): number {
  const ancho = doc.internal.pageSize.getWidth()
  dibujarLogo(doc, 14, 12)
  doc.setTextColor(...AZUL)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(MUNICIPIO, 34, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(PROGRAMA, 34, 24)
  doc.setFontSize(9)
  doc.setTextColor(...GRIS)
  doc.text(subtitulo, 34, 29.5)
  doc.setDrawColor(...ROJO)
  doc.setLineWidth(0.8)
  doc.line(14, 34, ancho - 14, 34)
  return 42
}

function piePagina(doc: jsPDF, nota?: string): void {
  const ancho = doc.internal.pageSize.getWidth()
  const alto = doc.internal.pageSize.getHeight()
  const paginas = doc.getNumberOfPages()
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i)
    doc.setFontSize(7.5)
    doc.setTextColor(...GRIS)
    doc.text(nota ?? `Documento generado el ${fechaHora(new Date().toISOString())}`, 14, alto - 8)
    doc.text(`Página ${i} de ${paginas}`, ancho - 14, alto - 8, { align: 'right' })
  }
}

export interface DatosFicha {
  folio: string
  beneficiario_nombre: string
  beneficiario_rut: string
  sexo: FilaPostulacion['sexo']
  fecha_nacimiento: string
  edad: number
  discapacidad: boolean
  tutor_nombre: string
  tutor_rut: string | null
  direccion: string
  comuna: string
  telefono: string
}

/** Ficha de retiro imprimible: una página por beneficiario aprobado. */
export async function fichasRetiroPDF(fichas: DatosFicha[], nombreArchivo?: string): Promise<void> {
  const doc = await construirFichasRetiro(fichas)
  doc.save(nombreArchivo ?? `fichas-retiro-navidad-2026-${fichas.length}.pdf`)
}

/** Construye el documento de fichas (separado del guardado para poder probarlo). */
export async function construirFichasRetiro(fichas: DatosFicha[]): Promise<jsPDF> {
  if (!fichas.length) throw new Error('No hay beneficiarios aprobados para generar fichas.')
  const { jsPDF, autoTable, QRCode } = await cargarPdf()
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const ancho = doc.internal.pageSize.getWidth()

  for (let i = 0; i < fichas.length; i++) {
    const f = fichas[i]
    if (i > 0) doc.addPage()
    let y = encabezado(doc, 'Ficha de retiro de regalo')

    // Folio destacado + código QR con el folio.
    doc.setFillColor(243, 246, 251)
    doc.roundedRect(14, y, ancho - 28, 26, 2, 2, 'F')
    doc.setTextColor(...AZUL)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('FOLIO', 20, y + 9)
    doc.setFontSize(18)
    doc.setTextColor(...ROJO)
    doc.text(f.folio, 20, y + 19)

    const qr = await QRCode.toDataURL(f.folio, { margin: 0, width: 300 })
    doc.addImage(qr, 'PNG', ancho - 40, y + 3, 20, 20)

    y += 34
    doc.setTextColor(...AZUL)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Datos del beneficiario', 14, y)
    y += 2

    autoTable(doc, {
      startY: y + 2,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 2.5, textColor: [30, 30, 30] },
      columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold', fillColor: [248, 250, 253] } },
      body: [
        ['Nombre', f.beneficiario_nombre],
        ['RUT', formatearRut(f.beneficiario_rut)],
        ['Edad', `${f.edad} años`],
        ['Sexo', ETIQUETA_SEXO[f.sexo]],
        ['Condición de discapacidad', f.discapacidad ? 'Sí' : 'No'],
      ],
    })

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...AZUL)
    doc.setFontSize(11)
    doc.text('Datos del tutor o tutora', 14, y)

    autoTable(doc, {
      startY: y + 4,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 2.5, textColor: [30, 30, 30] },
      columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold', fillColor: [248, 250, 253] } },
      body: [
        ['Nombre', f.tutor_nombre],
        ['RUT o documento', f.tutor_rut ? (/^\d+-[\dkK]$/.test(f.tutor_rut) ? formatearRut(f.tutor_rut) : f.tutor_rut) : '—'],
        ['Dirección', `${f.direccion}, ${f.comuna}`],
        ['Teléfono', f.telefono],
      ],
    })

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22

    // Espacios de firma y timbre para el momento de la entrega.
    doc.setDrawColor(...GRIS)
    doc.setLineWidth(0.3)
    doc.line(20, y, 90, y)
    doc.line(ancho - 90, y, ancho - 20, y)
    doc.setFontSize(9)
    doc.setTextColor(...GRIS)
    doc.text('Firma del tutor o tutora', 55, y + 5, { align: 'center' })
    doc.text('Timbre y firma del funcionario', ancho - 55, y + 5, { align: 'center' })

    y += 16
    doc.setFontSize(8)
    doc.text(
      'Presente esta ficha y su cédula de identidad al momento del retiro. El regalo se entrega una sola vez por beneficiario.',
      14, y, { maxWidth: ancho - 28 },
    )
  }

  piePagina(doc)
  return doc
}

/** Reporte PDF con resumen e índice de postulaciones filtradas. */
export async function reportePostulacionesPDF(
  filas: FilaPostulacion[],
  titulo: string,
  resumen: { etiqueta: string; valor: string | number }[],
  nombreArchivo?: string,
): Promise<void> {
  const doc = await construirReportePostulaciones(filas, titulo, resumen)
  doc.save(nombreArchivo ?? 'reporte-postulaciones-navidad-2026.pdf')
}

/** Construye el reporte (separado del guardado para poder probarlo). */
export async function construirReportePostulaciones(
  filas: FilaPostulacion[],
  titulo: string,
  resumen: { etiqueta: string; valor: string | number }[],
): Promise<jsPDF> {
  const { jsPDF, autoTable } = await cargarPdf()
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  let y = encabezado(doc, titulo)

  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 9.5, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } },
    body: resumen.map((r) => [r.etiqueta, String(r.valor)]),
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  autoTable(doc, {
    startY: y,
    head: [['Folio', 'Estado', 'RUT', 'Beneficiario', 'Sexo', 'Edad', 'Disc.', 'Tutor', 'Nacionalidad', 'Entregado']],
    body: filas.map((f) => [
      f.folio ?? '—',
      ETIQUETA_ESTADO[f.estado],
      formatearRut(f.beneficiario_rut),
      f.beneficiario_nombre,
      ETIQUETA_SEXO[f.sexo],
      String(f.edad),
      f.discapacidad ? 'Sí' : 'No',
      f.tutor_nombre,
      f.nacionalidad === 'chilena' ? 'Chilena' : 'Extranjera',
      f.entregado ? fechaCorta(f.entregado_at) : 'No',
    ]),
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: AZUL, textColor: 255, fontSize: 8.5 },
    alternateRowStyles: { fillColor: [246, 248, 252] },
  })

  piePagina(doc)
  return doc
}

/** Construye los datos de ficha a partir de una fila de la vista. */
export function fichaDesdeFila(f: FilaPostulacion): DatosFicha {
  return {
    folio: f.folio ?? 'SIN-FOLIO',
    beneficiario_nombre: f.beneficiario_nombre,
    beneficiario_rut: f.beneficiario_rut,
    sexo: f.sexo,
    fecha_nacimiento: f.fecha_nacimiento,
    edad: f.edad ?? calcularEdad(f.fecha_nacimiento),
    discapacidad: f.discapacidad,
    tutor_nombre: f.tutor_nombre,
    tutor_rut: f.tutor_rut,
    direccion: f.direccion,
    comuna: f.comuna,
    telefono: f.telefono,
  }
}
