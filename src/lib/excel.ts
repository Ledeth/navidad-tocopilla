// ============================================================================
//  Exportación a Excel (.xlsx) con SheetJS.
// ============================================================================
// SheetJS se carga solo cuando se usa (reduce el peso inicial de la página).
async function cargarXLSX() {
  return await import('xlsx')
}
import { ETIQUETA_ESTADO, ETIQUETA_NACIONALIDAD, ETIQUETA_SEXO, fechaCorta, fechaHora } from './formato'
import { formatearRut } from './rut'
import type { FilaPostulacion } from './tipos'

type Fila = Record<string, string | number | boolean | null>

/** Descarga una o varias hojas como archivo .xlsx */
export async function descargarExcel(hojas: { nombre: string; filas: Fila[] }[], nombreArchivo: string): Promise<void> {
  const XLSX = await cargarXLSX()
  XLSX.writeFile(await construirLibro(hojas), nombreArchivo)
}

/** Arma el libro de Excel (separado de la descarga para poder probarlo). */
export async function construirLibro(hojas: { nombre: string; filas: Fila[] }[]) {
  const XLSX = await cargarXLSX()
  const libro = XLSX.utils.book_new()
  for (const hoja of hojas) {
    const datos = hoja.filas.length ? hoja.filas : [{ 'Sin datos': '' }]
    const pagina = XLSX.utils.json_to_sheet(datos)
    // Ancho de columnas proporcional al contenido, con un tope razonable.
    const columnas = Object.keys(datos[0] ?? {})
    pagina['!cols'] = columnas.map((columna) => ({
      wch: Math.min(
        40,
        Math.max(columna.length + 2, ...datos.map((f) => String(f[columna] ?? '').length + 2)),
      ),
    }))
    XLSX.utils.book_append_sheet(libro, pagina, hoja.nombre.slice(0, 31))
  }
  return libro
}

/** Convierte filas de postulación al formato legible de la planilla municipal. */
export function filasPostulacionesParaExcel(filas: FilaPostulacion[]): Fila[] {
  return filas.map((f) => ({
    'Folio': f.folio ?? '',
    'Estado': ETIQUETA_ESTADO[f.estado],
    'RUT beneficiario': f.beneficiario_rut ? formatearRut(f.beneficiario_rut) : '',
    'Nombre beneficiario': f.beneficiario_nombre,
    'Sexo': ETIQUETA_SEXO[f.sexo],
    'Fecha de nacimiento': fechaCorta(f.fecha_nacimiento),
    'Edad': f.edad,
    'Discapacidad': f.discapacidad ? 'Sí' : 'No',
    'RUT tutor': f.tutor_rut ? (/^\d+-[\dkK]$/.test(f.tutor_rut) ? formatearRut(f.tutor_rut) : f.tutor_rut) : '',
    'Nombre tutor': f.tutor_nombre,
    'Nacionalidad': ETIQUETA_NACIONALIDAD[f.nacionalidad],
    'Tramo RSH': f.tramo_rsh ? `${f.tramo_rsh}%` : '',
    'Teléfono': f.telefono,
    'Correo': f.email,
    'Dirección': f.direccion,
    'Comuna': f.comuna,
    'Motivo': f.motivo_estado ?? '',
    'Regalo entregado': f.entregado ? 'Sí' : 'No',
    'Fecha de entrega': f.entregado_at ? fechaHora(f.entregado_at) : '',
    'Fecha de postulación': fechaHora(f.created_at),
  }))
}

/** Lee un archivo Excel/CSV y devuelve las filas como objetos. */
export async function leerExcel(archivo: File): Promise<Record<string, unknown>[]> {
  const XLSX = await cargarXLSX()
  const buffer = await archivo.arrayBuffer()
  const libro = XLSX.read(buffer, { type: 'array', cellDates: true })
  const primeraHoja = libro.Sheets[libro.SheetNames[0]]
  if (!primeraHoja) return []
  return XLSX.utils.sheet_to_json(primeraHoja, { defval: '', raw: false })
}

/** Plantilla de importación masiva para descargar. */
export async function descargarPlantillaImportacion(): Promise<void> {
  await descargarExcel(
    [
      {
        nombre: 'Plantilla',
        filas: [
          {
            tutor_nombre: 'María Fernanda Rojas Díaz',
            tutor_rut: '12.345.678-5',
            tutor_nacionalidad: 'chilena',
            tutor_telefono: '+56 9 8765 4321',
            tutor_email: 'maria.rojas@ejemplo.cl',
            tutor_direccion: 'Av. Arturo Prat 1234',
            tutor_comuna: 'Tocopilla',
            tramo_rsh: '40',
            beneficiario_rut: '25.678.910-3',
            beneficiario_nombre: 'Matías Rojas Soto',
            sexo: 'masculino',
            fecha_nacimiento: '2018-04-12',
            discapacidad: 'no',
            observaciones: '',
          },
        ],
      },
    ],
    'plantilla-importacion-navidad-2026.xlsx',
  )
}
