/**
 * EL ABIERTO QUINCENAL COMO LO TRABAJA CRÉDITOS PETE (10 nov 2026).
 *
 * «Yamit prestó el 23 de octubre, pero va a pagar los 5 y los 20. El 5 me dijo:
 *  te voy a abonar el total de los intereses, para dar la quincena del 20.»
 * Y el % lo piensa AL MES: 12 % = 6 % cada quincena.
 *
 * Cuatro piezas, todas opcionales: el % al mes se convierte AL ESCRIBIRLO (la
 * tasa guardada sigue siendo la de la quincena, la que leen todas las cuentas);
 * los dos días con «Mes completo»; la primera quincena completa aunque sea
 * corta; y el abono previo que ya pagó la quincena que corre.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fechaDePeriodo } from '@/lib/dinero/calendario'
import { devengosPendientes, periodoEnCursoAbierto, calcularLiquidacionAnticipada } from '@/lib/calculos'

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const iso = (d) => new Date(d).toISOString().slice(0, 10)

// Yamit: $2.500.000 al 12 % al mes → 6 % por quincena → $150.000 cada quincena.
const yamit = (extra = {}) => ({
  modoInteres: 'solo_interes', sinPlazo: true, estado: 'activo', interesMesCompleto: true,
  montoPrestado: 2500000, totalAPagar: 2500000, tasaInteres: 6,
  frecuencia: 'quincenal', fechaInicio: '2026-10-23T05:00:00.000Z',
  diaCobroMes: 5, diaCobroMes2: 20,
  pagos: [], devengos: [], cuotasAmortizacion: [],
  ...extra,
})
const el10 = new Date('2026-11-10T15:00:00.000Z').getTime()

describe('los dos días: el 5 y el 20', () => {
  const args = { fechaInicio: new Date('2026-10-23T05:00:00.000Z'), freq: 'quincenal', diasPeriodo: 15, diaCobroMes: 5, diaCobroMes2: 20 }
  it('prestado el 23 oct, la primera quincena cae el 5 nov aunque sean 13 días', () => {
    expect(iso(fechaDePeriodo(1, args))).toBe('2026-11-05')
    expect(iso(fechaDePeriodo(2, args))).toBe('2026-11-20')
    expect(iso(fechaDePeriodo(3, args))).toBe('2026-12-05')
  })
  it('prestar el mismo día de cobro no cobra ese día', () => {
    expect(iso(fechaDePeriodo(1, { ...args, fechaInicio: new Date('2026-11-05T05:00:00.000Z') }))).toBe('2026-11-20')
  })
})

describe('el interés de cada quincena, completo', () => {
  it('el 5 nov cierra la primera quincena entera: $150.000', () => {
    expect(devengosPendientes(yamit(), el10).map((d) => [iso(d.periodo), Math.round(d.interes)])).toEqual([['2026-11-05', 150000]])
  })
  it('la que corre cierra el 20 nov, otra vez $150.000', () => {
    const p = periodoEnCursoAbierto(yamit({ devengos: [{ periodo: '2026-11-05', interes: 150000 }] }), el10)
    expect(p.periodo).toBe('2026-11-20')
    expect(p.interesPeriodo).toBe(150000)
  })
  it('si paga todo hoy, con «Mes completo» paga la quincena entera', () => {
    const liq = calcularLiquidacionAnticipada(yamit({ devengos: [{ periodo: '2026-11-05', interes: 150000 }], totalAPagar: 2650000, pagos: [{ tipo: 'intereses', montoPagado: 150000, fechaPago: '2026-11-05T15:00:00.000Z' }] }), new Date(el10))
    expect(liq.porDefecto.modalidad).toBe('mesCompleto')
    expect(liq.restanteHoy).toBe(2650000)
  })
})

describe('el servidor', () => {
  const post = leer('app/api/prestamos/route.js')
  const patch = leer('app/api/prestamos/[id]/route.js')
  it('el quincenal «Mes completo» lleva sus dos días; sin la opción, sigue sin días', () => {
    expect(post).toMatch(/const corteQuincenalMC = mesCompletoDb && freq === 'quincenal' && Number\.isInteger\(diaCobroMesDb\) && Number\.isInteger\(diaCobroMes2Db\)/)
    expect(post).toMatch(/if \(esAbierto && \(diaCobroMes \|\| diaCobroMes2\) && !corteMesCompleto\)/)
    expect(post).toMatch(/error: 'En quincenal pon los dos días de cobro/)
  })
  it('el primer corte guardado sale del mismo calendario de los dos días', () => {
    expect(post).toMatch(/\.\.\.\(corteQuincenalMC && \{ diaCobroMes: diaCobroMesDb, diaCobroMes2: diaCobroMes2Db \}\),/)
  })
  it('el abono previo de interés admite la quincena que corre y la asienta', () => {
    expect(post).toMatch(/const techo = cerrado \+ \(enCurso\?\.interesPeriodo \?\? 0\)/)
    expect(post).toMatch(/abonoPagaElPeriodoEnCurso = \(enCurso\?\.interesPeriodo \?\? 0\) > 0 && abonoInteres > cerrado/)
    expect(post).toMatch(/if \(esAbierto && !esPendiente && abonoPagaElPeriodoEnCurso\) \{\n\s+try \{ await asentarPeriodoPagadoAlCrear\(prisma, prestamo\.id\) \}/)
  })
  it('cambiar el día de cobro: el quincenal «Mes completo» pide los dos días', () => {
    expect(patch).toMatch(/\(\(p\.frecuencia \|\| 'diario'\) === 'quincenal' && dosDias\)/)
  })
})

describe('el formulario', () => {
  const form = leer('app/(dashboard)/prestamos/nuevo/page.jsx')
  it('«al mes» se convierte al escribir: guarda la mitad, enseña el doble', () => {
    expect(form).toMatch(/setTasa\(v === '' \? '' : tasaTexto\(Number\(v\) \/ 2\)\)/)
    expect(form).toMatch(/value=\{pctAlMesActivo \? tasaMesTexto : tasa\}/)
  })
  it('solo en el abierto quincenal', () => {
    expect(form).toMatch(/const pctAlMesActivo = esAbierto && frecuencia === 'quincenal' && pctAlMes/)
  })
  it('⚠ `pctAlMesActivo` se declara DESPUÉS de lo que lee (un const antes de tiempo deja la pantalla en blanco)', () => {
    const usa = form.indexOf('const pctAlMesActivo')
    expect(form.indexOf('const [pctAlMes, setPctAlMes]')).toBeLessThan(usa)
    expect(form.indexOf('const esAbierto =')).toBeLessThan(usa)
    expect(form.indexOf('const [tasaMesTexto, setTasaMesTexto]')).toBeLessThan(usa)
  })
  it('la preferencia se lee después de montar (leerla al arrancar daría un #418)', () => {
    expect(form).toMatch(/const \[pctAlMes, setPctAlMes\] = useState\(false\)/)
  })
})
