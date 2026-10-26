/* ── ⚠ CUANDO META CORTA LA CUENTA, LOS AVISOS ESPERAN (26 oct 2026) ────────
 *
 * Del 23 al 26 de octubre Meta rechazó todo con 131042 (pago de la cuenta de
 * WhatsApp). El bot se recuperó solo —devuelve el intento y reintenta (ver el
 * webhook)—, pero los avisos de la app no: Meta acepta el envío con un 200 y
 * avisa del rechazo MINUTOS después por el webhook, que solo miraba las
 * conversaciones del bot. Los avisos quedaron como `ok: true` y la clave única
 * (`claveCaso`, `paso`) impidió repetirlos: 17 negocios vencieron su prueba o
 * su plan sin enterarse.
 *
 * Ahora el rechazo se apunta en el aviso (`ok: false` y el error de Meta) y,
 * si fue un CORTE de la cuenta, `enviarPaso` lo vuelve a intentar en su
 * siguiente vuelta. Un rechazo del número (no tiene WhatsApp, bloqueó) no se
 * repite: volvería a fallar cada vez.
 */

// Los mismos que `CODIGOS_CORTE` del webhook: la cuenta, no el número.
export const CODIGOS_DE_CORTE = ['131042', '131031', '368']

export function esErrorDeCorte(texto) {
  const codigo = (String(texto ?? '').match(/^(\d+)/) || [])[1]
  return CODIGOS_DE_CORTE.includes(codigo)
}

/** Un aviso que no llegó porque la cuenta estaba cortada, y nadie respondió. */
export function reintentableTrasCorte(fila) {
  return Boolean(fila) && fila.canal === 'whatsapp' && !fila.ok && !fila.respondidoAt && esErrorDeCorte(fila.error)
}

/** El rechazo de Meta llega por el webhook: se apunta donde se mandó. */
export async function marcarEnvioFallido(db, wamid, errorEntrega) {
  if (!wamid) return
  const data = { ok: false, error: String(errorEntrega ?? 'fallido').slice(0, 2000) }
  await db.envioWhatsapp.updateMany({ where: { wamid }, data })
  await db.envioSeguimiento.updateMany({ where: { wamid, canal: 'whatsapp' }, data })
}
