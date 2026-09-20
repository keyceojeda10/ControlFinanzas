// «Tu resumen del día» — el dueño, 20 sep 2026.
import { describe, it, expect } from 'vitest'
import { armarResumen, tocaOfrecerlo, fechaLocal, POSPONER_MS, nombreDelDia, textoParaCompartir } from '@/lib/resumen-del-dia'

const a = (h, m = 0) => new Date(2026, 8, 20, h, m)

describe('cuándo se ofrece', () => {
  it('a la hora elegida, y también si la app se abre después', () => {
    expect(tocaOfrecerlo({ hora: 21, ahora: a(20, 59) })).toBe(false)
    expect(tocaOfrecerlo({ hora: 21, ahora: a(21, 0) })).toBe(true)
    expect(tocaOfrecerlo({ hora: 21, ahora: a(23, 40) })).toBe(true)
  })
  it('una vez al día: visto hoy, no vuelve; mañana sí', () => {
    expect(tocaOfrecerlo({ hora: 21, ahora: a(22), visto: fechaLocal(a(22)) })).toBe(false)
    expect(tocaOfrecerlo({ hora: 21, ahora: a(22), visto: '2026-09-19' })).toBe(true)
  })
  it('«todavía no termino» lo calla una hora, no todo el día', () => {
    const ahora = a(21, 5)
    expect(tocaOfrecerlo({ hora: 21, ahora, pospuestoHasta: ahora.getTime() + POSPONER_MS })).toBe(false)
    expect(tocaOfrecerlo({ hora: 21, ahora: a(22, 6), pospuestoHasta: ahora.getTime() + POSPONER_MS })).toBe(true)
  })
  it('apagado (null) no sale nunca', () => {
    expect(tocaOfrecerlo({ hora: null, ahora: a(23) })).toBe(false)
  })
})

describe('lo que dice: las MISMAS cifras del Inicio, ordenadas', () => {
  const d = {
    cobros: { hoy: 546667, cantidadHoy: 5, ayer: 228400, interesGanadoHoy: 96667, capitalRecuperadoHoy: 450000, sparkline7d: [100, 900000, 50, 0, 0, 228400, 546667] },
    prestamos: { esperadoHoy: 800000, clientesConCobroHoy: 12, clientesCobradosHoy: 5 },
    actividadHoy: { prestamos: { cantidad: 1, monto: 1000000 }, gastos: { cantidad: 2, monto: 31220 }, retiros: { monto: 0 }, inyecciones: { monto: 0 },
      desgloseCobradores: [{ nombre: 'Ana', monto: 400000, pagos: 3 }, { nombre: 'Beto', monto: 146667, pagos: 2 }] },
    clientes: { enMora: 18 }, finanzas: { cajaDisponible: 7664318 },
  }
  const r = armarResumen(d, { nombre: 'Carlos Castro' })

  it('no recalcula nada: copia lo del Inicio', () => {
    expect(r).toMatchObject({ cobrado: 546667, tocaba: 800000, cobros: 5, prestado: 1000000, gastos: 31220, ayer: 228400, enMora: 18, enCaja: 7664318 })
    expect(r.clientesHoy).toBe(12); expect(r.clientesCobrados).toBe(5); expect(r.clientesSinCobrar).toBe(7)
  })
  it('lo cobrado se parte en ganancia y plata que vuelve', () => {
    expect(r.interes + r.capitalDeVuelta).toBe(r.cobrado)
  })
  it('saca las cuentas simples que el dueño haría de cabeza', () => {
    expect(r.avance).toBe(68)
    expect(r.faltoPorCobrar).toBe(253333)
    expect(r.movimientoNeto).toBe(546667 - 1000000 - 31220)
    expect(r.vsAyer).toBe(139)
    expect(r.nombre).toBe('Carlos')
  })
  it('el titular es una frase, y no regaña en un día sin cobro', () => {
    expect(r.titular).toBe('Un día a medias')
    expect(armarResumen({ cobros: { hoy: 0 }, prestamos: { esperadoHoy: 0 } }).titular).toBe('Hoy no se movió plata')
    expect(armarResumen({ cobros: { hoy: 50000 }, prestamos: { esperadoHoy: 0 } }).titular).toBe('Hoy no tocaba cobrarle a nadie')
    expect(armarResumen({ cobros: { hoy: 100 }, prestamos: { esperadoHoy: 100 } }).titular).toBe('Cobraste todo lo que tocaba')
  })
  it('sin datos no revienta ni inventa', () => {
    const v = armarResumen(undefined)
    expect(v).toMatchObject({ cobrado: 0, tocaba: 0, avance: null, vsAyer: null, cobradores: [], semana: [] })
  })
})

describe('lo que se le puede PREGUNTAR al resumen', () => {
  const d = {
    cobros: { hoy: 300000, cantidadHoy: 2, mes: 5000000, cantidadMes: 60, interesGanadoMes: 900000, interesGanadoHoy: 50000, capitalRecuperadoHoy: 250000, sparkline7d: [0, 0, 0, 0, 0, 100000, 300000] },
    prestamos: { esperadoHoy: 500000, clientesConCobroHoy: 4, clientesCobradosHoy: 2, capitalEnCalle: 16000000, saldoPorCobrar: 21000000 },
    finanzas: { cajaDisponible: 7000000, gastosMes: 120000 },
    actividadHoy: { prestamos: { cantidad: 1, monto: 1000000, lista: [{ id: 'p1', cliente: 'Ana', monto: 1000000 }] }, gastos: { cantidad: 1, monto: 20000 } },
    detalleDia: {
      pagos: [{ id: 'g1', cliente: 'Ana', monto: 200000, medio: 'Efectivo' }, { id: 'g2', cliente: 'Beto', monto: 100000, medio: 'Nequi' }],
      sinCobrar: [{ clienteId: 'c3', nombre: 'Caro', cuota: 100000, diasMora: 12 }, { clienteId: 'c4', nombre: 'Dani', cuota: 100000, diasMora: 0 }],
      medios: { efectivo: 200000, transferencia: 100000 },
      manana: { monto: 640000, clientes: 9, lista: [] },
      semana: [{ fecha: '2026-09-14', monto: 0, cobros: 0 }, { fecha: '2026-09-20', monto: 300000, cobros: 2 }],
      gastos: [{ id: 'x', que: 'Gasolina', monto: 20000 }],
    },
  }
  const r = armarResumen(d)

  it('las listas cuadran con las cifras de arriba', () => {
    expect(r.pagos.reduce((n, x) => n + x.monto, 0)).toBe(r.cobrado)
    expect(r.pagos).toHaveLength(r.cobros)
    expect(r.sinCobrar).toHaveLength(r.clientesSinCobrar)
    expect(r.medios.efectivo + r.medios.transferencia).toBe(r.cobrado)
  })
  it('la ganancia del mes es interés menos gastos, NUNCA recaudado menos gastos', () => {
    expect(r.mes.ganancia).toBe(900000 - 120000)
    expect(r.mes.ganancia).not.toBe(5000000 - 120000)
  })
  it('sin detalle no revienta: las listas van vacías y mañana no se inventa', () => {
    const v = armarResumen({ cobros: { hoy: 10, sparkline7d: [1, 2] } })
    expect(v).toMatchObject({ pagos: [], sinCobrar: [], manana: null, medios: null })
    expect(v.dias).toHaveLength(2)
  })
  it('un día del calendario no se corre de día al nombrarlo', () => {
    expect(nombreDelDia('2026-09-15')).toMatchObject({ dia: 'martes', numero: 15, mes: 'septiembre' })
    expect(nombreDelDia('2026-09-20').dia).toBe('domingo')
    expect(nombreDelDia('basura')).toBeNull()
  })
  it('el texto para compartir lleva la plata del negocio y NINGÚN nombre de cliente', () => {
    const txt = textoParaCompartir(r, (n) => `$${n}`, 'domingo 20')
    expect(txt).toContain('Entraron: *$300000* en 2 cobros')
    expect(txt).toContain('Mañana toca cobrar $640000 a 9 clientes')
    for (const nombre of ['Ana', 'Beto', 'Caro', 'Dani']) expect(txt).not.toContain(nombre)
  })
})

describe('el detalle sale del MISMO bucle que las cifras', () => {
  const fs = require('fs')
  const api = fs.readFileSync('app/api/dashboard/resumen/route.js', 'utf8')
  const pantalla = fs.readFileSync('components/cf/ResumenDelDia.jsx', 'utf8')

  it('es opt-in: el Inicio no lo pide ni lo paga', () => {
    expect(api).toMatch(/searchParams\.get\('detalle'\) === '1'/)
    expect(api).toContain('...(detalleDia ? { detalleDia } : {}),')
    expect(fs.readFileSync('components/cf/ResumenDelDiaAuto.jsx', 'utf8')).toContain("'/api/dashboard/resumen?detalle=1'")
  })
  it('«no pagaron» = los que tocaban hoy menos los que pagaron: los dos conjuntos de «N de M»', () => {
    expect(api).toMatch(/sinCobrar: \[\.\.\.tocabaHoy\.entries\(\)\]\s*\.filter\(\(\[id\]\) => !pagaronHoy\.has\(id\)\)/)
    // y `tocabaHoy` se llena EXACTAMENTE donde se llena `clientesConCobroHoy`
    const i = api.indexOf('clientesConCobroHoy.add(p.clienteId)')
    expect(api.slice(i, i + 320)).toContain('tocabaHoy.set(p.clienteId, v)')
  })
  it('mañana se pregunta con la gemela de la regla de hoy', () => {
    expect(api).toMatch(/tocaCobrarEn\(p, manana, _diasExcl, festivos\)/)
  })
  it('la pantalla: las barras y los azulejos se TOCAN', () => {
    expect(pantalla).toMatch(/onClick=\{\(\) => setDiaElegido\(i\)\}/)
    expect(pantalla).toMatch(/onClick=\{\(\) => setGente\(gente === 'pagaron' \? null : 'pagaron'\)\}/)
    expect(pantalla).toMatch(/onClick=\{\(\) => setGente\(gente === 'faltan' \? null : 'faltan'\)\}/)
    // los nombres no se recortan
    expect(pantalla).not.toMatch(/textOverflow: 'ellipsis'/)
  })
})
