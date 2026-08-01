// Deja que los scripts sueltos importen modulos de la app.
//
// ── POR QUE ───────────────────────────────────────────────────────────────
//
// El proyecto usa el alias `@/` (jsconfig + webpack) y omite las extensiones
// en los imports relativos. Las dos cosas las resuelve Next por su cuenta;
// node pelado no. Asi que `import ... from '../lib/dinero/esperado.js'` en un
// script revienta en cuanto la cadena toca `@/lib/planes`.
//
// La alternativa era reescribir los imports de `lib/calculos.js` para que node
// los entendiera. Tocar el nucleo del dinero por comodidad de un script es
// exactamente el tipo de cambio que no compensa: este archivo hace el mismo
// trabajo, no toca una linea de produccion, y sirve para todos los analisis
// que vengan.
//
// ── COMO SE USA ───────────────────────────────────────────────────────────
//
//   node --import ./scripts/alias-loader.mjs scripts/mi-analisis.mjs
//
// Y dentro del script ya se puede `import { ... } from '@/lib/calculos'`.

import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

const RAIZ = pathToFileURL(process.cwd() + '/').href

register(
  'data:text/javascript,' +
    encodeURIComponent(`
    import { existsSync } from 'node:fs'
    import { fileURLToPath } from 'node:url'

    const RAIZ = ${JSON.stringify(RAIZ)}

    // Node exige la extension; el codigo de la app la omite. Se prueban las
    // que usa el proyecto, en orden, y tambien el index de una carpeta.
    function conExtension(url) {
      if (existsSync(fileURLToPath(url))) return url
      for (const ext of ['.js', '.mjs', '.jsx', '/index.js']) {
        const probar = url + ext
        try { if (existsSync(fileURLToPath(probar))) return probar } catch {}
      }
      return null
    }

    export async function resolve(especificador, contexto, siguiente) {
      if (especificador.startsWith('@/')) {
        const url = conExtension(RAIZ + especificador.slice(2))
        if (url) return { url, shortCircuit: true }
      }
      if (especificador.startsWith('./') || especificador.startsWith('../')) {
        try {
          const base = new URL(especificador, contexto.parentURL).href
          const url = conExtension(base)
          if (url && url !== base) return { url, shortCircuit: true }
        } catch {}
      }
      return siguiente(especificador, contexto)
    }
  `),
  import.meta.url,
)
