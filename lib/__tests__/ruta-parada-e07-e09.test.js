import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { paradasDeRuta, zonaDe, contextoZona, gruposDeRuta } from '../adaptadores/ruta'

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

describe('⚠ TODOS EN UNA LISTA, Y TODOS NUMERADOS', () => {
  /* Aquí decía «el carril numera VISITAS, no clientes», con la regla de E09
     detrás: «un contador que incluye paradas que no se hacen es peor que no
     tener contador».

     El dueño lo revocó con la pantalla delante:

       «salían absolutamente todos los clientes enumerados. Así el primero
        fuera uno que estuviese con clavo, así en el dos estuviese un cliente
        que no tenía préstamo, no importa […] Ahora salen hasta abajo, sin
        ninguna numeración, sin ningún dato de sus préstamos, sin ningún
        contexto, nada.»

     Y las dos cosas pueden ser ciertas, porque son dos números distintos: la
     lámina habla del CONTADOR de cobros; él, de la POSICIÓN EN LA RUTA. El
     contador sigue contando solo los cobros de hoy — eso lo defiende la última
     prueba de este bloque. */

  it('el número es la posición en la RUTA, la lleven o no de visita hoy', () => {
    const { filas } = paradasDeRuta([
      cliente({ id: 'a' }),
      cliente({ id: 'sinCobroHoy', cobroPendienteHoy: false, pagoHoy: false, hoySinCobro: true }),
      cliente({ id: 'b' }),
    ])
    expect(filas.map((f) => f.id)).toEqual(['a', 'sinCobroHoy', 'b'])
    expect(filas.map((f) => f.orden)).toEqual([1, 2, 3])
  })

  it('y el que hoy no tiene cobro trae su contexto, no un hueco', () => {
    const { filas } = paradasDeRuta([
      cliente({ id: 'sinCobroHoy', cobroPendienteHoy: false, pagoHoy: false, hoySinCobro: true }),
    ], { formatear: (n) => `$${n}` })
    const f = filas[0]
    expect(f.zona).toBe('aldia')
    expect(f.contexto.pastilla.texto).toBe('Al día')
    expect(f.contexto.accion.texto).toBe('Cobrar antes')
    // La tarjeta entera: cifras, préstamos plegados y su cuota a la derecha.
    expect(f.cifras).toBeTruthy()
    expect(f.prestamos.length).toBe(1)
    expect(f.contexto.monto).toBe('defecto')
  })

  it('⚠ pero el CONTADOR del día sigue contando solo cobros', () => {
    /* Esto es lo que la lámina defendía y sigue en pie: «Empezar recorrido ·
       67» y las paradas por hacer salen de `visitas`, no de `filas`. Si algún
       día contaran clientes, el cobrador leería 16, haría 10 y se creería
       atrasado yendo al día. */
    const { filas, visitas, tambien } = paradasDeRuta([
      cliente({ id: 'a' }),
      cliente({ id: 'sinCobroHoy', cobroPendienteHoy: false, pagoHoy: false, hoySinCobro: true }),
      cliente({ id: 'b' }),
    ])
    expect(filas).toHaveLength(3)
    expect(visitas.map((v) => v.id)).toEqual(['a', 'b'])
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
    const { filas } = paradasDeRuta([cliente({ id: 'a' }), cliente({ id: 'b' })])
    expect(filas.map((f) => f.ultima)).toEqual([false, true])
  })
})

describe('la vista agrupada reparte las MISMAS tarjetas', () => {
  it('cada situación su sección, y el número no se renumera', () => {
    /* «Si se va a agrupar, que aparezcan los que se cobran hoy, los que están
       al día, los que están con tarjeta clavo, o los que están sin préstamo.»
       Agrupar es mirar lo mismo de otra forma: la posición en la ruta no cambia
       por mirarla. */
    const { filas } = paradasDeRuta([
      cliente({ id: 'hoy' }),
      cliente({ id: 'hecho', cobroPendienteHoy: false, pagoHoy: true, montoPagadoHoy: 100 }),
      cliente({ id: 'aldia', cobroPendienteHoy: false, hoySinCobro: true }),
      cliente({ id: 'clavo', cobroPendienteHoy: false, hoySinCobro: true,
                prestamosActivos: [{ id: 'x', esClavo: true, saldoPendiente: 900 }] }),
      cliente({ id: 'sinnada', cobroPendienteHoy: false, hoySinCobro: true,
                prestamosActivos: [], terminoDePagar: null }),
    ])
    const grupos = gruposDeRuta(filas)
    expect(grupos.map((g) => g.clave)).toEqual(['hoy', 'hechas', 'aldia', 'clavo', 'inactivo'])
    // El de la última sección sigue siendo el 5 de la ruta.
    expect(grupos.at(-1).filas[0].orden).toBe(5)
  })

  it('una sección sin nadie no se pinta', () => {
    const { filas } = paradasDeRuta([cliente({ id: 'hoy' })])
    expect(gruposDeRuta(filas).map((g) => g.clave)).toEqual(['hoy'])
  })
})

describe('los tres estados de abajo', () => {
  it('con prestamo activo es «al dia» aunque hoy no le toque', () => {
    expect(zonaDe({ prestamosActivos: [{ id: 'p' }], diasDesdeUltimoPago: 400 })).toBe('aldia')
  })

  it('un CLAVO no es un cliente al dia', () => {
    // ⚠ Salio en el espejo, no en las medidas: Yurber, cuyo unico prestamo esta
    // PERDIDO, aparecia con la pastilla verde «Al dia» y anillo verde en el
    // avatar. `prestamosActivos` incluye los clavos a proposito —el UI tiene
    // que poder enseñar su saldo—, asi que mirar solo la longitud los cuenta
    // como prestamos vivos. La pista era «sin proximo cobro calculado» debajo
    // de una pastilla que decia que todo iba bien.
    expect(zonaDe({ prestamosActivos: [{ id: 'p', esClavo: true }], terminoDePagar: null })).not.toBe('aldia')
    // Y con uno vivo al lado si lo esta: el clavo no contagia al resto.
    expect(zonaDe({ prestamosActivos: [{ id: 'a', esClavo: true }, { id: 'b' }] })).toBe('aldia')
  })

  it('la inactividad se mide con la fecha, no con diasDesdeUltimoPago', () => {
    // Ese campo es null justo para este grupo —lo medi contra el espejo: 69
    // filas fuera de parada y las 69 con `dias:null`—, asi que la regla de los
    // tres meses no llegaba a dispararse y quien termino hace ocho meses salia
    // tan «oportunidad» como el de la semana pasada.
    const hace = (d) => new Date(Date.now() - d * 86400000).toISOString()
    expect(zonaDe({ prestamosActivos: [], terminoDePagar: hace(200), diasDesdeUltimoPago: null })).toBe('inactivo')
    expect(zonaDe({ prestamosActivos: [], terminoDePagar: hace(20), diasDesdeUltimoPago: null })).toBe('sindeuda')
  })

  it('⚠ el clavo tiene NOMBRE PROPIO, no cae en «sin préstamo»', () => {
    /* Antes caía en `sindeuda` o `inactivo` según la fecha, o sea que un
       préstamo dado por perdido se leía como «terminó de pagar, préstale más».
       Esa es la cara que NO hay que volver a financiar.
       El dueño: «el que esté clavo, que se distinga que es clavo». */
    const c = { prestamosActivos: [{ id: 'x', esClavo: true, saldoPendiente: 900000 }] }
    expect(zonaDe(c)).toBe('clavo')
    const ctx = contextoZona({ ...c, saldoTotal: 900000 }, { formatear: (n) => `$${n}` })
    expect(ctx.pastilla.texto).toBe('Clavo')
    expect(ctx.pastilla.tono).toBe('mora')
    // La cuota de un clavo es $0: a la derecha va el SALDO, o la tarjeta
    // enseñaría «$0» de alguien que debe novecientos mil.
    expect(ctx.monto.cifra).toBe('$900000')
    expect(ctx.accion.texto).toBe('Cobrar')
    expect(ctx.accion.tono, 'el dorado es la cuota del día').toBe('apagado')
  })

  it('sin deuda y recien terminado es una OPORTUNIDAD, no alguien a quien sacar', () => {
    // El arreglo de copy de la lamina: «se puede retirar» y el mismo boton para
    // los dos estados. Al que acaba de pagar hay que PRESTARLE.
    const c = { prestamosActivos: [], terminoDePagar: '2026-07-04T05:00:00Z', diasDesdeUltimoPago: 30,
                prestamosCompletados: 2, puedePrestarHasta: 900000 }
    expect(zonaDe(c)).toBe('sindeuda')
    const fila = contextoZona(c, { formatear: (n) => `$${n}` })
    expect(fila.accion.texto).toBe('Prestarle')
    // DORADO: es la unica de las cuatro situaciones que gana dinero.
    expect(fila.accion.tono).toBe('oro')
    expect(fila.nota).toMatch(/Termin[oó] de pagar el 4 de julio/)
    // El techo va a la tira, no a un renglon suelto: es una cifra y se compara.
    expect(fila.cifras.find((x) => x.etiqueta === 'Le prestas hasta').valor).toContain('900000')
    // Y nada a la derecha: un «$0» se lee como una cifra averiada.
    expect(fila.monto).toBe('ninguno')
  })

  it('meses sin nada es una ruta vieja: ese SI se saca', () => {
    const c = { prestamosActivos: [], terminoDePagar: '2026-01-04T05:00:00Z', diasDesdeUltimoPago: 200 }
    expect(zonaDe(c)).toBe('inactivo')
    expect(contextoZona(c, {}).accion.texto).toBe('Sacar de la ruta')
  })

  it('sin historia no se le ofrece plata', () => {
    // Sin prestamo activo y sin fecha de nada no hay nada que decir. Ofrecerle
    // un monto a quien no ha demostrado ninguno es al reves.
    expect(zonaDe({ prestamosActivos: [], terminoDePagar: null })).toBe('inactivo')
  })

  it('la FECHA manda sobre los dias', () => {
    // «Cobra en 13d» deja al cobrador contando con los dedos. Lo que se le dice
    // al cliente en la puerta es «el 19 de agosto»; los dias acompañan.
    const fila = contextoZona({
      prestamosActivos: [{ id: 'p', saldoPendiente: 100 }],
      proximoCobroAt: '2026-08-19T05:00:00Z', diasParaCobro: 13, cuota: 888334, frecuencia: 'mensual',
    }, { formatear: (n) => `$${n}` })
    expect(fila.nota).toContain('19 de agosto')
    expect(fila.nota).toContain('13 días')
  })

  it('sin fecha calculada no se inventa una', () => {
    // Una fecha de cobro equivocada manda a tocar una puerta el dia que no es.
    const fila = contextoZona({ prestamosActivos: [{ id: 'p' }], proximoCobroAt: null, proximoCobroLabel: null }, {})
    expect(fila.nota).not.toMatch(/\d/)
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
