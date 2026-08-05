import { describe, it, expect } from 'vitest'
import { PLANTILLAS } from '@/lib/whatsapp-plantillas'

// El recibo de pago le mandaba al cliente la misma cifra dos veces:
//
//   ✅ Total pagado: $93.000        ← la sección «Estado de tu crédito»
//   ⏳ Saldo pendiente: $279.000
//   📈 Progreso: 25%
//   📋 Total pagado: $93.000        ← los campos personalizados del dueño
//   📋 Saldo pendiente: $279.000
//
// Medido contra producción: los 9 negocios que configuraron campos repiten al
// menos uno. No es un caso raro — es todos. Los tres nombres exactos salieron
// de ahí: `saldoPendiente` (8 negocios), `totalPagado` (7), `progreso` (4).
//
// Salió de mirar una captura del espejo tras cobrar $93.000 de verdad.

const plantilla = PLANTILLAS.find((t) => t.id === 'pago_confirmacion')

const ctx = (extra = {}) => ({
  cliente: { nombre: 'EDGAR BARBOSA', telefono: '3001234567' },
  prestamo: {
    totalPagado: 93000, saldoPendiente: 279000, totalAPagar: 372000,
    porcentajePagado: 25, diasMora: 0, cuota: 31000,
  },
  pago: { montoPagado: 93000, fechaPago: '2026-08-04T05:00:00.000Z' },
  orgNombre: 'PRESTA MIL',
  ...extra,
})

const texto = (c) => plantilla.getSecciones(c)
  .filter((s) => s.locked || s.default)
  .map((s) => s.texto).join('')

describe('el recibo no repite cifras', () => {
  it('un campo que ya sale arriba no se pinta otra vez', () => {
    const t = texto(ctx({
      camposRecibo: [
        { nombre: 'Total pagado', tipo: 'dato', campo: 'totalPagado' },
        { nombre: 'Saldo pendiente', tipo: 'dato', campo: 'saldoPendiente' },
        { nombre: 'Progreso', tipo: 'dato', campo: 'progreso' },
      ],
    }))
    expect(t.match(/Total pagado/g)?.length, '«Total pagado» sale dos veces').toBe(1)
    expect(t.match(/Saldo pendiente/g)?.length, '«Saldo pendiente» sale dos veces').toBe(1)
    expect(t.match(/Progreso/g)?.length, '«Progreso» sale dos veces').toBe(1)
  })

  it('los campos que NO chocan siguen saliendo', () => {
    // Esto es lo que no puede romperse: son los que el dueño añadió porque la
    // plantilla no los trae. Quitarlos sería el patrón de siempre —el rediseño
    // pierde funciones en silencio— con su configuración de por medio.
    const t = texto(ctx({
      camposRecibo: [
        { nombre: 'Saldo pendiente', tipo: 'dato', campo: 'saldoPendiente' },
        { nombre: 'Monto prestado', tipo: 'dato', campo: 'montoPrestado' },
        { nombre: 'Cuotas restantes', tipo: 'dato', campo: 'cuotasRestantes' },
        { nombre: 'Frecuencia de pago', tipo: 'dato', campo: 'frecuencia' },
        { nombre: 'Gracias por su pago', tipo: 'texto', valor: 'Vuelva pronto' },
      ],
    }))
    expect(t, 'se perdió «Monto prestado»').toContain('Monto prestado')
    expect(t, 'se perdió «Cuotas restantes»').toContain('Cuotas restantes')
    expect(t, 'se perdió «Frecuencia de pago»').toContain('Frecuencia de pago')
    expect(t, 'se perdió un campo de texto libre').toContain('Vuelva pronto')
  })

  it('con el saldo oculto, esos campos SÍ valen', () => {
    // Con `ocultarSaldo` la plantilla no pone saldo ni progreso, así que el
    // campo del dueño es la única vez que aparecerían. Filtrarlos ahí sería
    // quitarle información que sí pidió.
    const t = texto(ctx({
      ocultarSaldo: true,
      camposRecibo: [
        { nombre: 'Saldo pendiente', tipo: 'dato', campo: 'saldoPendiente' },
        { nombre: 'Progreso', tipo: 'dato', campo: 'progreso' },
      ],
    }))
    expect(t, 'con saldo oculto se perdió el campo de saldo').toContain('Saldo pendiente')
    expect(t, 'con saldo oculto se perdió el campo de progreso').toContain('Progreso')
    expect(t.match(/Saldo pendiente/g)?.length, 'y aun así sale una sola vez').toBe(1)
  })

  it('sin campos configurados el mensaje no cambia', () => {
    const t = texto(ctx())
    expect(t).toContain('Total pagado')
    expect(t).toContain('Saldo pendiente')
    expect(t, 'apareció la sección de campos sin haber campos').not.toContain('📋')
  })

  it('si TODOS los campos chocan, no queda una sección vacía', () => {
    // Antes bastaba con que la lista tuviera algo para empujar la sección; si
    // el filtro deja la lista vacía, no debe salir un bloque en blanco.
    const t = texto(ctx({
      camposRecibo: [{ nombre: 'Total pagado', tipo: 'dato', campo: 'totalPagado' }],
    }))
    expect(t, 'quedó la sección de campos vacía').not.toContain('📋')
  })
})
