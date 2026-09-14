'use client'

// lib/tactil.js — ¿esto se opera con el dedo o con el ratón?
//
// ══ POR QUÉ ESTÁ AQUÍ Y NO DENTRO DE UNA PANTALLA ═════════════════════════
//
// Lo decide una sola cosa: si la confirmación de un movimiento de dinero se
// DESLIZA o se pulsa. En el teléfono se desliza —el cobrador guarda con el
// pulgar y un toque de más no puede ser un pago—; con ratón arrastrar es un
// estorbo y no hay ese riesgo.
//
// Estaba escrito dentro de `components/pantallas/RegistrarCobro.jsx`, privado,
// y el resto de pantallas de cobro no podía alcanzarlo: así es como se acaba
// con el mismo gesto en una pantalla y otro distinto en la de al lado. Palabras
// del dueño el 14 sep 2026: «no que en un lado va a confirmar el pago
// rodándose hacia el lado y en otros lados no, entonces quedaría desalineado».
//
// ⚠ `pointer: coarse` y NO el ancho de la pantalla: una tableta ancha también
//   se opera con el dedo, y un portátil con pantalla táctil y ratón dice
//   `fine`, que es lo que de verdad usa.

import { useSyncExternalStore } from 'react'

const CONSULTA = '(pointer: coarse)'

export function suscribirTactil(avisar) {
  const mq = window.matchMedia(CONSULTA)
  mq.addEventListener('change', avisar)
  return () => mq.removeEventListener('change', avisar)
}

export function esTactil() {
  return window.matchMedia(CONSULTA).matches
}

/**
 * `true` en un teléfono o una tableta; `false` con ratón.
 *
 * En el servidor devuelve `false` a propósito: el primer pintado sale con el
 * botón, y si el aparato es táctil se cambia al deslizador en el mismo
 * fotograma de hidratación. Al revés —nacer deslizador— dejaría un control
 * arrastrable pintado en un PC durante un cuadro.
 */
export function useTactil() {
  return useSyncExternalStore(suscribirTactil, esTactil, () => false)
}
