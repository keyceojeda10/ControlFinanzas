import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'

// ── UNA FUNCIÓN QUE NO EXISTE PASA BUILD, TESTS Y DESPLIEGUE ────────────────
//
// `ModificarPlazo.jsx` llamaba a `formatFechaCalendario` DOS veces sin
// importarla. La pantalla reventaba al abrirse —«formatFechaCalendario is not
// defined»— y apareció en los logs de producción del 5 ago 2026, no en el
// build: sin TypeScript, esto compila.
//
// Es el mismo patrón que ya tumbó producción con la TDZ (`Cannot access 'cJ'
// before initialization`) y que el proyecto tiene documentado: «una función
// inexistente pasa build+tests+deploy y falla intermitente».
//
// Esta prueba busca ese patrón concreto: se llama a algo que `lib/i18n` exporta
// —el módulo más compartido, donde vive el formateo de plata y fechas— sin
// haberlo importado en ese archivo.

const RAIZ = process.cwd()

/** Los nombres que `lib/i18n` pone a disposición. */
function exportadosDeI18n() {
  const src = readFileSync(resolve(RAIZ, 'lib/i18n.js'), 'utf8')
  const nombres = new Set()
  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) nombres.add(m[1])
  for (const m of src.matchAll(/export\s+const\s+(\w+)\s*=/g)) nombres.add(m[1])
  return nombres
}

function archivosJSX(dir, salida = []) {
  for (const entrada of readdirSync(dir)) {
    if (entrada === 'node_modules' || entrada === '.next' || entrada.startsWith('.')) continue
    const ruta = join(dir, entrada)
    if (statSync(ruta).isDirectory()) archivosJSX(ruta, salida)
    else if (/\.jsx?$/.test(entrada) && !ruta.includes('__tests__')) salida.push(ruta)
  }
  return salida
}

/** Quita comentarios y cadenas: dentro no hay llamadas de verdad. */
function limpiar(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
}

describe('nadie llama a una función que no tiene', () => {
  const deI18n = exportadosDeI18n()

  it('lib/i18n exporta lo que se espera', () => {
    // Si esto se vacía, la prueba pasaría en verde sin mirar nada.
    expect(deI18n.size, 'no encuentro los exportes de lib/i18n').toBeGreaterThan(5)
    expect(deI18n.has('formatFechaCalendario')).toBe(true)
    expect(deI18n.has('formatMoney')).toBe(true)
  })

  it('ningún archivo usa un helper de i18n sin importarlo', () => {
    const culpables = []
    for (const ruta of [...archivosJSX(join(RAIZ, 'app')), ...archivosJSX(join(RAIZ, 'components'))]) {
      const bruto = readFileSync(ruta, 'utf8')
      const src = limpiar(bruto)
      // Qué importa este archivo, venga de donde venga.
      const importados = new Set()
      for (const m of bruto.matchAll(/import\s*\{([^}]+)\}\s*from/g)) {
        for (const parte of m[1].split(',')) {
          const nombre = parte.trim().split(/\s+as\s+/).pop().trim()
          if (nombre) importados.add(nombre)
        }
      }
      // Y qué declara por su cuenta: puede tener una función con el mismo nombre.
      for (const m of src.matchAll(/(?:function|const|let|var)\s+(\w+)/g)) importados.add(m[1])

      // ⚠ LA DESESTRUCTURACIÓN CUENTA COMO TENERLO, y sin esto la prueba
      // señalaba 14 archivos sanos. La mitad de la aplicación saca `formatMoney`
      // del hook —`const { formatMoney } = useCountry()`— porque el formato de
      // la plata depende del país, y también hay props (`{ formatMoney }`) y
      // asignaciones desde un objeto. Ninguna es un import y todas son válidas.
      //
      // Es la misma trampa del medidor que ya me dio 9 pantallas «rotas» de las
      // que 6 eran falsas: un patrón demasiado estrecho acusa código correcto,
      // y una prueba que acusa en falso se acaba ignorando.
      for (const m of src.matchAll(/(?:const|let|var)\s*\{([^}]+)\}\s*=/g)) {
        for (const parte of m[1].split(',')) {
          const nombre = parte.trim().split(':').pop().trim().replace(/\s*=.*$/, '')
          if (nombre) importados.add(nombre)
        }
      }
      // Los parámetros desestructurados de la función/componente.
      for (const m of src.matchAll(/(?:function\s+\w+|=>|\()\s*\(?\s*\{([^}]{0,600})\}\s*\)?\s*(?:=>|\{)/g)) {
        for (const parte of m[1].split(',')) {
          const nombre = parte.trim().split(':').pop().trim().replace(/\s*=.*$/, '')
          if (/^\w+$/.test(nombre)) importados.add(nombre)
        }
      }

      for (const nombre of deI18n) {
        if (importados.has(nombre)) continue
        const llamada = new RegExp(`\\b${nombre}\\s*\\(`)
        if (llamada.test(src)) {
          culpables.push(`${ruta.replace(RAIZ, '').replace(/\\/g, '/')} → ${nombre}()`)
        }
      }
    }
    expect(culpables, `se llaman sin importar:\n  ${culpables.join('\n  ')}`).toEqual([])
  })
})
