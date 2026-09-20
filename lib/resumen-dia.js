// lib/resumen-dia.js — las dos piezas puras del resumen del día.
//
// Viven aquí y no en `app/api/cron/resumen-diario/route.js` porque un fichero de
// ruta de Next solo puede exportar sus verbos HTTP: cualquier otro `export` hace
// fallar la compilación. Y puras, para probarlas sin base de datos.

import { getUtcOffset } from '@/lib/i18n'

const plata = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`

/** La hora y la fecha locales de un país, ahora. */
export function relojLocal(country = 'co', ahora = new Date()) {
  const desfase = Math.abs(getUtcOffset(country))
  const local = new Date(ahora.getTime() - desfase * 3600000)
  return { hora: local.getUTCHours(), fecha: local.toISOString().slice(0, 10) }
}

/** La frase del resumen. Pura, para poder probarla sin base de datos. */
export function textoDelResumen({ cobrado, cobros, prestado, prestamos, gastos, atrasados, sinCerrar = [] }) {
  const partes = []
  partes.push(cobros === 1 ? '1 cobro' : `${cobros} cobros`)
  if (prestamos > 0) partes.push(`${prestamos === 1 ? '1 préstamo nuevo' : `${prestamos} préstamos nuevos`} por ${plata(prestado)}`)
  if (gastos > 0) partes.push(`${plata(gastos)} en gastos`)
  if (atrasados > 0) partes.push(atrasados === 1 ? '1 cliente se atrasó' : `${atrasados} clientes se atrasaron`)
  if (sinCerrar.length > 0) {
    const nombres = sinCerrar.slice(0, 2).join(' y ')
    const mas = sinCerrar.length > 2 ? ` y ${sinCerrar.length - 2} más` : ''
    partes.push(`${nombres}${mas} ${sinCerrar.length === 1 ? 'no ha cerrado' : 'no han cerrado'} la caja`)
  }
  return {
    titulo: `Hoy entraron ${plata(cobrado)}`,
    mensaje: `${partes.join(' · ')}.`,
  }
}

