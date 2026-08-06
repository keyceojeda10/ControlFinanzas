import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = process.cwd()
const pagare = readFileSync(join(RAIZ, 'components/pantallas/Pagare.jsx'), 'utf8')
const schema = readFileSync(join(RAIZ, 'prisma/schema.prisma'), 'utf8')

/* ══════════════════════════════════════════════════════════════════════════
   EL PAGARÉ ES EL ÚNICO DOCUMENTO DEL PRODUCTO QUE PUEDE ACABAR DELANTE DE
   UN JUEZ. Su valor, dice la lámina, es «que el cliente no pueda decir que
   no lo firmó» — así que no puede afirmar nada que no pueda sostener.
   ══════════════════════════════════════════════════════════════════════════ */

describe('la promesa de verificación no se hace en falso', () => {
  it('el bloque del QR es condicional', () => {
    // La lámina promete «escanea para verificar este pagaré en línea · verificable
    // hasta 2031» y hoy no hay nada que verificar: ni código en el modelo, ni ruta
    // pública, ni QR generado en el servidor. Un pagaré cuyo valor es que no se
    // pueda negar la firma no puede además prometer una verificabilidad que no
    // tiene: esa frase es lo primero que se cae si alguien lo lleva a un juzgado.
    expect(pagare).toMatch(/\{verificacion\?\.url && \(/)
  })

  it('la frase de verificar vive dentro de ese bloque', () => {
    const i = pagare.indexOf('{verificacion?.url && (')
    const j = pagare.indexOf('Escanea para verificar')
    expect(i).toBeGreaterThan(-1)
    expect(j).toBeGreaterThan(i)
  })

  it('no se escribe un «Nº» que la interfaz se invente', () => {
    // Dos pagarés con el mismo número son peores que ninguno.
    expect(pagare).toMatch(/numero \? `Pagaré Nº \$\{numero\}` : 'Pagaré'/)
  })

  it('sigue documentado qué falta para poder cumplirla', () => {
    // Si alguien borra el PENDIENTE sin construir la verificación, la promesa
    // vuelve sin que nadie sepa qué hacía falta.
    expect(pagare).toMatch(/PENDIENTE-BACKEND/)
    expect(pagare).toMatch(/pagareNumero/)
    expect(pagare).toMatch(/pagareCodigo/)
  })

  it('y el modelo sigue sin tenerla — si esto falla, toca quitar el pendiente', () => {
    // Esta prueba está escrita para MORIR el día que la verificación exista: es el
    // recordatorio de que entonces hay que reactivar el bloque y borrar el aviso.
    const hayCampos = /pagareNumero|pagareCodigo/.test(schema)
    const hayRuta = existsSync(join(RAIZ, 'app/verificar'))
    expect(hayCampos || hayRuta).toBe(false)
  })
})

describe('el documento identifica a las dos partes', () => {
  it('las dos firmas llevan nombre', () => {
    // Una rúbrica con la palabra «prestamista» debajo no dice a quién se le debe,
    // que es la mitad del documento.
    expect(pagare).toMatch(/\[prestamista, 'prestamista'\]\.filter\(Boolean\)/)
    expect(pagare).toMatch(/firmaPrestamista, prestamista,/)
  })

  it('la declaración va en primera persona y con las cifras dentro', () => {
    /* Así se lee en voz alta y así vale delante de alguien.

       El «CC» ya no está escrito a fuego: es la abreviatura del país, porque un
       pagaré argentino que dice «con CC 12345678» nombra un documento que allí
       no existe. En un papel con consecuencia legal eso importa más que en una
       ficha. La redacción no cambia. */
    expect(pagare).toMatch(/Yo, <strong>\{cliente\}<\/strong>, con \{abreviaturaDocumento\(\)\} \{cedula\}/)
  })
})

describe('lo que va a firmar (T18-01)', () => {
  it('el recargo por mora se enseña ANTES de firmar', () => {
    // Es la única forma de poder cobrarlo después sin discusión. Va como fila de
    // condiciones, que las pone quien cablea, pero la pantalla tiene que aceptarlas.
    expect(pagare).toMatch(/condiciones = \[\]/)
    expect(pagare).toMatch(/ANTES DE FIRMAR/)
  })

  it('«guardar sin firma» existe pero queda de segunda', () => {
    // Si compitiera con el dorado se convertiría en el camino por defecto y el
    // pagaré dejaría de existir.
    expect(pagare).toMatch(/BotonTexto onClick=\{onSinFirma\}/)
    expect(pagare).toMatch(/BotonPrimario onClick=\{onFirmar\}/)
  })

  it('la casilla de «entendió» hay que tocarla a propósito', () => {
    expect(pagare).toMatch(/entendió las condiciones y está de acuerdo/)
  })
})

describe('las tres formas de sacar el documento pesan igual', () => {
  it('ninguna de las tres es un botón relleno', () => {
    // «Mandárselo» en verde relleno le daba peso de acción primaria y dejaba
    // «imprimir» como de segunda — y en un pagaré imprimir no es de segunda.
    // La acción de la pantalla ya es el botón dorado del pie.
    const i = pagare.indexOf('LOS TRES IGUALES')
    const bloque = pagare.slice(i, i + 2200)
    expect(bloque).toMatch(/background: 'var\(--cf-card\)', border: '1px solid var\(--cf-border\)'/)
    expect(bloque).not.toMatch(/background: 'var\(--cf-whatsapp\)'/)
  })

  it('el verde de WhatsApp queda solo en su icono', () => {
    const i = pagare.indexOf('LOS TRES IGUALES')
    const bloque = pagare.slice(i, i + 2200)
    expect(bloque).toMatch(/marca: 'var\(--cf-whatsapp\)'/)
  })
})
