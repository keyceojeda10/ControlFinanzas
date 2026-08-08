import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { calendarioDeCobro } from '@/lib/dias-sin-cobro'

// ── «SIGO SIN VER LOS DÍAS O DÍA DE PAGOS» ──────────────────────────────────
//
// Reportado dos veces por el dueño. La primera lo entendí como el PRÓXIMO cobro
// y arreglé eso —«VENCIÓ EL 24 jul»—; la segunda, con el PDF de la pantalla ya
// corregida, quedó claro que preguntaba otra cosa:
//
//   · CUÁNDO es el próximo   → la tira            (ya estaba)
//   · QUÉ DÍAS se cobra      → el CALENDARIO      (faltaba)
//
// En un préstamo diario «30 cuotas diarias» NO son treinta días seguidos: si la
// ruta no cobra domingos, son cinco semanas. Ese dato lo resolvía el servidor y
// no llegaba a ninguna pantalla.

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const api = leer('app/api/prestamos/[id]/route.js')
const pagina = leer('app/(dashboard)/prestamos/[id]/page.jsx')
const ficha = leer('components/pantallas/FichaPrestamo.jsx')

const diario = { frecuencia: 'diario', fechaInicio: '2026-07-10T05:00:00.000Z' }

describe('diario: lo que manda son los días sin cobro', () => {
  it('sin ninguno, todos los días', () => {
    expect(calendarioDeCobro(diario, [])).toBe('Se cobra todos los días')
  })

  it('sin domingos se dice «de lunes a sábado», no «menos los domingos»', () => {
    // Es el caso más común de todos y se dice mejor por lo que SÍ.
    expect(calendarioDeCobro(diario, [0])).toBe('Se cobra de lunes a sábado')
  })

  it('sin fin de semana, «de lunes a viernes»', () => {
    expect(calendarioDeCobro(diario, [0, 6])).toBe('Se cobra de lunes a viernes')
  })

  it('y cualquier otra combinación se enumera por los que sí', () => {
    /* Con cuatro días excluidos, listar los que faltan es más corto Y es la
       pregunta que se hace el cobrador: «¿qué días paso?». */
    expect(calendarioDeCobro(diario, [0, 2, 4, 6])).toBe('Se cobra los lunes, miércoles y viernes')
  })

  it('la semana empieza en lunes, no en domingo', () => {
    // 0 = domingo en la base, pero nadie enumera «domingo, lunes, martes».
    expect(calendarioDeCobro(diario, [1])).toBe('Se cobra los martes, miércoles, jueves, viernes, sábados y domingos')
  })
})

describe('las demás frecuencias van por su ancla', () => {
  it('semanal con día fijado', () => {
    expect(calendarioDeCobro({ frecuencia: 'semanal', diaCobroSemana: 2 }, [])).toBe('Se cobra todos los martes')
  })

  it('semanal sin ancla: el día en que empezó', () => {
    // Es lo que hace el calculador (`aplicarDiaAncla`): sin ancla explícita,
    // los bloques de 7 días caen siempre en el mismo día de la semana.
    expect(calendarioDeCobro({ frecuencia: 'semanal', fechaInicio: '2026-07-10T05:00:00.000Z' }, []))
      .toBe('Se cobra todos los viernes')
  })

  it('mensual con día del mes', () => {
    expect(calendarioDeCobro({ frecuencia: 'mensual', diaCobroMes: 5 }, [])).toBe('Se cobra el 5 de cada mes')
  })

  it('mensual sin ancla: el día del mes en que empezó', () => {
    expect(calendarioDeCobro({ frecuencia: 'mensual', fechaInicio: '2026-07-10T05:00:00.000Z' }, []))
      .toBe('Se cobra el 10 de cada mes')
  })

  it('quincenal con dos días del mes', () => {
    expect(calendarioDeCobro({ frecuencia: 'quincenal', diaCobroMes: 15, diaCobroMes2: 30 }, []))
      .toBe('Se cobra el 15 y el 30 de cada mes')
  })

  it('⚠ y NINGUNA de ellas nombra los días sin cobro', () => {
    /* Sorprende, y es a propósito: `diasSinCobro` SOLO se aplica en frecuencia
       diaria (`calculos.js`:1119). En semanal se ignora —una ruta que solo
       cobra sábados llevaría la primera cuota a siete sábados después, que fue
       un bug reportado— así que nombrarlos aquí sería mentir sobre el
       calendario que el sistema calcula de verdad. */
    const conDomingosFuera = calendarioDeCobro({ frecuencia: 'semanal', diaCobroSemana: 2 }, [0, 6])
    expect(conDomingosFuera).toBe('Se cobra todos los martes')
    expect(conDomingosFuera).not.toMatch(/domingo|sábado/)
  })
})

describe('el dato llega de verdad a la pantalla', () => {
  it('⚠ el API resuelve los días CON el préstamo, no solo con el cliente', () => {
    /* `obtenerDiasSinCobro` resuelve Préstamo > Cliente > Ruta > Organización, y
       aquí se le pasaban tres argumentos: los del préstamo NO GANABAN. La
       pantalla tiene un control para ponerlos —«Días sin cobro», en Gestión— así
       que se podían configurar y no hacían nada.

       Y `/api/clientes/[id]` y `/api/cobros-hoy` sí los pasaban: el mismo
       préstamo podía enseñar un próximo cobro distinto según por dónde se
       mirara. */
    expect(api).toMatch(/obtenerDiasSinCobro\(p\.cliente, p\.cliente\?\.ruta, org, p\)/)
  })

  it('y los devuelve, en vez de calcularlos y tirarlos', () => {
    // La pantalla solo tenía el campo crudo del préstamo, sin la herencia.
    expect(api).toMatch(/^\s*diasExcluidos,$/m)
  })

  it('la pantalla compone la frase y la ficha la pinta', () => {
    expect(pagina).toMatch(/calendarioDeCobro\(prestamo, prestamo\?\.diasExcluidos \?\? \[\]\)/)
    expect(pagina).toMatch(/diasDeCobro=\{diasDeCobroTexto\}/)
    expect(ficha).toMatch(/\{diasDeCobro\}/)
  })

  it('y sale también en el préstamo de un solo pago', () => {
    // Ahí no hay cuotas, pero sí un día en que se cobra todo.
    const bloques = ficha.split('{diasDeCobro && (')
    expect(bloques.length, 'solo se pinta en una de las dos ramas').toBeGreaterThanOrEqual(3)
  })
})
