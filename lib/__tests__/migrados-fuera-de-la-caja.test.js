// Los préstamos migrados no son plata del día (decisión del dueño, 18 oct 2026).
//
// Pasar al sistema un préstamo que ya estaba en la calle asienta su desembolso
// el día que se carga y su abono previo con la fecha de inicio. La caja los
// contaba como plata movida: a Andrés le salían $200.000 prestados de Luz
// Marina, migrada de septiembre. Siguen moviendo el capital, en su propia línea.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { esAsientoDeMigracion, SIN_ABONO_PREVIO, PREFIJO_ABONO_PREVIO } from '@/lib/dinero/abono-previo'
import { resumirLibro, conciliar, lineasDeLaBanda, ALCANCE } from '@/lib/dinero/conciliacion'

const leer = (f) => readFileSync(f, 'utf8')

// Un asiento con sus dos fotos de saldo, como los escribe `registrarMovimientoCapital`.
let saldo = 1_000_000
const asiento = (tipo, monto, descripcion, extra = {}) => {
  const antes = saldo
  saldo += (tipo === 'recaudo' || tipo === 'inyeccion') ? monto : -monto
  return { id: `${tipo}-${descripcion}-${monto}`, tipo, monto, descripcion, saldoAnterior: antes, saldoNuevo: saldo, createdAt: new Date(Date.now() + saldo), referenciaTipo: 'prestamo', ...extra }
}

describe('qué asiento es la entrada de un migrado', () => {
  const migrados = new Set(['luz'])
  it('el desembolso original de un migrado, el de la carga masiva y el abono previo', () => {
    expect(esAsientoDeMigracion({ tipo: 'desembolso', descripcion: 'Desembolso préstamo a Luz Marina', referenciaTipo: 'prestamo', referenciaId: 'luz' }, migrados)).toBe(true)
    expect(esAsientoDeMigracion({ tipo: 'desembolso', descripcion: 'Desembolso (carga masiva) - Ana', referenciaTipo: 'prestamo', referenciaId: 'x' })).toBe(true)
    expect(esAsientoDeMigracion({ tipo: 'desembolso', descripcion: 'Mercancía (carga masiva) - Ana', referenciaTipo: 'prestamo', referenciaId: 'x' })).toBe(true)
    expect(esAsientoDeMigracion({ tipo: 'recaudo', descripcion: 'Abono previo préstamo en curso - Luz Marina' })).toBe(true)
    expect(esAsientoDeMigracion({ tipo: 'recaudo', descripcion: 'Abono previo (carga masiva) - Ana' })).toBe(true)
  })
  it('un préstamo de verdad, un cobro, la edición y la reserva de ruta, no', () => {
    expect(esAsientoDeMigracion({ tipo: 'desembolso', descripcion: 'Desembolso préstamo a Libardo', referenciaTipo: 'prestamo', referenciaId: 'libardo' }, migrados)).toBe(false)
    expect(esAsientoDeMigracion({ tipo: 'recaudo', descripcion: 'Pago de Luz Marina', referenciaTipo: 'pago', referenciaId: 'p1' }, migrados)).toBe(false)
    expect(esAsientoDeMigracion({ tipo: 'desembolso', descripcion: 'Desembolso actualizado - Luz Marina', referenciaTipo: 'prestamo', referenciaId: 'luz' }, migrados)).toBe(false)
    expect(esAsientoDeMigracion({ tipo: 'desembolso', descripcion: 'Reserva de capital por préstamo de cliente asignado a la ruta', referenciaTipo: 'prestamo', referenciaId: 'luz', ajusteArranqueRuta: true }, migrados)).toBe(false)
  })
  it('el filtro de Prisma deja pasar las notas NULL (MariaDB las tiraría con un NOT a secas)', () => {
    expect(SIN_ABONO_PREVIO).toEqual({ OR: [{ nota: null }, { NOT: { nota: { startsWith: PREFIJO_ABONO_PREVIO } } }] })
  })
})

describe('el libro: la migración en su línea, la alarma en cero', () => {
  saldo = 1_000_000
  const movs = [
    asiento('recaudo', 50_000, 'Pago de Fabián', { referenciaTipo: 'pago', referenciaId: 'pago-1' }),
    asiento('desembolso', 400_000, 'Desembolso préstamo a Libardo', { referenciaId: 'libardo' }),
    // Luz Marina: migrada con su abono previo por el total.
    asiento('desembolso', 200_000, 'Desembolso préstamo a Luz Marina', { referenciaId: 'luz' }),
    asiento('recaudo', 220_000, 'Abono previo préstamo en curso - Luz Marina', { referenciaId: 'luz' }),
    // Una carga masiva con abono parcial.
    asiento('desembolso', 300_000, 'Desembolso (carga masiva) - Ana', { referenciaId: 'ana' }),
    asiento('recaudo', 100_000, 'Abono previo (carga masiva) - Ana', { referenciaId: 'ana' }),
  ]
  const apertura = 1_000_000
  const libro = resumirLibro(movs, apertura, saldo, { migrados: new Set(['luz', 'ana']) })

  it('lo que entró y lo que se prestó son solo la plata del día', () => {
    expect(libro.recaudo).toBe(50_000)
    expect(libro.desembolsos).toBe(400_000)
    // −200.000 + 220.000 − 300.000 + 100.000
    expect(libro.migraciones).toBe(-180_000)
    expect(libro.migracionesCantidad).toBe(4)
  })
  it('contra las operaciones del día (sin migrados) todo cuadra', () => {
    const c = conciliar({
      alcance: ALCANCE.ORGANIZACION,
      libro,
      operaciones: { pagos: 50_000, pagosEfectivo: 50_000, pagosDigital: 0, gastos: 0, desembolsos: 400_000 },
    })
    expect(c.diferencias).toEqual({ recaudo: 0, gastos: 0, desembolsos: 0, sinExplicar: 0 })
    expect(c.cuadra).toBe(true)
  })
  it('la banda lo enseña con su nombre y su suma da el saldo', () => {
    const c = conciliar({ alcance: ALCANCE.ORGANIZACION, libro, operaciones: { pagos: 50_000, pagosEfectivo: 50_000, pagosDigital: 0, gastos: 0, desembolsos: 400_000 } })
    const b = lineasDeLaBanda(c)
    expect(b.lineas.find((l) => l.id === 'migraciones')).toMatchObject({ rotulo: 'Préstamos que ya estaban en la calle', monto: 180_000, signo: -1 })
    expect(b.cuadra).toBe(true)
    expect(b.suma).toBe(saldo)
  })
  it('sin migrados el libro es el de siempre', () => {
    saldo = 1_000_000
    const normales = [asiento('recaudo', 50_000, 'Pago', { referenciaTipo: 'pago' }), asiento('desembolso', 400_000, 'Desembolso préstamo a Libardo', { referenciaId: 'libardo' })]
    const l = resumirLibro(normales, 1_000_000, saldo)
    expect(l.migraciones).toBe(0)
    expect(l.recaudo).toBe(50_000)
    expect(l.desembolsos).toBe(400_000)
  })
})

describe('todas las vías de la caja dejan fuera a los migrados', () => {
  it('lo prestado del día (caja del cobrador y del dueño) y su detalle', () => {
    const d = leer('lib/dinero/desembolsado.js')
    expect(d).toMatch(/const migrados = await prestamosMigrados\(prisma, todas\.map\(\(f\) => f\.prestamoId\)\)\s*const filas = todas\.filter\(\(f\) => !migrados\.has\(f\.prestamoId\)\)/)
    const s = leer('lib/caja/stats-dia.js')
    expect(s).toMatch(/fechaPago: \{ gte: inicio, lt: fin \},[^}]*AND: \[SIN_ABONO_PREVIO\],/)
    expect(s).toMatch(/resumirLibro\(movimientosDia, saldoPrevioDelDia, cobradorId \? null : saldoCapitalActual, \{ migrados: migradosDelLibro \}\)/)
    expect(s.match(/prestamosMigrados\(prisma/g)?.length).toBe(3)
  })
  it('la caja del administrador: cobros, préstamos y la bolsa de la ruta', () => {
    const a = leer('app/api/caja/cobrador/[id]/route.js')
    expect(a).toMatch(/AND: \[SIN_ABONO_PREVIO\],\s*OR: \[\s*\{ cobradorId \},/)
    expect(a).toMatch(/const migrados = await prestamosMigrados\(prisma, items\.map\(\(i\) => i\.id\)\)\s*return items\.filter\(\(i\) => !migrados\.has\(i\.id\)\)/)
    expect(a).toMatch(/\+ inyeccionesDia - retirosDia \+ ajustesDia \+ migracionesDia/)
    expect(a).toMatch(/correccionesDeLibro: Math\.round\(ajustesDia - ajustesEfectivo \+ migracionesDia\)/)
  })
  it('la lista del día, el historial por rango, el cierre automático y «de dónde sale»', () => {
    const c = leer('app/api/caja/route.js')
    expect(c.match(/AND: \[SIN_ABONO_PREVIO\]/g)?.length).toBe(4)
    expect(leer('app/api/caja/cierre-auto/route.js')).toMatch(/AND: \[SIN_ABONO_PREVIO\]/)
    const p = leer('app/api/caja/procedencia/route.js')
    expect(p).toMatch(/AND: \[SIN_ABONO_PREVIO\]/)
    expect(p).toMatch(/filas = prestamos\.filter\(\(p\) => !migrados\.has\(p\.id\)\)/)
  })
})

describe('los asientos de sus préstamos, aunque no lleven su ruta', () => {
  // Andrés, 17 oct: la renovación de Nubia la hizo la dueña en un negocio sin
  // capital por ruta. Su asiento ($500.000) iba sin `rutaId` y a nombre de la
  // dueña: la caja del cobrador decía $548.000 (la cartulina) y la del
  // administrador $0. Medido: 61 préstamos en 30 días, 35 renovaciones.
  it('las tres vías buscan también por el préstamo', () => {
    const porPrestamo = /\.\.\.\(idsDeSusRutas\.length > 0 \? \[\{ referenciaId: \{ in: idsDeSusRutas \} \}\] : \[\]\)/
    expect(leer('lib/dinero/desembolsado.js')).toMatch(porPrestamo)
    expect(leer('lib/caja/stats-dia.js')).toMatch(porPrestamo)
    expect(leer('app/api/caja/cobrador/[id]/route.js')).toMatch(porPrestamo)
  })
})

describe('el préstamo que se creó y se borró el mismo día no pasó', () => {
  it('su desembolso, su abono previo y sus reversos se anulan; los cobros normales siguen como siempre', () => {
    saldo = 1_000_000
    const L = 'borrado'
    const movs = [
      asiento('recaudo', 30_000, 'Pago de Fabián', { referenciaTipo: 'pago', referenciaId: 'pago-1' }),
      asiento('desembolso', 600_000, 'Desembolso préstamo a Hijo de José', { referenciaId: L }),
      asiento('recaudo', 60_000, 'Abono previo préstamo en curso - Hijo de José', { referenciaId: L }),
      // Un cobro normal del mismo préstamo, y luego se borra todo.
      asiento('recaudo', 20_000, 'Pago de Hijo de José', { referenciaTipo: 'pago', referenciaId: 'pago-2' }),
      asiento('ajuste', 600_000, 'Reverso desembolso - préstamo eliminado (Hijo de José)', { referenciaId: L, saldoNuevo: null }),
    ]
    // El reverso del desembolso SUBE el saldo; los de los cobros lo bajan.
    const rev = movs[movs.length - 1]; rev.saldoAnterior = saldo; saldo += 600_000; rev.saldoNuevo = saldo
    const bajar = (monto, desc) => { const a = { id: desc + monto, tipo: 'ajuste', monto, descripcion: desc, referenciaTipo: 'pago', referenciaId: L, saldoAnterior: saldo, saldoNuevo: saldo - monto, createdAt: new Date() }; saldo -= monto; return a }
    movs.push(bajar(60_000, 'Reverso recaudo - préstamo eliminado'), bajar(20_000, 'Reverso recaudo - préstamo eliminado'))
    const libro = resumirLibro(movs, 1_000_000, saldo, { migrados: new Set() })
    // Solo queda el cobro de Fabián: el de $20.000 y su reverso se anulan en «Lo que entró».
    expect(libro.recaudo).toBe(30_000)
    expect(libro.desembolsos).toBe(0)
    expect(libro.ajustes).toBe(0)
    expect(libro.anulados).toBe(0)
    expect(libro.anuladosCantidad).toBe(4)
    const c = conciliar({ alcance: ALCANCE.ORGANIZACION, libro, operaciones: { pagos: 30_000, pagosEfectivo: 30_000, pagosDigital: 0, gastos: 0, desembolsos: 0 } })
    expect(c.diferencias).toEqual({ recaudo: 0, gastos: 0, desembolsos: 0, sinExplicar: 0 })
    expect(lineasDeLaBanda(c).lineas.some((l) => l.id === 'anulados')).toBe(false)
  })
  it('si se creó otro día, borrarlo hoy sigue siendo una corrección', () => {
    saldo = 1_000_000
    const rev = { id: 'r', tipo: 'ajuste', monto: 500_000, descripcion: 'Reverso desembolso - préstamo eliminado (Ana)', referenciaTipo: 'prestamo', referenciaId: 'viejo', saldoAnterior: 1_000_000, saldoNuevo: 1_500_000, createdAt: new Date() }
    const libro = resumirLibro([rev], 1_000_000, 1_500_000)
    expect(libro.anulados).toBe(0)
    expect(libro.ajustes).toBe(500_000)
  })
})

describe('el reverso de un abono previo va con su abono', () => {
  it('anular el abono de un migrado no resta de «Lo que entró»', () => {
    saldo = 1_000_000
    const movs = [
      asiento('desembolso', 500_000, 'Desembolso préstamo a Jhon', { referenciaId: 'jhon' }),
      asiento('recaudo', 390_000, 'Abono previo préstamo en curso - Jhon', { referenciaId: 'jhon' }),
    ]
    const r = { id: 'rev', tipo: 'ajuste', monto: 390_000, descripcion: 'Reverso pago anulado - préstamo', referenciaTipo: 'pago', referenciaId: 'jhon', saldoAnterior: saldo, saldoNuevo: saldo - 390_000, createdAt: new Date() }
    saldo -= 390_000
    const libro = resumirLibro([...movs, r], 1_000_000, saldo, { migrados: new Set(['jhon']) })
    expect(libro.recaudo).toBe(0)
    expect(libro.migraciones).toBe(-500_000)
    const c = conciliar({ alcance: ALCANCE.ORGANIZACION, libro, operaciones: { pagos: 0, pagosEfectivo: 0, pagosDigital: 0, gastos: 0, desembolsos: 0 } })
    expect(c.diferencias).toEqual({ recaudo: 0, gastos: 0, desembolsos: 0, sinExplicar: 0 })
  })
})

describe('el libro del cobrador mira lo mismo que su caja', () => {
  it('los asientos de los préstamos de sus clientes de ese día, aunque queden sin ruta o en otra', () => {
    const s = leer('lib/caja/stats-dia.js')
    expect(s).toMatch(/\.\.\.\(prestamosSuyosDelDia\.length \? \[\{ referenciaTipo: 'prestamo', referenciaId: \{ in: prestamosSuyosDelDia \} \}\] : \[\]\)/)
  })
  it('el préstamo creado y borrado ese mismo día tampoco cuenta como entregado', () => {
    const s = leer('lib/caja/stats-dia.js')
    expect(s).toMatch(/if \(migrados\.has\(id\) \|\| anuladosEseDia\.has\(id\)\) continue/)
  })
})
