/* Los filtros que pidieron, y el que contestaba mal.
 *
 * ══ LO QUE REPORTÓ ═════════════════════════════════════════════════════════
 *
 *   «Aquí salen todos y yo quiero que solo salgan los que me deben.»
 *   «…los que no tienen préstamo para que las personas sepan qué cliente se le
 *    puede hacer nuevamente un préstamo, o cuáles de clientes que registró no
 *    tiene préstamos.»
 *
 * MEDIDO EN PRODUCCIÓN el 27 ago 2026, 7.624 clientes:
 *   me deben 5.645 · ya pagó todo 900 · nunca le presté 1.079
 *   170 de 347 negocios tienen la lista ensuciada; 75 tienen a quién renovarle.
 *
 * ⚠ Y «AL DÍA» NO CONTESTABA ESO. Iba por `Cliente.estado`, que se pone en
 * 'activo' al prestar y NO vuelve atrás al terminar de pagar: 937 clientes
 * (18%) salían «al día» sin deber un peso, en 114 negocios. Son las fichas que
 * en su captura salen con «OK» y sin cifra. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const apiCli = readFileSync('app/api/clientes/route.js', 'utf8')
const pagCli = readFileSync('app/(dashboard)/clientes/page.jsx', 'utf8')
const apiPre = readFileSync('app/api/prestamos/route.js', 'utf8')
const pagPre = readFileSync('app/(dashboard)/prestamos/page.jsx', 'utf8')

describe('los filtros que pidieron', () => {
  it('las cinco pastillas de clientes existen', () => {
    for (const v of ['meDeben', 'mora', 'activo', 'yaPago', 'sinPrestamo']) {
      expect(pagCli).toMatch(new RegExp(`value: '${v}'`))
    }
  })

  it('⚠ «Me deben» va en segunda posición, que es lo que la hace visible', () => {
    /* A 412px caben TRES pastillas. Si cae la cuarta hay que deslizar, y un
       filtro que hay que buscar es un filtro que no se usa — está escrito dos
       veces en esta misma lista. El orden ES la funcionalidad. */
    const orden = [...pagCli.matchAll(/\{ value: '([^']*)',\s+label:/g)].map((m) => m[1])
    expect(orden.slice(0, 3)).toEqual(['', 'meDeben', 'mora'])
  })

  it('⚠ «Al día» ya no cuenta a quien no debe nada', () => {
    // Tiene que exigir préstamo vivo, no solo `Cliente.estado === 'activo'`.
    expect(apiCli).toMatch(/estadoFiltro === 'activo'.*vivos === 0/s)
  })

  it('«ya pagó» y «sin préstamo» son dos preguntas, no una', () => {
    // Se separan por si TUVO préstamos alguna vez, no por si tiene.
    expect(apiCli).toMatch(/estadoFiltro === 'yaPago'/)
    expect(apiCli).toMatch(/estadoFiltro === 'sinPrestamo'/)
    expect(apiCli).toMatch(/prestamosTotales/)
  })

  it('⚠ el total de préstamos sale de `_count`, no de la relación filtrada', () => {
    /* La relación `prestamos` lleva `where: { estado: 'activo' }`: desde ella,
       el que ya pagó y el que nunca recibió nada se ven IGUAL. Es el patrón que
       dio «nunca» en rojo en 203 filas. */
    expect(apiCli).toMatch(/_count: \{ select: \{ prestamos: true \} \}/)
  })

  it('⚠ los conteos se calculan con la MISMA regla que filtra', () => {
    // Si se cuentan por un lado y se filtran por otro, la pastilla dice 22 y la
    // lista enseña 18. Los tres buckets nuevos tienen que estar en `conteos`.
    for (const k of ['meDeben', 'yaPago', 'sinPrestamo']) {
      expect(apiCli).toMatch(new RegExp(`conteos\\.${k}`))
    }
    expect(apiCli).toMatch(/soloConteos/)
  })

  it('préstamos · «Ni un peso» existe y pide más de un mes sin abonos', () => {
    expect(pagPre).toMatch(/value: 'niUnPeso'/)
    expect(apiPre).toMatch(/niUnPeso = searchParams\.get\('niUnPeso'\) === '1'/)
    expect(apiPre).toMatch(/totalPagado \?\? 0\) <= 0/)
  })

  it('⚠ «Ni un peso» NO pagina antes de filtrar', () => {
    /* Sin esto el endpoint corta la página y el criterio filtra solo esa: en el
       espejo la lista traía 32 donde la base decía 188. Es el defecto que ya se
       corrigió para la mora y se dejó en los demás. */
    expect(apiPre).toMatch(/const filtraEnJs = .*niUnPeso/)
    expect(apiPre).toMatch(/hayVentana \|\| niUnPeso\) && \{ estado: 'activo' \}/)
  })

  it('⚠ y viaja por su propio parámetro, no como `estado`', () => {
    // Mandarlo como `estado` daría un enum inválido y el endpoint devolvería la
    // lista entera sin filtrar — «peor que un error, porque parece que funciona».
    expect(pagPre).toMatch(/est === 'niUnPeso'\) params\.set\('niUnPeso', '1'\)/)
    expect(pagPre).toMatch(/est === 'niUnPeso' \|\|/)
  })
})
