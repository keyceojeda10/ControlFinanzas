// lib/leadMessages.js — Templates de mensajes WhatsApp para leads
// Basado en auditoría de 42 conversaciones reales (mar 2026)
//
// REGLAS CLAVE:
// 1. NO interrogar al lead en el primer mensaje (genera defensa)
// 2. Hablar en tercera persona sobre otros prestamistas (genera identificación)
// 3. NUNCA asumir método de control sin que el lead lo diga
// 4. SIEMPRE responder precio directo, NUNCA redirigir a la web
// 5. El objetivo del primer mensaje es obtener UNA respuesta, no vender
// 6. Control Finanzas es un SISTEMA WEB (navegador), NO una app descargable
// 7. El lead LLENÓ un formulario — no "vimos interés", él nos pidió que lo contactemos
// 8. Sonar genuino, entusiasta, como una persona real — NO como bot

export const CATEGORIAS = {
  inicial: { label: 'Inicial', color: '#3b82f6' },
  respuesta: { label: 'Respuesta', color: '#f59e0b' },
  seguimiento: { label: 'Seguimiento', color: '#f97316' },
}

// Helper: primer nombre capitalizado
function saludo(nombre) {
  if (!nombre) return 'cliente'
  const p = nombre.split(' ')[0]
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
}

export const MENSAJES = [
  // ── INICIAL ────────────────────────────────────────────
  {
    id: 0,
    label: 'Primer contacto',
    category: 'inicial',
    condition: 'Para TODOS los leads nuevos. El lead llenó un formulario pidiendo info. NO preguntar cómo manejan su cartera. El objetivo es obtener UNA respuesta.',
    generate: ({ nombre }) => [
      `Hola ${saludo(nombre)}, soy Carlos de Control Finanzas.`,
      ``,
      `Vi que llenaste el formulario para conocer el sistema, qué bueno que te interesó.`,
      ``,
      `Trabajamos con prestamistas que estaban cansados de perder plata por errores en el cuaderno o porque el cobrador les reportaba mal. Les hicimos un sistema web donde controlan todo desde el celular, sin descargar nada.`,
      ``,
      `Si quieres te cuento cómo funciona, o si tienes alguna duda específica me dices.`,
    ].join('\n'),
  },
  {
    id: 1,
    label: 'Filtro: no es prestamista',
    category: 'inicial',
    condition: 'Si el lead busca un préstamo o crédito para él. Responder amablemente, sin confrontar.',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, entiendo la confusión.`,
      ``,
      `Nosotros no prestamos dinero — Control Finanzas es un sistema para personas que *ya prestan* dinero y quieren llevar el control de sus cobros, clientes y cobradores de forma organizada.`,
      ``,
      `Si tú prestas dinero y quieres organizarte mejor, con gusto te ayudo.`,
    ].join('\n'),
  },

  // ── RESPUESTA ──────────────────────────────────────────
  {
    id: 2,
    label: 'Cómo funciona',
    category: 'respuesta',
    condition: 'Cuando el lead dice "dale", "sí", "cuéntame", "cómo es", "cómo funciona". Explicar claro y cerrar con pregunta sobre cobradores.',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, te explico:`,
      ``,
      `Es un sistema web — entras desde el navegador de tu celular o computador, no necesitas descargar nada.`,
      ``,
      `Registras tus clientes y préstamos, y el sistema calcula las cuotas automático. Si tienes cobradores, cada uno tiene su ruta en el celular y registra los pagos ahí mismo. Tú ves todo en tiempo real: quién pagó, quién debe, cuánta plata recogió cada cobrador, cierre de caja al final del día.`,
      ``,
      `Puedes probarlo gratis 14 días, sin tarjeta:`,
      `https://app.control-finanzas.com/registro`,
      ``,
      `¿Tienes cobradores o cobras tú mismo?`,
    ].join('\n'),
  },
  {
    id: 3,
    label: 'Respuesta: usa cuaderno/cartulina',
    category: 'respuesta',
    condition: 'Cuando dice que usa cuaderno, cartulina, tarjetas o libreta.',
    image: '/images/leads/cuaderno-vs-app.png',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, muchos de nuestros clientes empezaron así.`,
      ``,
      `El problema es que con cuaderno es fácil perder la cuenta o que un cobrador te reporte mal — y recuperar esa plata después es casi imposible.`,
      ``,
      `Con el sistema registras el préstamo y las cuotas se calculan automático. Tu cobrador registra pagos desde su celular y tú ves todo al instante, sin tener que esperar a que llegue con el cuaderno.`,
      ``,
      `¿Quieres probarlo? Son 14 días gratis, no pide tarjeta.`,
    ].join('\n'),
  },
  {
    id: 4,
    label: 'Respuesta: usa Excel',
    category: 'respuesta',
    condition: 'Cuando dice que usa Excel o alguna hoja de cálculo.',
    image: '/images/leads/cuaderno-vs-app.png',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, Excel funciona, pero cuando tienes cobradores se complica — cada uno tiene su archivo y al final del día no cuadran los números.`,
      ``,
      `Con el sistema cada cobrador tiene su ruta en el celular, registra pagos y tú ves el cierre de caja al final del día sin tener que cuadrar nada a mano.`,
      ``,
      `¿Quieres probarlo? Son 14 días gratis, no pide tarjeta.`,
    ].join('\n'),
  },
  {
    id: 5,
    label: 'Respuesta: usa WhatsApp/notas',
    category: 'respuesta',
    condition: 'Cuando dice que lleva control por WhatsApp, notas del celular o "a la antigua".',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, por WhatsApp es difícil buscar pagos después y se mezclan los chats personales con los de cobro.`,
      ``,
      `Con el sistema cada cliente tiene su perfil con historial completo — préstamos, pagos, saldo. Y si tienes cobradores, cada uno ve solo su ruta.`,
      ``,
      `¿Quieres probarlo? Son 14 días gratis, no pide tarjeta.`,
    ].join('\n'),
  },
  {
    id: 6,
    label: 'Respuesta: usa otra app',
    category: 'respuesta',
    condition: 'Cuando dice que usa otra aplicación o programa.',
    generate: () => [
      `¿Cuál usas? Pregunto porque muchos se pasan a nosotros por precio y facilidad de uso.`,
      ``,
      `Si quieres comparar, puedes probar 14 días gratis sin compromiso:`,
      `https://app.control-finanzas.com/registro`,
    ].join('\n'),
  },
  {
    id: 7,
    label: 'Respuesta: pregunta precios',
    category: 'respuesta',
    condition: 'Cuando pregunta por precios. SIEMPRE responder directo con los 3 planes. NUNCA decir "mira la web".',
    generate: () => [
      `Claro, estos son los planes:`,
      ``,
      `*Básico* — $59.000/mes`,
      `1 usuario, hasta 50 clientes`,
      ``,
      `*Profesional* — $119.000/mes (el más popular)`,
      `3 usuarios, hasta 300 clientes, rutas y cobradores`,
      ``,
      `*Empresarial* — $199.000/mes`,
      `7 usuarios, clientes ilimitados`,
      ``,
      `Todos incluyen 14 días gratis sin pedir tarjeta.`,
      ``,
      `¿Cuántos clientes manejas más o menos? Así te digo cuál te conviene.`,
    ].join('\n'),
  },
  {
    id: 8,
    label: 'Respuesta: cobra solo',
    category: 'respuesta',
    condition: 'Cuando dice que cobra él mismo, no tiene cobradores.',
    generate: ({ nombre }) => [
      `Perfecto ${saludo(nombre)}, entonces con el plan Básico ($59.000/mes) tienes todo lo que necesitas — registras préstamos, el sistema calcula cuotas y llevas control de pagos desde tu celular.`,
      ``,
      `Pruébalo 14 días gratis:`,
      `https://app.control-finanzas.com/registro`,
    ].join('\n'),
  },
  {
    id: 9,
    label: 'Respuesta: tiene cobradores',
    category: 'respuesta',
    condition: 'Cuando dice que tiene cobradores.',
    generate: ({ nombre }) => [
      `Entonces el plan Profesional ($119.000/mes) te funciona bien ${saludo(nombre)} — tus cobradores ven solo su ruta desde el celular, registran pagos y tú ves el cierre de caja de cada uno al final del día. Todo en tiempo real.`,
      ``,
      `Pruébalo 14 días gratis:`,
      `https://app.control-finanzas.com/registro`,
    ].join('\n'),
  },
  {
    id: 10,
    label: 'Ya se registró',
    category: 'respuesta',
    condition: 'Cuando el lead ya se registró en la plataforma.',
    generate: ({ nombre }) => [
      `Buenísimo ${saludo(nombre)}, ya estás dentro.`,
      ``,
      `Cualquier duda que tengas me escribes, estoy aquí para ayudarte.`,
      ``,
      `Si quieres te hago una videollamada rápida de 5 minutos para que le saques el máximo provecho desde el primer día.`,
    ].join('\n'),
  },
  {
    id: 11,
    label: 'No es app, es sistema web',
    category: 'respuesta',
    condition: 'Cuando el lead dice que "descargó la aplicación" o piensa que es una app descargable. Muy común.',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, Control Finanzas no se descarga — es un sistema web que funciona directo desde el navegador de tu celular o computador.`,
      ``,
      `La ventaja es que no ocupa espacio, no necesita actualizaciones y puedes entrar desde cualquier dispositivo.`,
      ``,
      `Solo entra a https://app.control-finanzas.com/registro, crea tu cuenta y listo, empiezas a usarlo.`,
    ].join('\n'),
  },
  {
    id: 12,
    label: 'Permisos de cobradores',
    category: 'respuesta',
    condition: 'Cuando pregunta si los cobradores pueden ver toda la info, si puede limitar acceso, permisos.',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, sí — cada cobrador solo ve los clientes de su ruta. No puede ver clientes de otros cobradores ni información del negocio.`,
      ``,
      `Tú como administrador ves todo: todas las rutas, todos los pagos, cierre de caja de cada cobrador. Pero ellos solo ven lo suyo.`,
      ``,
      `Así mantienes el control sin exponer tu cartera.`,
    ].join('\n'),
  },
  {
    id: 13,
    label: 'Seguridad / robo de celular',
    category: 'respuesta',
    condition: 'Cuando pregunta qué pasa si le roban el celular, si pierde los datos, seguridad.',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, tu información está segura en la nube — si pierdes el celular o te lo roban, solo entras desde otro dispositivo con tu usuario y contraseña y todo sigue ahí.`,
      ``,
      `Nadie puede acceder sin tus credenciales. Y como es un sistema web, no queda nada guardado en el celular.`,
    ].join('\n'),
  },
  {
    id: 14,
    label: 'Video / demostración',
    category: 'respuesta',
    condition: 'Cuando pide un video o quiere ver cómo se ve el sistema antes de probarlo.',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, todavía no tenemos video pero te puedo hacer una videollamada rápida de 5 minutos y te muestro el sistema en vivo.`,
      ``,
      `O si prefieres, regístrate gratis y lo exploras tú mismo — es bastante intuitivo:`,
      `https://app.control-finanzas.com/registro`,
      `14 días gratis, sin tarjeta.`,
    ].join('\n'),
  },
  {
    id: 15,
    label: 'Cobro adicional / comisiones',
    category: 'respuesta',
    condition: 'Cuando pregunta si hay cobros adicionales, comisiones por transacción, costos ocultos.',
    generate: () => [
      `No, el precio del plan es todo lo que pagas — no hay cobros adicionales, ni comisiones, ni costos ocultos.`,
      ``,
      `Pagas tu plan mensual y usas el sistema sin límites dentro de lo que incluye tu plan.`,
    ].join('\n'),
  },

  // ── SEGUIMIENTO ────────────────────────────────────────
  {
    id: 16,
    label: 'Seguimiento: 2 horas',
    category: 'seguimiento',
    condition: '2 horas después del primer mensaje sin respuesta.',
    generate: ({ nombre }) =>
      `${saludo(nombre)}, ¿pudiste ver el mensaje? Si tienes alguna duda me dices, con gusto te ayudo.`,
  },
  {
    id: 17,
    label: 'Seguimiento: 24 horas',
    category: 'seguimiento',
    condition: '24 horas sin respuesta. Ofrecer videollamada.',
    generate: ({ nombre }) => [
      `Hola ${saludo(nombre)}, ¿quieres que te muestre cómo funciona el sistema con una videollamada rápida de 5 minutos?`,
      ``,
      `Si prefieres probarlo tú mismo:`,
      `https://app.control-finanzas.com/registro`,
      `14 días gratis, sin tarjeta.`,
    ].join('\n'),
  },
  {
    id: 18,
    label: 'Seguimiento: 48 horas (último)',
    category: 'seguimiento',
    condition: 'Último mensaje — 48 horas sin respuesta. Despedida respetuosa.',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, no quiero ser intenso.`,
      ``,
      `Si en algún momento necesitas organizar tus préstamos y cobros, aquí tienes tu prueba gratis:`,
      `https://app.control-finanzas.com/registro`,
      ``,
      `Éxitos con tu negocio.`,
    ].join('\n'),
  },
]

// Genera link de WhatsApp con mensaje pre-cargado
export function whatsappLink(telefono, mensaje) {
  if (!telefono) return null
  const num = telefono.replace(/\D/g, '')
  return `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`
}
