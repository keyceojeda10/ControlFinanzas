// lib/cupo-clientes.js — el aviso de «te quedan pocos clientes» y la hoja
// «Desbloquea el plan…» (components/plan/CupoClientes.jsx). Aparte del
// componente para poder probarlo: vitest no transforma JSX en este proyecto.
//
// ⚠ POR QUÉ ASÍ (aprobado por el dueño el 1 nov 2026 con los mockups):
//   · Antes del tope, no en el tope: «la idea es que le llegue a esos
//     clientes que les faltan 15, 10 clientes». En el tope la app ya bloquea,
//     y ahí llega tarde y enojado.
//   · Sutil: una línea gris junto al conteo desde el 85 %, y la hoja solo DOS
//     veces (al cruzar el 85 % y el 95 %), con «Ahora no». «La gente se va a
//     emberracar si el banner molesta ahí todo el tiempo.»
//   · Se vende lo que gana, no el tope: nunca «ya no cabes» ni «$20.000 más que
//     hoy», sino «desbloquea… todo por solo $20.000 más al mes».
//   · El 1 nov, 8 de los 38 negocios del Inicial pasaban de 80 clientes.

import { PLANES_CONFIG, getPrecioPlan } from '@/lib/planes'

export const ORDEN_PLANES = ['starter', 'basic', 'growth', 'standard', 'professional']
export const UMBRALES = [0.85, 0.95]

export function planSiguiente(plan) {
  const i = ORDEN_PLANES.indexOf(plan)
  return i >= 0 && i < ORDEN_PLANES.length - 1 ? ORDEN_PLANES[i + 1] : null
}

/** ¿Se enseña la línea gris? Desde el 85 % del cupo de un plan que se puede subir. */
export function mostrarLineaCupo(uso) {
  const usado = Number(uso?.clientes?.usado)
  const limite = Number(uso?.clientes?.limite)
  if (!(limite > 0) || !Number.isFinite(limite) || !Number.isFinite(usado)) return false
  if (!planSiguiente(uso?.plan)) return false
  return usado / limite >= UMBRALES[0]
}

/**
 * El umbral cuya hoja toca enseñar ahora, o null. `vistos` = los umbrales
 * que ya salieron (se guardan en el aparato). Si entra ya pasado el 95 %, sale
 * la del 95 y la del 85 se da por vista: nunca dos hojas seguidas.
 */
export function umbralPendiente(uso, vistos = []) {
  if (!mostrarLineaCupo(uso)) return null
  const pct = Number(uso.clientes.usado) / Number(uso.clientes.limite)
  const alcanzados = UMBRALES.filter((u) => pct >= u)
  const mayor = alcanzados[alcanzados.length - 1]
  if (mayor == null || vistos.includes(mayor)) return null
  return mayor
}

/** Lo que gana al subir, dicho con los números del plan (nada a mano que se desactualice). */
export function beneficiosDeSubir(planActual) {
  const sig = planSiguiente(planActual)
  if (!sig) return null
  const a = PLANES_CONFIG[planActual]
  const b = PLANES_CONFIG[sig]
  const miles = (n) => n.toLocaleString('es-CO')
  const cobradores = (n) => `${n} ${n === 1 ? 'cobrador' : 'cobradores'}`
  const lista = []
  if (b.reportesNivel >= 1 && a.reportesNivel < 1) {
    lista.push(
      { icono: 'reportes', titulo: 'Reportes de tu negocio', texto: 'Lo que entró, lo que tienes en la calle, los cobros del mes y el resumen de cómo vas.' },
      { icono: 'excel', titulo: 'Toda tu cartera en Excel', texto: 'Clientes, cada pago uno por uno y todo en bruto, cuando lo necesites.' },
      { icono: 'papel', titulo: 'El reporte del día y el del contador', texto: 'La caja del día en un reporte, y lo que pide el contador sin armarlo a mano.' },
    )
  }
  if (b.maxUsuarios > a.maxUsuarios) {
    const n = b.maxUsuarios - 1
    lista.push({ icono: 'equipo', titulo: `${cobradores(n)} con su propia cuenta`, texto: 'Cada uno cobra desde su celular y tú ves lo que entró en el momento.' })
  }
  if (b.maxRutas > a.maxRutas) {
    lista.push({ icono: 'rutas', titulo: `Hasta ${b.maxRutas} rutas`, texto: 'Cada ruta con su caja y sus clientes en orden.' })
  }
  if (b.reportesNivel >= 2 && a.reportesNivel < 2) {
    lista.push({ icono: 'reportes', titulo: 'Cómo rinde cada ruta y cada cobrador', texto: 'Quién cobra más, qué ruta se atrasa y cómo rindió el negocio.' })
  }
  if (b.aiMensajesDia > a.aiMensajesDia) {
    lista.push({ icono: 'lucas', titulo: a.aiMensajesDia > 0 ? `Lucas con ${b.aiMensajesDia} mensajes al día` : 'Lucas, el asistente', texto: 'Le preguntas por tu negocio y registra pagos y gastos por chat o voz.' })
  }
  lista.push({ icono: 'clientes', titulo: `Hasta ${miles(b.maxClientes)} clientes`, texto: 'Espacio para crecer sin pensar en el tope.' })
  return { plan: sig, nombre: b.nombre, lista }
}

/** Cuánto más al mes cuesta el plan siguiente, a precio de lista del país. */
export function diferenciaMensual(planActual, country = 'co') {
  const sig = planSiguiente(planActual)
  if (!sig) return null
  return {
    diferencia: getPrecioPlan(sig, country) - getPrecioPlan(planActual, country),
    precioSiguiente: getPrecioPlan(sig, country),
  }
}

export const llaveCupo = (orgId, plan, umbral) => `cf-cupo:${orgId}:${plan}:${Math.round(umbral * 100)}`
