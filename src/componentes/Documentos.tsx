// ============================================================================
//  Listado y previsualización de documentos del bucket privado.
//  La vista previa usa una URL firmada de 5 minutos: nunca se expone el archivo.
// ============================================================================
import { useState } from 'react'
import { eliminarDocumento, urlFirmada } from '../lib/documentos'
import { ETIQUETA_DOCUMENTO, fechaHora, tamanoLegible } from '../lib/formato'
import { mensajeError } from '../lib/supabase'
import { useNotificacion } from '../contexto/NotificacionProvider'
import { Boton, Insignia, Modal, Vacio } from './ui'
import type { Documento } from '../lib/tipos'

export function ListaDocumentos({ documentos, onEliminar, permitirEliminar = false }: {
  documentos: Documento[]
  onEliminar?: () => void
  permitirEliminar?: boolean
}) {
  const { error: avisarError } = useNotificacion()
  const [verDocumento, setVerDocumento] = useState<{ doc: Documento; url: string } | null>(null)
  const [cargandoId, setCargandoId] = useState<string | null>(null)

  const previsualizar = async (doc: Documento) => {
    setCargandoId(doc.id)
    try {
      setVerDocumento({ doc, url: await urlFirmada(doc.ruta) })
    } catch (e) {
      avisarError(mensajeError(e))
    } finally {
      setCargandoId(null)
    }
  }

  const borrar = async (doc: Documento) => {
    if (!window.confirm(`¿Eliminar el documento "${doc.nombre_original}"?`)) return
    try {
      await eliminarDocumento(doc)
      onEliminar?.()
    } catch (e) {
      avisarError(mensajeError(e))
    }
  }

  if (!documentos.length) return <Vacio mensaje="No hay documentos adjuntos." />

  return (
    <>
      <ul className="flex flex-col gap-2">
        {documentos.map((d) => (
          <li key={d.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-marino-900">
                {ETIQUETA_DOCUMENTO[d.tipo]}
                <Insignia tono="azul">{d.mime === 'application/pdf' ? 'PDF' : 'Imagen'}</Insignia>
              </p>
              <p className="truncate text-xs text-slate-500">
                {d.nombre_original} · {tamanoLegible(d.tamano_bytes)} · {fechaHora(d.created_at)}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Boton variante="secundario" cargando={cargandoId === d.id} onClick={() => previsualizar(d)}>
                Ver
              </Boton>
              {permitirEliminar && (
                <Boton variante="peligro" onClick={() => borrar(d)}>Eliminar</Boton>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Modal
        abierto={!!verDocumento}
        titulo={verDocumento ? ETIQUETA_DOCUMENTO[verDocumento.doc.tipo] : ''}
        onCerrar={() => setVerDocumento(null)}
        ancho="max-w-4xl"
      >
        {verDocumento && (
          <div className="flex flex-col gap-3">
            {verDocumento.doc.mime === 'application/pdf' ? (
              <iframe
                title={`Vista previa de ${verDocumento.doc.nombre_original}`}
                src={verDocumento.url}
                className="h-[70vh] w-full rounded-lg border border-slate-200"
              />
            ) : (
              <img
                src={verDocumento.url}
                alt={`Vista previa de ${verDocumento.doc.nombre_original}`}
                className="max-h-[70vh] w-full rounded-lg border border-slate-200 object-contain"
              />
            )}
            <a href={verDocumento.url} target="_blank" rel="noreferrer"
               className="text-sm font-semibold text-marino-700 underline">
              Abrir en una pestaña nueva
            </a>
          </div>
        )}
      </Modal>
    </>
  )
}
