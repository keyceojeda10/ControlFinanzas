// Las pantallas que guardan solas no pueden guardar AL MONTARSE.
//
// ── POR QUÉ EXISTE ─────────────────────────────────────────────────────────
//
// «Cómo prestas» borró la configuración de la organización solo con abrir la
// pantalla. Medido contra la base local: pasó de «diario · 20% · fijo» a null
// sin que nadie tocara un campo.
//
// La causa es un patrón que parece correcto y no lo es:
//
//     const primera = useRef(true)
//     useEffect(() => {
//       if (primera.current) { primera.current = false; return }
//       ...guardar()
//     }, [campos])
//
// React monta dos veces en desarrollo. El primer pase se come la guarda y el
// segundo ya se cree una edición del usuario. Si además el componente se sembró
// antes de que llegaran los datos —que es lo que pasaba—, lo que se guarda es
// la pantalla vacía ENCIMA de lo que sí había.
//
// En producción no hay doble montaje, pero la otra cara del mismo fallo sí
// llega: la pantalla enseña vacío para siempre, y al tocar un solo campo se
// guarda ese vacío. Peor que no guardar, porque no se nota.
//
// La forma correcta es comparar contra la firma de lo último guardado: así un
// montaje no puede contar como edición, haya los pases que haya.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const RAIZ = path.join(process.cwd(), 'components')

function jsx(dir, salida = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) jsx(p, salida)
    else if (e.name.endsWith('.jsx')) salida.push(p)
  }
  return salida
}

describe('autoguardado', () => {
  it('ningún componente usa una guarda de «primer render» para no guardar al montarse', () => {
    const culpables = []

    for (const archivo of jsx(RAIZ)) {
      const src = fs.readFileSync(archivo, 'utf8')
      // Solo interesa lo que ESCRIBE: un PATCH/POST dentro del archivo.
      if (!/method:\s*['"](PATCH|POST|PUT)['"]/.test(src)) continue

      // El patrón: un ref sembrado en true que se apaga y corta el efecto.
      // Se busca sobre el código sin comentarios, para que explicar el fallo
      // en una cabecera —como hacen los dos que ya se arreglaron— no lo marque.
      const codigo = src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')

      if (/(\w+)\.current\s*\)\s*\{\s*\1\.current\s*=\s*false\s*;?\s*return/.test(codigo)) {
        culpables.push(path.relative(process.cwd(), archivo))
      }
    }

    expect(culpables, [
      'Estos componentes guardan solos y se protegen con una guarda de primer',
      'render, que el doble montaje de React se salta.',
      'Compara contra la firma de lo último guardado, como en',
      'components/pantallas/config/ComoPrestas.jsx.',
    ].join('\n')).toEqual([])
  })
})
