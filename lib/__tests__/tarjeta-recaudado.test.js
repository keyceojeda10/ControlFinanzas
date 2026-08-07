import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── ADENDA 4 · LA TARJETA INSIGNIA DEL PANEL ───────────────────────────────
//
// Es lo primero que se ve al abrir la app. Era un bloque DORADO MACIZO, y la
// adenda lo llama por su nombre: «el fondo dorado no es un estilo, es un error
// de sistema». El dorado está reservado al monto principal, la acción primaria
// y el foco del campo activo; con el fondo entero dorado el monto queda del
// mismo color que su contenedor, el texto pierde contraste —y la hora pico de
// cobro son las 17:00, bajo sol— y las barras ámbar sobre ámbar no se ven.
//
// Esta prueba es su lista de comprobación, la que trae la adenda al final.

const RAIZ = process.cwd()
const crudo = readFileSync(resolve(RAIZ, 'components/pantallas/Panel.jsx'), 'utf8')

/* Sin comentarios: los de esta pantalla CITAN lo que corrigen —«meta del día»,
   «el fondo dorado»— y una prueba que busque esos literales se caza a sí misma.
   Se vacían conservando la longitud para no correr los números de línea. */
const src = crudo
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .split('\n').map((l) => (/^\s*(\/\/|\*)/.test(l) ? '' : l)).join('\n')

const hero = src.slice(src.indexOf('function Hero({'), src.indexOf('function TarjetaDato'))
const adaptador = readFileSync(resolve(RAIZ, 'lib/adaptadores/panel.js'), 'utf8')

describe('el contenedor', () => {
  it('es el bloque oscuro, con radio 20', () => {
    expect(hero).toMatch(/background: BLOQUE\.fondo/)
    expect(hero).toMatch(/borderRadius: 20/)
  })

  it('ningún dorado en el fondo', () => {
    expect(hero).not.toMatch(/background: 'var\(--cf-gold\)'/)
    expect(hero).not.toMatch(/background: '#F5B824'/)
  })
})

describe('el monto y su contexto', () => {
  it('34px en móvil, 40 en escritorio', () => {
    expect(hero).toMatch(/text-\[34px\] lg:text-\[40px\]/)
  })

  it('van en la MISMA línea, alineados por la base', () => {
    // La cifra manda y el contexto se apoya en ella.
    const i = hero.indexOf('text-[34px]')
    expect(hero.slice(Math.max(0, i - 400), i)).toMatch(/alignItems: 'flex-end'/)
  })

  it('dice «que toca cobrar», no «meta del día»', () => {
    /* $626.167 no es una meta: es plata que le deben hoy. Una meta es algo a lo
       que uno aspira y que se puede no alcanzar sin consecuencia; llamarlo meta
       hace que quedarse corto se sienta normal. */
    expect(hero).toMatch(/que toca cobrar/)
    expect(src).not.toMatch(/meta del d[ií]a/)
  })
})

describe('el porcentaje', () => {
  it('aparece UNA sola vez, al final de la barra', () => {
    /* Estaba dos veces: una pastilla arriba a la derecha y la barra abajo,
       diciendo lo mismo sin conexión visual entre las dos. */
    expect((hero.match(/\{porcentaje\}%/g) ?? []).length).toBe(1)
    const i = hero.indexOf('{porcentaje}%')
    expect(hero.slice(Math.max(0, i - 700), i), 'el % se separó de su barra')
      .toMatch(/background: BLOQUE\.oro/)
  })

  it('y la barra mide 11px', () => {
    expect(hero).toMatch(/height: 11/)
  })
})

describe('la tira de cifras', () => {
  it('tres columnas en móvil y cinco en escritorio, ni una más', () => {
    const i = hero.indexOf('const cifras = [')
    const bloque = hero.slice(i, hero.indexOf('].filter(Boolean)', i))
    // 5 entradas como mucho; 2 de ellas solo desde `lg`.
    expect((bloque.match(/rot:/g) ?? []).length).toBeLessThanOrEqual(5)
    expect((bloque.match(/soloAncho: true/g) ?? []).length).toBe(2)
  })

  it('«te faltan» sale de la resta, no de los textos ya formateados', () => {
    /* La adenda: «$378.167 = $626.167 − $248.000. La cifra tiene que cuadrar.»
       Por eso se resta en el adaptador, con los números en crudo. */
    expect(adaptador).toMatch(/faltan: esperado > recaudado \? formatMoney\(esperado - recaudado/)
  })

  it('en mora va en rojo y «te faltan» en oro', () => {
    const i = hero.indexOf('const cifras = [')
    const bloque = hero.slice(i, hero.indexOf('].filter(Boolean)', i))
    expect(bloque).toMatch(/'Te faltan'[\s\S]{0,80}BLOQUE\.oro/)
    expect(bloque).toMatch(/'En mora'[\s\S]{0,80}BLOQUE\.rojo/)
  })
})

describe('la gráfica de los siete días', () => {
  it('la altura del contenedor va en px, nunca flex:1', () => {
    /* Las barras miden su alto en PORCENTAJE: si el contenedor colapsa, el
       gráfico desaparece entero y no falla nada. */
    expect(hero).toMatch(/h-\[52px\] lg:h-\[96px\]/)
  })

  it('tiene la línea de lo que toca cobrar', () => {
    // Es lo que le faltaba: sin escala ni referencia, siete barras no dicen nada.
    expect(hero).toMatch(/borderTop: '1px dashed/)
    expect(hero).toMatch(/alturaLinea/)
  })

  it('la escala deja sitio a la línea aunque nadie llegue', () => {
    /* Escalando solo contra la barra más alta, la línea se sale del contenedor
       justo en el caso que más importa: la semana floja. Y con el esperado
       clavado como tope queda EN el borde, donde se lee como el marco de la
       caja y no como una referencia: de ahí el aire. */
    expect(hero).toMatch(/Math\.max\(\.\.\.barras, \(esperadoCrudo \?\? 0\) \* 1\.12, 0\)/)
  })

  it('el gráfico y el texto cuentan la MISMA historia', () => {
    /* La adenda: «si dice 3 de 7, tiene que haber exactamente 3 barras por
       encima de la línea». Por eso el conteo sale de la misma comparación con
       la que se pintan las barras, y no de un cálculo aparte. */
    expect(hero).toMatch(/barras\.filter\(\(n\) => n >= esperadoCrudo\)\.length/)
    expect(hero).toMatch(/const llego = esperadoCrudo \? n >= esperadoCrudo : false/)
  })

  it('y trae su lectura escrita', () => {
    // Un gráfico que necesita interpretación no informa; uno que trae su
    // lectura sí.
    expect(hero).toMatch(/Cobraste todo/)
    expect(hero).toMatch(/La línea es lo que toca cada día/)
  })
})

describe('lo que desaparece', () => {
  it('el pie «Martes 4 · $565.000»', () => {
    /* Era la etiqueta de la barra seleccionada, pero flotaba abajo a la
       izquierda sin conexión visible con ninguna barra. Un dato que hay que
       adivinar a qué se refiere es un dato que no está. */
    expect(hero).not.toMatch(/Toca una barra/)
    expect(hero).not.toMatch(/diaAbierto/)
  })

  it('y la lista de tres datos sueltos sin etiqueta', () => {
    // «2 cobrados · 14 pendientes · ayer $460.400», todos del mismo peso.
    expect(hero).not.toMatch(/cobrado\$\{cobrados === 1/)
  })
})
