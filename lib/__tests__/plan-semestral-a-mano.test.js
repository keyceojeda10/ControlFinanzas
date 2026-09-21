/* SEIS MESES, ASIGNADOS A MANO DESDE EL SUPERADMIN — 21 sep 2026.
 *
 * El dueño: «no tenemos por seis meses, y es un buen cliente; podríamos hacerle un
 * pequeño descuento para que sea razonable que pague los seis meses». Inversiones
 * Don Pacho, Básico ($59.000/mes), pagaba trimestral ($159.300). Se le cobran
 * $300.000 por 6 meses. El superadmin solo dejaba mensual, trimestral o anual. */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { MESES_PERIODO, ofertaPublica, pagoCuadra, precioPorRevisar, montoDelCobro } from '@/lib/precio-plan'

const leer = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8')
const donPacho = { country: 'co', precioPreferencial: null, precioPreferencialPlan: null, precioPreferencialHasta: null, precioPagoRevisado: null }

describe('el precio del semestre', () => {
  it('son 6 meses con un 15 % menos: entre el trimestre y el año', () => {
    expect(MESES_PERIODO.semestral).toBe(6)
    expect(ofertaPublica('basic', 'semestral')).toBe(300900)
    // Por mes, más barato que el trimestre y más caro que el año: el año sigue siendo la mejor oferta.
    const alMes = (p) => ofertaPublica('basic', p) / MESES_PERIODO[p]
    expect(alMes('semestral')).toBeLessThan(alMes('trimestral'))
    expect(alMes('semestral')).toBeGreaterThan(alMes('anual'))
  })

  it('los $300.000 que se le cobraron cuadran —no quedan «por revisar»—', () => {
    expect(pagoCuadra(donPacho, 'basic', 300000)).toBe(true)
    expect(precioPorRevisar(donPacho, { plan: 'basic', montoCOP: 300000 })).toBe(false)
  })

  it('y al terminar los 6 meses el cobro vuelve a la lista del mes, no repite el semestre', () => {
    const cobro = montoDelCobro({ org: donPacho, plan: 'basic', pagada: { plan: 'basic', montoCOP: 300000 } })
    expect(cobro.monto).toBe(59000)
    expect(cobro.porRevisar).toBe(false)
  })
})

describe('solo en el superadmin', () => {
  it('el superadmin lo ofrece y le da 180 días', () => {
    const form = leer('components/admin/AsignarPlanDirecto.jsx')
    expect(form).toContain('<option value="semestral">Semestral (180 días)</option>')
    expect(form).toMatch(/DIAS_PERIODO = \{[^}]*semestral: 180/)
    const api = leer('app/api/admin/organizaciones/[id]/route.js')
    expect(api).toContain("['mensual', 'trimestral', 'semestral', 'anual'].includes(periodo)")
    expect(api).toMatch(/semestral: 180/)
    expect(api).toMatch(/semestral: 'Semestral'/)
  })

  it('el pago en línea del público NO lo ofrece: es un trato, no un precio de lista', () => {
    expect(leer('app/api/pagos/wompi/crear/route.js')).toContain("['mensual', 'trimestral', 'anual'].includes(periodo)")
  })

  it('y el libro de pagos lo entiende al leer el registro', () => {
    expect(leer('lib/libro-pagos.js')).toMatch(/semestral: 'semestral'/)
  })
})
