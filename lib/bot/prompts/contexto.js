// lib/bot/prompts/contexto.js — Datos estáticos que se inyectan al prompt como contexto
// Mantener FUERA del prompt: si cambia un precio o una URL, se cambia aquí y listo.

export const DATOS_SISTEMA = {
  nombre: 'Control Finanzas',
  descripcion: 'Sistema de cartera y cobros para prestamistas. Todo desde el celular.',
  linkRegistro: 'https://app.control-finanzas.com/registro?r=2',
  linkResetPassword: 'https://app.control-finanzas.com/reset-password',
  linkCalendario15: 'https://cal.com/control-finanzas/15min',
  linkCalendario30: 'https://cal.com/control-finanzas/30min',
  telefonoSoporte: '301 199 3001',
  horarioSoporte: '7am a 10pm',
  diasPrueba: 14,
  whatsappSoporte: 'https://wa.me/573011993001',
}

export const PLANES = [
  { nombre: 'Inicial',      precio: 39000, maxClientes: 150,   rutas: 1,  usuarios: 1, lucasIA: false },
  { nombre: 'Basico',       precio: 59000, maxClientes: 450,   rutas: 1,  usuarios: 1, lucasIA: false },
  { nombre: 'Crecimiento',  precio: 79000, maxClientes: 1000,  rutas: 3,  usuarios: 2, lucasIA: true },
  { nombre: 'Profesional',  precio: 119000, maxClientes: 2000, rutas: 6,  usuarios: 5, lucasIA: true },
  { nombre: 'Empresarial',  precio: 259000, maxClientes: 10000, rutas: 10, usuarios: 10, lucasIA: true },
]

export const EXTRAS = { cobradorExtra: 19000, rutaExtra: 29000 }

export const VIDEOS = {
  primerosPasos: 'https://youtu.be/b5x-lWu_vbA',
  crearCliente: 'https://youtu.be/EEGrlsU-k7Y',
  crearPrestamo: 'https://youtu.be/wuk7J8zd_Ko',
  registrarPago: 'https://youtu.be/CPnWwHtrTiQ',
  crearRuta: 'https://youtu.be/tldha8LjE4c',
  crearCobrador: 'https://youtu.be/zQdJ8019zrQ',
}

export const FUNCIONES_SISTEMA = `- Registrar préstamos diarios, semanales, quincenales, mensuales
- Cobros con cálculo automático de cuotas, parciales, recargos
- Mercancía: entrega artículo a cuotas, calcula ganancia automático
- Cobradores con acceso propio (ven solo sus clientes)
- Rutas de cobro por zona con capital independiente
- Recibos por WhatsApp listos para enviar con un toque
- Control de capital y caja
- Seguro por préstamo (ganancia extra registrada)
- Reportes de ingresos, mora, cobros
- Funciona offline después de cargar`

function cantClientesLegible(cant) {
  if (!cant) return 'no especificado'
  const map = {
    'menos_de_20': 'menos de 20', '20_50': 'entre 20 y 50', '20_–_50': 'entre 20 y 50',
    '50_100': 'entre 50 y 100', '50_–_100': 'entre 50 y 100',
    'mas_de_100': 'más de 100', 'más_de_100': 'más de 100',
  }
  return map[cant] || cant.replace(/_/g, ' ')
}

export function construirContextoLead(lead, estadoRegistro, franja, fechaCol) {
  const cantTexto = cantClientesLegible(lead.cantClientes)
  const partes = [
    `Datos del prospecto:`,
    `- Nombre: ${lead.nombre || 'desconocido'}`,
    `- Telefono: ${lead.telefono || ''}`,
    `- Clientes que maneja: ${cantTexto}`,
    `- Metodo actual: ${lead.metodoActual || 'no especificado'}`,
    `- Estado de registro: ${estadoRegistro}`,
    `- Hora Colombia: ${fechaCol} — es de ${franja}`,
  ]

  if (lead.metodoActual || lead.cantClientes) {
    partes.push(`\nIMPORTANTE: YA SABES del formulario que usa "${lead.metodoActual || '?'}" y maneja "${cantTexto}" clientes. NO le preguntes eso, ya lo sabes.`)
  }

  return partes.join('\n')
}

export function construirContextoDatos() {
  const planesTexto = PLANES.map(p =>
    `- ${p.nombre} $${p.precio.toLocaleString('es-CO')}/mes: ${p.maxClientes} clientes, ${p.rutas} ruta${p.rutas > 1 ? 's' : ''}, ${p.usuarios} usuario${p.usuarios > 1 ? 's' : ''}${p.lucasIA ? ' + Lucas IA' : ''}`
  ).join('\n')

  return `DATOS DEL SISTEMA (usa cuando necesites, no recites):
Planes:
${planesTexto}
- Cobrador extra $${EXTRAS.cobradorExtra.toLocaleString('es-CO')}, ruta extra $${EXTRAS.rutaExtra.toLocaleString('es-CO')}

URLs que puedes compartir:
- Registro: ${DATOS_SISTEMA.linkRegistro}
- Ingresar al sistema: https://app.control-finanzas.com

Soporte (puedes compartir con el lead):
- Linea de soporte: ${DATOS_SISTEMA.telefonoSoporte} (${DATOS_SISTEMA.horarioSoporte})

URLs INTERNAS (NUNCA compartir con el lead):
- Videollamada 15min: ${DATOS_SISTEMA.linkCalendario15} (solo si TU decides ofrecer videollamada)
- Videollamada 30min: ${DATOS_SISTEMA.linkCalendario30}

Videos (solo si preguntan):
- Primeros pasos: ${VIDEOS.primerosPasos}
- Crear cliente: ${VIDEOS.crearCliente}
- Crear prestamo: ${VIDEOS.crearPrestamo}
- Registrar pago: ${VIDEOS.registrarPago}
- Crear ruta: ${VIDEOS.crearRuta}
- Crear cobrador: ${VIDEOS.crearCobrador}`
}
