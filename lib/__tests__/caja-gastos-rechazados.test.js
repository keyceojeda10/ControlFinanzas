import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const api = readFileSync(join(process.cwd(), 'app', 'api', 'caja', 'route.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')   // sin los comentarios: el arreglo se explica citando el fallo

/** El objeto `where` que sigue a una declaración, en bruto. */
const bloque = (nombre) => {
  const i = api.indexOf(`const ${nombre} = {`)
  return i === -1 ? null : api.slice(i, api.indexOf('\n  }', i))
}

describe('un gasto rechazado no se sigue viendo en la caja', () => {
  /* PRESTA MIL, 21 ago 2026: «la ruta 9 ingresó unos gastos, acepté algunos y
     rechacé otros, y en la caja de la ruta me siguen apareciendo todos».

     El TOTAL ya los excluía; LA LISTA no. Y esa misma lista sin filtrar es la
     que recibe `calcularGastosPorRutaDia`, así que los gastos de cada ruta
     contaban plata que el dueño había rechazado a mano.

     Medido en su organización el 11 de agosto: total $142.000, lista $262.000.
     Tenía 29 rechazados por $658.000 desde julio. */

  it('el TOTAL del día solo cuenta pendientes y aprobados', () => {
    expect(bloque('whereGastosDia')).toMatch(/estado:\s*\{\s*in:\s*\['pendiente',\s*'aprobado'\]/)
  })

  it('⚠ y LA LISTA usa el mismo filtro que el total', () => {
    /* Si no, el dueño ve una suma que no puede reconstruir sumando lo que le
       enseñan. Es la misma regla que ya estaba escrita para los pagos. */
    expect(bloque('whereGastos'), 'la lista volvió a traer los rechazados')
      .toMatch(/estado:\s*\{\s*in:\s*\['pendiente',\s*'aprobado'\]/)
  })

  it('y los gastos por ruta salen de esa misma lista', () => {
    /* El arreglo vale para las dos cosas PORQUE comparten origen. Si alguien
       le pasa otro array a `calcularGastosPorRutaDia`, hay que volver a mirar. */
    expect(api).toMatch(/calcularGastosPorRutaDia\(organizationId,\s*gastos\)/)
  })

  it('el rechazo devuelve su asiento de capital', () => {
    // La plata nunca se descontó: lo que fallaba era solo lo que se veía.
    const gastos = readFileSync(
      join(process.cwd(), 'app', 'api', 'gastos', '[id]', 'route.js'), 'utf8')
    expect(gastos).toMatch(/debeDevolverAlRechazar/)
    expect(gastos).toMatch(/Reverso gasto rechazado/)
  })
})
