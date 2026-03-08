import Link from 'next/link'

export const metadata = {
  title: 'Términos y Condiciones de Uso | Control Finanzas',
  description:
    'Términos y condiciones que rigen el uso de la plataforma Control Finanzas para la gestión de cartera de crédito.',
}

export default function TerminosUsoPage() {
  return (
    <div className="min-h-dvh bg-gray-950 text-white">
      {/* Top bar */}
      <div className="border-b border-gray-800 bg-gray-950 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver al inicio
          </Link>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12 md:py-16">
        {/* Page header */}
        <div className="mb-12">
          <p className="text-xs font-medium text-[#1e3a5f] uppercase tracking-widest mb-3">Documento legal</p>
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-4">
            Términos y Condiciones de Uso
          </h1>
          <p className="text-sm text-gray-500">
            Ultima actualizacion: 8 de marzo de 2026
          </p>
        </div>

        {/* Intro paragraph */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-12">
          <p className="text-sm text-gray-300 leading-relaxed">
            El presente documento establece los terminos y condiciones que regulan el acceso y uso de la plataforma
            Control Finanzas, operada por Control Finanzas SAS (en adelante, "la Empresa"). Lea detenidamente este
            documento antes de utilizar el servicio. Si no esta de acuerdo con alguna de estas condiciones, le
            pedimos que se abstenga de registrarse o continuar usando la plataforma.
          </p>
        </div>

        <div className="space-y-10">

          {/* 1. Aceptacion */}
          <section>
            <h2 className="text-lg font-semibold text-white pb-3 border-b border-gray-800 mb-5">
              1. Aceptacion de los Terminos
            </h2>
            <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
              <p>
                Al completar el proceso de registro en Control Finanzas, el usuario declara haber leido,
                comprendido y aceptado en su totalidad los presentes Terminos y Condiciones de Uso, asi como
                la Politica de Privacidad de la plataforma, la cual se encuentra disponible en
                {' '}<Link href="/privacidad" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
                  control-finanzas.com/privacidad
                </Link>.
              </p>
              <p>
                Esta aceptacion tiene caracter contractual entre el usuario y la Empresa. Si el usuario actua en
                nombre de una organizacion o persona juridica, declara tener la autoridad suficiente para vincular
                a dicha entidad a estos terminos.
              </p>
              <p>
                El uso continuado de la plataforma tras la publicacion de actualizaciones a estos terminos
                constituye la aceptacion tacita de los cambios realizados.
              </p>
            </div>
          </section>

          {/* 2. Descripcion del servicio */}
          <section>
            <h2 className="text-lg font-semibold text-white pb-3 border-b border-gray-800 mb-5">
              2. Descripcion del Servicio
            </h2>
            <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
              <p>
                Control Finanzas es una plataforma de software como servicio (SaaS) disenada para facilitar la
                gestion de carteras de credito a organizaciones que otorgan prestamos a personas naturales.
                La plataforma provee herramientas para:
              </p>
              <ul className="list-none space-y-2 pl-4 border-l border-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-gray-500 mt-0.5">—</span>
                  <span>Registro y administracion de clientes y sus datos basicos de identificacion.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-500 mt-0.5">—</span>
                  <span>Creacion, seguimiento y cierre de prestamos con condiciones personalizadas.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-500 mt-0.5">—</span>
                  <span>Registro de cobros, abonos y gestion de mora.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-500 mt-0.5">—</span>
                  <span>Asignacion de rutas y cobradores para la recuperacion de cartera.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-500 mt-0.5">—</span>
                  <span>Generacion de reportes financieros, indicadores de cartera y estadisticas operativas.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-500 mt-0.5">—</span>
                  <span>Consulta de indicadores crediticios agregados sobre el historial de pagos de clientes
                    en la red de organizaciones usuarias de la plataforma.</span>
                </li>
              </ul>
              <p>
                La Empresa se reserva el derecho de agregar, modificar o descontinuar funcionalidades del
                servicio en cualquier momento, notificando a los usuarios con razonable anticipacion cuando
                los cambios sean sustanciales.
              </p>
            </div>
          </section>

          {/* 3. Registro y cuenta */}
          <section>
            <h2 className="text-lg font-semibold text-white pb-3 border-b border-gray-800 mb-5">
              3. Registro y Cuenta de Usuario
            </h2>
            <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
              <p>
                Para acceder al servicio, el usuario debe crear una cuenta proporcionando informacion veridica,
                completa y actualizada. La Empresa se reserva el derecho de suspender o cancelar cuentas creadas
                con informacion falsa o enganhosa.
              </p>
              <p>
                El usuario es el unico responsable de mantener la confidencialidad de sus credenciales de acceso
                (correo electronico y contrasena). Se recomienda el uso de contrasenas robustas de al menos ocho
                (8) caracteres, combinando letras, numeros y simbolos.
              </p>
              <p>
                Toda actividad realizada desde la cuenta del usuario, sea por el mismo o por terceros que hayan
                obtenido acceso a sus credenciales, es responsabilidad exclusiva del titular de la cuenta.
                Si el usuario detecta acceso no autorizado, debe notificarlo de inmediato a
                {' '}<a href="mailto:soporte@control-finanzas.com" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
                  soporte@control-finanzas.com
                </a>.
              </p>
              <p>
                Cada cuenta puede administrar una organizacion. Para gestionar multiples organizaciones se
                requiere la contratacion de planes independientes o la suscripcion a modalidades especiales
                habilitadas por la Empresa.
              </p>
            </div>
          </section>

          {/* 4. Planes y pagos */}
          <section>
            <h2 className="text-lg font-semibold text-white pb-3 border-b border-gray-800 mb-5">
              4. Planes y Pagos
            </h2>
            <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
              <p>
                Control Finanzas ofrece distintos planes de suscripcion con diferentes funcionalidades, limites
                de clientes, prestamos activos y opciones de personalizacion. Los detalles de cada plan, incluyendo
                precios y caracteristicas, se encuentran publicados en la pagina de planes de la plataforma y
                pueden ser modificados con previo aviso.
              </p>
              <p>
                <strong className="text-white">Periodo de prueba:</strong> Los nuevos usuarios tienen acceso a un
                periodo de prueba gratuito de catorce (14) dias para evaluar la plataforma. Vencido este periodo,
                se requiere la contratacion de un plan de pago para continuar utilizando el servicio.
              </p>
              <p>
                <strong className="text-white">Metodo de pago:</strong> Los pagos se procesan exclusivamente a
                traves de MercadoPago, plataforma de pagos electronicos. Al realizar un pago, el usuario acepta
                adicionalmente los terminos y condiciones de MercadoPago. Control Finanzas no almacena informacion
                bancaria ni de tarjetas de credito directamente en sus servidores.
              </p>
              <p>
                <strong className="text-white">Renovacion:</strong> Las suscripciones se facturan de forma mensual
                o anual segun el plan seleccionado. El usuario es responsable de gestionar la renovacion de su
                plan antes de la fecha de vencimiento para evitar la suspension del servicio. Los datos del
                usuario se conservan integros durante un periodo de gracia posterior al vencimiento.
              </p>
              <p>
                <strong className="text-white">Politica de no reembolso:</strong> Dado que Control Finanzas ofrece
                un periodo de prueba gratuito para la evaluacion del servicio, los pagos realizados por
                suscripciones no son reembolsables una vez procesados, salvo en los casos expresamente previstos
                por la ley colombiana de proteccion al consumidor (Ley 1480 de 2011). Para solicitudes de
                excepcion, el usuario debe contactar a soporte antes de los tres (3) dias calendarios siguientes
                al cobro.
              </p>
            </div>
          </section>

          {/* 5. Uso aceptable */}
          <section>
            <h2 className="text-lg font-semibold text-white pb-3 border-b border-gray-800 mb-5">
              5. Uso Aceptable
            </h2>
            <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
              <p>
                El usuario se compromete a utilizar Control Finanzas unicamente para los fines legales para los
                que fue disenada la plataforma. Queda expresamente prohibido:
              </p>
              <ul className="list-none space-y-2 pl-4 border-l border-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-gray-500 mt-0.5">—</span>
                  <span>Utilizar la plataforma para actividades ilegales, fraudulentas o que violen derechos de
                    terceros, incluyendo actividades de gota a gota u otras formas de prestamo usurario o
                    extorsivo sancionadas por la ley colombiana.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-500 mt-0.5">—</span>
                  <span>Compartir las credenciales de acceso con terceros no autorizados o ceder el uso de la
                    cuenta a personas que no pertenezcan a la organizacion registrada.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-500 mt-0.5">—</span>
                  <span>Intentar acceder, consultar, modificar o eliminar datos pertenecientes a otras
                    organizaciones usuarias de la plataforma.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-500 mt-0.5">—</span>
                  <span>Realizar ingenieria inversa, descompilar, desensamblar o intentar obtener el codigo
                    fuente de la plataforma o sus componentes.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-500 mt-0.5">—</span>
                  <span>Introducir software malicioso, virus, scripts automatizados o cualquier elemento
                    que pueda danar el funcionamiento de la plataforma o los datos de otros usuarios.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-500 mt-0.5">—</span>
                  <span>Registrar informacion personal de clientes sin haber obtenido su consentimiento
                    en cumplimiento de la Ley 1581 de 2012 (Habeas Data).</span>
                </li>
              </ul>
              <p>
                El incumplimiento de estas condiciones podra resultar en la suspension inmediata de la cuenta,
                sin perjuicio de las acciones legales que correspondan.
              </p>
            </div>
          </section>

          {/* 6. Datos y score crediticio — seccion destacada */}
          <section>
            <h2 className="text-lg font-semibold text-white pb-3 border-b border-gray-800 mb-5">
              6. Datos de Clientes e Indicadores Crediticios
            </h2>

            <div className="bg-[#0d1f35] border border-[#1e3a5f] rounded-xl p-5 mb-5">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-blue-200 font-medium leading-relaxed">
                  Esta seccion es especialmente importante. Le rogamos leerla con atencion antes de registrar
                  datos de sus clientes en la plataforma.
                </p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
              <p>
                Control Finanzas ofrece una funcionalidad de indicadores crediticios que tiene como proposito
                brindar a los usuarios una referencia general sobre el comportamiento de pago historico de sus
                clientes dentro de la red de organizaciones que utilizan la plataforma.
              </p>
              <p>
                <strong className="text-white">Datos utilizados y forma de procesamiento:</strong> Para generar
                este indicador, la plataforma utiliza el numero de cedula de ciudadania (o documento de
                identidad equivalente) de los clientes registrados. Este dato se procesa de forma
                <strong className="text-white"> agregada y anonimizada</strong>: no se asocia publicamente con
                nombres, montos de prestamos, fechas especificas ni ninguna otra informacion que permita
                identificar o deducir la situacion financiera particular de un cliente.
              </p>
              <p>
                <strong className="text-white">Lo que se comparte entre organizaciones:</strong> Unicamente se
                muestra un indicador general del historial crediticio del cliente dentro de la red (por ejemplo:
                sin registros previos, historial positivo, o registros de mora). En ningun caso se revelan a
                otras organizaciones el nombre del cliente, los montos involucrados, las fechas de los prestamos,
                el nombre de la organizacion que reporto el historial ni ninguna otra informacion especifica.
              </p>
              <p>
                <strong className="text-white">Consentimiento y responsabilidad del usuario:</strong> Al registrar
                a un cliente en la plataforma e ingresar su numero de documento de identidad, el usuario declara
                y garantiza haber informado a dicho cliente, y haber obtenido su autorizacion, para el tratamiento
                de sus datos personales en los terminos de la Ley 1581 de 2012 y la politica de privacidad de
                Control Finanzas. El usuario es el responsable directo del tratamiento inicial de los datos ante
                sus clientes; Control Finanzas actua como encargada del tratamiento en los terminos del articulo
                3 de la Ley 1581 de 2012.
              </p>
              <p>
                <strong className="text-white">Participacion en el sistema agregado:</strong> Al aceptar estos
                terminos, el usuario autoriza expresamente que el numero de documento de identidad de los clientes
                que registre participe en el sistema de indicadores crediticios agregados de la plataforma, bajo
                las condiciones de anonimizacion y proteccion descritas en este documento. Esta participacion
                beneficia al conjunto de organizaciones usuarias al facilitar una evaluacion mas informada del
                riesgo crediticio.
              </p>
              <p>
                <strong className="text-white">Limitaciones del indicador:</strong> El indicador crediticio
                provisto por Control Finanzas no constituye un reporte crediticio oficial ni reemplaza las
                consultas a centrales de riesgo debidamente autorizadas (como DataCredito o TransUnion). La
                Empresa no garantiza la exactitud, completitud o actualidad de dicho indicador, y su uso como
                unico criterio para la toma de decisiones crediticias es responsabilidad exclusiva del usuario.
              </p>
            </div>
          </section>

          {/* 7. Propiedad intelectual */}
          <section>
            <h2 className="text-lg font-semibold text-white pb-3 border-b border-gray-800 mb-5">
              7. Propiedad Intelectual
            </h2>
            <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
              <p>
                La plataforma Control Finanzas, incluyendo su codigo fuente, diseno visual, interfaces de
                usuario, logotipos, marcas, textos, graficos, bases de datos y demas elementos que la componen,
                son propiedad exclusiva de Control Finanzas SAS o de sus licenciantes, y se encuentran
                protegidos por las leyes colombianas e internacionales de propiedad intelectual.
              </p>
              <p>
                El usuario recibe una licencia de uso limitada, no exclusiva, intransferible y revocable para
                acceder y utilizar la plataforma exclusivamente para los fines previstos en estos terminos.
                Esta licencia no otorga al usuario ningun derecho de propiedad sobre la plataforma ni sobre
                ninguno de sus componentes.
              </p>
              <p>
                Los datos ingresados por el usuario a la plataforma (informacion de clientes, prestamos, pagos)
                son de su exclusiva propiedad. La Empresa no reclama propiedad sobre dichos datos y se compromete
                a tratarlos conforme a su Politica de Privacidad.
              </p>
            </div>
          </section>

          {/* 8. Limitacion de responsabilidad */}
          <section>
            <h2 className="text-lg font-semibold text-white pb-3 border-b border-gray-800 mb-5">
              8. Limitacion de Responsabilidad
            </h2>
            <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
              <p>
                Control Finanzas es una herramienta de gestion operativa. La plataforma facilita el registro,
                seguimiento y organizacion de informacion crediticia, pero no interviene en las decisiones de
                otorgamiento de credito ni en los procesos de cobro del usuario.
              </p>
              <p>
                La Empresa no garantiza la recuperacion de cartera, el cumplimiento de pago por parte de los
                clientes del usuario ni resultados financieros especificos derivados del uso de la plataforma.
                El usuario asume la totalidad del riesgo crediticio asociado a su actividad.
              </p>
              <p>
                En la maxima medida permitida por la ley aplicable, la Empresa no sera responsable por danos
                indirectos, incidentales, especiales, consecuentes o punitivos, incluyendo perdida de ganancias,
                perdida de datos o interrupcion del negocio, derivados del uso o la imposibilidad de uso de
                la plataforma.
              </p>
              <p>
                La Empresa se compromete a mantener la disponibilidad del servicio con un nivel de uptime
                razonable, pero no garantiza que la plataforma estara libre de interrupciones, errores o
                vulnerabilidades de seguridad en todo momento. En caso de incidentes, se notificara a los
                usuarios afectados con la mayor celeridad posible.
              </p>
            </div>
          </section>

          {/* 9. Modificaciones */}
          <section>
            <h2 className="text-lg font-semibold text-white pb-3 border-b border-gray-800 mb-5">
              9. Modificaciones a los Terminos
            </h2>
            <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
              <p>
                La Empresa se reserva el derecho de modificar, actualizar o reemplazar estos Terminos y
                Condiciones en cualquier momento. Cuando los cambios sean sustanciales, el usuario sera
                notificado con al menos siete (7) dias calendario de anticipacion a traves del correo
                electronico registrado en su cuenta o mediante un aviso prominente dentro de la plataforma.
              </p>
              <p>
                Para cambios menores de redaccion, correcciones de estilo o actualizaciones que no alteren
                los derechos y obligaciones de las partes, la Empresa podra actualizar estos terminos sin
                notificacion previa, actualizando unicamente la fecha de la ultima modificacion en la
                parte superior de este documento.
              </p>
              <p>
                Si el usuario no esta de acuerdo con las modificaciones, debe discontinuar el uso de la
                plataforma antes de la fecha de entrada en vigencia de los nuevos terminos. El uso continuado
                posterior a dicha fecha implica la aceptacion de los terminos actualizados.
              </p>
            </div>
          </section>

          {/* 10. Ley aplicable */}
          <section>
            <h2 className="text-lg font-semibold text-white pb-3 border-b border-gray-800 mb-5">
              10. Ley Aplicable y Jurisdiccion
            </h2>
            <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
              <p>
                Estos Terminos y Condiciones se rigen e interpretan de conformidad con las leyes de la
                Republica de Colombia, incluyendo en particular la Ley 527 de 1999 (Comercio Electronico),
                la Ley 1480 de 2011 (Estatuto del Consumidor), la Ley 1581 de 2012 (Proteccion de Datos
                Personales) y el Codigo de Comercio.
              </p>
              <p>
                Cualquier controversia derivada del uso de la plataforma o de la interpretacion de estos
                terminos se sometara, en primera instancia, a un proceso de resolucion amigable mediante
                comunicacion directa con la Empresa. De no llegarse a un acuerdo, las partes se someten
                a la jurisdiccion de los jueces y tribunales competentes de la ciudad de Bogota D.C.,
                Colombia, renunciando a cualquier otro fuero que pudiera corresponderles.
              </p>
            </div>
          </section>

          {/* 11. Contacto */}
          <section>
            <h2 className="text-lg font-semibold text-white pb-3 border-b border-gray-800 mb-5">
              11. Contacto
            </h2>
            <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
              <p>
                Para preguntas, aclaraciones, solicitudes de derechos sobre sus datos personales (acceso,
                actualizacion, rectificacion, supresion o revocacion de autorizacion) o cualquier inquietud
                relacionada con estos terminos o con el funcionamiento de la plataforma, puede comunicarse
                con el equipo de Control Finanzas a traves de los siguientes medios:
              </p>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mt-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                  Informacion de contacto
                </p>
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <a
                    href="mailto:soporte@control-finanzas.com"
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2"
                  >
                    soporte@control-finanzas.com
                  </a>
                </div>
              </div>
              <p>
                El equipo de soporte respondera las solicitudes en un plazo maximo de cinco (5) dias habiles
                a partir de su recepcion.
              </p>
            </div>
          </section>

        </div>

        {/* Footer divider */}
        <div className="mt-16 pt-8 border-t border-gray-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-xs text-gray-600">
              Control Finanzas SAS &mdash; Bogota, Colombia &mdash; 2026
            </p>
            <Link
              href="/privacidad"
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-400 transition-colors"
            >
              Politica de Privacidad
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
