// lib/bot-v2/kb.js — LA FUENTE ÚNICA DE VERDAD DEL PRODUCTO (BOT v3 · sprint 5).
//
// Todo lo que cualquier bot puede afirmar sale de aquí: la empresa, la prueba,
// los planes, las funciones y lo que NO existe. Los dos bots —el conversacional
// y el de anuncios por botones— leen esto; antes cada uno tenía sus textos,
// precios y enlaces, y ya obligó a corregir el mismo dato en dos sitios.
//
// ⚠ LOS PLANES VAN POR SU NOMBRE VISIBLE. La clave interna de `lib/planes.js`
// no dice lo que el cliente ve: `professional` es «Empresarial» y `standard`
// es «Profesional». Ese enredo hizo acusar en falso a una auditoría externa
// (8 sep 2026). Aquí cada plan lleva su `nombre` y se busca por él.
//
// ⚠ LAS FUNCIONES LLEVAN IDENTIFICADOR. Con él se puede saber, leyendo el
// historial, qué argumentos YA usó el bot (`funcionesMencionadas`) para no
// repetirlos: la repetición era el fallo #2 de las auditorías (21,6 % de las
// conversaciones), y «no repetir» por parecido de palabras no alcanza —dos
// frases distintas pueden ser el mismo argumento.

import { PLANES_CONFIG, DIAS_PRUEBA, getPrecioPlan, planTieneIA, planTieneFotos } from '@/lib/planes'

export const EMPRESA = {
  nombre: 'Control Finanzas',
  descripcion: 'Sistema de cartera y cobros para prestamistas',
  linkRegistro: 'https://app.control-finanzas.com/registro?r=2',
  linkApp: 'https://app.control-finanzas.com',
  linkPago: 'https://app.control-finanzas.com/configuracion/plan',
  linkLanding: 'https://control-finanzas.com',
  telefonoSoporte: '301 199 3001',
  horarioSoporte: '7am a 10pm',
  horarioSoporteLargo: 'de lunes a domingo, de 7 de la mañana a 10 de la noche',
  waSoporte: 'https://wa.me/573011993001',
  diasPrueba: DIAS_PRUEBA,
  linkCalendario15: 'https://cal.com/control-finanzas/15min',
  /* ⚠ EL ÚNICO ENLACE DE VÍDEO QUE UN BOT PUEDE MANDAR. */
  linkTutoriales: 'https://youtube.com/playlist?list=PLOttIYxPScdU&si=p50ySB1TZkf_HhAW',
}

export const PRUEBA = { dias: DIAS_PRUEBA, pideTarjeta: false }

const VISIBLES = ['starter', 'basic', 'growth', 'standard', 'professional']
export const PLANES = VISIBLES.map((clave) => {
  const p = PLANES_CONFIG[clave]
  return {
    clave, nombre: p.nombre, precio: p.precio, clientes: p.maxClientes, rutas: p.maxRutas,
    usuarios: p.maxUsuarios, cobradorExtra: p.cobradorExtra, rutaExtra: p.rutaExtra,
    ia: planTieneIA(clave), fotos: planTieneFotos(clave),
    precioEn: (pais) => getPrecioPlan(clave, pais),
  }
})
export const planPorNombre = (nombre) => PLANES.find((p) => p.nombre.toLowerCase() === String(nombre || '').toLowerCase()) || null
export const EXTRAS = { cobradorExtra: 19000, rutaExtra: 29000 }

/* Cada función: lo que el bot puede decir (`texto`), dónde reconocerla en lo
   que ya dijo (`claves`), y desde qué plan existe. */
export const FUNCIONES = [
  { id: 'prestamos', texto: 'Registrar prestamos diarios, semanales, quincenales o mensuales', claves: /pr[eé]stamos? (?:diarios?|semanal|quincenal|mensual)|registra(?:r)? (?:el |los |sus )?pr[eé]stamos?/i, planes: 'todos' },
  { id: 'cobros', texto: 'Cobros: calcula cuotas automaticamente, acepta pagos parciales y recargos', claves: /calcula (?:las )?cuotas|pagos? parcial|recargos?|le calcula todo/i, planes: 'todos' },
  { id: 'mercancia', texto: 'Mercancia: entregar articulos a cuotas con ganancia automatica', claves: /mercanc[ií]a|art[ií]culos a cuotas/i, planes: 'todos' },
  { id: 'cobradores', texto: 'Cobradores con su propio acceso (solo ven sus clientes asignados)', claves: /cobradores? (?:con|entra|tiene|registra)|propio (?:acceso|usuario)|cada (?:cobrador|uno) (?:entra|registra)|lo que (?:cada )?cobr[oó] cada/i, planes: ['growth', 'standard', 'professional'] },
  { id: 'tiempo_real', texto: 'Usted ve en tiempo real cuanto cobro cada cobrador, sin esperarlo', claves: /tiempo real|al segundo|al instante|sin (?:tener que )?esperar/i, planes: ['growth', 'standard', 'professional'] },
  { id: 'rutas', texto: 'Rutas de cobro por zona, cada una con su capital independiente', claves: /rutas? (?:de cobro|por zona)|capital (?:por|de cada) ruta/i, planes: 'todos' },
  { id: 'recibos', texto: 'Recibos de pago listos para enviar por WhatsApp', claves: /recibos?|comprobantes?/i, planes: 'todos' },
  { id: 'caja', texto: 'Control de capital y caja diaria', claves: /\bcaja\b|control de capital|cu[aá]nto entr[oó]/i, planes: 'todos' },
  { id: 'seguro', texto: 'Seguro por prestamo (registra la ganancia extra)', claves: /seguro por pr[eé]stamo|\bseguro\b/i, planes: 'todos' },
  { id: 'reportes', texto: 'Reportes de ingresos, mora y cobros', claves: /reportes?|informes?/i, planes: 'todos' },
  { id: 'mora', texto: 'Le marca en rojo los clientes que no pagan, asi no se le pasa ninguno', claves: /\bmora\b|en rojo|qui[eé]n (?:no )?pag[oó]|se atras[oó]|atrasados?/i, planes: 'todos' },
  { id: 'saldo_calle', texto: 'Usted sabe al segundo cuanto le deben en total, sin sumar a mano', claves: /cu[aá]nto le deben|en la calle|sin sumar|sumar a mano|sacar la calculadora/i, planes: 'todos' },
  { id: 'offline', texto: 'Funciona sin internet despues de cargar', claves: /sin internet|sin se[ñn]al|offline|sin conexi[oó]n/i, planes: 'todos' },
  { id: 'importar_foto', texto: 'Importar clientes desde cartulinas con foto (la IA los lee)', claves: /cartulinas?|foto(?:s)? (?:del|de la|al) (?:cuaderno|libreta|hoja)|pasar (?:mi |el )?cuaderno/i, planes: 'todos' },
  { id: 'gps', texto: 'GPS del cobrador en tiempo real (el administrador ve donde esta el cobrador en el mapa)', claves: /\bgps\b|en el mapa|d[oó]nde est[aá] (?:el|cada) cobrador/i, planes: ['growth', 'standard', 'professional'] },
  { id: 'firma', texto: 'Firma digital del cliente al recibir el prestamo', claves: /firma digital|firma del cliente/i, planes: 'todos' },
  { id: 'excel_export', texto: 'Exportar datos a Excel (clientes, prestamos, pagos, cobradores)', claves: /exportar? (?:a )?excel|bajar (?:a |en )?excel|en excel/i, planes: 'todos' },
  { id: 'reporte_diario', texto: 'Reporte diario imprimible con pagos, pendientes y gastos', claves: /reporte diario|imprimible/i, planes: 'todos' },
  { id: 'hoja_ruta', texto: 'Hoja de ruta imprimible para entregar al cobrador en papel', claves: /hoja de ruta/i, planes: 'todos' },
  { id: 'lucas', texto: 'Lucas IA: un asistente dentro de la app al que le pregunta por su negocio y le registra pagos por chat. Viene desde el plan Crecimiento en adelante (no esta en Inicial ni Basico)', claves: /\blucas\b|inteligencia artificial|asistente (?:de ia|inteligente|dentro)/i, planes: ['growth', 'standard', 'professional'] },
  { id: 'importar_excel', texto: 'Importar clientes desde un Excel o CSV: sube el archivo que ya tenga y el sistema detecta las columnas solo, sin plantilla', claves: /importar (?:desde )?excel|sube(?:s)? (?:el|su|tu) excel|detecta las columnas|csv/i, planes: 'todos' },
  { id: 'modos_interes', texto: 'Modos de interes distintos para que el calculo se ajuste a como presta cada quien', claves: /modos? de inter[eé]s|c[oó]mo presta cada/i, planes: 'todos' },
  { id: 'simulador', texto: 'Simulador de cuota para ensenarle al cliente lo que pagaria, sin registrar nada', claves: /simulador|simular (?:la )?cuota/i, planes: 'todos' },
  { id: 'prueba', texto: `${DIAS_PRUEBA} dias de prueba gratis, sin tarjeta`, claves: /d[ií]as (?:de prueba )?gratis|prueba gratis|probarlo (?:gratis|sin)/i, planes: 'todos' },
]

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
  'debito automatico', 'debito de tu cuenta', 'debito de su cuenta',
  'se debita de tu cuenta', 'se debita de su cuenta',
  'descuento automatico de la cuenta', 'debito de tu cuenta bancaria',
  'app en Play Store', 'app en App Store', 'App Store', 'Play Store', 'Google Play',
  'descargar la app', 'descargar app', 'descargar desde',
  'chat con deudores',
  'modulo contable', 'facturacion electronica',
]

/** Los textos que van al prompt (misma forma que siempre). */
export const funcionesTexto = () => FUNCIONES.map((f) => f.texto)

/** Qué funciones aparecen nombradas en un texto (el bot suyo, normalmente). */
export function funcionesMencionadas(texto) {
  const t = String(texto || '')
  return FUNCIONES.filter((f) => f.claves.test(t)).map((f) => f.id)
}
