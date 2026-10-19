import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { horaGasto, cuandoGasto, esMediodiaDeGasto, cuandoMovimientoDeGasto } from '@/lib/gastos'
import { diaDeCalendario, mensajeLegible, cuandoNotificacion } from '@/lib/notificacion-texto'

// QA, 19 oct 2026 — DETALLES-CAJA #26 (lo que faltaba), #37 y #40.

// Sin comentarios: este repo cita el fallo junto al arreglo, y una prueba que
// busca texto lo encontraría en la cita.
const leer = (...p) => readFileSync(join(process.cwd(), ...p), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

// Los espacios de «a. m.» cambian con la versión de ICU (normal, U+00A0, U+202F).
const plano = (s) => String(s).replace(/[  ]/g, ' ')
const DIA = String.raw`(\d{1,2})( de)? ([a-z]{3,4})\.?`

/** Un cuid v1 nacido en `ms`. */
const cuidEn = (ms) => `c${ms.toString(36)}0032jwe2j56vllnd`
const ANOTADO = Date.parse('2026-10-19T13:41:51.625Z') // 8:41 a. m. en Bogotá
const MEDIODIA_19 = '2026-10-19T17:00:00.000Z'         // el día del gasto, como se guarda

describe('#26 la hora del gasto en la caja y en Capital', () => {
  it('en una lista de UN día, solo la hora; si se anotó otro día, lo dice', () => {
    expect(plano(horaGasto({ fecha: MEDIODIA_19, anotadoEn: new Date(ANOTADO) }))).toMatch(/^8:41 a\. ?m\.$/)
    expect(plano(horaGasto({ fecha: '2026-10-18T17:00:00.000Z', anotadoEn: new Date(ANOTADO) })))
      .toMatch(new RegExp(`^anotado el ${DIA}, 8:41 a\\. ?m\\.$`))
    // Sin hora conocida, nada: nunca el mediodía guardado.
    expect(horaGasto({ fecha: MEDIODIA_19 })).toBeNull()
    expect(horaGasto({ fecha: MEDIODIA_19, anotadoEn: null })).toBeNull()
  })

  it('la lista de Gastos sigue diciendo lo mismo', () => {
    expect(plano(cuandoGasto({ fecha: MEDIODIA_19, anotadoEn: new Date(ANOTADO) }))).toMatch(new RegExp(`^${DIA}, 8:41 a\\. ?m\\.$`))
    expect(plano(cuandoGasto({ fecha: '2026-10-18T17:00:00.000Z', anotadoEn: new Date(ANOTADO) })))
      .toMatch(new RegExp(`^${DIA} · anotado el ${DIA}, 8:41 a\\. ?m\\.$`))
    expect(plano(cuandoGasto({ fecha: MEDIODIA_19 }))).toMatch(new RegExp(`^${DIA}$`))
  })

  it('el mediodía del gasto se reconoce al milisegundo', () => {
    expect(esMediodiaDeGasto(MEDIODIA_19)).toBe(true)
    expect(esMediodiaDeGasto('2026-10-19T17:00:00.001Z')).toBe(false)
    expect(esMediodiaDeGasto('2026-10-19T13:41:51.625Z')).toBe(false)
    expect(esMediodiaDeGasto(null)).toBe(false)
  })

  it('Capital: el asiento del gasto toma la hora del GASTO; el reverso, la suya', () => {
    const ahora = new Date('2026-10-20T20:00:00Z')
    const asiento = { id: cuidEn(Date.parse('2026-10-19T19:00:00Z')), tipo: 'gasto', referenciaTipo: 'gasto', referenciaId: cuidEn(ANOTADO), createdAt: MEDIODIA_19 }
    expect(plano(cuandoMovimientoDeGasto(asiento, ahora))).toMatch(new RegExp(`^${DIA}, 8:41 a\\. ?m\\.$`))
    // El gasto rechazado al día siguiente: el reverso lleva el día del gasto y su propia hora.
    const reverso = { id: cuidEn(Date.parse('2026-10-20T15:05:00Z')), tipo: 'ajuste', referenciaTipo: 'gasto', referenciaId: cuidEn(ANOTADO), createdAt: MEDIODIA_19 }
    expect(plano(cuandoMovimientoDeGasto(reverso, ahora))).toMatch(new RegExp(`^${DIA} · anotado el ${DIA}, 10:05 a\\. ?m\\.$`))
  })

  it('lo que no es de un gasto, o ya trae su hora de verdad, se queda como estaba', () => {
    // Antes del 17 ago 2026 el asiento guardaba la hora real de la aprobación.
    expect(cuandoMovimientoDeGasto({ id: 'x', tipo: 'gasto', referenciaTipo: 'gasto', referenciaId: cuidEn(ANOTADO), createdAt: '2026-08-10T21:13:05.123Z' })).toBeNull()
    expect(cuandoMovimientoDeGasto({ id: 'x', tipo: 'recaudo', referenciaTipo: 'pago', referenciaId: 'y', createdAt: MEDIODIA_19 })).toBeNull()
    expect(cuandoMovimientoDeGasto(null)).toBeNull()
  })

  it('el API de la caja del cobrador pide el id del gasto y manda `anotadoEn`', () => {
    const api = leer('app', 'api', 'caja', 'cobrador', '[id]', 'route.js')
    const consulta = api.slice(api.indexOf('prisma.gastoMenor.findMany({'), api.indexOf("orderBy: { fecha: 'asc' }", api.indexOf('prisma.gastoMenor.findMany({')))
    expect(consulta).toMatch(/select: \{ id: true, monto: true, description: true, fecha: true, estado: true \}/)
    expect(api).toMatch(/anotadoEn: anotadoEnDelId\(g\.id, g\.fecha\),/)
  })

  it('la caja del administrador enseña esa hora, no la de `fecha`', () => {
    const detalle = leer('components', 'caja', 'CajaCobradorDetalle.jsx')
    expect(detalle).toMatch(/\{horaGasto\(g\) && <span className="text-\[10px\] text-\[var\(--cf-ink-3\)\]">\{horaGasto\(g\)\}<\/span>\}/)
    expect(detalle).not.toMatch(/fmtHora\(g\.fecha\)/)
  })

  it('«de dónde sale» de los gastos: la hora anotada en el detalle y en la hora de Bogotá', () => {
    const api = leer('app', 'api', 'caja', 'procedencia', 'route.js')
    const caso = api.slice(api.indexOf("case 'gastos': {"), api.indexOf("case 'movimientos': {"))
    expect(caso).toMatch(/id: true, description: true, monto: true, fecha: true, estado: true,/)
    expect(caso).toMatch(/horaGasto\(\{ fecha: g\.fecha, anotadoEn: anotadoEnDelId\(g\.id, g\.fecha\) \}\),/)
    expect(caso).toMatch(/cuando: null,/)
    expect(caso).not.toMatch(/cuando: g\.fecha/)
    const hoja = leer('components', 'dinero', 'DeDondeSale.jsx')
    expect(hoja).toMatch(/hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America\/Bogota',/)
  })

  it('Capital → Movimientos usa la regla, y el API le da la fila entera', () => {
    const tab = leer('components', 'capital', 'CapitalTab.jsx')
    expect(tab).toMatch(/\{cuandoMovimientoDeGasto\(m\) \?\? fechaCorta\(m\.createdAt\)\}/)
    // Sin `select`: `referenciaId` y `referenciaTipo` llegan. Si alguien le pone
    // uno, tiene que pedirlos o la hora vuelve a ser la del mediodía, callada.
    const api = leer('app', 'api', 'capital', 'movimientos', 'route.js')
    const consulta = api.slice(api.indexOf('prisma.movimientoCapital.findMany({'), api.indexOf('prisma.movimientoCapital.count('))
    expect(consulta).not.toMatch(/select:/)
  })
})

describe('#37 la campana dice las fechas como se dicen', () => {
  it('«2026-10-18» es «18 de oct» en cualquier zona', () => {
    expect(plano(diaDeCalendario('2026-10-18'))).toMatch(/^18( de)? oct\.?$/)
    expect(plano(diaDeCalendario('2026-01-01'))).toMatch(/^1( de)? ene\.?$/)
  })

  it('los avisos viejos se leen bien sin tocar la base', () => {
    const viejo = 'Camilo Ortiz pide reabrir su caja del 2026-10-18 para seguir registrando abonos.'
    expect(plano(mensajeLegible(viejo))).toMatch(/^Camilo Ortiz pide reabrir su caja del 18( de)? oct\.? para seguir registrando abonos\.$/)
    // Lo que no es una fecha válida, igual.
    expect(mensajeLegible('Código 2026-13-45 y $1.500')).toBe('Código 2026-13-45 y $1.500')
    expect(mensajeLegible(null)).toBeNull()
  })

  it('la hora en 12 h y en la hora del negocio: «18 de oct, 7:22 p. m.», no «19:22»', () => {
    // 00:22Z del 19 = 7:22 p. m. del 18 en Bogotá.
    const texto = plano(cuandoNotificacion('2026-10-19T00:22:00Z', 'co'))
    expect(texto).toMatch(/^18( de)? oct\.?, 7:22 p\. ?m\.$/)
    expect(texto).not.toMatch(/19:22/)
    expect(cuandoNotificacion(null, 'co')).toBe('')
  })

  it('las dos campanas usan la misma regla, y el origen ya no escribe AAAA-MM-DD', () => {
    for (const f of [['components', 'armazon', 'CosasPorResolver.jsx'], ['components', 'layout', 'NotificationsCenter.jsx']]) {
      const src = leer(...f)
      expect(src, f.join('/')).toMatch(/mensajeLegible\(n\.mensaje, locale\)/)
      expect(src, f.join('/')).toMatch(/cuandoNotificacion\(n\.createdAt, country, timezone\)/)
      expect(src, f.join('/')).not.toMatch(/toLocaleDateString\('es', \{/)
    }
    const reabrir = leer('app', 'api', 'caja', 'reabrir', 'route.js')
    expect(reabrir).toMatch(/const diaDicho = diaDeCalendario\(fechaLocal\)/)
    expect(reabrir).toMatch(/pide reabrir su caja del \$\{diaDicho\} para seguir registrando abonos\./)
    expect(reabrir).toMatch(/reabrió su caja del \$\{diaDicho\} para seguir registrando abonos\./)
    expect(reabrir).not.toMatch(/su caja del \$\{fechaLocal\}/)
  })
})

describe('#40 las tildes que faltaban en lo que se ve', () => {
  const casos = [
    [['app', '(dashboard)', 'configuracion', 'page.jsx'], />Días de gracia<\/label>/, />Dias de gracia</],
    [['app', '(dashboard)', 'configuracion', 'page.jsx'], /sin los últimos tres ceros/, /sin los ultimos tres ceros/],
    [['app', '(dashboard)', 'configuracion', 'page.jsx'], /varios días sin pagar, el sistema calcula un interés adicional\. Tú decides si aplicarlo o no desde cada préstamo\./, /varios dias sin pagar/],
    [['app', '(dashboard)', 'lineas-credito', '[id]', 'page.jsx'], /se recalcularán\. Solo se puede eliminar el último corte\./, /el ultimo corte/],
    [['app', '(dashboard)', 'lineas-credito', 'nueva', 'page.jsx'], />Día de corte mensual<\/label>/, />Dia de corte/],
    [['app', '(dashboard)', 'lineas-credito', 'nueva', 'page.jsx'], />Ese día se genera el estado de cuenta del mes: cuánto debe en total/, /Ese dia se genera/],
    [['app', '(dashboard)', 'prestamos', 'nuevo', 'page.jsx'], />Día de la semana<\/button>/, />Dia de la semana</],
    [['app', '(dashboard)', 'prestamos', 'nuevo', 'page.jsx'], />Días del mes<\/button>/, />Dias del mes</],
    [['app', '(dashboard)', 'prestamos', 'nuevo', 'page.jsx'], />Días en que NO se cobra\./, />Dias en que NO/],
    [['app', '(dashboard)', 'prestamos', 'nuevo', 'page.jsx'], /\{calculo\.diasPrimerPeriodo\} días desde que entregas, así que/, /diasPrimerPeriodo\} dias/],
    [['app', '(dashboard)', 'prestamos', '[id]', 'page.jsx'], /\{moratorio\.diasMoraEfectivos\} días efectivos de mora/, /diasMoraEfectivos(\} | \?\? 0\} )dias/],
    [['app', '(dashboard)', 'clientes', '[id]', 'page.jsx'], /% mensual · Corte día \{lc\.diaCorte\}/, /Corte dia \{/],
    [['components', 'prestamos', 'TablaAmortizacion.jsx'], /diario: 'Día',/, /diario: 'Dia',/],
    [['app', 'api', 'cron', 'celebraciones', 'route.js'], /title: 'Gran día de recaudo',/, /Gran dia de/],
    [['app', 'api', 'cron', 'celebraciones', 'route.js'], /title: 'Racha de 5 días sin mora nueva',/, /5 dias sin mora/],
    [['app', 'api', 'lineas-credito', '[id]', 'corte', 'route.js'], /'Solo se puede eliminar el último corte generado'/, /el ultimo corte/],
    [['app', 'api', 'lineas-credito', '[id]', 'desembolso', 'route.js'], /'Solo se pueden eliminar desembolsos del día de hoy'/, /del dia de hoy/],
    [['app', 'api', 'lineas-credito', '[id]', 'pago', 'route.js'], /'Solo se pueden eliminar pagos del día de hoy'/, /del dia de hoy/],
    [['lib', 'linea-credito.js'], /label: 'Interés diario sobre saldo',/, /'Interes /],
    [['lib', 'tips', 'prestamoTips.js'], /Programa tu visita ese día\.`/, /visita ese dia\./],
    [['lib', 'whatsapp.js'], /return `\$\{diasPlazo\} días`/, /\$\{diasPlazo\} dias/],
    [['app', 'admin', 'organizaciones', '[id]', 'page.jsx'], />Día fijo \(opcional\)<\/label>/, /dia fijo|Dia fijo| dias \(|Quitar dias|Vence ese dia|cantidad de dias/],
    [['app', 'admin', 'retencion', 'page.jsx'], /'Nadie vence en los próximos 7 días'/, /proximos 7 dias|>Ultima act/],
  ]
  it.each(casos.map(([f, bien, mal]) => [f.join('/'), f, bien, mal]))('%s', (_n, f, bien, mal) => {
    const src = leer(...f)
    expect(src).toMatch(bien)
    expect(src).not.toMatch(mal)
  })
})
