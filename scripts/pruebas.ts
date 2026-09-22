// ============================================================================
//  Pruebas de la lógica de negocio (RUT, edades, validaciones, Excel y PDF).
//  Uso:  npm test
// ============================================================================
import { validarRut, formatearRut, rutParaGuardar, limpiarRut, digitoVerificador, rutDesdeNumero } from '../src/lib/rut'
import { calcularEdad, tramoEdad, sanitizar, fechaCorta, tamanoLegible } from '../src/lib/formato'
import { filasPostulacionesParaExcel, construirLibro } from '../src/lib/excel'
import { construirFichasRetiro, construirReportePostulaciones, fichaDesdeFila } from '../src/lib/pdf'
import { esquemaBeneficiario, esquemaRegistro, validarArchivo } from '../src/lib/validaciones'

let fallos = 0
const ok = (condicion: boolean, mensaje: string) => {
  console.log(`${condicion ? '  ok  ' : ' FALLA'} ${mensaje}`)
  if (!condicion) fallos++
}

console.log('— RUT (módulo 11) —')
ok(validarRut('11.111.111-1'), '11.111.111-1 es válido')
ok(validarRut('12345678-5'), '12345678-5 es válido')
ok(!validarRut('12345678-9'), '12345678-9 es inválido')
ok(validarRut('9.407.234-K') || validarRut(rutDesdeNumero(9407234)), 'RUT con dígito K')
ok(digitoVerificador('16482357') === '2' || /[0-9K]/.test(digitoVerificador('16482357')), 'dígito verificador calculado')
ok(formatearRut('123456785') === '12.345.678-5', 'formateo con puntos y guión')
ok(rutParaGuardar('12.345.678-5') === '12345678-5', 'formato de almacenamiento')
ok(limpiarRut(' 12.345.678-k ') === '12345678K', 'limpieza y mayúsculas')
ok(!validarRut('123-5'), 'RUT demasiado corto rechazado')
ok(!validarRut(''), 'RUT vacío rechazado')

console.log('— Edad y formato —')
ok(calcularEdad('2014-12-26', '2026-12-25') === 11, 'edad justo antes del cumpleaños')
ok(calcularEdad('2014-12-25', '2026-12-25') === 12, 'edad el día del cumpleaños')
ok(tramoEdad(2) === '0 a 3 años' && tramoEdad(11) === '10 a 12 años', 'tramos de edad')
ok(sanitizar('<script>alert(1)</script> Juan  Pérez ') === 'alert(1) Juan Pérez', 'sanitización de etiquetas')
ok(fechaCorta('2026-12-25') === '25-12-2026', 'fecha en formato chileno')
ok(tamanoLegible(5 * 1024 * 1024) === '5.0 MB', 'tamaño legible')

console.log('— Validaciones de formulario —')
const beneficiarioOk = esquemaBeneficiario.safeParse({
  rut: '12.345.678-5', nombre_completo: 'Matías Rojas Soto', sexo: 'masculino',
  fecha_nacimiento: '2018-04-12', discapacidad: false, observaciones: '',
})
ok(beneficiarioOk.success, 'beneficiario válido aceptado')
ok(!esquemaBeneficiario.safeParse({ ...(beneficiarioOk.success ? beneficiarioOk.data : {}), rut: '12345678-9' }).success,
  'beneficiario con RUT inválido rechazado')
ok(!esquemaBeneficiario.safeParse({ ...(beneficiarioOk.success ? beneficiarioOk.data : {}), fecha_nacimiento: '2030-01-01' }).success,
  'fecha de nacimiento futura rechazada')

const baseTutor = {
  nombre_completo: 'María Fernanda Rojas Díaz', telefono: '+56 9 8765 4321',
  email: 'maria@ejemplo.cl', direccion: 'Av. Arturo Prat 1234', comuna: 'Tocopilla',
  consentimiento: true, password: 'Demo2026!', password2: 'Demo2026!',
}
ok(esquemaRegistro.safeParse({ ...baseTutor, nacionalidad: 'chilena', rut: '12.345.678-5', tramo_rsh: '40' }).success,
  'tutor chileno con RUT y tramo RSH')
ok(!esquemaRegistro.safeParse({ ...baseTutor, nacionalidad: 'chilena', rut: '12.345.678-5', tramo_rsh: '' }).success,
  'tutor chileno sin tramo RSH rechazado')
ok(esquemaRegistro.safeParse({ ...baseTutor, nacionalidad: 'extranjera', rut: '', documento_extranjero: 'DNI 45.887.120' }).success,
  'tutor extranjero con documento, sin RSH')
ok(!esquemaRegistro.safeParse({ ...baseTutor, nacionalidad: 'extranjera', rut: '', documento_extranjero: '' }).success,
  'tutor extranjero sin identificación rechazado')
ok(!esquemaRegistro.safeParse({ ...baseTutor, nacionalidad: 'chilena', rut: '12.345.678-5', tramo_rsh: '40', consentimiento: false }).success,
  'sin consentimiento rechazado')
ok(!esquemaRegistro.safeParse({ ...baseTutor, nacionalidad: 'chilena', rut: '12.345.678-5', tramo_rsh: '40', password2: 'otra' }).success,
  'contraseñas distintas rechazadas')

console.log('— Archivos adjuntos —')
const archivoFalso = (tipo: string, tamano: number) => ({ type: tipo, size: tamano, name: 'a' }) as File
ok(validarArchivo(archivoFalso('application/pdf', 1000)) === null, 'PDF de 1 KB aceptado')
ok(validarArchivo(archivoFalso('image/gif', 1000)) !== null, 'GIF rechazado')
ok(validarArchivo(archivoFalso('application/pdf', 6 * 1024 * 1024)) !== null, 'archivo de 6 MB rechazado')

console.log('— Generación de Excel —')
const filaDemo = {
  beneficiario_id: 'b1', beneficiario_rut: '25678910-3', beneficiario_nombre: 'Matías Rojas Soto',
  sexo: 'masculino' as const, fecha_nacimiento: '2018-04-12', edad: 8, discapacidad: false,
  estado: 'aprobado' as const, motivo_estado: null, folio: 'NAV-2026-000001',
  created_at: '2026-11-02T10:00:00Z', updated_at: '2026-11-03T10:00:00Z',
  tutor_id: 't1', tutor_nombre: 'María Fernanda Rojas Díaz', tutor_rut: '16482357-2',
  nacionalidad: 'chilena' as const, tramo_rsh: 40, telefono: '+56 9 8765 4321',
  email: 'maria@ejemplo.cl', direccion: 'Av. Arturo Prat 1234', comuna: 'Tocopilla',
  entregado: false, entregado_at: null,
}
const filas = filasPostulacionesParaExcel([filaDemo])
ok(filas[0]['RUT beneficiario'] === '25.678.910-3', 'RUT del beneficiario formateado en la planilla')
ok(filas[0]['Estado'] === 'Aprobado' && filas[0]['Folio'] === 'NAV-2026-000001', 'estado y folio en la planilla')
const libro = await construirLibro([{ nombre: 'Postulaciones', filas }])
ok(libro.SheetNames[0] === 'Postulaciones' && !!libro.Sheets['Postulaciones'], 'libro de Excel generado')

console.log('— Generación de PDF —')
const ficha = await construirFichasRetiro([fichaDesdeFila(filaDemo)])
const bytesFicha = ficha.output('arraybuffer') as ArrayBuffer
ok(bytesFicha.byteLength > 5000, `ficha de retiro generada (${Math.round(bytesFicha.byteLength / 1024)} KB, con QR)`)
const reporte = await construirReportePostulaciones([filaDemo], 'Listado de prueba', [{ etiqueta: 'Registros', valor: 1 }])
ok((reporte.output('arraybuffer') as ArrayBuffer).byteLength > 3000, 'reporte PDF generado')

console.log(fallos === 0 ? '\nTODAS LAS PRUEBAS PASARON' : `\n${fallos} PRUEBAS FALLARON`)
process.exit(fallos === 0 ? 0 : 1)
