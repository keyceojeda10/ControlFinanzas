import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── «LO QUE PRESTÓ HOY» CONTABA LO QUE NO SALIÓ DE SU MANO ──────────────────
//
// La tarjeta de la ficha del cobrador rotula su cifra como «lo que de verdad
// salió de su mano», pero sumaba TAMBIÉN los desembolsos hechos por
// transferencia — que salen del negocio, no de su fajo.
//
// Cazado con la prueba de flujo (`scripts/prueba-dinero`), que monta un negocio
// de mentira y compara contra la cuenta a mano:
//
//     «Lo que prestó hoy» · efectivo   debería 347.000   decía 560.000
//
// Los 213.000 de diferencia eran un préstamo desembolsado por transferencia.
// Y tres renglones más abajo, en la misma pantalla, la línea «Prestó en
// efectivo» decía 347.000 — la correcta. La pantalla se contradecía a sí misma,
// que es justo lo que hace que un cobrador deje de creerle al sistema.
//
// En producción: 78 desembolsos por transferencia, $64.010.000 mal atribuidos
// al fajo de algún cobrador.

const src = readFileSync(resolve(process.cwd(), 'app/api/caja/cobrador/[id]/route.js'), 'utf8')

describe('la tarjeta cuenta solo lo que salió del fajo', () => {
  it('hay un criterio único de «en efectivo»', () => {
    expect(src).toMatch(/const enEfectivo = \(d\) => d\.metodoPago !== 'transferencia'/)
  })

  it('el total en efectivo FILTRA lo digital', () => {
    // Era: sum(desembolsos, 'monto') — todos, sin mirar el método.
    expect(src).toMatch(/const efectivoTotal = sum\(desembolsos\.filter\(enEfectivo\), 'monto'\)/)
  })

  it('nuevos y renovaciones filtran igual', () => {
    const bloque = src.slice(src.indexOf('const prestadoDetalle = {'), src.indexOf('tarjetaMuestra'))
    expect((bloque.match(/\.filter\(enEfectivo\)/g) ?? []).length).toBe(2)
  })

  it('lo que salió por transferencia se enseña APARTE, no se esconde', () => {
    // Si solo se restara, el prestamista echaría en falta la diferencia y
    // pensaría que el sistema perdió plata.
    expect(src).toMatch(/transferenciaTotal: sum\(desembolsos\.filter\(\(d\) => !enEfectivo\(d\)\), 'monto'\)/)
    const bloque = src.slice(src.indexOf('const prestadoDetalle = {'), src.indexOf('tarjetaMuestra'))
    expect((bloque.match(/transferencia: sum\(/g) ?? []).length).toBe(2)
  })
})

describe('la línea de la cuenta y la tarjeta usan el MISMO criterio', () => {
  it('la línea «Prestó en efectivo» ya descontaba lo digital', () => {
    // Esta parte estaba bien y no se toca: es la que hacía de testigo.
    expect(src).toMatch(/desembolsos\.filter\(\(d\) => d\.metodoPago === 'transferencia'\)/)
    expect(src).toMatch(/const prestadoEfectivoNeto = prestadoNeto - prestadoDigital/)
  })

  it('y la tarjeta ahora también', () => {
    // El fallo no era que faltara el dato —`metodoPago` ya venía en el select—
    // sino que dos cifras de la misma pantalla lo usaban de forma distinta.
    expect(src).toMatch(/select: \{ referenciaId: true, monto: true, rutaId: true, createdAt: true, metodoPago: true \}/)
  })
})

describe('la prueba de flujo que lo cazó sigue en pie', () => {
  it('comprueba el fajo contra la cuenta a mano', () => {
    const guion = readFileSync(resolve(process.cwd(), 'scripts/prueba-dinero/prueba-dinero.mjs'), 'utf8')
    expect(guion).toMatch(/function comprobarElFajo/)
    // Las cinco líneas de su pantalla, una por una. Comprobar solo la suma no
    // sirve: el 27 de julio dos errores que se anulaban la dejaron correcta.
    for (const id of ['recaudoEfectivo', 'recaudoDigital', 'desembolsos', 'gastos', 'aLaCuenta']) {
      expect(guion, `dejó de comprobar la línea ${id}`).toContain(`revisar('${id}'`)
    }
  })

  it('el libro separa lo que salió del fajo de lo que salió del negocio', () => {
    const libro = readFileSync(resolve(process.cwd(), 'scripts/prueba-dinero/libro.mjs'), 'utf8')
    expect(libro).toMatch(/desembolsadoEfectivo/)
    expect(libro).toMatch(/return libro\.recogidaEfectivo - libro\.desembolsadoEfectivo - libro\.gastos/)
  })
})
