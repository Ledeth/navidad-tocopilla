// ============================================================================
//  Consultas del panel municipal sobre la vista v_postulaciones.
// ============================================================================
import { supabase } from './supabase'
import { limpiarRut } from './rut'
import type { Estado, FilaPostulacion, Nacionalidad, Sexo } from './tipos'

export interface Filtros {
  busqueda?: string
  estado?: Estado | ''
  nacionalidad?: Nacionalidad | ''
  sexo?: Sexo | ''
  discapacidad?: '' | 'si' | 'no'
  entregado?: '' | 'si' | 'no'
  edadMin?: string
  edadMax?: string
  desde?: string
  hasta?: string
}

export const FILTROS_VACIOS: Filtros = {
  busqueda: '', estado: '', nacionalidad: '', sexo: '', discapacidad: '', entregado: '',
  edadMin: '', edadMax: '', desde: '', hasta: '',
}

// Se usa `any` porque el constructor de consultas de supabase-js encadena
// tipos distintos en cada método y aquí solo se van acumulando filtros.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aplicarFiltros(consulta: any, f: Filtros): any {
  if (f.estado) consulta = consulta.eq('estado', f.estado)
  if (f.nacionalidad) consulta = consulta.eq('nacionalidad', f.nacionalidad)
  if (f.sexo) consulta = consulta.eq('sexo', f.sexo)
  if (f.discapacidad) consulta = consulta.eq('discapacidad', f.discapacidad === 'si')
  if (f.entregado) consulta = consulta.eq('entregado', f.entregado === 'si')
  if (f.edadMin) consulta = consulta.gte('edad', Number(f.edadMin))
  if (f.edadMax) consulta = consulta.lte('edad', Number(f.edadMax))
  if (f.desde) consulta = consulta.gte('created_at', `${f.desde}T00:00:00`)
  if (f.hasta) consulta = consulta.lte('created_at', `${f.hasta}T23:59:59`)

  const termino = (f.busqueda ?? '').trim()
  if (termino) {
    // Se busca por nombre (beneficiario o tutor), por RUT y por folio.
    const comoRut = limpiarRut(termino)
    const patrones = [
      `beneficiario_nombre.ilike.%${termino}%`,
      `tutor_nombre.ilike.%${termino}%`,
      `folio.ilike.%${termino}%`,
    ]
    if (comoRut.length >= 4) {
      const cuerpo = comoRut.length > 1 ? comoRut.slice(0, -1) : comoRut
      patrones.push(`beneficiario_rut.ilike.%${cuerpo}%`, `tutor_rut.ilike.%${cuerpo}%`)
    }
    consulta = consulta.or(patrones.join(','))
  }
  return consulta
}

/** Página de resultados + total de coincidencias. */
export async function buscarPostulaciones(
  filtros: Filtros,
  pagina = 1,
  porPagina = 20,
): Promise<{ filas: FilaPostulacion[]; total: number }> {
  let consulta: any = supabase.from('v_postulaciones').select('*', { count: 'exact' })
  consulta = aplicarFiltros(consulta, filtros)
  const desde = (pagina - 1) * porPagina
  const { data, error, count } = await consulta
    .order('created_at', { ascending: false })
    .range(desde, desde + porPagina - 1)
  if (error) throw error
  return { filas: (data ?? []) as FilaPostulacion[], total: count ?? 0 }
}

/** Todas las filas que cumplen el filtro (para exportar y para el dashboard). */
export async function todasLasPostulaciones(filtros: Filtros = FILTROS_VACIOS): Promise<FilaPostulacion[]> {
  const acumulado: FilaPostulacion[] = []
  const tamano = 1000
  for (let pagina = 0; pagina < 50; pagina++) {
    let consulta: any = supabase.from('v_postulaciones').select('*')
    consulta = aplicarFiltros(consulta, filtros)
    const { data, error } = await consulta
      .order('created_at', { ascending: false })
      .range(pagina * tamano, pagina * tamano + tamano - 1)
    if (error) throw error
    const filas = (data ?? []) as FilaPostulacion[]
    acumulado.push(...filas)
    if (filas.length < tamano) break
  }
  return acumulado
}
