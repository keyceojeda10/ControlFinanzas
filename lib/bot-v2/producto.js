// lib/bot-v2/producto.js — Fuente unica de verdad sobre el producto.
// Todo lo que el bot puede decir sale de aqui. Si no esta aqui, NO EXISTE.

export const EMPRESA = {
  nombre: 'Control Finanzas',
  descripcion: 'Sistema de cartera y cobros para prestamistas',
  linkRegistro: 'https://app.control-finanzas.com/registro?r=2',
  linkApp: 'https://app.control-finanzas.com',
  telefonoSoporte: '301 199 3001',
  horarioSoporte: '7am a 10pm',
  waSoporte: 'https://wa.me/573011993001',
  diasPrueba: 14,
  linkCalendario15: 'https://cal.com/control-finanzas/15min',
}

export const PLANES = [
  { nombre: 'Inicial',      precio: 39000,  clientes: 150,   rutas: 1,  usuarios: 1 },
  { nombre: 'Basico',       precio: 59000,  clientes: 450,   rutas: 1,  usuarios: 1 },
  { nombre: 'Crecimiento',  precio: 79000,  clientes: 1000,  rutas: 3,  usuarios: 2 },
  { nombre: 'Profesional',  precio: 119000, clientes: 2000,  rutas: 6,  usuarios: 5 },
  { nombre: 'Empresarial',  precio: 259000, clientes: 10000, rutas: 10, usuarios: 10 },
]

export const EXTRAS = { cobradorExtra: 19000, rutaExtra: 29000 }

export const VIDEOS = {
  primerosPasos: 'https://youtu.be/b5x-lWu_vbA',
  crearPrestamo: 'https://youtu.be/wuk7J8zd_Ko',
  registrarPago: 'https://youtu.be/CPnWwHtrTiQ',
  playlist: 'https://youtube.com/playlist?list=PLY7xKt7sjM3PnG5Tly5Xght2cvu-q7jvk',
}

// WHITELIST: lo unico que el bot puede mencionar como funcion del sistema
export const FUNCIONES = [
  'Registrar prestamos diarios, semanales, quincenales o mensuales',
  'Cobros: calcula cuotas automaticamente, acepta pagos parciales y recargos',
  'Mercancia: entregar articulos a cuotas con ganancia automatica',
  'Cobradores con su propio acceso (solo ven sus clientes asignados)',
  'Rutas de cobro por zona, cada una con su capital independiente',
  'Recibos de pago listos para enviar por WhatsApp',
  'Control de capital y caja diaria',
  'Seguro por prestamo (registra la ganancia extra)',
  'Reportes de ingresos, mora y cobros',
  'Funciona sin internet despues de cargar',
  'Importar clientes desde cartulinas con foto (la IA los lee)',
]

// BLACKLIST: cosas que NO existen y el bot JAMAS debe mencionar
export const NO_EXISTE = [
  'pago en tiendas', 'corresponsales', 'Efecty', 'Baloto', 'puntos de pago',
  'pasarela de pago', 'PSE', 'Nequi', 'Daviplata', 'pago con tarjeta',
  'firma electronica', 'firma digital',
  'GPS del cobrador', 'geolocalizacion', 'rastreo',
  'notificaciones automaticas a deudores',
  'integracion con bancos', 'integracion con billeteras',
  'app en Play Store', 'app en App Store', 'App Store', 'Play Store', 'Google Play',
  'descargar la app', 'descargar app', 'descargar desde',
  'chat con deudores',
  'modulo contable', 'facturacion electronica',
  'inteligencia artificial para el prestamista',
  'descarga en Excel', 'exportar datos',
]

export function planRecomendado(cantClientes) {
  if (!cantClientes) return PLANES[0]
  const n = typeof cantClientes === 'number' ? cantClientes
    : cantClientes.includes('menos') || cantClientes.includes('20') ? 30
    : cantClientes.includes('50') ? 75
    : cantClientes.includes('100') || cantClientes.includes('mas') ? 150
    : 30
  if (n <= 150) return PLANES[0]
  if (n <= 450) return PLANES[1]
  if (n <= 1000) return PLANES[2]
  if (n <= 2000) return PLANES[3]
  return PLANES[4]
}

export function formatPrecio(n) {
  return '$' + n.toLocaleString('es-CO')
}

export function textoPlanes() {
  return PLANES.map(p =>
    `${p.nombre}: ${formatPrecio(p.precio)}/mes (${p.clientes} clientes, ${p.rutas} ruta${p.rutas > 1 ? 's' : ''}, ${p.usuarios} usuario${p.usuarios > 1 ? 's' : ''})`
  ).join('\n')
}
