import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
const src = (f) => readFileSync(resolve(process.cwd(), f), 'utf8')

describe('los teléfonos con la cuenta guardada', () => {
  it('el componente pide los propios o los del cobrador', () => {
    const c = src('components/cuentas/TelefonosGuardados.jsx')
    expect(c).toMatch(/const base = cobradorId \? `\/api\/cobradores\/\$\{cobradorId\}\/cuentas-guardadas` : '\/api\/cuentas-guardadas'/)
    expect(c).toMatch(/method: 'DELETE'/)
  })
  it('sale en Seguridad (para todos) y en la ficha del cobrador', () => {
    expect(src('app/(dashboard)/configuracion/page.jsx')).toMatch(/<TelefonosGuardados \/>/)
    expect(src('app/(dashboard)/cobradores/[id]/page.jsx')).toMatch(/<TelefonosGuardados cobradorId=\{id\} \/>/)
  })
})
