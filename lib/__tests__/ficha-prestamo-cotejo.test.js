// lib/__tests__/ficha-prestamo-cotejo.test.js
//
// T41-01 «Ficha fijo — el 54,7% de la cartera». Las tres decisiones del pie no
// son de estilo, y estan fijadas aca porque romperlas fabricaria datos.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const leer = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
const ficha = leer('components/pantallas/FichaPrestamo.jsx')
const pagina = leer('app/(dashboard)/prestamos/[id]/page.jsx')
const prims = leer('components/cf/primitivos.jsx')

describe('las tres reglas de la lamina', () => {
  it('1 · el historial, NO un calendario proyectado', () => {
    // En `fijo` el calendario es una frase —«$20.000 diarios durante 30 dias»— y
    // ya esta arriba. Treinta filas identicas serian relleno; el historial es lo
    // que el cliente discute.
    expect(ficha).toMatch(/function Historial/)
    expect(ficha).toMatch(/Cada pago que ha hecho/i)
  })

  it('2 · el interes UNA sola vez, en «como se pacto»', () => {
    // El sistema sabe el interes TOTAL, no cuanto de cada pago fue interes.
    // Inventar ese reparto es el tipo de dato que hace perder la confianza.
    expect(ficha).toMatch(/Le presté \{prestado\}, me paga \{totalAPagar\}/)
    const hist = ficha.slice(ficha.indexOf('function Historial'), ficha.indexOf('export default'))
    expect(hist).not.toMatch(/interes|interés/i)
  })

  it('3 · dice «Le falta pagar», no «saldo pendiente»', () => {
    // Aca no hay amortizacion, asi que no hay razon para hablar como un banco.
    expect(ficha).toMatch(/etiqueta="Le falta pagar"/)
    expect(ficha).not.toMatch(/Saldo pendiente/)
  })
})

describe('el verde del bloque oscuro', () => {
  it('la barra usa el verde de TEMA OSCURO, no el de claro', () => {
    // `--cf-green` vale #12A150 en claro —correcto sobre blanco— y sobre este
    // negro se hunde. La lamina usa #2FBE6A, que es lo que vale en oscuro. Mismo
    // fallo que tenia el dorado del bloque, y por la misma causa: un token de
    // tema dentro de algo que no sigue el tema.
    expect(ficha).toMatch(/alto=\{11\} sobreOscuro/)
    expect(prims).toMatch(/sobreOscuro\s*\n?\s*\? \(tono === 'ok' \? '#2FBE6A'/)
  })
})

describe('la ficha esta MONTADA en su ruta', () => {
  it('la pagina la usa y ya no el hero con donut', () => {
    expect(pagina).toMatch(/<FichaPrestamo/)
    expect(pagina).not.toMatch(/<PrestamoHeroCard/)
    expect(pagina).not.toMatch(/<GrillaDatosSecciones/)
  })

  it('la cabecera lleva el nombre, y el hook va ANTES de los returns', () => {
    // `useCabecera` es un hook: puesto despues del `if (loading) return`, el
    // orden de hooks cambia entre renders y React rompe la pantalla entera.
    // Salio con el triangulo rojo de error, y por eso lee del ESTADO.
    expect(pagina).toMatch(/useCabecera\(\{\s*\n?\s*titulo: prestamo\?\.cliente\?\.nombre/)
    const antes = pagina.indexOf('useCabecera({')
    const primerReturn = pagina.indexOf('if (loading) {')
    expect(antes).toBeGreaterThan(-1)
    expect(antes).toBeLessThan(primerReturn)
  })

  it('«Ver los N pagos» abre el historial que YA existe abajo', () => {
    expect(pagina).toMatch(/setHistorialOpen\(true\)/)
    expect(pagina).toMatch(/id="cf-historial-pagos"/)
  })
})

describe('sin acciones duplicadas', () => {
  it('la ficha NO pinta las suyas: la pagina ya tiene su pila', () => {
    // El boton rojo «PAGAR AHORA · VENCIDO $17.334» dice que esta vencido Y
    // cuanto, sin leer nada mas. Tener las dos seria cuatro botones de cobrar en
    // una pantalla de cobrar.
    expect(pagina).toMatch(/onRegistrar=\{undefined\}/)
  })

  it('el componente solo pinta la barra si recibe alguna accion', () => {
    expect(ficha).toMatch(/\{\(onGestionar \|\| onRegistrar\) && \(/)
  })
})
