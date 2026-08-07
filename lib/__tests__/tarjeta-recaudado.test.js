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

/* Desde `CajaOscura` —la caja que comparten los dos bloques— hasta las tarjetas
   blancas. Antes empezaba en `function Hero`, y al sacar la caja a su propio
   componente estas pruebas se cayeron sin que nada se hubiera roto. */
const hero = src.slice(src.indexOf('function CajaOscura'), src.indexOf('function TarjetaDato'))
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

  it('lleva borde, porque en oscuro el fondo de la app es EL MISMO color', () => {
    /* `--cf-surface` en tema oscuro vale #15161A, exactamente lo que la adenda
       pide para la tarjeta: sin borde queda a ratio 1,00 contra el fondo y
       desaparece — se ve el contenido flotando sin caja.

       No es una teoría: `tokens-2026.css` ya tiene esta regla escrita, y viene
       de un reporte del dueño («el borde está del mismo color que el fondo,
       entonces no se ve como que fuese una caja»). Allí se midió que en oscuro
       el relleno no dibuja la caja y el borde tiene que hacer ese trabajo. */
    // La caja la pone `CajaOscura`, que las dos comparten.
    const i = hero.indexOf('function CajaOscura')
    expect(i, 'desapareció la caja compartida').toBeGreaterThan(-1)
    expect(hero.slice(i, i + 1400)).toMatch(/border: BORDE_BLOQUE/)
  })

  it('y el fondo de la app en oscuro sigue siendo ese color', () => {
    // Si algún día deja de serlo, el borde pasa a ser opcional y este
    // comentario deja de tener sentido: mejor que falle y se relea.
    const tokens = readFileSync(resolve(RAIZ, 'app/tokens-2026.css'), 'utf8')
    const oscuro = tokens.slice(tokens.indexOf('html[data-theme="dark"]'))
    expect(oscuro.slice(0, 200)).toMatch(/--cf-surface:\s+#15161A/)
  })
})

describe('en escritorio son DOS bloques', () => {
  it('la gráfica va en su propia caja de 392px', () => {
    /* «La gráfica sale a su propia tarjeta porque en 392px ya caben la cifra de
       la línea de meta y los nombres de los días — en 390px de móvil no
       cabían.» */
    expect(hero).toMatch(/lg:grid-cols-\[minmax\(0,1fr\)_392px\]/)
    expect(hero).toMatch(/marca="semana"/)
  })

  it('el `display` de la caja va en la CLASE, no en el `style`', () => {
    /* ⚠ ESTO SALIÓ EN PRODUCCIÓN. Estaba como `display: 'flex'` en línea, y el
       estilo en línea SIEMPRE gana a una clase: el `hidden` de la caja de la
       semana no hacía nada y la gráfica salía DOS VECES en el teléfono. Es la
       segunda vez en la misma tanda —antes fue un `display:'grid'` comiéndose
       un `hidden sm:grid`—, así que va anclado. */
    const i = hero.indexOf('function CajaOscura')
    const caja = hero.slice(i, i + 900)
    expect(caja, "`display` en el `style` vuelve a comerse el `hidden`")
      .not.toMatch(/style=\{\{[\s\S]*?display:/)
    expect(caja).toMatch(/className=\{`flex-col/)
  })

  it('y en móvil es UNA sola caja, con la gráfica dentro', () => {
    // A 393px no hay dos columnas, y una segunda tarjeta solo añadiría un borde
    // y otro título para lo mismo.
    expect(hero).toMatch(/className="lg:hidden"><Grafica \/>/)
    expect(hero).toMatch(/marca="semana" className="hidden lg:flex"/)
  })

  it('el bloque ocupa la fila ENTERA del panel', () => {
    /* No es una preferencia: medido a 1440, la columna izquierda son 766px y
       quitándole los 392 de la gráfica quedan 358 para el monto a 40px y cinco
       columnas de cifras — no caben. Con la fila entera quedan 734.
       La partición y el `col-span` van juntos: uno sin el otro no funciona. */
    expect(src).toMatch(/lg:col-span-2 lg:row-start-1[\s\S]{0,120}<Hero/)
  })

  it('y por eso el resto del panel baja una fila', () => {
    // Si esto se desordena, dos tarjetas se solapan en la misma celda.
    expect(src).toMatch(/lg:col-start-2 lg:row-start-2 lg:flex-col/)   // en caja / en mora
    expect(src).toMatch(/lg:col-start-1 lg:row-start-2"/)             // necesita tu atención
    expect(src).toMatch(/lg:col-start-2 lg:row-start-3/)               // por ruta hoy
    expect(src).toMatch(/lg:col-start-1 lg:row-start-3/)               // lo que va debajo
  })

  it('la gráfica se declara una vez y se pinta en los dos sitios', () => {
    // Duplicar el JSX era la otra salida, y peor: un día se cambia uno y el
    // otro se queda como estaba.
    expect((hero.match(/function Grafica\(\)/g) ?? []).length).toBe(1)
    expect((hero.match(/<Grafica \/>/g) ?? []).length).toBe(2)
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

  it('las barras SE PUEDEN TOCAR', () => {
    /* ⚠ SE PERDIÓ UNA VEZ. Al rehacer la tarjeta las pasé de `<button>` a
       `<span>` con `title`, y el `title` es un globo de ESCRITORIO: en el
       teléfono no hay puntero, así que la función desapareció sin dejar rastro.

       El dueño la pidió por su nombre en su día —«no es interactiva, no se le
       puede picar y ver los saldos»— y volvió a reportarlo tras el despliegue.
       La adenda quita el PIE que flotaba, no la posibilidad de tocarlas. */
    const i = hero.indexOf('barras.map((n, i)')
    const bloque = hero.slice(i, i + 1800)
    expect(bloque, 'las barras volvieron a ser `<span>`: en el móvil no se pueden tocar')
      .toMatch(/<button/)
    expect(bloque).toMatch(/onClick=\{\(\) => setDiaAbierto/)
    expect(bloque, 'sin `aria-label` la barra no dice nada a quien no la ve')
      .toMatch(/aria-label=/)
  })

  it('y al tocar una, la respuesta va a la frase, no a un pie suelto', () => {
    // El pie «Martes 4 · $565.000» es justo lo que la adenda quita: flotaba
    // abajo sin conexión con ninguna barra.
    expect(hero).toMatch(/diaAbierto != null \?/)
    expect(hero).not.toMatch(/Toca una barra para ver el día/)
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
       adivinar a qué se refiere es un dato que no está.

       ⚠ ESTA PRUEBA LLEGÓ A EXIGIR QUE NO EXISTIERA `diaAbierto`, y eso era
       pasarse: lo que la adenda quita es el PIE FLOTANTE, no la posibilidad de
       tocar las barras. Con esa lectura de más me llevé por delante una función
       que el dueño había pedido por su nombre, y tuvo que reportarla otra vez
       después del despliegue. Ahora la barra se toca y la respuesta va a la
       frase de abajo, que ya habla de la gráfica. */
    expect(hero).not.toMatch(/Toca una barra/)
    expect(hero, 'volvió el pie suelto: el dato tiene que ir en la frase')
      .not.toMatch(/\{diaDeLaSemana\(diaAbierto/)
  })

  it('y la lista de tres datos sueltos sin etiqueta', () => {
    // «2 cobrados · 14 pendientes · ayer $460.400», todos del mismo peso.
    expect(hero).not.toMatch(/cobrado\$\{cobrados === 1/)
  })
})
