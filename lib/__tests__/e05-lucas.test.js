import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { generarTipCliente } from '@/lib/tips/clienteTips'

// ── E05 · Lucas ─────────────────────────────────────────────────────────────
//
// De la lámina: «una recomendación sin monto y sin botón es una frase; con los
// dos, es una decisión que el dueño toma en dos segundos».
//
// ⚠ LO QUE MÁS IMPORTA DE ESTE ARCHIVO no es que la sugerencia salga: es que NO
// SALGA cuando no debe. Ofrecerle más plata a alguien que ya está en mora sería
// una recomendación irresponsable en la pantalla del dinero.

const cli = (extra = {}) => ({ id: 'c1', nombre: 'X', estado: 'activo', ...extra })
const prestamo = (extra = {}) => ({ id: 'p1', saldoPendiente: 100000, diasMora: 0, porcentajePagado: 50, ...extra })

describe('cuándo Lucas ofrece prestar', () => {
  it('con tope puesto, al día y sin incumplidos', () => {
    const s = generarTipCliente(
      cli({ montoMaximoPrestamo: 1500000 }),
      [prestamo({ porcentajePagado: 70 })],
      { completados: 2, incumplidos: 0 },
    )
    expect(s.tono).toBe('oferta')
    expect(s.monto).toBe(1500000)
    expect(s.titular).toContain('$1.500.000')
    expect(s.porque, 'no dice de dónde sale la cifra').toContain('el tope que le pusiste')
    expect(s.porque, 'no dice cómo ha pagado').toContain('anteriores')
  })

  it('la cifra es el tope del dueño, no una inventada', () => {
    // Lucas RECUERDA, no calcula una capacidad de crédito nueva.
    const s = generarTipCliente(
      cli({ montoMaximoPrestamo: 300000 }),
      [],
      { completados: 1, incumplidos: 0 },
    )
    expect(s.monto).toBe(300000)
  })
})

describe('cuándo NO ofrece (lo que más importa)', () => {
  it('en mora, avisa en vez de ofrecer', () => {
    const s = generarTipCliente(
      cli({ montoMaximoPrestamo: 1500000 }),
      [prestamo({ diasMora: 12 })],
      { completados: 3, incumplidos: 0 },
    )
    expect(s.tono, 'le ofrece plata a alguien en mora').toBe('aviso')
    expect(s.monto).toBeUndefined()
    expect(s.titular).toContain('12 días sin pagar')
  })

  it('con varios préstamos abiertos, tampoco', () => {
    const s = generarTipCliente(
      cli({ montoMaximoPrestamo: 1500000 }),
      [prestamo(), prestamo({ id: 'p2', saldoPendiente: 250000 })],
      { completados: 5, incumplidos: 0 },
    )
    expect(s.tono).toBe('aviso')
    expect(s.monto).toBeUndefined()
    expect(s.titular).toContain('2 préstamos abiertos')
    expect(s.porque, 'no dice cuánto debe en total').toContain('$350.000')
  })

  it('con un incumplimiento en el historial, tampoco', () => {
    const s = generarTipCliente(
      cli({ montoMaximoPrestamo: 1500000 }),
      [prestamo({ porcentajePagado: 90 })],
      { completados: 4, incumplidos: 1 },
    )
    expect(s?.tono, 'ofrece a quien ya incumplió una vez').not.toBe('oferta')
  })

  it('sin tope no inventa un monto', () => {
    // Es la decisión de fondo: sin tope se informa y se sugiere ponerlo, pero
    // no se saca una cifra de la nada.
    const s = generarTipCliente(cli({}), [], { completados: 2, incumplidos: 0 })
    expect(s.tono).toBe('info')
    expect(s.monto).toBeUndefined()
    expect(s.porque).toContain('Ponle un tope')
  })

  it('sin cliente no dice nada', () => {
    expect(generarTipCliente(null, [])).toBe(null)
  })

  it('un cliente nuevo sin historial no recibe oferta', () => {
    // Con tope pero sin haber pagado nunca, no hay nada que avale la sugerencia.
    const s = generarTipCliente(cli({ montoMaximoPrestamo: 500000 }), [], { completados: 0, incumplidos: 0 })
    expect(s?.tono).not.toBe('oferta')
  })
})

describe('la etiqueta de estado', () => {
  it('dice al día y en qué préstamo va', () => {
    const s = generarTipCliente(
      cli({ montoMaximoPrestamo: 100000 }),
      [prestamo()],
      { completados: 2, incumplidos: 0 },
    )
    expect(s.etiqueta).toBe('al día · 3º préstamo')
  })

  it('dice el atraso cuando lo hay', () => {
    // ⚠ Con UN día de atraso y medio préstamo pagado no dice nada, y está
    // bien: no hay nada que avisar todavía. Mi primera versión de esta prueba
    // usó ese caso y falló contra el código correcto.
    // Para ver la etiqueta hay que ponerse en un caso que sí hable.
    const s = generarTipCliente(cli({}), [prestamo({ diasMora: 9 })], { completados: 1 })
    expect(s.tono).toBe('aviso')
    expect(s.etiqueta).toContain('9 días de atraso')
    expect(s.etiqueta).toContain('2º préstamo')
  })

  it('un día de atraso todavía no es noticia', () => {
    // El aviso arranca a los 7 días. Antes de eso, molestar por un día de
    // retraso haría que se ignore el bloque cuando de verdad importe.
    const s = generarTipCliente(cli({}), [prestamo({ diasMora: 1 })], { completados: 0 })
    expect(s).toBe(null)
  })
})

describe('el bloque de Lucas', () => {
  const src = readFileSync(resolve(process.cwd(), 'components/clientes/LucasSugiere.jsx'), 'utf8')

  it('solo pone botón cuando hay monto Y quien lo reciba', () => {
    // Un botón «Prestarle $0» o que no lleve a ningún sitio sería peor que no
    // tenerlo.
    expect(src).toContain("const esOferta = tono === 'oferta' && monto > 0 && !!onPrestar")
  })

  it('lleva el descargo', () => {
    // Lo que hace honesta la sugerencia: la app no aprueba nada.
    expect(src).toContain('Es una sugerencia, no una aprobación')
  })

  it('el descargo solo va con la oferta', () => {
    // En un aviso de mora, ese pie no viene a cuento.
    const i = src.indexOf('Es una sugerencia, no una aprobación')
    const antes = src.slice(Math.max(0, i - 400), i)
    expect(antes).toContain('{esOferta && (')
  })
})

describe('la página lo conecta', () => {
  const pagina = readFileSync(resolve(process.cwd(), 'app/(dashboard)/clientes/[id]/page.jsx'), 'utf8')

  it('el banner gris se fue', () => {
    expect(pagina, 'volvió el banner de la chispa').not.toContain('<AiTipBanner')
    expect(pagina).toContain('<LucasSugiere')
  })

  it('le pasa el historial que necesita para decidir', () => {
    // Sin `completados` e `incumplidos`, Lucas no puede saber si ofrecer.
    const i = pagina.indexOf('<LucasSugiere')
    const bloque = pagina.slice(i, i + 600)
    expect(bloque).toContain('completados:')
    expect(bloque).toContain('incumplidos:')
  })

  it('el botón lleva el monto a la pantalla de nuevo préstamo', () => {
    // Y esa pantalla lo lee: `deLaUrl('monto', '')`.
    expect(pagina).toMatch(/prestamos\/nuevo\?clienteId=\$\{id\}&monto=\$\{monto\}/)
    const nuevo = readFileSync(resolve(process.cwd(), 'app/(dashboard)/prestamos/nuevo/page.jsx'), 'utf8')
    expect(nuevo, 'la pantalla de nuevo préstamo dejó de leer el monto de la URL')
      .toContain("deLaUrl('monto', '')")
  })
})
