// «Antes debía» — la resta escrita en el comprobante (13 sep 2026).
//
// El papel decía cuánto se pagó y cuánto queda, nunca cuánto se debía. El
// cliente ve «$50.000» y «$430.000» y tiene que fiarse de que antes eran
// $480.000. Con la línea nueva la cuenta se lee sola.
//
// Aquí se anclan las dos reglas que, rotas, ponen una cifra FALSA en un papel
// que el cliente se guarda:
//   1. la cifra la mide el servidor; no se deriva sumando el pago al saldo;
//   2. es de ESE pago, no del último que pasó por la pantalla.
//
// ⚠ Este recibo ya se arregló una vez por un lado dejando el otro roto (el
// mismo cliente lo reportó dos días seguidos), así que las CUATRO superficies
// —pantalla de éxito, térmico, imagen y WhatsApp— se comprueban una a una.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { saldoAntesDeEstePago } from '@/lib/recibo-derivados'
import { generarTextoPlantilla } from '@/lib/whatsapp-plantillas'
import { CAMPOS_PREDEFINIDOS, getDefaultCampos } from '@/lib/campos-recibo'

const leer = (f) => readFileSync(path.join(process.cwd(), f), 'utf8')
/* Sin comentarios: este repo escribe las reglas literalmente junto al código y
   una prueba que las busque en prosa pasa aunque el código no las cumpla. */
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const IMPRIMIR  = sinComentarios(leer('components/ui/BotonImprimirRecibo.jsx'))
const COMPARTIR = sinComentarios(leer('components/ui/BotonCompartirRecibo.jsx'))
const PANTALLA  = sinComentarios(leer('components/pantallas/Recibo.jsx'))
const WA        = sinComentarios(leer('lib/whatsapp-plantillas.js'))
const RUTA      = sinComentarios(leer('app/(dashboard)/rutas/[id]/page.jsx'))
const HOJA      = sinComentarios(leer('components/prestamos/RegistrarPago.jsx'))
const API       = sinComentarios(leer('app/api/prestamos/[id]/pagos/route.js'))

const PAGO = { id: 'pg-nuevo', montoPagado: 50000, fechaPago: '2026-09-13T15:00:00.000Z' }
const PRESTAMO = {
  id: 'p1', estado: 'activo', frecuencia: 'mensual', modoInteres: 'lineal',
  montoPrestado: 400000, totalAPagar: 480000, totalPagado: 50000,
  saldoPendiente: 430000, cuotaDiaria: 50000, porcentajePagado: 10,
  saldoAntesDelPago: 480000, saldoAntesDelPagoId: 'pg-nuevo',
}

describe('la cifra y de quién es', () => {
  it('sale con el pago que la produjo', () => {
    expect(saldoAntesDeEstePago(PRESTAMO, PAGO)).toBe(480000)
  })

  it('NO sale con un pago viejo de la lista', () => {
    // El préstamo se queda en el estado de la ficha con el saldo previo del
    // ÚLTIMO cobro. Al desplegar un cobro de hace tres semanas y mandar su
    // recibo, el papel decía «Antes debía» con la cifra del cobro de hace un
    // minuto: un número real, de otro día, en el papel de este.
    expect(saldoAntesDeEstePago(PRESTAMO, { id: 'pg-viejo', montoPagado: 50000 })).toBeNull()
  })

  it('NO sale sin pago al que atarla — el historial completo', () => {
    expect(saldoAntesDeEstePago(PRESTAMO, null)).toBeNull()
  })

  it('NO sale cuando el servidor no la mandó', () => {
    const sinCifra = { ...PRESTAMO, saldoAntesDelPago: undefined, saldoAntesDelPagoId: undefined }
    expect(saldoAntesDeEstePago(sinCifra, PAGO)).toBeNull()
    expect(saldoAntesDeEstePago({ ...PRESTAMO, saldoAntesDelPago: null }, PAGO)).toBeNull()
  })

  it('sin señal sale igual: los dos ids son nulos y esa pareja solo existe en el pago recién encolado', () => {
    const offline = { ...PRESTAMO, saldoAntesDelPago: 480000, saldoAntesDelPagoId: undefined }
    expect(saldoAntesDeEstePago(offline, { montoPagado: 50000, offline: true })).toBe(480000)
  })

  it('cero es una cifra, no un hueco: quien quedó en cero también tenía un antes', () => {
    const saldado = { ...PRESTAMO, saldoAntesDelPago: 0 }
    expect(saldoAntesDeEstePago(saldado, PAGO)).toBe(0)
  })
})

describe('no se deriva: la resta no siempre cuadra', () => {
  it('en un abono a capital el saldo baja MÁS de lo pagado, y la cifra sigue siendo la del servidor', () => {
    // $50.000 a capital que ahorran $18.000 de interés: el saldo cae $68.000.
    // Sumar el pago al saldo nuevo daría $480.000 cuando el antes era $498.000.
    const capital = { ...PRESTAMO, saldoPendiente: 430000, saldoAntesDelPago: 498000 }
    expect(saldoAntesDeEstePago(capital, PAGO)).toBe(498000)
    expect(saldoAntesDeEstePago(capital, PAGO)).not.toBe(430000 + PAGO.montoPagado)
  })

  it('ninguna superficie la calcula a mano', () => {
    // La forma de equivocarse es escribir `saldo + montoPagado` en cualquiera de
    // las cuatro. Si alguna lo hace, el abono a capital y el recargo mienten.
    for (const [nombre, src] of Object.entries({ IMPRIMIR, COMPARTIR, PANTALLA, WA })) {
      expect(src, `${nombre} deriva la cifra`).not.toMatch(/saldo\w*\s*\+\s*\w*[mM]onto/)
    }
  })
})

describe('el mensaje de WhatsApp', () => {
  const texto = (prestamo, pago, extra = {}) => generarTextoPlantilla('pago_confirmacion', {
    cliente: { nombre: 'Ana' }, prestamo, pago, orgNombre: 'Test', ...extra,
  })

  it('enseña la resta entera y en orden', () => {
    const t = texto(PRESTAMO, PAGO)
    expect(t).toContain('Antes debías: $480.000')
    expect(t).toContain('Saldo pendiente: $430.000')
    // De arriba abajo: antes debías → saldo pendiente. Al revés no es una resta.
    expect(t.indexOf('Antes debías')).toBeLessThan(t.indexOf('Saldo pendiente'))
  })

  it('con un pago ajeno no la escribe', () => {
    expect(texto(PRESTAMO, { id: 'pg-viejo', montoPagado: 50000 })).not.toContain('Antes debías')
  })

  it('sin cifra no deja un guion en el mensaje', () => {
    const t = texto({ ...PRESTAMO, saldoAntesDelPago: null }, PAGO)
    expect(t).not.toContain('Antes debías')
    expect(t).toContain('Saldo pendiente')
  })

  it('si el dueño esconde el saldo, tampoco lo dice por esta puerta', () => {
    const t = texto(PRESTAMO, PAGO, {
      ocultarSaldo: true,
      camposRecibo: [{ tipo: 'dato', campo: 'saldoAntes', nombre: 'Antes debía' }],
    })
    expect(t).not.toContain('480.000')
  })

  it('no lo repite dos veces cuando el dueño lo puso además como campo suyo', () => {
    const t = texto(PRESTAMO, PAGO, {
      camposRecibo: [{ tipo: 'dato', campo: 'saldoAntes', nombre: 'Antes debía' }],
    })
    expect(t.match(/480\.000/g) ?? []).toHaveLength(1)
  })
})

describe('el campo del recibo', () => {
  it('viene encendido y justo encima del saldo', () => {
    const orden = getDefaultCampos().map(c => c.campo)
    expect(orden).toContain('saldoAntes')
    expect(orden.indexOf('saldoAntes')).toBe(orden.indexOf('saldoPendiente') - 1)
    expect(CAMPOS_PREDEFINIDOS.find(c => c.campo === 'saldoAntes').nombre).toBe('Antes debía')
  })
})

describe('las cuatro superficies, una a una', () => {
  it('el térmico resuelve el campo con la función común y atado al pago', () => {
    expect(IMPRIMIR).toMatch(/from '@\/lib\/recibo-derivados'/)
    expect(IMPRIMIR).toMatch(/saldoAntesDeEstePago\(prestamo, pago\)/)
    // La firma tiene que llevar el pago: sin él no hay a qué atar la cifra.
    expect(IMPRIMIR).toMatch(/export function resolverCampo\(campo, cliente, prestamo, pago\)/)
  })

  it('el térmico omite la fila en vez de imprimir «Antes debía: -»', () => {
    // Es el único campo que puede no salir. Un guion aquí no dice nada y sale en
    // un papel que el cliente se guarda. Hay que comprobar las DOS mitades: que
    // la rama devuelve `null` (y no cae al «-» de los demás campos) y que quien
    // pinta tira esa fila.
    const rama = IMPRIMIR.match(/if \(campo === 'saldoAntes'\)[\s\S]*?\n  \}/)
    expect(rama, 'la rama de saldoAntes desapareció').not.toBeNull()
    expect(rama[0]).toMatch(/return antes == null \? null/)
    expect(rama[0]).not.toMatch(/'-'/)
    expect(IMPRIMIR).toMatch(/if \(val == null\) return ''/)
    expect(IMPRIMIR).toMatch(/\.filter\(Boolean\)/)
  })

  it('el historial completo no la lleva: no hay un pago al que atarla', () => {
    const hist = IMPRIMIR.match(/function generarHTMLHistorialCompleto\([^)]*\)/)
    expect(hist).not.toBeNull()
    expect(hist[0]).not.toMatch(/\bpago\b/)
  })

  it('el mensaje resuelve el campo del dueño con la misma regla, sin guion', () => {
    const rama = WA.match(/if \(campo === 'saldoAntes'\)[\s\S]*?\n  \}/)
    expect(rama, 'la rama de saldoAntes desapareció').not.toBeNull()
    expect(rama[0]).toMatch(/saldoAntesDeEstePago\(prestamo, pago\)/)
    expect(rama[0]).toMatch(/return antes == null \? null/)
  })

  it('la imagen pasa el pago al resolvedor y filtra los nulos', () => {
    expect(COMPARTIR).toMatch(/resolverCampo\(c\.campo, cliente, prestamo, pago\)/)
    expect(COMPARTIR).toMatch(/\.filter\(\(\[, v\]\) => v != null/)
  })

  it('la pantalla de éxito pinta la fila encima del saldo', () => {
    const antes = PANTALLA.indexOf('etiqueta="Antes debía"')
    const saldo = PANTALLA.indexOf('etiqueta="Saldo pendiente"')
    expect(antes).toBeGreaterThan(-1)
    expect(saldo).toBeGreaterThan(-1)
    expect(antes).toBeLessThan(saldo)
    // Y solo si hay cifra: `{saldoAntes && ...}`.
    expect(PANTALLA).toMatch(/\{saldoAntes && <Fila etiqueta="Antes debía"/)
  })

  it('las dos pantallas que abren el recibo le pasan la cifra', () => {
    expect(RUTA).toMatch(/saldoAntes: data\?\.saldoAntesDelPago/)
    expect(RUTA).toMatch(/saldoAntes=\{reciboCobro\.saldoAntes/)
    expect(HOJA).toMatch(/saldoAntes=\{saldoAntesDeEstePago\(prestamoWA, pagoGuardado\)/)
  })
})

describe('el servidor, que es quien la mide', () => {
  it('la toma con el préstamo bloqueado y ANTES de escribir el pago', () => {
    // `saldoLocked` es post-devengo y pre-pago: el interés del período ya está
    // asentado —el cliente viene a pagarlo, su deuda ya lo incluía— y es el
    // mismo número con el que se recorta el monto.
    expect(API).toMatch(/saldoAntesDelPago = saldoLocked/)
    const iSaldo = API.indexOf('saldoAntesDelPago = saldoLocked')
    const iPago  = API.indexOf('saldoAntesDelPagoId = filaPago.id')
    expect(iSaldo).toBeGreaterThan(-1)
    expect(iPago).toBeGreaterThan(iSaldo)
  })

  it('devuelve la cifra Y de qué pago es', () => {
    expect(API).toMatch(/\n\s*saldoAntesDelPago,/)
    expect(API).toMatch(/\n\s*saldoAntesDelPagoId,/)
  })

  it('la hoja ata el recibo al id que dijo el servidor, no al primero de la lista', () => {
    // `pagos[0]` va por `fechaPago desc` y dos cobros del mismo segundo pueden
    // salir al revés; equivocar el id borra la fila del recibo.
    expect(HOJA).toMatch(/const pagoId = data\.saldoAntesDelPagoId \?\? data\.pagos\?\.\[0\]\?\.id/)
  })

  it('sin señal, el «antes debía» es el mismo saldo del que se restó el pago', () => {
    expect(HOJA).toMatch(/saldoAntesDelPago: prestamo\?\.saldoPendiente \?\? null/)
    expect(HOJA).toMatch(/const saldoNuevo = Math\.max\(0, \(prestamo\?\.saldoPendiente \|\| 0\) - m\)/)
  })
})
