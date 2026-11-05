import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { nivelDe, momentoDe, mensajePara, ordenarParaAtender, PROBABILIDAD, pendientes, QUIERE_PAGAR, PREGUNTA_PRECIO } from '@/lib/seguimiento/serios'
import { firmar, valido, destinatarios, enlace, diaBogota } from '@/lib/seguimiento/enlace-atender'

describe('quién es serio: las reglas medidas el 2 nov 2026', () => {
  it('caliente: cobró en 3 días, o 5 préstamos y entró 3 días, o 5 préstamos y cobró en 2', () => {
    expect(nivelDe({ diasCobro: 3 }).nivel).toBe('caliente')
    expect(nivelDe({ prestamos: 5, diasEntra: 3 }).nivel).toBe('caliente')
    expect(nivelDe({ prestamos: 5, diasCobro: 2 }).nivel).toBe('caliente')
  })
  it('⚠ ya no hay «tibio»: medido sin los calientes pagaba el 13 %, casi ruido', () => {
    expect(nivelDe({ diasEntra: 5, prestamos: 0 }).nivel).toBe(null)
    expect(nivelDe({ clientes: 23, prestamos: 1, diasEntra: 3 }).nivel).toBe(null)
    expect(nivelDe({ prestamos: 4, diasEntra: 5, diasCobro: 2 }).nivel).toBe(null)
    expect(nivelDe({}).nivel).toBe(null)
  })
  it('la razón dice los números, no un adjetivo', () => {
    expect(nivelDe({ prestamos: 23, diasEntra: 4 }).razon).toBe('23 préstamos y entró 4 días')
  })
  it('el «de cada 10» es el medido sin solaparse: 5', () => {
    expect(PROBABILIDAD).toEqual({ caliente: 5 })
  })
})

describe('el momento y el mensaje', () => {
  it('lo que pidió gana a todo: preguntó cómo pagar, o su cartera está sin cargar', () => {
    expect(momentoDe({ quierePagar: true, cargaPendiente: true, diasParaVencer: 1 })).toBe('quiere_pagar')
    expect(momentoDe({ cargaPendiente: true, diasParaVencer: 1 })).toBe('espera')
    expect(mensajePara({ momento: 'quiere_pagar', nombre: 'Albert' })).toMatch(/configuracion\/plan/)
  })
  it('preguntar el precio va después de la cartera por cargar y antes de los que deciden', () => {
    expect(momentoDe({ cargaPendiente: true, preguntoPrecio: true })).toBe('espera')
    expect(momentoDe({ preguntoPrecio: true, diasParaVencer: 1 })).toBe('precio')
    expect(mensajePara({ momento: 'precio', nombre: 'Junior' })).toMatch(/cuánto vale/)
    // El mensaje no dice una cifra: el precio cambia por país y por plan.
    expect(mensajePara({ momento: 'precio', nombre: 'Junior' })).not.toMatch(/\$\d/)
  })
  it('⚠ «pago» suelto no es querer pagar: el prestamista habla de SU negocio', () => {
    const fuerte = new RegExp(QUIERE_PAGAR)
    const precio = new RegExp(PREGUNTA_PRECIO)
    expect(fuerte.test('yo presto pago mensual el interés')).toBe(false)
    expect(precio.test('yo presto pago mensual el interés')).toBe(false)
    expect(fuerte.test('como pago la mensualidad por nequi')).toBe(true)
    expect(fuerte.test('quiero pagar')).toBe(true)
    expect(precio.test('hay que pagar cuánto por la aplicación')).toBe(true)
    expect(precio.test('y que precio tiene')).toBe(true)
    expect(precio.test('¿cuánto vale la mensualidad?')).toBe(true)
  })
  it('decidir gana: la prueba vence en 2 días o menos, o venció hace poco', () => {
    expect(momentoDe({ diasParaVencer: 2, diasSinEntrar: 5, diasCobro: 3 })).toBe('decidir')
    expect(momentoDe({ diasParaVencer: -2 })).toBe('decidir')
    expect(momentoDe({ diasParaVencer: -5, diasSinEntrar: 3 })).toBe('enfrio')
  })
  it('se enfrió a los 2 días sin entrar; cobrando si ya cobra; si no, arrancó', () => {
    expect(momentoDe({ diasParaVencer: 9, diasSinEntrar: 2 })).toBe('enfrio')
    expect(momentoDe({ diasParaVencer: 9, diasCobro: 1 })).toBe('cobrando')
    expect(momentoDe({ diasParaVencer: 9 })).toBe('arranco')
  })
  it('el mensaje lleva el nombre, lo que hizo y quién lo firma', () => {
    const m = mensajePara({ momento: 'cobrando', nombre: 'maría pérez', diasCobro: 3, quien: 'Carlos' })
    expect(m).toMatch(/^Hola María, soy Carlos de Control Finanzas\./)
    expect(m).toMatch(/3 días cobrando/)
    expect(mensajePara({ momento: 'arranco', nombre: 'Tienda 360', prestamos: 12 })).toMatch(/^Hola, soy Carlos/)
  })
  it('primero lo que pidieron, luego los que deciden; los que no son serios ni pidieron nada no salen', () => {
    const l = ordenarParaAtender([
      { nivel: null, momento: 'decidir', prestamos: 0 },
      { nivel: 'caliente', momento: 'arranco', prestamos: 5 },
      { nivel: 'caliente', momento: 'decidir', prestamos: 9 },
      { nivel: null, momento: 'espera', prestamos: 5 },
      { nivel: 'caliente', momento: 'quiere_pagar', prestamos: 21 },
      { nivel: null, momento: 'precio', prestamos: 0 },
    ])
    expect(l.map((f) => `${f.nivel}/${f.momento}`)).toEqual(['caliente/quiere_pagar', 'null/espera', 'null/precio', 'caliente/decidir', 'caliente/arranco'])
  })
  it('las cuentas de cortesía o demo (más de 30 días de prueba por delante) no salen', () => {
    expect(ordenarParaAtender([{ nivel: 'caliente', momento: 'arranco', prestamos: 24, diasParaVencer: 350 }])).toEqual([])
  })
})

describe('el enlace del día', () => {
  beforeAll(() => { process.env.ATENDER_SECRETO = 'secreto-de-prueba' })
  const lista = destinatarios('Carlos:573008875156, Ana:3001112233 ,malo')

  it('lee quién recibe el aviso del .env', () => {
    expect(lista).toEqual([{ quien: 'Carlos', numero: '573008875156' }, { quien: 'Ana', numero: '3001112233' }])
  })
  it('vale hoy y mañana, para esa persona; no después ni para otro', () => {
    const hoy = new Date('2026-11-03T14:00:00Z')
    const d = diaBogota(hoy)
    const k = firmar('Carlos', d)
    expect(valido({ q: 'Carlos', d, k }, hoy, lista)).toBe(true)
    expect(valido({ q: 'Carlos', d, k }, new Date('2026-11-04T14:00:00Z'), lista)).toBe(true)
    expect(valido({ q: 'Carlos', d, k }, new Date('2026-11-05T14:00:00Z'), lista)).toBe(false)
    expect(valido({ q: 'Ana', d, k }, hoy, lista)).toBe(false)
    expect(valido({ q: 'Pedro', d, k: firmar('Pedro', d) }, hoy, lista)).toBe(false)
    expect(enlace('https://x', 'Carlos', hoy)).toBe(`https://x/atender?q=Carlos&d=${d}&k=${k}`)
  })
})

describe('el aviso de las 9 a. m.', () => {
  it('va por la plantilla propia y, si Meta la rechaza o no la aprobó, cae a la de escalamiento', () => {
    const src = readFileSync('app/api/cron/para-atender/route.js', 'utf8')
    const propia = src.indexOf("wa.sendTemplate(numero, 'lista_para_atender', { quien, resumen: resumenTxt, enlace: link })")
    const respaldo = src.indexOf("if (r?.error) {\n      r = await wa.sendTemplate(numero, 'alerta_escalamiento'")
    expect(propia).toBeGreaterThan(-1)
    expect(respaldo).toBeGreaterThan(propia)
  })
})

describe('pendientes', () => {
  const ahora = new Date('2026-11-03T14:00:00Z')
  const hace = (dias) => new Date(ahora.getTime() - dias * 86400000).toISOString()
  it('sale si nadie lo atendió, o si se le habló hace más de 2 días; «Pagó» y «No le interesa» cierran', () => {
    const l = pendientes([
      { id: 1, atencion: null },
      { id: 2, atencion: { resultado: 'hable', cuando: hace(1) } },
      { id: 3, atencion: { resultado: 'no_contesto', cuando: hace(3) } },
      { id: 4, atencion: { resultado: 'pago', cuando: hace(9) } },
      { id: 5, atencion: { resultado: 'no_interesa', cuando: hace(9) } },
    ], ahora)
    expect(l.map((f) => f.id)).toEqual([1, 3])
  })
  it('la página usa la misma regla', () => {
    const src = readFileSync('app/atender/page.jsx', 'utf8')
    expect(src).toMatch(/a\.resultado === 'pago' \|\| a\.resultado === 'no_interesa'/)
    expect(src).toMatch(/> 2 \* 86400000/)
  })
})

describe('con cuál WhatsApp se abre (2 nov 2026)', () => {
  it('en Android elige el Business o el normal por su paquete, y si no está cae a wa.me', async () => {
    const { enlaceWhatsApp, esAndroid } = await import('@/lib/seguimiento/enlace-whatsapp')
    const b = enlaceWhatsApp('573001112233', 'Hola, ¿cómo vas?', 'business')
    expect(b).toBe(`intent://wa.me/573001112233?text=${encodeURIComponent('Hola, ¿cómo vas?')}#Intent;scheme=https;package=com.whatsapp.w4b;S.browser_fallback_url=${encodeURIComponent(`https://wa.me/573001112233?text=${encodeURIComponent('Hola, ¿cómo vas?')}`)};end`)
    expect(enlaceWhatsApp('573001112233', 'x', 'normal')).toMatch(/;package=com\.whatsapp;/)
    expect(esAndroid('Mozilla/5.0 (Linux; Android 14; SM-A546E)')).toBe(true)
    expect(esAndroid('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe(false)
  })
  it('la tarjeta pone el Business primero y deja wa.me fuera de Android', () => {
    const src = readFileSync('app/atender/page.jsx', 'utf8')
    expect(src.indexOf("enlaceWhatsApp(wa, texto, 'business')")).toBeGreaterThan(-1)
    expect(src.indexOf("enlaceWhatsApp(wa, texto, 'business')")).toBeLessThan(src.indexOf("enlaceWhatsApp(wa, texto, 'normal')"))
    expect(src).toMatch(/href=\{enlaceWaMe\(wa, texto\)\}/)
  })
})

describe('en el superadmin, WhatsApp es el Business', () => {
  it('cualquier wa.me se abre en el Business en Android', async () => {
    const { enApp } = await import('@/lib/seguimiento/enlace-whatsapp')
    expect(enApp('https://wa.me/573001112233?text=Hola', 'business'))
      .toBe('intent://wa.me/573001112233?text=Hola#Intent;scheme=https;package=com.whatsapp.w4b;S.browser_fallback_url=https%3A%2F%2Fwa.me%2F573001112233%3Ftext%3DHola;end')
    expect(enApp('https://otra.cosa/x', 'business')).toBe('https://otra.cosa/x')
  })
  it('lo escucha el layout de /admin, una vez para todos los paneles', () => {
    const fs = require('node:fs')
    expect(fs.readFileSync('app/admin/layout.jsx', 'utf8')).toMatch(/<WhatsAppBusiness \/>/)
    expect(fs.readFileSync('components/admin/WhatsAppBusiness.jsx', 'utf8')).toMatch(/closest\?\.\('a\[href\^="https:\/\/wa\.me\/"\]'\)/)
  })
})

describe('⚠ la tableta en «vista de escritorio» también es Android', () => {
  it('reconoce el teléfono y la tableta; no un PC', async () => {
    const { esAndroidNavegador } = await import('@/lib/seguimiento/enlace-whatsapp')
    const tel = 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'
    const escritorio = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
    expect(esAndroidNavegador({ userAgent: tel, maxTouchPoints: 5 })).toBe(true)
    // La tableta del dueño: Chrome se presenta como PC, pero se toca.
    expect(esAndroidNavegador({ userAgent: escritorio, maxTouchPoints: 5 })).toBe(true)
    expect(esAndroidNavegador({ userAgent: escritorio, maxTouchPoints: 0, userAgentData: { platform: 'Android' } })).toBe(true)
    expect(esAndroidNavegador({ userAgent: escritorio, maxTouchPoints: 0 })).toBe(false)
    expect(esAndroidNavegador({ userAgent: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) Chrome/130.0', maxTouchPoints: 10 })).toBe(false)
    expect(esAndroidNavegador({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0', maxTouchPoints: 10 })).toBe(false)
  })
  it('lo usan «Para atender» y el superadmin', () => {
    const fs = require('node:fs')
    expect(fs.readFileSync('app/atender/page.jsx', 'utf8')).toMatch(/setAndroid\(esAndroidNavegador\(navigator\)\)/)
    expect(fs.readFileSync('components/admin/WhatsAppBusiness.jsx', 'utf8')).toMatch(/if \(!esAndroidNavegador\(navigator\)\) return undefined/)
  })
})
