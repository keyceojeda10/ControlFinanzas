// «A qué se aplicó este pago» — el reparto interés/capital en el recibo
// (14 sep 2026, con el diseño H8 «verde y oro» que eligió el dueño).
//
// El papel decía cuánto entró y cuánto queda, nunca cuánto de lo que entró fue
// interés y cuánto bajó la deuda. De ahí sale la llamada de siempre: «abonué
// $250.000 y el saldo casi no se movió».
//
// Las reglas que se anclan aquí son las mismas que las de «Antes debía», y por
// el mismo motivo: una cifra falsa en un papel que el cliente se guarda.
//   1. la mide el SERVIDOR con `interesPagoAPago`; no se deriva en la pantalla;
//   2. es de ESE pago, atada a su id;
//   3. las DOS superficies que la enseñan —la imagen y el térmico— la sacan de
//      la misma función, o una dirá una cosa y la otra otra.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { repartoDeUnPago } from '@/lib/dinero/interes-cobrado'
import { repartoDeEstePago, notaDelReparto, tituloDelTipoDePago, TITULO_DE_TIPO } from '@/lib/recibo-derivados'

const leer = (f) => readFileSync(path.join(process.cwd(), f), 'utf8')
/* Sin comentarios: este repo escribe las reglas literalmente junto al código y
   una prueba que las busque en prosa pasa aunque el código no las cumpla. */
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const IMPRIMIR  = sinComentarios(leer('components/ui/BotonImprimirRecibo.jsx'))
const COMPARTIR = sinComentarios(leer('components/ui/BotonCompartirRecibo.jsx'))
const API       = sinComentarios(leer('app/api/prestamos/[id]/pagos/route.js'))
const HOJA      = sinComentarios(leer('components/prestamos/RegistrarPago.jsx'))

// Un préstamo lineal: $400.000 prestados, $480.000 a pagar. La quinta parte de
// cada peso es interés.
const PRESTAMO = {
  id: 'p1', modoInteres: 'lineal', montoPrestado: 400000, totalAPagar: 480000,
  frecuencia: 'mensual',
}
const PAGOS = [
  { id: 'pg-1', montoPagado: 50000, tipo: 'completo', fechaPago: '2026-09-01T15:00:00.000Z' },
  { id: 'pg-2', montoPagado: 100000, tipo: 'capital', fechaPago: '2026-09-08T15:00:00.000Z' },
  { id: 'pg-3', montoPagado: 60000, tipo: 'completo', fechaPago: '2026-09-14T15:00:00.000Z' },
]

describe('repartoDeUnPago — lo mide el servidor', () => {
  it('parte un pago corriente en interés y capital, y los dos suman lo pagado', () => {
    const r = repartoDeUnPago({ prestamo: PRESTAMO, pagos: PAGOS, pagoId: 'pg-1' })
    expect(r).not.toBeNull()
    expect(r.interes + r.capital).toBe(50000)
    // 80.000 de interés sobre 480.000 a pagar = un sexto de cada peso.
    expect(r.interes).toBe(Math.round(50000 * (80000 / 480000)))
  })

  it('un abono a capital es capital entero: no lleva interés', () => {
    const r = repartoDeUnPago({ prestamo: PRESTAMO, pagos: PAGOS, pagoId: 'pg-2' })
    expect(r).toEqual({ interes: 0, capital: 100000 })
  })

  it('sin id del pago no hay reparto del que responder', () => {
    expect(repartoDeUnPago({ prestamo: PRESTAMO, pagos: PAGOS, pagoId: null })).toBeNull()
    expect(repartoDeUnPago({ prestamo: PRESTAMO, pagos: PAGOS, pagoId: 'no-existe' })).toBeNull()
  })

  it('un recargo y un descuento NO se parten: no son plata entregada', () => {
    const pagos = [{ id: 'r1', montoPagado: 20000, tipo: 'recargo', fechaPago: '2026-09-02T15:00:00.000Z' }]
    expect(repartoDeUnPago({ prestamo: PRESTAMO, pagos, pagoId: 'r1' })).toBeNull()
    const desc = [{ id: 'd1', montoPagado: 20000, tipo: 'descuento', fechaPago: '2026-09-02T15:00:00.000Z' }]
    expect(repartoDeUnPago({ prestamo: PRESTAMO, pagos: desc, pagoId: 'd1' })).toBeNull()
  })

  it('el reparto depende de POR DÓNDE iba el préstamo, no solo del monto', () => {
    /* El MISMO pago de $60.000, sobre la MISMA tabla, reparte distinto según lo
       que se pagó antes: en la primera cuota casi todo es interés y en la
       segunda casi todo es capital. Es la razón entera de que esto lo mida el
       servidor y no la pantalla. */
    const conTabla = { ...PRESTAMO, modoInteres: 'lineal', montoPrestado: 80000, totalAPagar: 120000 }
    const cuotas = [
      { numeroPeriodo: 1, cuotaTotal: 60000, interes: 30000 },
      { numeroPeriodo: 2, cuotaTotal: 60000, interes: 10000 },
    ]
    const elPago = { id: 'x', montoPagado: 60000, tipo: 'completo', fechaPago: '2026-09-14T15:00:00.000Z' }
    const primero = repartoDeUnPago({ prestamo: conTabla, cuotas, pagos: [elPago], pagoId: 'x' })
    const segundo = repartoDeUnPago({
      prestamo: conTabla, cuotas, pagoId: 'x',
      pagos: [{ id: 'w', montoPagado: 60000, tipo: 'completo', fechaPago: '2026-09-01T15:00:00.000Z' }, elPago],
    })
    expect(primero.interes).toBe(30000)
    expect(segundo.interes).toBe(10000)
  })
})

describe('repartoDeEstePago — la cifra es de ESE pago', () => {
  const conReparto = { ...PRESTAMO, repartoDelPago: { interes: 12000, capital: 28000 }, repartoDelPagoId: 'pg-1' }

  it('se pinta cuando el id coincide', () => {
    expect(repartoDeEstePago(conReparto, { id: 'pg-1' })).toEqual({ interes: 12000, capital: 28000 })
  })

  it('NO se pinta al desplegar otro pago de la lista', () => {
    expect(repartoDeEstePago(conReparto, { id: 'pg-9' })).toBeNull()
  })

  it('una reimpresión sin reparto no inventa nada', () => {
    expect(repartoDeEstePago(PRESTAMO, { id: 'pg-1' })).toBeNull()
  })

  it('un reparto en cero no pinta un bloque vacío', () => {
    expect(repartoDeEstePago({ ...conReparto, repartoDelPago: { interes: 0, capital: 0 } }, { id: 'pg-1' })).toBeNull()
  })
})

describe('las palabras viven en un solo sitio', () => {
  it('los siete tipos de pago tienen su título', () => {
    for (const t of ['completo', 'parcial', 'capital', 'intereses', 'recargo', 'descuento', 'liquidacion']) {
      expect(TITULO_DE_TIPO[t]).toBeTruthy()
    }
  })

  it('un tipo desconocido no se hace pasar por una cuota', () => {
    expect(tituloDelTipoDePago(undefined)).toBe('Pago recibido')
    expect(tituloDelTipoDePago(undefined)).not.toBe(TITULO_DE_TIPO.completo)
  })

  it('la nota se deriva de las cifras, no del tipo', () => {
    expect(notaDelReparto('completo', 0, 40000)).not.toContain('interés del período;')
    expect(notaDelReparto('completo', 12000, 28000)).toContain('interés')
  })

  it('las dos superficies importan título y nota del mismo módulo', () => {
    for (const src of [IMPRIMIR, COMPARTIR]) {
      expect(src).toMatch(/tituloDelTipoDePago/)
      expect(src).toMatch(/notaDelReparto/)
      expect(src).toMatch(/from '@\/lib\/recibo-derivados'/)
    }
    // Y ninguna se escribe su propia tabla de títulos.
    expect(COMPARTIR).not.toMatch(/const TITULO_DE_TIPO\s*=/)
    expect(IMPRIMIR).not.toMatch(/const TITULO_DE_TIPO\s*=/)
  })

  it('las dos superficies piden el reparto con la misma guarda', () => {
    for (const src of [IMPRIMIR, COMPARTIR]) {
      expect(src).toMatch(/repartoDeEstePago\(prestamo, pago\)/)
    }
  })

  it('ninguna superficie deriva el reparto restando saldos', () => {
    for (const src of [IMPRIMIR, COMPARTIR, HOJA]) {
      expect(src).not.toMatch(/saldo\w*\s*-\s*\w*[iI]nteres/)
    }
  })
})

describe('el servidor lo manda con el pago', () => {
  it('la respuesta del POST lleva el reparto y su id', () => {
    expect(API).toMatch(/repartoDelPago,/)
    expect(API).toMatch(/repartoDelPagoId:/)
    expect(API).toMatch(/repartoDeUnPago\(/)
  })

  it('los pagos se ordenan ASCENDENTE antes de repartir', () => {
    // El acumulado de `interesPagoAPago` avanza en el orden de la lista, y el
    // `include` del préstamo los trae por fecha DESCENDENTE.
    expect(API).toMatch(/new Date\(x\.fechaPago\) - new Date\(y\.fechaPago\)/)
  })

  it('el tipo del pago viaja hasta el recibo', () => {
    expect(HOJA).toMatch(/const pagoParaWA = \{ id: pagoId, montoPagado: m, tipo,/)
  })
})

describe('el estado del préstamo no se afirma sin dato', () => {
  it('`diasMora: null` no puede acabar en «AL DÍA» (Number(null) es 0)', () => {
    expect(COMPARTIR).toMatch(/prestamo\?\.diasMora == null/)
  })
})
