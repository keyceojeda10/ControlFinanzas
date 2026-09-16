// «Pagó los intereses y sigue en mora» (16 sep 2026).
//
// «Mira lo que está en mora. Ya no debe estar en mora porque ella ya me pagó
//  eso.» — Gustavo Figueroa, Inversiones Don Pacho, sobre 107 préstamos
//  Dinámicos.
//
// El sistema tenía razón en la cifra y la culpa era del texto. Al elegir
// «Interés» en un préstamo CON TABLA, la hoja prometía:
//
//   «Cubre solo los intereses de las cuotas vencidas. El capital queda
//    pendiente pero no genera mora adicional.»
//
// Sí la genera. La cuota de un préstamo con tabla es capital + interés: pagar
// el interés deja el capital de esa cuota vencido y el préstamo sale en mora
// por esa parte en el acto. Su caso, al peso:
//
//   Marisol · cuota #1 = $325.000 = interés $75.000 + capital $250.000
//   pagó los $75.000 → EN MORA · 1 día · $250.000
//
// Leyendo esa frase registró 36 pagos así —12 en Dinámico, 24 en Decreciente—
// antes de reportarlo.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { elInteresSubeLaDeuda } from '@/lib/dinero/modos'

const leer = (f) => readFileSync(path.join(process.cwd(), f), 'utf8')
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const HOJA = sinComentarios(leer('components/prestamos/RegistrarPago.jsx'))

describe('el texto dice lo que de verdad pasa', () => {
  it('ya no promete que no genera mora, NI AQUÍ NI EN LA OTRA VÍA', () => {
    /* ⚠ La frase estaba DOS VECES: en el aviso de la hoja nueva y en el del
       formulario completo. Se arregló una y la prueba cazó la otra — el fallo
       de siempre en este repo. Por eso se cuentan las apariciones, no una. */
    expect(HOJA, 'volvió la frase que le costó 36 pagos mal registrados')
      .not.toMatch(/no genera mora adicional/)
    // Y los dos avisos distinguen los dos casos, no uno solo.
    expect((HOJA.match(/El capital de la cuota sigue vencido/g) ?? []).length).toBe(2)
  })

  it('dice que el capital sigue vencido, que es lo que pasa', () => {
    expect(HOJA).toMatch(/El capital de la cuota sigue vencido/)
    expect(HOJA).toMatch(/queda en mora por esa parte/)
  })

  it('y le enseña la salida: el modo donde el interés SÍ compra tiempo', () => {
    /* Lo que él quiere existe, pero en los modos sin tabla. Dejarlo solo con un
       «no» lo manda a adivinar, y adivinando fue como acabó con 107 préstamos
       en el modo que no era. */
    expect(HOJA).toMatch(/Solo interés, /)
    expect(HOJA).toMatch(/capital al final/)
  })

  it('el otro texto, el de SIN tabla, sigue diciendo lo suyo', () => {
    // Ahí el interés sí compra tiempo y la deuda sube: son dos cosas distintas
    // y cada una tiene que decir la suya.
    expect(HOJA).toMatch(/Le compra tiempo/)
    expect(HOJA).toMatch(/El capital NO baja/)
  })
})

describe('quién decide cuál de las dos cosas es', () => {
  it('con tabla el interés NO compra tiempo, y el Dinámico tiene tabla', () => {
    const conTabla = { modoInteres: 'lineal_dinamico', cuotasAmortizacion: [{ numeroPeriodo: 1 }] }
    expect(elInteresSubeLaDeuda(conTabla)).toBe(false)
  })

  it('sin tabla sí: ahí el interés alarga el préstamo', () => {
    expect(elInteresSubeLaDeuda({ modoInteres: 'fijo' })).toBe(true)
  })
})

describe('⚠ y el monto que se propone es lo que FALTA, no la cuota entera', () => {
  /* «si pagan los intereses, vuelve y debe repetirse en la cuota los mismos
   *  300». Tras cobrarle $75.000 de una cuota de $325.000, la hoja volvía a
   *  proponer $325.000 en vez de los $250.000 que faltaban: quien confirma sin
   *  mirar le cobra de más al cliente. */
  it('manda lo que falta cuando la cuota va a medias', () => {
    expect(HOJA).toMatch(/faltaDeLaCuota > 0 && faltaDeLaCuota < cuotaPropuesta \? faltaDeLaCuota : cuotaPropuesta/)
  })

  it('pero nunca más que el saldo, como siempre', () => {
    expect(HOJA).toMatch(/Math\.min\(\s*Math\.round\(saldoPendiente \?\? 0\),/)
  })

  it('y con varias cuotas atrasadas sigue proponiendo UNA', () => {
    /* Si debe tres, `montoAlDia` vale más que una cuota y no manda: proponer
       las tres de golpe sería empujar a cobrar lo que el cliente no lleva. La
       comparación `< cuotaPropuesta` es justo esa guarda. */
    expect(HOJA).toMatch(/faltaDeLaCuota < cuotaPropuesta/)
  })

  it('⚠ y la regla vive en UN solo sitio, no copiada en el efecto', () => {
    /* El efecto que abre la hoja tenía su propia fórmula escrita a mano
       —`min(cuota, saldo)`— y es la que MANDA al abrir: arreglar solo la de
       arriba no cambiaba nada en pantalla, y así salió medido. */
    expect(HOJA).toMatch(/const montoBase = montoInicial/)
    /* Eran TRES copias de `min(cuota, saldo)`: el `useState`, el efecto de
       abrir y el de cerrar. Ninguna puede volver. */
    expect((HOJA.match(/Math\.min\(Math\.round\(cuotaDiaria \?\? 0\), Math\.round\(saldoPendiente \?\? 0\)\)/g) ?? []).length)
      .toBe(0)
    expect(HOJA).toMatch(/setMonto\(String\(montoInicial\)\)/)
  })

  it('si no llega el dato, todo se queda como estaba', () => {
    // `montoAlDia` solo lo pasa la ficha del préstamo; desde otras pantallas
    // llega 0 y entonces manda la cuota, igual que antes.
    expect(HOJA).toMatch(/montoAlDia = 0,/)
  })
})
