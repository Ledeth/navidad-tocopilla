// ============================================================================
//  Listados por categoría: familias nacionales y familias extranjeras.
//  Cada listado se exporta a Excel y a PDF, y permite generar las fichas de
//  retiro en lote de los beneficiarios aprobados.
// ============================================================================
import { useEffect, useState } from 'react'
import { todasLasPostulaciones, FILTROS_VACIOS } from '../../lib/consultas'
import { descargarExcel, filasPostulacionesParaExcel } from '../../lib/excel'
import { fichaDesdeFila, fichasRetiroPDF, reportePostulacionesPDF } from '../../lib/pdf'
import { ETIQUETA_SEXO } from '../../lib/formato'
import { formatearRut } from '../../lib/rut'
import { mensajeError } from '../../lib/supabase'
import { useNotificacion } from '../../contexto/NotificacionProvider'
import { Alerta, Boton, Cargando, Indicador, InsigniaEstado, Tarjeta, Vacio } from '../../componentes/ui'
import type { FilaPostulacion, Nacionalidad } from '../../lib/tipos'

const CATEGORIAS: { clave: Nacionalidad; titulo: string; archivo: string }[] = [
  { clave: 'chilena', titulo: 'Familias nacionales', archivo: 'familias-nacionales' },
  { clave: 'extranjera', titulo: 'Familias extranjeras', archivo: 'familias-extranjeras' },
]

export function Listados() {
  const { error: avisarError, exito } = useNotificacion()
  const [filas, setFilas] = useState<FilaPostulacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [generando, setGenerando] = useState(false)

  useEffect(() => {
    let activo = true
    ;(async () => {
      try {
        const datos = await todasLasPostulaciones(FILTROS_VACIOS)
        if (activo) setFilas(datos)
      } catch (e) {
        if (activo) setError(mensajeError(e))
      } finally {
        if (activo) setCargando(false)
      }
    })()
    return () => { activo = false }
  }, [])

  const exportarCategoria = async (clave: Nacionalidad, archivo: string) => {
    const seleccion = filas.filter((f) => f.nacionalidad === clave)
    await descargarExcel(
      [{ nombre: clave === 'chilena' ? 'Nacionales' : 'Extranjeras', filas: filasPostulacionesParaExcel(seleccion) }],
      `${archivo}-navidad-2026.xlsx`,
    )
    exito(`Se exportaron ${seleccion.length} registros.`)
  }

  const pdfCategoria = async (clave: Nacionalidad, titulo: string, archivo: string) => {
    const seleccion = filas.filter((f) => f.nacionalidad === clave)
    await reportePostulacionesPDF(seleccion, titulo, [
      { etiqueta: 'Beneficiarios', valor: seleccion.length },
      { etiqueta: 'Familias', valor: new Set(seleccion.map((f) => f.tutor_id)).size },
      { etiqueta: 'Aprobados', valor: seleccion.filter((f) => f.estado === 'aprobado').length },
    ], `${archivo}-navidad-2026.pdf`)
  }

  const fichasCategoria = async (clave: Nacionalidad) => {
    const seleccion = filas.filter((f) => f.nacionalidad === clave && f.estado === 'aprobado' && f.folio)
    if (!seleccion.length) { avisarError('No hay beneficiarios aprobados en esta categoría.'); return }
    setGenerando(true)
    try {
      await fichasRetiroPDF(seleccion.map(fichaDesdeFila), `fichas-${clave}-navidad-2026.pdf`)
      exito(`Se generaron ${seleccion.length} fichas.`)
    } catch (e) {
      avisarError(mensajeError(e))
    } finally {
      setGenerando(false)
    }
  }

  if (cargando) return <Cargando />
  if (error) return <Alerta tipo="error" titulo="No pudimos cargar los listados">{error}</Alerta>

  return (
    <div className="flex flex-col gap-6">
      {CATEGORIAS.map((categoria) => {
        const seleccion = filas.filter((f) => f.nacionalidad === categoria.clave)
        const aprobados = seleccion.filter((f) => f.estado === 'aprobado')
        return (
          <Tarjeta
            key={categoria.clave}
            titulo={categoria.titulo}
            descripcion={`${seleccion.length} beneficiarios · ${new Set(seleccion.map((f) => f.tutor_id)).size} familias`}
            acciones={
              <>
                <Boton variante="secundario" onClick={() => exportarCategoria(categoria.clave, categoria.archivo)}>
                  Excel
                </Boton>
                <Boton variante="secundario" onClick={() => pdfCategoria(categoria.clave, categoria.titulo, categoria.archivo)}>
                  PDF
                </Boton>
                <Boton variante="secundario" cargando={generando} onClick={() => fichasCategoria(categoria.clave)}>
                  Fichas de retiro
                </Boton>
              </>
            }
          >
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Indicador etiqueta="Beneficiarios" valor={seleccion.length} />
              <Indicador etiqueta="Aprobados" valor={aprobados.length} tono="verde" />
              <Indicador etiqueta="Con discapacidad" valor={seleccion.filter((f) => f.discapacidad).length} tono="azul" />
              <Indicador etiqueta="Entregados" valor={seleccion.filter((f) => f.entregado).length} tono="gris" />
            </div>

            {!seleccion.length ? <Vacio mensaje="Sin registros en esta categoría." /> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[42rem] border-collapse text-sm">
                  <caption className="sr-only">{categoria.titulo}</caption>
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th scope="col" className="py-2 pr-3">Folio</th>
                      <th scope="col" className="py-2 pr-3">Beneficiario</th>
                      <th scope="col" className="py-2 pr-3">RUT</th>
                      <th scope="col" className="py-2 pr-3">Edad</th>
                      <th scope="col" className="py-2 pr-3">Sexo</th>
                      <th scope="col" className="py-2 pr-3">Tutor</th>
                      <th scope="col" className="py-2 pr-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seleccion.slice(0, 100).map((f) => (
                      <tr key={f.beneficiario_id} className="border-b border-slate-100">
                        <td className="py-2 pr-3 tabular-nums">{f.folio ?? '—'}</td>
                        <td className="py-2 pr-3 font-semibold text-marino-900">{f.beneficiario_nombre}</td>
                        <td className="py-2 pr-3 tabular-nums">{formatearRut(f.beneficiario_rut)}</td>
                        <td className="py-2 pr-3 tabular-nums">{f.edad}</td>
                        <td className="py-2 pr-3">{ETIQUETA_SEXO[f.sexo]}</td>
                        <td className="py-2 pr-3">{f.tutor_nombre}</td>
                        <td className="py-2 pr-3"><InsigniaEstado estado={f.estado} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {seleccion.length > 100 && (
                  <p className="pt-3 text-xs text-slate-500">
                    Se muestran los primeros 100 registros. Exporte a Excel o PDF para ver el listado completo.
                  </p>
                )}
              </div>
            )}
          </Tarjeta>
        )
      })}
    </div>
  )
}
