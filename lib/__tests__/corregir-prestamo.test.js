import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { puedeCorregirse, esDesembolsoCorregido, MARCA_CORREGIDO, PREFIJO_CORRECCION } from '@/lib/dinero/corregir-prestamo'
import { esAsientoDeMigracion } from '@/lib/dinero/abono-previo'
import { afectaElFajo } from '@/lib/dinero/conciliacion'

/* Créditos pete, 15 nov 2026: borró a Otilia y a Wendy (préstamos del 10 nov) y
   los volvió a crear. La plata salió dos veces de su bolsa: $2.000.000. En 90
   días, 238 casos en 32 negocios. Corregir reemplaza el préstamo sin volver a
   contar la plata. */

// 15 nov 2026, 2 p. m. en Bogotá.
const AHORA = Date.parse('2026-11-15T19:00:00.000Z')
const AYER = '2026-11-10T20:00:00.000Z'
const HOY = '2026-11-15T15:00:00.000Z'
const base = (extra = {}) => ({ estado: 'activo', renovadoDeId: null, createdAt: AYER, pagos: [], ...extra })

describe('¿se puede corregir?', () => {
  it('un préstamo de otro día sin cobros de hoy, sí; y dice lo ya cobrado', () => {
    const p = base({ pagos: [
      { tipo: 'intereses', montoPagado: 120000, fechaPago: '2026-10-02T05:00:00.000Z', createdAt: AYER },
      { tipo: 'capital', montoPagado: 200000, fechaPago: '2026-10-15T05:00:00.000Z', createdAt: AYER },
      { tipo: 'recargo', montoPagado: 5000, fechaPago: AYER, createdAt: AYER },
    ] })
    expect(puedeCorregirse(p, { desembolsoEl: AYER, ahora: AHORA })).toEqual({ puede: true, cobrado: 320000 })
  })

  it('el de hoy no: borrarlo ya devuelve todo', () => {
    const r = puedeCorregirse(base({ createdAt: HOY }), { desembolsoEl: HOY, ahora: AHORA })
    expect(r.puede).toBe(false)
    expect(r.motivo).toMatch(/Es de hoy/)
  })

  it('el ya corregido hoy sí se puede volver a corregir: su plata no es de hoy', () => {
    expect(puedeCorregirse(base({ createdAt: HOY }), { desembolsoEl: HOY, yaCorregido: true, ahora: AHORA }).puede).toBe(true)
  })

  it('con cobros de hoy no: están en el fajo y pasarían a abono previo', () => {
    const p = base({ pagos: [{ tipo: 'completo', montoPagado: 520000, fechaPago: HOY, createdAt: HOY }] })
    const r = puedeCorregirse(p, { desembolsoEl: AYER, ahora: AHORA })
    expect(r.puede).toBe(false)
    expect(r.motivo).toMatch(/cobros de hoy \(\$520\.000\)/)
  })

  it('ni una renovación ni uno que no está activo', () => {
    expect(puedeCorregirse(base({ renovadoDeId: 'x' }), { desembolsoEl: AYER, ahora: AHORA }).puede).toBe(false)
    expect(puedeCorregirse(base({ estado: 'completado' }), { desembolsoEl: AYER, ahora: AHORA }).puede).toBe(false)
  })
})

describe('la plata del corregido no se cuenta otra vez', () => {
  const desembolso = { tipo: 'desembolso', referenciaTipo: 'prestamo', referenciaId: 'n', descripcion: `Desembolso ${MARCA_CORREGIDO} - Otilia` }

  it('su desembolso es un asiento de migración: no es «lo que prestaste» de hoy', () => {
    expect(esDesembolsoCorregido(desembolso)).toBe(true)
    expect(esAsientoDeMigracion(desembolso)).toBe(true)
  })

  it('la diferencia de monto mueve la bolsa y no el fajo', () => {
    const m = { tipo: 'ajuste', monto: 100000, saldoAnterior: 1000000, saldoNuevo: 900000, metodoPago: 'efectivo',
      descripcion: `${PREFIJO_CORRECCION} - Otilia: era de $1.000.000 y es de $1.100.000` }
    expect(afectaElFajo(m, new Set())).toBe(false)
  })

  const api = readFileSync('app/api/prestamos/route.js', 'utf8')
  it('el alta: desembolso y abono previo sin mover el capital, y el viejo se va sin reversos', () => {
    expect(api).toMatch(/\/\/ Corregido: esa plata salió con el préstamo viejo y sigue contada\.\n\s+noMueveCapital: !!correccion,/)
    expect(api).toMatch(/\/\/ Corregido: esos cobros ya entraron con el préstamo viejo\.\n\s+noMueveCapital: !!correccion,/)
    expect(api).toMatch(/await tx\.pago\.deleteMany\(\{ where: \{ prestamoId: corrigeA \} \}\)\n\s+await tx\.prestamo\.delete\(\{ where: \{ id: corrigeA \} \}\)/)
    expect(api).toMatch(/if \(Math\.round\(abono\) !== correccion\.cobrado\)/)
    expect(api).toMatch(/if \(modoEstricto && tieneCapital && !correccion\)/)
  })

  it('solo el dueño, y lo vuelve a preguntar al guardar', () => {
    expect(api).toMatch(/if \(corrigeA\) \{\n\s+if \(rol !== 'owner'\)/)
    expect(api).toMatch(/correccion = await evaluarCorreccion\(prisma,/)
  })

  it('la pantalla lo ofrece al borrar y el formulario manda corrigeA', () => {
    const det = readFileSync('app/(dashboard)/prestamos/[id]/page.jsx', 'utf8')
    expect(det).toMatch(/>\s*Corregir el préstamo\s*<\/button>/)
    const nuevo = readFileSync('app/(dashboard)/prestamos/nuevo/page.jsx', 'utf8')
    expect(nuevo).toMatch(/\.\.\.\(correccion && \{ corrigeA: corrigeParam \}\),/)
    expect(nuevo).toMatch(/if \(correccion\) \{\n\s+setError\('Para corregir el préstamo necesitas señal/)
  })
})
