// Esquemas de validación (zod) compartidos por los formularios.
import { z } from 'zod'
import { validarRut } from './rut'

// Mensajes por defecto de zod en español (evita textos como "Required").
z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      return { message: issue.received === 'undefined' || issue.received === 'null'
        ? 'Este campo es obligatorio.'
        : 'El valor ingresado no es válido.' }
    case z.ZodIssueCode.invalid_literal:
    case z.ZodIssueCode.invalid_enum_value:
      return { message: 'Seleccione una opción válida.' }
    case z.ZodIssueCode.too_small:
      return { message: issue.type === 'string' && issue.minimum === 1
        ? 'Este campo es obligatorio.'
        : `Debe tener al menos ${issue.minimum} caracteres.` }
    case z.ZodIssueCode.too_big:
      return { message: `Debe tener como máximo ${issue.maximum} caracteres.` }
    case z.ZodIssueCode.invalid_string:
      return { message: issue.validation === 'email'
        ? 'Ingrese un correo electrónico válido.'
        : 'El formato ingresado no es válido.' }
    default:
      return { message: ctx.defaultError }
  }
})

const textoRequerido = (min: number, campo: string) =>
  z.string().trim().min(min, `Ingrese ${campo}.`)

export const MIMES_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png']
export const TAMANO_MAXIMO = 5 * 1024 * 1024 // 5 MB

/** Valida un archivo adjunto en el cliente (el servidor vuelve a validar). */
export function validarArchivo(archivo: File): string | null {
  if (!MIMES_PERMITIDOS.includes(archivo.type)) {
    return 'El archivo debe ser PDF, JPG o PNG.'
  }
  if (archivo.size > TAMANO_MAXIMO) {
    return 'El archivo supera el tamaño máximo de 5 MB.'
  }
  if (archivo.size === 0) return 'El archivo está vacío.'
  return null
}

const objetoTutor = z.object({
  nombre_completo: textoRequerido(5, 'su nombre completo'),
  nacionalidad: z.enum(['chilena', 'extranjera'], { message: 'Seleccione su nacionalidad.' }),
  rut: z.string().trim().optional().or(z.literal('')),
  documento_extranjero: z.string().trim().optional().or(z.literal('')),
  telefono: z
    .string()
    .trim()
    .min(8, 'Ingrese un teléfono de contacto válido.')
    .regex(/^[0-9+\s()-]{8,20}$/, 'El teléfono solo puede tener números, espacios, +, ( ) o -.'),
  email: z.string().trim().email('Ingrese un correo electrónico válido.'),
  direccion: textoRequerido(5, 'su dirección'),
  comuna: textoRequerido(3, 'su comuna'),
  tramo_rsh: z.string().optional().or(z.literal('')),
  consentimiento: z.boolean().refine((v) => v === true, {
    message: 'Debe aceptar el tratamiento de sus datos personales para continuar.',
  }),
})

/** Reglas cruzadas según nacionalidad (RUT / documento extranjero / tramo RSH). */
function refinarTutor(
  valores: { nacionalidad: 'chilena' | 'extranjera'; rut?: string; tramo_rsh?: string; documento_extranjero?: string },
  ctx: z.RefinementCtx,
): void {
  if (valores.nacionalidad === 'chilena') {
    if (!valores.rut || !validarRut(valores.rut)) {
      ctx.addIssue({ code: 'custom', path: ['rut'], message: 'Ingrese un RUT válido (con dígito verificador).' })
    }
    if (!valores.tramo_rsh) {
      ctx.addIssue({ code: 'custom', path: ['tramo_rsh'], message: 'Seleccione su tramo del Registro Social de Hogares.' })
    }
  } else {
    const tieneRut = Boolean(valores.rut && valores.rut.trim())
    const tieneDoc = Boolean(valores.documento_extranjero && valores.documento_extranjero.trim())
    if (!tieneRut && !tieneDoc) {
      ctx.addIssue({
        code: 'custom',
        path: ['documento_extranjero'],
        message: 'Ingrese su RUT chileno o su documento de identidad extranjero.',
      })
    }
    if (tieneRut && !validarRut(valores.rut as string)) {
      ctx.addIssue({ code: 'custom', path: ['rut'], message: 'El RUT ingresado no es válido.' })
    }
  }
}

export const esquemaTutor = objetoTutor.superRefine(refinarTutor)
export type DatosTutor = z.infer<typeof esquemaTutor>

/** Registro público: datos del tutor + credenciales de acceso. */
export const esquemaRegistro = objetoTutor
  .extend({
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
    password2: z.string().min(1, 'Repita la contraseña.'),
  })
  .superRefine((valores, ctx) => {
    refinarTutor(valores, ctx)
    if (valores.password !== valores.password2) {
      ctx.addIssue({ code: 'custom', path: ['password2'], message: 'Las contraseñas no coinciden.' })
    }
  })

export type DatosRegistro = z.infer<typeof esquemaRegistro>

export const esquemaBeneficiario = z.object({
  rut: z.string().trim().refine(validarRut, 'Ingrese un RUT válido (con dígito verificador).'),
  nombre_completo: textoRequerido(5, 'el nombre completo del beneficiario'),
  sexo: z.enum(['femenino', 'masculino', 'otro'], { message: 'Seleccione el sexo.' }),
  fecha_nacimiento: z
    .string()
    .min(10, 'Ingrese la fecha de nacimiento.')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Fecha de nacimiento inválida.')
    .refine((v) => new Date(v) <= new Date(), 'La fecha de nacimiento no puede ser futura.'),
  discapacidad: z.boolean().default(false),
  observaciones: z.string().trim().max(600, 'Máximo 600 caracteres.').optional().or(z.literal('')),
})

export type DatosBeneficiario = z.infer<typeof esquemaBeneficiario>

export const esquemaUsuarioInterno = z.object({
  nombre: textoRequerido(3, 'el nombre del usuario'),
  email: z.string().trim().email('Ingrese un correo electrónico válido.'),
  rol: z.enum(['funcionario', 'admin'], { message: 'Seleccione el rol.' }),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.').optional().or(z.literal('')),
})
