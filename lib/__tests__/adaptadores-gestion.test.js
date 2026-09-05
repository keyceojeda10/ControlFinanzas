// lib/__tests__/adaptadores-gestion.test.js
//
// El «antes → después» de las ocho hojas de T13/T19. Es la razón de que esas
// pantallas existan: cada una cambia algo de un préstamo en marcha, y hoy la
// consecuencia no se ve hasta después de confirmar.
//
// Se prueba por casos, incluidos los que NO deben decir nada. Preferir el silencio
// a una frase inventada es la mitad del diseño de este archivo: en una pantalla que
// mueve plata, una consecuencia a medias es peor que ninguna, porque el dueño
// confirma creyendo que ya vio lo que pasaba.

import { describe, it, expect } from 'vitest'
import {
  adaptarRecargo, atajosDeRecargo, montoDesdePorcentaje,
  adaptarDescuento, atajosDeDescuento,
  adaptarPlazo,
  adaptarAplazar, cuandosDeAplazar,
  diasDeCobro, adaptarDiaDeCobro,
  adaptarPerdidos,
  adaptarCerrar, resumenCerrar,
  adaptarCorregir,
  fechaCorta, fechaLarga,
} from '@/lib/adaptadores/gestion'

/** Un préstamo diario en mora, como el de las láminas. */
const P = {
  montoPrestado: 500000,
  totalAPagar: 600000,
  saldoPendiente: 480000,
  cuotaDiaria: 20000,
  cuotasPendientes: 24,
  diasPlazo: 30,
  frecuencia: 'diario',
  diasMora: 36,
  montoEnMora: 120000,
  tasaInteres: 20,
  fechaInicio: '2026-06-01T05:00:00.000Z',
  fechaFin: '2026-08-06T05:00:00.000Z',
  diaCobroSemana: 2,
  pagos: Array.from({ length: 22 }, () => ({ tipo: 'completo' })),
}

describe('el recargo como % del saldo: la cifra la saca el sistema', () => {
  it('el caso del prestamista: 15 % de $1.470.000 son $220.500', () => {
    expect(montoDesdePorcentaje(1470000, 15)).toBe(220500)
  })
  it('redondea a $100, como todo el dinero del sistema, y nunca baja de $100', () => {
    expect(montoDesdePorcentaje(1234567, 3)).toBe(37000)   // 37.037,01 → 37.000
    expect(montoDesdePorcentaje(1000, 1)).toBe(100)        // 10 → mínimo
  })
  it('acepta el porcentaje con coma o como texto', () => {
    expect(montoDesdePorcentaje('1470000', '15')).toBe(220500)
    expect(montoDesdePorcentaje(1000000, 2.5)).toBe(25000)
  })
  it('sin saldo o sin porcentaje no inventa nada', () => {
    expect(montoDesdePorcentaje(0, 15)).toBe(0)
    expect(montoDesdePorcentaje(1470000, 0)).toBe(0)
    expect(montoDesdePorcentaje(null, 15)).toBe(0)
    expect(montoDesdePorcentaje(1470000, 'abc')).toBe(0)
  })
})

describe('T13-01 · recargo', () => {
  it('el titular es el SALDO, y sube', () => {
    const r = adaptarRecargo(P, 15000)
    expect(r.saldoAntes).toBe('$480.000')
    expect(r.saldoDespues).toBe('$495.000')
  })

  it('dice que la cuota NO cambia y cuántos cobros más son', () => {
    // La respuesta a la pregunta del cobrador: qué le pido mañana. Lo mismo, durante
    // más tiempo.
    const r = adaptarRecargo(P, 15000)
    expect(r.cuotaIgual).toBe('sigue en $20.000')
    expect(r.cobrosDeMas).toBe('1 cobro más')
    expect(adaptarRecargo(P, 45000).cobrosDeMas).toBe('3 cobros más')
  })

  it('redondea los cobros HACIA ARRIBA', () => {
    // Un cobro parcial también es un viaje que hay que hacer.
    expect(adaptarRecargo(P, 21000).cobrosDeMas).toBe('2 cobros más')
  })

  it('sin saldo no hay bloque', () => {
    expect(adaptarRecargo({}, 15000)).toBeNull()
  })

  it('los atajos salen de LA CUOTA, no de una lista fija', () => {
    // $5.000 es un recargo razonable con cuota de $20.000 y una broma con cuota de
    // $400.000. La lámina dibuja 5/10/15 mil porque su ejemplo tiene cuota $14.500.
    const a = atajosDeRecargo(P)
    expect(a.map((x) => x.monto)).toEqual([10000, 20000, 40000, undefined])
    expect(a[a.length - 1].etiqueta).toBe('Otro')

    const gordo = atajosDeRecargo({ ...P, cuotaDiaria: 400000 })
    expect(gordo[0].monto).toBe(200000)
  })

  it('sin cuota, solo queda «Otro»', () => {
    expect(atajosDeRecargo({ ...P, cuotaDiaria: 0 })).toEqual([{ id: 'otro', etiqueta: 'Otro' }])
  })
})

describe('T19-03 · descuento', () => {
  it('lo que debe el cliente BAJA', () => {
    const d = adaptarDescuento(P, 48000)
    expect(d.debeAntes).toBe('$480.000')
    expect(d.debeDespues).toBe('$432.000')
  })

  it('la ganancia baja «X de Y», con Y la pactada', () => {
    // $600.000 − $500.000 = $100.000 de ganancia pactada.
    expect(adaptarDescuento(P, 48000).gananciaLinea).toBe('$52.000 de $100.000')
  })

  it('mientras no se coma la ganancia, el capital se recupera', () => {
    expect(adaptarDescuento(P, 48000).capitalLinea).toBe('tus $500.000')
  })

  it('pasada la ganancia, NO se dice que se recupera: se dice cuánto se pierde', () => {
    // Decirle «sigues recuperando tus $500.000» a quien acaba de regalar $120.000
    // sobre una ganancia de $100.000 es mentira.
    expect(adaptarDescuento(P, 120000).capitalLinea).toBe('pierdes $20.000 de capital')
  })

  it('avisa del tope del servidor ANTES, no después', () => {
    // El servidor rechaza con DESCUENTO_EXCESIVO. Enterarse después de habérselo
    // prometido al cliente es la peor forma de enterarse.
    const d = adaptarDescuento(P, 500000)
    expect(d.tope).toBe(480000)
    expect(d.excede).toBe(true)
    expect(adaptarDescuento(P, 480000).excede).toBe(false)
  })

  it('los atajos no ofrecen más de lo que se puede perdonar', () => {
    const a = atajosDeDescuento(P)
    expect(a.find((x) => x.id === 'atraso').monto).toBe(120000)
    expect(a.find((x) => x.id === 'cuota').monto).toBe(20000)
    // Con un saldo chico, el atajo de «todo el atraso» desaparece en vez de
    // ofrecer un descuento que el servidor va a rechazar.
    const casi = { ...P, saldoPendiente: 5000 }
    expect(atajosDeDescuento(casi).map((x) => x.id)).toEqual(['otro'])
  })
})

describe('T13-02 · plazo', () => {
  it('usa la fórmula DEL ENDPOINT: total entre períodos totales, a $50', () => {
    // Mi primera versión dividía el saldo entre las cuotas que faltan. El que guarda
    // hace `totalAPagar / períodos totales` redondeado a $50, así que la pantalla
    // habría enseñado una cuota y el préstamo habría quedado con otra.
    //
    // 30 días / 1 = 30 períodos de plazo, 24 pendientes → 6 corridos.
    // Con 36 cuotas que falten: 6 + 36 = 42 totales.
    // 600.000 / 42 = 14.285,7 → $14.300.
    const r = adaptarPlazo(P, 36)
    expect(r.cuotaDespues).toBe('$14.300')
  })

  it('la cuota que BAJA se pinta como mejora', () => {
    expect(adaptarPlazo(P, 36).tono).toBe('mejora')
    // Acortar sube la cuota, y eso no es una mejora.
    expect(adaptarPlazo(P, 24).tono).toBe('neutro')
  })

  it('«igual» solo cuando de verdad lo es', () => {
    // El redondeo a $50 por cuota mueve el total unos pesos. Escribir «igual» sobre
    // una cifra que cambió es lo que convierte una pantalla de confianza en una
    // discusión.
    const r = adaptarPlazo(P, 36)
    if (r.totalCambia) {
      expect(r.totalIgual).toMatch(/^\$[\d.]+ → \$[\d.]+$/)
      expect(r.totalIgual).not.toMatch(/igual/)
    } else {
      expect(r.totalIgual).toMatch(/^igual: /)
    }
    // 600.000 / 30 = 20.000 exacto: ahí sí es igual.
    const exacto = adaptarPlazo(P, 24)
    expect(exacto.totalCambia).toBe(false)
    expect(exacto.totalIgual).toBe('igual: $600.000')
  })

  it('no se puede bajar de las cuotas que ya faltan', () => {
    // Eso sería ACORTAR el plazo, que es otra operación y sube la cuota.
    expect(adaptarPlazo(P, 36).minimo).toBe(24)
  })

  it('la fecha de fin se mueve los períodos que se añaden', () => {
    const r = adaptarPlazo(P, 26)
    expect(r.terminaAntes).toMatch(/\d/)
    expect(r.terminaDespues).toMatch(/\d/)
    expect(r.terminaDespues).not.toBe(r.terminaAntes)
  })

  it('sin total no hay bloque', () => {
    expect(adaptarPlazo({}, 30)).toBeNull()
  })
})

describe('T19-01 · aplazar', () => {
  it('las casillas traen SU FECHA debajo', () => {
    // «En 3 días» obliga a contar, y contar con el cliente delante es cómo se
    // equivoca uno de día.
    const c = cuandosDeAplazar(new Date('2026-07-28T12:00:00Z'))
    expect(c.map((x) => x.id)).toEqual(['manana', 'tres', 'otra'])
    expect(c[0].nota).toMatch(/29/)
    expect(c[1].nota).toMatch(/31/)
    expect(c[2].nota).toBe('elegir')
  })

  it('si el cobro es HOY, lo dice', () => {
    const hoy = new Date()
    const r = adaptarAplazar({ proximoCobro: hoy.toISOString() }, new Date(hoy.getTime() + 3 * 86400000))
    expect(r.cobrasAntes).toMatch(/^hoy, /)
  })

  it('la línea de «cobras hoy» se calla si no se sabe', () => {
    // Esa cifra la tiene la pantalla de cobrar hoy, no la ficha. Inventarla sería
    // decirle al dueño que su lista baja cuando no se sabe.
    const r = adaptarAplazar({ proximoCobro: '2026-07-28T05:00:00.000Z' }, '2026-07-31T05:00:00.000Z')
    expect(r.cobrasHoyLinea).toBeNull()
    const con = adaptarAplazar({ proximoCobro: '2026-07-28T05:00:00.000Z' }, '2026-07-31T05:00:00.000Z', 145000, 107000)
    expect(con.cobrasHoyLinea).toBe('$145.000 → $107.000')
  })

  it('sin fecha nueva no hay nada que enseñar', () => {
    expect(adaptarAplazar(P, null)).toBeNull()
  })

  it('un `YYYY-MM-DD` pelado NO se va un dia atras', () => {
    // `new Date('2026-08-02')` es medianoche UTC, y en Bogota eso es el 1 de agosto
    // a las 19:00. La hoja enseñaba «En 3 dias · dom 2» en la casilla y «ahora sab
    // 1» en el bloque negro: un dia de diferencia entre las dos mitades de la misma
    // pantalla. Se ancla al mediodia local, donde ningun cambio de horario puede
    // empujar la fecha al dia de al lado.
    expect(fechaCorta('2026-08-02')).toBe('dom 2')
    expect(fechaLarga('2026-08-02')).toMatch(/domingo, 2 de agosto|domingo 2 de agosto/)
    // Y la casilla y el bloque tienen que decir LO MISMO.
    const c = cuandosDeAplazar(new Date('2026-07-30T12:00:00'))
    const tres = c.find((x) => x.id === 'tres')
    const iso = `${tres.fecha.getFullYear()}-${String(tres.fecha.getMonth() + 1).padStart(2, '0')}-${String(tres.fecha.getDate()).padStart(2, '0')}`
    expect(adaptarAplazar({ proximoCobro: '2026-07-30T05:00:00.000Z' }, iso).cobrasDespues)
      .toBe(tres.nota)
  })
})

describe('T19-02 · día de cobro', () => {
  it('la fila empieza en LUNES, no en domingo', () => {
    // El domingo al principio deja la semana laboral partida por la mitad.
    expect(diasDeCobro(P, '').map((d) => d.id)).toEqual([1, 2, 3, 4, 5, 6, 0])
  })

  it('los días sin cobro salen APAGADOS, no escondidos', () => {
    // Si falta un día en la fila, el dueño se pregunta si la app está rota;
    // apagado, entiende que él lo apagó y dónde cambiarlo.
    const d = diasDeCobro(P, '0,6')
    expect(d).toHaveLength(7)
    expect(d.find((x) => x.id === 0).apagado).toBe(true)
    expect(d.find((x) => x.id === 6).apagado).toBe(true)
    expect(d.find((x) => x.id === 3).apagado).toBe(false)
  })

  it('el formato es un ARRAY JSON en cadena, no una lista con comas', () => {
    // Lo comprobe contra la base: los valores reales son `"[]"` y `"[0,6]"`. Lo habia
    // supuesto separado por comas, y con eso los apagados no se habrian detectado en
    // ninguna organizacion.
    expect(diasDeCobro(P, '[0,6]').filter((d) => d.apagado).map((d) => d.id).sort()).toEqual([0, 6])
    expect(diasDeCobro(P, '[]').filter((d) => d.apagado)).toHaveLength(0)
    // Y las otras dos formas de lo mismo, por si cambia una via de escritura.
    expect(diasDeCobro(P, [0, 6]).filter((d) => d.apagado)).toHaveLength(2)
    expect(diasDeCobro(P, '0,6').filter((d) => d.apagado)).toHaveLength(2)
    // Un JSON roto no tumba la pantalla.
    expect(diasDeCobro(P, '[0,').filter((d) => d.apagado)).toHaveLength(0)
  })

  it('`diasSinCobro` viene como CADENA y se parsea aquí', () => {
    // Así está en el schema. Se parsea aquí para que la pantalla no tenga que
    // saberlo, y la basura no rompe nada.
    expect(diasDeCobro(P, ' 0 , 6 ').filter((d) => d.apagado)).toHaveLength(2)
    expect(diasDeCobro(P, null).filter((d) => d.apagado)).toHaveLength(0)
    expect(diasDeCobro(P, 'lunes,9,-1').filter((d) => d.apagado)).toHaveLength(0)
  })

  it('la nota dice el día de hoy y cuáles están apagados', () => {
    const r = adaptarDiaDeCobro(P, 5, '2026-07-31T05:00:00.000Z', '0')
    expect(r.cobraAntes).toBe('martes')
    expect(r.cobraDespues).toBe('viernes')
    expect(r.nota).toBe('Hoy le cobras los martes. Domingo está apagado en tu configuración.')
    expect(r.proximoCobro).toMatch(/viernes/)
  })

  it('sin día ancla no se inventa el «antes»', () => {
    const r = adaptarDiaDeCobro({ ...P, diaCobroSemana: null }, 5, null, '')
    expect(r.cobraAntes).toBeNull()
    expect(r.proximoCobro).toBeNull()
  })
})

describe('T13-03 · perdidos', () => {
  it('la cartera baja lo que estaba en juego', () => {
    const r = adaptarPerdidos(P, 38400000, null, null)
    expect(r.montoEnJuego).toBe('$480.000')
    expect(r.carteraAntes).toBe('$38.400.000')
    expect(r.carteraDespues).toBe('$37.920.000')
  })

  it('sin registro de contacto lo dice, en vez de decir «hace 0 días»', () => {
    // «A veces la respuesta es que nadie fue». Decir «hace 0 días» cuando no hay
    // dato es peor que no decir nada.
    expect(adaptarPerdidos(P, 1000000, null, null).contactoLinea)
      .toBe('No hay registro de que se le haya escrito ni visitado.')
  })

  it('con registro, cuenta los días', () => {
    const hace = (d) => new Date(Date.now() - d * 86400000).toISOString()
    const r = adaptarPerdidos(P, 1000000, hace(22), hace(12))
    expect(r.contactoLinea).toBe('Le escribiste hace 22 días · lo visitaron hace 12')
  })

  it('sin cartera, las dos filas se callan pero el monto en juego no', () => {
    const r = adaptarPerdidos(P, null, null, null)
    expect(r.montoEnJuego).toBe('$480.000')
    expect(r.carteraAntes).toBeNull()
    expect(r.carteraDespues).toBeNull()
  })
})

describe('T19-04 · cerrar anticipado', () => {
  /** La forma REAL de `calcularLiquidacionAnticipada`, no la que yo había supuesto. */
  const LIQ = {
    modo: 'fijo',
    aproximado: false,
    capital: 500000,
    tasa: 20,
    totalPagadoReal: 120000,
    saldoActual: 480000,
    interesTotalPactado: 100000,
    proporcional: { modalidad: 'proporcional', interesDevengado: 40000, totalCierre: 540000, restanteHoy: 420000, interesPerdonado: 60000 },
    mesCompleto: { modalidad: 'mesCompleto', interesDevengado: 66667, totalCierre: 566667, restanteHoy: 446667, interesPerdonado: 33333 },
  }

  it('NO dice «solo el capital» sobre una cifra que lleva interés dentro', () => {
    // La lámina lo llama así, pero el modelo calcula capital MÁS el interés ya
    // devengado. Poner esa etiqueta sería mentir sobre plata en la pantalla donde se
    // cierra un préstamo, y el cliente que sume por su cuenta lo va a notar.
    const { opciones } = adaptarCerrar(LIQ)
    for (const o of opciones) expect(o.etiqueta).not.toMatch(/[Ss]olo el capital/)
  })

  it('las tres que EXISTEN, de la que más perdona a la que menos', () => {
    const { opciones } = adaptarCerrar(LIQ)
    expect(opciones.map((o) => o.id)).toEqual(['proporcional', 'mesCompleto', 'todo'])
    const montos = opciones.map((o) => o.monto)
    expect([...montos].sort((a, b) => a - b)).toEqual(montos)
    expect(opciones[2].monto).toBe(480000)
  })

  it('cada una dice cuánto interés perdona, con la cifra del modelo', () => {
    const { opciones } = adaptarCerrar(LIQ)
    expect(opciones[0].nota).toBe('Le perdonas $60.000 de interés que no llegó a correr')
    expect(opciones[2].nota).toBe('Como si pagara hasta el final del plazo')
  })

  it('un cálculo APROXIMADO se marca, y no como una opción más', () => {
    // Cerrar por una cifra aproximada sin avisar es cómo se generan las discusiones
    // que acaban en el préstamo reabierto.
    expect(adaptarCerrar({ ...LIQ, aproximado: true, modo: 'saldo' }).aproximado).toBe(true)
    expect(adaptarCerrar(LIQ).aproximado).toBe(false)
  })

  it('el resumen sale del modelo, no de restas mías', () => {
    const r = resumenCerrar(LIQ, 'proporcional')
    expect(r.recibes).toBe('$420.000')
    expect(r.dejasDeGanar).toBe('$60.000')
    expect(r.gananciaTotal).toBe('$40.000')
  })

  it('en «todo lo pactado» no se deja de ganar nada', () => {
    const r = resumenCerrar(LIQ, 'todo')
    expect(r.recibes).toBe('$480.000')
    expect(r.dejasDeGanar).toBeNull()
    expect(r.gananciaTotal).toBe('$100.000')
  })

  it('no promete «3 meses»: el plazo que falta depende del préstamo', () => {
    expect(resumenCerrar(LIQ, 'todo').cuandoVuelve).toBe('hoy, no al final del plazo')
  })

  it('sin cálculo no hay pantalla', () => {
    expect(adaptarCerrar(null)).toBeNull()
    expect(resumenCerrar(LIQ, 'inventada')).toBeNull()
  })
})

describe('T19-05 · corregir', () => {
  it('con pagos, el monto y el interes salen BLOQUEADOS, no «recalcula»', () => {
    // La lamina los dibuja editables con 22 pagos encima y avisando de que
    // «recalcula 22 pagos». El modal de verdad los bloquea, y su comentario dice por
    // que: cambiarlos recalculaba mal y INFLABA LA DEUDA. Prometer un recalculo que
    // no va a pasar seria describir una pantalla que no existe; y construir la
    // lamina tal cual reintroduciria un bug de plata ya arreglado.
    const r = adaptarCorregir(P)
    expect(r.pagosAfectados).toBe(22)
    expect(r.bloqueado).toBe(true)
    expect(r.peligrosos.find((c) => c.clave === 'monto').consecuencia).toBe('Bloqueado: ya hay 22 pagos')
    // La FECHA si se puede corregir con pagos: mueve el calendario, no recalcula lo
    // cobrado. Es la unica de las tres que sigue viva.
    expect(r.peligrosos.find((c) => c.clave === 'inicio').consecuencia).toBe('Mueve las fechas')
  })

  it('los recargos y descuentos NO cuentan como pagos', () => {
    // No son cobros: mueven la deuda en los papeles. Contarlos infla el numero que
    // se usa para asustar.
    const conAjustes = { ...P, pagos: [{ tipo: 'completo' }, { tipo: 'recargo' }, { tipo: 'descuento' }] }
    expect(adaptarCorregir(conAjustes).pagosAfectados).toBe(1)
    expect(adaptarCorregir(conAjustes).peligrosos[0].consecuencia).toBe('Bloqueado: ya hay 1 pago')
  })

  it('sin pagos, corregir es SEGURO y lo dice', () => {
    const r = adaptarCorregir({ ...P, pagos: [] })
    expect(r.bloqueado).toBe(false)
    expect(r.aviso).toMatch(/corregir un dato mal metido es seguro/)
    expect(r.aviso).toMatch(/no para renegociar/)
    expect(r.peligrosos[0].consecuencia).toBe('Recalcula el préstamo')
  })

  it('la fecha de inicio va CON AÑO', () => {
    // Es la única de estas pantallas donde el año importa: el error de digitación
    // típico es justo el año.
    expect(adaptarCorregir(P).peligrosos.find((c) => c.clave === 'inicio').valor)
      .toMatch(/de 2026$/)
  })

  it('un campo que no llegó no se dibuja', () => {
    const r = adaptarCorregir({ pagos: [] })
    expect(r.peligrosos).toEqual([])
  })
})
