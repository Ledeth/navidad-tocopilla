// Tipos compartidos del dominio.

export type Rol = 'tutor' | 'funcionario' | 'admin'
export type Nacionalidad = 'chilena' | 'extranjera'
export type Sexo = 'femenino' | 'masculino' | 'otro'
export type Estado = 'pendiente' | 'aprobado' | 'rechazado' | 'observado'
export type TipoDocumento = 'rsh' | 'identidad' | 'estudios' | 'discapacidad'

export interface Perfil {
  id: string
  email: string
  nombre: string
  rol: Rol
  activo: boolean
  created_at: string
}

export interface Tutor {
  id: string
  profile_id: string | null
  nombre_completo: string
  nacionalidad: Nacionalidad
  rut: string | null
  documento_extranjero: string | null
  telefono: string
  email: string
  direccion: string
  comuna: string
  tramo_rsh: number | null
  consentimiento: boolean
  created_at: string
}

export interface Beneficiario {
  id: string
  tutor_id: string
  rut: string
  nombre_completo: string
  sexo: Sexo
  fecha_nacimiento: string
  discapacidad: boolean
  observaciones: string | null
  estado: Estado
  motivo_estado: string | null
  folio: string | null
  revisado_por: string | null
  revisado_at: string | null
  created_at: string
  updated_at: string
}

export interface Documento {
  id: string
  tutor_id: string
  beneficiario_id: string | null
  tipo: TipoDocumento
  ruta: string
  nombre_original: string
  mime: string
  tamano_bytes: number
  created_at: string
}

export interface Nota {
  id: string
  beneficiario_id: string
  autor_id: string | null
  autor_nombre: string
  tipo: 'observacion' | 'opinion_profesional'
  texto: string
  created_at: string
}

export interface Entrega {
  id: string
  beneficiario_id: string
  entregado_por: string | null
  entregado_nombre: string
  entregado_at: string
  nota: string | null
}

export interface Configuracion {
  id: number
  fecha_apertura: string
  fecha_cierre: string
  edad_maxima: number
  fecha_corte_edad: string
  certificado_estudios_obligatorio: boolean
  texto_bienvenida: string
}

/** Fila de la vista v_postulaciones: beneficiario + tutor + entrega. */
export interface FilaPostulacion {
  beneficiario_id: string
  beneficiario_rut: string
  beneficiario_nombre: string
  sexo: Sexo
  fecha_nacimiento: string
  edad: number
  discapacidad: boolean
  estado: Estado
  motivo_estado: string | null
  folio: string | null
  created_at: string
  updated_at: string
  tutor_id: string
  tutor_nombre: string
  tutor_rut: string | null
  nacionalidad: Nacionalidad
  tramo_rsh: number | null
  telefono: string
  email: string
  direccion: string
  comuna: string
  entregado: boolean
  entregado_at: string | null
}

export interface AuditoriaFila {
  id: number
  tabla: string
  registro_id: string | null
  accion: string
  actor_id: string | null
  actor_email: string | null
  valor_anterior: Record<string, unknown> | null
  valor_nuevo: Record<string, unknown> | null
  created_at: string
}
