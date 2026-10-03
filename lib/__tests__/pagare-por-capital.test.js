import { describe, it, expect, vi, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/* «Con los porcentajes tan altos que aparecen en el pagaré, si lo quiero usar
 *  legalmente quizás no serviría y sería contraproducente» — un prestamista,
 *  por el dueño, 3 oct 2026.
 *
 * Se genera el PDF DE VERDAD con el handler y se lee su texto: el de capital no
 * puede decir la tasa, ni el total con interés, ni la cuota. */
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { organizationId: 'org1', id: 'u1' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/almacen', () => ({ leerSubido: vi.fn(async () => null) }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    prestamo: {
      findFirst: vi.fn(async () => ({
        id: 'cmpagare0000000000abcdef', montoPrestado: 1000000, totalAPagar: 1200000, tasaInteres: 20,
        cuotaDiaria: 40000, frecuencia: 'diario', diasPlazo: 30, firmaUrl: null,
        fechaInicio: new Date('2026-10-01T05:00:00Z'), fechaFin: new Date('2026-10-31T05:00:00Z'),
        createdAt: new Date('2026-10-01T15:00:00Z'),
        cliente: { id: 'c1', nombre: 'Yane Patricia', cedula: '95004361', telefono: null, direccion: null },
      })),
    },
    organization: { findUnique: vi.fn(async () => ({ nombre: 'PRESTA MIL', ciudad: 'Bogotá', country: 'co' })) },
  },
}))

let GET, extractText
beforeAll(async () => {
  ({ GET } = await import('@/app/api/prestamos/[id]/pagare/route.js'))
  ;({ extractText } = await import('unpdf'))
})

async function texto(tipo) {
  const url = `http://localhost/api/prestamos/p1/pagare${tipo ? `?tipo=${tipo}` : ''}`
  const res = await GET(new Request(url), { params: Promise.resolve({ id: 'p1' }) })
  expect(res.status).toBe(200)
  const { text } = await extractText(new Uint8Array(await res.arrayBuffer()), { mergePages: true })
  return text.replace(/\s+/g, ' ')
}

describe('el pagaré por el capital (el de por defecto)', () => {
  it('sin decir nada sale el de capital: vale lo prestado y no dice la tasa', async () => {
    const t = await texto(null)
    expect(t).toContain('1.000.000')
    expect(t).toMatch(/que recibí en préstamo de dinero/)
    expect(t).toMatch(/tasa máxima legal permitida, certificada por la Superintendencia Financiera de Colombia/)
    // Lo que NO puede quedar escrito: la tasa, el total con interés y la cuota.
    expect(t).not.toMatch(/20 ?%/)
    expect(t).not.toContain('1.200.000')
    expect(t).not.toContain('40.000')
    expect(t).not.toMatch(/tasa de inter[eé]s/i)
  })

  it('con ?tipo=capital, lo mismo', async () => {
    expect(await texto('capital')).not.toMatch(/20 ?%/)
  })
})

describe('el pagaré con las condiciones (el de siempre)', () => {
  it('dice el total, lo prestado y la tasa, como antes', async () => {
    const t = await texto('condiciones')
    expect(t).toContain('1.200.000')
    expect(t).toMatch(/correspondiente a un prestamo por valor de \$ ?1\.000\.000 con una tasa de interes del 20%/)
  })
})

describe('la pantalla deja elegir, y el de capital va marcado', () => {
  const src = readFileSync(resolve(process.cwd(), 'components/prestamos/FirmaDigital.jsx'), 'utf8')
  it('el botón abre la elección y la descarga manda el tipo', () => {
    expect(src).toMatch(/onClick=\{\(\) => setModalPagare\(true\)\}/)
    expect(src).toMatch(/fetch\(`\/api\/prestamos\/\$\{prestamoId\}\/pagare\?tipo=\$\{tipo\}`\)/)
    expect(src).toMatch(/useState\('capital'\)/)
  })
  it('las dos opciones, con lo que trae cada una', () => {
    expect(src).toMatch(/titulo="Por el capital"/)
    expect(src).toMatch(/titulo="Con las condiciones del préstamo"/)
  })
})

describe('el valor en letras', () => {
  it('«UN MILLÓN DE PESOS», con su tilde y su «de», en los dos pagarés', async () => {
    expect(await texto('capital')).toContain('UN MILLÓN DE PESOS')
    // El de condiciones vale el total: $1.200.000 = «un millón doscientos mil pesos», sin «de».
    expect(await texto('condiciones')).toMatch(/UN MILLÓN DOSCIENTOS MIL PESOS/)
  })
})
