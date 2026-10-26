/* El comportamiento, no solo el código: un aviso rechazado por corte se vuelve
   a mandar en la siguiente vuelta; uno que llegó, o que rechazó el número, no. */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const filas = new Map()
let enviados = []
vi.mock('@/lib/prisma', () => ({
  prisma: {
    seguimientoOrg: { upsert: async () => ({ noMolestar: false, ultimoEnvioAt: null }), update: async () => ({}) },
    envioSeguimiento: {
      create: async ({ data }) => {
        const k = `${data.claveCaso}|${data.paso}`
        if (filas.has(k)) { const e = new Error('único'); e.code = 'P2002'; throw e }
        const f = { id: k, respondidoAt: null, error: null, wamid: null, ...data }
        filas.set(k, f); return f
      },
      findUnique: async ({ where }) => filas.get(`${where.claveCaso_paso.claveCaso}|${where.claveCaso_paso.paso}`) ?? null,
      updateMany: async ({ where, data }) => {
        const f = filas.get(where.id)
        if (!f || f.ok !== where.ok || f.error !== where.error) return { count: 0 }
        Object.assign(f, data); return { count: 1 }
      },
      update: async ({ where, data }) => Object.assign(filas.get(where.id), data),
    },
  },
}))
vi.mock('@/lib/bot/whatsapp-cloud', () => ({
  telefonoEnviable: () => true,
  sendTemplate: async (tel, plantilla) => { enviados.push(plantilla); return { messages: [{ id: `wamid.${enviados.length}` }] } },
  wamidDe: (r) => r?.messages?.[0]?.id ?? null,
}))
vi.mock('@/lib/seguimiento/meta', () => ({ plantillaAprobada: async () => true }))
vi.mock('@/lib/seguimiento/plantillas', () => ({ parametrosDe: () => ({}) }))
vi.mock('@/lib/seguimiento/reglas', () => ({ puedeEnviarHoy: () => true }))
vi.mock('@/lib/notificar', () => ({ notificar: async () => {} }))

const { enviarPaso } = await import('@/lib/seguimiento/enviar')
const paso = { organizationId: 'o', telefono: '573001112233', caso: 'prueba', claveCaso: 'c1', paso: 'por_vencer', plantilla: 'prueba_por_vencer', datos: {} }

describe('enviarPaso tras un corte de la cuenta', () => {
  beforeEach(() => { filas.clear(); enviados = [] })

  it('llega, y en la siguiente vuelta no se repite', async () => {
    expect((await enviarPaso(paso)).enviado).toBe(true)
    expect(await enviarPaso(paso)).toEqual({ enviado: false, motivo: 'ya_enviado' })
    expect(enviados).toHaveLength(1)
  })

  it('Meta lo rechaza por corte (webhook) → la siguiente vuelta lo vuelve a mandar, una vez', async () => {
    await enviarPaso(paso)
    Object.assign(filas.get('c1|por_vencer'), { ok: false, error: '131042: Business eligibility payment issue' }) // lo que hace el webhook
    const r = await enviarPaso(paso)
    expect(r.enviado).toBe(true)
    expect(filas.get('c1|por_vencer')).toMatchObject({ ok: true, error: null, wamid: 'wamid.2' })
    expect(await enviarPaso(paso)).toEqual({ enviado: false, motivo: 'ya_enviado' })
    expect(enviados).toHaveLength(2)
  })

  it('un rechazo del NÚMERO no se repite', async () => {
    await enviarPaso(paso)
    Object.assign(filas.get('c1|por_vencer'), { ok: false, error: '131026: Message undeliverable' })
    expect(await enviarPaso(paso)).toEqual({ enviado: false, motivo: 'ya_enviado' })
    expect(enviados).toHaveLength(1)
  })
})
