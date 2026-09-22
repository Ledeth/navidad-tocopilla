// ============================================================================
//  Configuración del proceso + respaldo completo de la base de datos.
// ============================================================================
import { useEffect, useState, type FormEvent } from 'react'
import { supabase, mensajeError } from '../../lib/supabase'
import { descargarExcel } from '../../lib/excel'
import { fechaCorta } from '../../lib/formato'
import { useSesion } from '../../contexto/SesionProvider'
import { useNotificacion } from '../../contexto/NotificacionProvider'
import { Alerta, AreaTexto, Boton, Campo, Cargando, Entrada, Selector, Tarjeta } from '../../componentes/ui'
import type { Configuracion as Config } from '../../lib/tipos'

const TABLAS_RESPALDO = [
  'profiles', 'tutores', 'beneficiarios', 'documentos', 'observaciones', 'entregas', 'configuracion',
]

export function Configuracion() {
  const { configuracion, refrescarConfiguracion } = useSesion()
  const { exito, error: avisarError } = useNotificacion()

  const [borrador, setBorrador] = useState<Config | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [respaldando, setRespaldando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (configuracion) setBorrador(configuracion) }, [configuracion])

  if (!borrador) return <Cargando />

  const actualizar = <K extends keyof Config>(clave: K, valor: Config[K]) =>
    setBorrador((prev) => (prev ? { ...prev, [clave]: valor } : prev))

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (borrador.fecha_cierre < borrador.fecha_apertura) {
      setError('La fecha de cierre no puede ser anterior a la de apertura.')
      return
    }
    if (borrador.edad_maxima < 1 || borrador.edad_maxima > 30) {
      setError('La edad máxima debe estar entre 1 y 30 años.')
      return
    }
    setGuardando(true)
    try {
      const { error: errorGuardar } = await supabase
        .from('configuracion')
        .update({
          fecha_apertura: borrador.fecha_apertura,
          fecha_cierre: borrador.fecha_cierre,
          edad_maxima: borrador.edad_maxima,
          fecha_corte_edad: borrador.fecha_corte_edad,
          certificado_estudios_obligatorio: borrador.certificado_estudios_obligatorio,
          texto_bienvenida: borrador.texto_bienvenida,
        })
        .eq('id', 1)
      if (errorGuardar) throw errorGuardar
      await refrescarConfiguracion()
      exito('Configuración guardada.')
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setGuardando(false)
    }
  }

  /** Respaldo: una hoja de Excel por tabla. */
  const respaldar = async () => {
    setRespaldando(true)
    try {
      const hojas: { nombre: string; filas: Record<string, string | number | boolean | null>[] }[] = []
      for (const tabla of TABLAS_RESPALDO) {
        const { data, error: errorTabla } = await supabase.from(tabla).select('*').limit(10000)
        if (errorTabla) throw errorTabla
        hojas.push({
          nombre: tabla,
          filas: (data ?? []).map((fila: Record<string, unknown>) =>
            Object.fromEntries(
              Object.entries(fila).map(([k, v]) => [
                k,
                v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : (v as string | number | boolean),
              ]),
            ),
          ),
        })
      }
      const fecha = new Date().toISOString().slice(0, 10)
      await descargarExcel(hojas, `respaldo-navidad-2026-${fecha}.xlsx`)
      exito('Respaldo generado.')
    } catch (e) {
      avisarError(mensajeError(e))
    } finally {
      setRespaldando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Tarjeta titulo="Configuración del proceso"
               descripcion="Estas reglas se aplican al formulario público y a la validación en el servidor.">
        <form onSubmit={guardar} className="flex flex-col gap-5">
          {error && <Alerta tipo="error">{error}</Alerta>}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Apertura de postulaciones" requerido htmlFor="apertura">
              <Entrada id="apertura" type="date" value={borrador.fecha_apertura}
                       onChange={(e) => actualizar('fecha_apertura', e.target.value)} />
            </Campo>
            <Campo etiqueta="Cierre de postulaciones" requerido htmlFor="cierre">
              <Entrada id="cierre" type="date" value={borrador.fecha_cierre}
                       onChange={(e) => actualizar('fecha_cierre', e.target.value)} />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Edad máxima para postular" requerido htmlFor="edad"
                   ayuda="En años cumplidos a la fecha de corte.">
              <Entrada id="edad" type="number" min={1} max={30} value={borrador.edad_maxima}
                       onChange={(e) => actualizar('edad_maxima', Number(e.target.value))} />
            </Campo>
            <Campo etiqueta="Fecha de corte de edad" requerido htmlFor="corte">
              <Entrada id="corte" type="date" value={borrador.fecha_corte_edad}
                       onChange={(e) => actualizar('fecha_corte_edad', e.target.value)} />
            </Campo>
          </div>

          <Campo etiqueta="Certificado de estudios" htmlFor="estudios"
                 ayuda="Define si el certificado es obligatorio al inscribir a cada beneficiario.">
            <Selector id="estudios" value={borrador.certificado_estudios_obligatorio ? 'si' : 'no'}
                      onChange={(e) => actualizar('certificado_estudios_obligatorio', e.target.value === 'si')}>
              <option value="no">Opcional</option>
              <option value="si">Obligatorio</option>
            </Selector>
          </Campo>

          <Campo etiqueta="Texto de bienvenida" htmlFor="bienvenida"
                 ayuda="Se muestra en la portada pública del programa.">
            <AreaTexto id="bienvenida" value={borrador.texto_bienvenida} maxLength={600}
                       onChange={(e) => actualizar('texto_bienvenida', e.target.value)} />
          </Campo>

          <p className="text-xs text-slate-500">
            Fuera del período {fechaCorta(borrador.fecha_apertura)} – {fechaCorta(borrador.fecha_cierre)} el
            formulario público muestra un aviso y no permite inscribir.
          </p>

          <Boton type="submit" cargando={guardando} className="sm:w-56">Guardar configuración</Boton>
        </form>
      </Tarjeta>

      <Tarjeta titulo="Respaldo de la base de datos"
               descripcion="Descarga un archivo Excel con una hoja por tabla (sin los archivos adjuntos)."
               acciones={<Boton cargando={respaldando} onClick={respaldar}>Descargar respaldo</Boton>}>
        <p className="text-sm text-slate-600">
          El respaldo incluye: {TABLAS_RESPALDO.join(', ')}. Los documentos adjuntos permanecen en el bucket
          privado de Supabase Storage y se respaldan desde la consola de Supabase.
        </p>
      </Tarjeta>
    </div>
  )
}
