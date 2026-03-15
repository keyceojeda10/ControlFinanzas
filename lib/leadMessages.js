// lib/leadMessages.js — Templates de mensajes WhatsApp para leads
// Cada template recibe { nombre, cantClientes } y retorna el texto del mensaje

export const CATEGORIAS = {
  inicial: { label: 'Inicial', color: '#3b82f6' },
  respuesta: { label: 'Respuesta', color: '#f59e0b' },
  seguimiento: { label: 'Seguimiento', color: '#f97316' },
}

export const MENSAJES = [
  {
    id: 0,
    label: 'Primer contacto (<50 clientes)',
    category: 'inicial',
    condition: 'Cuando el lead tiene menos de 50 clientes o no especificó',
    generate: ({ nombre }) =>
      `Hola ${nombre}! Soy Carlos de Control Finanzas 👋\n\nVi que te interesó el sistema para manejar tu cartera de préstamos.\n\n¿Actualmente cómo llevas el control? ¿Cuaderno, Excel o alguna app?`,
  },
  {
    id: 1,
    label: 'Primer contacto (50+ clientes)',
    category: 'inicial',
    condition: 'Cuando el lead maneja 50 o más clientes',
    generate: ({ nombre, cantClientes }) =>
      `Hola ${nombre}! Soy Carlos de Control Finanzas 👋\n\nVi que manejas más de ${cantClientes || '50'} clientes. Con ese volumen, un sistema te ahorra horas al día y evita errores en los cobros.\n\n¿Actualmente cómo llevas el control de tu cartera?`,
  },
  {
    id: 2,
    label: 'Respuesta: usa cuaderno',
    category: 'respuesta',
    condition: 'Cuando responde que usa cuaderno',
    generate: ({ nombre, cantClientes }) =>
      `Uff cuaderno con ${cantClientes || 'varios'} clientes es complicado. Un error y se pierde plata.\n\nNosotros hicimos un sistema que reemplaza el cuaderno. Tus cobradores registran pagos desde el celular y tú ves todo en tiempo real.\n\nMira cómo funciona: https://control-finanzas.com\n\nTiene 14 días gratis sin meter tarjeta.`,
  },
  {
    id: 3,
    label: 'Respuesta: usa Excel',
    category: 'respuesta',
    condition: 'Cuando responde que usa Excel',
    generate: () =>
      `Excel funciona pero cuando creces se vuelve un caos, sobre todo si tienes cobradores.\n\nNosotros hicimos algo que es como un Excel pero automático: registras el préstamo y el sistema calcula cuotas, te avisa morosos, y hasta manda recibos por WhatsApp al cliente.\n\nMira: https://control-finanzas.com\n14 días gratis, sin tarjeta.`,
  },
  {
    id: 4,
    label: 'Respuesta: usa otra app',
    category: 'respuesta',
    condition: 'Cuando responde que usa otra aplicación',
    generate: () =>
      `¿Cuál usas? Pregunto porque muchos se pasan a nosotros por precio/facilidad.\n\nSi quieres comparar: https://control-finanzas.com\nIgual puedes probar 14 días gratis sin compromiso.`,
  },
  {
    id: 5,
    label: 'Respuesta: pregunta precios',
    category: 'respuesta',
    condition: 'Cuando pregunta por los precios',
    generate: () =>
      `Los planes arrancan desde $59.000/mes (1 usuario, hasta 50 clientes).\n\nSi tienes cobradores, el Professional es $119.000/mes con 3 usuarios y 300 clientes.\n\nPero primero pruébalo 14 días gratis: https://control-finanzas.com`,
  },
  {
    id: 6,
    label: 'Seguimiento: 24h sin respuesta',
    category: 'seguimiento',
    condition: 'Si no responde en 24 horas',
    generate: ({ nombre }) =>
      `Hola ${nombre}, no sé si viste mi mensaje anterior 😊\n\nSolo quería saber si sigues interesado en el sistema para préstamos. Si no, sin problema 👍`,
  },
  {
    id: 7,
    label: 'Seguimiento: 48h (último)',
    category: 'seguimiento',
    condition: 'Si no responde en 48 horas — último mensaje',
    generate: ({ nombre }) =>
      `${nombre}, último mensaje para no molestarte.\n\nSi en algún momento necesitas organizar tu cartera: https://control-finanzas.com\n\nÉxitos! 🤝`,
  },
]

// Genera link de WhatsApp con mensaje pre-cargado
export function whatsappLink(telefono, mensaje) {
  if (!telefono) return null
  const num = telefono.replace(/\D/g, '')
  return `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`
}
