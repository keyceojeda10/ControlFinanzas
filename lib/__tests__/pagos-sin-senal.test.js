/* Un cobro sin señal (5 sep 2026). Lo que comparten teléfono, service worker y
   API: el marcador, la fecha real y qué rechazo se reintenta. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { marcadorOffline, resolverFechaDelPago, esFalloReintentable, explicarFallo, DIAS_MAX_ATRAS } from '@/lib/pagos-sin-senal'

const lee = (p) => readFileSync(p, 'utf8')

describe('el marcador', () => {
  it('es el mismo texto que llevan los 58 cobros que ya subieron así', () => {
    expect(marcadorOffline('2026-09-05T00:43:10.000Z')).toBe('[offline: 2026-09-05T00:43:10.000Z]')
  })
})

describe('la fecha con la que se registra un cobro encolado', () => {
  const ahora = new Date('2026-09-05T17:03:00.000Z')
  it('el jueves a las 7:43 pm es plata del jueves, aunque suba el viernes', () => {
    const r = resolverFechaDelPago({ fechaPago: '2026-09-05T00:43:10.000Z', ahora })
    expect(r.motivo).toBeNull()
    expect(r.fecha.toISOString()).toBe('2026-09-05T00:43:10.000Z')
  })
  it('sin fecha, o con una fecha rota, se registra con ahora', () => {
    expect(resolverFechaDelPago({ ahora }).fecha).toBe(ahora)
    expect(resolverFechaDelPago({ fechaPago: 'ayer', ahora }).motivo).toBe('fecha inválida')
  })
  it('una fecha en el futuro es un reloj mal puesto: ahora', () => {
    expect(resolverFechaDelPago({ fechaPago: '2026-09-06T10:00:00.000Z', ahora }).motivo).toBe('fecha en el futuro')
    // cinco minutos de margen sí se aceptan
    expect(resolverFechaDelPago({ fechaPago: '2026-09-05T17:06:00.000Z', ahora }).motivo).toBeNull()
  })
  it(`más de ${DIAS_MAX_ATRAS} días atrás tampoco se cree`, () => {
    expect(resolverFechaDelPago({ fechaPago: '2026-07-01T10:00:00.000Z', ahora }).motivo).toMatch(/días atrás/)
  })
})

describe('qué rechazo se vuelve a intentar', () => {
  it('sesión, plan, caja cerrada, «duplicado» y el servidor caído: sí', () => {
    for (const s of [401, 403, 408, 409, 429, 500, 502, 503]) expect(esFalloReintentable(s), String(s)).toBe(true)
  })
  it('préstamo inexistente o datos inválidos: no', () => {
    for (const s of [400, 404, 422]) expect(esFalloReintentable(s), String(s)).toBe(false)
  })
})

describe('el motivo, en el idioma de la persona', () => {
  it('no dice «HTTP 403»', () => {
    expect(explicarFallo({ status: 403, errorMsg: 'Tu suscripción está vencida. Renueva tu plan para continuar.' })).toMatch(/plan estaba vencido/)
    expect(explicarFallo({ status: 403, errorMsg: 'Ya cerraste tu caja de hoy.' })).toMatch(/caja del día estaba cerrada/)
    expect(explicarFallo({ status: 401, errorMsg: 'No autorizado' })).toMatch(/sesión estaba cerrada/)
    expect(explicarFallo({ status: 409, errorMsg: 'Posible pago duplicado' })).toMatch(/repetido/)
    expect(explicarFallo({ status: 400, errorMsg: 'No se pueden registrar pagos en préstamos inactivos' })).toMatch(/ya no está activo/)
    expect(explicarFallo({ errorMsg: 'Fallaron 5 intentos' })).toMatch(/no respondió/)
  })
})

describe('el teléfono y el service worker mandan lo mismo', () => {
  const OFF = lee('lib/offline.js'); const SW = lee('public/sw.js')
  it('fecha real, cuenta y marcador, en los dos', () => {
    for (const src of [OFF, SW]) {
      expect(src).toMatch(/fechaPago:\s+p(ago)?\.createdAt/)
      expect(src).toMatch(/metodoPagoId:\s+p(ago)?\.metodoPagoId \?\? null/)
      expect(src).toMatch(/offlineId:\s+p(ago)?\.createdAt/)
    }
  })
  it('los rechazos pasajeros quedan reintentables, en los dos', () => {
    expect(OFF).toMatch(/reintentable: esFalloReintentable\(res\.status\)/)
    expect(SW).toMatch(/const reintentable = \[401, 403, 408, 409, 429\]\.includes\(res\.status\)/)
  })
  it('las tres colas guardan el cliente y la cuenta', () => {
    expect(lee('components/prestamos/RegistrarPago.jsx')).toMatch(/clienteId: cliente\?\.id \?\? null/)
    expect(lee('components/prestamos/RegistrarPago.jsx')).toMatch(/\.\.\.\(metodoPagoId \? \{ metodoPagoId \} : \{\}\),\s*\n\s*clienteId/)
    expect(lee('app/(dashboard)/cobros-hoy/page.jsx')).toMatch(/\.\.\.\(metodoPagoId \? \{ metodoPagoId \} : \{\}\),\s*\n\s*clienteId,/)
    expect(lee('app/(dashboard)/rutas/[id]/page.jsx')).toMatch(/prestamoId: prestamoActivo,\s*\n\s*clienteId,/)
  })
})

describe('un cobro fallido se puede REINTENTAR, y descartar pregunta', () => {
  const DRAWER = lee('components/offline/SyncDrawer.jsx'); const PROV = lee('components/providers/OfflineProvider.jsx')
  it('los pagos fallidos llevan Reintentar y el motivo traducido', () => {
    const i = DRAWER.indexOf('title="Pagos fallidos"')
    const bloque = DRAWER.slice(i, i + 400)
    expect(bloque).toMatch(/onRetry=\{\(p\) => reintentarItem\('pago', p\.id\)\}/)
    expect(bloque).toMatch(/sub: explicarFallo\(p\)/)
  })
  it('Reintentar devuelve el cobro a la cola y sube en el acto', () => {
    expect(PROV).toMatch(/if \(tipo === 'pago'\) \{\s*\n\s*await reencolarPagoFallido\(id\)/)
    expect(PROV).toMatch(/sincronizarPagos\(\{ forzarFallidos: !silent \}\)/)
  })
  it('Descartar dice lo que significa antes de hacerlo', () => {
    expect(DRAWER).toMatch(/window\.confirm\(`\$\{main\}\\n\\nSe borra SOLO del teléfono/)
  })
})

describe('se ve donde se mira', () => {
  it('el recibo sin señal titula «Guardado en el teléfono»', () => {
    expect(lee('components/pantallas/Recibo.jsx')).toMatch(/\{offline \? 'Guardado en el teléfono' : titulo\}/)
  })
  it('la campana lo pone de primero', () => {
    const P = lee('components/armazon/PilaAvisos.jsx')
    expect(P).toMatch(/items=\{\[avisoSinSubir, /)
    expect(P).toMatch(/id: 'sin-subir'/)
  })
  it('la ficha del préstamo lo dice y lleva al cajón', () => {
    const F = lee('app/(dashboard)/prestamos/[id]/page.jsx')
    expect(F).toMatch(/guardado en este teléfono, sin subir/)
    expect(F).toMatch(/onClick=\{\(\) => openSyncDrawer\?\.\(\)\}/)
  })
})

describe('el API reconoce la cola', () => {
  const API = lee('app/api/prestamos/[id]/pagos/route.js')
  it('el mismo cobro dos veces es una vez (marcador en la nota)', () => {
    // La idempotencia ya existía; se comprueba que siga y que sea UNA sola.
    expect(API).toMatch(/idempotente: true/)
    expect(API).toMatch(/const marcador = offlineId \? marcadorOffline\(String\(offlineId\)\) : null/)
    expect(API, 'volvió una segunda comprobación de duplicado').not.toMatch(/yaEstaba/)
  })
  it('sin el 409 de «duplicado» para lo que viene de la cola', () => {
    expect(API).toMatch(/if \(!confirmarDuplicado && !marcador\) \{/)
  })
  it('se registra con la fecha real, y la caja cerrada de un cobrador manda a hoy', () => {
    expect(API).toMatch(/fechaPago: fechaDelPago,/)
    expect(API).toMatch(/resolverFechaDelPago\(\{ fechaPago: fechaPagoCuerpo, ahora: fechaDelPago \}\)/)
    expect(API).toMatch(/la caja de ese día ya estaba cerrada/)
    expect(API, 'volvió la fecha «ahora» al crear el pago').not.toMatch(/fechaPago: new Date\(\),/)
  })
})
