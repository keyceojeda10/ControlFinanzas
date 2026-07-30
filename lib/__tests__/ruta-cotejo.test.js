import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  loPuestoAqui, loDeHoy, adaptarRecorrido, siguienteParada, partirRecorrido,
  adaptarParadaActual, adaptarCabeceraRuta, colorDeParada, estadoDeCliente,
  abreviarMillones, distanciaTexto, tiempoFuera,
  cobradoresParaElegir, clientesParaElegir, avisoDeRobo,
} from '../adaptadores/ruta.js'

const RAIZ = process.cwd()
const fmt = (n) => `$${Number(n).toLocaleString('es-CO')}`

/* ══════════════════════════════════════════════════════════════════════════
   T27-02 parte la ruta en dos tiempos: el bloque negro (lo acumulado) y la
   banda blanca (lo de hoy). Estas pruebas defienden las dos cosas que se
   rompieron al construirlo y una que ya estaba rota en la app.
   ══════════════════════════════════════════════════════════════════════════ */

describe('el bloque negro: lo que tienes puesto aquí', () => {
  it('prestado + por ganar = la cartera, siempre', () => {
    // LA IDENTIDAD DE LA PANTALLA. Si no se cumple, las tres cifras no se pueden
    // leer juntas y el bloque vuelve a ser lo que era: «Prestado» y «Con
    // intereses», dos números que nadie sabía restar.
    const r = loPuestoAqui({
      carteraTotal: 11_600_000, capitalPendiente: 8_400_000, totalAPagarRuta: 40_000_000,
    }, fmt)
    expect(r.numeros.capital + r.numeros.porGanar).toBe(r.numeros.cartera)
  })

  it('«por ganar» NO sale negativo cuando el cliente ya abonó', () => {
    // EL BUG QUE ESTO EVITA: la resta ingenua es `cartera - capitalTotal`, y
    // `capitalTotal` es el monto ORIGINAL prestado. En cuanto alguien abona, esa
    // resta se va a negativo y la ruta que más cobra es la que peor se ve.
    //
    //   presté 1.000.000 · pactado 1.200.000 · pagó 300.000
    //   saldo 900.000 · original 1.000.000 → «por ganar» −100.000
    //
    // Con `capitalPendiente` (capital que sigue en la calle) sale bien.
    const r = loPuestoAqui({
      carteraTotal: 900_000,
      capitalPendiente: 750_000,
      capitalTotal: 1_000_000,   // el original: NO se usa, y por eso no estorba
      totalAPagarRuta: 1_200_000,
    }, fmt)
    expect(r.numeros.porGanar).toBe(150_000)
    expect(r.numeros.porGanar).toBeGreaterThanOrEqual(0)
  })

  it('el capital pendiente nunca se pasa del saldo', () => {
    // Un préstamo con recargos puede traer un capital restante mayor que lo que
    // queda por cobrar. Si se dejara pasar, «por ganar» saldría negativo otra vez.
    const r = loPuestoAqui({ carteraTotal: 500_000, capitalPendiente: 800_000, totalAPagarRuta: 1_000_000 }, fmt)
    expect(r.numeros.capital).toBe(500_000)
    expect(r.numeros.porGanar).toBe(0)
  })

  it('«cumple» es lo cobrado de lo pactado, y una sola definición', () => {
    const r = loPuestoAqui({ carteraTotal: 11_600_000, capitalPendiente: 8_400_000, totalAPagarRuta: 40_000_000 }, fmt)
    expect(r.numeros.cumple).toBe(71)
  })

  it('sin nada pactado no hay porcentaje: no se enseña un NaN%', () => {
    const r = loPuestoAqui({ carteraTotal: 0, capitalPendiente: 0, totalAPagarRuta: 0 }, fmt)
    expect(r.numeros.cumple).toBeNull()
    expect(r.columnas.map((c) => c.id)).not.toContain('cumple')
  })

  it('null y cadena vacía no valen 0 por accidente', () => {
    // `Number(null)` es 0 y eso ya causó tres bugs de «cartera → $0». Con datos
    // ausentes la pantalla enseña ceros a propósito, no por una coerción.
    const r = loPuestoAqui({ carteraTotal: null, capitalPendiente: '', totalAPagarRuta: undefined }, fmt)
    expect(r.numeros.cartera).toBe(0)
    expect(r.numeros.porGanar).toBe(0)
    expect(r.numeros.cumple).toBeNull()
  })

  it('los textos van en los nombres que lee el componente', () => {
    // Cuando el adaptador devolvía `cartera` (número) y `carteraTexto` (texto) al
    // mismo nivel, el `{...puesto}` del componente cogía el número y la pantalla
    // enseñaba «11600000». Los crudos viven en `numeros` para que no pueda pasar.
    const r = loPuestoAqui({ carteraTotal: 11_600_000, capitalPendiente: 8_400_000, totalAPagarRuta: 40_000_000 }, fmt)
    expect(r.cartera).toBe('$11.600.000')
    expect(typeof r.numeros.cartera).toBe('number')
  })

  it('solo «por ganar» va en oro', () => {
    const r = loPuestoAqui({ carteraTotal: 11_600_000, capitalPendiente: 8_400_000, totalAPagarRuta: 40_000_000 }, fmt)
    expect(r.columnas.filter((c) => c.oro).map((c) => c.id)).toEqual(['porganar'])
  })
})

describe('abreviar millones', () => {
  it('una decimal hasta 100 y ninguna por encima', () => {
    expect(abreviarMillones(8_400_000, fmt)).toBe('$8,4M')
    expect(abreviarMillones(3_200_000, fmt)).toBe('$3,2M')
    expect(abreviarMillones(11_000_000, fmt)).toBe('$11M')
    expect(abreviarMillones(142_300_000, fmt)).toBe('$142M')
  })

  it('por debajo del millón no abrevia', () => {
    // «$0.4M» se lee peor que «$430.000».
    expect(abreviarMillones(430_000, fmt)).toBe('$430.000')
  })
})

describe('la banda blanca: lo de hoy', () => {
  const ruta = {
    esperadoHoy: 128_500, recaudadoHoy: 34_500,
    recaudadoEfectivoHoy: 34_500, recaudadoDigitalHoy: 0,
    clientesConCobroHoy: 5, clientesPagaronHoy: 1,
  }

  it('la barra mide lo cobrado sobre lo esperado hoy', () => {
    expect(loDeHoy(ruta, fmt).progreso).toBe(27)
  })

  it('sin nada esperado la barra va a 0, no a 100', () => {
    // «Nada que cobrar» no es «cobrado»: una ruta sin cobros hoy no puede
    // aparecer completada.
    expect(loDeHoy({ esperadoHoy: 0, recaudadoHoy: 0 }, fmt).progreso).toBe(0)
  })

  it('el resumen desglosa efectivo y digital', () => {
    // Es lo que hace posible cuadrar la caja de la noche: sin el desglose, el
    // cobrador entrega un fajo y nadie sabe cuánto llegó por transferencia.
    expect(loDeHoy(ruta, fmt).resumen).toBe('1 de 5 cobros · efectivo $34.500 · digital $0')
  })

  it('sin desglose no se inventa uno', () => {
    const r = loDeHoy({ esperadoHoy: 100, recaudadoHoy: 50, clientesConCobroHoy: 2, clientesPagaronHoy: 1 }, fmt)
    expect(r.resumen).toBe('1 de 2 cobros')
  })

  it('lo que falta no baja de cero', () => {
    // Cobrar más de lo esperado pasa —alguien paga dos cuotas— y «falta −$5.000»
    // no significa nada.
    expect(loDeHoy({ esperadoHoy: 100_000, recaudadoHoy: 150_000 }, fmt).numeros.falta).toBe(0)
  })
})

describe('el estado del cliente: un solo umbral', () => {
  it('el filete y la pastilla nunca se contradicen', () => {
    // ESTO SE ROMPIÓ AL CONSTRUIRLO: `colorDeParada` usaba «mora > 0 → rojo» y
    // `estadoDeCliente` cortaba en 15 días, así que un cliente con 9 días de
    // atraso salía con pastilla ámbar y filete rojo. Es el problema de las tres
    // funciones de ruta que se contradicen, reaparecido dentro de un archivo.
    for (const dias of [0, 1, 9, 14, 15, 31, 200]) {
      const filete = colorDeParada({ diasMora: dias })
      const pastilla = estadoDeCliente(dias).tono
      // Al día: filete oro (toca hoy), pastilla verde. Ese par es intencionado.
      if (dias === 0) continue
      expect(filete).toBe(pastilla)
    }
  })

  it('nueve días es ámbar y treinta y uno es rojo', () => {
    expect(colorDeParada({ diasMora: 9 })).toBe('oro')
    expect(colorDeParada({ diasMora: 31 })).toBe('rojo')
  })

  it('cobrado hoy manda sobre la mora', () => {
    // La pregunta de la pantalla es «¿me falta pasar por aquí?».
    expect(colorDeParada({ diasMora: 90, cobradoHoy: true })).toBe('verde')
  })
})

describe('el recorrido', () => {
  const clientes = [
    { id: 1, orden: 1, nombre: 'Steven Olmos', cobradoHoy: true, horaCobro: '15:40', medio: 'efectivo', montoACobrar: 27_500 },
    { id: 2, orden: 2, nombre: 'Luz Mery Ossa', diasMora: 0, direccion: 'Cra 7 # 51-08', distanciaMetros: 410, montoACobrar: 18_000 },
    { id: 3, orden: 3, nombre: 'Nelson Aguirre', diasMora: 9, distanciaMetros: 1_240, montoACobrar: 21_500 },
  ]

  it('caminando manda la distancia, no la dirección', () => {
    // Dos datos de sitio no caben en una línea de 11px, y ya se sabe dónde vive.
    const filas = adaptarRecorrido(clientes, fmt)
    expect(filas[1].detalle).toBe('al día · a 410 m')
    expect(filas[2].detalle).toBe('9d de atraso · a 1,2 km')
  })

  it('sin distancia se cae a la dirección', () => {
    const [f] = adaptarRecorrido([{ nombre: 'X', diasMora: 3, direccion: 'Cl 8 # 31-05' }], fmt)
    expect(f.detalle).toBe('3d de atraso · Cl 8 # 31-05')
  })

  it('cobrado dice la hora y el medio', () => {
    // Es lo que se discute cuando la caja no cuadra.
    expect(adaptarRecorrido(clientes, fmt)[0].detalle).toBe('cobrado 15:40 · efectivo')
  })

  it('el número es la posición del recorrido, no el índice', () => {
    const filas = adaptarRecorrido([{ orden: 7, nombre: 'X' }], fmt)
    expect(filas[0].orden).toBe(7)
  })

  it('la siguiente parada es la primera sin cobrar', () => {
    expect(siguienteParada(clientes).nombre).toBe('Luz Mery Ossa')
  })

  it('sin nadie pendiente no hay siguiente', () => {
    expect(siguienteParada([{ nombre: 'X', cobradoHoy: true }])).toBeNull()
  })
})

describe('el modo ruta: tres grupos', () => {
  const clientes = [
    { id: 1, orden: 1, nombre: 'Steven Olmos', cobradoHoy: true, montoCobrado: 27_500 },
    { id: 2, orden: 2, nombre: 'Pepito Gómez', cobradoHoy: true, montoCobrado: 34_500 },
    { id: 3, orden: 3, nombre: 'Luz Mery Ossa', diasMora: 0, distanciaMetros: 410, saldoPendiente: 126_000, montoACobrar: 18_000 },
    { id: 4, orden: 4, nombre: 'Nelson Aguirre', diasMora: 9, montoACobrar: 21_500 },
  ]
  const p = partirRecorrido(clientes, fmt)

  it('la actual no aparece también en las que faltan', () => {
    expect(p.actual.nombre).toBe('Luz Mery Ossa')
    expect(p.faltan.map((f) => f.nombre)).toEqual(['Nelson Aguirre'])
  })

  it('los cobrados se colapsan con su total: hechos, pero no se olvidan', () => {
    expect(p.cobradosTitulo).toBe('Ya cobrados · 2')
    expect(p.cobradosTotal).toBe('$62.000')
  })

  it('la posición cuenta paradas, no índices', () => {
    expect(p.posicion).toBe('parada 3 de 4')
  })

  it('ruta terminada lo dice y no deja un botón sin destino', () => {
    const fin = partirRecorrido([{ nombre: 'X', cobradoHoy: true, montoCobrado: 1 }], fmt)
    expect(fin.actual).toBeNull()
    expect(fin.posicion).toMatch(/ruta terminada/)
  })

  it('la parada actual trae lo que se cobra y lo que debe, separados', () => {
    const a = adaptarParadaActual(p.actual, fmt)
    expect(a.cobrar).toBe('$18.000')
    expect(a.debe).toBe('debe $126.000')
    expect(a.estado).toEqual({ texto: 'Al día', tono: 'verde' })
    expect(a.donde).toBe('a 410 m')
  })

  it('sin saldo no se enseña un «debe $0»', () => {
    expect(adaptarParadaActual({ nombre: 'X', montoACobrar: 100 }, fmt).debe).toBeNull()
  })
})

describe('distancia y tiempo', () => {
  it('metros hasta el kilómetro, kilómetros con una decimal', () => {
    // «a 1.240 m» hay que traducirlo mentalmente; «a 410 m» decide si se va andando.
    expect(distanciaTexto(410)).toBe('a 410 m')
    expect(distanciaTexto(1_240)).toBe('a 1,2 km')
    expect(distanciaTexto(999)).toBe('a 999 m')
  })

  it('sin distancia no se inventa una', () => {
    expect(distanciaTexto(null)).toBeNull()
    expect(distanciaTexto(undefined)).toBeNull()
    expect(distanciaTexto('')).toBeNull()
  })

  it('el tiempo se dice como se dice', () => {
    expect(tiempoFuera(72)).toBe('llevas 1 h 12')
    expect(tiempoFuera(45)).toBe('llevas 45 min')
    expect(tiempoFuera(120)).toBe('llevas 2 h')
  })
})

describe('la cabecera', () => {
  it('junta cobrador, clientes y kilómetros sin separadores colgando', () => {
    const c = adaptarCabeceraRuta({ nombre: 'Ruta 2', cobrador: { nombre: 'Pepito' }, clientes: [1, 2, 3] }, '3,4 km')
    expect(c.titulo).toBe('Ruta 2')
    expect(c.detalle).toBe('Pepito · 3 clientes · 3,4 km')
  })

  it('sin cobrador ni km no queda un punto suelto', () => {
    expect(adaptarCabeceraRuta({ nombre: 'Ruta 1', clientes: [1] }).detalle).toBe('1 cliente')
  })
})

describe('los tres ajustes que T28-02 dice que no son automáticos', () => {
  const tokens = readFileSync(join(RAIZ, 'app/tokens-2026.css'), 'utf8')
  const oscuro = tokens.slice(tokens.indexOf('html[data-theme="dark"]'))
  const modo = readFileSync(join(RAIZ, 'components/pantallas/ModoRuta.jsx'), 'utf8')

  it('en oscuro el oro sube y verde y rojo se aclaran', () => {
    expect(oscuro).toMatch(/--cf-gold:\s*#F5B824/)
    expect(oscuro).toMatch(/--cf-green:\s*#2FBE6A/)
    expect(oscuro).toMatch(/--cf-red:\s*#F0575C/)
  })

  it('los derivados de TEXTO también cambian', () => {
    // Los `-dark` están pensados «sobre blanco»: sobre carbón se apagan hasta no
    // leerse. Faltaban, y dejaban ilegible todo texto de acento de la app en
    // oscuro — 35 archivos usan --cf-gold-dark, 17 --cf-green-dark.
    expect(oscuro).toMatch(/--cf-gold-dark:\s*#F5B824/)
    expect(oscuro).toMatch(/--cf-green-dark:\s*#2FBE6A/)
    expect(oscuro).toMatch(/--cf-red-dark:\s*#F0575C/)
    expect(oscuro).toMatch(/--cf-red-darker:\s*#F0575C/)
  })

  it('el modo ruta no escribe colores a mano', () => {
    // Con literales, el oscuro salía con el oro y el verde del claro. Se permite
    // el verde de WhatsApp: es una marca ajena, no un tema.
    const cuerpo = modo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const literales = (cuerpo.match(/#[0-9A-Fa-f]{6}/g) ?? []).filter((c) => c.toUpperCase() !== '#25D366')
    expect(literales).toEqual([])
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   T24-01 crear · T24-02 reordenar · T04-03 cierre · T11-02 mapa
   ══════════════════════════════════════════════════════════════════════════ */

describe('las dos terceras columnas son preguntas distintas', () => {
  const ruta = { carteraTotal: 11_600_000, capitalPendiente: 8_400_000, totalAPagarRuta: 40_000_000 }

  it('«cumple» mide avance y «rinde» mide rentabilidad', () => {
    // Las dos láminas usan las mismas cifras y las dos salen bien; confundirlas
    // sería el cuarto miembro de la familia de funciones de ruta que se
    // contradicen.
    expect(loPuestoAqui(ruta, fmt, 'cumple').numeros.cumple).toBe(71)
    expect(loPuestoAqui(ruta, fmt, 'rinde').numeros.rinde).toBe(38)
  })

  it('la pantalla enseña la que pide, no las dos', () => {
    expect(loPuestoAqui(ruta, fmt, 'cumple').columnas.map((c) => c.id)).toEqual(['prestado', 'porganar', 'cumple'])
    expect(loPuestoAqui(ruta, fmt, 'rinde').columnas.map((c) => c.id)).toEqual(['prestado', 'porganar', 'rinde'])
  })

  it('sin capital puesto no hay rinde: 0/0 no se enseña como 0%', () => {
    expect(loPuestoAqui({ carteraTotal: 0, capitalPendiente: 0, totalAPagarRuta: 100 }, fmt, 'rinde').numeros.rinde).toBeNull()
  })
})

describe('crear ruta (T24-01)', () => {
  const cobradores = [
    { id: 'p', nombre: 'Pepito Perez', rutas: 1 },
    { id: 'c1', nombre: 'Carlos 1', rutas: 0 },
    { id: 'c2', nombre: 'Ana', rutas: 0 },
  ]

  it('los cobradores sin ruta van primero', () => {
    // Es el hallazgo de las rutas vacías atacado desde el otro lado: una lista que
    // empieza por los que ya tienen ruta esconde a los cinco que no tienen.
    const r = cobradoresParaElegir(cobradores)
    expect(r.filas.map((f) => f.id)).toEqual(['c1', 'c2', 'p'])
  })

  it('el dueño va al final, con su nombre real debajo', () => {
    const r = cobradoresParaElegir(cobradores, { id: 'yo', nombre: 'Carlos Castro' })
    const ultimo = r.filas[r.filas.length - 1]
    expect(ultimo.nombre).toBe('Yo mismo')
    expect(ultimo.detalle).toBe('Carlos Castro')
    expect(ultimo.iniciales).toBe('CC')
  })

  it('el verbo de la nota concuerda con el número', () => {
    // «Te quedan 1 cobrador» es lo que sale de pluralizar solo el sustantivo.
    expect(cobradoresParaElegir([{ id: 'a', nombre: 'A', rutas: 0 }]).nota).toBe('Te queda 1 cobrador sin ruta.')
    expect(cobradoresParaElegir(cobradores).nota).toBe('Te quedan 2 cobradores sin ruta.')
  })

  it('sin cobradores libres no se dice nada', () => {
    expect(cobradoresParaElegir([{ id: 'a', nombre: 'A', rutas: 2 }]).nota).toBeNull()
  })

  it('cada cliente dice en qué ruta está hoy', () => {
    const filas = clientesParaElegir([
      { id: 1, nombre: 'Steven', direccion: 'Cl 8', rutaNombre: 'Ruta 2' },
      { id: 2, nombre: 'Deisy', direccion: 'Cra 45' },
    ], [1])
    expect(filas[0].detalle).toBe('Cl 8 · hoy en Ruta 2')
    expect(filas[1].detalle).toBe('Cra 45 · sin ruta')
    expect(filas[0].elegido).toBe(true)
    expect(filas[1].elegido).toBe(false)
  })

  it('el aviso nombra al cobrador al que le rompes la ruta', () => {
    // La lámina dice «la de Pepito», no «la de Ruta #1»: lo que se rompe es el día
    // de trabajo de una persona.
    const clientes = [
      { id: 1, nombre: 'A', rutaNombre: 'Ruta 2', rutaCobrador: 'Pepito' },
      { id: 2, nombre: 'B', rutaNombre: 'Ruta #1', rutaCobrador: 'Carlos' },
      { id: 3, nombre: 'C' },
    ]
    expect(avisoDeRobo(clientes, [1, 2, 3]))
      .toBe('2 de estos clientes ya tienen ruta. Al guardarlos aquí salen de la de Pepito y la de Carlos.')
  })

  it('sin cobrador cae al nombre de la ruta, sin «la de la de»', () => {
    const aviso = avisoDeRobo([{ id: 1, nombre: 'A', rutaNombre: 'Ruta 2' }], [1])
    expect(aviso).toBe('Uno de estos clientes ya tiene ruta. Al guardarlo aquí sale de Ruta 2.')
    expect(aviso).not.toMatch(/la de la de/)
  })
})
