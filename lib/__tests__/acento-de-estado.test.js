import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { inicialesDe } from '@/lib/adaptadores/cobros'

// ── ADENDA 5 · E10 · EL ACENTO DE ESTADO ───────────────────────────────────
//
// «El estado lo llevan los elementos que ya identifican a la fila — nunca uno
// añadido para pintarlo.»
//
//   Cliente (tiene avatar) → anillo de 2px en el avatar + barra a sangre abajo
//   Préstamo (sin avatar)  → solo la barra a sangre
//
// El riel lateral se va: la tarjeta ya decía el estado tres veces —la pastilla,
// la cifra de atraso en rojo y el progreso— y el riel era el cuarto y el único
// sin dato. Además iba pegado al borde con esquinas rectas, peleando con el
// radio de la tarjeta.
//
// ⚠ «Dos acentos solo conviven si dicen cosas distintas»: el anillo dice CÓMO
// ESTÁ y la barra CUÁNTO LLEVA PAGADO. Si los dos dijeran lo mismo, sobraría
// uno — y ahí volvería el problema del riel.

const RAIZ = process.cwd()
const crudo = readFileSync(resolve(RAIZ, 'components/cf/ParadaDeCobro.jsx'), 'utf8')

// ⚠ La tarjeta salio de CobrarHoy.jsx a components/cf/ParadaDeCobro.jsx cuando
// /rutas/[id] tuvo que pintar la MISMA parada. Esta prueba mira el modulo
// compartido, asi que ahora cubre las dos pantallas de una vez.
const src = crudo
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .split('\n').map((l) => (/^\s*(\/\/|\*)/.test(l) ? '' : l)).join('\n')

const fila = src.slice(src.indexOf('function FilaCobro'), src.indexOf('function AccionParada'))

describe('la tarjeta de cobro', () => {
  it('ya no lleva riel lateral', () => {
    expect(fila, 'volvió el filete pegado al borde izquierdo')
      .not.toMatch(/position: 'absolute', left: 0, top: 12, bottom: 12/)
  })

  it('el estado va en el anillo del avatar', () => {
    const i = fila.indexOf('{iniciales}')
    expect(i).toBeGreaterThan(-1)
    expect(fila.slice(Math.max(0, i - 600), i)).toMatch(/border: `2px solid \$\{color\}`/)
  })

  it('el avatar no se puede aplastar', () => {
    /* De la lista de comprobación de la adenda: «todo contenedor de avatar
       lleva flex:none + min-width + min-height + aspect-ratio:1». Sin eso se
       vuelve un óvalo en cuanto el nombre de al lado es largo, y con el anillo
       puesto un óvalo se ve roto. */
    const i = fila.indexOf('{iniciales}')
    const avatar = fila.slice(Math.max(0, i - 600), i)
    for (const pieza of ["flex: 'none'", 'minWidth: 40', 'minHeight: 40', "aspectRatio: '1'"]) {
      expect(avatar, `al avatar le falta ${pieza}`).toContain(pieza)
    }
  })

  it('y la barra a sangre va al pie, sin poder encogerse', () => {
    /* «Toda barra lleva flex:none.» La tarjeta es una columna flex: sin él, la
       barra se encoge hasta desaparecer cuando el contenido de arriba pide
       sitio, y el fallo es invisible —no rompe nada, solo deja de estar—. */
    const i = fila.indexOf("margin: '0 -16px'")
    expect(i, 'no encuentro la barra a sangre').toBeGreaterThan(-1)
    expect(fila.slice(Math.max(0, i - 200), i)).toMatch(/flex: 'none'/)
  })

  it('la barra sale del padding con margen negativo', () => {
    // Sin él quedaría un renglón de color flotando con 16px de aire a cada
    // lado: se lee como un elemento más, no como el borde de la tarjeta.
    const i = src.indexOf("padding: '14px 16px 0 16px'")
    expect(i, 'la tarjeta recuperó el hueco de abajo y la barra deja de ir a sangre')
      .toBeGreaterThan(-1)
  })
})

describe('los dos acentos dicen cosas distintas', () => {
  it('el dato de la barra no es el mismo que el de «cumple»', () => {
    /* `cumplimiento` mira solo las cuotas YA vencidas; `pagadoPct` mira el
       préstamo entero. Un cliente recién prestado puede cumplir al 100%
       llevando pagado el 4%. */
    const api = readFileSync(resolve(RAIZ, 'app/api/cobros-hoy/route.js'), 'utf8')
    expect(api).toMatch(/pagadoPct:/)
    expect(api).toMatch(/pagadoAcum \/ totalAcum/)
    expect(api).toMatch(/cuotasPagadasSum \/ cuotasVencidas/)
  })

  it('y el adaptador lo pasa a la tarjeta', () => {
    /* El hilo entero: API → adaptador → componente. Ya me pasó tener el dato en
       el API y en el componente sin que nadie los uniera. */
    const ad = readFileSync(resolve(RAIZ, 'lib/adaptadores/cobros.js'), 'utf8')
    expect(ad).toMatch(/pagadoPct: c\.pagadoPct/)
    expect(src).toMatch(/pagadoPct/)
  })

  it('la barra nunca se sale de su pista', () => {
    // Con un recargo el total sube, pero un pago adelantado puede dejar la
    // razón por encima de 1.
    const api = readFileSync(resolve(RAIZ, 'app/api/cobros-hoy/route.js'), 'utf8')
    const i = api.indexOf('pagadoPct:')
    expect(api.slice(i, i + 200)).toMatch(/Math\.min\(100/)
  })
})

describe('las iniciales del avatar', () => {
  /* Los clientes se nombran a mano y muchos llevan delante un emoji o el
     número de orden. Con el avatar plano no se notaba; en cuanto la adenda le
     puso el anillo, pasó a ser lo primero que se mira de cada fila. */
  // Se prueba la función directamente en vez de adivinar la forma que devuelve
  // el adaptador: la primera versión de esto montaba el objeto entero y fallaba
  // por la ruta de acceso, no por las iniciales.
  const iniciales = inicialesDe

  it('se saltan el emoji y el número de orden', () => {
    // «💸 02 CARLOS MENDOZA» daba «💸0», y encima partido: `[0]` sobre un emoji
    // devuelve MEDIA unidad de código y sale el rombo de carácter roto.
    expect(iniciales('💸 02 CARLOS MENDOZA')).toBe('CM')
  })

  it('y funcionan con un nombre normal', () => {
    expect(iniciales('Carlos Mendoza')).toBe('CM')
    expect(iniciales('Ángela Ñuñez')).toBe('ÁÑ')
  })

  it('sin partir un carácter por la mitad', () => {
    // Si TODAS las partes empiezan por emoji se usan igualmente, pero enteras.
    const r = iniciales('💸 🏠')
    expect(r).not.toMatch(/�/)
    expect([...r].length).toBeLessThanOrEqual(2)
  })
})
