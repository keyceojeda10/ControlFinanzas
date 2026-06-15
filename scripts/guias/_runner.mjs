// Runner por lotes: hace UN solo login y genera varias guias en la misma
// sesion, evitando el rate-limit de login.
//   node scripts/guias/_runner.mjs editar-cliente eliminar-cliente ...
import { iniciarSesion, correrPasos } from './motor.mjs'

const slugs = process.argv.slice(2)
if (!slugs.length) { console.log('Uso: node _runner.mjs <slug1> <slug2> ...'); process.exit(1) }

const { browser, page } = await iniciarSesion()
console.log('Login OK. Generando', slugs.length, 'guias...')
for (const slug of slugs) {
  try {
    const mod = await import(`./${slug}.mjs`)
    if (!mod.def) { console.log(`!! ${slug}: no exporta 'def'`); continue }
    await correrPasos(mod.def, page)
  } catch (e) {
    console.log(`!! ${slug} fallo:`, e.message)
  }
}
await browser.close()
console.log('\n=== Lote terminado ===')
