// El panel contesta preguntas, no enseña KPIs.
//
// ══ POR QUE ════════════════════════════════════════════════════════════════
//
// El panel tenía 47 cifras de dinero y un botón llamado «Ver más métricas /
// Mostrar solo lo esencial»: la propia app admitiendo que no sabía cuáles
// importaban. Estas pruebas fijan que las cifras que quedan CONTESTAN algo, y
// que las dos restas que hace el adaptador se pueden sumar a mano.
//
// Los números del caso son los reales de PRESTA MIL el 1 ago 2026, medidos
// contra el espejo de producción. Un caso inventado no habría encontrado que
// «meta 0» y «meta ausente» son cosas distintas.

import { describe, it, expect } from 'vitest'
import { adaptarPanelDinero, notaDelPanel } from '../adaptadores/panel-dinero'

const REAL = {
  clientes: { total: 972, enMora: 655, saldoEnMora: 156668198 },
  prestamos: {
    activos: 973,
    saldoPorCobrar: 245497198,
    capitalEnCalle: 201582321,
    cuotaDiariaTotal: 56372300,
    esperadoHoy: 7439400,
    clientesConCobroHoy: 419,
  },
  finanzas: { cajaDisponible: 16674200, gastosMes: 0, patrimonio: 262171398 },
  cobros: {
    hoy: 8850000, cantidadHoy: 65, interesGanadoMes: 331356,
    sparkline7d: [1, 2, 3, 4, 5, 6, 7],
  },
  alertas: { listosParaRenovar: 37, renovarMonto: 1322800, proximosACompletar: [] },
}

const RUTAS = [
  { id: 'r1', nombre: 'RUTA #1', esperadoHoy: 1000000, recaudadoHoy: 900000 },
  { id: 'r2', nombre: 'RUTA #2', esperadoHoy: 1000000, recaudadoHoy: 200000 },
  { id: 'r3', nombre: 'RUTA #3', esperadoHoy: 0, recaudadoHoy: 0 },   // sin actividad
]

describe('las dos restas, sumadas a mano', () => {
  /* Son las únicas dos operaciones que hace el adaptador. Todo lo demás viene
     resuelto de la API con las definiciones del diccionario. */
  it('lo puesto con intereses = mi plata + lo que falta por ganar', () => {
    const p = adaptarPanelDinero(REAL)
    expect(p.puesto.miPlata + p.puesto.porGanar).toBe(p.puesto.conIntereses)
    // Y con las cifras reales: 201.582.321 + 43.914.877 = 245.497.198
    expect(p.puesto.porGanar).toBe(43914877)
  })

  it('la ganancia es el interés cobrado menos los gastos, nunca lo recaudado', () => {
    const p = adaptarPanelDinero(REAL)
    expect(p.ganando.ganancia).toBe(p.ganando.interes - p.ganando.gastos)
    expect(p.ganando.ganancia).toBe(331356)
    // Con «recaudado − gastos» habrían salido $8.850.000: 26 veces más.
    expect(p.ganando.ganancia).not.toBe(REAL.cobros.hoy - REAL.finanzas.gastosMes)
  })

  it('«por ganar» nunca sale negativo aunque los recargos inflen el saldo', () => {
    const conRecargos = {
      ...REAL,
      prestamos: { ...REAL.prestamos, saldoPorCobrar: 100, capitalEnCalle: 5000 },
    }
    expect(adaptarPanelDinero(conRecargos).puesto.porGanar).toBe(0)
  })
})

describe('la meta del día es la del calendario, no el techo de la cartera', () => {
  /* `cuotaDiariaTotal` son $56.372.300 y `esperadoHoy` son $7.439.400: siete
     veces y media de diferencia sobre el mismo día. Usar el techo como meta es
     lo que hacía que la pantalla dijera 48% y el consejo de abajo 9%. */
  it('usa esperadoHoy y no cuotaDiariaTotal', () => {
    const p = adaptarPanelDinero(REAL)
    expect(p.hoy.meta).toBe(7439400)
    expect(p.hoy.meta).not.toBe(REAL.prestamos.cuotaDiariaTotal)
  })

  it('el avance se topa en 100 y no se pasa', () => {
    const p = adaptarPanelDinero(REAL)   // 8.850.000 sobre 7.439.400
    expect(p.hoy.pct).toBe(100)
  })

  /* Un día sin vencimientos con plata cobrada NO es «100% cumplido»: es un día
     sin meta. Son cosas distintas y por eso una es `null` y la otra un número.
     Un domingo en una cartera diaria mostraba 100% y el dueño lo leía como que
     ya había terminado. */
  it('sin meta el porcentaje es null, no cero ni cien', () => {
    const sinMeta = { ...REAL, prestamos: { ...REAL.prestamos, esperadoHoy: 0 } }
    const p = adaptarPanelDinero(sinMeta)
    expect(p.hoy.pct).toBeNull()
    expect(p.hoy.cobrado).toBe(8850000)
  })
})

describe('las rutas: solo las que tienen algo que contar, la peor primero', () => {
  it('deja fuera la ruta sin meta y sin cobro', () => {
    const p = adaptarPanelDinero(REAL, RUTAS)
    expect(p.rutas.map((r) => r.id)).toEqual(['r2', 'r1'])
  })

  it('la que peor va sale primero, que es a la que hay que llamar', () => {
    const p = adaptarPanelDinero(REAL, RUTAS)
    expect(p.rutas[0].pct).toBe(20)
    expect(p.rutas[1].pct).toBe(90)
  })

  it('sin cobradores no hay bloque de rutas', () => {
    const p = adaptarPanelDinero(REAL)
    expect(p.rutas).toEqual([])
    expect(p.contexto.tieneCobradores).toBe(false)
  })
})

describe('la nota que lo explica', () => {
  /* Determinista. Un narrador de IA sobre cifras sin conciliar es un
     amplificador de errores, y ese fallo ya estaba vivo: el consejo del panel
     medía contra el techo de la cartera mientras el hero medía contra la meta. */
  const fmt = (n) => `$${Math.round(n).toLocaleString('es-CO')}`

  it('el formato de moneda se inyecta, no se compone dentro de lib/', () => {
    const p = adaptarPanelDinero(REAL)
    const nota = notaDelPanel(p, fmt)
    // Si el número saliera pelado, aparecería «156668198» sin puntos.
    expect(nota).not.toMatch(/\d{7,}/)
    expect(nota).toMatch(/\$/)
  })

  /* ── NO REPITE LO QUE YA ESTÁ A LA VISTA ────────────────────────────────
     Aquí había una rama de mora, y esta prueba la fijaba. Sobraba: decía «655
     de tus 972 clientes están atrasados» — exactamente lo que la tarjeta
     blanca del panel dice tres centímetros más arriba, y lo que además
     repetía el consejo de IA. La mora se habría dicho CUATRO veces en una
     pantalla.

     La cabecera de `Panel.jsx` ya fija la regla: «la mora se dice UNA vez».
     Una nota que repite un número visible no explica nada. */
  it('no repite la mora, que la tarjeta blanca ya dice arriba', () => {
    const nota = notaDelPanel(adaptarPanelDinero(REAL), fmt)
    expect(nota).not.toMatch(/655 de tus 972/)
    expect(nota).not.toMatch(/en mora|atrasados/i)
  })

  it('sin caja para prestar, eso manda sobre todo lo demás', () => {
    const sinCaja = { ...REAL, finanzas: { ...REAL.finanzas, cajaDisponible: 0 } }
    const nota = notaDelPanel(adaptarPanelDinero(sinCaja), fmt)
    expect(nota).toMatch(/No te queda caja para prestar/)
  })

  it('cuando todo va bien, contesta «cómo me está yendo»', () => {
    const bien = {
      ...REAL,
      clientes: { total: 972, enMora: 10, saldoEnMora: 1000 },
      cobros: { ...REAL.cobros, hoy: 7439400 },
    }
    const nota = notaDelPanel(adaptarPanelDinero(bien), fmt)
    expect(nota).toMatch(/vas a recibir \$43\.914\.877 de ganancia/)
  })

  it('sin datos no se inventa nada', () => {
    expect(adaptarPanelDinero(null)).toBeNull()
    expect(notaDelPanel(null)).toBeNull()
  })
})

describe('cada cifra sabe de dónde sale', () => {
  /* La regla del diccionario: si no se puede escribir la pregunta que contesta
     un número y qué entra en él, ese número sobra. Aquí se comprueba que cada
     cifra del panel lleva el `id` que abre su explicación. */
  it('las cifras llevan su id del diccionario', () => {
    const p = adaptarPanelDinero(REAL)
    expect(p.puesto.ids.miPlata).toBe('capitalEnCalle')
    expect(p.ganando.ids.ganancia).toBe('gananciaMes')
    expect(p.disponible.id).toBe('capitalDisponible')
    expect(p.hoy.ids.meta).toBe('esperado')
  })

  it('y su rótulo sale del diccionario, no escrito a mano', () => {
    const p = adaptarPanelDinero(REAL)
    expect(p.puesto.rotulos.miPlata).toBe('Capital en la calle')
    expect(p.ganando.rotulos.ganancia).toBe('Ganancia del mes')
    expect(p.ganando.rotulos.pct).toBe('Rentabilidad del mes')
  })
})

describe('«listos para renovar» se queda arriba', () => {
  it('trae cantidad y valor juntos, nunca un conteo suelto', () => {
    const p = adaptarPanelDinero(REAL)
    expect(p.renovar.cantidad).toBe(37)
    expect(p.renovar.monto).toBe(1322800)
  })
})
