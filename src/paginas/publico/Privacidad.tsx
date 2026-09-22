// Política de tratamiento de datos personales.
import { Tarjeta } from '../../componentes/ui'

export function Privacidad() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Tarjeta titulo="Política de privacidad y tratamiento de datos personales">
        <div className="flex flex-col gap-4 text-sm leading-relaxed text-slate-700">
          <p>
            La Ilustre Municipalidad de Tocopilla, RUT 69.030.100-0, con domicilio en la comuna de Tocopilla,
            Región de Antofagasta, es la responsable del tratamiento de los datos personales que usted entrega
            en esta plataforma.
          </p>

          <h3 className="text-base font-bold text-marino-900">1. Finalidad</h3>
          <p>
            Los datos se recopilan con el único fin de gestionar la inscripción, revisión, aprobación y entrega
            de los regalos de Navidad 2026 a niñas y niños de la comuna, y de elaborar estadísticas agregadas
            del programa.
          </p>

          <h3 className="text-base font-bold text-marino-900">2. Datos que se tratan</h3>
          <p>
            Identificación del tutor o tutora (nombre, RUT o documento extranjero, domicilio, teléfono y correo),
            identificación de la niña o niño, fecha de nacimiento, sexo, condición de discapacidad cuando se
            declara, tramo del Registro Social de Hogares y los documentos que usted adjunte.
          </p>

          <h3 className="text-base font-bold text-marino-900">3. Base legal</h3>
          <p>
            El tratamiento se realiza conforme a la Ley N° 19.628 sobre Protección de la Vida Privada y a la
            Ley N° 21.719 que regula la protección y el tratamiento de datos personales, en el ejercicio de las
            funciones municipales de asistencia social establecidas en la Ley N° 18.695, Orgánica Constitucional
            de Municipalidades. Su consentimiento expreso se solicita al momento de la inscripción.
          </p>

          <h3 className="text-base font-bold text-marino-900">4. Conservación y seguridad</h3>
          <p>
            Los documentos se almacenan cifrados en un repositorio privado, accesible solo mediante enlaces
            temporales y exclusivamente por personal municipal autorizado. Cada acceso, cambio de estado y
            entrega queda registrado en una bitácora de auditoría. Los antecedentes se conservan mientras dure
            el proceso y por el plazo que exige la normativa de rendición municipal.
          </p>

          <h3 className="text-base font-bold text-marino-900">5. Derechos de las personas</h3>
          <p>
            Usted puede solicitar el acceso, la rectificación, la cancelación o la oposición al tratamiento de
            sus datos y de los de la niña o niño a su cargo, dirigiéndose a la Dirección de Desarrollo
            Comunitario de la Municipalidad de Tocopilla o a través de la Oficina de Partes.
          </p>

          <h3 className="text-base font-bold text-marino-900">6. No cesión a terceros</h3>
          <p>
            Los datos no se comunican a terceros ajenos al programa, salvo requerimiento de un órgano
            jurisdiccional o de la Contraloría General de la República en el ejercicio de sus atribuciones.
          </p>
        </div>
      </Tarjeta>
    </div>
  )
}
