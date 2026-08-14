// lib/__tests__/libro-pagos.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «El MRR puede decir 2.500.000, pero a día de hoy no sé cuántos ya me han
//  pagado. No sé si me han pagado un millón, si me han pagado 300, si me han
//  pagado 2 millones.» — el dueño, 14 ago 2026.
//
// No era la pantalla: el dato no se guardaba. `Suscripcion` es UNA fila por
// organización y renovar la pisa, así que el pago anterior desaparecía.
//
// Lo que estas pruebas cuidan son las tres formas de que el libro vuelva a
// mentir:
//
//   1. Que se apunte dos veces el mismo pago. Un reintento de la pasarela
//      inflaría el mes, que es justo lo que este libro existe para evitar.
//   2. Que se apunten los trials de $0. Ensuciarían el «cuánto entró» con
//      filas de cero.
//   3. Que la reconstrucción lea mal el monto. De ahí sale una cifra de dinero
//      a partir de un TEXTO, y las dos vías lo escriben distinto: el panel
//      pone separador de miles ($39.000) y el webhook no ($39000).

import { describe, it, expect } from 'vitest'
import { registrarPagoSuscripcion, leerApunteDeAdminLog, montoDeTexto } from '@/lib/libro-pagos'

// Un Prisma de mentira: apunta lo que se le pide y devuelve lo que le pongas.
function txFalso({ existente = null } = {}) {
  const escrituras = []
  return {
    escrituras,
    pagoSuscripcion: {
      findUnique: async () => existente,
      create: async (args) => { escrituras.push(args.data); return args.data },
    },
  }
}

const pagoBase = {
  organizationId: 'org1',
  plan: 'starter',
  montoCOP: 39000,
  gateway: 'wompi',
  gatewayId: '1485602-1786736042-25463',
}

describe('el libro apunta lo que entró', () => {
  it('guarda el pago con su monto, su vía y su fecha', async () => {
    const tx = txFalso()
    await registrarPagoSuscripcion(tx, { ...pagoBase, periodo: 'anual' })

    expect(tx.escrituras).toHaveLength(1)
    expect(tx.escrituras[0]).toMatchObject({
      organizationId: 'org1',
      plan: 'starter',
      montoCOP: 39000,
      periodo: 'anual',
      gateway: 'wompi',
      gatewayId: '1485602-1786736042-25463',
      origen: 'directo',
    })
  })

  it('⚠ no apunta dos veces el mismo pago de pasarela', async () => {
    /* El webhook reintenta. Sin esto, un reintento sumaría $39.000 que nunca
       llegaron y el mes saldría inflado. */
    const tx = txFalso({ existente: { id: 'ya' } })
    expect(await registrarPagoSuscripcion(tx, pagoBase)).toBeNull()
    expect(tx.escrituras).toHaveLength(0)
  })

  it('⚠ un plan de $0 no es un pago', async () => {
    const tx = txFalso()
    expect(await registrarPagoSuscripcion(tx, { ...pagoBase, montoCOP: 0 })).toBeNull()
    expect(tx.escrituras).toHaveLength(0)
  })

  it('los registrados a mano van sin id de pasarela', async () => {
    /* Y por eso NO se comprueba si ya existe: cada vez que el dueño registra un
       pago a mano es un pago distinto, no un duplicado. */
    const tx = txFalso({ existente: { id: 'ya' } })
    await registrarPagoSuscripcion(tx, {
      organizationId: 'org1', plan: 'basic', montoCOP: 59000,
      gateway: 'manual', adminId: 'admin1',
    })
    expect(tx.escrituras).toHaveLength(1)
    expect(tx.escrituras[0].gatewayId).toBeNull()
    expect(tx.escrituras[0].adminId).toBe('admin1')
  })

  it('sin organización o sin vía no escribe nada', async () => {
    const tx = txFalso()
    await registrarPagoSuscripcion(tx, { ...pagoBase, organizationId: null })
    await registrarPagoSuscripcion(tx, { ...pagoBase, gateway: null })
    expect(tx.escrituras).toHaveLength(0)
  })
})

describe('⚠ reconstruir el pasado: el monto sale de un texto', () => {
  it('lee el del webhook, escrito sin separador', () => {
    const a = leerApunteDeAdminLog({
      id: 'log1',
      detalle: 'Pago aprobado por wompi #1485602-1786736042-25463. Plan: starter. Monto: $39000',
    })
    expect(a).toEqual({
      gateway: 'wompi',
      gatewayId: '1485602-1786736042-25463',
      plan: 'starter',
      montoCOP: 39000,
      periodo: 'mensual',
      adminId: null,
    })
  })

  it('lee el del panel, escrito CON separador de miles', () => {
    /* $39.000 y $39000 son el mismo número. Si el punto se leyera como decimal,
       el mes entero saldría en 39 pesos. */
    const a = leerApunteDeAdminLog({
      id: 'log2',
      adminId: 'admin1',
      detalle: 'Plan starter asignado (pago directo). Período: Mensual. Monto: $39.000. Vigente hasta: 13/9/2026',
    })
    expect(a.montoCOP).toBe(39000)
    expect(a.gateway).toBe('manual')
    expect(a.periodo).toBe('mensual')
    expect(a.adminId).toBe('admin1')
  })

  it('el apunte manual lleva llave propia, para no duplicarse al repetir el script', () => {
    const a = leerApunteDeAdminLog({
      id: 'log3',
      detalle: 'Plan basic asignado (pago directo). Período: Anual. Monto: $590.000. Vigente hasta: 1/1/2027',
    })
    expect(a.gatewayId).toBe('adminlog:log3')
    expect(a.periodo).toBe('anual')
    expect(a.montoCOP).toBe(590000)
  })

  it('un millón con dos puntos también', () => {
    expect(montoDeTexto('2.531.800')).toBe(2531800)
    expect(montoDeTexto('1500')).toBe(1500)
  })

  it('lo que no entiende devuelve null, no un cero silencioso', () => {
    /* Un cero se sumaría sin avisar. Null obliga al script a contarlo aparte y
       a decirlo por pantalla. */
    expect(leerApunteDeAdminLog({ id: 'x', detalle: 'Plan cambiado a growth' })).toBeNull()
    expect(leerApunteDeAdminLog({ id: 'x' })).toBeNull()
    expect(leerApunteDeAdminLog(null)).toBeNull()
  })
})

describe('⚠ las dos vías por las que entra plata escriben en el libro', () => {
  const leer = (r) => require('fs').readFileSync(require('path').resolve(process.cwd(), r), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

  it('la pasarela, dentro de la transacción que activa el plan', () => {
    const src = leer('lib/activar-suscripcion.js')
    expect(src).toMatch(/registrarPagoSuscripcion\(tx, \{/)
    // Dentro del $transaction, no después: si se activa el plan, la plata queda.
    const dentro = src.slice(src.indexOf('prisma.$transaction'), src.indexOf('catch (txErr)'))
    expect(dentro).toMatch(/registrarPagoSuscripcion/)
  })

  it('el pago directo del panel, que es por donde entraron 82 de los 93', () => {
    const src = leer('app/api/admin/organizaciones/[id]/route.js')
    const asignar = src.slice(src.indexOf("accion === 'asignarPlan'"))
    expect(asignar).toMatch(/registrarPagoSuscripcion\(tx, \{/)
    expect(asignar).toMatch(/gateway: 'manual'/)
  })
})
