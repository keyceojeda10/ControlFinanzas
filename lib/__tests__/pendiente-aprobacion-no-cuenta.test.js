import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'

// 27 oct 2026. Con «requiere aprobación de préstamos» (10 negocios lo tienen
// encendido) el préstamo del cobrador nace en `pendiente_aprobacion`. Las cajas
// e informes solo dejaban fuera los cancelados: medido en el espejo con
// .auditoria/_aprobacion-no-cuenta.mjs, uno pedido ayer contaba $70.000 en la
// caja de ayer ANTES de aprobarse, y al aprobarlo hoy salía en las dos.

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
function archivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return n === '__tests__' ? [] : archivos(p)
    return /\.js$/.test(n) ? [p] : []
  })
}

describe('un préstamo que espera aprobación no cuenta', () => {
  it('ninguna consulta de app/api ni lib deja fuera solo los cancelados', () => {
    const sueltas = [...archivos(resolve(process.cwd(), 'app/api')), ...archivos(resolve(process.cwd(), 'lib'))]
      .filter((p) => !p.endsWith('importar-cartera.js')) // ahí es para no duplicar al importar: el pendiente también existe
      .filter((p) => /estado: \{ not: 'cancelado' \}/.test(readFileSync(p, 'utf8')))
    expect(sueltas).toEqual([])
  })
  it('la caja del cobrador y la del administrador usan el filtro completo', () => {
    for (const f of ['app/api/caja/route.js', 'app/api/caja/cobrador/[id]/route.js', 'lib/caja/stats-dia.js', 'lib/dinero/desembolsado.js']) {
      expect(leer(f), f).toMatch(/estado: \{ notIn: \['cancelado', 'pendiente_aprobacion'\] \}/)
    }
  })
})

describe('al aprobarlo', () => {
  const src = leer('app/api/prestamos/[id]/aprobar/route.js')
  it('nace el día que se aprueba', () => {
    expect(src).toMatch(/estado: abonoPrevio && saldoAlAprobar <= 0 \? 'completado' : 'activo',\s*createdAt: new Date\(\),/)
  })
  it('el asiento sale por la cuenta que eligió el cobrador', () => {
    expect(src).toMatch(/const CUENTA_AL_APROBAR = prestamo\.cuentaDesembolso \|\| 'efectivo'/)
    expect((src.match(/metodoPagoId: CUENTA_ID_AL_APROBAR,/g) ?? []).length).toBe(2)
  })
  it('la solicitud guarda esa cuenta', () => {
    expect(leer('app/api/prestamos/route.js')).toMatch(/\.\.\.\(esPendiente && \{ estado: 'pendiente_aprobacion', cuentaDesembolso, cuentaDesembolsoId \}\)/)
  })
})
