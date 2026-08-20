// lib/__tests__/de-quien-es-la-cuenta.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Si el cobrador cobra a la cuenta de la oficina, pues se puede escoger cuenta
//  de la oficina. Si cobra a su cuenta propia, que pueda seleccionar su propia
//  cuenta.» — el dueño, 20 ago 2026.
//
// Hasta ese día el sistema daba por hecho que TODA transferencia llega a la
// oficina, y ese supuesto solo existía como una cita en un comentario:
//
//   «cuando llegan a entregar en la noche saben que ese dinero llegó a la
//    cuenta de la oficina y el resto lo traen en efectivo»  — PRESTA MIL
//
// Cierto para ellos. El dueño levantó la mano —«puede que otros negocios
// trabajen distinto»— y tenía razón. Y no es un detalle: es el 18% de todo lo
// que se cobra en el sistema. El negocio que trabaje al revés NO se iba a
// quejar, porque la caja le diría que cuadra mientras le falta plata.
//
// ⚠ EL FALLO SILENCIOSO ES EL PELIGROSO, y por eso el defecto se queda como
//   estaba: `esDelCobrador = false`. Marcar de más hace que la caja pida
//   billetes que no existen —ruidoso, se corrige en un día—. Marcar de menos
//   esconde un faltante para siempre.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { entraAlFajo, repartirCobros, cuentasDelCobrador } from '@/lib/dinero/cuentas'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
const OFICINA = 'cuenta-oficina'
const DEL_COBRADOR = 'cuenta-del-cobrador'
const marcadas = new Set([DEL_COBRADOR])

describe('¿esta plata la tiene el cobrador en la mano?', () => {
  it('el efectivo, siempre', () => {
    expect(entraAlFajo('efectivo', null, marcadas)).toBe(true)
  })

  it('⚠ lo que no dice nada TAMBIÉN es efectivo', () => {
    /* Es el modo por defecto de un cobro en la calle. Descartarlo perdía plata
       del desglose, y ya está escrito en los dos endpoints. */
    expect(entraAlFajo(null, null, marcadas)).toBe(true)
    expect(entraAlFajo(undefined, undefined, marcadas)).toBe(true)
  })

  it('una transferencia a la cuenta de la OFICINA no va en el fajo', () => {
    expect(entraAlFajo('transferencia', OFICINA, marcadas)).toBe(false)
  })

  it('⚠ una transferencia a la cuenta DEL COBRADOR sí va', () => {
    // Es el caso nuevo: la recibió él y después se la pasa al negocio.
    expect(entraAlFajo('transferencia', DEL_COBRADOR, marcadas)).toBe(true)
  })

  it('sin ninguna cuenta marcada, todo se comporta como antes', () => {
    // El caso de los 1.238 métodos de pago que existen hoy: cero marcados.
    for (const id of [OFICINA, DEL_COBRADOR]) {
      expect(entraAlFajo('transferencia', id, new Set())).toBe(false)
    }
    expect(entraAlFajo('efectivo', null, new Set())).toBe(true)
  })

  it('⚠ una transferencia SIN cuenta se queda fuera, que es lo prudente', () => {
    /* 21 pagos de 3.009 en 30 días, todos anteriores al selector. Meterlos
       dentro le pediría al cobrador billetes que no se sabe si tuvo. */
    expect(entraAlFajo('transferencia', null, marcadas)).toBe(false)
  })

  it('no revienta si nadie pasa el Set', () => {
    expect(entraAlFajo('transferencia', OFICINA, undefined)).toBe(false)
    expect(entraAlFajo('efectivo', null, undefined)).toBe(true)
  })
})

describe('el reparto de un día, al peso', () => {
  const dia = [
    { montoPagado: 40_000, metodoPago: 'efectivo',      metodoPagoId: null },
    { montoPagado: 34_000, metodoPago: 'transferencia', metodoPagoId: OFICINA },
    { montoPagado: 45_000, metodoPago: 'transferencia', metodoPagoId: DEL_COBRADOR },
  ]

  it('las dos partes suman el total, siempre', () => {
    const r = repartirCobros(dia, marcadas)
    expect(r.enMano + r.enCuenta).toBe(r.total)
    expect(r.total).toBe(119_000)
  })

  it('con la cuenta del cobrador marcada, sus $45.000 sí los entrega', () => {
    expect(repartirCobros(dia, marcadas)).toMatchObject({ enMano: 85_000, enCuenta: 34_000 })
  })

  it('sin marcar nada, solo los billetes', () => {
    expect(repartirCobros(dia, new Set())).toMatchObject({ enMano: 40_000, enCuenta: 79_000 })
  })

  it('⚠ el caso real de la RUTA #9, que es de donde salió todo esto', () => {
    /* $5.000 + $34.000 + $40.000 por Nequi de la OFICINA y $40.000 en efectivo.
       Cobró $119.000 y en billetes llevaba $40.000. */
    const ruta9 = [
      { montoPagado:  5_000, metodoPago: 'transferencia', metodoPagoId: OFICINA },
      { montoPagado: 34_000, metodoPago: 'transferencia', metodoPagoId: OFICINA },
      { montoPagado: 40_000, metodoPago: 'efectivo',      metodoPagoId: null },
      { montoPagado: 40_000, metodoPago: 'transferencia', metodoPagoId: OFICINA },
    ]
    expect(repartirCobros(ruta9, marcadas)).toEqual({ total: 119_000, enMano: 40_000, enCuenta: 79_000 })
  })

  it('un día sin nada da tres ceros, no NaN', () => {
    expect(repartirCobros([], marcadas)).toEqual({ total: 0, enMano: 0, enCuenta: 0 })
  })
})

describe('las cuentas marcadas salen de la base', () => {
  const fakePrisma = (filas) => ({ metodoPago: { findMany: async () => filas } })

  it('devuelve un Set con los ids', async () => {
    const s = await cuentasDelCobrador(fakePrisma([{ id: 'a' }, { id: 'b' }]), 'org')
    expect(s.has('a')).toBe(true)
    expect(s.has('c')).toBe(false)
  })

  it('sin organización no consulta y devuelve vacío', async () => {
    const s = await cuentasDelCobrador({ metodoPago: { findMany: () => { throw new Error('no debió consultar') } } }, null)
    expect(s.size).toBe(0)
  })
})

describe('⚠ los dos endpoints usan la MISMA función', () => {
  /* El fallo de origen fue justo este: `recogidaEfectivo` se separó en la caja
     del administrador y la del cobrador se quedó con el criterio viejo, así que
     una decía $66.000 y la otra $119.000 el mismo día. */
  const general  = leer('app/api/caja/route.js')
  const cobrador = leer('app/api/caja/cobrador/[id]/route.js')

  it('ninguno decide por su cuenta con un `=== transferencia`', () => {
    for (const [nombre, src] of [['general', general], ['cobrador', cobrador]]) {
      expect(src, `${nombre} volvió a decidir a mano`)
        .not.toMatch(/metodoPago === 'transferencia'\) (b\.cobradoDigital|recogidaDigital)/)
    }
  })

  it('los dos importan `entraAlFajo`', () => {
    for (const [nombre, src] of [['general', general], ['cobrador', cobrador]]) {
      expect(src, `${nombre} no importa la función`).toMatch(/from '@\/lib\/dinero\/cuentas'/)
    }
  })

  it('⚠ el agrupado trae la CUENTA, no solo el medio', () => {
    /* Un `groupBy(['metodoPago'])` a secas no puede distinguir dos
       transferencias que van a cuentas distintas. */
    expect(general).toMatch(/by: \['metodoPago', 'metodoPagoId'\]/)
  })

  it('⚠ el select de cobros PIDE `metodoPagoId`', () => {
    /* Un campo que existe y no se pide llega como `undefined` sin que nada
       reviente: toda transferencia caería fuera del fajo y la marca no haría
       nada, en silencio. Ya me costó un rato una vez. */
    expect(cobrador).toMatch(/metodoPagoId: true,\n\s*prestamo: \{/)
  })

  it('el desembolso usa el mismo criterio que el cobro', () => {
    // Si el préstamo salió de la cuenta del cobrador, esa plata sí era suya.
    expect(general).toMatch(/entraAlFajo\(d\.metodoPago, d\.metodoPagoId, cuentasCobrador\)/)
    expect(cobrador).toMatch(/!entraAlFajo\(d\.metodoPago, d\.metodoPagoId, cuentasCobrador\)/)
  })
})

describe('se puede marcar desde la pantalla', () => {
  const admin = leer('components/pagos/MetodoPagoAdmin.jsx')
  const api   = leer('app/api/metodos-pago/[id]/route.js')
  const lista = leer('app/api/metodos-pago/route.js')

  it('el interruptor es el canónico del sistema, no uno propio', () => {
    // DESIGN.md: `Toggle` es el ÚNICO switch permitido.
    expect(admin).toMatch(/import \{ Toggle \} from '@\/components\/ui\/Toggle'/)
    expect(admin).toMatch(/checked=\{!!m\.esDelCobrador\}/)
  })

  it('el API lo guarda y lo devuelve', () => {
    expect(api).toMatch(/data\.esDelCobrador = Boolean\(body\.esDelCobrador\)/)
    expect(lista).toMatch(/esDelCobrador: true/)
  })

  it('⚠ el defecto se queda como estaba', () => {
    /* Marcar de más es ruidoso y se corrige en un día; marcar de menos esconde
       un faltante para siempre. El esquema arranca en `false`. */
    expect(leer('prisma/schema.prisma')).toMatch(/esDelCobrador\s+Boolean\s+@default\(false\)/)
  })
})
