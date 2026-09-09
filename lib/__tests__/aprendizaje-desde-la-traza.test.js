/**
 * BOT v3 · sprint 8: el pipeline de aprendizaje.
 *
 * La autocrítica lleva desde julio dejando lecciones que nadie podía comprobar:
 * 53 quedaron marcadas como «aplicadas» sin haber llegado nunca al código. Con
 * la traza (sprint 1) y los motivos del validador (sprint 7) eso ya se puede
 * contar, así que cada lección sale con el número de mensajes reales que la
 * respaldan, o con el aviso de que no la respalda ninguno.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import { resumirTraza, contrastarLecciones, textoAprendizaje } from '@/lib/bot-v2/aprendizaje'

const fila = (o = {}) => ({ etapa: 'VALOR', clasificacion: 'ventas', proveedor: 'claude', promptId: 'VALOR@abc123', violaciones: null, segundaPasada: false, latenciaMs: 3000, ...o })

describe('resumirTraza', () => {
  it('cuenta solo lo que salió del modelo, no las plantillas ni los caminos fijos', () => {
    const r = resumirTraza([fila(), fila({ proveedor: 'plantilla' }), fila({ proveedor: 'fijo' }), fila({ proveedor: 'deepseek' })])
    expect(r.turnos).toBe(4)
    expect(r.delModelo).toBe(2)
  })
  it('desglosa los motivos y dice en qué etapa pasan', () => {
    const r = resumirTraza([
      fila({ violaciones: 'tuteo,calco_largo', segundaPasada: true }),
      fila({ violaciones: 'tuteo', etapa: 'PRECIOS', segundaPasada: true }),
      fila(),
    ])
    expect(r.motivos).toEqual([['tuteo', 2], ['calco_largo', 1]])
    expect(r.motivosPorEtapa[0]).toEqual(['VALOR·tuteo', 1])
    expect(r.regeneraciones).toBe(2)
    expect(r.tasaRegeneracion).toBe(66.7)
  })
  it('la latencia sale en percentiles y aguanta que falte', () => {
    const r = resumirTraza([fila({ latenciaMs: 1000 }), fila({ latenciaMs: 9000 }), fila({ latenciaMs: null })])
    expect(r.latencia.p50).toBe(9000)
    expect(resumirTraza([fila({ latenciaMs: 0 })]).latencia.p50).toBe(null)
  })
  it('señala la plantilla de prompt que más falla', () => {
    const r = resumirTraza([
      fila({ violaciones: 'tuteo', promptId: 'VALOR@aaa' }),
      fila({ violaciones: 'tuteo', promptId: 'VALOR@aaa' }),
      fila({ violaciones: 'tuteo', promptId: 'CIERRE@bbb' }),
    ])
    expect(r.promptsConMasFallos[0]).toEqual(['VALOR@aaa', 2])
  })
  it('sin datos no revienta', () => {
    expect(resumirTraza([]).delModelo).toBe(0)
    expect(resumirTraza().turnos).toBe(0)
  })
})

describe('contrastarLecciones', () => {
  const resumen = resumirTraza([fila({ violaciones: 'sin_siguiente_paso' }), fila({ violaciones: 'sin_siguiente_paso' }), fila({ violaciones: 'precio_falso' })])
  it('una lección que la traza respalda sale con sus casos', () => {
    const [l] = contrastarLecciones([{ tipo: 'mejora_cierre', leccion: 'El bot dejó la conversación muerta con un quedo atento', accion: 'invitar al siguiente paso' }], resumen)
    expect(l.respaldo.verificada).toBe(true)
    expect(l.respaldo.casos).toBe(2)
    expect(l.respaldo.motivos).toContain('sin_siguiente_paso')
  })
  it('una lección que no aparece en ningún mensaje se marca como no verificada', () => {
    const [l] = contrastarLecciones([{ tipo: 'patron', leccion: 'El bot deberia hablar mas del horario de atencion', accion: 'mencionarlo' }], resumen)
    expect(l.respaldo.verificada).toBe(false)
    expect(l.respaldo.casos).toBe(0)
  })
  it('no pierde ni inventa lecciones', () => {
    const dadas = [{ leccion: 'a' }, { leccion: 'b' }, { leccion: 'c' }]
    expect(contrastarLecciones(dadas, resumen)).toHaveLength(3)
    expect(contrastarLecciones([], resumen)).toEqual([])
  })
})

describe('textoAprendizaje', () => {
  it('dice cuántos se corrigieron, con qué motivo y cuántas lecciones van sin respaldo', () => {
    const resumen = resumirTraza([fila({ violaciones: 'tuteo', segundaPasada: true }), fila()])
    const lecciones = contrastarLecciones([{ leccion: 'tuteo indebido' }, { leccion: 'algo que nadie midio' }], resumen)
    const t = textoAprendizaje(resumen, lecciones)
    expect(t).toContain('2 mensajes del modelo')
    expect(t).toContain('Se corrigieron 1')
    expect(t).toContain('tuteo')
    expect(t).toContain('1 no')
  })
  it('sin mensajes del modelo lo dice y no finge cifras', () => {
    expect(textoAprendizaje(resumirTraza([]))).toBe('Sin mensajes del modelo en el periodo.')
  })
})

describe('la autocrítica usa la traza (anclado en código)', () => {
  const src = fs.readFileSync('lib/bot/autocritica.js', 'utf8')
  it('lee la traza de las últimas 24 h y contrasta las lecciones', () => {
    expect(src).toMatch(/const resumenTraza = resumirTraza\(trazaDelDia\)/)
    expect(src).toMatch(/const todas = contrastarLecciones\(/)
    expect(src).toMatch(/proveedor: \{ not: null \}/)
  })
  it('cada lección de Telegram dice si la traza la respalda', () => {
    expect(src).toMatch(/item\.respaldo\?\.verificada/)
    expect(src).toMatch(/Sin respaldo en la traza de hoy/)
  })
  it('y la lección guardada deja constancia, para poder ordenarlas después', () => {
    expect(src).toMatch(/TRAZA: \$\{item\.respaldo\.casos\} mensajes reales/)
    expect(src).toMatch(/TRAZA: sin respaldo/)
  })
})

describe('el A/B del v3 llega por la autocrítica, que sí corre', () => {
  it('cuenta registros por rama, que es el KPI, no respuestas', async () => {
    const { resumirAB, textoAB } = await import('@/lib/bot-v2/aprendizaje')
    const varianteDe = (id) => (id.startsWith('s') ? 'semantica' : 'regex')
    const leads = [
      { id: 's1', estado: 'cerrado' }, { id: 's2', estado: 'interesado' }, { id: 's3', estado: 'contactado' },
      { id: 'r1', estado: 'contactado' }, { id: 'r2', estado: 'no_interesado' },
    ]
    const ab = resumirAB(leads, varianteDe)
    expect(ab.semantica).toMatchObject({ total: 3, respondieron: 2, registrados: 1, tasaReg: 33.3 })
    expect(ab.regex).toMatchObject({ total: 2, respondieron: 1, registrados: 0, tasaReg: 0 })
  })
  it('con poco volumen lo dice, en vez de fingir un ganador', async () => {
    const { textoAB } = await import('@/lib/bot-v2/aprendizaje')
    const ab = { semantica: { total: 3, registrados: 1, tasaReg: 33.3 }, regex: { total: 2, registrados: 0, tasaReg: 0 } }
    expect(textoAB(ab)).toContain('Todavía no dice nada')
    expect(textoAB({ semantica: { total: 0 }, regex: { total: 0 } })).toBe(null)
  })
  it('⚠ y llegar al mínimo TAMPOCO basta: 20 % contra 10 % con 60 por rama es ruido', async () => {
    const { textoAB } = await import('@/lib/bot-v2/aprendizaje')
    /* Esta prueba esperaba «gana la semántica» hasta el 9 sep 2026. El doble de
       registros parece mucho, pero con 60 por rama la diferencia está a 1,55
       errores típicos: por debajo del 1,96 de siempre. Decidir ahí es decidir a
       cara o cruz — la trampa de [[bug_medidor_falsos_positivos]] aplicada a un
       experimento. */
    const grande = { semantica: { total: 60, registrados: 12, tasaReg: 20 }, regex: { total: 60, registrados: 6, tasaReg: 10 } }
    expect(textoAB(grande)).toContain('cabe en el azar')
    expect(textoAB(grande)).not.toContain('DECISIÓN LISTA')
  })
  it('con una diferencia de verdad sí decide, y dice cómo fijarla', async () => {
    const { textoAB } = await import('@/lib/bot-v2/aprendizaje')
    const claro = { semantica: { total: 120, registrados: 42, tasaReg: 35 }, regex: { total: 120, registrados: 14, tasaReg: 11.7 } }
    expect(textoAB(claro)).toContain('DECISIÓN LISTA')
    expect(textoAB(claro)).toContain('BOT_INTENCION')
  })
  it('la autocrítica lo añade a su mensaje y solo si el reparto está encendido', () => {
    const src = require('fs').readFileSync('lib/bot/autocritica.js', 'utf8')
    expect(src).toMatch(/process\.env\.BOT_INTENCION === 'ab'/)
    expect(src).toMatch(/textoAB\(resumirAB\(leadsAB, \(id\) => varianteDe\(id, 'ab'\)\)\)/)
  })
})

describe('el informe diario que nadie llamaba', () => {
  it('se retiró entero: endpoint, función y llamadas', () => {
    const fs = require('fs')
    expect(fs.existsSync('app/api/cron/whatsapp-bot-report')).toBe(false)
    expect(fs.readFileSync('lib/bot/alertas.js', 'utf8')).not.toMatch(/export async function alertarReporteDiario/)
  })
  it('pero la alerta de entrega, que sí salta sola, se queda', () => {
    expect(require('fs').readFileSync('lib/bot/alertas.js', 'utf8')).toMatch(/export async function alertarFallosEntrega/)
  })
})

describe('el A/B del pitch, que decide el primer mensaje que vende', () => {
  it('cuenta un lead una sola vez, aunque tenga varios mensajes', async () => {
    const { resumirPitch } = await import('@/lib/bot-v2/aprendizaje')
    const r = resumirPitch([
      { promptId: 'pitch:corto', botLeadId: 'a', registrado: true },
      { promptId: 'pitch:corto', botLeadId: 'a', registrado: true },   // el mismo
      { promptId: 'pitch:largo', botLeadId: 'b', registrado: false },
      { promptId: 'otra-cosa', botLeadId: 'c', registrado: true },     // no es pitch
    ])
    expect(r.corto).toMatchObject({ total: 1, registrados: 1, tasa: 100 })
    expect(r.largo).toMatchObject({ total: 1, registrados: 0, tasa: 0 })
  })
  it('con poco volumen lo dice, en vez de dar un ganador falso', async () => {
    const { resumirPitch, textoPitch } = await import('@/lib/bot-v2/aprendizaje')
    expect(textoPitch(resumirPitch([{ promptId: 'pitch:corto', botLeadId: 'a', registrado: true }])))
      .toContain('Todavía no dice nada')
  })
  it('⚠ 30 % contra 16 % con 50 por rama tampoco decide: está a 1,69 errores típicos', async () => {
    const { resumirPitch, textoPitch } = await import('@/lib/bot-v2/aprendizaje')
    const muchos = []
    for (let i = 0; i < 50; i++) muchos.push({ promptId: 'pitch:corto', botLeadId: `c${i}`, registrado: i < 15 })
    for (let i = 0; i < 50; i++) muchos.push({ promptId: 'pitch:largo', botLeadId: `l${i}`, registrado: i < 8 })
    expect(textoPitch(resumirPitch(muchos))).toContain('cabe en el azar')
  })
  it('y cuando la diferencia es clara, lo dice con lo que hay que escribir en el .env', async () => {
    const { resumirPitch, textoPitch } = await import('@/lib/bot-v2/aprendizaje')
    const f = []
    for (let i = 0; i < 90; i++) f.push({ promptId: 'pitch:corto', botLeadId: `c${i}`, registrado: i < 32 })
    for (let i = 0; i < 90; i++) f.push({ promptId: 'pitch:largo', botLeadId: `l${i}`, registrado: i < 12 })
    const t = textoPitch(resumirPitch(f))
    expect(t).toContain('DECISIÓN LISTA')
    expect(t).toContain('BOT_PITCH=corto')
  })
  it('mientras falta muestra dice EN QUÉ FECHA la habrá, al ritmo real', async () => {
    /* El dueño, 9 sep 2026: «¿cuándo hacemos esto? prográmalo para que no se
       nos olvide». No hay que acordarse: la autocrítica lo dice cada noche. */
    const { resumirPitch, textoPitch } = await import('@/lib/bot-v2/aprendizaje')
    const hoy = Date.now()
    const f = []
    for (let i = 0; i < 20; i++) {
      f.push({ promptId: i % 2 ? 'pitch:corto' : 'pitch:largo', botLeadId: `x${i}`,
        createdAt: new Date(hoy - (i % 4) * 86400000), registrado: i < 4 })
    }
    const t = textoPitch(resumirPitch(f))
    expect(t).toMatch(/Faltan \d+; al ritmo de [\d.]+ al día, sobre el \d+ de \w+/)
  })
  it('sin fechas no se inventa una estimación', async () => {
    const { resumirPitch, textoPitch } = await import('@/lib/bot-v2/aprendizaje')
    const t = textoPitch(resumirPitch([
      { promptId: 'pitch:corto', botLeadId: 'a', registrado: false },
      { promptId: 'pitch:largo', botLeadId: 'b', registrado: false },
    ]))
    expect(t).toContain('no hay ritmo para estimar')
  })
  it('la autocrítica le pasa las fechas, o la estimación nunca sale', () => {
    const src = require('fs').readFileSync('lib/bot/autocritica.js', 'utf8')
    expect(src).toMatch(/SELECT c\.promptId, c\.botLeadId, c\.createdAt/)
    expect(src).toMatch(/select: \{ id: true, estado: true, createdAt: true \}/)
  })
  it('⚠ y el fichero de la autocrítica se puede leer con grep', () => {
    /* Tenía caracteres de control LITERALES en una clase de regex. El regex
       funcionaba, pero `file` lo daba por `data` y grep lo saltaba en silencio:
       el 9 sep eso me hizo dar por desconectado este mismo bloque. */
    const buf = require('fs').readFileSync('lib/bot/autocritica.js')
    expect(buf.includes(0), 'byte nulo en el fuente').toBe(false)
    for (const b of buf) expect(b === 9 || b === 10 || b === 13 || b >= 32).toBe(true)
  })
  it('el reparto es estable por lead, como el de intención', async () => {
    const { varianteDePitch } = await import('@/lib/bot-v2/respuestas-fijas')
    for (const id of ['abc', 'def', 'xyz-123']) {
      expect(varianteDePitch(id, 'ab')).toBe(varianteDePitch(id, 'ab'))
      expect(['corto', 'largo']).toContain(varianteDePitch(id, 'ab'))
    }
    // Y se puede forzar con BOT_PITCH si hay que parar el experimento.
    expect(varianteDePitch('abc', 'largo')).toBe('largo')
    expect(varianteDePitch('abc', 'corto')).toBe('corto')
  })
})
