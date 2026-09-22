// ============================================================================
//  Módulo 4 — Dashboard con indicadores del proceso.
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { todasLasPostulaciones } from '../../lib/consultas'
import { ETIQUETA_ESTADO, ETIQUETA_SEXO, tramoEdad } from '../../lib/formato'
import { mensajeError } from '../../lib/supabase'
import { descargarExcel, filasPostulacionesParaExcel } from '../../lib/excel'
import { reportePostulacionesPDF } from '../../lib/pdf'
import { useNotificacion } from '../../contexto/NotificacionProvider'
import { Alerta, Boton, Cargando, GraficoBarras, Indicador, Tarjeta } from '../../componentes/ui'
import type { FilaPostulacion } from '../../lib/tipos'

export function Dashboard() {
  const { error: avisarError } = useNotificacion()
  const [filas, setFilas] = useState<FilaPostulacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true
    ;(async () => {
      try {
        const datos = await todasLasPostulaciones()
        if (activo) setFilas(datos)
      } catch (e) {
        if (activo) setError(mensajeError(e))
      } finally {
        if (activo) setCargando(false)
      }
    })()
    return () => { activo = false }
  }, [])

  const resumen = useMemo(() => {
    const contar = (predicado: (f: FilaPostulacion) => boolean) => filas.filter(predicado).length
    const porGrupo = (clave: (f: FilaPostulacion) => string) => {
      const mapa = new Map<string, number>()
      for (const f of filas) mapa.set(clave(f), (mapa.get(clave(f)) ?? 0) + 1)
      return [...mapa.entries()].map(([etiqueta, valor]) => ({ etiqueta, valor }))
    }
    return {
      total: filas.length,
      pendientes: contar((f) => f.estado === 'pendiente'),
      aprobados: contar((f) => f.estado === 'aprobado'),
      rechazados: contar((f) => f.estado === 'rechazado'),
      observados: contar((f) => f.estado === 'observado'),
      nacionales: contar((f) => f.nacionalidad === 'chilena'),
      extranjeros: contar((f) => f.nacionalidad === 'extranjera'),
      discapacidad: contar((f) => f.discapacidad),
      entregados: contar((f) => f.entregado),
      familias: new Set(filas.map((f) => f.tutor_id)).size,
      porEstado: porGrupo((f) => ETIQUETA_ESTADO[f.estado]),
      porSexo: porGrupo((f) => ETIQUETA_SEXO[f.sexo]),
      porEdad: porGrupo((f) => tramoEdad(f.edad)).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es')),
      porTramo: porGrupo((f) => (f.tramo_rsh ? `Tramo ${f.tramo_rsh}%` : 'Sin RSH')).sort((a, b) =>
        a.etiqueta.localeCompare(b.etiqueta, 'es', { numeric: true }),
      ),
    }
  }, [filas])

  const exportarExcel = async () => {
    await descargarExcel(
      [{ nombre: 'Postulaciones', filas: filasPostulacionesParaExcel(filas) }],
      'postulaciones-navidad-2026.xlsx',
    )
  }

  const exportarPDF = async () => {
    await reportePostulacionesPDF(filas, 'Reporte general del proceso', [
      { etiqueta: 'Total de beneficiarios', valor: resumen.total },
      { etiqueta: 'Familias postulantes', valor: resumen.familias },
      { etiqueta: 'Aprobados', valor: resumen.aprobados },
      { etiqueta: 'Pendientes de revisión', valor: resumen.pendientes },
      { etiqueta: 'Con observación', valor: resumen.observados },
      { etiqueta: 'Rechazados', valor: resumen.rechazados },
      { etiqueta: 'Familias nacionales / extranjeras', valor: `${resumen.nacionales} / ${resumen.extranjeros}` },
      { etiqueta: 'Beneficiarios con discapacidad', valor: resumen.discapacidad },
      { etiqueta: 'Regalos entregados', valor: resumen.entregados },
    ])
  }

  if (cargando) return <Cargando texto="Cargando indicadores…" />
  if (error) return <Alerta tipo="error" titulo="No pudimos cargar los datos">{error}</Alerta>

  return (
    <div className="flex flex-col gap-6">
      <Tarjeta
        titulo="Resumen del proceso"
        descripcion="Entrega de regalos de Navidad 2026 · Ilustre Municipalidad de Tocopilla"
        acciones={
          <>
            <Boton variante="secundario" onClick={exportarExcel}>Exportar Excel</Boton>
            <Boton variante="secundario" onClick={exportarPDF}>Reporte PDF</Boton>
            <Link to="/panel/postulaciones"><Boton>Ver postulaciones</Boton></Link>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Indicador etiqueta="Beneficiarios" valor={resumen.total} />
          <Indicador etiqueta="Familias" valor={resumen.familias} tono="gris" />
          <Indicador etiqueta="Pendientes" valor={resumen.pendientes} tono="ambar" />
          <Indicador etiqueta="Aprobados" valor={resumen.aprobados} tono="verde" />
          <Indicador etiqueta="Rechazados" valor={resumen.rechazados} tono="rojo" />
          <Indicador etiqueta="Con observación" valor={resumen.observados} tono="azul" />
          <Indicador etiqueta="Familias nacionales" valor={resumen.nacionales} tono="gris" />
          <Indicador etiqueta="Familias extranjeras" valor={resumen.extranjeros} tono="gris" />
          <Indicador etiqueta="Con discapacidad" valor={resumen.discapacidad} tono="azul" />
          <Indicador etiqueta="Regalos entregados" valor={resumen.entregados} tono="verde" />
        </div>
      </Tarjeta>

      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta><GraficoBarras titulo="Postulaciones por estado" datos={resumen.porEstado} /></Tarjeta>
        <Tarjeta><GraficoBarras titulo="Beneficiarios por sexo" datos={resumen.porSexo} /></Tarjeta>
        <Tarjeta><GraficoBarras titulo="Beneficiarios por tramo de edad" datos={resumen.porEdad} /></Tarjeta>
        <Tarjeta><GraficoBarras titulo="Familias por tramo del Registro Social de Hogares" datos={resumen.porTramo} /></Tarjeta>
      </div>
    </div>
  )
}
