/* Todo el que registra un pago, recargo o descuento contra el API de pagos
   manda el monto en `montoPagado`. El interés moratorio (2 jul 2026) nació
   mandando `monto`, el API leía `undefined` y contestaba «El monto debe ser
   mayor a 0»: dos meses sin funcionar y cero moratorios en producción frente a
   549 recargos de la hoja. Soporte lo supo por Préstamos Rincón el 8 sep.
   Esta prueba recorre TODAS las llamadas, no solo la que se arregló. */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function ficheros(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    if (['node_modules', '.next', '__tests__', 'generated', '.auditoria'].includes(n)) continue
    const p = join(dir, n)
    if (statSync(p).isDirectory()) ficheros(p, acc)
    else if (/\.(jsx?|mjs)$/.test(n) && !/\.test\./.test(n)) acc.push(p)
  }
  return acc
}

describe('el campo del monto al registrar contra /api/prestamos/[id]/pagos', () => {
  const llamadas = []
  for (const f of [...ficheros('app'), ...ficheros('components'), ...ficheros('lib')]) {
    const src = readFileSync(f, 'utf8')
    const re = /\/pagos`,\s*\{[\s\S]{0,600}?body:\s*JSON\.stringify\(\{([\s\S]*?)\}\)/g
    let m
    while ((m = re.exec(src))) llamadas.push({ f, cuerpo: m[1] })
  }

  it('encuentra las llamadas (si esto da 0, la prueba dejó de mirar donde toca)', () => {
    expect(llamadas.length).toBeGreaterThanOrEqual(6)
  })

  it('todas mandan montoPagado y ninguna manda un `monto:` suelto', () => {
    const mal = llamadas.filter(({ cuerpo }) => !/\bmontoPagado\b/.test(cuerpo) || /(^|[\s,{])monto:/.test(cuerpo))
    expect(mal.map(({ f, cuerpo }) => `${f} → {${cuerpo.replace(/\s+/g, ' ').trim()}}`)).toEqual([])
  })
})
