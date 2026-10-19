// DETALLES-CARTERA (agente de los videos, 18 oct 2026): pasar la cartera.
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { asegurarCapital } from '@/lib/capital'
import { interesCobradoDelPrestamo } from '@/lib/dinero/interes-cobrado'
import { normalizarFecha, corregirMapeoConDatos, validarFila, textoDelCsv } from '@/lib/carga-masiva'
import { inicioPorLoAbonado } from '@/lib/cartulina-datos'

const leer = (f) => readFileSync(f, 'utf8')

describe('#1 · la fila del capital se crea antes, fuera de la transacción', () => {
  it('si ya existe no toca nada; si no, la crea; «ya existe» de otra petición no es error', async () => {
    const hay = { capital: { findUnique: vi.fn(async () => ({ id: 'c' })), create: vi.fn() } }
    await asegurarCapital(hay, 'org')
    expect(hay.capital.create).not.toHaveBeenCalled()

    const falta = { capital: { findUnique: vi.fn(async () => null), create: vi.fn(async () => ({})) } }
    await asegurarCapital(falta, 'org')
    expect(falta.capital.create).toHaveBeenCalledWith({ data: { organizationId: 'org', saldo: 0 } })

    const carrera = { capital: { findUnique: vi.fn(async () => null), create: vi.fn(async () => { throw Object.assign(new Error('dup'), { code: 'P2002' }) }) } }
    await expect(asegurarCapital(carrera, 'org')).resolves.toBeUndefined()

    const otro = { capital: { findUnique: vi.fn(async () => null), create: vi.fn(async () => { throw Object.assign(new Error('x'), { code: 'P1001' }) }) } }
    await expect(asegurarCapital(otro, 'org')).rejects.toThrow('x')
  })

  it('cada entrada de plata la llama ANTES de abrir su transacción', () => {
    const antes = (f, llamada, tx) => {
      const s = leer(f)
      const i = s.indexOf(llamada), j = s.indexOf(tx)
      expect(i, f).toBeGreaterThan(-1)
      expect(i, f).toBeLessThan(j)
    }
    antes('app/api/prestamos/route.js', 'if (!esPendiente) await asegurarCapital(prisma, organizationId)', 'const prestamo = await prisma.$transaction(')
    antes('app/api/prestamos/[id]/aprobar/route.js', 'await asegurarCapital(prisma, organizationId)', 'const updated = await prisma.$transaction(')
    antes('app/api/prestamos/[id]/renovar/route.js', 'await asegurarCapital(prisma, organizationId)', 'const nuevoPrestamo = await prisma.$transaction(')
    antes('app/api/prestamos/[id]/pagos/route.js', 'await asegurarCapital(prisma, organizationId)', 'resultado = await prisma.$transaction(')
    antes('app/api/capital/route.js', 'await asegurarCapital(prisma, organizationId)', 'const resultado = await prisma.$transaction(')
    antes('app/api/gastos/route.js', 'await asegurarCapital(prisma, session.user.organizationId)', 'const gasto = await prisma.$transaction(')
    antes('lib/importar-cartera.js', 'await asegurarCapital(prisma, organizationId)', 'await prisma.$transaction(')
  })

  it('al reintentar, el cliente ya guardado no se vuelve a crear', () => {
    const lote = leer('components/migrador/LoteFotos.jsx')
    expect(lote).toMatch(/let clienteId = f\._clienteId \|\| null/)
    expect(lote).toMatch(/if \(!clienteId\) \{\s*const resC = await fetch\('\/api\/clientes'/)
    expect(lote).toMatch(/_clienteId: conFallo\.get\(f\._id\)\.clienteId \|\| f\._clienteId \|\| null/)
    const mano = leer('app/(dashboard)/migrador/page.jsx')
    expect(mano).toMatch(/let dataCliente = clienteSinPrestamoRef\.current\?\.nombre === ficha\.nombre\.trim\(\) \? \{ id: clienteSinPrestamoRef\.current\.id \} : null/)
    expect(mano).toMatch(/clienteSinPrestamoRef\.current = \{ id: dataCliente\.id, nombre: ficha\.nombre\.trim\(\) \}/)
  })
})

describe('#2 · lo que se pasa del cuaderno no es plata de hoy', () => {
  it('el préstamo del cuaderno lleva la marca que reconoce `prestamosMigrados`', () => {
    expect(leer('app/api/prestamos/route.js')).toMatch(/descripcion: body\.yaEstabaEnLaCalle === true\s*\? `Desembolso \(carga masiva\) - \$\{cliente\.nombre\}`/)
    expect(leer('components/migrador/LoteFotos.jsx')).toMatch(/yaEstabaEnLaCalle: true,/)
    expect(leer('app/(dashboard)/migrador/page.jsx')).toMatch(/\(ficha\.esEnCurso \|\| \(ficha\.fechaInicio && ficha\.fechaInicio < hoyISO\(\)\)\) && \{ yaEstabaEnLaCalle: true \}/)
  })

  it('el Inicio deja fuera el abono previo y los préstamos migrados de hoy', () => {
    const r = leer('app/api/dashboard/resumen/route.js')
    expect(r).toMatch(/\? \{ prestamo: \{ estado: \{ not: 'cancelado' \}, cliente: \{ rutaId: \{ in: rutaIdsCobrador \} \} \}, AND: \[SIN_ABONO_PREVIO\] \}\s*: \{ prestamo: \{ estado: \{ not: 'cancelado' \} \}, AND: \[SIN_ABONO_PREVIO\] \}/)
    expect(r).toMatch(/const prestamosHoy = prestamosCreadosHoy\.filter\(\(p\) => !migradosHoy\.has\(p\.id\)\)/)
  })

  it('el interés de hoy o del mes no cuenta el abono previo; el de toda la vida sí', () => {
    const prestamo = { id: 'p', montoPrestado: 100000, totalAPagar: 120000, modoInteres: 'fijo' }
    const pagos = [
      { montoPagado: 60000, fechaPago: '2026-10-18T05:00:00.000Z', tipo: 'completo', nota: 'Abono previo (préstamo en curso)' },
      { montoPagado: 12000, fechaPago: '2026-10-18T15:00:00.000Z', tipo: 'completo', nota: null },
    ]
    const desde = new Date('2026-10-18T05:00:00Z'), hasta = new Date('2026-10-19T04:59:59Z')
    const todo = interesCobradoDelPrestamo({ prestamo, pagos })
    const hoy = interesCobradoDelPrestamo({ prestamo, pagos, desde, hasta })
    expect(Math.round(todo)).toBe(12000)
    expect(Math.round(hoy)).toBe(2000)
  })

  it('sin fecha en el papel y con abonos, empezó tantas cuotas atrás como lleva pagadas', () => {
    const fila = { monto: 400000, tasa: 20, frecuencia: 'diario', plazoUnidades: 30, modoInteres: 'fijo', hoy: '2026-10-18' }
    expect(inicioPorLoAbonado({ ...fila, yaAbonado: 160000 })).toBe('2026-10-08') // 10 cuotas de $16.000
    expect(inicioPorLoAbonado({ ...fila, yaAbonado: 0 })).toBe('2026-10-18')
    expect(inicioPorLoAbonado({ ...fila, yaAbonado: 10000 })).toBe('2026-10-18') // menos de una cuota
    expect(inicioPorLoAbonado({ ...fila, yaAbonado: 160000, fechaInicio: '2026-10-01' })).toBe('2026-10-01')
    // Semanal: la cuota la saca el mismo cálculo con que se creará el préstamo.
    expect(inicioPorLoAbonado({ ...fila, frecuencia: 'semanal', plazoUnidades: 4, yaAbonado: 300000, monto: 400000 })).toBe('2026-10-04') // 2 semanas
  })
})

describe('#3 y #4 · Importar Excel', () => {
  it('el CSV en UTF-8 conserva las tildes; el de Excel en español también', () => {
    const utf8 = new TextEncoder().encode('﻿Nombre\nGloria Inés Mejía\n')
    expect(textoDelCsv(utf8.buffer)).toBe('Nombre\nGloria Inés Mejía\n')
    const latin = new Uint8Array([0x4d, 0x61, 0x72, 0xed, 0x61]) // «María» en Windows-1252
    expect(textoDelCsv(latin.buffer)).toBe('María')
    expect(leer('components/carga-masiva/PasoSubir.jsx')).toMatch(/\? XLSX\.read\(textoDelCsv\(data\), \{ type: 'string', raw: true \}\)/)
  })

  it('la fecha de Excel con la hora en decimales cuenta el día', () => {
    expect(normalizarFecha('46300.79148148148')).toBe('2026-10-06')
    expect(normalizarFecha('46301')).toBe('2026-10-06')
    expect(normalizarFecha('2026-10-06')).toBe('2026-10-06')
  })

  it('«Cuota» con valores de plata es el valor de la cuota, no el número de cuotas', () => {
    const filas = [{ Cuota: '16000' }, { Cuota: '8000' }, { Cuota: '90000' }]
    expect(corregirMapeoConDatos({ Cuota: 'numeroCuotas' }, filas)).toEqual({ Cuota: 'valorCuota' })
    expect(corregirMapeoConDatos({ Cuotas: 'numeroCuotas' }, [{ Cuotas: '30' }, { Cuotas: '24' }])).toEqual({ Cuotas: 'numeroCuotas' })
  })

  it('con la cuota y la tasa, salen las cuotas; sin tasa en el archivo, se pide una vez', () => {
    const v = validarFila({ nombre: 'Martha', montoPrestado: '400000', valorCuota: '16000', tasaInteres: 20, frecuencia: 'diario', fechaInicio: '2026-10-06' }, 0, new Map())
    expect(v.errores).toEqual([])
    expect(v.advertencias).toContain('30 cuotas de $16.000: salen del monto con el 20 % de interés')
    expect(leer('components/carga-masiva/PasoMapear.jsx')).toMatch(/const pideTasa = camposAsignados\.has\('montoPrestado'\) && !camposAsignados\.has\('tasaInteres'\)/)
    expect(leer('app/(dashboard)/carga-masiva/page.jsx')).toMatch(/if \(fila\.tasaInteres == null \|\| String\(fila\.tasaInteres\)\.trim\(\) === ''\) fila\.tasaInteres = tasaParaTodos/)
  })
})

describe('#6 · «Escribir uno a mano» pide solo el nombre', () => {
  it('ni la cédula ni el teléfono son obligatorios', () => {
    const p = leer('app/(dashboard)/migrador/page.jsx')
    expect(p).not.toMatch(/setError\('La cédula es obligatoria'\)/)
    expect(p).not.toMatch(/setError\('El teléfono es obligatorio'\)/)
    expect(p).toMatch(/const cedulaFinal = sinCedula \|\| !ficha\.cedula\.trim\(\)/)
  })
})
