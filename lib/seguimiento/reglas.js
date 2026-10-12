/* ── LAS REGLAS DEL MOTOR DE SEGUIMIENTO ─────────────────────────────────────
 *
 * Funciones puras: reciben lo que sabe la base y devuelven qué toca. El motor
 * (`motor.js`) las alimenta y envía; las pruebas las ejercitan con relojes
 * de mentira. Ver docs/superpowers/specs/2026-10-12-seguimiento-activacion-retencion-design.md.
 *
 * ⚠ DESDE EL 1 OCT 2026 CADA MENSAJE SE COBRA, también las respuestas. Por eso
 *   un mensaje al día como máximo por negocio, en horario, y nunca a quien dijo
 *   «No quiero más mensajes».
 */

import { NO_MAS_MENSAJES } from './plantillas'

const DIA = 86400000
const OFFSET_BOGOTA = 5 * 3600000

/** Las horas de Bogotá en que se puede escribir: de 8 a. m. a 7 p. m. */
export const HORA_DESDE = 8
export const HORA_HASTA = 19

/** Clientes desde los que una cuenta se escala a Carlos por Telegram. */
export const CLIENTES_PARA_ESCALAR = 100

/** Días sin entrar a la app para estar «en riesgo» (cliente que paga). */
export const DIAS_EN_RIESGO = 7

/** Desde cuándo entran las bajas al reenganche: rescata a las de septiembre. */
export const BAJAS_DESDE = new Date('2026-09-01T05:00:00.000Z')

export const DESCUENTO_NEQUI = 0.35

export function diaBogota(fecha) {
  return new Date(new Date(fecha).getTime() - OFFSET_BOGOTA).toISOString().slice(0, 10)
}

export function horaBogota(ahora = new Date()) {
  return new Date(new Date(ahora).getTime() - OFFSET_BOGOTA).getUTCHours()
}

export function enHorario(ahora = new Date()) {
  const h = horaBogota(ahora)
  return h >= HORA_DESDE && h < HORA_HASTA
}

/** Días enteros entre dos fechas (redondeo hacia abajo). */
export function diasEntre(desde, hasta = new Date()) {
  return Math.floor((new Date(hasta).getTime() - new Date(desde).getTime()) / DIA)
}

/** ¿Se le puede escribir hoy? Nunca con `noMolestar`; uno al día como máximo. */
export function puedeEnviarHoy(seg, ahora = new Date()) {
  if (seg?.noMolestar) return false
  if (!seg?.ultimoEnvioAt) return true
  return diaBogota(seg.ultimoEnvioAt) !== diaBogota(ahora)
}

/* ── Las respuestas del «¿nos dice el motivo?» ── */
export const MOTIVOS = {
  'El precio': 'precio',
  'No alcancé a usarla': 'no_uso',
  'Me falta algo': 'falta_algo',
  'Cambié de sistema': 'otro_sistema',
  'Cerré el negocio': 'cerro',
  'Otro motivo': 'otro',
}

const normal = (t) => String(t ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** El motivo de un botón; `null` si el texto no es uno de los botones. */
export function motivoDeRespuesta(texto) {
  const t = normal(texto)
  for (const [boton, motivo] of Object.entries(MOTIVOS)) if (normal(boton) === t) return motivo
  return null
}

export function esNoMasMensajes(texto) {
  const t = normal(texto)
  return t === normal(NO_MAS_MENSAJES) || /^(stop|no (me )?(escriban|manden|envien) mas|no quiero (mas )?mensajes)\b/.test(t)
}

/** «Sí quiero volver», «llámeme», «¿cuánto me sale?»: alguien a quien llamar hoy. */
export function esRespuestaPositiva(texto) {
  const t = normal(texto)
  // «No quiero pagar», «no me interesa»: una negación delante no es un sí.
  if (/^no\b|\bno (me )?interesa|\bno quiero\b/.test(t)) return false
  return /\b(si quiero|quiero volver|quiero seguir|volver|llam(e|ame|eme|enme)|cuanto (me )?(sale|cuesta|vale)|precio\?|me interesa|activar|renovar|pagar)\b/.test(t)
}

/**
 * El paso del reenganche que toca a quien se fue. Los días cuentan desde el
 * «¿nos dice el motivo?» y no desde el vencimiento: así las bajas de
 * septiembre, que ya pasaron los 21 días, empiezan por la pregunta (que es lo
 * que más vale saber) y no por el último mensaje.
 *
 *   D+3  `d3_motivo`   (el D+1 lo sigue mandando churn-whatsapp)
 *   +4   `d7_oferta`   solo si dijo «el precio» y la oferta no se aplicó
 *   +18  `d21_datos`   salvo que haya cerrado el negocio
 *
 * @param {object} p
 * @param {number} p.diasVencido   días desde que venció
 * @param {object} p.enviados      { paso: { createdAt } } de ESTE caso
 * @param {string|null} p.motivo   motivoBaja
 * @param {string|null} p.ofertaNequi
 */
export function pasoVencido({ diasVencido, enviados = {}, motivo = null, ofertaNequi = null, ahora = new Date() }) {
  if (!enviados.d3_motivo) return diasVencido >= 3 ? 'd3_motivo' : null
  const desdeMotivo = diasEntre(enviados.d3_motivo.createdAt, ahora)
  if (!enviados.d7_oferta && motivo === 'precio' && ofertaNequi !== 'aplicada' && desdeMotivo >= 4) return 'd7_oferta'
  if (!enviados.d21_datos && motivo !== 'cerro' && desdeMotivo >= 18) return 'd21_datos'
  return null
}

/**
 * ¿Hay que avisarle a Carlos? Solo cuentas de 100 clientes o más, una vez por
 * caso. Devuelve la acción sugerida, o `null`.
 */
export function motivoParaEscalar({ clientes, caso, envioMotivo = null, motivo = null, positiva = false, yaEscalado = false, ahora = new Date() }) {
  if (yaEscalado || !(Number(clientes) >= CLIENTES_PARA_ESCALAR)) return null
  if (positiva) return 'Llamar hoy: respondió que quiere volver o preguntó el precio.'
  if (motivo === 'precio') return 'Llamar y ofrecer el 35 % con el Nequi guardado.'
  if (motivo === 'otro_sistema') return 'Llamar: preguntar a qué sistema se fue y qué le faltó aquí.'
  if (caso === 'en_riesgo') return 'Llamar: es cliente que paga y lleva una semana sin entrar.'
  if (caso === 'vencido' && envioMotivo && !envioMotivo.respuesta
    && new Date(ahora).getTime() - new Date(envioMotivo.createdAt).getTime() >= 48 * 3600000) {
    return 'Llamar: no respondió en 48 h a la pregunta de por qué se fue.'
  }
  return null
}

/** El precio con el 35 % de descuento, redondeado a la centena. */
export function precioConDescuento(precioMes) {
  return Math.round((Number(precioMes) * (1 - DESCUENTO_NEQUI)) / 100) * 100
}

/* ── LA PRUEBA DE 7 + 7: QUÉ LE TOCA HOY ──
 * El disparador más urgente gana, y uno al día (el límite lo pone el motor).
 * Lo que no pasa como utility (un empujón de uso) va por push, que es gratis;
 * el WhatsApp es `cobros_de_hoy`, que habla de SU agenda. Ver el plan, §7. */
export const CLIENTES_CARTERA = 6
export const MAX_COBROS_DE_HOY_WHATSAPP = 3

/**
 * @param {object} c
 * @param {number} c.horasDesdeRegistro
 * @param {number} c.clientes
 * @param {number} c.diasCobro       días distintos con cobros registrados
 * @param {number} c.diasParaRegalo  los que pide el regalo (3)
 * @param {boolean} c.cobroHoy / c.cobroAyer
 * @param {number|null} c.horasSinUso
 * @param {number} c.diasParaVencer
 * @param {boolean} c.premio         ya ganó el regalo
 * @param {number} c.cobrosHoy       cuotas que le tocan hoy
 * @param {number} c.hora            hora de Bogotá
 * @param {string} c.dia             'YYYY-MM-DD' de hoy
 * @param {string} c.finPrueba       'YYYY-MM-DD' del vencimiento
 * @param {Set<string>} c.enviados   pasos ya mandados en esta prueba
 * @returns {{ paso: string, canal: 'whatsapp'|'push', plantilla?: string, aviso?: string } | null}
 */
export function pasoPrueba(c) {
  const ya = (p) => c.enviados.has(p)
  const cobrosWa = [...c.enviados].filter((p) => p.startsWith('cobros:')).length
  const cobrosDeHoyWa = () => (cobrosWa < MAX_COBROS_DE_HOY_WHATSAPP && !ya(`cobros:${c.dia}`) && c.cobrosHoy > 0)
    ? { paso: `cobros:${c.dia}`, canal: 'whatsapp', plantilla: 'cobros_de_hoy' } : null

  // 1 · Faltan 2 días: lo que hizo y que sus datos quedan.
  if (c.diasParaVencer <= 2 && !ya(`por_vencer:${c.finPrueba}`)) {
    return { paso: `por_vencer:${c.finPrueba}`, canal: 'whatsapp', plantilla: 'prueba_por_vencer' }
  }
  // 2 · Le falta un día de cobro para el regalo (solo app: es un empujón).
  if (!c.premio && c.diasCobro === c.diasParaRegalo - 1 && !c.cobroHoy && !ya('casi_regalo')) {
    return { paso: 'casi_regalo', canal: 'push', aviso: 'casi_regalo' }
  }
  // 3 · Un día después de registrarse y sin cartera.
  if (c.clientes < CLIENTES_CARTERA && c.horasDesdeRegistro >= 24 && !ya('configurar')) {
    return { paso: 'configurar', canal: 'whatsapp', plantilla: 'cuenta_configurar' }
  }
  // 4 · Tiene cartera y nunca ha cobrado.
  if (c.clientes >= CLIENTES_CARTERA && c.diasCobro === 0 && c.horasDesdeRegistro >= 24 && !c.cobroHoy) {
    const wa = cobrosDeHoyWa()
    if (wa) return wa
  }
  // 5 · Cobró ayer y hoy todavía no, desde las 11 a. m.
  if (c.cobroAyer && !c.cobroHoy && c.hora >= 11 && c.cobrosHoy > 0) {
    if (c.horasSinUso != null && c.horasSinUso >= 24) {
      const wa = cobrosDeHoyWa()
      if (wa) return wa
    }
    if (!ya(`recordatorio:${c.dia}`)) return { paso: `recordatorio:${c.dia}`, canal: 'push', aviso: 'recordatorio' }
  }
  // 6 · Dos días sin usar la app.
  if (c.horasSinUso != null && c.horasSinUso >= 48 && !c.cobroHoy) {
    const wa = cobrosDeHoyWa()
    if (wa) return wa
  }
  return null
}

/** Las claves de cada episodio: un vencimiento, una racha sin entrar. */
export const claveVencido = (orgId, fechaVencimiento) => `vencido:${orgId}:${diaBogota(fechaVencimiento)}`
export const claveEnRiesgo = (orgId, ultimoIngreso) => `en_riesgo:${orgId}:${diaBogota(ultimoIngreso)}`
export const claveCampanaNequi = (orgId) => `campana_nequi:${orgId}`
