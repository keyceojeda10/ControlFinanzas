import { describe, it, expect } from 'vitest'
import { limpiarDictado, sonido, puntuar, buscarPorVoz, plataHablada, resumenHablado, avisoHablado, palabrasParaDictado, alcanceDeVoz } from '@/lib/busqueda-voz'
import { transcribirAudio, recortarBytes } from '@/lib/transcribir'
import { vi } from 'vitest'

const CLIENTES = [
  { id: '1', nombre: 'Pepito Pérez' },
  { id: '2', nombre: 'Pepito Gómez Rodríguez' },
  { id: '3', nombre: 'Jeison Andrés Valencia' },
  { id: '4', nombre: 'Vivian Llanos' },
  { id: '5', nombre: 'María de la Cruz Henao' },
  { id: '6', nombre: 'José Quintero' },
  { id: '7', nombre: 'José Quintero Ríos' },
]

describe('lo que dijo, sin el relleno', () => {
  it('quita la frase de alrededor y la puntuación', () => {
    expect(limpiarDictado('Buscar el crédito de Pepito Pérez.')).toBe('pepito perez')
    expect(limpiarDictado('búscame a la señora María de la Cruz')).toBe('maria de la cruz')
    expect(limpiarDictado('Don José Quintero')).toBe('jose quintero')
    expect(limpiarDictado('buscar')).toBe('')
  })
  it('suena igual aunque se escriba distinto', () => {
    expect(sonido('Vivian')).toBe(sonido('Bibian'))
    expect(sonido('Llanos')).toBe(sonido('Yanos'))
    expect(sonido('Henao')).toBe(sonido('Enao'))
    expect(sonido('Quintero')).toBe(sonido('Kintero'))
  })
})

describe('encontrar al cliente', () => {
  it('la frase completa abre directo al único que encaja', () => {
    const r = buscarPorVoz('Buscar el crédito de Pepito Pérez', CLIENTES)
    expect(r.resultados[0].id).toBe('1')
    expect(r.unico).toBe(true)
  })
  it('perdona cómo lo escribió el dictado', () => {
    expect(buscarPorVoz('Yeison Valencia', CLIENTES).resultados[0].id).toBe('3')
    expect(buscarPorVoz('Bibian Yanos', CLIENTES).resultados[0].id).toBe('4')
    expect(buscarPorVoz('maria enao', CLIENTES).resultados[0].id).toBe('5')
  })
  it('solo el nombre: enseña a todos los que se llaman así, no abre ninguno', () => {
    const r = buscarPorVoz('Pepito', CLIENTES)
    expect(r.resultados.map((c) => c.id).sort()).toEqual(['1', '2'])
    expect(r.unico).toBe(false)
  })
  it('un apellido que no es el suyo no lo trae', () => {
    expect(puntuar('Pepito Gómez', 'Pepito Pérez')).toBe(0)
  })
  it('dos que encajan casi igual no se abren solos', () => {
    expect(buscarPorVoz('José Quintero', CLIENTES).unico).toBe(false)
  })
  it('nadie: lista vacía', () => {
    expect(buscarPorVoz('Ramón Zuluaga', CLIENTES)).toEqual({ resultados: [], unico: false })
  })
})

describe('lo que se lee en voz alta', () => {
  it('la plata dicha como se dice', () => {
    expect(plataHablada(250000)).toBe('250 mil')
    expect(plataHablada(1250000)).toBe('1 millón 250 mil')
    expect(plataHablada(2001500)).toBe('2 millones mil 500')
    expect(plataHablada(1000)).toBe('mil')
    expect(plataHablada(0)).toBe('cero')
  })
  it('suma SOLO los créditos activos, con el saldo que trae la ficha', () => {
    const prestamos = [
      { estado: 'activo', saldoPendiente: 200000, diasMora: 0 },
      { estado: 'activo', saldoPendiente: 50000, diasMora: 3 },
      { estado: 'completado', saldoPendiente: 0, diasMora: 0 },
    ]
    expect(resumenHablado({ nombre: 'Pepito Pérez', prestamos }))
      .toBe('Pepito Pérez. Tiene 2 créditos. Debe en total 250 mil. Lleva 3 días de atraso.')
    expect(resumenHablado({ nombre: 'Ana', prestamos: [{ estado: 'activo', saldoPendiente: 90000, diasMora: 0 }] }))
      .toBe('Ana. Debe 90 mil. Va al día.')
    expect(resumenHablado({ nombre: 'Ana', prestamos: [] })).toBe('Ana. No tiene créditos activos.')
  })
  it('cuando hay varios, los nombra', () => {
    expect(avisoHablado([{ nombre: 'A' }, { nombre: 'B' }])).toBe('Encontré 2: A, B. Toca el que es.')
    expect(avisoHablado([])).toMatch(/^No encontré a nadie/)
  })
})

describe('dónde está y qué no puede saltarse', () => {
  const leer = (f) => require('node:fs').readFileSync(f, 'utf8')
  it('el cobrador solo busca entre los de sus rutas', () => {
    expect(leer('app/api/buscar/voz/route.js')).toContain("where: alcanceDeVoz(session.user, new URL(request.url).searchParams.get('rutaId') || null),")
    const cob = { organizationId: 'o', rol: 'cobrador', rutaIds: ['r1', 'r2'] }
    expect(alcanceDeVoz(cob)).toEqual({ organizationId: 'o', estado: { notIn: ['eliminado'] }, rutaId: { in: ['r1', 'r2'] } })
    // Dentro de SU ruta, solo esa.
    expect(alcanceDeVoz(cob, 'r2').rutaId).toBe('r2')
    // Una ruta ajena no le abre nada: se queda con las suyas.
    expect(alcanceDeVoz(cob, 'r9').rutaId).toEqual({ in: ['r1', 'r2'] })
    // Un cobrador sin rutas no ve a nadie.
    expect(alcanceDeVoz({ organizationId: 'o', rol: 'cobrador' }).rutaId).toEqual({ in: [] })
  })
  it('el dueño busca en todo el negocio, o solo en la ruta donde está', () => {
    const yo = { organizationId: 'o', rol: 'owner' }
    expect(alcanceDeVoz(yo)).toEqual({ organizationId: 'o', estado: { notIn: ['eliminado'] } })
    expect(alcanceDeVoz(yo, 'r5')).toEqual({ organizationId: 'o', estado: { notIn: ['eliminado'] }, rutaId: 'r5' })
  })
  it('dentro de una ruta: busca entre los clientes de la ruta, y la pista lleva sus nombres', () => {
    const ruta = leer('app/(dashboard)/rutas/[id]/page.jsx')
    expect(ruta).toMatch(/<BuscarPorVoz\s+variante="icono"\s+clientes=\{ruta\.clientes\}\s+rutaId=\{ruta\.id\}/)
    // El encontrado sale aunque lo escondan «Solo hoy» o un filtro.
    expect(ruta).toContain('if (vozCliente && busquedaRuta === vozCliente.nombre) {')
    const v = leer('components/cf/BuscarPorVoz.jsx')
    expect(v).toContain("if (rutaId) fd.append('rutaId', rutaId)")
    expect(v).toContain('buscarPorVoz(limpio, clientes)')
    // Lo que dice el cobrador en la calle, contra la lista de la ruta.
    const lista = [{ id: '1', nombre: 'Fabián Quintero' }, { id: '2', nombre: 'Luz Marina Peláez' }, { id: '3', nombre: 'Yaneth Cardona' }]
    const r = buscarPorVoz(limpiarDictado('busca a Fabian Quintero'), lista)
    expect(r.unico).toBe(true)
    expect(r.resultados[0].id).toBe('1')
  })
  it('lo que se lee sale de la ficha, no de un cálculo propio', () => {
    const v = leer('components/cf/BuscarPorVoz.jsx')
    expect(v).toMatch(/fetch\(`\/api\/clientes\/\$\{c\.id\}`\)/)
    expect(v).toMatch(/hablar\(resumenHablado\(\{ nombre: c\.nombre, prestamos: d\.prestamos \}\)\)/)
  })
  it('la lupa lleva el micrófono y la pastilla grande', () => {
    const g = leer('components/layout/GlobalSearch.jsx')
    expect(g).toMatch(/voz=\{<BuscarPorVoz variante="icono"/)
    expect(g).toMatch(/vozGrande=\{<BuscarPorVoz variante="boton"/)
  })
})

describe('lo que pasó con voz real (14 oct 2026)', () => {
  it('«Jason Valencia» (así lo escribió Groq) encuentra a Jeison Andrés Valencia', () => {
    const r = buscarPorVoz('Jason Valencia', CLIENTES)
    expect(r.resultados[0].id).toBe('3')
    expect(r.unico).toBe(true)
  })
  it('los nombres que el transcriptor escribe a la inglesa', () => {
    const lista = [{ id: 'm', nombre: 'Maicol Estiven Ruiz' }, { id: 'y', nombre: 'Yeferson Brayan Mosquera' }, { id: 'l', nombre: 'Luz Dary Ospina' }]
    expect(buscarPorVoz('Buscar a Michael Ruiz', lista).resultados[0]?.id).toBe('m')
    expect(buscarPorVoz('Jefferson Mosquera', lista).resultados[0]?.id).toBe('y')
    expect(buscarPorVoz('Steven Ruiz', lista).resultados[0]?.id).toBe('m')
    expect(buscarPorVoz('Luz Dairy', lista).resultados[0]?.id).toBe('l')
  })
  it('la pista al transcriptor: nombres de pila primero, sin repetir, con tope', () => {
    expect(palabrasParaDictado(['Jeison Andrés Valencia', 'Jeison Ruiz', 'Brayan Valencia'])).toBe('Jeison, Brayan, Andrés, Valencia, Ruiz')
    expect(palabrasParaDictado(Array.from({ length: 500 }, (_, i) => `Nombre${i} Apellido${i}`)).length).toBeLessThanOrEqual(800)
  })
  it('la pista nunca pasa del tope de Groq, contado en BYTES (tildes y ñ son dos)', () => {
    // El caso de producción: 900 letras con tildes eran 904 bytes y Groq (896)
    // rechazaba la pista entera → «No te escuché» siempre (19 oct 2026).
    const nombres = Array.from({ length: 400 }, (_, i) => `Íñigo${i} Muñoz${i} Peña${i} Sofía${i}`)
    const pista = palabrasParaDictado(nombres)
    expect(new TextEncoder().encode(pista).length).toBeLessThanOrEqual(800)
    expect(pista.length).toBeGreaterThan(400)
  })
  it('la transcripción de la búsqueda lleva la pista, con el alcance del cobrador', () => {
    const r = require('node:fs').readFileSync('app/api/voz/transcribir/route.js', 'utf8')
    expect(r).toMatch(/formData\.get\('para'\) === 'buscar_cliente'/)
    expect(r).toContain("where: alcanceDeVoz(session.user, formData.get('rutaId') || null),")
    expect(require('node:fs').readFileSync('components/cf/BuscarPorVoz.jsx', 'utf8')).toMatch(/fd\.append\('para', 'buscar_cliente'\)/)
  })
})


describe('si Groq rechaza la pista, se transcribe sin ella (19 oct 2026)', () => {
  it('reintenta sin `prompt` y devuelve el texto', async () => {
    const llamadas = []
    const viejo = global.fetch
    process.env.GROQ_API_KEY = 'prueba'
    global.fetch = vi.fn(async (_url, { body }) => {
      llamadas.push(body.get('prompt'))
      if (body.get('prompt')) return { ok: false, text: async () => '{"error":{"code":"invalid_prompt"}}' }
      return { ok: true, json: async () => ({ text: 'Jeison Valencia' }) }
    })
    try {
      const r = await transcribirAudio(new Blob(['x']), { prompt: 'Jeison, Valencia' })
      expect(r).toEqual({ texto: 'Jeison Valencia' })
      expect(llamadas).toEqual(['Jeison, Valencia', null])
    } finally { global.fetch = viejo }
  })
  it('recorta en bytes sin partir una letra', () => {
    expect(recortarBytes('ñañaña', 5)).toBe('ñañ')   // ñ=2 + a=1 + ñ=2
    expect(recortarBytes('ñañaña', 4)).toBe('ña')
    expect(recortarBytes('abc', 10)).toBe('abc')
  })
})
