// lib/aviso-pagar-ano.js — cuándo sale la hoja «Paga el año» al estar por
// vencer el plan (components/pagos/AvisoPagarElAno.jsx). Aparte del componente
// para poder probarlo: vitest no transforma JSX en este proyecto.
//
// ⚠ POR QUÉ EXISTE: el 1 nov 2026, 54 de los 55 negocios que pagan lo hacían
//   mes a mes y a mano, y uno solo había pagado más de un mes. El anual (10
//   meses por 12) existía, pero la pantalla del plan solo lo enseñaba si la
//   persona cambiaba a «Pago yo». Quien paga a mano decide cada mes si
//   renueva: ese momento es donde el año tiene que estar a la vista.

import { debeAbrirseVentanaNequi } from '@/lib/oferta-nequi-aviso'

/* Desde cuántos días antes de vencer. Con un día o menos sale la ventana de la
   cuenta regresiva (SuscripcionBanner); no se le pone otra encima. */
export const DIAS_DESDE = 5
export const DIAS_HASTA = 2

export function debeAbrirseHojaAno(estado, { rol, ahora = Date.now() } = {}) {
  if (rol !== 'owner' || !estado) return false
  if (estado.planPagado !== true) return false
  if (estado.cobroAutomatico?.activo) return false
  const recurrenteOk = estado.tipo === 'recurrente' && estado.mpStatus === 'authorized' && !estado.canceladaAt
  if (recurrenteOk || estado.tieneRecurrenteActiva) return false
  // El primer mes pagado tiene su propia oferta (el 50 % del segundo mes).
  if (estado.ofertaSegundoMes) return false
  const dias = Number(estado.diasRestantes)
  if (!(dias >= DIAS_HASTA && dias <= DIAS_DESDE)) return false
  // Si la ventana del Nequi está por abrirse, habla ella primero: dos ventanas
  // seguidas es lo que hace que la gente cierre todo sin leer.
  if (debeAbrirseVentanaNequi(estado, { rol, ahora })) return false
  return true
}

/** La llave que dice que esta hoja ya salió para ESTE vencimiento. */
export function llaveHojaAno(orgId, fechaVencimiento) {
  return `cf-hoja-ano:${orgId}:${String(fechaVencimiento ?? '').slice(0, 10)}`
}
