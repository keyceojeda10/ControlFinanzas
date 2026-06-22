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

export const FUNCIONES_SISTEMA = `- Registrar prestamos diarios, semanales, quincenales, mensuales
- Cobros con calculo automatico de cuotas, parciales, recargos
- Mercancia: entrega articulo a cuotas, calcula ganancia automatico
- Cobradores con acceso propio (ven solo sus clientes)
- Rutas de cobro por zona con capital independiente
- Recibos por WhatsApp listos para enviar con un toque
- Control de capital y caja
- Seguro por prestamo (ganancia extra registrada)
- Reportes de ingresos, mora, cobros
- Funciona offline despues de cargar`

export const CONOCIMIENTO_TECNICO = `- Frecuencias: diario, semanal, quincenal, mensual
- Modos de interes: Fijo (clasico), Interes unico (cobra % una vez), Sobre saldo (baja al abonar), Manual (cuota exacta)
- Mercancia: entrega articulo a cuotas, pone costo y precio de venta, sistema saca ganancia y cuota
- Tipos de pago: completo, parcial, recargo, descuento, abono a capital
- Metodos de pago: efectivo, Nequi, Daviplata, transferencia (solo registra, no procesa)
- Recibos: el sistema arma el mensaje listo para WhatsApp
- Cobradores: usuario propio, solo ve sus clientes asignados
- Capital por ruta: plata independiente por zona
- Interes ganado del mes: ganancias reales de intereses, separado del capital
- Seguro: cobro extra al dar prestamo, queda como ganancia en caja
- Cierre de caja: cobrador reporta, sistema compara, dueno puede corregir
- Reportes y Excel: desde plan Crecimiento
- App web (navegador), se agrega a pantalla inicio del celular
- Offline: carga una vez con internet, luego funciona sin conexion, sincroniza al reconectar
- Prueba gratis: 14 dias, no 15
- Plan anual: 2 meses gratis (para quien quiere "pago unico")
- La cuota se define al crear el prestamo; si quedo mal, eliminar y recrear con modo correcto`

export function construirContextoLead(lead, estadoRegistro, franja, fechaCol) {
  const partes = [
    `Datos del prospecto:`,
    `- Nombre: ${lead.nombre || 'desconocido'}`,
    `- Telefono: ${lead.telefono || ''}`,
    `- Clientes que maneja: ${lead.cantClientes || 'no especificado'}`,
    `- Metodo actual: ${lead.metodoActual || 'no especificado'}`,
    `- Estado de registro: ${estadoRegistro}`,
    `- Hora Colombia: ${fechaCol} — es de ${franja}`,
  ]

  if (lead.metodoActual || lead.cantClientes) {
    partes.push(`\nIMPORTANTE: YA SABES del formulario que usa "${lead.metodoActual || '?'}" y maneja "${lead.cantClientes || '?'}" clientes. NO le preguntes eso, ya lo sabes.`)
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

URLs:
- Registro: ${DATOS_SISTEMA.linkRegistro}
- Reset password: ${DATOS_SISTEMA.linkResetPassword}
- Videollamada 15min: ${DATOS_SISTEMA.linkCalendario15}
- Videollamada 30min: ${DATOS_SISTEMA.linkCalendario30}
- WhatsApp soporte: ${DATOS_SISTEMA.whatsappSoporte}
- Telefono soporte: ${DATOS_SISTEMA.telefonoSoporte} (${DATOS_SISTEMA.horarioSoporte})

Videos (solo si preguntan o tienen problemas):
- Primeros pasos: ${VIDEOS.primerosPasos}
- Crear cliente: ${VIDEOS.crearCliente}
- Crear prestamo: ${VIDEOS.crearPrestamo}
- Registrar pago: ${VIDEOS.registrarPago}
- Crear ruta: ${VIDEOS.crearRuta}
- Crear cobrador: ${VIDEOS.crearCobrador}`
}
