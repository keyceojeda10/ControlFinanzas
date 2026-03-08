import Link from 'next/link'

export const metadata = {
  title: 'Política de Privacidad | Control Finanzas',
  description:
    'Política de privacidad y tratamiento de datos personales de Control Finanzas, conforme a la Ley 1581 de 2012.',
}

function SectionHeading({ children }) {
  return (
    <h2 className="text-xl font-semibold text-white mt-12 mb-4 pb-3 border-b border-[#2a2a2a]">
      {children}
    </h2>
  )
}

function Paragraph({ children }) {
  return (
    <p className="text-[#b0b0b0] text-sm leading-relaxed mb-4">
      {children}
    </p>
  )
}

function BulletList({ items }) {
  return (
    <ul className="list-none space-y-2 mb-4">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3 text-sm text-[#b0b0b0] leading-relaxed">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#3a5a8f] shrink-0" />
          {item}
        </li>
      ))}
    </ul>
  )
}

function InfoBox({ children }) {
  return (
    <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-[12px] px-5 py-4 mb-4">
      <p className="text-sm text-[#7eaad4] leading-relaxed">
        {children}
      </p>
    </div>
  )
}

export default function PrivacidadPage() {
  return (
    <div className="min-h-dvh bg-[#0a0a0a]">
      {/* Top navigation */}
      <div className="border-b border-[#1a1a1a]">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[#888888] hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Inicio
          </Link>
          <span className="text-xs text-[#555555]">Control Finanzas</span>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-12 pb-20">
        {/* Header */}
        <div className="mb-10">
          <p className="text-xs font-medium text-[#3a5a8f] uppercase tracking-widest mb-3">
            Documento legal
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
            Política de Privacidad
          </h1>
          <p className="text-sm text-[#555555]">
            Ultima actualizacion: 8 de marzo de 2026
          </p>
          <p className="text-sm text-[#777777] mt-3 max-w-2xl leading-relaxed">
            En Control Finanzas nos comprometemos a proteger la privacidad y los datos personales
            de nuestros usuarios y de los clientes registrados en la plataforma. Este documento
            describe de manera transparente que informacion recopilamos, como la utilizamos y
            cuales son sus derechos conforme a la legislacion colombiana vigente.
          </p>
        </div>

        {/* ── 1. Información que Recopilamos ── */}
        <SectionHeading>1. Informacion que Recopilamos</SectionHeading>
        <Paragraph>
          Control Finanzas recopila distintas categorias de datos personales en funcion del
          rol del usuario dentro de la plataforma. A continuacion se detalla cada categoria:
        </Paragraph>

        <p className="text-xs font-semibold text-[#888888] uppercase tracking-widest mb-2 mt-5">
          Datos de cuenta del usuario (prestamista u operador)
        </p>
        <BulletList
          items={[
            'Nombre completo del responsable de la organizacion.',
            'Direccion de correo electronico utilizada para el registro.',
            'Contrasena de acceso (almacenada en forma encriptada, nunca en texto plano).',
            'Nombre de la organizacion o negocio.',
            'Informacion de facturacion necesaria para procesar pagos de suscripcion.',
          ]}
        />

        <p className="text-xs font-semibold text-[#888888] uppercase tracking-widest mb-2 mt-5">
          Datos de clientes registrados por el usuario
        </p>
        <Paragraph>
          Los usuarios de la plataforma registran informacion de sus propios clientes (deudores)
          con el fin de gestionar operaciones de credito. Dichos datos incluyen:
        </Paragraph>
        <BulletList
          items={[
            'Nombre completo del cliente.',
            'Numero de cedula de ciudadania u otro documento de identidad.',
            'Numero de telefono de contacto.',
            'Direccion de residencia o domicilio.',
            'Informacion adicional de contacto opcional que el usuario decida registrar.',
          ]}
        />

        <p className="text-xs font-semibold text-[#888888] uppercase tracking-widest mb-2 mt-5">
          Datos de prestamos y pagos
        </p>
        <BulletList
          items={[
            'Montos desembolsados, tasas de interes, plazos y condiciones de cada credito.',
            'Registro cronologico de pagos recibidos, fechas y montos.',
            'Estado de cada obligacion: activa, pagada, en mora o refinanciada.',
            'Notas y observaciones ingresadas por el operador sobre cada credito.',
          ]}
        />

        <p className="text-xs font-semibold text-[#888888] uppercase tracking-widest mb-2 mt-5">
          Datos de uso de la plataforma
        </p>
        <BulletList
          items={[
            'Registros de acceso: fecha, hora y dispositivo desde el cual se inicia sesion.',
            'Acciones realizadas dentro del sistema (creacion de prestamos, registro de pagos, etc.).',
            'Datos tecnicos como direccion IP, tipo de navegador y sistema operativo.',
            'Informacion de cookies de sesion necesarias para el funcionamiento del servicio.',
          ]}
        />

        {/* ── 2. Cómo Utilizamos la Información ── */}
        <SectionHeading>2. Como Utilizamos la Informacion</SectionHeading>
        <Paragraph>
          La informacion recopilada se utiliza exclusivamente para las siguientes finalidades,
          todas ellas necesarias para la prestacion adecuada del servicio:
        </Paragraph>
        <BulletList
          items={[
            'Proveer y mantener el servicio de gestion de cartera de creditos contratado.',
            'Autenticar a los usuarios y garantizar la seguridad de cada cuenta.',
            'Facilitar la gestion de cobros: seguimiento de vencimientos, alertas y rutas de cobranza.',
            'Generar reportes financieros, estadisticas de cartera y documentos de soporte para los usuarios.',
            'Procesar pagos de suscripcion y gestionar la facturacion del servicio.',
            'Enviar notificaciones relevantes relacionadas con el estado de la cuenta y cambios en el servicio.',
            'Identificar y corregir errores tecnicos, y mejorar el rendimiento de la plataforma.',
            'Cumplir con obligaciones legales aplicables a la actividad de la empresa.',
          ]}
        />
        <Paragraph>
          Control Finanzas no utiliza los datos personales de los clientes registrados para
          fines publicitarios, de mercadeo directo hacia dichos clientes, ni los comparte con
          terceros con fines comerciales ajenos al servicio contratado.
        </Paragraph>

        {/* ── 3. Score Crediticio Agregado ── */}
        <SectionHeading>3. Score Crediticio Agregado</SectionHeading>
        <InfoBox>
          Esta seccion describe una de las funcionalidades mas relevantes de Control Finanzas
          desde la perspectiva del tratamiento de datos. Le recomendamos leerla con atencion.
        </InfoBox>

        <Paragraph>
          Control Finanzas ofrece a sus usuarios un indicador crediticio agregado como herramienta
          de apoyo a la toma de decisiones en la evaluacion de nuevos creditos. Este indicador
          se calcula a partir del numero de cedula del cliente que se desea evaluar.
        </Paragraph>

        <p className="text-xs font-semibold text-[#888888] uppercase tracking-widest mb-2 mt-5">
          Como funciona el indicador
        </p>
        <Paragraph>
          Cuando un usuario consulta el indicador crediticio de un cliente, el sistema realiza
          una busqueda estadistica sobre la base de datos anonimizada de la plataforma. Esta
          busqueda identifica si el numero de cedula consultado aparece en registros de otras
          organizaciones usuarias de Control Finanzas, y calcula un indicador basado en los
          siguientes datos estadisticos:
        </Paragraph>
        <BulletList
          items={[
            'Cantidad de creditos activos asociados al documento de identidad en la plataforma.',
            'Cantidad de creditos completados (pagados en su totalidad) a lo largo del tiempo.',
            'Cantidad de creditos que han presentado situaciones de mora durante su vigencia.',
            'Proporcion entre obligaciones cumplidas y obligaciones con incumplimientos.',
          ]}
        />

        <p className="text-xs font-semibold text-[#888888] uppercase tracking-widest mb-2 mt-5">
          Que NO se revela al consultar el indicador
        </p>
        <Paragraph>
          El diseno del indicador garantiza que ningun usuario pueda acceder a informacion
          especifica de otras organizaciones. En ninguna circunstancia se expone:
        </Paragraph>
        <BulletList
          items={[
            'El nombre, razon social o identidad de las organizaciones con quienes el cliente tiene o tuvo obligaciones.',
            'Los montos exactos de los creditos registrados por terceros.',
            'Las fechas especificas de desembolso, vencimiento o pago de creditos de otras organizaciones.',
            'Informacion de contacto, notas u observaciones ingresadas por otros usuarios.',
            'Cualquier dato que permita identificar a una organizacion prestamista en particular.',
          ]}
        />

        <p className="text-xs font-semibold text-[#888888] uppercase tracking-widest mb-2 mt-5">
          Fundamento legal y legitimidad del tratamiento
        </p>
        <Paragraph>
          El tratamiento del numero de cedula para el calculo del indicador crediticio se
          fundamenta en la finalidad legitima de evaluacion de riesgo crediticio, reconocida
          expresamente por la legislacion colombiana. La Ley 1266 de 2008 (Habeas Data
          Financiero) y la Ley 1581 de 2012 contemplan el tratamiento de datos con fines de
          evaluacion de solvencia y riesgo como una actividad de interes general que contribuye
          a la salud del mercado crediticio y a la proteccion de los propios prestamistas.
        </Paragraph>
        <Paragraph>
          Este indicador no constituye una central de riesgo crediticio de caracter publico,
          ni reemplaza los sistemas oficiales de informacion financiera. Es una herramienta
          interna de la plataforma Control Finanzas, disponible unicamente para los usuarios
          suscritos, con el objetivo de contribuir a decisiones de credito mas informadas
          y reducir el riesgo de sobreendeudamiento de los clientes finales.
        </Paragraph>
        <Paragraph>
          Al registrar informacion de sus clientes en Control Finanzas, el usuario (prestamista)
          actua como responsable del tratamiento de dichos datos frente a sus propios clientes,
          y es su responsabilidad informarles sobre el uso de la plataforma. Control Finanzas
          actua como encargado del tratamiento en los terminos del articulo 3 de la Ley 1581
          de 2012.
        </Paragraph>

        {/* ── 4. Compartición de Datos ── */}
        <SectionHeading>4. Comparticion de Datos con Terceros</SectionHeading>
        <Paragraph>
          Control Finanzas no vende, alquila ni comercializa los datos personales de sus
          usuarios ni de los clientes registrados en la plataforma bajo ningun concepto.
        </Paragraph>
        <Paragraph>
          Los unicos supuestos en que informacion puede ser compartida o transferida son los
          siguientes:
        </Paragraph>
        <BulletList
          items={[
            'Proveedores de infraestructura tecnologica (servicios de nube, bases de datos) que actuan como subencargados del tratamiento bajo acuerdos de confidencialidad y medidas de seguridad equivalentes a las descritas en esta politica.',
            'Procesadores de pago para la gestion de cobros de suscripcion, quienes reciben unicamente la informacion necesaria para completar la transaccion.',
            'Autoridades competentes cuando exista una obligacion legal, orden judicial o requerimiento regulatorio que exija la divulgacion de informacion.',
            'Datos estadisticos anonimizados utilizados en el calculo del indicador crediticio agregado, conforme a lo descrito en la seccion 3 de esta politica. En ningun caso se revelan datos individuales identificables a otras organizaciones.',
          ]}
        />
        <Paragraph>
          Fuera de los supuestos anteriores, no se realiza ningun tipo de transferencia o
          transmision de datos personales a terceros, nacionales o internacionales.
        </Paragraph>

        {/* ── 5. Derechos del Usuario ── */}
        <SectionHeading>5. Derechos del Titular (Ley 1581 de 2012)</SectionHeading>
        <Paragraph>
          De conformidad con la Ley 1581 de 2012 y su Decreto Reglamentario 1377 de 2013,
          toda persona cuyos datos personales sean tratados por Control Finanzas tiene los
          siguientes derechos:
        </Paragraph>
        <BulletList
          items={[
            'Conocer los datos personales que Control Finanzas tiene sobre usted y solicitar informacion sobre el uso que se hace de los mismos.',
            'Actualizar los datos personales que resulten incompletos, inexactos, desactualizados o que sean parcialmente inexactos.',
            'Rectificar informacion que resulte erronea, inexacta o que induzca a error.',
            'Solicitar la supresion de sus datos personales cuando no exista un deber legal o contractual que obligue a su conservacion.',
            'Revocar la autorizacion otorgada para el tratamiento de sus datos, en los casos en que dicho tratamiento se base en el consentimiento del titular.',
            'Acceder gratuitamente a sus datos personales que hayan sido objeto de tratamiento.',
            'Presentar quejas ante la Superintendencia de Industria y Comercio (SIC) cuando considere que sus derechos han sido vulnerados.',
          ]}
        />
        <Paragraph>
          Para ejercer cualquiera de estos derechos, el titular o su representante legal debera
          enviar una solicitud escrita al siguiente canal oficial:
        </Paragraph>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] px-5 py-4 mb-4">
          <p className="text-sm text-[#888888] mb-1">Canal de atencion de derechos ARCO</p>
          <a
            href="mailto:soporte@control-finanzas.com"
            className="text-[#5a9fd4] hover:text-[#7eaad4] font-medium text-sm transition-colors"
          >
            soporte@control-finanzas.com
          </a>
          <p className="text-xs text-[#555555] mt-2">
            Las solicitudes seran atendidas dentro de los plazos legales establecidos:
            10 dias habiles para consultas y 15 dias habiles para reclamos, prorrogables
            segun lo dispuesto en la Ley 1581 de 2012.
          </p>
        </div>

        {/* ── 6. Almacenamiento y Seguridad ── */}
        <SectionHeading>6. Almacenamiento y Seguridad</SectionHeading>
        <Paragraph>
          La proteccion de los datos personales almacenados en Control Finanzas es una
          prioridad. Para ello implementamos las siguientes medidas tecnicas y organizativas:
        </Paragraph>
        <BulletList
          items={[
            'Los datos se almacenan en servidores con altos estandares de seguridad fisica y logica, gestionados por proveedores de infraestructura en la nube con certificaciones de seguridad reconocidas internacionalmente.',
            'Las contrasenas de acceso se almacenan aplicando funciones de hash criptograficas robustas (bcrypt). En ningun momento se guardan ni se transmiten en texto plano.',
            'Todas las comunicaciones entre el navegador del usuario y los servidores de la plataforma se realizan a traves de conexiones cifradas mediante protocolo HTTPS con certificado TLS vigente.',
            'El acceso a la base de datos esta restringido al personal tecnico autorizado, bajo principios de minimo privilegio y necesidad de conocimiento.',
            'Se realizan copias de seguridad periodicas de la informacion para garantizar su disponibilidad ante eventuales fallos tecnicos.',
            'Se aplican controles de acceso basados en roles dentro de la plataforma para que cada usuario solo pueda ver y gestionar la informacion de su propia organizacion.',
          ]}
        />
        <Paragraph>
          No obstante las medidas anteriores, ningun sistema de transmision o almacenamiento
          de informacion puede garantizar una seguridad absoluta. En caso de que Control
          Finanzas detecte una brecha de seguridad que comprometa datos personales, se
          notificara a los afectados y a las autoridades competentes en los plazos
          establecidos por la normativa aplicable.
        </Paragraph>

        {/* ── 7. Retención de Datos ── */}
        <SectionHeading>7. Retencion de Datos</SectionHeading>
        <Paragraph>
          Control Finanzas conserva los datos personales mientras la cuenta del usuario se
          encuentre activa y el servicio este vigente. Esto permite al usuario acceder en
          cualquier momento al historial completo de su cartera y a los registros de sus clientes.
        </Paragraph>
        <Paragraph>
          Cuando un usuario solicita la cancelacion de su cuenta o su suscripcion expira de
          manera definitiva sin ser renovada, los datos se conservan por un periodo razonable
          adicional con las siguientes finalidades:
        </Paragraph>
        <BulletList
          items={[
            'Permitir al usuario recuperar su informacion en caso de arrepentimiento o reactivacion dentro del periodo de gracia.',
            'Cumplir con obligaciones legales de conservacion de registros contables y financieros establecidas por la legislacion colombiana.',
            'Resolver eventuales reclamaciones o disputas pendientes relacionadas con el servicio.',
          ]}
        />
        <Paragraph>
          Transcurrido dicho periodo, los datos personales identificables del usuario y de
          sus clientes seran eliminados de manera segura de los sistemas de produccion de
          Control Finanzas. Los datos anonimizados o agregados que no permiten identificar
          a personas naturales podran conservarse indefinidamente con fines estadisticos.
        </Paragraph>

        {/* ── 8. Cookies y Tecnologías ── */}
        <SectionHeading>8. Cookies y Tecnologias de Rastreo</SectionHeading>
        <Paragraph>
          Control Finanzas utiliza cookies y tecnologias similares de manera limitada y
          con finalidades especificas:
        </Paragraph>
        <BulletList
          items={[
            'Cookies de sesion: necesarias para mantener al usuario autenticado durante su navegacion por la plataforma. Estas cookies se eliminan automaticamente al cerrar el navegador o al cerrar sesion.',
            'Cookies de preferencias: almacenan configuraciones del usuario como el idioma o preferencias de visualizacion para mejorar la experiencia de uso.',
            'Cookies analiticas: utilizadas para comprender como los usuarios interactuan con la plataforma, con el fin de identificar mejoras. Los datos recopilados son anonimos y no se vinculan a identidades individuales.',
          ]}
        />
        <Paragraph>
          La plataforma no utiliza cookies de publicidad comportamental ni de seguimiento
          entre sitios web de terceros. El usuario puede configurar su navegador para rechazar
          cookies; sin embargo, esto puede afectar el correcto funcionamiento de la plataforma,
          incluyendo la capacidad de iniciar sesion.
        </Paragraph>

        {/* ── 9. Cambios en la Política ── */}
        <SectionHeading>9. Cambios en esta Politica</SectionHeading>
        <Paragraph>
          Control Finanzas se reserva el derecho de modificar esta Politica de Privacidad en
          cualquier momento para reflejar cambios en sus practicas de tratamiento de datos,
          en la normativa aplicable o en las funcionalidades del servicio.
        </Paragraph>
        <Paragraph>
          Cuando se realicen cambios materiales que afecten de manera significativa los derechos
          de los titulares o la forma en que se tratan los datos personales, Control Finanzas
          notificara a los usuarios registrados mediante:
        </Paragraph>
        <BulletList
          items={[
            'Correo electronico enviado a la direccion registrada en la cuenta, con un plazo de aviso previo razonable antes de que los cambios entren en vigor.',
            'Aviso prominente en la plataforma durante el periodo de transicion.',
          ]}
        />
        <Paragraph>
          La continuacion en el uso de la plataforma despues de la fecha efectiva de los cambios
          constituira la aceptacion de la nueva Politica de Privacidad. Si el usuario no esta
          de acuerdo con los cambios, puede solicitar la cancelacion de su cuenta antes de la
          fecha de entrada en vigor de la nueva version.
        </Paragraph>
        <Paragraph>
          Las versiones anteriores de esta politica estaran disponibles para consulta a solicitud
          del usuario a traves de los canales de soporte indicados en la seccion siguiente.
        </Paragraph>

        {/* ── 10. Contacto ── */}
        <SectionHeading>10. Contacto</SectionHeading>
        <Paragraph>
          Si tiene preguntas, comentarios o inquietudes sobre esta Politica de Privacidad,
          o si desea ejercer alguno de los derechos descritos en la seccion 5, puede
          comunicarse con Control Finanzas a traves del siguiente canal:
        </Paragraph>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] px-5 py-5 mb-8">
          <p className="text-xs font-semibold text-[#555555] uppercase tracking-widest mb-3">
            Responsable del tratamiento
          </p>
          <p className="text-sm text-white font-medium mb-1">Control Finanzas</p>
          <p className="text-sm text-[#888888] mb-3">
            Plataforma de gestion de cartera de creditos
          </p>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#555555] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <a
              href="mailto:soporte@control-finanzas.com"
              className="text-[#5a9fd4] hover:text-[#7eaad4] font-medium text-sm transition-colors"
            >
              soporte@control-finanzas.com
            </a>
          </div>
        </div>

        {/* Footer divider */}
        <div className="border-t border-[#1a1a1a] pt-8 mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-xs text-[#444444] leading-relaxed">
              Esta politica fue elaborada conforme a la Ley 1581 de 2012, el Decreto 1377
              de 2013 y demas normas complementarias sobre proteccion de datos personales
              en Colombia.
            </p>
            <Link
              href="/terminos-uso"
              className="text-xs text-[#5a9fd4] hover:text-[#7eaad4] transition-colors whitespace-nowrap"
            >
              Ver Terminos de Uso
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
