// Portada informativa del programa (pública, sin sesión).
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useSesion } from '../../contexto/SesionProvider'
import { Alerta, Boton, Tarjeta } from '../../componentes/ui'
import { fechaCorta } from '../../lib/formato'

const PREGUNTAS = [
  {
    p: '¿Quiénes pueden postular?',
    r: 'Tutoras y tutores residentes en la comuna de Tocopilla que tengan a su cargo niñas y niños dentro del rango de edad definido para el proceso. Pueden postular tanto familias chilenas como extranjeras.',
  },
  {
    p: '¿Necesito el Registro Social de Hogares?',
    r: 'Las familias chilenas deben adjuntar su cartola del Registro Social de Hogares e indicar su tramo. Las familias extranjeras no requieren este documento y pueden identificarse con su RUT chileno o con su documento de identidad extranjero.',
  },
  {
    p: '¿Cuántos niños y niñas puedo inscribir?',
    r: 'Todos los que estén a su cargo y cumplan los requisitos. Cada niña o niño se registra una sola vez en el proceso: no puede ser inscrito por dos tutores distintos.',
  },
  {
    p: '¿Qué pasa si mi postulación queda “con observación”?',
    r: 'Verá en su panel el motivo indicado por la funcionaria o el funcionario municipal. Puede corregir los datos o volver a adjuntar los documentos y reenviar; su postulación volverá al estado “Pendiente de revisión”.',
  },
  {
    p: '¿Cómo retiro el regalo?',
    r: 'Al ser aprobada la postulación se genera una ficha de retiro con un folio único y un código QR. Preséntela junto a su cédula de identidad en el lugar y fecha que informe la Municipalidad.',
  },
  {
    p: '¿Qué pasa con mis datos personales?',
    r: 'Se tratan únicamente para gestionar esta entrega, conforme a la Ley N° 19.628 y la Ley N° 21.719. Puede revisar el detalle en nuestra política de privacidad.',
  },
]

export function Portada() {
  const { configuracion, postulacionAbierta, sesion, perfil } = useSesion()
  const [abierta, setAbierta] = useState<number | null>(0)

  const destinoPanel = perfil?.rol === 'tutor' ? '/tutor' : '/panel'
  // Mientras no se conozca la configuración del proceso no se inventan fechas.
  const fecha = (valor: string | undefined) => (valor ? fechaCorta(valor) : 'Por confirmar')

  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden rounded-2xl bg-marino-800 text-white">
        <div className="grid gap-6 px-6 py-8 sm:px-10 sm:py-12 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-marino-200">
              Dirección de Desarrollo Comunitario
            </p>
            <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-4xl">
              Inscripción para la entrega de regalos de Navidad 2026
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-marino-100 sm:text-base">
              {configuracion?.texto_bienvenida ??
                'Bienvenido y bienvenida al proceso de inscripción para la entrega de regalos de Navidad de la Ilustre Municipalidad de Tocopilla.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {sesion ? (
                <Link to={destinoPanel}>
                  <Boton>Ir a mi panel</Boton>
                </Link>
              ) : (
                <>
                  <Link to="/registro">
                    <Boton variante="peligro">Inscribirme</Boton>
                  </Link>
                  <Link to="/ingresar">
                    <Boton variante="secundario">Ya tengo cuenta</Boton>
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="rounded-xl bg-white/10 p-5 text-sm">
            <h2 className="text-base font-bold">Fechas del proceso</h2>
            <dl className="mt-3 space-y-2">
              <div className="flex justify-between gap-4">
                <dt className="text-marino-200">Apertura</dt>
                <dd className="font-semibold">{fecha(configuracion?.fecha_apertura)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-marino-200">Cierre</dt>
                <dd className="font-semibold">{fecha(configuracion?.fecha_cierre)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-marino-200">Edad máxima</dt>
                <dd className="font-semibold">
                  {configuracion?.edad_maxima ?? 12} años al {fecha(configuracion?.fecha_corte_edad)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {!postulacionAbierta && (
        <Alerta tipo="aviso" titulo="El proceso de postulación está cerrado">
          Las inscripciones se reciben entre el {fecha(configuracion?.fecha_apertura)} y el{' '}
          {fecha(configuracion?.fecha_cierre)}. Si ya postuló, puede ingresar para revisar el estado de su
          solicitud.
        </Alerta>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta titulo="Requisitos" descripcion="Antes de comenzar, tenga a mano lo siguiente.">
          <ul className="flex flex-col gap-3 text-sm text-slate-700">
            <li className="flex gap-3">
              <span aria-hidden="true">1.</span>
              <span>Ser tutora o tutor de la niña o niño que inscribe y residir en la comuna de Tocopilla.</span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true">2.</span>
              <span>
                Que la niña o niño tenga hasta {configuracion?.edad_maxima ?? 12} años cumplidos al{' '}
                {fecha(configuracion?.fecha_corte_edad)}.
              </span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true">3.</span>
              <span>Un correo electrónico y un teléfono de contacto vigentes.</span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true">4.</span>
              <span>Los documentos escaneados o fotografiados con buena luz (PDF, JPG o PNG, hasta 5 MB cada uno).</span>
            </li>
          </ul>
        </Tarjeta>

        <Tarjeta titulo="Documentos necesarios" descripcion="Se adjuntan durante la inscripción.">
          <ul className="flex flex-col gap-3 text-sm text-slate-700">
            <li>
              <p className="font-semibold text-marino-900">Cartola del Registro Social de Hogares</p>
              <p>Obligatoria para tutoras y tutores chilenos. Además debe indicar su tramo (40% a 100%).</p>
            </li>
            <li>
              <p className="font-semibold text-marino-900">Cédula de identidad o certificado de nacimiento</p>
              <p>De cada niña o niño que inscriba. Obligatorio.</p>
            </li>
            <li>
              <p className="font-semibold text-marino-900">Certificado de estudios</p>
              <p>
                {configuracion?.certificado_estudios_obligatorio
                  ? 'Obligatorio en este proceso.'
                  : 'Opcional en este proceso.'}
              </p>
            </li>
            <li>
              <p className="font-semibold text-marino-900">Credencial o certificado de discapacidad</p>
              <p>Obligatorio solo si declara condición de discapacidad.</p>
            </li>
          </ul>
        </Tarjeta>
      </div>

      <Tarjeta titulo="Preguntas frecuentes">
        <ul className="divide-y divide-slate-100">
          {PREGUNTAS.map((item, i) => (
            <li key={item.p} className="py-2">
              <h3>
                <button
                  onClick={() => setAbierta(abierta === i ? null : i)}
                  aria-expanded={abierta === i}
                  className="flex w-full items-center justify-between gap-4 py-2 text-left text-sm font-semibold text-marino-900"
                >
                  {item.p}
                  <span aria-hidden="true" className="text-lg text-marino-500">{abierta === i ? '–' : '+'}</span>
                </button>
              </h3>
              {abierta === i && <p className="pb-2 text-sm text-slate-700">{item.r}</p>}
            </li>
          ))}
        </ul>
      </Tarjeta>
    </div>
  )
}
