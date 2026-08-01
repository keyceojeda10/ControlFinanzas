// ── UN BOTON SIN MANEJADOR NO DA ERROR: SOLO NO HACE NADA ──
//
// La lupa de la cabecera estuvo muerta todo el rediseño. `CabeceraMovil` la
// pintaba con `onClick={onBuscar}` y NADIE pasaba `onBuscar`: ni `Armazon` en
// movil ni `layout.jsx` en escritorio. React acepta `onClick={undefined}` sin
// una sola queja, asi que no hay error en consola, no falla el build y ninguna
// prueba de logica lo ve. Solo se descubre pulsando.
//
// La campana tuvo exactamente el mismo fallo y se apaño con `?? abrirAvisos`.
// Dos veces el mismo bug es un patron, no un descuido: los controles del
// armazon se montan desde DOS sitios distintos —`Armazon.jsx` en movil,
// `layout.jsx` en escritorio— y ninguno pasa el juego completo de props.
//
// LA REGLA: cada `onClick={onAlgo}` del armazon tiene que llevar a algun sitio.
// O alguien le pasa la prop, o el propio componente trae su destino por defecto
// con `?? hacerAlgo`. Lo que no vale es esperar a que el que lo monte se acuerde.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const CHROME = ['components/armazon/CabeceraMovil.jsx', 'components/armazon/BarraLateral.jsx']

// Quien monta el armazon. Si una prop se pasa aqui, el boton esta vivo.
const MONTADORES = [
  'components/armazon/Armazon.jsx',
  'app/(dashboard)/layout.jsx',
]

const leer = (p) => readFileSync(join(process.cwd(), p), 'utf8')

/** Sin comentarios: el texto de un comentario no es codigo que se ejecute. */
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** Los `onClick={onAlgo}` pelados: una prop y nada mas, sin `??` ni flecha. */
function pelados(fuente) {
  const fuera = []
  const re = /onClick=\{([^}]*)\}/g
  let m
  while ((m = re.exec(fuente)) !== null) {
    const h = m[1].trim()
    if (/^on[A-Z]\w*$/.test(h)) fuera.push(h)
  }
  return [...new Set(fuera)]
}

describe('los controles del armazon tienen a donde ir', () => {
  const montadores = MONTADORES.map(leer).join('\n')

  for (const archivo of CHROME) {
    it(`${archivo.split('/').pop()}: ningun boton se queda sin destino`, () => {
      const fuente = sinComentarios(leer(archivo))
      const huerfanos = pelados(fuente).filter((prop) => {
        // Alguien de fuera se la pasa al montar → vivo.
        if (montadores.includes(`${prop}={`)) return false
        // O se la pasa un componente del propio archivo → vivo.
        if (new RegExp(`${prop}=\\{`).test(fuente)) return false
        return true
      })
      expect(
        huerfanos,
        `botones que se pulsan y no hacen nada en ${archivo}: ${huerfanos.join(', ')}. ` +
        'Dale un destino por defecto con `?? hacerAlgo`, o pasa la prop al montarlo.',
      ).toEqual([])
    })
  }

  it('la lupa dispara el evento que escucha el buscador', () => {
    // Los dos extremos del cable, por su nombre exacto. Si alguien renombra un
    // lado y no el otro, la lupa vuelve a quedarse muda sin que nada falle.
    for (const archivo of CHROME) {
      expect(leer(archivo), archivo).toContain("dispatchEvent(new Event('cf:abrir-buscador'))")
    }
    expect(leer('components/layout/GlobalSearch.jsx'))
      .toContain("addEventListener('cf:abrir-buscador'")
  })

  it('la campana sigue disparando el suyo', () => {
    expect(leer('components/armazon/CabeceraMovil.jsx'))
      .toContain("dispatchEvent(new Event('cf:abrir-avisos'))")
    expect(leer('components/armazon/PilaAvisos.jsx'))
      .toContain("addEventListener('cf:abrir-avisos'")
  })
})
