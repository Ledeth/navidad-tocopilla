// ============================================================================
//  Bitácora de auditoría: quién, qué, cuándo, valor anterior y valor nuevo.
//  Se alimenta con los triggers de Postgres y solo la ve el administrador.
// ============================================================================
import { useCallback, useEffect, useState } from 'react'
import { supabase, mensajeError } from '../../lib/supabase'
import { fechaHora } from '../../lib/formato'
import { descargarExcel } from '../../lib/excel'
import { useNotificacion } from '../../contexto/NotificacionProvider'
import {
  Alerta, Boton, Campo, Cargando, Insignia, Modal, Paginacion, Selector, Tarjeta, Vacio,
} from '../../componentes/ui'
import type { AuditoriaFila } from '../../lib/tipos'

const POR_PAGINA = 25
const TABLAS = ['beneficiarios', 'tutores', 'observaciones', 'entregas', 'configuracion', 'profiles', 'documentos']

export function Auditoria() {
  const { error: avisarError } = useNotificacion()
  const [filas, setFilas] = useState<AuditoriaFila[]>([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [tabla, setTabla] = useState('')
  const [accion, setAccion] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [detalle, setDetalle] = useState<AuditoriaFila | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      let consulta = supabase.from('audit_log').select('*', { count: 'exact' })
      if (tabla) consulta = consulta.eq('tabla', tabla)
      if (accion) consulta = consulta.eq('accion', accion)
      const desde = (pagina - 1) * POR_PAGINA
      const { data, error: errorConsulta, count } = await consulta
        .order('created_at', { ascending: false })
        .range(desde, desde + POR_PAGINA - 1)
      if (errorConsulta) throw errorConsulta
      setFilas((data ?? []) as AuditoriaFila[])
      setTotal(count ?? 0)
      setError('')
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setCargando(false)
    }
  }, [tabla, accion, pagina])

  useEffect(() => { void cargar() }, [cargar])

  const exportar = async () => {
    try {
      const { data, error: errorConsulta } = await supabase
        .from('audit_log').select('*').order('created_at', { ascending: false }).limit(5000)
      if (errorConsulta) throw errorConsulta
      await descargarExcel([{
        nombre: 'Auditoria',
        filas: ((data ?? []) as AuditoriaFila[]).map((a) => ({
          'Fecha': fechaHora(a.created_at),
          'Tabla': a.tabla,
          'Acción': a.accion,
          'Registro': a.registro_id ?? '',
          'Autor': a.actor_email ?? 'sistema',
          'Valor anterior': a.valor_anterior ? JSON.stringify(a.valor_anterior) : '',
          'Valor nuevo': a.valor_nuevo ? JSON.stringify(a.valor_nuevo) : '',
        })),
      }], 'auditoria-navidad-2026.xlsx')
    } catch (e) {
      avisarError(mensajeError(e))
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  return (
    <div className="flex flex-col gap-6">
      <Tarjeta
        titulo="Historial de auditoría"
        descripcion={`${total} movimientos registrados.`}
        acciones={<Boton variante="secundario" onClick={exportar}>Exportar Excel</Boton>}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo etiqueta="Tabla" htmlFor="a-tabla">
            <Selector id="a-tabla" value={tabla} onChange={(e) => { setPagina(1); setTabla(e.target.value) }}>
              <option value="">Todas</option>
              {TABLAS.map((t) => <option key={t} value={t}>{t}</option>)}
            </Selector>
          </Campo>
          <Campo etiqueta="Acción" htmlFor="a-accion">
            <Selector id="a-accion" value={accion} onChange={(e) => { setPagina(1); setAccion(e.target.value) }}>
              <option value="">Todas</option>
              <option value="INSERT">Creación</option>
              <option value="UPDATE">Modificación</option>
              <option value="DELETE">Eliminación</option>
            </Selector>
          </Campo>
        </div>
      </Tarjeta>

      <Tarjeta>
        {error && <Alerta tipo="error">{error}</Alerta>}
        {cargando ? <Cargando /> : !filas.length ? <Vacio mensaje="Sin movimientos registrados." /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] border-collapse text-sm">
                <caption className="sr-only">Bitácora de auditoría</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th scope="col" className="py-2 pr-3">Fecha</th>
                    <th scope="col" className="py-2 pr-3">Tabla</th>
                    <th scope="col" className="py-2 pr-3">Acción</th>
                    <th scope="col" className="py-2 pr-3">Autor</th>
                    <th scope="col" className="py-2 pr-3">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((a) => (
                    <tr key={a.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 whitespace-nowrap">{fechaHora(a.created_at)}</td>
                      <td className="py-2 pr-3">{a.tabla}</td>
                      <td className="py-2 pr-3">
                        <Insignia tono={a.accion === 'DELETE' ? 'rojo' : a.accion === 'INSERT' ? 'verde' : 'azul'}>
                          {a.accion}
                        </Insignia>
                      </td>
                      <td className="py-2 pr-3 break-all">{a.actor_email ?? 'sistema'}</td>
                      <td className="py-2 pr-3">
                        <Boton variante="secundario" onClick={() => setDetalle(a)}>Ver cambios</Boton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacion pagina={pagina} totalPaginas={totalPaginas} onCambiar={setPagina} />
          </>
        )}
      </Tarjeta>

      <Modal abierto={!!detalle} titulo="Detalle del movimiento" onCerrar={() => setDetalle(null)} ancho="max-w-3xl">
        {detalle && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-bold text-marino-900">Valor anterior</h3>
              <pre className="max-h-80 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">
                {detalle.valor_anterior ? JSON.stringify(detalle.valor_anterior, null, 2) : '—'}
              </pre>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-bold text-marino-900">Valor nuevo</h3>
              <pre className="max-h-80 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">
                {detalle.valor_nuevo ? JSON.stringify(detalle.valor_nuevo, null, 2) : '—'}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
