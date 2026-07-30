import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = process.cwd()
const menu = readFileSync(join(RAIZ, 'components/pantallas/MenuMas.jsx'), 'utf8')
const cuerpo = menu.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/* ══════════════════════════════════════════════════════════════════════════
   T43-01. Las mismas nueve opciones de antes, agrupadas por lo que le pasa a
   la plata. Lo que estas pruebas defienden es que no vuelvan a ser una lista
   plana de nueve verbos, y que las acciones no se confundan con los destinos.
   ══════════════════════════════════════════════════════════════════════════ */

describe('las acciones y los destinos no se parecen', () => {
  it('los destinos van en rejilla de dos y sin flecha', () => {
    // «Registrar un pago» hace algo; «ver la caja» solo lleva. Si las dos son una
    // fila blanca con flecha, compiten como si fueran lo mismo.
    const i = cuerpo.indexOf('function Destinos')
    const j = cuerpo.indexOf('export default function MenuMas')
    const destinos = cuerpo.slice(i, j)
    expect(destinos).toMatch(/slice\(fila \* 2, fila \* 2 \+ 2\)/)
    expect(destinos).not.toMatch(/<Chevron/)
  })

  it('las acciones sí llevan flecha', () => {
    const i = cuerpo.indexOf('function Accion')
    const j = cuerpo.indexOf('function Grupo')
    expect(cuerpo.slice(i, j)).toMatch(/<Chevron \/>/)
  })

  it('los destinos son más bajos que las acciones', () => {
    expect(cuerpo).toMatch(/height: 52, padding: '0 14px'/)      // destino
    expect(cuerpo).toMatch(/height: cifra \? 62 : 56/)            // acción
  })

  it('una rejilla impar no deja la última ocupando el doble', () => {
    expect(cuerpo).toMatch(/length === 1 && \(/)
  })
})

describe('cada opción trae su cifra', () => {
  it('la acción con cifra crece a dos líneas', () => {
    // Con la cifra al lado, un menú se vuelve un panel: el dueño decide desde
    // aquí sin entrar a mirar.
    expect(cuerpo).toMatch(/height: cifra \? 62 : 56/)
  })

  it('lo que urge se distingue del resto', () => {
    // «Vence en 5 días» no es un dato más.
    expect(cuerpo).toMatch(/d\.urgente \? 'var\(--cf-gold-text-2\)' : 'var\(--cf-ink-3\)'/)
  })
})

describe('el dorado a pantalla completa', () => {
  it('el fondo es el oro y la tinta la oscura de siempre', () => {
    // Es el momento en que la app pregunta, y es el único sitio del sistema
    // donde el oro es el fondo.
    expect(cuerpo).toMatch(/background: ORO, display: 'flex'/)
    expect(menu).toMatch(/const TINTA = 'var\(--cf-gold-ink\)'/)
  })

  it('cerrar es carbón con la X dorada, no otro dorado', () => {
    // Sobre un fondo de oro, lo único que se distingue es lo oscuro.
    expect(cuerpo).toMatch(/background: '#15161A', border: 0/)
    expect(cuerpo).toMatch(/stroke="#F5B824"/)
  })

  it('las tarjetas dejan pasar algo de oro', () => {
    // A blanco puro se leen como agujeros, no como algo puesto encima.
    expect(menu).toMatch(/const TARJETA = 'rgba\(255,255,255,\.92\)'/)
  })
})

describe('Lucas no es un parche', () => {
  it('es una tarjeta blanca como las demás', () => {
    // La versión anterior le ponía un círculo carbón encima del dorado: dos
    // oscuros distintos peleando sobre el mismo fondo.
    const i = cuerpo.indexOf('{lucas && (')
    const bloque = cuerpo.slice(i, i + 1400)
    expect(bloque).toMatch(/background: TARJETA/)
    expect(bloque).toMatch(/<Icono destacado>/)
    expect(bloque).not.toMatch(/#15161A/)
  })

  it('el ejemplo va entre comillas y enseña qué preguntarle', () => {
    // Sin él, «preguntarle a Lucas» no dice de qué se le puede hablar.
    expect(cuerpo).toMatch(/“\{lucas\.ejemplo\}”/)
  })
})

describe('lo que no está, y es a propósito', () => {
  it('«nueva ruta» no aparece en el menú', () => {
    // La lámina no la pone: crear una ruta se hace desde la lista de rutas, con
    // su botón «Nuevo», no desde el menú de «qué voy a hacer ahora». Una ruta no
    // se crea a diario; un pago sí.
    expect(cuerpo).not.toMatch(/[Nn]ueva ruta/)
    // Y la decisión queda escrita para que no se «arregle» sin pensarlo.
    expect(menu).toMatch(/«Nueva ruta» no aparece/)
  })

  it('los grupos y los destinos llegan por prop: la pantalla no los inventa', () => {
    // Las cifras salen de datos reales; una opción con una cifra escrita a mano
    // es la forma más rápida de que el menú mienta.
    expect(cuerpo).toMatch(/grupos = \[\]/)
    expect(cuerpo).toMatch(/destinos = \[\]/)
  })

  it('no hay emojis: los iconos son SVG', () => {
    expect(menu).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u)
  })
})
