// ============================================================================
//  Utilidades de RUT chileno: limpieza, dígito verificador (módulo 11) y
//  formateo con puntos y guión (12.345.678-9).
// ============================================================================

/** Deja el RUT en su forma canónica: sin puntos, sin guión y en mayúsculas. */
export function limpiarRut(valor: string): string {
  return (valor ?? '').replace(/[^0-9kK]/g, '').toUpperCase()
}

/** Calcula el dígito verificador de un número de RUT (algoritmo módulo 11). */
export function digitoVerificador(numero: string): string {
  let suma = 0
  let multiplicador = 2
  for (let i = numero.length - 1; i >= 0; i--) {
    suma += Number(numero[i]) * multiplicador
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1
  }
  const resto = 11 - (suma % 11)
  if (resto === 11) return '0'
  if (resto === 10) return 'K'
  return String(resto)
}

/** Valida un RUT chileno completo (cuerpo + dígito verificador). */
export function validarRut(valor: string): boolean {
  const limpio = limpiarRut(valor)
  if (limpio.length < 7 || limpio.length > 9) return false
  const cuerpo = limpio.slice(0, -1)
  const dv = limpio.slice(-1)
  if (!/^\d+$/.test(cuerpo)) return false
  if (Number(cuerpo) < 1000) return false
  return digitoVerificador(cuerpo) === dv
}

/** Formato de presentación: 12.345.678-9 */
export function formatearRut(valor: string): string {
  const limpio = limpiarRut(valor)
  if (limpio.length < 2) return limpio
  const cuerpo = limpio.slice(0, -1)
  const dv = limpio.slice(-1)
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`
}

/** Formato de almacenamiento en base de datos: 12345678-9 */
export function rutParaGuardar(valor: string): string {
  const limpio = limpiarRut(valor)
  if (limpio.length < 2) return limpio
  return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`
}

/** Genera un RUT ficticio válido a partir de un número (solo para datos demo). */
export function rutDesdeNumero(numero: number): string {
  const cuerpo = String(numero)
  return `${cuerpo}-${digitoVerificador(cuerpo)}`
}
