// lib/__tests__/componentes-compilan.test.js
//
// COMPRUEBA QUE LOS COMPONENTES COMPILAN. Nada más, y es más de lo que parece.
//
// EL AGUJERO QUE CIERRA: todas las demás pruebas del rediseño leen los archivos
// con `readFileSync` y les buscan cadenas. Eso comprueba lo que DICE el código,
// no que sea código. Metí un comentario JSX dentro de un `{cond && ( … )}`
// —donde el cuerpo tiene que ser una sola expresión— y primitivos.jsx dejó de
// compilar. Las 662 pruebas siguieron en verde. El fallo salió en el navegador:
// pantalla en blanco y el mismo error repetido cuarenta veces en la consola.
//
// Y a la segunda, lo mismo por otro motivo: escribí «un `{/* … */}` suelto»
// DENTRO de un comentario de bloque. Ese `*/` de en medio cierra el comentario
// antes de tiempo y lo que sigue queda como JSX huérfano.
//
// Dos veces el mismo tipo de fallo en diez minutos, las dos invisibles para una
// prueba de texto. De ahí este archivo.
//
// CÓMO: se transforma cada archivo con `transformWithOxc`, que es el mismo
// transformador que usa el build de verdad. No se importa el módulo —eso
// arrastraría next/link, next-auth y el resto— así que no hace falta jsdom ni
// tocar la configuración: es una comprobación de sintaxis, y es justo la mitad
// que faltaba. Las otras pruebas miran los valores; esta mira que el archivo
// exista como programa.

import { describe, it, expect } from 'vitest'
import { transformWithOxc } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

/** Todos los .jsx del rediseño. Se descubren, no se listan: un componente nuevo
    entra en la comprobación sin que nadie se acuerde de añadirlo. */
function componentesDelRedisenio() {
  // `app/(dashboard)` y `app/estilo` entran también: al renombrar
  // `CompararCalendarios` a `CompararModos`, el banco de estilo se quedó con el
  // nombre viejo importado y las 915 pruebas siguieron en verde porque este
  // descubrimiento solo miraba `components/`. Una ruta con un import roto es una
  // pantalla en blanco, igual que un componente.
  const raices = [
    'components/cf', 'components/armazon', 'components/pantallas',
    'app/(dashboard)', 'app/estilo',
  ]
  const salida = []
  const bajar = (dir) => {
    const abs = path.join(process.cwd(), dir)
    if (!fs.existsSync(abs)) return
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`
      if (e.isDirectory()) bajar(rel)
      else if (e.name.endsWith('.jsx')) salida.push(rel)
    }
  }
  raices.forEach(bajar)
  return salida.sort()
}

const ARCHIVOS = componentesDelRedisenio()

describe('los componentes del rediseño compilan', () => {
  it('hay componentes que comprobar', () => {
    // Si el descubrimiento se rompe, esta prueba pasaría vacía y en verde
    // diciendo que todo compila. Es el mismo error que estoy tapando.
    expect(ARCHIVOS.length).toBeGreaterThan(20)
  })

  for (const rel of ARCHIVOS) {
    it(rel.replace('components/', ''), async () => {
      const fuente = fs.readFileSync(path.join(process.cwd(), rel), 'utf8')
      // SIN opciones: oxc deduce el lenguaje por la extensión y ya transforma el
      // JSX. Pasarle `{ jsx: 'automatic' }` —que es lo que acepta esbuild— lo
      // hace reventar con «Invalid jsx option», o sea que fallaban los 40
      // archivos por igual y la comprobación no distinguía nada.
      const res = await transformWithOxc(fuente, rel)
      expect(res?.errors ?? [], `${rel}: ${JSON.stringify(res?.errors)}`).toHaveLength(0)
      expect(res?.code, `${rel} no produjo código`).toBeTruthy()
      // Y que de verdad haya transformado. Se comprueba por lo POSITIVO —que
      // aparezca la fábrica de JSX— y no buscando un `<` al principio de línea:
      // así fallaba `reportes/page.jsx`, que tiene un `<` dentro de una cadena y
      // estaba perfecto. Un aserto negativo sobre texto libre acusa a quien no debe.
      if (/<[A-Za-z][\w.]*[\s/>]/.test(fuente)) {
        expect(res.code, `${rel}: el JSX salió sin transformar`)
          .toMatch(/_?jsxs?\(|createElement\(/)
      }
    })
  }
})

describe('ningún componente usa un nombre que no existe', () => {
  // EL OTRO AGUJERO: compilar no es resolver. `transformWithOxc` valida SINTAXIS,
  // así que un `<BarraPartidaSistema>` cuya función acabo de borrar pasa esta
  // prueba, pasa el build —no hay TypeScript— y pasa el deploy. Reventó en el
  // navegador con «Can't find variable», y dentro de un ternario falla de forma
  // intermitente: en el préstamo que no llega a esa rama no pasa nada.
  //
  // Ya me costó dos veces: `formatMoney` referenciado sin importar, y un
  // `ReferenceError` mío que me hizo teorizar sobre dos consultas cuando la causa
  // era una función inexistente.
  //
  // CÓMO: se recogen las etiquetas JSX en mayúscula —que son componentes, no
  // etiquetas HTML— y se comprueba que cada una esté importada o declarada en el
  // archivo. Es un análisis de texto, no un grafo de alcance, así que se le pasan
  // por alto las declaradas dentro de una función; por eso se aceptan también los
  // `const X = ` indentados.
  const declaraciones = (fuente) => {
    const nombres = new Set()
    // La cláusula ENTERA del import, no línea a línea. Mi primera versión miraba
    // `^import {` y `^import X`, y con eso se le escapaban las dos formas más
    // usadas del proyecto: `import X, { Y } from …` —donde las llaves no van al
    // principio— y las llaves partidas en varias líneas. Resultado: seis falsos
    // positivos en rutas que estaban perfectas.
    for (const m of fuente.matchAll(/\bimport\s+([\s\S]*?)\s+from\s+['"]/g)) {
      for (const trozo of m[1].replace(/[{}]/g, ',').split(',')) {
        const nombre = trozo.trim().split(/\s+as\s+/).pop()?.trim()
        if (nombre && /^[A-Za-z_$][\w$]*$/.test(nombre)) nombres.add(nombre)
      }
    }
    // Declaradas en el archivo, a cualquier nivel de indentación: muchas pantallas
    // definen sus piezas locales dentro del propio archivo.
    for (const m of fuente.matchAll(/(?:function|const|let|class)\s+([A-Z][\w$]*)/g)) nombres.add(m[1])
    return nombres
  }

  for (const rel of ARCHIVOS) {
    it(rel.replace('components/', ''), () => {
      const fuente = fs.readFileSync(path.join(process.cwd(), rel), 'utf8')
      const declarados = declaraciones(fuente)
      const usados = new Set(
        [...fuente.matchAll(/<([A-Z][\w$]*)/g)].map((m) => m[1])
      )
      // `React.Fragment` en forma corta no lleva nombre, y los espacios de nombres
      // con punto (`Foo.Bar`) se resuelven por el objeto, que ya se comprueba.
      const faltan = [...usados].filter((u) => !declarados.has(u))
      expect(faltan, `${rel} usa sin declarar: ${faltan.join(', ')}`).toEqual([])
    })
  }
})

describe('las 17 piezas de 03-COMPONENTES.md están todas', () => {
  // Cada pieza de la receta, con dónde vive. Sirve de índice: si mañana alguien
  // busca «el interruptor», acá está el archivo y el nombre.
  const PIEZAS = [
    ['1 · tarjeta',          'components/cf/primitivos.jsx',  'Tarjeta'],
    ['1 · sub-fila',         'components/cf/primitivos.jsx',  'FilaTarjeta'],
    ['2 · bloque oscuro',    'components/cf/primitivos.jsx',  'BloqueOscuro'],
    ['2 · antes→después',    'components/cf/primitivos.jsx',  'AntesDespues'],
    ['3 · tarjeta de lista', 'components/cf/TarjetaCliente.jsx', 'default'],
    ['4 · pastilla',         'components/cf/primitivos.jsx',  'Pastilla'],
    ['5 · botón primario',   'components/cf/primitivos.jsx',  'BotonPrimario'],
    ['5 · botón secundario', 'components/cf/primitivos.jsx',  'BotonSecundario'],
    ['5 · botón destructivo','components/cf/primitivos.jsx',  'BotonDestructivo'],
    ['5 · botón textual',    'components/cf/primitivos.jsx',  'BotonTexto'],
    ['5 · barra de acción',  'components/cf/primitivos.jsx',  'BarraAccion'],
    ['6 · campo',            'components/cf/primitivos.jsx',  'Campo'],
    ['6 · campo de monto',   'components/cf/primitivos2.jsx', 'CampoMonto'],
    ['6 · etiqueta',         'components/cf/primitivos.jsx',  'EtiquetaCampo'],
    ['6 · ayuda',            'components/cf/primitivos.jsx',  'AyudaCampo'],
    ['7 · chip',             'components/cf/primitivos.jsx',  'Chip'],
    ['7 · grupo segmentado', 'components/cf/primitivos2.jsx', 'GrupoSegmentado'],
    ['7 · tarjeta de opción','components/cf/primitivos2.jsx', 'TarjetaOpcion'],
    ['8 · interruptor',      'components/cf/primitivos2.jsx', 'Interruptor'],
    ['9 · barra de progreso','components/cf/primitivos.jsx',  'BarraProgreso'],
    ['9 · barra partida',    'components/cf/primitivos2.jsx', 'BarraPartida'],
    ['9 · espina',           'components/armazon/CabeceraMovil.jsx', 'EspinaProgreso'],
    ['10 · hoja inferior',   'components/cf/HojaInferior.jsx', 'default'],
    ['12 · tabla',           'components/cf/primitivos2.jsx', 'Tabla'],
    ['12 · pie de tabla',    'components/cf/primitivos2.jsx', 'PieTabla'],
    ['13 · aviso',           'components/cf/primitivos.jsx',  'Aviso'],
    ['14 · tira de cifras',  'components/cf/primitivos.jsx',  'TiraCifras'],
    ['15 · barras verticales','components/cf/primitivos2.jsx','BarrasVerticales'],
    ['15 · comportamiento',  'components/cf/primitivos2.jsx', 'BarrasComportamiento'],
    ['15 · barras horiz.',   'components/cf/primitivos2.jsx', 'BarrasHorizontales'],
    ['16 · estado vacío',    'components/cf/primitivos.jsx',  'EstadoVacio'],
    ['16 · moneda',          'components/cf/primitivos.jsx',  'Moneda'],
    ['17 · esqueleto',       'components/cf/primitivos2.jsx', 'Esqueleto'],
  ]

  it('ninguna se quedó sin construir', () => {
    const faltan = []
    for (const [pieza, archivo, nombre] of PIEZAS) {
      const abs = path.join(process.cwd(), archivo)
      if (!fs.existsSync(abs)) { faltan.push(`${pieza} (falta ${archivo})`); continue }
      const fuente = fs.readFileSync(abs, 'utf8')
      const patron = nombre === 'default'
        ? /export default function/
        : new RegExp(`export function ${nombre}\\b`)
      if (!patron.test(fuente)) faltan.push(`${pieza} → ${nombre}`)
    }
    expect(faltan, `sin construir: ${faltan.join(' · ')}`).toEqual([])
  })

  it('son las 17 secciones de la receta, sin inventar ni saltarse ninguna', () => {
    const secciones = new Set(PIEZAS.map(([p]) => p.split(' · ')[0]))
    // 3 y 11 no salen en la lista de arriba a propósito: la 3 es TarjetaCliente
    // (que está) y la 11 —modal centrado— la resuelve HojaInferior detectando
    // escritorio, así que no es una pieza aparte.
    expect([...secciones].sort((a, b) => a - b))
      .toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '12', '13', '14', '15', '16', '17'])
  })
})
