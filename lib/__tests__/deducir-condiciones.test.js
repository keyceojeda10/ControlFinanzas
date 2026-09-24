import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { leerPlanillaCrossbox } from '@/lib/importar/planilla-crossbox'
import { deducirCondiciones, decidirDomingos } from '@/lib/importar/deducir-condiciones'

const { filas } = leerPlanillaCrossbox(JSON.parse(readFileSync(resolve(process.cwd(), 'lib/__tests__/fixtures/planilla-crossbox-paginas.json'), 'utf8')))
const fila = (n) => filas.find((f) => f.filaPlanilla === n)
const deducir = (n) => deducirCondiciones(fila(n), { sinDomingos: true })

describe('la planilla entera', () => {
  it('sin domingos cuadran 46; contando domingos, 41: la planilla es sin domingos', () => {
    const ok = (s) => filas.filter((f) => deducirCondiciones(f, { sinDomingos: s }).ok).length
    expect(ok(true)).toBe(46)
    expect(ok(false)).toBe(41)
    expect(decidirDomingos(filas)).toBe(true)
  })
  it('las tres que no se pueden deducir, cada una con su motivo', () => {
    const malas = filas.filter((f) => !deducirCondiciones(f, { sinDomingos: true }).ok).map((f) => f.filaPlanilla)
    expect(malas).toEqual([45, 48, 49])
    expect(deducir(45).motivo).toBe('No pudimos deducir la tasa y las cuotas de este crédito: créalo a mano con tus datos')
    expect(deducir(48).motivo).toBe('Los números de este crédito no tienen sentido (cuota o crédito demasiado pequeños): créalo a mano con tus datos')
    expect(deducir(49).ok).toBe(false)
  })
})

describe('casos concretos', () => {
  it('lo más común: 20 % en 24 cuotas diarias', () => {
    expect(deducir(2)).toMatchObject({ ok: true, tasaInteres: 20, numeroCuotas: 24, frecuencia: 'diario', valorCuota: 20000, total: 480000, totalEsSaldo: false })
    expect(deducir(3).aviso).toBe('Deducido: 20 % en 24 cuotas diarias; cuadra con su cuota atrasada')
    expect(deducir(2).aviso).toBe('Deducido: 20 % en 24 cuotas diarias; cuadra con su planilla (al día)')
    expect(deducir(2).aviso).not.toContain('tu planilla dice')
    expect(deducir(2).aviso).not.toContain('también cuadra')
  })
  it('«Nunca» abonó: el total es el saldo, y el redondeo de la cuota se dice', () => {
    expect(deducir(13)).toMatchObject({ tasaInteres: 60, numeroCuotas: 12, frecuencia: 'semanal', valorCuota: 106667, total: 1280004, totalEsSaldo: true })
    expect(deducir(13).aviso).toMatch(/total \$1\.280\.004 por el redondeo de la cuota/)
    expect(deducir(13).aviso).toContain('tu planilla dice $107.000 por cuota y aquí queda en $106.667')
  })
  it('el nombre manda en el empate («Semanal»): no se avisa un empate que decidió el nombre', () => {
    expect(deducir(15)).toMatchObject({ tasaInteres: 20, numeroCuotas: 4, frecuencia: 'semanal' })
    expect(deducir(15).aviso).not.toContain('también cuadra')
  })
  it('«Vencidos» desempata: 4 semanales, no 4 diarias', () => {
    expect(deducir(39)).toMatchObject({ tasaInteres: 20, numeroCuotas: 4, frecuencia: 'semanal' })
  })
  it('una sola cuota va a un mes', () => {
    expect(deducir(1)).toMatchObject({ tasaInteres: 20, numeroCuotas: 1, frecuencia: 'mensual', total: 180000 })
    expect(deducir(1).aviso).toMatch(/^Deducido: 20 % en 1 cuota mensual/)
  })
  it('va adelantado (atrasadas negativas)', () => {
    expect(deducir(37)).toMatchObject({ tasaInteres: 20, numeroCuotas: 222, frecuencia: 'diario' })
    expect(deducir(37).aviso).toMatch(/va adelantado/)
  })
  it('«Nunca» pero con saldo menor que el crédito: se trata como con abonos', () => {
    expect(deducir(46)).toMatchObject({ tasaInteres: 40, numeroCuotas: 8, frecuencia: 'semanal', total: 560000, totalEsSaldo: false })
  })
  it('sin columna de atrasadas no se inventa un error: sale lo más común', () => {
    const r = deducirCondiciones({ montoPrestado: 300000, saldoActual: 200000, valorCuota: 15000, atrasadas: null, fechaInicio: '2026-09-01', fechaCorte: '2026-09-24', nombre: 'X' })
    expect(r).toMatchObject({ ok: true, tasaInteres: 20, numeroCuotas: 24, frecuencia: 'diario' })
  })
})

describe('fix round 1: totalEsSaldo, tolerancia de cuota, y avisos de desajuste y empate', () => {
  it('dice cuando el total deducido es el saldo del archivo tal cual («Nunca»), y cuando no', () => {
    expect(deducir(13).totalEsSaldo).toBe(true)
    expect(deducir(2).totalEsSaldo).toBe(false)
    // Fila 46: «Nunca» abonó, pero el saldo (390.000) es MENOR que el crédito (400.000),
    // así que cae en la rama de abonos: el total deducido (560.000) no es el saldo.
    expect(deducir(46).totalEsSaldo).toBe(false)
  })
  it('«Nunca» también tiene tolerancia de cuota: si ninguna cuota entera cuadra con el saldo, no se inventa', () => {
    // saldo 375.000 entre cuota 30.000 = 12,5 cuotas; ni 12 ni 13 cuotas cuadran dentro
    // de la tolerancia de 1.000 por cuota, así que no hay candidato.
    const r = deducirCondiciones({
      montoPrestado: 300000, saldoActual: 375000, valorCuota: 30000, sinAbonos: true,
      atrasadas: null, fechaInicio: '2026-09-01', fechaCorte: '2026-09-24', nombre: 'X',
    })
    expect(r.ok).toBe(false)
  })
  it('cuando la cuota deducida no es la del archivo, el aviso dice las dos', () => {
    expect(deducir(19).aviso).toContain('tu planilla dice $53.000 por cuota y aquí queda en $52.500')
  })
  it('entre tasas que cuadran igual con «Atrasadas», gana la que más se parece a su cuota (fila 44, incluso sin «Vencidos»)', () => {
    const r = deducirCondiciones({ ...fila(44), vencidos: 0 }, { sinDomingos: true })
    expect(r).toMatchObject({ tasaInteres: 40, numeroCuotas: 24 })
  })
  it('cuando otra frecuencia explica igual de bien las «Atrasadas», el aviso la nombra para que se revise', () => {
    expect(deducir(12)).toMatchObject({ tasaInteres: 40, numeroCuotas: 4, frecuencia: 'quincenal' })
    expect(deducir(12).aviso).toContain('también cuadra mensual: revísala')
    expect(deducir(19)).toMatchObject({ tasaInteres: 40, numeroCuotas: 8, frecuencia: 'semanal' })
    expect(deducir(19).aviso).toContain('también cuadra quincenal: revísala')
  })
})

// C2. `n = round(saldo/cuota)` sin tope: un saldo absurdo en la rama «Nunca»
// (sinAbonos) generaba un `n` gigante y `fechasDeCuotas` lo recorría entero,
// una a una — con un saldo de miles de millones eso bloquea el proceso.
describe('C2: guarda contra el bucle sin tope', () => {
  it('«Nunca» con saldo mayor a 3x el capital: números sin sentido', () => {
    const r = deducirCondiciones({
      montoPrestado: 100000, saldoActual: 400000, valorCuota: 1000, sinAbonos: true,
      atrasadas: null, fechaInicio: '2026-09-01', fechaCorte: '2026-09-24', nombre: 'X',
    })
    expect(r).toEqual({ ok: false, motivo: 'Los números de este crédito no tienen sentido (cuota o crédito demasiado pequeños): créalo a mano con tus datos' })
  })

  it('una cuota que daría más de 1000 cuotas no genera candidato: no se pudo deducir', () => {
    const r = deducirCondiciones({
      montoPrestado: 2000000, saldoActual: 100000, valorCuota: 2000, sinAbonos: false,
      atrasadas: null, fechaInicio: '2026-09-01', fechaCorte: '2026-09-24', nombre: 'X',
    })
    expect(r.ok).toBe(false)
  })

  it('guarda de tiempo: un saldo de miles de millones responde en menos de 200 ms', () => {
    const inicio = Date.now()
    const r = deducirCondiciones({
      montoPrestado: 1000000, saldoActual: 2000000000, valorCuota: 1000, sinAbonos: true,
      atrasadas: null, fechaInicio: '2026-09-01', fechaCorte: '2026-09-24', nombre: 'X',
    })
    const ms = Date.now() - inicio
    expect(ms).toBeLessThan(200)
    expect(r.ok).toBe(false)
  })
})

// I6. `decidirDomingos` usaba `>=`: un empate (3 y 3 con las filas de una sola
// cuota — la 1, la 38 y la 47 no dejan ver la frecuencia real) se leía como
// «sin domingos» y le sugería al dueño una configuración que la planilla no
// pedía. Con `>` estricto, un empate no decide nada.
describe('I6: «sin domingos» solo por mayoría estricta', () => {
  it('la planilla real sigue dando sin domingos (46 contra 41, no hay empate)', () => {
    expect(decidirDomingos(filas)).toBe(true)
  })
  it('un archivo hecho solo de filas de una cuota (1, 38, 47) empata 3 a 3: da false', () => {
    const soloUnaCuota = [1, 38, 47].map(fila)
    const cuenta = (sinDomingos) => soloUnaCuota.filter((f) => deducirCondiciones(f, { sinDomingos }).ok).length
    expect(cuenta(true)).toBe(cuenta(false))
    expect(decidirDomingos(soloUnaCuota)).toBe(false)
  })
})

// M10. Fila 46: «Nunca» abonó según la planilla, pero cayó en la rama de
// abonos (su saldo es menor que el crédito) porque el «Nunca» no puede ser
// literal: alguien pagó algo. El aviso tiene que decirlo, con la cifra.
describe('M10: «Nunca» con saldo menor que el crédito avisa el abono previo', () => {
  it('fila 46: el aviso dice el abono previo de $170.000', () => {
    expect(deducir(46).aviso).toContain(
      'tu planilla dice que nunca abonó, pero su saldo es menor que el crédito: se toma como abono previo de $170.000',
    )
  })
  it('una fila que SÍ pagó (sinAbonos false) no lleva ese aviso', () => {
    expect(deducir(2).aviso).not.toContain('nunca abonó')
  })
  it('una fila «Nunca» de verdad (totalEsSaldo) tampoco lo lleva: no hay abono que avisar', () => {
    expect(deducir(13).totalEsSaldo).toBe(true)
    expect(deducir(13).aviso).not.toContain('nunca abonó')
  })
})
