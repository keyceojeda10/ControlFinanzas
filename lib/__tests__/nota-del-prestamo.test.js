import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { limpiarNota, conNota, NOTA_MAX } from '@/lib/prestamos/nota'

/* Soporte del 15 nov 2026: «una nota que coloque uno ahí cuando se hace el
   crédito … cuando le va a cobrar ahí aparece la nota. O cuando la plataforma
   le dice fulano ya le venció el crédito». */
const leer = (f) => readFileSync(f, 'utf8')

describe('la nota del crédito', () => {
  it('se guarda limpia: recortada, y vacía es null', () => {
    expect(limpiarNota('  paga los 20  ')).toBe('paga los 20')
    expect(limpiarNota('   ')).toBeNull()
    expect(limpiarNota(undefined)).toBeNull()
    expect(limpiarNota('x'.repeat(900))).toHaveLength(NOTA_MAX)
  })

  it('va detrás del aviso de atraso, y sin nota el aviso no cambia', () => {
    expect(conNota('Lleva 3 días de atraso. Debe $20.000.', 'paga los 20'))
      .toBe('Lleva 3 días de atraso. Debe $20.000. Tu nota: «paga los 20»')
    expect(conNota('Debe $20.000.', null)).toBe('Debe $20.000.')
    expect(conNota('Debe.', 'x'.repeat(300))).toMatch(/«x{139}…»$/)
  })

  it('el esquema la tiene y la columna tiene su SQL', () => {
    expect(leer('prisma/schema.prisma')).toMatch(/\n {2}nota {11}String\? {8}@db\.Text/)
    expect(leer('prisma/migraciones-manuales/2026-11-15-nota-del-prestamo.sql')).toMatch(/ALTER TABLE `Prestamo` ADD COLUMN `nota` TEXT NULL;/)
  })

  it('se escribe al prestar y se edita después, con pagos o sin ellos', () => {
    expect(leer('app/api/prestamos/route.js')).toMatch(/\.\.\.\(limpiarNota\(body\.nota\) && \{ nota: limpiarNota\(body\.nota\) \}\),/)
    expect(leer('app/(dashboard)/prestamos/nuevo/page.jsx')).toMatch(/\.\.\.\(nota\.trim\(\) && \{ nota: nota\.trim\(\) \}\),/)
    const patch = leer('app/api/prestamos/[id]/route.js')
    expect(patch).toMatch(/if \(modo === 'nota'\) \{/)
    expect(patch).toMatch(/data: \{ nota \}/)
  })

  it('se ve en el préstamo, al cobrar, en WhatsApp y en el aviso de atraso', () => {
    expect(leer('app/(dashboard)/prestamos/[id]/page.jsx')).toMatch(/<NotaDelPrestamo\s/)
    expect(leer('components/prestamos/RegistrarPago.jsx')).toMatch(/notaPrestamo=\{prestamo\?\.nota \|\| null\}/)
    expect(leer('components/pantallas/RegistrarCobro.jsx')).toMatch(/\{notaPrestamo && \(/)
    expect(leer('components/whatsapp/HojaWhatsApp.jsx')).toMatch(/nota=\{prestamo\?\.nota \|\| null\}/)
    const cron = leer('app/api/cron/mora-alertas/route.js')
    expect(cron).toMatch(/nota: true,/)
    expect(cron.split('mensaje: conNota(').length - 1).toBe(2)
  })

  it('las listas que abren la hoja de cobro con `select` la piden (un campo sin pedir es undefined)', () => {
    expect(leer('app/api/clientes/route.js')).toMatch(/modoInteres: true,\n\s+\/\/ La nota del crédito[^\n]*\n\s+nota: true,/)
  })
})
