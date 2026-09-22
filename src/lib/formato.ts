// Formateo y etiquetas en español de Chile.
import type { Estado, Nacionalidad, Sexo, TipoDocumento } from './tipos'

export const ETIQUETA_ESTADO: Record<Estado, string> = {
  pendiente: 'Pendiente de revisión',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  observado: 'Con observación',
}

export const ETIQUETA_SEXO: Record<Sexo, string> = {
  femenino: 'Femenino',
  masculino: 'Masculino',
  otro: 'Otro',
}

export const ETIQUETA_NACIONALIDAD: Record<Nacionalidad, string> = {
  chilena: 'Chilena',
  extranjera: 'Extranjera',
}

export const ETIQUETA_DOCUMENTO: Record<TipoDocumento, string> = {
  rsh: 'Cartola Registro Social de Hogares',
  identidad: 'Cédula de identidad o certificado de nacimiento',
  estudios: 'Certificado de estudios',
  discapacidad: 'Credencial o certificado de discapacidad',
}

/** dd-mm-aaaa */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** dd-mm-aaaa hh:mm */
export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/** Edad cumplida a una fecha de corte (por defecto, hoy). */
export function calcularEdad(fechaNacimiento: string, corte?: string | Date): number {
  if (!fechaNacimiento) return NaN
  const nac = new Date(`${fechaNacimiento.slice(0, 10)}T12:00:00`)
  const ref = corte ? new Date(typeof corte === 'string' ? `${corte.slice(0, 10)}T12:00:00` : corte) : new Date()
  let edad = ref.getFullYear() - nac.getFullYear()
  const mes = ref.getMonth() - nac.getMonth()
  if (mes < 0 || (mes === 0 && ref.getDate() < nac.getDate())) edad--
  return edad
}

/** Tramo de edad usado en el dashboard. */
export function tramoEdad(edad: number): string {
  if (edad <= 3) return '0 a 3 años'
  if (edad <= 6) return '4 a 6 años'
  if (edad <= 9) return '7 a 9 años'
  if (edad <= 12) return '10 a 12 años'
  return '13 años o más'
}

export function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Quita etiquetas y espacios sobrantes de un texto ingresado por el usuario. */
export function sanitizar(texto: string): string {
  return (texto ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

/** Marca de tiempo compacta para nombres de archivo: 20261225-143000 */
export function marcaTiempo(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}
