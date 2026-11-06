// lib/dinero/aviso-de-cuenta.js — QUÉ DECIR DE LA CUENTA DE LA QUE SALE UN PRÉSTAMO.
//
// ══ POR QUÉ NO SE PUEDE DECIR «FALTAN» SIEMPRE (6 nov 2026) ═════════════════
//
// El saldo de una cuenta es lo que la app vio pasar por ella. Pero el capital con
// que arranca un negocio, los préstamos cargados del cuaderno y los cobros de antes
// de que existieran las cuentas se guardaron SIN cuenta: nadie dijo de cuál salieron.
// Esa plata existe —es parte del capital— y no está en ninguna cuenta.
//
// Crediya, 6 nov: prestó $350.000 por Bancolombia y la app le dijo «En Bancolombia
// hay −$28.745.471: faltan $29.095.471», con $5.583.498 de capital y $69.374.612
// sin cuenta. Medido: 209 negocios con plata sin cuenta y alguna cuenta en negativo,
// 65 de ellos activos.
//
// Así que «faltan» solo se dice cuando la plata sin cuenta NO alcanza a explicar lo
// que falta. Si alcanza, la app no sabe cuánto hay en esa cuenta y no lo afirma. Que
// el negocio entero tenga con qué prestar lo dice otra línea, la del capital.

/** Las filas cuya plata no tiene cuenta conocida (ver `getSaldosPorCuenta`). */
const SIN_CUENTA_CONOCIDA = (c) => c.tipoCuenta === 'sin_registrar' || c.tipoCuenta === 'ajuste' || c.key === 'transferencia'

/** Las cuentas de verdad, de las que se puede pasar plata. */
const CUENTA_REAL = (c) => c.key === 'efectivo' || (c.tipoCuenta === 'transferencia' && c.key !== 'transferencia')

/**
 * @param {object[]} cuentas  lo que devuelve /api/caja/cuentas («Todo»)
 * @param {string} clave      'efectivo' o el id de la cuenta elegida
 * @param {number} monto
 * @returns {null | { tipo: 'alcanza'|'falta', nombre, hay, falta, enOtras, sePuedePasar }}
 *          null = no hay nada que decir
 */
export function avisoDeCuenta(cuentas, clave, monto) {
  const lista = Array.isArray(cuentas) ? cuentas : []
  const cuenta = clave ? lista.find((c) => c.key === clave) : null
  const n = Math.round(Number(monto) || 0)
  if (!cuenta || !(n > 0)) return null

  const hay = Math.round(Number(cuenta.neto) || 0)
  const falta = n - hay
  if (falta <= 0) return { tipo: 'alcanza', nombre: cuenta.nombre, hay, falta: 0, enOtras: 0, sePuedePasar: false }

  const sinCuenta = Math.round(lista.filter(SIN_CUENTA_CONOCIDA).reduce((a, c) => a + (Number(c.neto) || 0), 0))
  // La plata sin cuenta puede estar justo en esta cuenta: no se afirma que falte.
  if (sinCuenta >= falta) return null

  const enOtras = Math.round(lista
    .filter((c) => c.key !== clave && CUENTA_REAL(c))
    .reduce((a, c) => a + Math.max(0, Number(c.neto) || 0), 0))
  return { tipo: 'falta', nombre: cuenta.nombre, hay, falta, enOtras, sePuedePasar: enOtras >= falta }
}
