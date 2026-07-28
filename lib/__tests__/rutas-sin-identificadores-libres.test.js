// Guarda contra el fallo que tumbo /api/caja en produccion:
//
//   ReferenceError: cuotaDelPeriodo is not defined
//
// El commit a5e30030 empezo a USAR `cuotaDelPeriodo(p)` en dos sitios de
// app/api/caja/route.js pero nunca escribio la funcion. El build de Next no lo
// detecta (no hay chequeo de tipos) y la suite tampoco lo veia, porque las rutas
// de API no se ejercitan en los tests.
//
// Peor: el fallo era intermitente. `cuotaDelPeriodo(p)` esta dentro de un
// ternario que solo se evalua cuando el prestamo tiene cuota esperada HOY. Los
// cobradores sin cobros programados veian la pantalla normal; los que si tenian
// cobros — o sea justo cuando la caja importa — recibian un 500 y la app les
// mostraba "No se pudo cargar la informacion".
//
// El chequeo parsea el fuente con Babel y compara los nombres que se INVOCAN
// contra los que estan DECLARADOS o IMPORTADOS en el archivo. Cubre una clase
// entera de error, no solo este caso.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parse } from '@babel/parser'

const RAIZ = path.resolve(__dirname, '..', '..')

// Rutas donde un ReferenceError se traduce en "el cliente no ve su plata".
const RUTAS = [
  'app/api/caja/route.js',
  'app/api/caja/cobrador/[id]/route.js',
  'app/api/rutas/[id]/route.js',
  'app/api/mora/route.js',
  'app/api/prestamos/route.js',
  'app/api/dashboard/analiticas/route.js',
]

const GLOBALES = new Set([
  'Array', 'Object', 'String', 'Number', 'Boolean', 'Math', 'JSON', 'Date', 'Map', 'Set',
  'WeakMap', 'WeakSet', 'Promise', 'Error', 'TypeError', 'RangeError', 'RegExp', 'Symbol',
  'BigInt', 'Intl', 'URL', 'URLSearchParams', 'Proxy', 'Reflect', 'globalThis',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask',
  'console', 'fetch', 'Response', 'Request', 'Headers', 'FormData', 'Blob', 'AbortController',
  'process', 'Buffer', 'structuredClone', 'crypto', 'require',
])

// Recorre el AST recolectando todo nombre ligado en cualquier ambito del archivo,
// y todo nombre invocado como funcion simple (`algo(...)`, no `obj.algo(...)`).
function analizar(src) {
  const ast = parse(src, {
    sourceType: 'module',
    plugins: ['jsx', 'topLevelAwait', 'importAttributes', 'optionalChaining', 'nullishCoalescingOperator'],
    errorRecovery: true,
  })

  const ligados = new Set()
  const invocados = new Map()   // nombre -> linea

  const ligarPatron = (nodo) => {
    if (!nodo) return
    switch (nodo.type) {
      case 'Identifier': ligados.add(nodo.name); break
      case 'ObjectPattern': nodo.properties.forEach(p =>
        ligarPatron(p.type === 'RestElement' ? p.argument : p.value)); break
      case 'ArrayPattern': nodo.elements.forEach(ligarPatron); break
      case 'AssignmentPattern': ligarPatron(nodo.left); break
      case 'RestElement': ligarPatron(nodo.argument); break
      default: break
    }
  }

  const visitar = (nodo) => {
    if (!nodo || typeof nodo.type !== 'string') return

    switch (nodo.type) {
      case 'VariableDeclarator': ligarPatron(nodo.id); break
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        if (nodo.id) ligados.add(nodo.id.name)
        nodo.params.forEach(ligarPatron)
        break
      case 'ClassDeclaration':
      case 'ClassExpression':
        if (nodo.id) ligados.add(nodo.id.name)
        break
      case 'ImportDefaultSpecifier':
      case 'ImportNamespaceSpecifier':
      case 'ImportSpecifier':
        ligados.add(nodo.local.name); break
      case 'CatchClause': ligarPatron(nodo.param); break
      case 'ForOfStatement':
      case 'ForInStatement':
        if (nodo.left?.type === 'VariableDeclaration') nodo.left.declarations.forEach(d => ligarPatron(d.id))
        break
      case 'CallExpression':
      case 'OptionalCallExpression':
        if (nodo.callee?.type === 'Identifier') {
          if (!invocados.has(nodo.callee.name)) invocados.set(nodo.callee.name, nodo.callee.loc?.start.line ?? 0)
        }
        break
      default: break
    }

    for (const clave of Object.keys(nodo)) {
      if (clave === 'loc' || clave === 'range' || clave === 'leadingComments' || clave === 'trailingComments') continue
      const hijo = nodo[clave]
      if (Array.isArray(hijo)) hijo.forEach(visitar)
      else if (hijo && typeof hijo.type === 'string') visitar(hijo)
    }
  }

  visitar(ast.program)
  return { ligados, invocados }
}

describe('rutas de dinero: sin identificadores sueltos', () => {
  for (const ruta of RUTAS) {
    const abs = path.join(RAIZ, ruta)
    if (!fs.existsSync(abs)) continue

    it(`${ruta} no invoca funciones que no existen`, () => {
      const { ligados, invocados } = analizar(fs.readFileSync(abs, 'utf8'))
      const faltantes = [...invocados.entries()]
        .filter(([n]) => !ligados.has(n) && !GLOBALES.has(n))
        .map(([n, linea]) => `${n}() en la linea ${linea}`)

      expect(faltantes, `invocadas pero nunca declaradas en ${ruta}`).toEqual([])
    })
  }

  it('cuotaDelPeriodo esta definida donde se usa (el fallo concreto de produccion)', () => {
    const { ligados, invocados } = analizar(
      fs.readFileSync(path.join(RAIZ, 'app/api/caja/route.js'), 'utf8'),
    )
    expect(invocados.has('cuotaDelPeriodo'), 'deberia seguir usandose').toBe(true)
    expect(ligados.has('cuotaDelPeriodo'), 'y deberia estar declarada').toBe(true)
  })
})
