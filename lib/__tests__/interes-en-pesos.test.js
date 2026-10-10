/* El interés en pesos de un préstamo sin vencimiento sale AL PESO en la cuota y
 * en cada devengo. Hector Cano: $1.500.000 que pagan $170.000 al mes. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { tasaParaInteres, interesDelPeriodo } from '@/lib/dinero/interes-en-pesos'
import { calcularPrestamo, devengosPendientes } from '@/lib/calculos'
import { formatearTasa } from '@/lib/adaptadores/prestamos'

const FORM = readFileSync('app/(dashboard)/prestamos/nuevo/page.jsx', 'utf8')

const abierto = (monto, tasa, frecuencia = 'mensual') => calcularPrestamo({
  montoPrestado: monto, tasaInteres: tasa, diasPlazo: 30, fechaInicio: new Date('2026-10-09T05:00:00Z'),
  frecuencia, modoInteres: 'solo_interes', sinPlazo: true,
})

describe('el interés en pesos', () => {
  it('el caso de Hector: $170.000 exactos, no $169.500', () => {
    const tasa = tasaParaInteres(1_500_000, 170_000)
    expect(abierto(1_500_000, tasa).cuotaDiaria).toBe(170_000)
    // Con el porcentaje que podía escribir no había forma:
    expect(abierto(1_500_000, 11.3).cuotaDiaria).toBe(169_500)
    expect(abierto(1_500_000, 11.33).cuotaDiaria).toBe(169_950)
    // Y se enseña redondeada, sin la cola de decimales.
    expect(formatearTasa(tasa)).toBe('11,33')
  })

  it('sale al peso en 5.000 combinaciones de monto e interés', () => {
    let mal = 0
    for (let k = 0; k < 5000; k++) {
      const monto = 50_000 + Math.floor(Math.random() * 20_000_000)
      const interes = 1_000 + Math.floor(Math.random() * monto * 0.5)
      if (abierto(monto, tasaParaInteres(monto, interes)).cuotaDiaria !== interes) mal++
    }
    expect(mal).toBe(0)
  })

  it('el devengo de cada mes da lo mismo', () => {
    const tasa = tasaParaInteres(1_500_000, 170_000)
    const p = {
      sinPlazo: true, modoInteres: 'solo_interes', frecuencia: 'mensual', tasaInteres: tasa,
      montoPrestado: 1_500_000, fechaInicio: new Date('2026-07-09T05:00:00Z'), pagos: [], devengos: [],
    }
    const ds = devengosPendientes(p, new Date('2026-10-10T17:00:00Z').getTime())
    expect(ds.length).toBeGreaterThan(0)
    for (const d of ds) expect(d.interes).toBe(170_000)
  })

  it('si abona a capital, baja en proporción (como con un porcentaje)', () => {
    const tasa = tasaParaInteres(1_500_000, 170_000)
    expect(interesDelPeriodo(1_000_000, tasa)).toBe(113_333)
  })

  it('sin monto o sin interés no inventa una tasa', () => {
    expect(tasaParaInteres(0, 170_000)).toBeNull()
    expect(tasaParaInteres(1_500_000, '')).toBeNull()
  })

  it('el formulario lo ofrece en los modos de cuota pareja y busca con su propio cálculo', () => {
    expect(FORM).toMatch(/const t = tasaParaInteres\(monto, interesPesos\)/)
    expect(FORM).toMatch(/const r = tasaParaCuota\(calcularConTasa, interesPesos, \{ monto, modo: modoInteres \}\)/)
    expect(FORM).toMatch(/\{puedeEnPesos && interesEnPesos \? \(/)
    expect(FORM).toMatch(/\['fijo', 'unico', 'saldo', 'solo_interes'\]\.includes\(modoInteres\) && !saldoCuotaPersonalizada/)
    // La previsualización usa la MISMA función que el buscador.
    expect(FORM).toMatch(/const resultado = calcularConTasa\(Number\(tasa\)\)/)
  })
})

describe('la cuota en pesos (cualquier modo de cuota pareja)', async () => {
  const { tasaParaCuota } = await import('@/lib/dinero/interes-en-pesos')
  const base = { fechaInicio: new Date('2026-10-10T05:00:00Z') }
  const con = (args) => (t) => calcularPrestamo({ ...base, ...args, tasaInteres: t })

  it('clásico: $200.000 a 24 cuotas diarias de $10.000', () => {
    const calc = con({ montoPrestado: 200_000, diasPlazo: 24, frecuencia: 'diario', modoInteres: 'fijo' })
    const r = tasaParaCuota(calc, 10_000)
    expect(r.exacta).toBe(true)
    expect(calc(r.tasa).cuotaDiaria).toBe(10_000)
    expect(calc(r.tasa).totalAPagar).toBe(240_000)
  })

  it('al peso en todos los modos de cuota pareja y frecuencias (500 casos al azar)', () => {
    const modos = ['fijo', 'unico', 'saldo', 'solo_interes']
    const frec = [['diario', 30], ['semanal', 56], ['quincenal', 90], ['mensual', 180]]
    let mal = []
    for (let k = 0; k < 500; k++) {
      const modo = modos[k % 4]
      const [f, dias] = frec[Math.floor(k / 4) % 4]
      const monto = (2 + Math.floor(Math.random() * 300)) * 10_000
      const calc = con({ montoPrestado: monto, diasPlazo: dias, frecuencia: f, modoInteres: modo })
      // Una cuota alcanzable: la que da alguna tasa entre 5 y 40, a la centena.
      const objetivo = Math.ceil(calc(5 + Math.random() * 35).cuotaDiaria / 100) * 100
      const r = tasaParaCuota(calc, objetivo, { monto, modo })
      if (!r || calc(r.tasa).cuotaDiaria !== r.cuota || !r.exacta) mal.push({ modo, f, monto, objetivo, r })
    }
    expect(mal).toEqual([])
  })

  it('de las tasas que dan la cuota, la más corta: el globo cierra al peso', () => {
    const calc = con({ montoPrestado: 1_000_000, diasPlazo: 90, frecuencia: 'quincenal', modoInteres: 'solo_interes' })
    const r = tasaParaCuota(calc, 75_000, { monto: 1_000_000, modo: 'solo_interes' })
    expect(r.tasa).toBe(7.5)
    expect(calc(r.tasa).totalAPagar).toBe(1_450_000)
    expect(tasaParaCuota(con({ montoPrestado: 200_000, diasPlazo: 24, frecuencia: 'diario', modoInteres: 'fijo' }), 10_000).tasa).toBe(25)
  })

  it('en el francés la tasa redonda no se cuela si cambia el total', () => {
    const calc = con({ montoPrestado: 3_000_000, diasPlazo: 180, frecuencia: 'mensual', modoInteres: 'saldo' })
    const r = tasaParaCuota(calc, 650_000, { monto: 3_000_000, modo: 'saldo' })
    expect(calc(r.tasa).cuotaDiaria).toBe(650_000)
    // La última cuota queda pegada a las demás, no $500 más baja.
    expect(650_000 * 6 - calc(r.tasa).totalAPagar).toBeLessThan(100)
  })

  it('en el clásico la cuota que no va a la centena lo dice', () => {
    const calc = con({ montoPrestado: 200_000, diasPlazo: 24, frecuencia: 'diario', modoInteres: 'fijo' })
    const r = tasaParaCuota(calc, 10_050)
    expect(r.exacta).toBe(false)
    expect(r.cuota).toBe(10_000)
  })

  it('una cuota que no devuelve ni el capital no inventa una tasa', () => {
    const calc = con({ montoPrestado: 200_000, diasPlazo: 24, frecuencia: 'diario', modoInteres: 'fijo' })
    expect(tasaParaCuota(calc, 5_000)).toBeNull()
  })
})

describe('una cuota imposible no deja seguir', () => {
  it('el paso no avanza', () => {
    expect(FORM).toMatch(/if \(interesEnPesos && puedeEnPesos && cuotaBuscada\?\.imposible\) return false/)
  })
})
