// lib/__tests__/contraste-rojo.test.js
//
// TEXTO OSCURO SOBRE ROJO OSCURO NO SE LEE.
//
// Aparecio dos veces: el boton de «Quitar cliente de la ruta» y la pastilla de
// «Alertas de mora» del panel, las dos con `background: var(--cf-red-dark)` y
// `color: var(--cf-ink)`. En tema OSCURO `--cf-ink` es claro y colaba; en tema
// CLARO es casi negro, asi que era negro sobre rojo oscuro.
//
// No lo cazaba nada porque el token existe y el CSS es valido: solo esta mal la
// PAREJA. Esta prueba mira la pareja.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

function archivos(dir, salida = []) {
  const abs = path.join(process.cwd(), dir)
  if (!fs.existsSync(abs)) return salida
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`
    if (e.isDirectory()) archivos(rel, salida)
    else if (e.name.endsWith('.jsx')) salida.push(rel)
  }
  return salida
}

const FUENTES = [...archivos('app'), ...archivos('components')]

// Fondos que en tema claro son OSCUROS y saturados. Encima de ellos, el texto
// tiene que ser claro — nunca `--cf-ink` ni `--cf-ink-2`, que son la tinta
// normal sobre papel.
const FONDOS_OSCUROS = ['--cf-red-dark', '--cf-red-darker', '--cf-green-dark', '--cf-gold-dark']
const TINTAS_OSCURAS = ['--cf-ink)', '--cf-ink-2)', '--cf-ink-3)']

describe('ningún texto oscuro sobre un fondo oscuro', () => {
  it('hay archivos que revisar', () => {
    expect(FUENTES.length).toBeGreaterThan(100)
  })

  it('la pareja fondo-oscuro + tinta-oscura no aparece', () => {
    const rotos = []
    for (const f of FUENTES) {
      const src = fs.readFileSync(path.join(process.cwd(), f), 'utf8')
      // Se mira DENTRO de un mismo objeto de estilo: `background: X, color: Y`
      // separados por poco. Buscarlos en todo el archivo daria falsos positivos
      // en cuanto una pantalla use los dos tokens en sitios distintos.
      const parejas = src.match(/background:\s*'var\([^']+\)'\s*,\s*color:\s*'var\([^']+\)'/g) ?? []
      for (const par of parejas) {
        const fondo = FONDOS_OSCUROS.find((t) => par.includes(`${t})`) && par.indexOf(`${t})`) < par.indexOf('color:'))
        const tinta = TINTAS_OSCURAS.find((t) => par.slice(par.indexOf('color:')).includes(t))
        if (fondo && tinta) rotos.push(`${f}: ${par}`)
      }
    }
    expect(rotos).toEqual([])
  })
})
