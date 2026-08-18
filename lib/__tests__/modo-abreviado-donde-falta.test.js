// lib/__tests__/modo-abreviado-donde-falta.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Con el modo abreviado encendido, «40» son $40.000. Lo tienen **7 de 514
// negocios**, y el rediseño lo fue perdiendo pantalla por pantalla: puso un
// `<input>` propio en cada hoja nueva y la conversión se quedó en el campo
// viejo. El interruptor seguía encendido sin hacer nada, y un cobrador lo
// reportó creyendo que se le había desactivado solo.
//
// Medido el 18 ago, uno por uno, los campos donde se TECLEA plata: de los
// diecisiete sospechosos, la mayoría eran tasas (que NO se deben multiplicar —
// un 20% convertido sería 20.000%) o láminas de la guía de estilos que nadie
// monta. Los de verdad eran DOS:
//
//   · el monto del GASTO (`ReportarGasto`) — «40» se guardaba como $40
//   · el CAPITAL INICIAL del arranque (`WizardCapital`) — la primera cifra del
//     negocio, la que decide si la caja cuadra desde el primer día
//
// ⚠ Y la mitad que importa no es multiplicar: es que SE VEA. `MoneyInput` ya
//   enseña «x1.000» y «= 40.000» debajo del campo. Una cifra multiplicada por
//   mil a espaldas de quien la escribe aparece semanas después como un
//   descuadre que nadie sabe explicar.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { montoCrudoConModo, montoParaMostrarConModo } from '@/lib/adaptadores/pago'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')

describe('⚠ la conversión, y sus dos bordes', () => {
  it('«40» son cuarenta mil', () => {
    expect(montoCrudoConModo('40', true)).toBe('40000')
  })

  it('sin el modo no se toca nada', () => {
    expect(montoCrudoConModo('40', false)).toBe('40')
  })

  it('⚠ lo que NO es múltiplo de mil se deja tal cual', () => {
    /* 40.500 en abreviado se vería «41» y al guardar volvería 41.000: la plata
       cambiaría a espaldas de quien la escribió. */
    expect(montoParaMostrarConModo('40500', true, 'co')).toContain('40')
    expect(montoParaMostrarConModo('40500', true, 'co')).not.toBe('41')
  })
})

describe('⚠ los dos campos que lo ignoraban', () => {
  it('el gasto usa el campo que sí convierte', () => {
    const g = leer('components/gastos/ReportarGasto.jsx')
    expect(g, 'volvió el Input a secas y el gasto de $40').toMatch(/<MoneyInput/)
    expect(g, 'volvió `type="number"`, que en móvil rechaza el separador')
      .not.toMatch(/label="Monto"[\s\S]{0,120}type="number"/)
  })

  it('el capital inicial lo aplica, y lo lee de la sesión', () => {
    /* De `useAuth` y NO de una prop: si dependiera de que quien monta la
       pantalla se acuerde de pasarla, se perdería en la siguiente. */
    const c = leer('components/onboarding/wizard/WizardCapital.jsx')
    expect(c).toMatch(/const \{ modoAbreviado \} = useAuth\(\)/)
    expect(c).toMatch(/modoAbreviado \? tecleado \* 1000 : tecleado/)
  })

  it('y el capital inicial ENSEÑA en qué se convierte', () => {
    const c = leer('components/onboarding/wizard/WizardCapital.jsx')
    expect(c).toMatch(/x1\.000/)
    expect(c).toMatch(/= \{montoNum\.toLocaleString/)
  })

  it('⚠ los atajos suman en la escala que se ve', () => {
    /* Con el modo puesto, «+100.000» debe subir el campo en 100. Sumando 100.000
       sobre lo tecleado, un toque dejaría cien millones. */
    const c = leer('components/onboarding/wizard/WizardCapital.jsx')
    expect(c).toMatch(/modoAbreviado \? n \/ 1000 : n/)
  })
})

describe('⚠ y la tasa NO se multiplica', () => {
  it('el campo del interés sigue siendo un input suyo', () => {
    /* Convertir un 20% en 20.000% sería mucho peor que el fallo que se viene a
       arreglar. Por eso no vale «poner MoneyInput en todos los inputMode». */
    const cp = leer('components/pantallas/config/ComoPrestas.jsx')
    expect(cp).not.toMatch(/<MoneyInput[^>]*tasa/)
  })
})
