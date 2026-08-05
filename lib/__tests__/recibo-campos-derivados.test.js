import { describe, it, expect } from 'vitest'
import { PLANTILLAS, generarTextoPlantilla } from '@/lib/whatsapp-plantillas'

// ── EL COMPROBANTE SALÍA CON GUIONES Y CON 0% ───────────────────────────────
//
// Reportado por un cliente NUEVO, en pleno periodo de prueba: «este comprobante
// no me muestra el número de cuotas pendientes y cuota cancelada».
//
// Su recibo real decía:
//   Cuota actual:      -        ← debía decir «1 de 4»
//   Cuotas restantes:  -        ← esta sí salía, pero él vio el guion de arriba
//   Progreso:          0%       ← había pagado $140.000 de $560.000 = 25%
//
// La causa: `numeroCuota` y `porcentajePagado` NO EXISTEN en la base. Los pone
// el API cuando el préstamo pasa por él. Desde `RegistrarPago` llega el objeto
// crudo de Prisma, así que esos campos venían `undefined` y se pintaban como
// guion y como cero.
//
// Datos reales de OLGA VELLOGIN (asford), leídos de producción.
const OLGA = {
  id: 'x',
  montoPrestado: 400000,
  totalAPagar: 560000,
  cuotaDiaria: 140000,
  frecuencia: 'mensual',
  diasPlazo: 120,
  modoInteres: 'fijo',
  totalPagado: 140000,
  saldoPendiente: 420000,
  estado: 'activo',
  cuotasAmortizacion: [],   // sin tabla: es lo que hay en producción
}

const recibo = (prestamo = OLGA, campos = []) => generarTextoPlantilla(
  'pago_confirmacion',
  {
    cliente: { nombre: 'OLGA VELLOGINÑ', telefono: '3001234567' },
    prestamo,
    pago: { montoPagado: 140000, fechaPago: '2026-08-04T23:18:00.000Z', tipo: 'completo' },
    orgNombre: 'asford',
    camposRecibo: campos,
  },
  'org-asford',
)

describe('el comprobante de un préstamo sin tabla', () => {
  it('dice en qué cuota va, no un guion', () => {
    const t = recibo(OLGA, [{ nombre: 'Cuota actual', tipo: 'dato', campo: 'numeroCuota' }])
    expect(t, 'sigue saliendo el guion').not.toContain('Cuota actual: -')
    expect(t).toContain('Cuota actual: 1 de 4')
  })

  it('dice cuántas faltan', () => {
    const t = recibo(OLGA, [{ nombre: 'Cuotas restantes', tipo: 'dato', campo: 'cuotasRestantes' }])
    expect(t).toContain('Cuotas restantes: 3')
  })

  it('el progreso es el real, no 0%', () => {
    // $140.000 de $560.000 = 25%.
    const t = recibo()
    expect(t, 'el progreso vuelve a salir en cero').not.toContain('Progreso: 0%')
    expect(t).toContain('Progreso: 25%')
  })

  it('el que aún no ha pagado nada no dice «cuota 0»', () => {
    // Sin pagos no hay cuota en curso que nombrar: ahí el guion SÍ es correcto.
    const t = recibo({ ...OLGA, totalPagado: 0, saldoPendiente: 560000 },
      [{ nombre: 'Cuota actual', tipo: 'dato', campo: 'numeroCuota' }])
    expect(t).toContain('Cuota actual: -')
    expect(t).toContain('Progreso: 0%')
  })

  it('no pasa de la última cuota', () => {
    // Pagando de más, «5 de 4» sería absurdo.
    const t = recibo({ ...OLGA, totalPagado: 560000, saldoPendiente: 0 },
      [{ nombre: 'Cuota actual', tipo: 'dato', campo: 'numeroCuota' }])
    expect(t).toContain('Cuota actual: 4 de 4')
    expect(t).toContain('Progreso: 100%')
  })
})

describe('cuando el préstamo SÍ trae los campos, mandan ellos', () => {
  it('respeta el `porcentajePagado` del API', () => {
    // El API lo calcula con su propia regla —que puede contar recargos— y esa
    // manda: derivarlo aquí sería una segunda verdad bajo el mismo rótulo.
    const t = recibo({ ...OLGA, porcentajePagado: 37 })
    expect(t).toContain('Progreso: 37%')
  })

  it('respeta el `numeroCuota` del API', () => {
    const t = recibo({ ...OLGA, numeroCuota: '2 de 4' },
      [{ nombre: 'Cuota actual', tipo: 'dato', campo: 'numeroCuota' }])
    expect(t).toContain('Cuota actual: 2 de 4')
  })
})

describe('las plantillas que dependían del porcentaje', () => {
  const ctx = (extra) => ({ prestamo: { ...OLGA, ...extra }, cliente: { nombre: 'X' } })

  it('«Ofrecer renovación» sale al que ya casi termina (80%)', () => {
    // Con el campo crudo, un préstamo sin `porcentajePagado` se leía como 0% y
    // esta plantilla NO se ofrecía nunca desde el recibo.
    //
    // ⚠ El umbral es 80%, no 50%: mi primera versión de esta prueba puso 50 y
    // falló contra el código CORRECTO. Confundí esta plantilla con «Oferta de
    // crédito», que es otra.
    const t = PLANTILLAS.find((x) => x.id === 'renovacion')
    expect(t, 'ya no existe esa plantilla: revisa este test').toBeTruthy()
    expect(t.aplica(ctx({ totalPagado: 504000 }))).toBe(true)   // 90%
    expect(t.aplica(ctx({ totalPagado: 336000 }))).toBe(false)  // 60%, aún no
  })

  it('y también al que ya terminó', () => {
    const t = PLANTILLAS.find((x) => x.id === 'renovacion')
    expect(t.aplica(ctx({ totalPagado: 0, estado: 'completado' }))).toBe(true)
  })

  it('«Felicitación» pide ir por la mitad y estar al día', () => {
    const t = PLANTILLAS.find((x) => x.id === 'felicitacion')
    expect(t.aplica(ctx({ totalPagado: 336000, diasMora: 0 }))).toBe(true)   // 60%, al día
    expect(t.aplica(ctx({ totalPagado: 56000, diasMora: 0 }))).toBe(false)   // 10%
    expect(t.aplica(ctx({ totalPagado: 336000, diasMora: 5 }))).toBe(false)  // en mora
  })
})
