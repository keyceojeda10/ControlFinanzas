/* 22 oct 2026: un préstamo que salió por Daviplata, al borrarse, dejaba
   Daviplata en −$100.000 y +$100.000 en «Ajustes sin cuenta». Borrar, cancelar
   y editar escribían el reverso SIN cuenta. Medido en el espejo, Soluciones
   S & L (modo estricto): crear → editar → borrar y crear → cancelar → borrar
   dejan cada cuenta como estaba, al peso. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { cuentaDelDesembolso } from '@/lib/dinero/cuenta-del-desembolso'

describe('cuentaDelDesembolso', () => {
  it('la última salida que dice su cuenta; sin ninguna, sin cuenta', async () => {
    let visto
    const db = (fila) => ({ movimientoCapital: { findFirst: async (args) => { visto = args; return fila } } })
    expect(await cuentaDelDesembolso(db({ metodoPago: 'transferencia', metodoPagoId: 'neq' }), { organizationId: 'o', prestamoId: 'p' }))
      .toEqual({ metodoPago: 'transferencia', metodoPagoId: 'neq' })
    expect(visto.where).toMatchObject({ organizationId: 'o', referenciaId: 'p', tipo: 'desembolso', ajusteArranqueRuta: false, metodoPago: { not: null } })
    expect(visto.orderBy).toEqual({ createdAt: 'desc' })
    expect(await cuentaDelDesembolso(db(null), { organizationId: 'o', prestamoId: 'p' })).toEqual({ metodoPago: null, metodoPagoId: null })
  })
})

describe('lo que vuelve, vuelve a su cuenta', () => {
  const r = readFileSync('app/api/prestamos/[id]/route.js', 'utf8')
  const tras = (ancla, largo = 900) => r.slice(r.indexOf(ancla), r.indexOf(ancla) + largo)
  it('borrar: el reverso del desembolso y el de cada cobro', () => {
    expect(tras('descripcion: `Reverso desembolso - préstamo eliminado')).toContain('...(await cuentaDelDesembolso(tx, { organizationId, prestamoId: id })),')
    const cobro = tras('descripcion: `Reverso recaudo - préstamo eliminado`', 500)
    expect(cobro).toContain('metodoPago: pg.metodoPago ?? null,')
    expect(cobro).toContain('metodoPagoId: pg.metodoPagoId ?? null,')
  })
  it('cancelar', () => {
    expect(tras('? `Cancelación préstamo - devuelve todo a caja', 2000)).toContain('...(await cuentaDelDesembolso(tx, { organizationId: session.user.organizationId, prestamoId: id })),')
  })
  it('editar: los dos asientos de la pareja', () => {
    expect(tras('descripcion: `Reverso desembolso - edición préstamo', 400)).toContain('...cuentaPareja,')
    expect(tras('descripcion: `Desembolso actualizado - edición préstamo', 400)).toContain('...cuentaPareja,')
  })
})
