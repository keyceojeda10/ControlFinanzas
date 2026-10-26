/* Oscar (CREDITOS E y M) pagó el 25 oct 2026 y el 26 le llegó «último día de
   prueba»: el aviso contaba días desde el registro y no miraba el pago. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const r = readFileSync('app/api/cron/trial-reminder/route.js', 'utf8')

describe('aviso de fin de prueba', () => {
  it('quien ya pagó no lo recibe y queda dado por avisado', () => {
    expect(r).toMatch(/if \(sub && sub\.montoCOP > 0 && sub\.estado === 'activa'\) \{\n\s+await prisma\.organization\.update\(\{ where: \{ id: org\.id \}, data: \{ trialReminderSent: true \} \}\)/)
  })
  it('cuenta hasta el vencimiento real, no desde el registro', () => {
    expect(r).toContain("(new Date(sub.fechaVencimiento).getTime() - ahora.getTime()) / 86400000")
    expect(r).toContain('if (diasParaVencer > 0 && diasParaVencer <= 2) {')
    expect(r).toContain('if (diasParaVencer <= 0) {')
    expect(r).not.toMatch(/diasDesdeRegistro >= 1[24]/)
  })
  it('lo vencido hace más de 2 días no recibe un aviso tardío', () => {
    expect(r).toMatch(/if \(diasParaVencer <= -2\) \{\n\s+await prisma\.organization\.update/)
  })
})
