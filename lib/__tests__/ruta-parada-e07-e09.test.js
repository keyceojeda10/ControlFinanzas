import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { paradasDeRuta, zonaDe, filaZonaDe } from '../adaptadores/ruta'

// Adenda 5 · E07, E08 y E09 en la RUTA, que es donde la primera tabla del
// documento los manda. Yo los habia aplicado enteros a /cobros-hoy.
const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const pagina  = leer('app/(dashboard)/rutas/[id]/page.jsx')
const api     = leer('app/api/rutas/[id]/route.js')
const tarjeta = leer('components/cf/ParadaDeCobro.jsx')

const cliente = (extra = {}) => ({
  id: 'c1', nombre: 'Carlos Prueba', direccion: 'Cl 8 # 31-05',
  cobroPendienteHoy: true, diasMora: 0, cuota: 8000,
  prestamosActivos: [{ id: 'p1', saldoPendiente: 128000, totalAPagar: 240000, totalPagado: 112000 }],
  ...extra,
})

describe('la ruta se parte en dos zonas', () => {
  it('el carril numera VISITAS, no clientes', () => {
    // La regla de E09, y no es estetica: «un contador que incluye paradas que
    // no se hacen es peor que no tener contador». El cobrador lee 16, hace 10
    // y se cree atrasado yendo al dia.
    const { visitas, tambien } = paradasDeRuta([
      cliente({ id: 'a' }),
      cliente({ id: 'sinCobroHoy', cobroPendienteHoy: false, pagoHoy: false, hoySinCobro: true }),
      cliente({ id: 'b' }),
    ])
    expect(visitas.map((v) => v.id)).toEqual(['a', 'b'])
    expect(visitas.map((v) => v.orden)).toEqual([1, 2])
    expect(tambien.map((t) => t.id)).toEqual(['sinCobroHoy'])
  })

  it('quien ya pago SIGUE siendo visita', () => {
    // El recorrido se camina en orden: sacarlo de la lista le borra al cobrador
    // la referencia de por donde iba. Va tachado, no fuera.
    const { visitas } = paradasDeRuta([
      cliente({ id: 'pago', cobroPendienteHoy: false, pagoHoy: true, montoPagadoHoy: 8000 }),
    ])
    expect(visitas).toHaveLength(1)
    expect(visitas[0].cobrada).toBe(true)
  })

  it('marca la ultima para que el conector no salga al vacio', () => {
    const { visitas } = paradasDeRuta([cliente({ id: 'a' }), cliente({ id: 'b' })])
    expect(visitas.map((v) => v.ultima)).toEqual([false, true])
  })
})

describe('los tres estados de abajo', () => {
  it('con prestamo activo es «al dia» aunque hoy no le toque', () => {
    expect(zonaDe({ prestamosActivos: [{ id: 'p' }], diasDesdeUltimoPago: 400 })).toBe('aldia')
  })

  it('sin deuda y recien terminado es una OPORTUNIDAD, no alguien a quien sacar', () => {
    // El arreglo de copy de la lamina: «se puede retirar» y el mismo boton para
    // los dos estados. Al que acaba de pagar hay que PRESTARLE.
    const c = { prestamosActivos: [], terminoDePagar: '2026-07-04T05:00:00Z', diasDesdeUltimoPago: 30,
                prestamosCompletados: 2, puedePrestarHasta: 900000 }
    expect(zonaDe(c)).toBe('sindeuda')
    const fila = filaZonaDe(c, { formatear: (n) => `$${n}` })
    expect(fila.accion).toBe('Prestarle')
    expect(fila.subtitulo).toMatch(/Termin[oó] de pagar el 4 de julio/)
    expect(fila.apunte).toContain('900000')
  })

  it('meses sin nada es una ruta vieja: ese SI se saca', () => {
    const c = { prestamosActivos: [], terminoDePagar: '2026-01-04T05:00:00Z', diasDesdeUltimoPago: 200 }
    expect(zonaDe(c)).toBe('inactivo')
    expect(filaZonaDe(c, {}).accion).toBe('Sacar')
  })

  it('sin historia no se le ofrece plata', () => {
    // Sin prestamo activo y sin fecha de nada no hay nada que decir. Ofrecerle
    // un monto a quien no ha demostrado ninguno es al reves.
    expect(zonaDe({ prestamosActivos: [], terminoDePagar: null })).toBe('inactivo')
  })

  it('la FECHA manda sobre los dias', () => {
    // «Cobra en 13d» deja al cobrador contando con los dedos. Lo que se le dice
    // al cliente en la puerta es «el 19 de agosto»; los dias acompañan.
    const fila = filaZonaDe({
      prestamosActivos: [{ id: 'p', saldoPendiente: 100 }],
      proximoCobroAt: '2026-08-19T05:00:00Z', diasParaCobro: 13, cuota: 888334, frecuencia: 'mensual',
    }, { formatear: (n) => `$${n}` })
    expect(fila.subtitulo).toContain('19 de agosto')
    expect(fila.subtitulo).toContain('13 días')
    expect(fila.apunte).toContain('al mes')
  })

  it('sin fecha calculada no se inventa una', () => {
    // Una fecha de cobro equivocada manda a tocar una puerta el dia que no es.
    const fila = filaZonaDe({ prestamosActivos: [{ id: 'p' }], proximoCobroAt: null, proximoCobroLabel: null }, {})
    expect(fila.subtitulo).not.toMatch(/\d/)
  })
})

describe('la tarjeta de la ruta es LA MISMA de cobros-hoy', () => {
  it('la pagina la importa, no la redibuja', () => {
    expect(pagina).toMatch(/from '@\/components\/cf\/ParadaDeCobro'/)
    expect(pagina).toMatch(/<FilaCobro\b/)
    expect(pagina).toMatch(/<Carril\b/)
  })

  it('ya no queda la marca de agua del numero de orden', () => {
    // Lo que E08 retrata del «antes»: el numero como marca de agua al 8% detras
    // del texto, que «solo se ve al mirar cada tarjeta».
    expect(pagina).not.toMatch(/opacity:\s*0\.08/)
    expect(pagina).not.toMatch(/fontSize:.*'80px'/)
  })

  it('ya no queda el riel lateral ni el fondo fijo de tema oscuro', () => {
    // `bg-[rgba(255,255,255,0.02)]` sobre papel blanco es invisible: la tarjeta
    // solo existia en tema oscuro.
    expect(pagina).not.toMatch(/w-1 shrink-0 self-stretch/)
    expect(pagina).not.toMatch(/border-\[#1f1f1f\] bg-\[rgba\(255,255,255,0\.02\)\]/)
  })

  it('el display del carril va en la clase, nunca en el style', () => {
    // Cuarta vez que esto muerde: un `display` en linea SIEMPRE gana a la
    // clase, asi que `lg:hidden` no haria nada y el carril se pintaria tambien
    // en escritorio, donde la lista va a dos columnas y no hay una sola
    // secuencia que numerar.
    const bloque = tarjeta.match(/className="lg:hidden flex flex-col items-center"[^>]*/)[0]
    expect(bloque).not.toMatch(/display:/)
  })
})

describe('las fechas del historial no salen del include de hoy', () => {
  it('el fin de prestamo se resuelve con un agregado aparte', () => {
    // ⚠ EL FALLO QUE ESTO EVITA: el `include` de pagos viene filtrado a hoy
    // —lo necesita el recaudado—, asi que `p.pagos[0]` es undefined en todo
    // prestamo que no se haya cobrado hoy. Leerlo de ahi daba null siempre sin
    // que nada fallara: la fila diria «termino de pagar» sin fecha, y
    // `diasDesdeUltimoPago` marcaria «nunca» EN ROJO a la ruta entera.
    expect(api).toMatch(/prisma\.pago\.groupBy/)
    expect(api).toMatch(/finDePrestamo\.get\(p\.id\)/)
    expect(api).not.toMatch(/const fin = p\.pagos\?\.\[0\]\?\.fechaPago/)
    expect(api).not.toMatch(/const fecha = new Date\(p\.pagos\[0\]\.fechaPago\)/)
  })

  it('el agregado no cuenta recargos ni descuentos como «pagar»', () => {
    // Mueven la deuda, no la saldan: la fecha tiene que ser la del ultimo
    // dinero entregado.
    expect(api).toMatch(/tipo: \{ notIn: \['recargo', 'descuento'\] \}/)
  })

  it('es UNA consulta para toda la ruta, no una por cliente', () => {
    // En una ruta de 203 clientes lo segundo son 203 viajes a la base.
    expect(api).toMatch(/by: \['prestamoId'\]/)
    expect(api).toMatch(/prestamoId: \{ in: idsPrestamos \}/)
  })
})
