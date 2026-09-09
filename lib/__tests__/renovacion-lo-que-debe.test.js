import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { calcularSaldoPendiente, calcularCapitalRestante, tieneTablaAmortizacion, minimoParaRenovar } from '@/lib/calculos'

// ── AL RENOVAR SE ENTREGABA DE MÁS ──────────────────────────────────────────
//
// Reportado por el dueño de PRESTA MIL con dos casos del mismo día:
//
//   «acabo de hacer una renovación de cien mil, pero el cliente me debía
//    cincuenta mil. Acá me está mostrando cincuenta y ocho cuatrocientos,
//    cuando en realidad debería decir cincuenta»
//
// El sistema decidía cuánto entregar con `calcularCapitalRestante`, que reparte
// lo pagado PROPORCIONALMENTE entre capital e interés. Esa cifra es correcta
// para «cuánta plata mía sigue en la calle», pero al renovar se liquida otra
// cosa: LA DEUDA — lo que el cliente pactó devolver y aún no ha devuelto.
//
// Con tabla sí manda el capital: ahí el interés futuro no está devengado.

const src = readFileSync(resolve(process.cwd(), 'app/api/prestamos/[id]/renovar/route.js'), 'utf8')

/* MARIA GÓMEZ, reconstruido de producción: le prestaron $150.000 a devolver
   $180.000 (cuota $6.000 × 30 días) y pagó $130.000. */
const MARIA = {
  montoPrestado: 150000,
  totalAPagar: 180000,
  totalPagado: 130000,
  cuotaDiaria: 6000,
  diasPlazo: 30,
  frecuencia: 'diario',
  modoInteres: 'fijo',
  pagos: [{ montoPagado: 130000, tipo: 'parcial' }],
  cuotasAmortizacion: [],
}

describe('cuánto se liquida al renovar', () => {
  it('sin tabla: lo que el cliente DEBE, no el capital proporcional', () => {
    // 180.000 pactados − 130.000 pagados = 50.000, que es lo que el cobrador
    // tiene en la cartulina y en la cabeza.
    expect(calcularSaldoPendiente(MARIA)).toBe(50000)
  })

  it('el capital proporcional dice otra cosa, y por eso entregaba de más', () => {
    // 16,67% de los 130.000 se reparte a interés → capital devuelto 108.333 →
    // «aún debe» 41.667. Con eso, renovar por 100.000 entregaba 58.333.
    const capital = calcularCapitalRestante(MARIA)
    expect(capital).toBe(41667)
    expect(100000 - capital, 'este era el número que salía en pantalla').toBe(58333)
    expect(100000 - calcularSaldoPendiente(MARIA), 'y este es el correcto').toBe(50000)
  })

  it('la diferencia salía del bolsillo del cobrador', () => {
    // $8.333 de más POR CADA renovación, en efectivo.
    const deMas = calcularCapitalRestante(MARIA) === null
      ? 0
      : calcularSaldoPendiente(MARIA) - calcularCapitalRestante(MARIA)
    expect(deMas).toBe(8333)
  })

  it('este préstamo NO tiene tabla, que es el 93% de la cartera', () => {
    expect(tieneTablaAmortizacion(MARIA)).toBe(false)
  })
})

describe('con tabla de amortización manda el capital', () => {
  // Ahí el interés futuro no está devengado: cobrarlo al renovar sería cobrar
  // un interés que nunca corrió.
  const CON_TABLA = {
    montoPrestado: 1000000,
    totalAPagar: 1200000,
    totalPagado: 400000,
    cuotaDiaria: 100000,
    diasPlazo: 360,
    frecuencia: 'mensual',
    modoInteres: 'lineal',
    pagos: [{ montoPagado: 400000, tipo: 'parcial' }],
    cuotasAmortizacion: [
      { numeroPeriodo: 1, capital: 80000, interes: 20000, cuotaTotal: 100000, pagado: 100000, interesPagado: 20000 },
      { numeroPeriodo: 2, capital: 82000, interes: 18000, cuotaTotal: 100000, pagado: 100000, interesPagado: 18000 },
      { numeroPeriodo: 3, capital: 84000, interes: 16000, cuotaTotal: 100000, pagado: 100000, interesPagado: 16000 },
      { numeroPeriodo: 4, capital: 86000, interes: 14000, cuotaTotal: 100000, pagado: 100000, interesPagado: 14000 },
      { numeroPeriodo: 5, capital: 88000, interes: 12000, cuotaTotal: 100000, pagado: 0, interesPagado: 0 },
    ],
  }

  it('se reconoce que tiene tabla', () => {
    expect(tieneTablaAmortizacion(CON_TABLA)).toBe(true)
  })

  it('el capital pendiente es menor que el saldo, y ese es el que manda', () => {
    const capital = calcularCapitalRestante(CON_TABLA)
    expect(capital).toBeLessThan(calcularSaldoPendiente(CON_TABLA))
    expect(capital).toBeGreaterThan(0)
  })
})

describe('el código', () => {
  it('elige según tenga tabla o no, y lo elige en UN solo sitio', () => {
    /* Hasta el 9 sep 2026 la condición estaba escrita aquí a mano y OTRA VEZ en
       la pantalla, y se separaron. Ahora las dos llaman a `minimoParaRenovar`,
       que es donde vive la regla. */
    expect(src, 'vuelve a decidir por su cuenta en vez de usar la función')
      .toContain('const minimoRenovacion = minimoParaRenovar(original)')
    const calculos = readFileSync(resolve(process.cwd(), 'lib/calculos.js'), 'utf8')
    expect(calculos).toMatch(/tieneTablaAmortizacion\(prestamo\) && capital != null/)
  })

  it('importa lo que usa', () => {
    // Una función sin importar pasa build y revienta al ejecutarse: ya pasó en
    // este proyecto con `formatFechaCalendario`.
    expect(src).toMatch(/minimoParaRenovar,/)
  })

  it('el préstamo llega con su tabla', () => {
    // Sin `cuotasAmortizacion` en el `include`, `tieneTablaAmortizacion` diría
    // que no la tiene y se aplicaría la rama equivocada a TODOS.
    expect(src).toMatch(/cuotasAmortizacion: \{ select:/)
  })
})

/* ══ 9 SEP 2026 · EL SERVIDOR SE ARREGLÓ Y LA PANTALLA SE QUEDÓ ══════════════
 *
 * El arreglo de arriba tocó SOLO `app/api/prestamos/[id]/renovar/route.js`.
 * `components/prestamos/RenovarPrestamo.jsx` seguía decidiendo por su cuenta
 * —«si hay capital restante, ese; si no, el saldo»—, así que durante un mes
 * enseñó una entrega que el servidor no iba a registrar.
 *
 * Lo cazó un prestamista con su propia cuenta, que era la correcta:
 *
 *   «el crédito de 500, me le gané 200 en intereses y entonces tiene un saldo
 *    de 200. Yo cojo los 500, le resto el saldo y lo que queda es para
 *    entregarle, sería 300. Y en el sistema me hace un ejemplo 350 o 370»
 *
 * Medido en la cartera: 5.224 de 6.032 préstamos activos (86,6 %) en 263
 * negocios enseñaban una cifra distinta de la que el servidor registraba.
 */
describe('la pantalla y el servidor liquidan lo mismo', () => {
  /* El caso del prestamista, al peso: presta 500.000 a devolver 700.000 y el
     cliente ya pagó 500.000. */
  const SUYO = {
    montoPrestado: 500000,
    totalAPagar: 700000,
    totalPagado: 500000,
    cuotaDiaria: 25000,
    diasPlazo: 28,
    frecuencia: 'diario',
    modoInteres: 'manual',
    pagos: [{ montoPagado: 500000, tipo: 'parcial' }],
    cuotasAmortizacion: [],
  }

  it('su cuenta era la correcta: debe 200.000, así que renovando a 500.000 se le entregan 300.000', () => {
    expect(calcularSaldoPendiente(SUYO)).toBe(200000)
    expect(minimoParaRenovar(SUYO)).toBe(200000)
    expect(500000 - minimoParaRenovar(SUYO)).toBe(300000)
  })

  it('y los «350 o 370» que veía son el capital proporcional, que aquí no toca', () => {
    // 500.000 pagados × (500/700) = 357.143 imputados a capital.
    expect(calcularCapitalRestante(SUYO)).toBe(142857)
    expect(500000 - calcularCapitalRestante(SUYO), 'lo que enseñaba la pantalla').toBe(357143)
    // 57.143 de más POR RENOVACIÓN, en efectivo, de la caja del cobrador.
    expect(minimoParaRenovar(SUYO) - calcularCapitalRestante(SUYO)).toBe(57143)
  })

  it('con tabla sigue mandando el capital, que es la excepción de verdad', () => {
    const conTabla = {
      montoPrestado: 1000000, totalAPagar: 1200000, totalPagado: 400000,
      cuotaDiaria: 100000, diasPlazo: 360, frecuencia: 'mensual', modoInteres: 'lineal',
      pagos: [{ montoPagado: 400000, tipo: 'parcial' }],
      cuotasAmortizacion: [
        { numeroPeriodo: 1, capital: 80000, interes: 20000, cuotaTotal: 100000, pagado: 100000, interesPagado: 20000 },
        { numeroPeriodo: 2, capital: 82000, interes: 18000, cuotaTotal: 100000, pagado: 100000, interesPagado: 18000 },
        { numeroPeriodo: 3, capital: 84000, interes: 16000, cuotaTotal: 100000, pagado: 100000, interesPagado: 16000 },
        { numeroPeriodo: 4, capital: 86000, interes: 14000, cuotaTotal: 100000, pagado: 100000, interesPagado: 14000 },
        { numeroPeriodo: 5, capital: 88000, interes: 12000, cuotaTotal: 100000, pagado: 0, interesPagado: 0 },
      ],
    }
    expect(tieneTablaAmortizacion(conTabla)).toBe(true)
    expect(minimoParaRenovar(conTabla)).toBe(calcularCapitalRestante(conTabla))
    expect(minimoParaRenovar(conTabla)).not.toBe(calcularSaldoPendiente(conTabla))
  })

  it('⚠ la cuenta vive en UN sitio: nadie la vuelve a escribir a mano', () => {
    const pantalla = readFileSync(resolve(process.cwd(), 'components/prestamos/RenovarPrestamo.jsx'), 'utf8')
    const ficha = readFileSync(resolve(process.cwd(), 'app/api/prestamos/[id]/route.js'), 'utf8')

    // El servidor que guarda y el API que pinta la ficha llaman a la función.
    expect(src).toMatch(/minimoRenovacion = minimoParaRenovar\(original\)/)
    expect(ficha).toMatch(/minimoRenovacion: minimoParaRenovar\(p\)/)

    // Y la pantalla la RECIBE: ya no decide.
    expect(pantalla).toMatch(/minimoRenovacion != null \? Math\.max\(0, Number\(minimoRenovacion\)\) : saldoTotal/)
    expect(pantalla, 'la pantalla volvió a decidir por su cuenta')
      .not.toMatch(/capitalRestante != null \? Math\.max\(0, Number\(capitalRestante\)\)/)

    // Y ninguno de los dos rehace la condición a mano.
    expect(src).not.toMatch(/tieneTablaAmortizacion\(original\) && capitalRestante/)
  })
})
