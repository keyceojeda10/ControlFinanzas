import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import PDFDocument from 'pdfkit'
import { paginasDePdf, MENSAJES_PDF, MAX_PAGINAS_PDF, MAX_BYTES_PDF } from '@/lib/importar/pdf-texto'
import { leerPlanillaCrossbox } from '@/lib/importar/planilla-crossbox'

/** Un PDF de verdad, hecho con pdfkit: una página por texto. */
function pdfDe(textos) {
  return new Promise((ok) => {
    const doc = new PDFDocument()
    const partes = []
    doc.on('data', (c) => partes.push(c))
    doc.on('end', () => ok(Buffer.concat(partes)))
    textos.forEach((t, i) => { if (i) doc.addPage(); doc.text(t) })
    doc.end()
  })
}

/** Un PDF de verdad con cada pieza en su posición absoluta (x, y), para armar
    filas de tabla que `leerPlanillaCrossbox` pueda leer. Página ancha para que
    pdfkit no fusione piezas vecinas en un solo item de texto. */
function pdfDeFilas(filas) {
  return new Promise((ok) => {
    const doc = new PDFDocument({ size: [1600, 800], margin: 0 })
    const partes = []
    doc.on('data', (c) => partes.push(c))
    doc.on('end', () => ok(Buffer.concat(partes)))
    for (const fila of filas) {
      for (const pieza of fila.piezas) doc.text(pieza.str, pieza.x, fila.y, { lineBreak: false })
    }
    doc.end()
  })
}

/** Una mini «Planilla Recaudador»: encabezado, «Totales» y 2 filas de datos,
    en el orden de columnas del lector (n, fecha, u.abono, nombre…, teléfono,
    crédito, saldo, cuota, atrasadas, vencidos). `totalSaldo` deja armar una
    versión que no cuadra con la suma de las filas. */
function filasPlanillaMini({ totalSaldo = '$480,000.00', conFecha = true } = {}) {
  return [
    { y: 50, piezas: [{ str: 'Planilla Recaudador', x: 30 }] },
    // La línea de metadato «Fecha: 24 Sep 26» (distinta de la columna «Fecha»
    // de la tabla, más abajo). `conFecha: false` simula un PDF donde esa línea
    // no se pudo leer: ver M13, «un PDF sin Fecha: legible».
    ...(conFecha ? [{ y: 75, piezas: [{ str: 'Fecha:', x: 900 }, { str: '24 Sep 26', x: 950 }] }] : []),
    { y: 100, piezas: [
      { str: 'Fecha', x: 30 }, { str: 'U. Abono', x: 100 }, { str: 'Cliente', x: 200 },
      { str: 'Teléfono', x: 350 }, { str: 'Crédito', x: 500 }, { str: 'Saldo', x: 600 },
      { str: 'Cuota', x: 700 }, { str: 'Atrasadas', x: 800 }, { str: 'Vencidos', x: 950 },
    ] },
    { y: 150, piezas: [
      { str: 'Totales', x: 30 }, { str: '$500,000.00', x: 500 }, { str: totalSaldo, x: 600 }, { str: '$35,000.00', x: 700 },
    ] },
    { y: 200, piezas: [
      { str: '1', x: 30 }, { str: '01 Sep 26', x: 100 }, { str: 'Nunca', x: 200 },
      { str: 'Juan', x: 300 }, { str: 'Perez', x: 360 }, { str: '3001234567', x: 420 },
      { str: '$300,000.00', x: 500 }, { str: '$360,000.00', x: 600 }, { str: '$15,000.00', x: 700 },
      { str: '0', x: 800 }, { str: '0', x: 950 },
    ] },
    { y: 250, piezas: [
      { str: '2', x: 30 }, { str: '02 Sep 26', x: 100 }, { str: '10 Sep 26', x: 200 },
      { str: 'Ana', x: 300 }, { str: 'Gomez', x: 360 }, { str: '3009876543', x: 420 },
      { str: '$200,000.00', x: 500 }, { str: '$120,000.00', x: 600 }, { str: '$20,000.00', x: 700 },
      { str: '1', x: 800 }, { str: '0', x: 950 },
    ] },
  ]
}

/* La sesión se mockea entera: cada prueba decide quién entra (dueño, cobrador
   o nadie). `@/lib/auth` va mockeado también para no cargar next-auth de
   verdad (prisma, bcrypt…) solo para leer un objeto que ni se usa aquí. */
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { getServerSession } = await import('next-auth')
const { POST } = await import('@/app/api/carga-masiva/leer-pdf/route')

const OWNER = { user: { organizationId: 'org1', rol: 'owner' } }
const COBRADOR = { user: { organizationId: 'org1', rol: 'cobrador' } }

function requestConArchivo(archivo) {
  const form = new FormData()
  if (archivo !== undefined) form.set('archivo', archivo)
  return new Request('http://x/api/carga-masiva/leer-pdf', { method: 'POST', body: form })
}

describe('sacar el texto del PDF', () => {
  it('devuelve las piezas de cada página con su posición', async () => {
    const r = await paginasDePdf(await pdfDe(['Planilla Recaudador', 'Segunda página']))
    expect(r.paginas).toHaveLength(2)
    expect(r.paginas[0].some((p) => p.str.includes('Planilla Recaudador') && typeof p.x === 'number' && typeof p.y === 'number')).toBe(true)
  })
  it('se niega pasado el tope de páginas', async () => {
    const r = await paginasDePdf(await pdfDe(['a', 'b', 'c']), { maxPaginas: 2 })
    expect(r).toEqual({ error: 'demasiadas-paginas', numPages: 3 })
  })
  it('un PDF que no es la planilla: el lector da null (la ruta contesta «no es una planilla que sepamos leer»)', async () => {
    const r = await paginasDePdf(await pdfDe(['Factura de venta N.º 123']))
    expect(leerPlanillaCrossbox(r.paginas)).toBeNull()
  })
})

describe('los mensajes y los topes', () => {
  it('son los del diseño', () => {
    expect(MAX_PAGINAS_PDF).toBe(30)
    expect(MAX_BYTES_PDF).toBe(5 * 1024 * 1024)
    expect(MENSAJES_PDF.desconocido).toBe('Este PDF no es una planilla que sepamos leer. Escríbenos por WhatsApp y te ayudamos.')
    expect(MENSAJES_PDF.incompleto).toBe('No pudimos leer la planilla completa: los totales no cuadran con las filas. Escríbenos por WhatsApp y te ayudamos.')
    expect(MENSAJES_PDF.paginas(40)).toBe('Tu PDF tiene 40 páginas; el máximo es 30. Escríbenos por WhatsApp y te ayudamos.')
  })
})

describe('la ruta', () => {
  const src = readFileSync(resolve(process.cwd(), 'app/api/carga-masiva/leer-pdf/route.js'), 'utf8')
  it('solo el dueño, con tope de tamaño, y solo PDF de verdad', () => {
    expect(src).toMatch(/session\.user\.rol !== 'owner'/)
    expect(src).toMatch(/archivo\.size > MAX_BYTES_PDF/)
    expect(src).toMatch(/subarray\(0, 5\)\.toString\('latin1'\) !== '%PDF-'/)
  })
  it('no carga nada si no es la planilla o si no cuadra con sus totales', () => {
    expect(src).toMatch(/if \(!planilla \|\| planilla\.filas\.length === 0\)/)
    expect(src).toMatch(/if \(!planilla\.cuadraConTotales\)/)
  })
  it('solo exporta lo que Next permite en una ruta', () => {
    const exportados = [...src.matchAll(/^export (?:async )?(?:function|const) (\w+)/gm)].map((m) => m[1])
    expect(exportados.sort()).toEqual(['POST', 'runtime'])
  })
})

// Lo de arriba solo mira el texto de la ruta: un chequeo reordenado o un
// código de estado cambiado igual pasaría. Aquí se llama a POST de verdad.
describe('la ruta: llamada de verdad', () => {
  it('sin sesión: 401', async () => {
    getServerSession.mockResolvedValue(null)
    const res = await POST(requestConArchivo(undefined))
    expect(res.status).toBe(401)
  })

  it('cobrador: 403', async () => {
    getServerSession.mockResolvedValue(COBRADOR)
    const res = await POST(requestConArchivo(undefined))
    expect(res.status).toBe(403)
  })

  it('sin el campo archivo: 400 con el mensaje de «falta»', async () => {
    getServerSession.mockResolvedValue(OWNER)
    const res = await POST(requestConArchivo(undefined))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe(MENSAJES_PDF.falta)
  })

  it('un archivo que no es PDF: 400 con el mensaje de «no es PDF»', async () => {
    getServerSession.mockResolvedValue(OWNER)
    const archivo = new File([Buffer.from('hola')], 'x.pdf', { type: 'application/pdf' })
    const res = await POST(requestConArchivo(archivo))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe(MENSAJES_PDF.noEsPdf)
  })

  it('pasa la firma %PDF- pero el contenido está roto: 422 «desconocido»', async () => {
    getServerSession.mockResolvedValue(OWNER)
    const archivo = new File([Buffer.from('%PDF-1.4 basura')], 'x.pdf', { type: 'application/pdf' })
    const res = await POST(requestConArchivo(archivo))
    expect(res.status).toBe(422)
    expect((await res.json()).error).toBe(MENSAJES_PDF.desconocido)
  })

  it('un PDF real que no es la planilla: 422 «desconocido»', async () => {
    getServerSession.mockResolvedValue(OWNER)
    const buffer = await pdfDe(['Factura de venta N.º 123'])
    const archivo = new File([buffer], 'factura.pdf', { type: 'application/pdf' })
    const res = await POST(requestConArchivo(archivo))
    expect(res.status).toBe(422)
    expect((await res.json()).error).toBe(MENSAJES_PDF.desconocido)
  })

  it('la mini planilla: 200 con las 2 filas y cuadraConTotales', async () => {
    getServerSession.mockResolvedValue(OWNER)
    const buffer = await pdfDeFilas(filasPlanillaMini())
    const archivo = new File([buffer], 'planilla.pdf', { type: 'application/pdf' })
    const res = await POST(requestConArchivo(archivo))
    expect(res.status).toBe(200)
    const { planilla } = await res.json()
    expect(planilla.filas).toHaveLength(2)
    expect(planilla.cuadraConTotales).toBe(true)
  })

  it('la mini planilla con Totales que no cuadran: 422 «incompleto»', async () => {
    getServerSession.mockResolvedValue(OWNER)
    const buffer = await pdfDeFilas(filasPlanillaMini({ totalSaldo: '$999,000.00' }))
    const archivo = new File([buffer], 'planilla.pdf', { type: 'application/pdf' })
    const res = await POST(requestConArchivo(archivo))
    expect(res.status).toBe(422)
    expect((await res.json()).error).toBe(MENSAJES_PDF.incompleto)
  })

  // M13. Un PDF donde la línea «Fecha:» no se pudo leer (una plantilla rara,
  // un escaneo que perdió esa esquina…): sin fecha de corte no hay con qué
  // deducir tasa ni cuotas de ninguna fila, así que no sirve seguir. Antes
  // esto pasaba las dos validaciones (filas y totales) y devolvía 200 con
  // `fechaCorte: null`, y cada fila fallaba después, ya en la revisión.
  it('la mini planilla sin «Fecha:» legible: 422 «desconocido»', async () => {
    getServerSession.mockResolvedValue(OWNER)
    const buffer = await pdfDeFilas(filasPlanillaMini({ conFecha: false }))
    const archivo = new File([buffer], 'planilla.pdf', { type: 'application/pdf' })
    const res = await POST(requestConArchivo(archivo))
    expect(res.status).toBe(422)
    expect((await res.json()).error).toBe(MENSAJES_PDF.desconocido)
  })
})
