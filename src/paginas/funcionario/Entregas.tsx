// ============================================================================
//  Registro de entrega del regalo: búsqueda por folio, RUT o nombre y, cuando
//  el navegador lo permite, lectura del código QR con la cámara.
//  La restricción UNIQUE de la tabla "entregas" impide la doble entrega.
// ============================================================================
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, mensajeError } from '../../lib/supabase'
import { buscarPostulaciones, todasLasPostulaciones, FILTROS_VACIOS } from '../../lib/consultas'
import { ETIQUETA_SEXO, fechaHora } from '../../lib/formato'
import { formatearRut } from '../../lib/rut'
import { descargarExcel } from '../../lib/excel'
import { useSesion } from '../../contexto/SesionProvider'
import { useNotificacion } from '../../contexto/NotificacionProvider'
import {
  Alerta, Boton, Campo, Entrada, Indicador, Insignia, InsigniaEstado, Tarjeta, Vacio,
} from '../../componentes/ui'
import type { FilaPostulacion } from '../../lib/tipos'

// API nativa de lectura de códigos (Chrome, Edge y Android). Si no existe, se
// usa solo la búsqueda manual por folio.
interface DetectorCodigos {
  detect: (fuente: CanvasImageSource) => Promise<{ rawValue: string }[]>
}
declare global {
  interface Window {
    BarcodeDetector?: new (opciones?: { formats?: string[] }) => DetectorCodigos
  }
}

export function Entregas() {
  const { perfil } = useSesion()
  const { exito, error: avisarError } = useNotificacion()

  const [termino, setTermino] = useState('')
  const [resultados, setResultados] = useState<FilaPostulacion[]>([])
  const [buscando, setBuscando] = useState(false)
  const [entregadosHoy, setEntregadosHoy] = useState<FilaPostulacion[]>([])
  const [escaneando, setEscaneando] = useState(false)
  const [errorCamara, setErrorCamara] = useState('')

  const video = useRef<HTMLVideoElement>(null)
  const flujo = useRef<MediaStream | null>(null)
  const animacion = useRef<number | null>(null)

  const cargarEntregados = useCallback(async () => {
    try {
      const todas = await todasLasPostulaciones({ ...FILTROS_VACIOS, entregado: 'si' })
      const hoy = new Date().toISOString().slice(0, 10)
      setEntregadosHoy(todas.filter((f) => (f.entregado_at ?? '').slice(0, 10) === hoy))
    } catch (e) {
      avisarError(mensajeError(e))
    }
  }, [avisarError])

  useEffect(() => { void cargarEntregados() }, [cargarEntregados])

  const buscar = useCallback(async (texto: string) => {
    const limpio = texto.trim()
    if (limpio.length < 3) { avisarError('Escriba al menos 3 caracteres, o escanee el código QR.'); return }
    setBuscando(true)
    try {
      const { filas } = await buscarPostulaciones({ ...FILTROS_VACIOS, busqueda: limpio }, 1, 20)
      setResultados(filas)
      if (!filas.length) avisarError('No se encontraron beneficiarios con ese dato.')
    } catch (e) {
      avisarError(mensajeError(e))
    } finally {
      setBuscando(false)
    }
  }, [avisarError])

  const detener = useCallback(() => {
    if (animacion.current) cancelAnimationFrame(animacion.current)
    animacion.current = null
    flujo.current?.getTracks().forEach((t) => t.stop())
    flujo.current = null
    setEscaneando(false)
  }, [])

  useEffect(() => detener, [detener])

  const escanear = async () => {
    setErrorCamara('')
    if (!window.BarcodeDetector) {
      setErrorCamara(
        'Su navegador no permite leer códigos QR con la cámara. Use un lector externo o escriba el folio a mano.',
      )
      return
    }
    try {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
      flujo.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      setEscaneando(true)
      if (video.current) {
        video.current.srcObject = flujo.current
        await video.current.play()
      }
      const revisar = async () => {
        if (!video.current || !flujo.current) return
        try {
          const codigos = await detector.detect(video.current)
          if (codigos.length) {
            const folio = codigos[0].rawValue.trim()
            detener()
            setTermino(folio)
            await buscar(folio)
            return
          }
        } catch { /* fotograma sin código legible */ }
        animacion.current = requestAnimationFrame(() => void revisar())
      }
      animacion.current = requestAnimationFrame(() => void revisar())
    } catch {
      setErrorCamara('No pudimos acceder a la cámara. Revise los permisos del navegador.')
      detener()
    }
  }

  const registrar = async (fila: FilaPostulacion) => {
    if (fila.estado !== 'aprobado') { avisarError('Solo se entregan regalos de postulaciones aprobadas.'); return }
    if (fila.entregado) { avisarError('Este regalo ya fue entregado.'); return }
    if (!window.confirm(`¿Confirmar la entrega del regalo de ${fila.beneficiario_nombre}?`)) return
    try {
      const { error } = await supabase.from('entregas').insert({
        beneficiario_id: fila.beneficiario_id,
        entregado_por: perfil?.id ?? null,
        entregado_nombre: perfil?.nombre ?? '',
      })
      if (error) throw error
      exito(`Entrega registrada para ${fila.beneficiario_nombre}.`)
      await buscar(termino || fila.folio || fila.beneficiario_rut)
      await cargarEntregados()
    } catch (e) {
      avisarError(mensajeError(e))
    }
  }

  const exportarEntregas = async () => {
    try {
      const todas = await todasLasPostulaciones({ ...FILTROS_VACIOS, entregado: 'si' })
      await descargarExcel([{
        nombre: 'Entregas',
        filas: todas.map((f) => ({
          'Folio': f.folio ?? '',
          'Beneficiario': f.beneficiario_nombre,
          'RUT': formatearRut(f.beneficiario_rut),
          'Tutor': f.tutor_nombre,
          'Fecha de entrega': fechaHora(f.entregado_at),
        })),
      }], 'entregas-navidad-2026.xlsx')
    } catch (e) {
      avisarError(mensajeError(e))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Tarjeta
        titulo="Registro de entrega de regalos"
        descripcion="Busque por folio, RUT o nombre, o escanee el código QR de la ficha de retiro."
        acciones={<Boton variante="secundario" onClick={exportarEntregas}>Exportar entregas</Boton>}
      >
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={(e) => { e.preventDefault(); void buscar(termino) }}>
          <div className="flex-1">
            <Campo etiqueta="Folio, RUT o nombre" htmlFor="buscar-entrega">
              <Entrada id="buscar-entrega" value={termino} autoFocus
                       placeholder="NAV-2026-000001" onChange={(e) => setTermino(e.target.value)} />
            </Campo>
          </div>
          <Boton type="submit" cargando={buscando}>Buscar</Boton>
          {!escaneando ? (
            <Boton variante="secundario" type="button" onClick={escanear}>Escanear QR</Boton>
          ) : (
            <Boton variante="peligro" type="button" onClick={detener}>Detener cámara</Boton>
          )}
        </form>

        {errorCamara && <div className="mt-3"><Alerta tipo="aviso">{errorCamara}</Alerta></div>}

        {escaneando && (
          <div className="mt-4">
            <video ref={video} muted playsInline
                   className="mx-auto w-full max-w-md rounded-xl border-2 border-marino-300" />
            <p className="mt-2 text-center text-xs text-slate-600">
              Apunte la cámara al código QR de la ficha de retiro.
            </p>
          </div>
        )}
      </Tarjeta>

      <Tarjeta titulo="Resultados de la búsqueda">
        {!resultados.length ? <Vacio mensaje="Realice una búsqueda para ver resultados." /> : (
          <ul className="flex flex-col gap-3">
            {resultados.map((f) => (
              <li key={f.beneficiario_id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-marino-900">{f.beneficiario_nombre}</p>
                  <p className="text-sm text-slate-600">
                    {formatearRut(f.beneficiario_rut)} · {f.edad} años · {ETIQUETA_SEXO[f.sexo]}
                  </p>
                  <p className="text-sm text-slate-600">Tutor: {f.tutor_nombre}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <InsigniaEstado estado={f.estado} />
                    {f.folio && <Insignia tono="azul">{f.folio}</Insignia>}
                    {f.entregado && <Insignia tono="verde">Entregado el {fechaHora(f.entregado_at)}</Insignia>}
                  </p>
                </div>
                <Boton onClick={() => registrar(f)} disabled={f.entregado || f.estado !== 'aprobado'}>
                  {f.entregado ? 'Ya entregado' : 'Registrar entrega'}
                </Boton>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      <Tarjeta titulo="Entregas registradas hoy">
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Indicador etiqueta="Entregas de hoy" valor={entregadosHoy.length} tono="verde" />
        </div>
        {!entregadosHoy.length ? <Vacio mensaje="Todavía no hay entregas registradas hoy." /> : (
          <ul className="flex flex-col gap-2 text-sm">
            {entregadosHoy.map((f) => (
              <li key={f.beneficiario_id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 p-3">
                <span className="font-semibold text-marino-900">{f.beneficiario_nombre}</span>
                <span className="text-slate-600">{f.folio} · {fechaHora(f.entregado_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  )
}
