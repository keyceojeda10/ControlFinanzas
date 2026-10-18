/* Caja, tanda 2b (DETALLES-CAJA-Y-CAPITAL 3, 4, 13 y N1-N3, 17 oct 2026), con la
 * decisión del dueño: el cobrador entrega solo lo del día y la base se queda en
 * la ruta. Los negocios con la base en el fajo (`capitalEsEfectivo`) siguen como
 * estaban hasta que él lo decida para ellos. La cuenta, con casos; lo demás,
 * anclado en el código. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { enLaManoDelDia } from '@/lib/dinero/en-la-mano'

const leer = (f) => readFileSync(f, 'utf8')
const pagina = leer('app/(dashboard)/caja/page.jsx')
const apiCaja = leer('app/api/caja/route.js')
const cuadre = leer('app/api/caja/cuadre/route.js')
const admin = leer('app/api/caja/cobrador/[id]/route.js')

describe('enLaManoDelDia · la cifra del botón «Usar», en un solo sitio', () => {
  it('efectivo cobrado − efectivo prestado − gastos + lo del dueño', () => {
    expect(enLaManoDelDia({ recogida: 224000, recogidaEfectivo: 200000, efectivoPrestadoDia: 100000, gastos: 15000, movidoPorElDuenoEfectivo: 0 })).toBe(85000)
    expect(enLaManoDelDia({ recogida: 50000, recogidaEfectivo: 50000, efectivoPrestadoDia: 0, gastos: 0, movidoPorElDuenoEfectivo: 109000 })).toBe(159000)
  })
  it('con las mismas cifras de respaldo que tenía la página', () => {
    // Sin el desglose por método: todo lo cobrado y todo lo prestado.
    expect(enLaManoDelDia({ recogida: 80000, desembolsadoDia: 30000, gastos: 5000 })).toBe(45000)
    expect(enLaManoDelDia({})).toBe(0)
  })
  it('la usan la caja del cobrador, el cierre y el cuadre', () => {
    expect(pagina).toMatch(/const enLaMano = enLaManoDelDia\(stats\)/)
    expect(apiCaja).toMatch(/const enLaManoSistema = statsCierre \? Math\.round\(enLaManoDelDia\(statsCierre\)\) : null/)
    // Lo guardado al cerrar o, si no ha entregado, lo de ahora con la cuenta de su caja.
    expect(cuadre).toMatch(/return Math\.round\(enLaManoDelDia\(await getStatsDia\(organizationId, fecha, cobradorId\)\)\)/)
    expect(cuadre).toMatch(/: await enLaManoDe\(organizationId, fecha, cobradorId\)/)
    expect(cuadre).toMatch(/: await enLaManoDe\(organizationId, fecha, c\.id\)\)/)
  })
})

describe('#4 · vacío es la cifra que se ve, no lo cobrado bruto', () => {
  it('el cobrador cierra con lo que tiene en la mano; el dueño, con lo suyo en billetes', () => {
    expect(pagina).toMatch(/\? \(esOwner \? Math\.round\(efectivoOwnerDia\) : recaudadoRegistrado\)/)
    expect(pagina).not.toMatch(/Number\(cajaData\?\.stats\?\.dia\?\.recogida \|\| 0\)/)
    expect(pagina).toMatch(/placeholder=\{String\(Math\.round\(efectivoOwner\)\)\}/)
  })
})

describe('N1 · N2 · #3 · lo que guarda el cierre tiene un solo sentido', () => {
  it('gastos como la caja, y sin restar dos veces', () => {
    expect(apiCaja).toMatch(/const totalGastos = statsCierre \? Math\.round\(statsCierre\.gastos \|\| 0\)/)
    expect(apiCaja).not.toMatch(/const saldoRealCajaDia = saldoOperativoDia - totalDesembolsadoDia/)
    expect((apiCaja.match(/enLaManoSistema,\n/g) || []).length).toBe(2)
  })
  it('las tarjetas ya no enseñan el «saldo» con doble resta', () => {
    expect(pagina).not.toMatch(/>Saldo final</)
    expect(pagina).not.toMatch(/>Saldo real</)
    expect(pagina).toMatch(/>Contaste</)
    expect(pagina).toMatch(/>Tenías en la mano</)
    expect(leer('app/(dashboard)/reportes/page.jsx')).not.toMatch(/Saldo real:/)
    expect(leer('app/api/reportes/cobradores/route.js')).toMatch(/const eficiencia {5}= totalEsperado > 0 \? Math\.round\(\(cobrado \/ totalEsperado\) \* 100\) : 0/)
  })
})

describe('#13 · la base se queda en la ruta', () => {
  it('sin la base en el fajo, «Tiene que entregar» es lo del día', () => {
    expect(admin).toMatch(/const aperturaDeLaCuenta = baseEnElFajo \? aperturaConCapital : 0/)
    expect(admin).toMatch(/cuentaDelDia\(\{\n\s+apertura: aperturaDeLaCuenta,/)
    expect(admin).toMatch(/const efectivoEnMano = aperturaDeLaCuenta \+/)
    expect(leer('components/caja/CajaCobradorDetalle.jsx')).toMatch(/se queda con él: no se entrega\./)
  })
  it('y la base solo de las rutas con capital propio, también en el cuadre', () => {
    expect(admin).toMatch(/\.filter\(\(r\) => r\.capitalHabilitado\)/)
    expect(cuadre).toMatch(/if \(r\.capitalHabilitado\) capitalPorCobrador/)
    expect(cuadre).toMatch(/rutasCobrador\.filter\(\(r\) => r\.capitalHabilitado\)/)
  })
  it('«Le queda en la ruta» sigue con todas: su invariante es el saldoCapital', () => {
    expect(admin).toMatch(/quedaEnLaRuta: Math\.round\(\n\s+saldoAperturaTotal \+/)
  })
  it('el ajuste del cuadre no es plata del día', () => {
    expect(admin).toMatch(/const delFajo = \(m\) => m\.referenciaTipo !== 'cierre_cuadre' && afectaElFajo\(m, originalesDeHoy\)/)
    expect(admin).toMatch(/referenciaTipo: true,/)
  })
})
