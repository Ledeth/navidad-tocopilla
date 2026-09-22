// ============================================================================
//  Importación masiva desde Excel/CSV (migración de procesos anteriores o de
//  formularios en papel). Vista previa, validación fila a fila y reporte de
//  errores descargable.
// ============================================================================
import { useState } from 'react'
import { descargarExcel, descargarPlantillaImportacion, leerExcel } from '../../lib/excel'
import { formatearRut, rutParaGuardar, validarRut } from '../../lib/rut'
import { calcularEdad, sanitizar } from '../../lib/formato'
import { supabase, mensajeError } from '../../lib/supabase'
import { useSesion } from '../../contexto/SesionProvider'
import { useNotificacion } from '../../contexto/NotificacionProvider'
import { Alerta, Boton, Campo, Entrada, Indicador, Insignia, Tarjeta, Vacio } from '../../componentes/ui'

interface FilaImportada {
  numero: number
  datos: Record<string, string>
  errores: string[]
  resultado?: 'importada' | 'error'
  detalle?: string
}

const COLUMNAS = [
  'tutor_nombre', 'tutor_rut', 'tutor_nacionalidad', 'tutor_telefono', 'tutor_email',
  'tutor_direccion', 'tutor_comuna', 'tramo_rsh', 'beneficiario_rut', 'beneficiario_nombre',
  'sexo', 'fecha_nacimiento', 'discapacidad', 'observaciones',
]

const SEXOS = ['femenino', 'masculino', 'otro']

/** Normaliza una fecha escrita como dd-mm-aaaa, dd/mm/aaaa o aaaa-mm-dd. */
function normalizarFecha(valor: string): string | null {
  const texto = (valor ?? '').trim()
  if (!texto) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10)
  const partes = texto.split(/[/\-.]/)
  if (partes.length === 3 && partes[2].length === 4) {
    const [d, m, a] = partes
    return `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const fecha = new Date(texto)
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString().slice(0, 10)
}

export function Importacion() {
  const { configuracion } = useSesion()
  const { exito, error: avisarError } = useNotificacion()

  const [filas, setFilas] = useState<FilaImportada[]>([])
  const [nombreArchivo, setNombreArchivo] = useState('')
  const [importando, setImportando] = useState(false)
  const [terminado, setTerminado] = useState(false)

  const validarFila = (datos: Record<string, string>, numero: number): FilaImportada => {
    const errores: string[] = []
    const nacionalidad = (datos.tutor_nacionalidad ?? '').toLowerCase().trim() || 'chilena'

    if (!datos.tutor_nombre || datos.tutor_nombre.trim().length < 5) errores.push('Falta el nombre del tutor.')
    if (nacionalidad !== 'chilena' && nacionalidad !== 'extranjera') {
      errores.push('La nacionalidad debe ser "chilena" o "extranjera".')
    }
    if (nacionalidad === 'chilena') {
      if (!validarRut(datos.tutor_rut ?? '')) errores.push('RUT del tutor inválido.')
      if (!['40', '50', '60', '70', '80', '90', '100'].includes(String(datos.tramo_rsh ?? '').replace('%', '').trim())) {
        errores.push('Tramo RSH inválido (40, 50, 60, 70, 80, 90 o 100).')
      }
    } else if (!datos.tutor_rut && !datos.tutor_documento) {
      errores.push('El tutor extranjero necesita RUT o documento de identidad.')
    } else if (datos.tutor_rut && !validarRut(datos.tutor_rut)) {
      errores.push('RUT del tutor inválido.')
    }

    if (!validarRut(datos.beneficiario_rut ?? '')) errores.push('RUT del beneficiario inválido.')
    if (!datos.beneficiario_nombre || datos.beneficiario_nombre.trim().length < 5) {
      errores.push('Falta el nombre del beneficiario.')
    }
    if (!SEXOS.includes((datos.sexo ?? '').toLowerCase().trim())) {
      errores.push('El sexo debe ser femenino, masculino u otro.')
    }

    const fecha = normalizarFecha(datos.fecha_nacimiento ?? '')
    if (!fecha) {
      errores.push('Fecha de nacimiento inválida.')
    } else if (configuracion) {
      const edad = calcularEdad(fecha, configuracion.fecha_corte_edad)
      if (edad > configuracion.edad_maxima) errores.push(`Supera la edad máxima (${edad} años).`)
      if (edad < 0) errores.push('La fecha de nacimiento es futura.')
    }

    return { numero, datos: { ...datos, fecha_nacimiento: fecha ?? datos.fecha_nacimiento }, errores }
  }

  const cargarArchivo = async (archivo: File | null) => {
    setTerminado(false)
    setFilas([])
    if (!archivo) return
    setNombreArchivo(archivo.name)
    try {
      const crudas = await leerExcel(archivo)
      if (!crudas.length) { avisarError('El archivo no tiene filas de datos.'); return }
      const normalizadas = crudas.map((fila, i) => {
        const datos: Record<string, string> = {}
        for (const [clave, valor] of Object.entries(fila)) {
          datos[clave.toString().trim().toLowerCase().replace(/\s+/g, '_')] = String(valor ?? '').trim()
        }
        return validarFila(datos, i + 2) // +2: la fila 1 es el encabezado
      })
      setFilas(normalizadas)
    } catch (e) {
      avisarError(mensajeError(e))
    }
  }

  const importar = async () => {
    const validas = filas.filter((f) => !f.errores.length)
    if (!validas.length) { avisarError('No hay filas válidas para importar.'); return }
    if (!window.confirm(`¿Importar ${validas.length} registros?`)) return

    setImportando(true)
    const actualizadas = [...filas]

    for (const fila of validas) {
      const indice = actualizadas.findIndex((f) => f.numero === fila.numero)
      try {
        const d = fila.datos
        const nacionalidad = (d.tutor_nacionalidad || 'chilena').toLowerCase() as 'chilena' | 'extranjera'
        const rutTutor = d.tutor_rut ? rutParaGuardar(d.tutor_rut) : null

        // 1. Buscar el tutor por RUT; si no existe, crearlo.
        let tutorId: string | null = null
        if (rutTutor) {
          const { data: existente } = await supabase
            .from('tutores').select('id').eq('rut', rutTutor).maybeSingle()
          tutorId = (existente as { id: string } | null)?.id ?? null
        }
        if (!tutorId) {
          const { data: creado, error } = await supabase.from('tutores').insert({
            nombre_completo: sanitizar(d.tutor_nombre),
            nacionalidad,
            rut: rutTutor,
            documento_extranjero: d.tutor_documento ? sanitizar(d.tutor_documento) : null,
            telefono: sanitizar(d.tutor_telefono || 'Sin teléfono'),
            email: (d.tutor_email || 'sin-correo@navidadtocopilla.cl').toLowerCase(),
            direccion: sanitizar(d.tutor_direccion || 'Sin dirección registrada'),
            comuna: sanitizar(d.tutor_comuna || 'Tocopilla'),
            tramo_rsh: nacionalidad === 'chilena'
              ? Number(String(d.tramo_rsh).replace('%', '').trim())
              : null,
            consentimiento: true,
          }).select('id').single()
          if (error) throw error
          tutorId = (creado as { id: string }).id
        }

        // 2. Insertar el beneficiario.
        const { error: errorBeneficiario } = await supabase.from('beneficiarios').insert({
          tutor_id: tutorId,
          rut: rutParaGuardar(d.beneficiario_rut),
          nombre_completo: sanitizar(d.beneficiario_nombre),
          sexo: d.sexo.toLowerCase(),
          fecha_nacimiento: d.fecha_nacimiento,
          discapacidad: ['si', 'sí', 'true', '1'].includes((d.discapacidad ?? '').toLowerCase()),
          observaciones: d.observaciones ? sanitizar(d.observaciones) : null,
          estado: 'pendiente',
        })
        if (errorBeneficiario) throw errorBeneficiario

        actualizadas[indice] = { ...fila, resultado: 'importada' }
      } catch (e) {
        actualizadas[indice] = { ...fila, resultado: 'error', detalle: mensajeError(e) }
      }
      setFilas([...actualizadas])
    }

    setImportando(false)
    setTerminado(true)
    exito('Importación finalizada.')
  }

  const descargarErrores = async () => {
    const conProblema = filas.filter((f) => f.errores.length || f.resultado === 'error')
    await descargarExcel([{
      nombre: 'Errores',
      filas: conProblema.map((f) => ({
        'Fila': f.numero,
        'RUT beneficiario': f.datos.beneficiario_rut ?? '',
        'Nombre beneficiario': f.datos.beneficiario_nombre ?? '',
        'Problemas': [...f.errores, f.detalle ?? ''].filter(Boolean).join(' | '),
      })),
    }], 'errores-importacion-navidad-2026.xlsx')
  }

  const validas = filas.filter((f) => !f.errores.length).length
  const conErrores = filas.length - validas
  const importadas = filas.filter((f) => f.resultado === 'importada').length

  return (
    <div className="flex flex-col gap-6">
      <Tarjeta
        titulo="Importación masiva"
        descripcion="Cargue un archivo Excel (.xlsx) o CSV con los datos de procesos anteriores o de formularios en papel."
        acciones={<Boton variante="secundario" onClick={descargarPlantillaImportacion}>Descargar plantilla</Boton>}
      >
        <div className="flex flex-col gap-4">
          <Campo etiqueta="Archivo Excel o CSV" htmlFor="archivo"
                 ayuda={`Columnas esperadas: ${COLUMNAS.join(', ')}`}>
            <Entrada
              id="archivo" type="file"
              accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => cargarArchivo(e.target.files?.[0] ?? null)}
            />
          </Campo>

          {filas.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Indicador etiqueta="Filas leídas" valor={filas.length} />
                <Indicador etiqueta="Válidas" valor={validas} tono="verde" />
                <Indicador etiqueta="Con errores" valor={conErrores} tono="rojo" />
                <Indicador etiqueta="Importadas" valor={importadas} tono="azul" />
              </div>

              <div className="flex flex-wrap gap-2">
                <Boton cargando={importando} disabled={!validas || terminado} onClick={importar}>
                  Importar {validas} registros válidos
                </Boton>
                {(conErrores > 0 || terminado) && (
                  <Boton variante="secundario" onClick={descargarErrores}>Descargar reporte de errores</Boton>
                )}
              </div>

              {terminado && (
                <Alerta tipo="exito" titulo="Importación finalizada">
                  Se importaron {importadas} de {validas} registros válidos del archivo {nombreArchivo}.
                </Alerta>
              )}
            </>
          )}
        </div>
      </Tarjeta>

      <Tarjeta titulo="Vista previa" descripcion="Revise los datos antes de importar.">
        {!filas.length ? <Vacio mensaje="Seleccione un archivo para ver la vista previa." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[50rem] border-collapse text-sm">
              <caption className="sr-only">Vista previa de la importación</caption>
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="py-2 pr-3">Fila</th>
                  <th scope="col" className="py-2 pr-3">Tutor</th>
                  <th scope="col" className="py-2 pr-3">Beneficiario</th>
                  <th scope="col" className="py-2 pr-3">RUT</th>
                  <th scope="col" className="py-2 pr-3">Nacimiento</th>
                  <th scope="col" className="py-2 pr-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filas.slice(0, 200).map((f) => (
                  <tr key={f.numero} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3 tabular-nums">{f.numero}</td>
                    <td className="py-2 pr-3">{f.datos.tutor_nombre || '—'}</td>
                    <td className="py-2 pr-3">{f.datos.beneficiario_nombre || '—'}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {f.datos.beneficiario_rut ? formatearRut(f.datos.beneficiario_rut) : '—'}
                    </td>
                    <td className="py-2 pr-3">{f.datos.fecha_nacimiento || '—'}</td>
                    <td className="py-2 pr-3">
                      {f.resultado === 'importada' ? <Insignia tono="verde">Importada</Insignia>
                        : f.resultado === 'error' ? <Insignia tono="rojo">{f.detalle}</Insignia>
                        : f.errores.length ? (
                          <ul className="flex flex-col gap-1">
                            {f.errores.map((err) => (
                              <li key={err} className="text-xs text-navidad-600">{err}</li>
                            ))}
                          </ul>
                        ) : <Insignia tono="azul">Lista para importar</Insignia>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filas.length > 200 && (
              <p className="pt-3 text-xs text-slate-500">Se muestran las primeras 200 filas de {filas.length}.</p>
            )}
          </div>
        )}
      </Tarjeta>
    </div>
  )
}
