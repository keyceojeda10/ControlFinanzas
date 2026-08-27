// lib/__tests__/el-bot-avisa-si-se-cae-su-modelo.test.js
//
// ══ TRES DÍAS CON EL MODELO DE RESPALDO Y NADIE SE ENTERÓ ══════════════════
//
// Los días 14, 15 y 16 de agosto de 2026 el log de producción acumuló **147
// veces** el mismo error: «Your credit balance is too low». La cuenta de
// Anthropic se quedó sin saldo.
//
// No costó un cliente: el respaldo absorbió los tres días, cero leads se
// quedaron sin respuesta y los registros no bajaron (10, 7 y 8 organizaciones
// nuevas contra 8-12 los días de alrededor). Pero fue suerte del diseño, no
// vigilancia — el fallo solo se veía rebuscando en el log.
//
// El reparto real de aquellos días, que es la señal:
//
//     13 ago   anthropic 89                   ← normal
//     14 ago   anthropic 55 · deepseek 48     ← empieza a caer
//     15 ago   anthropic  0 · deepseek 74     ← caído entero
//     16 ago   anthropic 34 · deepseek 25     ← vuelve
//     17 ago   anthropic 82                   ← normal

import { describe, it, expect } from 'vitest'
import { saludDelModelo, avisoDelModelo } from '@/lib/bot-v2/salud-modelo'

/* Un `prisma` de mentira: la señal sale de la base a propósito, para que
   sobreviva a un reinicio y no se duplique con las dos instancias de PM2. */
const fingirPrisma = (proveedores, mensajesDeLeads = 0) => ({
  botGastoApi: {
    groupBy: async () => Object.entries(proveedores)
      .map(([proveedor, n]) => ({ proveedor, _count: { _all: n } })),
  },
  botConversacion: { count: async () => mensajesDeLeads },
})

describe('cuándo hay que despertar a alguien', () => {
  it('un día normal no dice nada', async () => {
    // 17 de agosto: 82 llamadas, todas al principal.
    const s = await saludDelModelo(fingirPrisma({ anthropic: 82 }), {})
    expect(s.estado).toBe('sano')
  })

  it('el 15 de agosto: el principal a cero y el respaldo cargando con todo', async () => {
    const s = await saludDelModelo(fingirPrisma({ deepseek: 74 }, 30), {})
    expect(s.estado).toBe('respaldo')
    expect(s.principal).toBe(0)
    expect(s.respaldo).toBe(74)
  })

  it('el 14, con el principal aún respondiendo, todavía NO es noticia', async () => {
    /* 55 y 48: se está cayendo, pero el principal contesta. Avisar aquí sería
       gritar por cada llamada que reintenta, y 147 avisos no los lee nadie. */
    const s = await saludDelModelo(fingirPrisma({ anthropic: 55, deepseek: 48 }, 41), {})
    expect(s.estado).toBe('sano')
  })

  it('una sola llamada al respaldo es ruido, no una avería', async () => {
    // El 25 de agosto hubo exactamente una. No pasa nada.
    const s = await saludDelModelo(fingirPrisma({ deepseek: 1 }, 5), {})
    expect(s.estado).not.toBe('respaldo')
  })

  it('⚠ y si llegan mensajes y NO hay ni una llamada, el bot está mudo', async () => {
    /* El caso grave, el que hoy se sabría por un cliente: los dos proveedores
       caídos, o el bot atascado. */
    const s = await saludDelModelo(fingirPrisma({}, 12), {})
    expect(s.estado).toBe('mudo')
    expect(s.mensajesDeLeads).toBe(12)
  })

  it('una hora sin nadie escribiendo NO es estar mudo', async () => {
    // Las cuatro de la mañana. Ni llamadas ni mensajes: no es noticia.
    const s = await saludDelModelo(fingirPrisma({}, 0), {})
    expect(s.estado).toBe('quieto')
  })

  it('un mensaje suelto sin llamada tampoco: el clasificador resuelve sin IA', async () => {
    const s = await saludDelModelo(fingirPrisma({}, 1), {})
    expect(s.estado).toBe('quieto')
  })
})

describe('lo que se lee a las tres de la mañana', () => {
  it('la ventana se dice, no se da por sabida', async () => {
    /* «la última hora» escrito a pelo deja el aviso mintiendo el día que se
       cambie el parámetro. Lo cazó la comprobación contra el espejo, que lo
       apuntó a un día entero. */
    const dia = await saludDelModelo(fingirPrisma({ deepseek: 76 }, 25), { minutos: 24 * 60 })
    expect(avisoDelModelo(dia)).toContain('las últimas 24 horas')
    const hora = await saludDelModelo(fingirPrisma({ deepseek: 76 }, 25), {})
    expect(avisoDelModelo(hora)).toContain('la última hora')
  })

  it('el aviso del respaldo dice qué hacer, no solo qué pasó', async () => {
    const s = await saludDelModelo(fingirPrisma({ deepseek: 74 }, 30), {})
    const t = avisoDelModelo(s)
    expect(t).toContain('modelo de respaldo')
    expect(t).toContain('no se pierde ningún lead')   // que no cunda el pánico
    expect(t).toContain('saldo de Anthropic')          // qué revisar
  })

  it('el de mudo se distingue del otro de un vistazo', async () => {
    const s = await saludDelModelo(fingirPrisma({}, 12), {})
    const t = avisoDelModelo(s)
    expect(t).toContain('🔴')
    expect(t).toContain('no está contestando')
    expect(avisoDelModelo(await saludDelModelo(fingirPrisma({ deepseek: 74 }, 30), {}))).toContain('🟡')
  })
})

describe('el watchdog lo lleva puesto', () => {
  it('vigila el modelo antes del health-check de WhatsApp', async () => {
    const { readFileSync } = await import('fs')
    const src = readFileSync('app/api/cron/whatsapp-watchdog/route.js', 'utf8')
    // Fuera del `try` de Meta: si Meta no responde, el modelo se vigila igual.
    const iModelo = src.indexOf('const modelo = await vigilarElModelo(st)')
    const iTry = src.indexOf('const health = await healthCheck()')
    expect(iModelo).toBeGreaterThan(0)
    expect(iModelo).toBeLessThan(iTry)
  })

  it('avisa UNA vez por incidente, y otra si empeora', async () => {
    const { readFileSync } = await import('fs')
    const src = readFileSync('app/api/cron/whatsapp-watchdog/route.js', 'utf8')
    expect(src).toContain("const empeoro = st.modeloEstado === 'respaldo' && salud.estado === 'mudo'")
    expect(src).toContain('if (!st.modeloAlertado || empeoro)')
  })

  it('y guarda su estado aunque Meta reviente', async () => {
    const { readFileSync } = await import('fs')
    const src = readFileSync('app/api/cron/whatsapp-watchdog/route.js', 'utf8')
    const iCatch = src.indexOf("console.error('[WA Cloud Watchdog] Error:'")
    expect(src.slice(iCatch - 250, iCatch)).toContain('guardarEstado(st)')
  })
})
