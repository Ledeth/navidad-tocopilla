// ============================================================================
//  Carga y lectura de documentos en el bucket PRIVADO "documentos".
//  Ruta: /{tutor_id}/{beneficiario_id}/{tipo}-{timestamp}.{ext}
//  El acceso siempre es por URL firmada de corta duración.
// ============================================================================
import { supabase } from './supabase'
import { marcaTiempo } from './formato'
import { validarArchivo } from './validaciones'
import type { Documento, TipoDocumento } from './tipos'

export const BUCKET = 'documentos'
const DURACION_URL_FIRMADA = 300 // 5 minutos

const EXTENSIONES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}

interface ParametrosSubida {
  archivo: File
  tipo: TipoDocumento
  tutorId: string
  beneficiarioId?: string | null
  perfilId?: string | null
}

/** Sube un archivo al bucket privado y registra sus metadatos. */
export async function subirDocumento({
  archivo, tipo, tutorId, beneficiarioId = null, perfilId = null,
}: ParametrosSubida): Promise<Documento> {
  const problema = validarArchivo(archivo)
  if (problema) throw new Error(problema)

  const extension = EXTENSIONES[archivo.type]
  const carpeta = beneficiarioId ? `${tutorId}/${beneficiarioId}` : `${tutorId}/tutor`
  const ruta = `${carpeta}/${tipo}-${marcaTiempo()}.${extension}`

  const { error: errorSubida } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false })
  if (errorSubida) throw errorSubida

  const { data, error } = await supabase
    .from('documentos')
    .insert({
      tutor_id: tutorId,
      beneficiario_id: beneficiarioId,
      tipo,
      ruta,
      nombre_original: archivo.name.slice(0, 120),
      mime: archivo.type,
      tamano_bytes: archivo.size,
      subido_por: perfilId,
    })
    .select()
    .single()

  if (error) {
    // Si falla el registro, se retira el archivo para no dejar huérfanos.
    await supabase.storage.from(BUCKET).remove([ruta])
    throw error
  }
  return data as Documento
}

/** URL firmada de corta duración para previsualizar o descargar. */
export async function urlFirmada(ruta: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(ruta, DURACION_URL_FIRMADA)
  if (error) throw error
  return data.signedUrl
}

/** Elimina el archivo y su registro. */
export async function eliminarDocumento(documento: Documento): Promise<void> {
  const { error } = await supabase.from('documentos').delete().eq('id', documento.id)
  if (error) throw error
  await supabase.storage.from(BUCKET).remove([documento.ruta])
}

export async function documentosDeTutor(tutorId: string): Promise<Documento[]> {
  const { data, error } = await supabase
    .from('documentos')
    .select('*')
    .eq('tutor_id', tutorId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Documento[]
}
