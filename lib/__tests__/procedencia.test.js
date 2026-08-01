// Ninguna cifra de dinero sin explicación.
//
// ══ POR QUE ════════════════════════════════════════════════════════════════
//
// La regla que gobierna esta parte del trabajo: si no se puede escribir la
// pregunta que contesta un número, qué entra y qué no, y de qué filas sale,
// entonces ese número sobra en la pantalla.
//
// Esta prueba la hace cumplir. No comprueba que las explicaciones sean buenas
// —eso no lo puede comprobar una máquina— pero sí que EXISTAN, que no estén
// vacías y que no se cuele una cifra nueva sin ellas.

import { describe, it, expect } from 'vitest'
import { PROCEDENCIA, explicar, faltanExplicacion } from '../dinero/procedencia'
import { ALCANCE, resumirLibro, conciliar, lineasDeLaBanda } from '../dinero/conciliacion'

describe('el catálogo está completo', () => {
  it('cada cifra dice qué pregunta contesta y qué entra en ella', () => {
    const incompletas = []
    for (const [id, e] of Object.entries(PROCEDENCIA)) {
      if (!e.rotulo?.trim()) incompletas.push(`${id}: sin rótulo`)
      if (!e.pregunta?.trim()) incompletas.push(`${id}: sin pregunta`)
      if (!e.universo?.trim()) incompletas.push(`${id}: sin universo`)
      if (!e.formula?.trim()) incompletas.push(`${id}: sin fórmula`)
    }
    expect(incompletas).toEqual([])
  })

  it('la pregunta está escrita como la haría el prestamista, no como un informe', () => {
    const raras = []
    for (const [id, e] of Object.entries(PROCEDENCIA)) {
      if (!e.pregunta.includes('?')) raras.push(`${id}: la pregunta no pregunta`)
      // «bruto», «neto», «periodo», «agregado» son palabras de contabilidad, no
      // de un prestamista mirando su caja a las ocho de la noche.
      if (/\b(bruto|neto|agregado|KPI)\b/i.test(e.pregunta)) raras.push(`${id}: jerga en la pregunta`)
    }
    expect(raras).toEqual([])
  })

  it('el universo dice qué NO entra, que es donde están todas las discusiones', () => {
    // Al menos las cifras con filas tienen que acotar. Las derivadas se
    // explican con su fórmula.
    const sinAcotar = []
    for (const [id, e] of Object.entries(PROCEDENCIA)) {
      if (!e.filas) continue
      if (!/\bNO\b|\bno cuenta|\bsin \b|\btampoco\b|\bnunca\b|\bsolo\b|\bSOLO\b/i.test(e.universo)) {
        sinAcotar.push(id)
      }
    }
    expect(sinAcotar, 'el universo tiene que decir qué queda fuera').toEqual([])
  })
})

describe('lo que la caja pinta, la caja lo explica', () => {
  /* ── EL GUARDIA ─────────────────────────────────────────────────────────
     Si alguien añade una línea nueva a la banda sin escribir de dónde sale,
     esta prueba se pone roja. Es lo que impide volver a tener números que
     nadie sabe explicar — que es como llegamos a 47 cifras en el panel y un
     botón de «mostrar más KPIs». */
  it('todas las líneas de la banda tienen su explicación', () => {
    const mov = (tipo, monto, saldoAnterior, extra = {}) => ({
      tipo, monto, saldoAnterior, saldoNuevo: saldoAnterior + monto,
      createdAt: new Date('2026-08-01T12:00:00Z'), ...extra,
    })
    // Un día con TODOS los tipos de movimiento, para que la banda genere todas
    // sus líneas posibles.
    const libro = resumirLibro([
      { ...mov('recaudo', 300000, 1000000), metodoPago: 'efectivo' },
      mov('inyeccion', 50000, 1300000),
      { ...mov('desembolso', 0, 1350000), monto: 200000, saldoNuevo: 1150000 },
      { ...mov('gasto', 0, 1150000), monto: 50000, saldoNuevo: 1100000 },
      { ...mov('retiro', 0, 1100000), monto: 30000, saldoNuevo: 1070000 },
      { ...mov('ajuste', 0, 1070000), monto: 5000, saldoNuevo: 1075000, descripcion: 'Cuadre' },
    ])
    const c = conciliar({
      alcance: ALCANCE.ORGANIZACION,
      libro,
      operaciones: { pagos: 300000, pagosEfectivo: 300000, pagosDigital: 0, gastos: 50000, desembolsos: 200000 },
    })
    const ids = lineasDeLaBanda(c).lineas.map((l) => l.id)

    expect(ids.length, 'la banda debería generar varias líneas').toBeGreaterThan(4)
    expect(faltanExplicacion(ids), 'líneas que la banda pinta y nadie explica').toEqual([])
  })

  it('las cifras del resumen del cobrador también', () => {
    const delResumen = [
      'recaudo', 'recaudoEfectivo', 'recaudoDigital', 'desembolsos', 'gastos',
      'enMano', 'esperado', 'atrasado',
      'prestamosNuevos', 'renovaciones', 'clientesNuevos', 'seguros', 'recargos',
    ]
    expect(faltanExplicacion(delResumen)).toEqual([])
  })
})

describe('explicar()', () => {
  it('devuelve la explicación con su id', () => {
    const e = explicar('recaudo')
    expect(e.id).toBe('recaudo')
    expect(e.pregunta).toMatch(/\?/)
  })

  it('devuelve null si no la conoce, en vez de inventarse una', () => {
    expect(explicar('cifra-que-no-existe')).toBeNull()
  })
})

describe('las decisiones de negocio quedan escritas donde se leen', () => {
  /* Estas tres son las que más discusión han costado en la auditoría. Que
     estén en el catálogo significa que el prestamista puede leerlas en la
     pantalla, no que haya que explicárselas por teléfono. */
  it('el recargo no es plata que entró', () => {
    expect(PROCEDENCIA.recargos.universo).toMatch(/no es plata que haya entrado/i)
  })

  it('el seguro ya viene dentro de la cuota', () => {
    expect(PROCEDENCIA.seguros.universo).toMatch(/no se suma al efectivo/i)
  })

  it('la renovación no saca de la caja el saldo viejo', () => {
    expect(PROCEDENCIA.renovaciones.universo).toMatch(/nunca sale de la caja/i)
    expect(PROCEDENCIA.desembolsos.universo).toMatch(/nunca sale de la caja/i)
  })

  it('en la mano solo hay efectivo', () => {
    expect(PROCEDENCIA.enMano.universo).toMatch(/SOLO EFECTIVO/)
    expect(PROCEDENCIA.recaudoDigital.universo).toMatch(/NO la trae el cobrador/i)
  })
})
