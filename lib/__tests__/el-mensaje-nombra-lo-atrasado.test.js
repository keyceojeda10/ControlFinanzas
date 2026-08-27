/* El mensaje de WhatsApp le pedía una cuota a quien debía tres.
 *
 * ══ LO QUE REPORTÓ EL PRESTAMISTA ═════════════════════════════════════════
 *
 *   «En el recuadro le recuerda la cuota de la semana, mas no la cuota que
 *    tiene atrasada.»
 *   «En este recuadro podría salir también si tiene pendientes por mora?»
 *
 * Su cliente llevaba $534.000 vencidos —dos cuotas de $267.000— y el mensaje
 * decía «Cuota semanal: $267.000». La mitad de lo que el cobrador iba a pedirle.
 *
 * ⚠ LA CIFRA SE CALCULA EN EL MÓDULO, NO SE ESPERA DE LA PANTALLA. La hoja de
 * WhatsApp se abre desde CINCO sitios y cada uno arma su préstamo por su
 * cuenta: uno pasa `montoEnMora` y otro no. Por eso `loAtrasado` prefiere el
 * campo cuando viene y lo calcula cuando no. */
import { describe, it, expect } from 'vitest'
import { generarTextoPlantilla } from '@/lib/whatsapp-plantillas'

/* El caso de la captura: $2.000.000 a 12 semanas, cuota $267.000, un solo pago
   de $801.000 el 22 de julio, y dos cuotas vencidas. */
const conMora = (montoEnMora, diasMora) => ({
  cliente: { nombre: 'Jose' },
  orgNombre: 'Prestamos juan',
  prestamo: {
    id: 'x', estado: 'activo', frecuencia: 'semanal',
    montoPrestado: 2000000, totalAPagar: 3204000, cuotaDiaria: 267000,
    saldoPendiente: 2403000, totalPagado: 801000, diasPlazo: 84,
    fechaInicio: new Date('2026-07-22T05:00:00.000Z'),
    fechaFin: new Date('2026-10-14T05:00:00.000Z'),
    diasMora, montoEnMora, pagos: [],
  },
})

const texto = (id, ctx) => generarTextoPlantilla(id, ctx, 'org-de-prueba')

describe('el mensaje nombra lo atrasado, no una cuota suelta', () => {
  it('el resumen del crédito dice lo vencido', () => {
    const t = texto('credito_aprobado', conMora(534000, 8))
    expect(t).toContain('534.000')
  })

  it('el aviso de mora ya no nombra solo la cuota', () => {
    const t = texto('mora_firme', conMora(534000, 8))
    // La cuota sigue estando —es el dato de siempre— pero ya no va sola.
    expect(t).toContain('267.000')
    expect(t).toContain('534.000')
  })

  it('la mora crítica también', () => {
    expect(texto('mora_critica', conMora(1068000, 20))).toContain('1.068.000')
  })

  it('el aviso suave también', () => {
    expect(texto('mora_suave', conMora(267000, 2))).toContain('267.000')
  })

  it('⚠ sin mora no aparece el renglón, que es lo normal', () => {
    for (const id of ['credito_aprobado', 'mora_firme']) {
      const t = texto(id, conMora(0, 0))
      expect(t).not.toContain('pendientes de cuotas anteriores')
      expect(t).not.toContain('Vencido a hoy')
    }
  })

  it('⚠ si la pantalla no pasó `montoEnMora`, se calcula igual', () => {
    /* Es el caso de las otras cuatro pantallas que abren la hoja. Sin el campo
       el renglón desaparecía en silencio, que es justo como se arreglan las
       cosas a medias en este repo. */
    const ctx = conMora(undefined, 8)
    delete ctx.prestamo.montoEnMora
    const t = texto('mora_firme', ctx)
    expect(t).toMatch(/Vencido a hoy/)
  })

  it('⚠ y si la pantalla lo pasó como `null`, tampoco se pierde', () => {
    /* `Number(null)` es 0 y es finito: la guarda ingenua leía «no debe nada».
       Medido por los cinco caminos, uno mandaba `null` y perdía el renglón en
       las cuatro plantillas. Un 0 de verdad sí significa al día. */
    const ctx = conMora(null, 8)
    expect(texto('mora_firme', ctx)).toMatch(/Vencido a hoy/)
    expect(texto('credito_aprobado', conMora(0, 0))).not.toContain('Vencido a hoy')
  })

  it('un préstamo sin datos no revienta el mensaje', () => {
    expect(() => texto('credito_aprobado', {
      cliente: { nombre: 'Ana' }, orgNombre: 'X', prestamo: { estado: 'activo' },
    })).not.toThrow()
  })
})
