// Límite simple de frecuencia de envíos en el cliente. El servidor aplica sus
// propios límites (Supabase Auth) y las políticas RLS.
const CLAVE = 'navidad2026:ultimos-envios'

export function registrarEnvio(accion: string): void {
  try {
    const mapa = JSON.parse(localStorage.getItem(CLAVE) ?? '{}') as Record<string, number>
    mapa[accion] = Date.now()
    localStorage.setItem(CLAVE, JSON.stringify(mapa))
  } catch { /* almacenamiento no disponible: se ignora */ }
}

/** Devuelve los segundos que faltan para poder reintentar (0 si ya puede). */
export function segundosRestantes(accion: string, esperaMs = 30_000): number {
  try {
    const mapa = JSON.parse(localStorage.getItem(CLAVE) ?? '{}') as Record<string, number>
    const ultimo = mapa[accion]
    if (!ultimo) return 0
    const restante = esperaMs - (Date.now() - ultimo)
    return restante > 0 ? Math.ceil(restante / 1000) : 0
  } catch {
    return 0
  }
}
