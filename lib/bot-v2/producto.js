// lib/bot-v2/producto.js — Fuente unica de verdad sobre el producto.
// Todo lo que el bot puede decir sale de aqui. Si no esta aqui, NO EXISTE.
// Precios se importan de lib/planes.js para evitar duplicacion.

import { PLANES_CONFIG } from '@/lib/planes'

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

const PLANES_VISIBLES = ['starter', 'basic', 'growth', 'standard', 'professional']

export const PLANES = PLANES_VISIBLES.map(key => {
  const p = PLANES_CONFIG[key]
  return {
    key,
    nombre: p.nombre,
    precio: p.precio,
    clientes: p.maxClientes,
    rutas: p.maxRutas,
    usuarios: p.maxUsuarios,
    cobradorExtra: p.cobradorExtra,
    rutaExtra: p.rutaExtra,
  }
})

export const EXTRAS = { cobradorExtra: 19000, rutaExtra: 29000 }

export const PRECIOS_VALIDOS = new Set(PLANES.map(p => p.precio))

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
  'GPS del cobrador en tiempo real (el administrador ve donde esta el cobrador en el mapa)',
  'Firma digital del cliente al recibir el prestamo',
  'Exportar datos a Excel (clientes, prestamos, pagos, cobradores)',
  'Reporte diario imprimible con pagos, pendientes y gastos',
  'Hoja de ruta imprimible para entregar al cobrador en papel',
]

// BLACKLIST: cosas que NO existen y el bot JAMAS debe mencionar
export const NO_EXISTE = [
  'pago en tiendas', 'corresponsales', 'Efecty', 'Baloto', 'puntos de pago',
  'pasarela de pago', 'PSE', 'Nequi', 'Daviplata', 'pago con tarjeta',
  'notificaciones automaticas a deudores',
  'recordatorio automatico', 'recordatorios automaticos',
  'recordatorio de cobro', 'recordatorios de cobro',
  'aviso automatico de pago', 'aviso automatico de cobro',
  'aviso automatico el dia del pago',
  'envia recordatorios', 'recibe su aviso',
  'integracion con bancos', 'integracion con billeteras',
  'app en Play Store', 'app en App Store', 'App Store', 'Play Store', 'Google Play',
  'descargar la app', 'descargar app', 'descargar desde',
  'chat con deudores',
  'modulo contable', 'facturacion electronica',
  'inteligencia artificial para el prestamista',
]

export function planRecomendado(cantClientes) {
  if (!cantClientes) return PLANES[0]
  if (typeof cantClientes === 'number') {
    return _planPorCantidad(cantClientes)
  }
  const s = String(cantClientes).toLowerCase()
  const nums = s.match(/\d+/g)
  if (nums) {
    const n = Math.max(...nums.map(Number))
    return _planPorCantidad(n)
  }
  if (s.includes('menos') || s.includes('pocos') || s.includes('poco')) return PLANES[0]
  if (s.includes('mas') || s.includes('más') || s.includes('muchos') || s.includes('bastantes')) return PLANES[2]
  return PLANES[0]
}

function _planPorCantidad(n) {
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

export function textoPlanesConExtras() {
  return PLANES.map(p => {
    let linea = `${p.nombre}: ${formatPrecio(p.precio)}/mes (${p.clientes} clientes, ${p.rutas} ruta${p.rutas > 1 ? 's' : ''}, ${p.usuarios} usuario${p.usuarios > 1 ? 's' : ''})`
    if (p.cobradorExtra > 0) {
      linea += ` — permite agregar cobradores extra (${formatPrecio(p.cobradorExtra)}/mes c/u) y rutas extra (${formatPrecio(p.rutaExtra)}/mes c/u)`
    }
    return linea
  }).join('\n')
}

export function textoPreciosAnuales() {
  return PLANES.map(p => {
    const anual = p.precio * 10
    return `${p.nombre}: ${formatPrecio(anual)} al año (UN SOLO PAGO de ${formatPrecio(anual)}, equivale a 10 meses, 2 meses gratis). OJO: NO es ${formatPrecio(p.precio)}/año.`
  }).join('\n')
}
