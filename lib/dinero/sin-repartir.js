// lib/dinero/sin-repartir.js — EL CAPITAL QUE NO ESTÁ EN NINGUNA CUENTA.
//
// El capital con que arranca un negocio, los préstamos del cuaderno y lo cobrado
// antes de que cada movimiento llevara cuenta se guardaron sin cuenta. Es plata del
// negocio: está en su capital, pero la app no sabe si está en Nequi, en el banco o
// en la mano. `getSaldosPorCuenta` la deja en tres cajones con nombres de sistema
// («Sin registrar», «Ajustes sin cuenta», «Transferencia (sin cuenta)»); aquí se
// juntan en uno, con el nombre de lo que es para el dueño.
//
// La reparte el dueño, diciendo cuánto tiene hoy en cada cuenta
// (`/api/caja/cuentas/cuadrar`): es lo único exacto. Crediya, 6 nov 2026:
// $69.374.612 sin repartir y cada cuenta en negativo. Ver memoria `plata_sin_cuenta`.

export const SIN_REPARTIR = 'sin_repartir'
export const NOMBRE_SIN_REPARTIR = 'Capital sin repartir'

/** ¿Esta fila es plata cuya cuenta no se sabe? */
export function esSinCuentaConocida(c) {
  return !!c && (c.key === SIN_REPARTIR || c.tipoCuenta === 'sin_registrar' || c.tipoCuenta === 'ajuste' || c.key === 'transferencia')
}

const CAMPOS = ['entradas', 'salidas', 'neto', 'recaudado', 'inyectado', 'prestado', 'gastos', 'retirado', 'ajustado', 'trasladado']

/** Las cuentas, con lo que no tiene cuenta junto en una sola fila al final. */
export function juntarSinRepartir(cuentas = []) {
  const lista = (cuentas ?? []).filter(Boolean)
  const sin = lista.filter(esSinCuentaConocida)
  const resto = lista.filter((c) => !esSinCuentaConocida(c))
  if (!sin.length) return resto
  const fila = { key: SIN_REPARTIR, nombre: NOMBRE_SIN_REPARTIR, tipoCuenta: SIN_REPARTIR }
  for (const k of CAMPOS) fila[k] = sin.reduce((a, c) => a + (Number(c[k]) || 0), 0)
  return [...resto, fila]
}

/** Cuánto capital no está en ninguna cuenta. */
export function capitalSinRepartir(cuentas = []) {
  return Math.round((cuentas ?? []).filter(esSinCuentaConocida).reduce((a, c) => a + (Number(c.neto) || 0), 0))
}

/**
 * Lo que hay que mover para que cada cuenta quede en lo que el dueño dice tener.
 * @param {object[]} cuentas  las de `getSaldosPorCuenta` («Todo»)
 * @param {{key:string, tiene:number}[]} dice
 * @returns {{ key, nombre, antes, ahora, diferencia }[]} solo las que cambian
 */
export function cuadreDeCuentas(cuentas = [], dice = []) {
  const salida = []
  for (const d of dice ?? []) {
    const c = (cuentas ?? []).find((x) => x.key === d?.key && !esSinCuentaConocida(x))
    const tiene = Math.round(Number(d?.tiene))
    if (!c || !Number.isFinite(tiene) || tiene < 0) continue
    const antes = Math.round(Number(c.neto) || 0)
    if (tiene === antes) continue
    salida.push({ key: c.key, nombre: c.nombre, antes, ahora: tiene, diferencia: tiene - antes })
  }
  return salida
}
