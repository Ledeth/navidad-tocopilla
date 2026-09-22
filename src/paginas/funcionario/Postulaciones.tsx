// ============================================================================
//  Tabla de postulaciones con búsqueda, filtros, paginación y exportación.
// ============================================================================
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { buscarPostulaciones, todasLasPostulaciones, FILTROS_VACIOS, type Filtros } from '../../lib/consultas'
import { ETIQUETA_SEXO, fechaCorta } from '../../lib/formato'
import { formatearRut } from '../../lib/rut'
import { mensajeError } from '../../lib/supabase'
import { descargarExcel, filasPostulacionesParaExcel } from '../../lib/excel'
import { fichaDesdeFila, fichasRetiroPDF, reportePostulacionesPDF } from '../../lib/pdf'
import { useNotificacion } from '../../contexto/NotificacionProvider'
import {
  Alerta, Boton, Campo, Cargando, Entrada, Insignia, InsigniaEstado, Paginacion, Selector, Tarjeta, Vacio,
} from '../../componentes/ui'
import type { FilaPostulacion } from '../../lib/tipos'

const POR_PAGINA = 20

export function Postulaciones() {
  const navegar = useNavigate()
  const { error: avisarError, exito } = useNotificacion()

  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS)
  const [borradorBusqueda, setBorradorBusqueda] = useState('')
  const [filas, setFilas] = useState<FilaPostulacion[]>([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [generando, setGenerando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const { filas: datos, total: cuenta } = await buscarPostulaciones(filtros, pagina, POR_PAGINA)
      setFilas(datos)
      setTotal(cuenta)
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setCargando(false)
    }
  }, [filtros, pagina])

  useEffect(() => { void cargar() }, [cargar])

  const cambiarFiltro = (clave: keyof Filtros, valor: string) => {
    setPagina(1)
    setFiltros((prev) => ({ ...prev, [clave]: valor }))
  }

  const limpiar = () => {
    setBorradorBusqueda('')
    setFiltros(FILTROS_VACIOS)
    setPagina(1)
  }

  const exportarExcel = async () => {
    setGenerando(true)
    try {
      const todas = await todasLasPostulaciones(filtros)
      await descargarExcel(
        [{ nombre: 'Postulaciones', filas: filasPostulacionesParaExcel(todas) }],
        'postulaciones-filtradas-navidad-2026.xlsx',
      )
      exito(`Se exportaron ${todas.length} registros.`)
    } catch (e) {
      avisarError(mensajeError(e))
    } finally {
      setGenerando(false)
    }
  }

  const exportarPDF = async () => {
    setGenerando(true)
    try {
      const todas = await todasLasPostulaciones(filtros)
      await reportePostulacionesPDF(todas, 'Listado filtrado de postulaciones', [
        { etiqueta: 'Registros', valor: todas.length },
        { etiqueta: 'Aprobados', valor: todas.filter((f) => f.estado === 'aprobado').length },
        { etiqueta: 'Pendientes', valor: todas.filter((f) => f.estado === 'pendiente').length },
      ])
    } catch (e) {
      avisarError(mensajeError(e))
    } finally {
      setGenerando(false)
    }
  }

  const fichasEnLote = async () => {
    setGenerando(true)
    try {
      const todas = await todasLasPostulaciones({ ...filtros, estado: 'aprobado' })
      const conFolio = todas.filter((f) => f.folio)
      if (!conFolio.length) {
        avisarError('No hay beneficiarios aprobados con folio en el filtro actual.')
        return
      }
      await fichasRetiroPDF(conFolio.map(fichaDesdeFila))
      exito(`Se generaron ${conFolio.length} fichas de retiro.`)
    } catch (e) {
      avisarError(mensajeError(e))
    } finally {
      setGenerando(false)
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  return (
    <div className="flex flex-col gap-6">
      <Tarjeta
        titulo="Postulaciones"
        descripcion={`${total} registro${total === 1 ? '' : 's'} encontrado${total === 1 ? '' : 's'}.`}
        acciones={
          <>
            <Boton variante="secundario" cargando={generando} onClick={exportarExcel}>Excel</Boton>
            <Boton variante="secundario" cargando={generando} onClick={exportarPDF}>PDF</Boton>
            <Boton variante="secundario" cargando={generando} onClick={fichasEnLote}>Fichas de retiro</Boton>
          </>
        }
      >
        <form
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => { e.preventDefault(); cambiarFiltro('busqueda', borradorBusqueda) }}
        >
          <div className="sm:col-span-2">
            <Campo etiqueta="Buscar por RUT, nombre o folio" htmlFor="busqueda">
              <div className="flex gap-2">
                <Entrada
                  id="busqueda" value={borradorBusqueda} placeholder="Ej: 12.345.678-9, Rojas o NAV-2026-000001"
                  onChange={(e) => setBorradorBusqueda(e.target.value)}
                />
                <Boton type="submit">Buscar</Boton>
              </div>
            </Campo>
          </div>

          <Campo etiqueta="Estado" htmlFor="f-estado">
            <Selector id="f-estado" value={filtros.estado} onChange={(e) => cambiarFiltro('estado', e.target.value)}>
              <option value="">Todos</option>
              <option value="pendiente">Pendiente de revisión</option>
              <option value="aprobado">Aprobado</option>
              <option value="observado">Con observación</option>
              <option value="rechazado">Rechazado</option>
            </Selector>
          </Campo>

          <Campo etiqueta="Nacionalidad" htmlFor="f-nac">
            <Selector id="f-nac" value={filtros.nacionalidad} onChange={(e) => cambiarFiltro('nacionalidad', e.target.value)}>
              <option value="">Todas</option>
              <option value="chilena">Chilena</option>
              <option value="extranjera">Extranjera</option>
            </Selector>
          </Campo>

          <Campo etiqueta="Sexo" htmlFor="f-sexo">
            <Selector id="f-sexo" value={filtros.sexo} onChange={(e) => cambiarFiltro('sexo', e.target.value)}>
              <option value="">Todos</option>
              <option value="femenino">Femenino</option>
              <option value="masculino">Masculino</option>
              <option value="otro">Otro</option>
            </Selector>
          </Campo>

          <Campo etiqueta="Discapacidad" htmlFor="f-disc">
            <Selector id="f-disc" value={filtros.discapacidad} onChange={(e) => cambiarFiltro('discapacidad', e.target.value)}>
              <option value="">Todos</option>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </Selector>
          </Campo>

          <Campo etiqueta="Entrega del regalo" htmlFor="f-ent">
            <Selector id="f-ent" value={filtros.entregado} onChange={(e) => cambiarFiltro('entregado', e.target.value)}>
              <option value="">Todos</option>
              <option value="si">Entregados</option>
              <option value="no">Sin entregar</option>
            </Selector>
          </Campo>

          <div className="grid grid-cols-2 gap-2">
            <Campo etiqueta="Edad desde" htmlFor="f-emin">
              <Entrada id="f-emin" type="number" min={0} max={30} value={filtros.edadMin}
                       onChange={(e) => cambiarFiltro('edadMin', e.target.value)} />
            </Campo>
            <Campo etiqueta="Edad hasta" htmlFor="f-emax">
              <Entrada id="f-emax" type="number" min={0} max={30} value={filtros.edadMax}
                       onChange={(e) => cambiarFiltro('edadMax', e.target.value)} />
            </Campo>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Campo etiqueta="Postuló desde" htmlFor="f-desde">
              <Entrada id="f-desde" type="date" value={filtros.desde}
                       onChange={(e) => cambiarFiltro('desde', e.target.value)} />
            </Campo>
            <Campo etiqueta="Postuló hasta" htmlFor="f-hasta">
              <Entrada id="f-hasta" type="date" value={filtros.hasta}
                       onChange={(e) => cambiarFiltro('hasta', e.target.value)} />
            </Campo>
          </div>

          <div className="flex items-end">
            <Boton variante="secundario" type="button" onClick={limpiar}>Limpiar filtros</Boton>
          </div>
        </form>
      </Tarjeta>

      <Tarjeta>
        {error && <Alerta tipo="error">{error}</Alerta>}
        {cargando ? (
          <Cargando />
        ) : !filas.length ? (
          <Vacio mensaje="No hay postulaciones que coincidan con los filtros." />
        ) : (
          <>
            {/* Tabla en pantallas grandes */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[60rem] border-collapse text-sm">
                <caption className="sr-only">Listado de postulaciones</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th scope="col" className="py-2 pr-3">Beneficiario</th>
                    <th scope="col" className="py-2 pr-3">RUT</th>
                    <th scope="col" className="py-2 pr-3">Edad</th>
                    <th scope="col" className="py-2 pr-3">Sexo</th>
                    <th scope="col" className="py-2 pr-3">Tutor</th>
                    <th scope="col" className="py-2 pr-3">Nacionalidad</th>
                    <th scope="col" className="py-2 pr-3">Estado</th>
                    <th scope="col" className="py-2 pr-3">Folio</th>
                    <th scope="col" className="py-2 pr-3">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.beneficiario_id} className="border-b border-slate-100 align-top hover:bg-marino-50/50">
                      <td className="py-2.5 pr-3 font-semibold text-marino-900">
                        {f.beneficiario_nombre}
                        {f.discapacidad && <span className="ml-2"><Insignia tono="azul">Discapacidad</Insignia></span>}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums">{formatearRut(f.beneficiario_rut)}</td>
                      <td className="py-2.5 pr-3 tabular-nums">{f.edad}</td>
                      <td className="py-2.5 pr-3">{ETIQUETA_SEXO[f.sexo]}</td>
                      <td className="py-2.5 pr-3">{f.tutor_nombre}</td>
                      <td className="py-2.5 pr-3">{f.nacionalidad === 'chilena' ? 'Chilena' : 'Extranjera'}</td>
                      <td className="py-2.5 pr-3"><InsigniaEstado estado={f.estado} /></td>
                      <td className="py-2.5 pr-3 tabular-nums">{f.folio ?? '—'}</td>
                      <td className="py-2.5 pr-3">
                        <Boton variante="secundario" onClick={() => navegar(`/panel/postulaciones/${f.beneficiario_id}`)}>
                          Revisar
                        </Boton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tarjetas en móvil */}
            <ul className="flex flex-col gap-3 lg:hidden">
              {filas.map((f) => (
                <li key={f.beneficiario_id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-marino-900">{f.beneficiario_nombre}</p>
                      <p className="text-xs text-slate-600">
                        {formatearRut(f.beneficiario_rut)} · {f.edad} años · {ETIQUETA_SEXO[f.sexo]}
                      </p>
                      <p className="text-xs text-slate-600">Tutor: {f.tutor_nombre}</p>
                      <p className="text-xs text-slate-500">Postuló el {fechaCorta(f.created_at)}</p>
                    </div>
                    <InsigniaEstado estado={f.estado} />
                  </div>
                  <Boton variante="secundario" className="mt-3 w-full"
                         onClick={() => navegar(`/panel/postulaciones/${f.beneficiario_id}`)}>
                    Revisar
                  </Boton>
                </li>
              ))}
            </ul>

            <Paginacion pagina={pagina} totalPaginas={totalPaginas} onCambiar={setPagina} />
          </>
        )}
      </Tarjeta>
    </div>
  )
}
