import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const pantalla = readFileSync(
  join(process.cwd(), 'app', '(dashboard)', 'lineas-credito', '[id]', 'page.jsx'), 'utf8')

// Los comentarios citan lo que se quitó («degradado azul», «Desembolsar»…), así
// que medir sobre el texto crudo dejaría pasar una prueba por culpa de su propia
// explicación. Ya me pasó buscando `borderRadius: 999`.
const codigo = pantalla
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

describe('T30-04 · la tarjeta pasa de azul a carbón', () => {
  it('no queda ni un azul suelto', () => {
    // El azul en este sistema significa PERSONA (avatar, punto de ubicación),
    // nunca dinero: `--cf-blue` está documentado así en tokens-2026.css.
    // Eran seis degradados entre el fondo, el brillo y la escarcha.
    expect(codigo).not.toMatch(/#(1e40af|2563eb|3b82f6|60a5fa|bfdbfe|0a1628|112244|1e3a6e|153060|0d1f3d)/i)
    expect(codigo).not.toMatch(/rgba\(\s*(96,\s*165,\s*250|180,\s*220,\s*255|200,\s*230,\s*255|120,\s*180,\s*255)/)
    expect(codigo).not.toContain('--cf-blue')
  })

  it('no quedan los adornos del metalizado', () => {
    // Brillo diagonal, escarcha de puntos y orbe: tres capas absolutas encima
    // del fondo. Sin fondo azul no adornan nada, solo tapan.
    expect(codigo).not.toContain('CardWaves')
    expect(codigo).not.toMatch(/sheen|frost/i)
    expect(codigo).not.toMatch(/filter: 'blur/)
  })

  it('el fondo es el carbón del canon', () => {
    expect(codigo).toMatch(/fondo: '#15161A'/)
  })

  it('no deja el tema colgando sin usarlo', () => {
    // `useTheme` sostenía las dos paletas del metalizado. Un import muerto no
    // rompe el build (no hay TS) pero deja creer que la pantalla cambia con el
    // tema cuando ya no lo hace.
    expect(codigo).not.toContain('useTheme')
    expect(codigo).not.toContain('resolvedTheme')
  })
})

describe('T30-04 · lo que puede pedir manda', () => {
  it('el número grande es el DISPONIBLE, no lo que debe', () => {
    // Es la pregunta que trae al cliente al mostrador. Antes el disponible era
    // una de tres cifras de 14px en fila, con el mismo peso que las otras dos.
    const grande = codigo.match(/text-\[34px\][^>]*>\s*\{formatMoney\((\w+)\)\}/)
    expect(grande, 'no encuentro la cifra grande').toBeTruthy()
    expect(grande[1]).toBe('disponible')
    expect(codigo).toMatch(/const disponible = linea\.cupoDisponible \|\| 0/)
  })

  it('dice de cuánto es el cupo al lado', () => {
    // Un «$210.000» solo no se puede juzgar: hace falta el «de $500.000».
    expect(codigo).toMatch(/de \{formatMoney\(linea\.cupoMaximo\)\}/)
  })

  it('la etiqueta está en el idioma del prestamista', () => {
    expect(codigo).toContain('Puede pedir hasta')
  })
})

describe('T30-04 · el corte sube al segundo lugar', () => {
  it('sale de una función probada, no de aritmética suelta en el JSX', () => {
    expect(codigo).toContain('calcularProximoCorte(linea.diaCorte)')
    expect(pantalla).toMatch(/import \{[^}]*calcularProximoCorte[^}]*\} from '@\/lib\/lineas-credito'/)
  })

  it('dice cuándo es, no el número del día del mes', () => {
    // Decía «Corte día 30» en un gris de 12px al lado de la cédula: un número
    // del mes, no una fecha. Había que calcular de cabeza cuánto falta.
    expect(codigo).toContain('textoProximoCorte(proximoCorte.dias)')
    expect(codigo).not.toMatch(/Corte día \{linea\.diaCorte\}/)
  })

  it('se enciende cuando el corte está encima', () => {
    expect(codigo).toMatch(/proximoCorte\.dias <= 2/)
  })

  it('pinta la fecha en UTC, que es donde vive', () => {
    // `calcularProximoCorte` devuelve medianoche local expresada como T05:00Z.
    // Sin `timeZone: 'UTC'` al escribirla, un navegador en otro huso la
    // retrocede un día y el corte sale con fecha de la víspera.
    const bloque = codigo.match(/proximoCorte\.fecha\.toLocaleDateString\([^)]*\)/)[0]
    expect(bloque).toContain("timeZone: 'UTC'")
  })
})

describe('T30-04 · de cinco botones a dos', () => {
  it('habla como el prestamista', () => {
    expect(codigo).toContain('Le doy plata')
    expect(codigo).toContain('Me paga')
  })

  it('ya no dice «Desembolsar» en la barra de acciones', () => {
    // Solo se miran los botones de LA PANTALLA. Dentro de los modales
    // «Desembolsar» y «Registrar pago» siguen siendo lo correcto: ahí son el
    // botón de confirmar de un formulario, y quitarlos dejaría un «Le doy
    // plata» que abre una hoja cuyo botón dice otra cosa distinta.
    // Se ancla al `flex gap-2.5` de la barra: hay DOS bloques que empiezan por
    // `estado !== 'cerrada'` —este y la tarjeta del corte— y sin anclar, el
    // regex enganchaba la tarjeta y la prueba pasaba midiendo el bloque
    // equivocado. Comprobado: capturaba el corte.
    const barra = codigo.match(/\{linea\.estado !== 'cerrada' && \(\s*<div className="flex gap-2\.5[\s\S]*?\n      \)\}/)
    expect(barra, 'no encuentro la barra de acciones').toBeTruthy()
    expect(barra[0]).toContain('Le doy plata')
    expect(barra[0]).not.toContain('Desembolsar')
    expect(barra[0]).not.toContain('Registrar pago')
  })

  it('«Corte» no compite abajo: ya vive en su tarjeta', () => {
    expect(codigo).not.toMatch(/<Button[^>]*>\s*Corte\s*<\/Button>/)
    // pero el modal sigue accesible desde la tarjeta del corte
    expect(codigo).toContain('setModalCorte(true)')
  })

  it('sigue habiendo por dónde pagar una línea congelada', () => {
    // Congelada = no puede pedir más, pero sí paga. Si el botón de pago
    // desapareciera con el de desembolso, la línea quedaría sin forma de saldarse.
    expect(codigo).toMatch(/linea\.estado === 'activa' &&[\s\S]{0,200}Le doy plata/)
    const mePaga = codigo.match(/<Button[\s\S]{0,300}?Me paga/)[0]
    expect(mePaga).not.toMatch(/estado === 'activa' &&/)
  })
})
