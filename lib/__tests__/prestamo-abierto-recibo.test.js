import { describe, it, expect } from 'vitest'
import { numeroCuotaDe, cuotasRestantesDe } from '@/lib/recibo-derivados'
/* ⚠ `resolverCampoWA` NO SE EXPORTA. Se llega a él por la plantilla, que es
   como lo usa la app: probar la función privada sería probar otra cosa. */
import { generarTextoPlantilla, PLANTILLAS } from '@/lib/whatsapp-plantillas'

/* ══════════════════════════════════════════════════════════════════════════
   EL RECIBO DE UN PRÉSTAMO ABIERTO

   Es el papel que se queda el cliente. Tres campos se derivaban dividiendo el
   total entre la cuota, y en un abierto eso inventa un final:

     · «Cuota actual»        → «1 de 10»
     · «Cuotas restantes»    → 10
     · «Fecha de vencimiento»→ la del primer corte de interés

   Diez cuotas no existen y ese día no vence nada. Un recibo que promete un
   final es peor que uno que calla: el cliente lo guarda.
   ══════════════════════════════════════════════════════════════════════════ */

/** El recibo tal como sale, con TODOS los campos encendidos. */
function reciboDe(prestamo) {
  /* ⚠ SON OBJETOS `{tipo,campo,nombre}`, NO CADENAS. Pasándolos como cadenas
     se filtran todos y el recibo sale sin ellos: la prueba decía que el campo
     «no aparece» cuando lo que pasaba es que yo no lo había pedido. */
  const campos = ['fechaVencimiento','numeroCuota','cuotasRestantes']
    .map((campo) => ({ tipo: 'dato', campo, nombre: campo }))
  /* ⚠ `camposRecibo` VA EN EL CONTEXTO, no dentro del préstamo. Metido en el
     préstamo se ignora sin decir nada y el recibo sale sin los campos: la
     prueba decía que el campo «no aparece» cuando yo no lo había pedido. */
  return generarTextoPlantilla('pago_confirmacion', {
    cliente: { nombre: 'Cliente X', telefono: '3000000000' },
    prestamo,
    camposRecibo: campos,
    pago: { montoPagado: 69_000, fechaPago: '2026-09-16T05:00:00.000Z', metodoPago: 'efectivo' },
    orgNombre: 'Negocio',
  }, 'org-x') ?? ''
}

const abierto = (extra = {}) => ({
  modoInteres: 'solo_interes',
  sinPlazo: true,
  montoPrestado: 690_000,
  totalAPagar: 759_000,
  totalPagado: 69_000,
  cuotaDiaria: 69_000,
  saldoPendiente: 690_000,
  frecuencia: 'mensual',
  fechaFin: '2026-09-15T05:00:00.000Z',
  cuotasAmortizacion: [],
  pagos: [{ tipo: 'intereses', montoPagado: 69_000, fechaPago: '2026-09-16T05:00:00.000Z' }],
  devengos: [{ periodo: '2026-09-15', interes: 69_000, capitalBase: 690_000 }],
  ...extra,
})

describe('el recibo no inventa cuotas que no existen', () => {
  it('«cuota actual» no dice «1 de 10»', () => {
    expect(numeroCuotaDe(abierto())).toBe(null)
  })

  it('«cuotas restantes» no dice un número', () => {
    expect(cuotasRestantesDe(abierto())).toBe(null)
  })
})

describe('y no promete una fecha de vencimiento', () => {
  it('el campo dice que es abierto', () => {
    const txt = reciboDe(abierto())
    expect(txt, txt).toMatch(/sin vencimiento|abierto/i)
  })

  it('la cuota del recibo es el interés del período', () => {
    expect(reciboDe(abierto())).toMatch(/\$69\.000/)
  })
})

describe('el préstamo de siempre no cambia', () => {
  const conTabla = abierto({
    sinPlazo: false,
    cuotasAmortizacion: [
      { numeroPeriodo: 1, cuotaTotal: 69_000, pagado: 69_000 },
      { numeroPeriodo: 2, cuotaTotal: 759_000, pagado: 0 },
    ],
  })

  it('sigue diciendo en qué cuota va', () => {
    expect(numeroCuotaDe(conTabla)).toBe('1 de 2')
  })

  it('sigue contando las que faltan', () => {
    expect(cuotasRestantesDe(conTabla)).toBe(1)
  })

  it('y sigue enseñando su fecha de vencimiento', () => {
    expect(reciboDe(conTabla)).toMatch(/15\/09|15 sep|2026/i)
  })
})
