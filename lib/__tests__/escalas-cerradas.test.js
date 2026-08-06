import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'

// ── LAS ESCALAS SON CERRADAS, Y ESTO LO COMPRUEBA ───────────────────────────
//
// `CF Diseño 2026/design_handoff_control_finanzas/11-ESCALAS-Y-CONSISTENCIA.md`:
//
//   «Las escalas son CERRADAS. Solo existen los valores de estas tablas. Si
//    necesitas un tamaño que no está, no interpoles: usa el más cercano.»
//
// El dueño lo reportó así: «botones con tamaños, alturas, radios, colores o
// espaciados diferentes sin justificación… genera la sensación de que son dos
// aplicaciones distintas».
//
// Medido antes de escribir esta prueba:
//   · 235 usos de tamaños de fuente intermedios (12.5, 13.5, 11.5…)
//   · 127 usos de texto por debajo de 10px — ilegible de pie, en la calle
//   · 144 usos de `rounded-[8px]`, que no está en la escala
//   · el `<Button>` base salía a 44px por defecto: una altura que no existe
//
// ⚠ ESTA PRUEBA NO ARREGLA EL PASADO. Fija un TECHO por fichero para que la
// deuda no crezca, y comprueba al peso los componentes base —que son los que
// multiplican—. Bajar los techos es el trabajo de limpieza, uno a uno.

const RAIZ = process.cwd()

function jsxDe(dir, acc = []) {
  for (const e of readdirSync(join(RAIZ, dir))) {
    const rel = `${dir}/${e}`
    if (e === 'node_modules' || e === '.next' || e === '.claude') continue
    const st = statSync(join(RAIZ, rel))
    if (st.isDirectory()) jsxDe(rel, acc)
    else if (e.endsWith('.jsx')) acc.push(rel)
  }
  return acc
}
const FICHEROS = [...jsxDe('app'), ...jsxDe('components')]
const contar = (re) => FICHEROS.reduce((n, f) => {
  const m = readFileSync(join(RAIZ, f), 'utf8').match(re)
  return n + (m ? m.length : 0)
}, 0)

describe('los componentes BASE cumplen la escala', () => {
  // Son los que multiplican: 90 de 127 usos de `<Button>` no pasan `size`.
  const boton = readFileSync(resolve(RAIZ, 'components/ui/Button.jsx'), 'utf8')
  const input = readFileSync(resolve(RAIZ, 'components/ui/Input.jsx'), 'utf8')

  it('el botón no tiene alturas inventadas', () => {
    // `h-9` = 36px y `h-11` = 44px no están en 76·74·56·52·48·42·40·38·34.
    expect(boton, 'volvió el h-9 (36px), que no existe en la escala').not.toMatch(/sizes = \{[^}]*h-9/s)
    expect(boton, 'volvió el h-11 (44px), que no existe en la escala').not.toMatch(/sizes = \{[^}]*h-11/s)
  })

  it('y sus tres tamaños son los del sistema', () => {
    expect(boton).toMatch(/sm: 'h-12/)        // 48 · dentro de una tarjeta
    expect(boton).toMatch(/md: 'h-\[52px\]/)  // 52 · primario normal
    expect(boton).toMatch(/lg: 'h-14/)        // 56 · remate de flujo
  })

  it('el radio del botón es 14, no 12', () => {
    // 12 es el radio del botón de ICONO. §2 asigna 14 al primario y secundario.
    expect(boton).toMatch(/rounded-\[14px\]/)
  })

  it('la etiqueta de campo no usa un tamaño intermedio', () => {
    // `text-[12.5px]` se propagaba a TODOS los formularios de la app.
    // ⚠ SOBRE EL CÓDIGO, sin comentarios: el aviso que explica QUÉ se quitó
    // menciona el 12.5 y la prueba se cazaba a sí misma. Enésima vez en este
    // proyecto — está anotado igual en `caja-cotejo.test.js`.
    const codigo = input.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(codigo, 'volvió el 12.5, que no está en la escala').not.toMatch(/text-\[12\.5px\]/)
    expect(input).toMatch(/const labelCls = 'text-\[12px\]/)
  })

  it('el campo mide 56px, que es lo que dice §3', () => {
    expect(input, 'volvió el h-11 (44px)').not.toMatch(/cf-input[^']*h-11/)
    expect(input).toMatch(/cf-input w-full h-14 rounded-\[14px\]/)
  })
})

describe('la deuda de escalas no crece', () => {
  /* Techos medidos el 5 ago 2026. Si una prueba falla porque el número BAJÓ,
     baja el techo aquí: es progreso y hay que fijarlo. Si falla porque subió,
     alguien metió un valor fuera de escala. */

  it('texto por debajo de 10px: no más de los que ya hay', () => {
    // 10px es el mínimo, y solo en mayúsculas con letter-spacing. Por debajo no
    // se lee de pie, en la calle, que es donde se usa esta app.
    const n = contar(/text-\[[0-9](\.[0-9])?px\]/g)
    expect(n, `hay ${n} usos de texto <10px (el techo era 129)`).toBeLessThanOrEqual(129)
  })

  it('tamaños de fuente con decimales: tampoco', () => {
    // La escala tiene siete valores y ninguno lleva coma.
    const n = contar(/(text-\[[0-9]+\.[0-9]+px\]|fontSize: [0-9]+\.[0-9]+)/g)
    expect(n, `hay ${n} tamaños intermedios (el techo era 292)`).toBeLessThanOrEqual(292)
  })

  it('radios fuera de escala: tampoco', () => {
    // 8px y 6px no están en 20·18·16·14·13·12·11·10.
    const n = contar(/rounded-\[[4-9]px\]/g)
    expect(n, `hay ${n} radios de 4–9px (el techo era 205)`).toBeLessThanOrEqual(205)
  })
})

describe('la regla del 999px', () => {
  it('está documentada donde se decide', () => {
    /* `border-radius: 999px` es SOLO para avatar, punto de estado, pastilla,
       barra de progreso y el botón + de la barra inferior. Un botón de acción
       nunca es circular: la estética del sistema es cuadrado redondeado.

       Hay 92 botones que lo incumplen. No se arreglan de golpe —muchos son
       botones de icono de 28-32px que además incumplen la altura— pero la regla
       queda escrita donde se lee antes de crear uno nuevo. */
    const design = readFileSync(resolve(RAIZ, 'DESIGN.md'), 'utf8')
    expect(design).toMatch(/11-ESCALAS-Y-CONSISTENCIA\.md/)
    expect(design).toMatch(/Las escalas son cerradas/i)
  })
})
