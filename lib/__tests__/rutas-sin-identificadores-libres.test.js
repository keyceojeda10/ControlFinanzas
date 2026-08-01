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
//
// ─────────────────────────────────────────────────────────────────────────
//
// Segunda guarda, por el mismo tipo de fallo pero por la otra puerta:
//
//   ReferenceError: Cannot access 'calc' before initialization
//
// El commit c8e1cb79 quiso guardar el plazo REAL del calculo y escribio
// `diasPlazo: calc.numPeriodos * calc.diasPeriodo` DENTRO de la llamada
// `const calc = calcularPrestamo({...})`. O sea, `calc` leyendose a si mismo
// antes de existir: temporal dead zone. En renovar/route.js el mismo patron
// es correcto porque ahi va en el objeto que se GUARDA, no en la entrada.
//
// Aca el nombre si esta declarado, asi que la guarda de arriba no lo ve. Este
// chequeo busca declaradores `const`/`let` cuyo inicializador se lee a si
// mismo de inmediato. No entra a cuerpos de funcion: `const f = () => f()` es
// legitimo, la llamada ocurre despues de que la declaracion termino.
//
// Sintoma en produccion: 98 errores en 4 dias, ~25/dia, cada uno un 500 para
// un prestamista intentando editar un prestamo sin pagos.

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
  'app/api/prestamos/[id]/route.js',
  'app/api/prestamos/[id]/renovar/route.js',
  'app/api/dashboard/analiticas/route.js',
  'app/api/dashboard/analiticas/reporte-pdf/route.js',
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

// Devuelve los `const`/`let` cuyo inicializador se lee a si mismo antes de
// terminar de inicializarse (temporal dead zone). Ver el encabezado.
function autoreferencias(src) {
  const ast = parse(src, {
    sourceType: 'module',
    plugins: ['jsx', 'topLevelAwait', 'importAttributes', 'optionalChaining', 'nullishCoalescingOperator'],
    errorRecovery: true,
  })

  const hallazgos = []

  const nombresDelPatron = (nodo, acc) => {
    if (!nodo) return acc
    switch (nodo.type) {
      case 'Identifier': acc.push(nodo.name); break
      case 'ObjectPattern': nodo.properties.forEach(p =>
        nombresDelPatron(p.type === 'RestElement' ? p.argument : p.value, acc)); break
      case 'ArrayPattern': nodo.elements.forEach(e => nombresDelPatron(e, acc)); break
      case 'AssignmentPattern': nombresDelPatron(nodo.left, acc); break
      case 'RestElement': nombresDelPatron(nodo.argument, acc); break
      default: break
    }
    return acc
  }

  // Busca una lectura de `nombres` que se EVALUE ya mismo dentro del init.
  const lecturaInmediata = (init, nombres) => {
    let hallado = null
    const rec = (nodo) => {
      if (hallado || !nodo || typeof nodo.type !== 'string') return
      // Ejecucion diferida: el cuerpo corre despues de que la declaracion cerro.
      if (nodo.type === 'FunctionExpression' || nodo.type === 'ArrowFunctionExpression'
        || nodo.type === 'FunctionDeclaration' || nodo.type === 'ClassBody') return
      if (nodo.type === 'Identifier') {
        if (nombres.includes(nodo.name)) hallado = { nombre: nodo.name, linea: nodo.loc?.start.line ?? 0 }
        return
      }
      for (const clave of Object.keys(nodo)) {
        if (clave === 'loc' || clave === 'range' || clave === 'leadingComments' || clave === 'trailingComments') continue
        // En `obj.prop` solo `obj` es una lectura; `prop` es un nombre de campo.
        if ((nodo.type === 'MemberExpression' || nodo.type === 'OptionalMemberExpression')
          && clave === 'property' && !nodo.computed) continue
        // En `{ prop: 1 }` la clave tampoco es una lectura.
        if ((nodo.type === 'ObjectProperty' || nodo.type === 'ObjectMethod')
          && clave === 'key' && !nodo.computed) continue
        const hijo = nodo[clave]
        if (Array.isArray(hijo)) hijo.forEach(rec)
        else if (hijo && typeof hijo.type === 'string') rec(hijo)
      }
    }
    rec(init)
    return hallado
  }

  const visitar = (nodo) => {
    if (!nodo || typeof nodo.type !== 'string') return

    // `var` se iza y da `undefined`, no un ReferenceError. Solo const/let.
    if (nodo.type === 'VariableDeclaration' && (nodo.kind === 'const' || nodo.kind === 'let')) {
      for (const d of nodo.declarations) {
        if (!d.init) continue
        const hallado = lecturaInmediata(d.init, nombresDelPatron(d.id, []))
        if (hallado) hallazgos.push(hallado)
      }
    }

    for (const clave of Object.keys(nodo)) {
      if (clave === 'loc' || clave === 'range' || clave === 'leadingComments' || clave === 'trailingComments') continue
      const hijo = nodo[clave]
      if (Array.isArray(hijo)) hijo.forEach(visitar)
      else if (hijo && typeof hijo.type === 'string') visitar(hijo)
    }
  }

  visitar(ast.program)
  return hallazgos
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

    it(`${ruta} no tiene const/let que se lean a si mismos`, () => {
      const hallazgos = autoreferencias(fs.readFileSync(abs, 'utf8'))
        .map(h => `${h.nombre} se usa dentro de su propia declaracion, linea ${h.linea}`)

      expect(hallazgos, `temporal dead zone en ${ruta}`).toEqual([])
    })
  }

  /* ── EL MISMO GUARDIA, AL REVES ─────────────────────────────────────────
     Esta prueba nacio de un fallo real: `cuotaDelPeriodo` se usaba en
     `app/api/caja/route.js` sin estar declarada, y tumbaba la caja con
     «cuotaDelPeriodo is not defined» justo los dias en que algun prestamo
     tenia cuota esperada — o sea, cuando la pantalla importaba.

     Ya no puede pasar: la funcion vive en `lib/dinero/esperado.js` y las rutas
     la importan. Lo que hay que vigilar ahora es lo contrario, porque es como
     empezo el desorden que estamos deshaciendo: que alguien vuelva a
     escribirla A MANO en una ruta en vez de importarla. Estaba duplicada
     identica en dos sitios, y de ahi salieron dos respuestas distintas a
     «cuanto vale una cuota».

     El guardia general de arriba sigue cubriendo el fallo original. */
  it('cuotaDelPeriodo no se vuelve a declarar a mano en las rutas de dinero', () => {
    const duplicados = []
    for (const ruta of RUTAS) {
      const abs = path.join(RAIZ, ruta)
      if (!fs.existsSync(abs)) continue
      const fuente = fs.readFileSync(abs, 'utf8')
      if (/(?:const|let|function)\s+cuotaDelPeriodo\s*[=(]/.test(fuente)) duplicados.push(ruta)
    }
    expect(duplicados, 'declarada a mano en vez de importada de lib/dinero/esperado').toEqual([])
  })

  it('el calc de modo=editar no se lee a si mismo (el otro fallo de produccion)', () => {
    const hallazgos = autoreferencias(
      fs.readFileSync(path.join(RAIZ, 'app/api/prestamos/[id]/route.js'), 'utf8'),
    )
    expect(hallazgos.map(h => h.nombre)).not.toContain('calc')
  })

  // El detector tiene que distinguir el bug del patron legitimo, o en la
  // proxima refactorizacion alguien lo apaga por ruidoso.
  it('el detector de autoreferencias ve el bug y deja pasar lo valido', () => {
    // Exactamente la forma que tumbo produccion.
    expect(autoreferencias(
      'const calc = calcularPrestamo({ diasPlazo: calc.numPeriodos * calc.diasPeriodo })',
    ).map(h => h.nombre)).toEqual(['calc'])

    // Recursion: el cuerpo corre despues, es valido.
    expect(autoreferencias('const f = (n) => n <= 1 ? 1 : n * f(n - 1)')).toEqual([])
    // Reasignar leyendo el valor anterior de OTRA variable, valido.
    expect(autoreferencias('const a = 1; const b = a + 1')).toEqual([])
    // Un campo que se llama igual que la variable no es una lectura.
    expect(autoreferencias('const calc = hacer({ calc: 1 })')).toEqual([])
    // Acceder a `.calc` de otro objeto tampoco.
    expect(autoreferencias('const calc = otro.calc')).toEqual([])
  })
})
