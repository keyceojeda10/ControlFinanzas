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
  it('en Seguridad la lista va dentro de una tarjeta, como sus vecinos', () => {
    expect(src('app/(dashboard)/configuracion/page.jsx')).toMatch(/<Card><TelefonosGuardados \/><\/Card>/)
  })
  it('revisa el .ok de la carga: un fallo no se confunde con lista vacía', () => {
    const c = src('components/cuentas/TelefonosGuardados.jsx')
    expect(c).toMatch(/fetch\(base\)\s*\n\s*\.then\(\(r\) => \{ if \(!r\.ok\) throw new Error/)
    expect(c).toMatch(/>No se pudo cargar la lista\. Intenta de nuevo\.</)
  })
  it('revisa el .ok de «Quitar»: un fallo se avisa y no borra la fila', () => {
    const c = src('components/cuentas/TelefonosGuardados.jsx')
    expect(c).toMatch(/method: 'DELETE' \}\)\s*\n\s*if \(!r\.ok\) throw new Error/)
    expect(c).toMatch(/>No se pudo quitar ese teléfono\. Intenta de nuevo\.</)
  })
  it('la fila en camino se deshabilita y dice «Quitando…»', () => {
    const c = src('components/cuentas/TelefonosGuardados.jsx')
    expect(c).toMatch(/disabled=\{quitandoId === a\.id\}/)
    expect(c).toMatch(/\{quitandoId === a\.id \? 'Quitando…' : 'Quitar'\}/)
  })
})
