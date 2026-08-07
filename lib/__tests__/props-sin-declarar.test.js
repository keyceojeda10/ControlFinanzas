import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { globSync } from 'node:fs'

/* ⚠ ESTO DEJO LAS RUTAS MUERTAS EN PRODUCCION.
   «Can't find variable: onCerrarVisita» al abrir cualquier ruta.

   Yo añadi el boton que usa `onCerrarVisita` y el reemplazo que lo metia en la
   firma buscaba «  cerradaPorHoy…» con dos espacios, cuando el texto real lleva
   «abonoHoy, » delante. No caso, NO LO COMPROBE, y la prop quedo usada sin
   recibirse.

   NO LO CAZA NADA DE LO QUE HABIA:
     · `next build` compila: es JSX valido, el error es en ejecucion.
     · No hay TypeScript.
     · Mi propia prueba miraba que el USO existiera en el fichero — y existia.
       Comprobaba el sitio equivocado.

   Un componente solo revienta cuando se pinta la rama que usa la variable, asi
   que puede pasar el despliegue entero y caer en la calle. Ya paso antes con
   otra prop; por eso esto barre TODAS. */

const COMPONENTES = [
  'components/cf/ParadaDeCobro.jsx',
  'components/cf/TarjetaCliente.jsx',
  'components/pantallas/CobrarHoy.jsx',
  'components/pantallas/DetalleRuta.jsx',
  'components/pantallas/Panel.jsx',
  'components/pantallas/ListaRutas.jsx',
]

/** Las props que declara la firma desestructurada de cada `function X({…})`. */
function analizar(src) {
  const fuera = []
  const nombres = [...src.matchAll(/function (\w+)\(\{/g)]
  for (let i = 0; i < nombres.length; i++) {
    const m = nombres[i]
    const abre = src.indexOf('{', m.index + m[0].length - 1)
    let n = 0, j = abre
    for (; j < src.length; j++) {
      if (src[j] === '{') n++
      else if (src[j] === '}') { n--; if (n === 0) break }
    }
    const firma = src.slice(abre + 1, j)
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    const declara = new Set(firma.split(',').map((x) => x.split('=')[0].trim()).filter(Boolean))
    const fin = i + 1 < nombres.length ? nombres[i + 1].index : src.length
    const cuerpo = src.slice(j, fin)
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    /* Solo los manejadores `onAlgo`: son los que se pasan por props y los que
       en la practica se olvidan.

       ⚠ FUERA LOS NOMBRES DE ATRIBUTO. En `<Ordenes onCambiar={onOrden} />` el
       `onCambiar` es una prop DEL HIJO, no una variable que este componente
       lea: contarlo daba dos falsos positivos, y un barredor que grita donde no
       hay nada acaba ignorandose. Lo que se busca son las LECTURAS —el
       `onCerrarVisita` de `{onCerrarVisita && …}`—, asi que se quita lo que va
       seguido de `=`. El valor de dentro (`{onOrden}`) se conserva. */
    const lecturas = cuerpo.replace(/\bon[A-Z]\w*(?=\s*=)/g, '')
    const usadas = [...new Set([...lecturas.matchAll(/\b(on[A-Z]\w+)\b/g)].map((x) => x[1]))]
    for (const v of usadas) {
      if (declara.has(v)) continue
      if (/^on(Click|Change|Blur|Focus|Submit|KeyDown|KeyUp|Input|Scroll|Load|Error|TouchStart|TouchMove|TouchEnd|DragStart|DragOver|DragEnd|Drop|MouseDown|MouseUp|MouseEnter|MouseLeave|Wheel|Paste|Copy|Cut|ContextMenu|Animation\w*|Transition\w*)$/.test(v)) continue
      fuera.push(`${m[1]} usa ${v} y no lo recibe`)
    }
  }
  return fuera
}

describe('ninguna prop se usa sin recibirse', () => {
  for (const ruta of COMPONENTES) {
    it(ruta.split('/').pop(), () => {
      const src = readFileSync(resolve(process.cwd(), ruta), 'utf8')
      expect(analizar(src)).toEqual([])
    })
  }

  it('el barredor caza de verdad el fallo que hubo', () => {
    // Sin esta comprobacion, un barredor que no encuentre nada se lee igual que
    // uno que funciona. Ya me paso con `barrer-margen-doble.mjs`, que no
    // encontro ni un fallo real porque no resolvia los imports.
    const roto = `
      function Ficha({ nombre, onReabrir }) {
        return <div>{onCerrarVisita && <button onClick={onCerrarVisita}>x</button>}</div>
      }`
    expect(analizar(roto)).toEqual(['Ficha usa onCerrarVisita y no lo recibe'])
  })

  it('y no se inventa fallos con los eventos del DOM', () => {
    const sano = `
      function Ficha({ nombre, onGuardar }) {
        return <input onChange={onGuardar} onKeyDown={() => {}} onMouseEnter={() => {}} />
      }`
    expect(analizar(sano)).toEqual([])
  })
})
