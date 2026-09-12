// lib/__tests__/cobro-intento.test.js
//
// ⚠ ESTO COBRA DINERO DE CLIENTES REALES. Las pruebas de anclas miran que el
// código siga escrito así; éstas lo ejecutan contra una base de mentira y una
// pasarela de mentira, porque lo que importa es lo que PASA:
//
//   · que no se cobre dos veces, ni con dos pulsaciones a la vez;
//   · que un rechazo cierre la puerta a la hora del vencimiento, y se cuente una vez;
//   · que un Wompi caído no cuente como rechazo, ni libere un cobro que pudo salir;
//   · que el acceso vuelva solo con el pago APLICADO.
//
// «no poder darle acceso completo, porque, si no, lo que van a hacer es colocar
//  la X, como no cobra nada […] y ellos siguen dentro de la plataforma»
//                                                      — el dueño, 12 sep 2026

import { describe, it, expect, vi, beforeEach } from 'vitest'

const H = 3600000
let org
let subs

const cumple = (o, where) => Object.entries(where).every(([k, v]) => o[k] === v)
const aplicar = (o, data) => {
  for (const [k, v] of Object.entries(data)) {
    o[k] = v && typeof v === 'object' && 'increment' in v ? (o[k] ?? 0) + v.increment : v
  }
}
const masReciente = (lista) => [...lista].sort((a, b) => b.fechaVencimiento - a.fechaVencimiento)[0] ?? null

vi.mock('@/lib/prisma', () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(async ({ where }) => (org && where.id === org.id ? { ...org } : null)),
      /* El `where` se cumple o no en el momento de escribir: así se prueba el
         candado de verdad, no una llamada que devuelve lo que se le pida. */
      updateMany: vi.fn(async ({ where, data }) => {
        if (!org || !cumple(org, where)) return { count: 0 }
        aplicar(org, data)
        return { count: 1 }
      }),
    },
    suscripcion: {
      findFirst: vi.fn(async ({ where }) => {
        if (where.wompiTransactionId) {
          return subs.some((s) => s.wompiTransactionId === where.wompiTransactionId) ? { id: 'aplicada' } : null
        }
        if (where.estado) {
          return masReciente(subs.filter((s) => where.estado.in.includes(s.estado) && s.montoCOP > 0))
        }
        return masReciente(subs)
      }),
    },
  },
}))

vi.mock('@/lib/wompi', async (importOriginal) => ({
  ...(await importOriginal()),
  cobrarConFuente: vi.fn(),
  consultarTransaccion: vi.fn(),
  transaccionPorReferencia: vi.fn(),
}))

vi.mock('@/lib/activar-suscripcion', () => ({ activarPlanPagado: vi.fn() }))

const wompi = await import('@/lib/wompi')
const { activarPlanPagado } = await import('@/lib/activar-suscripcion')
const { cobrarAhoraSiToca, reconciliar, contarRechazo } = await import('@/lib/cobro-intento')
const { vencimientoEfectivo, rechazoVigente } = await import('@/lib/cobro-automatico')

const ahora = () => Date.now()
const subDePago = (horasHastaVencer, extra = {}) => ({
  plan: 'basic', estado: 'activa', montoCOP: 59000, mpStatus: null,
  fechaVencimiento: new Date(ahora() + horasHastaVencer * H), ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
  org = {
    id: 'org1', nombre: 'Negocio', plan: 'basic', planOriginal: null, descuento: 0, country: 'co',
    wompiFuentePagoId: 12345, wompiFuenteEmail: 'dueno@ejemplo.test', cobroAutomatico: true,
    cobroFallos: 0, cobroUltimoIntento: null,
    cobroRefPendiente: null, cobroTxPendiente: null,
    cobroRechazoVence: null, cobroRechazoMotivo: null,
  }
  subs = [subDePago(30)]
})

describe('cuándo se cobra', () => {
  it('con el plan pagado para más de 48 h, guardar el medio no cobra', async () => {
    subs = [subDePago(10 * 24)]
    const r = await cobrarAhoraSiToca({ orgId: 'org1' })
    expect(r.resultado).toBe('no-hace-falta')
    expect(wompi.cobrarConFuente).not.toHaveBeenCalled()
  })

  it('a menos de 48 h de vencer, cobra lo que pagó la última vez, y el MES', async () => {
    wompi.cobrarConFuente.mockResolvedValue({ ok: true, id: 'tx1', estado: 'PENDING' })
    const r = await cobrarAhoraSiToca({ orgId: 'org1' })
    expect(r.resultado).toBe('enviado')
    expect(wompi.cobrarConFuente).toHaveBeenCalledTimes(1)
    const { montoCOP, referencia, fuenteId } = wompi.cobrarConFuente.mock.calls[0][0]
    expect(montoCOP).toBe(59000)
    expect(fuenteId).toBe(12345)
    expect(wompi.leerReferencia(referencia)).toMatchObject({ orgId: 'org1', plan: 'basic', periodo: 'mensual' })
    /* En vuelo, con la transacción apuntada para poder preguntarla. */
    expect(org.cobroRefPendiente).toBe(referencia)
    expect(org.cobroTxPendiente).toBe('tx1')
  })

  it('sin medio guardado o con el cobro apagado, no cobra', async () => {
    org.cobroAutomatico = false
    expect((await cobrarAhoraSiToca({ orgId: 'org1' })).resultado).toBe('sin-medio')
    org.cobroAutomatico = true
    org.wompiFuentePagoId = null
    expect((await cobrarAhoraSiToca({ orgId: 'org1' })).resultado).toBe('sin-medio')
    expect(wompi.cobrarConFuente).not.toHaveBeenCalled()
  })
})

describe('⚠ nunca dos veces', () => {
  it('dos pulsaciones a la vez: Wompi recibe UN cobro', async () => {
    wompi.cobrarConFuente.mockResolvedValue({ ok: true, id: 'tx1', estado: 'PENDING' })
    const [a, b] = await Promise.all([
      cobrarAhoraSiToca({ orgId: 'org1' }),
      cobrarAhoraSiToca({ orgId: 'org1' }),
    ])
    expect([a.resultado, b.resultado].sort()).toEqual(['enviado', 'pendiente'])
    expect(wompi.cobrarConFuente).toHaveBeenCalledTimes(1)
  })

  it('pulsar otra vez a los 30 segundos no cobra: espera', async () => {
    org.cobroUltimoIntento = new Date(ahora() - 30 * 1000)
    const r = await cobrarAhoraSiToca({ orgId: 'org1' })
    expect(r.resultado).toBe('espera')
    expect(r.segundos).toBeGreaterThan(60)
    expect(wompi.cobrarConFuente).not.toHaveBeenCalled()
  })

  it('con un cobro en vuelo del que Wompi aún no sabe, no se manda otro', async () => {
    org.cobroRefPendiente = 'cf-org1-basic-mensual-1'
    org.cobroUltimoIntento = new Date(ahora() - 5 * 60 * 1000)
    wompi.transaccionPorReferencia.mockResolvedValue(null)
    const r = await cobrarAhoraSiToca({ orgId: 'org1' })
    expect(r.resultado).toBe('pendiente')
    expect(wompi.cobrarConFuente).not.toHaveBeenCalled()
    expect(org.cobroRefPendiente).toBe('cf-org1-basic-mensual-1')
  })

  it('pasada media hora sin rastro en Wompi, se libera y se puede cobrar', async () => {
    org.cobroRefPendiente = 'cf-org1-basic-mensual-1'
    org.cobroUltimoIntento = new Date(ahora() - 31 * 60 * 1000)
    wompi.transaccionPorReferencia.mockResolvedValue(null)
    wompi.cobrarConFuente.mockResolvedValue({ ok: true, id: 'tx2', estado: 'PENDING' })
    const r = await cobrarAhoraSiToca({ orgId: 'org1' })
    expect(r.resultado).toBe('enviado')
    expect(wompi.cobrarConFuente).toHaveBeenCalledTimes(1)
  })
})

describe('⚠ un rechazo cierra la puerta', () => {
  it('Nequi sin saldo: se apunta el rechazo y el acceso acaba al vencer, sin gracia', async () => {
    wompi.cobrarConFuente.mockResolvedValue({ ok: true, id: 'tx1', estado: 'DECLINED', mensaje: 'Saldo insuficiente' })
    const r = await cobrarAhoraSiToca({ orgId: 'org1' })
    expect(r.resultado).toBe('rechazado')
    expect(org.cobroFallos).toBe(1)
    expect(org.cobroRechazoVence).toEqual(subs[0].fechaVencimiento)
    expect(org.cobroRechazoMotivo).toBe('Saldo insuficiente')
    expect(org.cobroRefPendiente).toBeNull()

    const venc = subs[0].fechaVencimiento
    expect(rechazoVigente(org, venc)).toBe(true)
    expect(vencimientoEfectivo(venc, org)).toBe(venc)
  })

  it('sin rechazo, la misma org tendría 24 h más: la gracia es lo que se quita', () => {
    const venc = subs[0].fechaVencimiento
    expect(vencimientoEfectivo(venc, org).getTime() - venc.getTime()).toBe(24 * H)
  })

  it('reintentar y volver a fallar suma, no reinicia', async () => {
    wompi.cobrarConFuente.mockResolvedValue({ ok: true, id: 'tx1', estado: 'DECLINED', mensaje: 'Saldo insuficiente' })
    await cobrarAhoraSiToca({ orgId: 'org1' })
    org.cobroUltimoIntento = new Date(ahora() - 3 * 60 * 1000)
    wompi.cobrarConFuente.mockResolvedValue({ ok: true, id: 'tx2', estado: 'DECLINED', mensaje: 'Saldo insuficiente' })
    await cobrarAhoraSiToca({ orgId: 'org1' })
    expect(org.cobroFallos).toBe(2)
    expect(org.cobroRechazoVence).not.toBeNull()
  })

  it('⚠ con el rechazo puesto, un plan «cubierto» NO ahorra el cobro', async () => {
    /* Si «ya está pago» se mirara antes que el rechazo, el botón diría «al día»
       a quien está fuera. */
    subs = [subDePago(10 * 24)]
    org.cobroRechazoVence = subs[0].fechaVencimiento
    org.cobroFallos = 1
    wompi.cobrarConFuente.mockResolvedValue({ ok: true, id: 'tx1', estado: 'PENDING' })
    const r = await cobrarAhoraSiToca({ orgId: 'org1' })
    expect(r.resultado).toBe('enviado')
  })

  it('el rechazo llega por la respuesta Y por el webhook: se cuenta una vez', async () => {
    wompi.cobrarConFuente.mockResolvedValue({ ok: true, id: 'tx1', estado: 'DECLINED', mensaje: 'Saldo insuficiente' })
    await cobrarAhoraSiToca({ orgId: 'org1' })
    const ref = wompi.cobrarConFuente.mock.calls[0][0].referencia
    expect(await contarRechazo('org1', ref, 'DECLINED')).toBe(false)
    expect(org.cobroFallos).toBe(1)
  })

  it('un rechazo de un checkout que no es el cobro en vuelo no toca nada', async () => {
    expect(await contarRechazo('org1', 'cf-org1-basic-mensual-999', 'DECLINED')).toBe(false)
    expect(org.cobroRechazoVence).toBeNull()
  })

  it('un rechazo de un periodo ya pagado no cuenta para el siguiente', async () => {
    org.cobroRechazoVence = new Date(ahora() - 30 * 24 * H)
    org.cobroFallos = 3
    wompi.cobrarConFuente.mockResolvedValue({ ok: true, id: 'tx1', estado: 'PENDING' })
    await cobrarAhoraSiToca({ orgId: 'org1' })
    expect(org.cobroFallos).toBe(0)
    expect(org.cobroRechazoVence).toBeNull()
  })
})

describe('⚠ lo que no es culpa del cliente no cuenta como rechazo', () => {
  it('nuestra llave mal (401): se libera y no se apunta rechazo', async () => {
    wompi.cobrarConFuente.mockResolvedValue({ ok: false, http: 401, motivo: 'Unauthorized' })
    const r = await cobrarAhoraSiToca({ orgId: 'org1' })
    expect(r.resultado).toBe('error')
    expect(org.cobroRechazoVence).toBeNull()
    expect(org.cobroFallos).toBe(0)
    expect(org.cobroRefPendiente).toBeNull()
  })

  it('Wompi caído (500): el cobro pudo salir, así que queda en vuelo', async () => {
    wompi.cobrarConFuente.mockResolvedValue({ ok: false, http: 502, motivo: 'Bad gateway' })
    const r = await cobrarAhoraSiToca({ orgId: 'org1' })
    expect(r.resultado).toBe('error')
    expect(org.cobroRechazoVence).toBeNull()
    expect(org.cobroRefPendiente).not.toBeNull()
  })

  it('la red se corta con la petición mandada: también queda en vuelo', async () => {
    wompi.cobrarConFuente.mockRejectedValue(new Error('socket hang up'))
    const r = await cobrarAhoraSiToca({ orgId: 'org1' })
    expect(r.resultado).toBe('error')
    expect(org.cobroRefPendiente).not.toBeNull()
  })

  it('una validación de Wompi (422) sí es rechazo: el medio no sirve', async () => {
    wompi.cobrarConFuente.mockResolvedValue({ ok: false, http: 422, motivo: 'La fuente de pago no existe' })
    const r = await cobrarAhoraSiToca({ orgId: 'org1' })
    expect(r.resultado).toBe('rechazado')
    expect(org.cobroRechazoVence).not.toBeNull()
  })
})

describe('⚠ el acceso vuelve con el pago APLICADO, no antes', () => {
  const enVuelo = () => {
    org.cobroRefPendiente = wompi.referenciaDeCobro('org1', 'basic', 'mensual')
    org.cobroTxPendiente = 'tx9'
    org.cobroUltimoIntento = new Date(ahora() - 60 * 1000)
    org.cobroRechazoVence = subs[0].fechaVencimiento
  }

  it('PENDING sigue en vuelo', async () => {
    enVuelo()
    wompi.consultarTransaccion.mockResolvedValue({ id: 'tx9', status: 'PENDING', reference: org.cobroRefPendiente })
    expect(await reconciliar({ ...org })).toBe('pendiente')
    expect(activarPlanPagado).not.toHaveBeenCalled()
  })

  it('APPROVED: activa por el camino único y libera', async () => {
    enVuelo()
    const ref = org.cobroRefPendiente
    wompi.consultarTransaccion.mockResolvedValue({ id: 'tx9', status: 'APPROVED', reference: ref, amount_in_cents: 5900000 })
    activarPlanPagado.mockImplementation(async () => {
      subs.push(subDePago(30 + 30 * 24, { wompiTransactionId: 'tx9' }))
      return { ok: true }
    })
    expect(await reconciliar({ ...org })).toBe('aprobada')
    expect(activarPlanPagado).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org1', plan: 'basic', periodo: 'mensual', montoCOP: 59000, gatewayId: 'tx9',
    }))
    expect(org.cobroRefPendiente).toBeNull()
  })

  it('⚠ APPROVED que no llegó a aplicarse NO se da por bueno', async () => {
    /* `activarPlanPagado` dice «ya procesado» también cuando su transacción
       falla. Liberar aquí sería perder la pista de un pago cobrado. */
    enVuelo()
    wompi.consultarTransaccion.mockResolvedValue({ id: 'tx9', status: 'APPROVED', reference: org.cobroRefPendiente, amount_in_cents: 5900000 })
    activarPlanPagado.mockResolvedValue({ ok: true, yaProcesado: true })
    expect(await reconciliar({ ...org })).toBe('pendiente')
    expect(org.cobroRefPendiente).not.toBeNull()
  })

  it('una transacción con otra referencia no se aplica a esta org', async () => {
    enVuelo()
    wompi.consultarTransaccion.mockResolvedValue({ id: 'tx9', status: 'APPROVED', reference: 'cf-otra-basic-mensual-1' })
    expect(await reconciliar({ ...org })).toBe('pendiente')
    expect(activarPlanPagado).not.toHaveBeenCalled()
  })

  it('DECLINED al preguntar: se cuenta y se libera', async () => {
    enVuelo()
    org.cobroRechazoVence = null
    wompi.consultarTransaccion.mockResolvedValue({ id: 'tx9', status: 'DECLINED', reference: org.cobroRefPendiente, status_message: 'Saldo insuficiente' })
    expect(await reconciliar({ ...org })).toBe('libre')
    expect(org.cobroFallos).toBe(1)
    expect(org.cobroRechazoVence).toEqual(subs[0].fechaVencimiento)
  })
})
