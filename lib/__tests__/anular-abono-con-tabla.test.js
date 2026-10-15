import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { motivoParaNoDeshacerAbono } from '@/lib/dinero/deshacer-abono'

// Crediya, Jhon Arteaga (15 oct 2026): el abono de $26.500 rehízo la tabla y
// bajó la deuda $101.390; anularlo devolvió $1.199. Ahora el abono guarda la
// foto de cómo estaba y anularlo la restaura, en orden.

const FOTO = { totalAPagar: 697279, filas: [{ numeroPeriodo: 5, capital: 103703, interes: 9597, cuotaTotal: 113300, saldoRestante: 108375, fechaEsperada: '2026-10-30T05:00:00.000Z' }] }
const abono = (id, min, extra = {}) => ({ id, tipo: 'capital', createdAt: new Date(Date.UTC(2026, 9, 15, 13, min)), ...extra })
const cobro = (id, min) => ({ id, tipo: 'completo', createdAt: new Date(Date.UTC(2026, 9, 15, 13, min)) })

describe('cuándo se puede anular un abono a capital con tabla', () => {
  it('con su foto y sin nada después: sí', () => {
    const a = abono('a', 9, { tablaAntes: FOTO })
    expect(motivoParaNoDeshacerAbono(a, { modoInteres: 'saldo', pagos: [cobro('c', 8), a] })).toBeNull()
  })
  it('sin cuotas futuras la foto va vacía y también se puede', () => {
    const a = abono('a', 9, { tablaAntes: { totalAPagar: 500000, filas: [] } })
    expect(motivoParaNoDeshacerAbono(a, { modoInteres: 'saldo', pagos: [a] })).toBeNull()
  })
  it('un cobro normal después no estorba (sobre saldo)', () => {
    const a = abono('a', 9, { tablaAntes: FOTO })
    expect(motivoParaNoDeshacerAbono(a, { modoInteres: 'saldo', pagos: [a, cobro('c', 20)] })).toBeNull()
  })
  it('un abono más reciente: primero ese', () => {
    const a = abono('a', 9, { tablaAntes: FOTO })
    const b = abono('b', 30, { tablaAntes: FOTO })
    expect(motivoParaNoDeshacerAbono(a, { modoInteres: 'saldo', pagos: [a, b] })).toMatch(/Anule primero ese/)
    expect(motivoParaNoDeshacerAbono(b, { modoInteres: 'saldo', pagos: [a, b] })).toBeNull()
  })
  it('lineal dinámico: cualquier cobro después rehízo la tabla', () => {
    const a = abono('a', 9, { tablaAntes: FOTO })
    expect(motivoParaNoDeshacerAbono(a, { modoInteres: 'lineal_dinamico', pagos: [a, cobro('c', 20)] })).toMatch(/cobros más recientes/)
    expect(motivoParaNoDeshacerAbono(a, { modoInteres: 'lineal_dinamico', pagos: [a] })).toBeNull()
  })
  it('un abono viejo sin foto no se anula a ciegas', () => {
    const a = abono('a', 9)
    expect(motivoParaNoDeshacerAbono(a, { modoInteres: 'saldo', pagos: [a] })).toMatch(/escríbanos/)
  })
})

describe('las dos puntas están cableadas', () => {
  const post = readFileSync('app/api/prestamos/[id]/pagos/route.js', 'utf8')
  const del = readFileSync('app/api/pagos/[id]/route.js', 'utf8')
  it('el abono guarda la deuda y las cuotas futuras ANTES de rehacerlas', () => {
    const foto = post.indexOf('tablaAntes: {\n')
    expect(foto).toBeGreaterThan(-1)
    expect(post.slice(foto, foto + 400)).toMatch(/totalAPagar: prestamoActualizado\.totalAPagar,\s+filas: filasFuturas\.map/)
    expect(foto).toBeLessThan(post.indexOf('for (const fila of tablaRecalculada)'))
    expect(foto).toBeLessThan(post.indexOf('if (filasFuturas.length > 0) {'))
  })
  it('anular pregunta antes y restaura la foto en vez de la fórmula', () => {
    expect(del).toMatch(/const motivo = motivoParaNoDeshacerAbono\(pago, pago\.prestamo\)\s+if \(motivo\) return Response\.json\(\{ error: motivo \}, \{ status: 409 \}\)/)
    expect(del).toMatch(/for \(const f of pago\.tablaAntes\.filas\)/)
    expect(del).toMatch(/data: \{ totalAPagar: pago\.tablaAntes\.totalAPagar \}/)
    expect(del).toMatch(/\} else if \(pago\.tipo === 'capital'\) \{/)
    // El orden se mide con la hora en que se registró: sin createdAt, todos «antes».
    expect(del).toMatch(/pagos: \{ select: \{[^}]*createdAt: true/)
  })
  it('la ficha enseña el motivo que da el servidor', () => {
    const ficha = readFileSync('app/(dashboard)/prestamos/[id]/page.jsx', 'utf8')
    expect(ficha).toMatch(/fetch\(`\/api\/pagos\/\$\{pagoId\}`, \{ method: 'DELETE' \}\)[\s\S]{0,400}setError\(d\.error \|\| 'No se pudo anular el pago\.'\)/)
  })
})
