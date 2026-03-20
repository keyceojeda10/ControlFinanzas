// lib/leadMessages.js — Templates de mensajes WhatsApp para leads
// Basado en auditoría de 37 leads (mar 2026) + análisis psicológico del cliente
//
// REGLAS CLAVE:
// 1. NO interrogar al lead en el primer mensaje (genera defensa)
// 2. Hablar en tercera persona sobre otros prestamistas (genera identificación)
// 3. NUNCA asumir método de control sin que el lead lo diga
// 4. SIEMPRE responder precio directo, NUNCA redirigir a la web
// 5. El objetivo del primer mensaje es obtener UNA respuesta, no vender
// 6. Control Finanzas es un SISTEMA WEB (navegador), NO una app

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
    condition: 'Para TODOS los leads nuevos. NO preguntar cómo manejan su cartera. Hablar en tercera persona sobre otros prestamistas. El objetivo es obtener UNA respuesta, no vender.',
    generate: ({ nombre }) => [
      `Hola ${saludo(nombre)}, soy Carlos de Control Finanzas 👋`,
      ``,
      `Te escribo porque vi que te interesó nuestro sistema.`,
      ``,
      `Nosotros trabajamos con prestamistas que estaban cansados de perder plata por errores en el cuaderno o porque el cobrador les reportaba mal. Hicimos un sistema que les resolvió eso.`,
      ``,
      `Si quieres te cuento cómo funciona.`,
    ].join('\n'),
  },
  {
    id: 1,
    label: 'Filtro: no es prestamista',
    category: 'inicial',
    condition: 'Si el lead parece confundido o dice que busca un préstamo. Responder amablemente que el producto es para quienes PRESTAN dinero.',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, nosotros no prestamos dinero.`,
      ``,
      `Control Finanzas es un sistema para personas que *ya prestan* dinero y quieren organizar sus cobros y clientes.`,
      ``,
      `Si tú prestas y quieres organizarte, con gusto te ayudo.`,
    ].join('\n'),
  },

  // ── RESPUESTA ──────────────────────────────────────────
  {
    id: 2,
    label: 'Cómo funciona',
    category: 'respuesta',
    condition: 'Cuando el lead dice "dale", "sí", "cuéntame", "cómo es", "cómo funciona". Explicar sin vender. Cerrar con pregunta sobre cobradores.',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, funciona así:`,
      ``,
      `Entras desde el navegador de tu celular o computador — no necesitas descargar nada.`,
      ``,
      `Registras tus clientes y préstamos, y el sistema calcula las cuotas automático. Si tienes cobradores, cada uno tiene su ruta y registra pagos desde el celular. Tú ves todo en tiempo real: quién pagó, quién debe, cierre de caja.`,
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
    condition: 'Cuando dice que usa cuaderno, cartulina, tarjetas o libreta. Enviar imagen adjunta PRIMERO.',
    image: '/images/leads/cuaderno-vs-app.png',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, muchos de nuestros clientes empezaron así.`,
      ``,
      `El problema es que con cuaderno es fácil perder la cuenta o que un cobrador te reporte mal. Y recuperar esa plata es casi imposible.`,
      ``,
      `Con el sistema registras el préstamo y calcula las cuotas automático. Tu cobrador registra pagos desde el celular y tú ves todo en tiempo real.`,
      ``,
      `¿Quieres probarlo? Son 14 días gratis, no pide tarjeta.`,
    ].join('\n'),
  },
  {
    id: 4,
    label: 'Respuesta: usa Excel',
    category: 'respuesta',
    condition: 'Cuando dice que usa Excel o alguna hoja de cálculo. Enviar imagen adjunta PRIMERO.',
    image: '/images/leads/cuaderno-vs-app.png',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, Excel funciona, pero cuando tienes cobradores se complica — cada uno tiene su archivo y al final del día no cuadran los números.`,
      ``,
      `Con el sistema cada cobrador tiene su ruta en el celular, registra pagos y tú ves el cierre de caja al final del día. Todo automático.`,
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
      `${saludo(nombre)}, por WhatsApp es difícil buscar los pagos después y se mezclan chats personales con los de cobro.`,
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
    condition: '⚠️ Cuando pregunta por precios. SIEMPRE responder directo con los 3 planes. NUNCA decir "mira la web" o "los encuentras en control-finanzas.com".',
    generate: () => [
      `¡Claro! Estos son los planes:`,
      ``,
      `📌 *Básico* — $59.000/mes`,
      `   1 usuario, hasta 50 clientes`,
      ``,
      `📌 *Profesional* — $119.000/mes (el más popular)`,
      `   3 usuarios, hasta 300 clientes, rutas y cobradores`,
      ``,
      `📌 *Empresarial* — $199.000/mes`,
      `   7 usuarios, clientes ilimitados`,
      ``,
      `Todos incluyen 14 días gratis sin pedir tarjeta.`,
      ``,
      `¿Cuántos clientes manejas? Así te digo cuál te conviene.`,
    ].join('\n'),
  },
  {
    id: 8,
    label: 'Respuesta: cobra solo',
    category: 'respuesta',
    condition: 'Cuando dice que cobra él mismo, no tiene cobradores. Recomendar plan Básico.',
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
    condition: 'Cuando dice que tiene cobradores. Recomendar plan Profesional.',
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
    condition: 'Cuando el lead ya se registró en la plataforma. Ofrecer soporte y videollamada.',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, cualquier duda que tengas con el sistema me escribes. Estoy aquí para ayudarte.`,
      ``,
      `Si quieres te guío con una videollamada rápida de 5 minutos para que le saques el máximo provecho.`,
    ].join('\n'),
  },

  // ── SEGUIMIENTO ────────────────────────────────────────
  {
    id: 11,
    label: 'Seguimiento: 2 horas',
    category: 'seguimiento',
    condition: '2 horas después del primer mensaje sin respuesta. Toque ligero, sin presión.',
    generate: ({ nombre }) =>
      `${saludo(nombre)}, ¿pudiste ver mi mensaje? Si tienes alguna duda con gusto te ayudo 😊`,
  },
  {
    id: 12,
    label: 'Seguimiento: 24 horas',
    category: 'seguimiento',
    condition: '24 horas sin respuesta. Ofrecer videollamada como alternativa.',
    generate: ({ nombre }) => [
      `Hola ${saludo(nombre)}, ¿quieres que te muestre cómo funciona el sistema con una videollamada rápida de 5 minutos?`,
      ``,
      `Si prefieres probarlo tú mismo:`,
      `https://app.control-finanzas.com/registro`,
      `14 días gratis, sin tarjeta.`,
    ].join('\n'),
  },
  {
    id: 13,
    label: 'Seguimiento: 48 horas (último)',
    category: 'seguimiento',
    condition: 'Último mensaje — 48 horas sin respuesta. Despedida respetuosa.',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, no quiero molestarte más.`,
      ``,
      `Si en algún momento quieres organizar tu cartera de préstamos, aquí tienes tu prueba gratis:`,
      `https://app.control-finanzas.com/registro`,
      ``,
      `¡Éxitos! 🤝`,
    ].join('\n'),
  },
]

// Genera link de WhatsApp con mensaje pre-cargado
export function whatsappLink(telefono, mensaje) {
  if (!telefono) return null
  const num = telefono.replace(/\D/g, '')
  return `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`
}
