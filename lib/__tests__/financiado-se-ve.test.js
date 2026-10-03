import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { adaptarPrestamos, fichaDe, formatearTasa } from '@/lib/adaptadores/prestamos'
import { adaptarClientes } from '@/lib/adaptadores/clientes'

/* PRESTA MIL, vídeo del 28 sep 2026:
 *
 *   «Necesito acá poder identificar una cartulina que se financia el saldo y
 *    las cartulinas de préstamos […] cuando son bastantes cartulinas que un
 *    cobrador renueve y financia en el día, uno se confunde, a mí me toca
 *    preguntarle al cobrador: ¿esta fue préstamo o esta fue financiada?»
 *
 * Y el dueño, al aprobarlo: «fácilmente identificable, filtrable, y visible en
 * la tarjeta de afuera y en la de adentro, tanto del cliente como del préstamo».
 *
 * Una financiación se reconoce por `interesFinanciado` (null = no lo es). Puede
 * valer 0 —financiar sin cobrar interés—, y sigue siendo una financiación. */
const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

const prestamo = (extra = {}) => ({
  id: 'p1', estado: 'activo', frecuencia: 'diario', modoInteres: 'fijo',
  montoPrestado: 1000000, totalAPagar: 1200000, cuotaDiaria: 40000, totalPagado: 0,
  diasMora: 0, cliente: { nombre: 'Yane Patricia' }, ...extra,
})

describe('el préstamo dice si fue un saldo financiado', () => {
  it('la tarjeta de la lista lo marca', () => {
    const [f, n, r] = adaptarPrestamos([
      prestamo({ id: 'f', renovadoDeId: 'viejo', interesFinanciado: 200000 }),
      prestamo({ id: 'n' }),
      prestamo({ id: 'r', renovadoDeId: 'viejo', interesFinanciado: null }),
    ], 'CO')
    expect(f.financiado).toBe(true)
    expect(n.financiado).toBe(false)
    // Una renovación entregó plata: es una cartulina prestada, no financiada.
    expect(r.financiado).toBe(false)
  })

  it('financiar sin interés también es financiar', () => {
    const [f] = adaptarPrestamos([prestamo({ renovadoDeId: 'v', interesFinanciado: 0 })], 'CO')
    expect(f.financiado).toBe(true)
  })

  it('la ficha del desplegable también', () => {
    expect(fichaDe(prestamo({ interesFinanciado: 150000 }), 'CO').financiado).toBe(true)
    expect(fichaDe(prestamo(), 'CO').financiado).toBe(false)
  })
})

describe('el cliente dice si su préstamo es un saldo financiado', () => {
  it('lo marca si alguno de sus préstamos activos lo es', () => {
    const [con, sin] = adaptarClientes([
      { id: 'c1', nombre: 'Juliana Tuta', prestamos: [prestamo(), prestamo({ id: 'p2', interesFinanciado: 90000 })] },
      { id: 'c2', nombre: 'Delimar Paez', prestamos: [prestamo()] },
    ], 'CO')
    expect(con.financiado).toBe(true)
    expect(sin.financiado).toBe(false)
  })
})

describe('las pantallas la pintan', () => {
  it('la pastilla existe, con su icono y su nombre', () => {
    const src = leer('components/cf/primitivos.jsx')
    expect(src).toMatch(/export function EtiquetaFinanciado\(/)
    expect(src).toMatch(/<Pastilla tono="financiado"/)
    expect(src).toMatch(/financiado: \{ bg:/)
  })

  it('TarjetaCliente (lista de préstamos, de clientes y ficha del cliente)', () => {
    expect(leer('components/cf/TarjetaCliente.jsx')).toMatch(/\{financiado && <EtiquetaFinanciado \/>\}/)
  })

  it('el desplegable de cada préstamo', () => {
    expect(leer('components/cf/DesglosePrestamos.jsx')).toMatch(/\{ficha\.financiado && <EtiquetaFinanciado \/>\}/)
  })

  it('la tarjeta agrupada, la compacta y la tabla del PC', () => {
    expect(leer('components/prestamos/PrestamoCard.jsx')).toMatch(/esFinanciacion\(p\) && <EtiquetaFinanciado/)
    const pagina = leer('app/(dashboard)/prestamos/page.jsx')
    expect(pagina).toMatch(/function PrestamoCardCompacto[\s\S]*?esFinanciacion\(p\) && <EtiquetaFinanciado/)
    // En la tabla va en el renglón de la ruta, NO junto al nombre: con «Nuevo»
    // al lado, el nombre se partía letra por letra.
    expect(pagina).toMatch(/\{a\?\.piezas\?\.ruta\}<\/Dato>\s*\{a\?\.financiado && <EtiquetaFinanciado \/>\}/)
    expect(pagina).not.toMatch(/<EtiquetaNuevo nuevo=\{a\?\.nuevo\} \/>\s*\{a\?\.financiado/)
  })

  it('la ficha del préstamo lo dice arriba, en vez de «renovado»', () => {
    const src = leer('app/(dashboard)/prestamos/[id]/page.jsx')
    expect(src).toMatch(/esFinanciacion\(prestamo\)/)
    expect(src).toMatch(/>\s*Saldo financiado: no salió plata nueva/)
  })
})

describe('se puede filtrar y contar', () => {
  const api = leer('app/api/prestamos/route.js')

  it('la lista devuelve el campo (es una lista blanca)', () => {
    expect(api).toMatch(/interesFinanciado:\s+p\.interesFinanciado,/)
  })

  it('«financiado» filtra las financiadas y «sí, le presté de nuevo» ya no las trae', () => {
    expect(api).toMatch(/renovacion === 'financiado' && \{ interesFinanciado: \{ not: null \} \}/)
    expect(api).toMatch(/renovacion === 'si' && \{ renovadoDeId: \{ not: null \}, interesFinanciado: null \}/)
    expect(leer('app/(dashboard)/prestamos/page.jsx')).toMatch(/\{ valor: 'financiado', nombre: /)
  })

  it('«De hoy» cuenta las financiadas con el mismo filtro que la lista', () => {
    expect(api).toMatch(/soloNuevos \? prisma\.prestamo\.count\(\{ where: \{ \.\.\.where, interesFinanciado: \{ not: null \} \} \}\)/)
    const pagina = leer('app/(dashboard)/prestamos/page.jsx')
    expect(pagina).toMatch(/estado === 'nuevos' && financiadosHoy != null/)
  })

  it('la lista de clientes pide el campo y lo deja pasar', () => {
    const src = leer('app/api/clientes/route.js')
    expect(src).toMatch(/interesFinanciado: true,/)
    expect(src).toMatch(/interesFinanciado:\s+p\.interesFinanciado,/)
  })
})

describe('la tasa de una financiación se lee', () => {
  it('a dos decimales como mucho, sin tocar la guardada', () => {
    // La tasa que guarda «Financiar el saldo» sale de una división: la tarjeta
    // decía «Diario 20,161290322580644% Clásico».
    expect(formatearTasa(20.161290322580644)).toBe('20,16')
    expect(formatearTasa(2.5)).toBe('2,5')
    expect(formatearTasa(20)).toBe('20')
    expect(formatearTasa(19.999)).toBe('20')
  })
})
