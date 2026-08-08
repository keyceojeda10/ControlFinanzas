// lib/__tests__/papel-imports.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Al pasar los cuatro documentos al kit, tres de ellos quedaron **usando
// `abrirDocumento` sin importarlo**. El motivo: los archivos son CRLF y el
// script que hizo el cambio buscaba `"linea1\nlinea2"`, que no existe en un
// archivo con `\r\n`. El replace falló sin decir nada.
//
// ⚠ Y `next build` PASÓ EN VERDE. No hay TypeScript, así que un identificador
// que no existe no es un error de compilación: es un `ReferenceError` en
// caliente, la primera vez que un cliente pulsa «bajar». Ya nos pasó una vez
// —una función inexistente dentro de un ternario— y por eso la regla es leer
// los logs antes de teorizar. Esta prueba lo caza antes de salir.
//
// No comprueba estilo: comprueba que lo que se USA está IMPORTADO.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const RAIZ = process.cwd()

/** Todos los `route.js` bajo app/api. */
function rutasApi(dir = path.join(RAIZ, 'app', 'api'), acc = []) {
  for (const entrada of readdirSync(dir)) {
    const p = path.join(dir, entrada)
    if (statSync(p).isDirectory()) rutasApi(p, acc)
    else if (entrada === 'route.js') acc.push(p)
  }
  return acc
}

/* Lo que exporta el kit. Si mañana se añade una primitiva, se añade aquí y la
   prueba la vigila sola. */
const DEL_KIT = ['abrirDocumento', 'respuestaPdf', 'F']
const DE_TOKENS = ['COLOR', 'TIPO', 'HOJA', 'RADIO', 'FILETE']

/** Los nombres que trae un `import { a, b } from '…'` del módulo indicado. */
function importados(fuente, modulo) {
  const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"][^'"]*${modulo}['"]`, 'g')
  const nombres = new Set()
  for (const m of fuente.matchAll(re)) {
    for (const parte of m[1].split(',')) {
      const nombre = parte.trim().split(/\s+as\s+/)[0].trim()
      if (nombre) nombres.add(nombre)
    }
  }
  return nombres
}

/** ¿Aparece el identificador FUERA de comentarios? */
function usaIdentificador(fuente, nombre) {
  const sinNotas = fuente
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
  return new RegExp(`(^|[^\\w.$])${nombre}\\s*[.(]`, 'm').test(sinNotas)
}

describe('los documentos importan lo que usan del kit de papel', () => {
  const archivos = rutasApi().filter((f) => /papel\//.test(readFileSync(f, 'utf8')))

  it('hay documentos que usan el kit', () => {
    // Si esto falla, o se borró el kit o el filtro dejó de encontrarlos: en
    // cualquiera de los dos casos el resto de la prueba estaría pasando en
    // vacío, que es peor que fallar.
    expect(archivos.length).toBeGreaterThanOrEqual(4)
  })

  for (const archivo of archivos) {
    const nombre = path.relative(RAIZ, archivo).replace(/\\/g, '/')

    it(nombre, () => {
      const fuente = readFileSync(archivo, 'utf8')
      const delKit = importados(fuente, 'papel/documento')
      const deTokens = importados(fuente, 'papel/tokens')

      for (const s of DEL_KIT) {
        if (usaIdentificador(fuente, s)) expect(delKit, `usa ${s}`).toContain(s)
      }
      for (const s of DE_TOKENS) {
        if (usaIdentificador(fuente, s)) expect(deTokens, `usa ${s}`).toContain(s)
      }

      // Y que no quede el PDFKit crudo de antes: si sigue ahí, o el archivo se
      // pasó a medias o alguien volvió a dibujar por su cuenta.
      expect(fuente).not.toMatch(/^import PDFDocument/m)
    })
  }
})
