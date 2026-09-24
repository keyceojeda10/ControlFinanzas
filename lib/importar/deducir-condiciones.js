/* DEDUCIR TASA, CUOTAS Y FRECUENCIA — 24 sep 2026.
 *
 * Para el crédito que solo trae capital, saldo y cuota (la planilla de Crossbox, y
 * cualquier otro archivo así). El saldo es el del archivo, siempre; lo que se
 * deduce es cómo se llegó a él:
 *   · «Nunca» abonó (y el saldo no es menor que el crédito): el total es el saldo.
 *   · Si no: tasas del 10 al 60 % (primero el 20, lo más común) que den un número
 *     entero de cuotas, y cada frecuencia. Gana la que mejor explica sus cuotas
 *     «Atrasadas» a la fecha de corte.
 * Medido en la planilla real (49 créditos): sin domingos cuadran 46 y los 3 que no
 * son números sin sentido o casos ambiguos, que salen en error para crearlos a mano.
 * Pura: sin base de datos. Ver lib/__tests__/deducir-condiciones.test.js.
 */
const TASAS = [20, 10, 30, 40, 50, 60]
const FRECUENCIAS = ['diario', 'semanal', 'quincenal', 'mensual']
// Un crédito de UNA cuota no deja ver su frecuencia en las atrasadas: lo típico es a un mes.
const FRECUENCIAS_UNA_CUOTA = ['mensual', 'quincenal', 'semanal', 'diario']
const NOMBRE_FRECUENCIA = { diario: 'diarias', semanal: 'semanales', quincenal: 'quincenales', mensual: 'mensuales' }
const NOMBRE_FRECUENCIA_SINGULAR = { diario: 'diaria', semanal: 'semanal', quincenal: 'quincenal', mensual: 'mensual' }
const DIA = 864e5
const pesos = (n) => '$' + Math.round(n).toLocaleString('es-CO')
const fecha = (s) => new Date(`${String(s).slice(0, 10)}T12:00:00Z`)
/** a < b comparando posición por posición. */
const antes = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false }

const MOTIVO_ABSURDO = 'Los números de este crédito no tienen sentido (cuota o crédito demasiado pequeños): créalo a mano con tus datos'
const MOTIVO_NO_CUADRA = 'No pudimos deducir la tasa y las cuotas de este crédito: créalo a mano con tus datos'

/** Las fechas de las n cuotas de un préstamo que arranca en `inicio`. */
export function fechasDeCuotas(inicio, frecuencia, n, sinDomingos) {
  const base = fecha(inicio)
  const out = []
  let x = base
  for (let i = 1; i <= n; i++) {
    if (frecuencia === 'diario') {
      x = new Date(x.getTime() + DIA)
      while (sinDomingos && x.getUTCDay() === 0) x = new Date(x.getTime() + DIA)
    } else if (frecuencia === 'semanal') x = new Date(base.getTime() + 7 * i * DIA)
    else if (frecuencia === 'quincenal') x = new Date(base.getTime() + 15 * i * DIA)
    else x = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + i, Math.min(base.getUTCDate(), 28), 12))
    out.push(x)
  }
  return out
}

const pista = (nombre) => {
  const s = String(nombre ?? '').toLowerCase()
  return /semanal/.test(s) ? 'semanal' : /quincenal/.test(s) ? 'quincenal' : /mensual/.test(s) ? 'mensual' : /diario/.test(s) ? 'diario' : null
}

export function deducirCondiciones(fila, { sinDomingos = true } = {}) {
  const capital = Number(fila.montoPrestado) || 0
  const saldo = Number(fila.saldoActual)
  const cuota = Number(fila.valorCuota) || 0
  const atrasadas = fila.atrasadas == null || fila.atrasadas === '' ? null : Number(fila.atrasadas)
  const vencidos = Number(fila.vencidos) || 0
  // El saldo no puede ser varias veces el capital: un archivo con un saldo
  // absurdo (o un POST manipulado con `sinAbonos: true`) hacía que `n =
  // round(saldo/cuota)` saliera enorme y el barrido de frecuencias/candidatos
  // de más abajo lo recorriera cuota por cuota — con miles de millones, eso
  // bloqueaba el proceso varios segundos. `validarFila` ya trata un total de
  // archivo por encima de 3x el capital como absurdo; aquí es lo mismo.
  if (capital < 10000 || !(cuota > 0) || !(saldo >= 0) || cuota < capital / 1000 || saldo > capital * 3 || !fila.fechaInicio || !fila.fechaCorte) {
    return { ok: false, motivo: MOTIVO_ABSURDO }
  }

  const candidatos = []
  if (fila.sinAbonos && saldo >= capital) {
    const n = Math.max(1, Math.round(saldo / cuota))
    const total = saldo
    // Misma tolerancia de ajuste que la otra rama: si ni siquiera acá cuadra la
    // cuota con el saldo, no hay candidato y el crédito se va a «no se pudo deducir».
    // Tope de cuotas: ver el comentario del guardián de arriba.
    if (n <= 1000 && Math.abs(n * cuota - total) <= n * 1000) {
      candidatos.push({ tasa: Math.round((saldo / capital - 1) * 10000) / 100, n, total, esSaldo: true })
    }
  } else {
    for (const t of TASAS) {
      const total = Math.round(capital * (1 + t / 100))
      if (total < saldo) continue
      const n = Math.round(total / cuota)
      if (n < 1 || n > 1000 || Math.abs(n * cuota - total) > n * 1000) continue
      candidatos.push({ tasa: t, n, total, esSaldo: false })
    }
  }

  const corte = fecha(fila.fechaCorte)
  const ayer = new Date(corte.getTime() - DIA)
  const preferida = pista(fila.nombre)
  let mejor = null
  for (const c of candidatos) {
    const pagadas = (c.total - saldo) / (c.total / c.n)
    const orden = c.n === 1 ? FRECUENCIAS_UNA_CUOTA : FRECUENCIAS
    // Qué tan lejos queda la cuota deducida de la que trae el archivo, por cuota: entre
    // varias tasas que cuadran igual con «Atrasadas», gana la que más se parece a su cuota.
    const desajusteCuota = Math.round(Math.abs(c.n * cuota - c.total) / c.n)
    for (const fr of orden) {
      const fechas = fechasDeCuotas(fila.fechaInicio, fr, c.n, sinDomingos)
      const ultima = fechas[fechas.length - 1]
      const diasVencido = Math.max(0, Math.round((corte - ultima) / DIA))
      for (const hasta of [ayer, corte]) {
        const vencidas = fechas.filter((x) => x <= hasta).length
        const err = atrasadas == null ? 0 : Math.abs(vencidas - pagadas - atrasadas)
        // Desempates, en orden: lo que cuadra con «Atrasadas», lo que se parece a su
        // cuota, lo que dice el nombre, el 20 % (lo más común), lo que cuadra con
        // «Vencidos» (días desde la última cuota) y el orden de frecuencias.
        const clave = [
          Math.round(err * 100),
          desajusteCuota,
          preferida && fr !== preferida ? 1 : 0,
          c.tasa === 20 ? 0 : 1,
          vencidos > 0 ? Math.abs(diasVencido - vencidos) : 0,
          orden.indexOf(fr),
        ]
        if (!mejor || antes(clave, mejor.clave)) mejor = { clave, err, c, fr, orden }
      }
    }
  }
  if (!mejor || mejor.err > 1) return { ok: false, motivo: MOTIVO_NO_CUADRA }

  const { c, fr, orden } = mejor
  const valorCuota = Math.ceil(c.total / c.n)
  const total = valorCuota * c.n
  const cuadra = atrasadas == null ? ''
    : atrasadas === 1 ? '; cuadra con su cuota atrasada'
      : atrasadas > 1 ? `; cuadra con sus ${atrasadas} cuotas atrasadas`
        : atrasadas === 0 ? '; cuadra con su planilla (al día)' : '; cuadra con su planilla (va adelantado)'
  // La cuota se redondea al peso hacia arriba: si el total cambia, se dice.
  const redondeo = total !== c.total ? `; total ${pesos(total)} por el redondeo de la cuota` : ''
  // Si la cuota deducida no es la que trae el archivo, se lo decimos: el archivo puede
  // venir con su propio redondeo o con un abono parcial que ya movió la cuota.
  const planillaDice = valorCuota !== cuota
    ? `; tu planilla dice ${pesos(cuota)} por cuota y aquí queda en ${pesos(valorCuota)}` : ''
  // M10: «Nunca» abonó según la planilla, pero el crédito cayó en la rama de
  // abonos (aquí, no en la de `esSaldo`) porque su saldo es MENOR que el
  // crédito: un «Nunca» no puede ser literal si ya debe menos de lo prestado.
  // Se avisa la cifra que se está tomando como abono previo (ver validarFila,
  // que la calcula igual: total − saldo).
  const nuncaConAbono = fila.sinAbonos && !c.esSaldo
    ? `; tu planilla dice que nunca abonó, pero su saldo es menor que el crédito: se toma como abono previo de ${pesos(total - saldo)}`
    : ''

  // Empate de frecuencia: otra frecuencia de la misma tasa y cuotas que explica igual de
  // bien las «Atrasadas» y el desajuste de cuota, y que el indicio del nombre no decidió.
  let empate = ''
  if (!(preferida && preferida === fr)) {
    const pagadas = (c.total - saldo) / (c.total / c.n)
    for (const frAlt of orden) {
      if (frAlt === fr) continue
      const fechasAlt = fechasDeCuotas(fila.fechaInicio, frAlt, c.n, sinDomingos)
      let errAlt = Infinity
      for (const hasta of [ayer, corte]) {
        const vencidasAlt = fechasAlt.filter((x) => x <= hasta).length
        const e = atrasadas == null ? 0 : Math.abs(vencidasAlt - pagadas - atrasadas)
        if (e < errAlt) errAlt = e
      }
      if (Math.round(errAlt * 100) === mejor.clave[0]) {
        empate = `; también cuadra ${NOMBRE_FRECUENCIA_SINGULAR[frAlt]}: revísala`
        break
      }
    }
  }

  const cuotas = c.n === 1 ? `1 cuota ${fr === 'diario' ? 'diaria' : fr}` : `${c.n} cuotas ${NOMBRE_FRECUENCIA[fr]}`
  return {
    ok: true, tasaInteres: c.tasa, numeroCuotas: c.n, frecuencia: fr, valorCuota, total, totalEsSaldo: c.esSaldo,
    aviso: `Deducido: ${String(c.tasa).replace('.', ',')} % en ${cuotas}${cuadra}${redondeo}${planillaDice}${nuncaConAbono}${empate}`,
  }
}

/** ¿La planilla entera cuadra mejor sin domingos? Cuenta las filas que se deducen de cada manera.
 *  Mayoría ESTRICTA: un empate (créditos recientes, o solo de una cuota, que no dejan ver la
 *  frecuencia real) no puede sugerir «sin domingos» — eso ofrece una configuración de cuenta
 *  entera que la planilla ni pidió. */
export function decidirDomingos(filas) {
  const cuenta = (sinDomingos) => filas.filter((f) => deducirCondiciones(f, { sinDomingos }).ok).length
  return cuenta(true) > cuenta(false)
}
