// lib/__tests__/admin-segmentos.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Poder distinguir cuáles están vencidos, que pagaban, cuáles pues son ya
//  usuarios basura, desechables.» — el dueño, 14 ago 2026.
//
// Había DOS clasificaciones conviviendo y contradiciéndose: `negocio` miraba
// si pagan, `activacion` miraba SOLO cuántos clientes cargaron. Un negocio de
// $259.000 al mes y uno que no ha pagado nunca salían los dos como «activos».
//
// Lo que estas pruebas cuidan:
//
//   1. Que el MRR vuelva a contar a quien no paga. La pantalla vieja daba
//      $23.038.000 donde hay $2.570.800 porque multiplicaba TODAS las
//      organizaciones por el precio de su plan.
//   2. Que la basura vuelva a colarse en las cifras. Son 210 de 485.
//   3. Que se pierda a quien pagó y se fue. `renovar` a mano crea una fila
//      NUEVA, así que mirar solo la última suscripción no basta.

import { describe, it, expect } from 'vitest'
import { segmentarOrganizacion, segmentarOrganizaciones, SEGMENTOS } from '@/lib/admin/segmentos'

const AHORA = new Date('2026-08-14T20:00:00Z')
const enDias = (n) => new Date(AHORA.getTime() + n * 86400000)

/** Una organización con lo mínimo; se le pisa lo que haga falta en cada caso. */
function org(cambios = {}) {
  const { suscripciones, owner, clientes = 20, prestamos = 30, ...resto } = cambios
  return {
    id: 'o1',
    nombre: 'Inversiones Prueba',
    plan: 'starter',
    createdAt: enDias(-60),
    users: [{
      id: 'u1', nombre: 'Dueño', email: 'd@e.co', telefono: '3001234567',
      lastLoginAt: enDias(-1), lastActivityAt: enDias(-1),
      ...owner,
    }],
    suscripciones: suscripciones ?? [],
    _count: { clientes, prestamos },
    ...resto,
  }
}

const suscripcion = (c = {}) => ({
  id: 's1', estado: 'activa', montoCOP: 0, plan: 'starter',
  fechaInicio: enDias(-30), fechaVencimiento: enDias(10), createdAt: enDias(-30),
  ...c,
})

describe('quién es quién', () => {
  it('paga y está al día → pagando, y su precio suma al MRR', () => {
    const f = segmentarOrganizacion(org({ suscripciones: [suscripcion({ montoCOP: 39000 })] }), AHORA)
    expect(f.segmento).toBe('pagando')
    expect(f.precio).toBe(39000)
  })

  it('⚠ pagó y se le venció → churn, no «vencido» a secas', () => {
    /* Es la lista más valiosa que hay: plata que YA era suya. */
    const f = segmentarOrganizacion(org({
      suscripciones: [suscripcion({ montoCOP: 39000, estado: 'vencida', fechaVencimiento: enDias(-5) })],
    }), AHORA)
    expect(f.segmento).toBe('churn')
    expect(f.precio).toBe(0)
  })

  it('⚠ pagó una vez y hoy tiene una fila nueva sin monto → sigue siendo churn', () => {
    /* `renovar` del panel CREA una suscripción nueva en vez de actualizar la
       que hay. Mirando solo la última, estos desaparecían de la lista. */
    const f = segmentarOrganizacion(org({
      suscripciones: [
        suscripcion({ id: 's2', montoCOP: 0, estado: 'vencida', fechaVencimiento: enDias(-2) }),
        suscripcion({ id: 's1', montoCOP: 59000, estado: 'vencida', fechaVencimiento: enDias(-40) }),
      ],
    }), AHORA)
    expect(f.segmento).toBe('churn')
  })

  it('prueba viva y con clientes cargados → probando', () => {
    const f = segmentarOrganizacion(org({ suscripciones: [suscripcion()] }), AHORA)
    expect(f.segmento).toBe('probando')
  })

  it('se le acabó la prueba pero llegó a usarla → vencido', () => {
    const f = segmentarOrganizacion(org({
      suscripciones: [suscripcion({ fechaVencimiento: enDias(-3) })],
    }), AHORA)
    expect(f.segmento).toBe('vencido')
  })

  it('⚠ sin un solo cliente cargado → basura, aunque le queden días', () => {
    /* Los clientes cargados son lo que predice el pago: 0 clientes → 0%. Un
       trial vacío no es una venta en curso. */
    const f = segmentarOrganizacion(org({ clientes: 0, suscripciones: [suscripcion()] }), AHORA)
    expect(f.segmento).toBe('basura')
  })

  it('⚠ nunca inició sesión → basura, aunque tenga filas', () => {
    const f = segmentarOrganizacion(org({
      owner: { lastLoginAt: null, lastActivityAt: null },
      suscripciones: [suscripcion()],
    }), AHORA)
    expect(f.segmento).toBe('basura')
    expect(f.nuncaEntro).toBe(true)
  })

  it('pagar gana sobre todo lo demás', () => {
    /* Un cliente que paga y no ha cargado clientes sigue siendo un cliente. */
    const f = segmentarOrganizacion(org({
      clientes: 0,
      suscripciones: [suscripcion({ montoCOP: 259000 })],
    }), AHORA)
    expect(f.segmento).toBe('pagando')
  })
})

describe('⚠ el MRR sale de lo que pagan, no de cuántos son', () => {
  it('la basura y las pruebas no suman un peso', () => {
    const r = segmentarOrganizaciones([
      org({ id: 'a', suscripciones: [suscripcion({ montoCOP: 39000 })] }),
      org({ id: 'b', suscripciones: [suscripcion({ montoCOP: 119000 })] }),
      org({ id: 'c', suscripciones: [suscripcion()] }),                       // probando
      org({ id: 'd', clientes: 0 }),                                          // basura
      org({ id: 'e', owner: { lastLoginAt: null } }),                         // basura
    ], AHORA)

    expect(r.mrr).toBe(158000)
    expect(r.porSegmento.pagando).toBe(2)
    expect(r.porSegmento.basura).toBe(2)
    // 5 organizaciones, pero solo 3 son negocios de verdad.
    expect(r.totalReal).toBe(3)
  })

  it('⚠ una organización sin suscripción NO vale el precio de su plan', () => {
    /* Este era el fallo exacto: `activo = true` lo tienen las 485 y la pantalla
       multiplicaba por el precio del plan. */
    const r = segmentarOrganizaciones([org({ plan: 'professional', suscripciones: [] })], AHORA)
    expect(r.mrr).toBe(0)
  })
})

describe('el teléfono se busca en los dos sitios', () => {
  it('si el dueño no lo tiene, se usa el de la organización', () => {
    const f = segmentarOrganizacion(org({ owner: { telefono: '' }, telefono: '3109999999' }), AHORA)
    expect(f.ownerTelefono).toBe('3109999999')
  })

  it('si no está en ninguno, queda vacío y la pantalla lo dice', () => {
    const f = segmentarOrganizacion(org({ owner: { telefono: null }, telefono: null }), AHORA)
    expect(f.ownerTelefono).toBe('')
  })
})

describe('los tonos de las pastillas existen de verdad', () => {
  it('⚠ ningún segmento usa un tono inventado', () => {
    /* `Pastilla` cae en `neutro` sin dar error si el tono no existe: escribir
       'verde' dejaba las cinco pastillas grises y nadie se enteraba. */
    const validos = ['mora', 'atraso', 'aldia', 'neutro', 'destacado']
    for (const s of SEGMENTOS) expect(validos, `«${s.id}» usa un tono que no existe`).toContain(s.tono)
  })
})
