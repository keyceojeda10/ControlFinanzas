// Bloque 5 del plan de seguimiento (12 oct 2026): el bot ofrece el asesor a la
// cartera grande y le contesta al dueño registrado con los datos de SU cuenta.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { esCarteraGrande, botonesCartera, mensajeBienvenida, respuestaDeBoton, esBotonDeCartera } from '@/lib/bot/cartera-post-registro'
import { contextoDe, textoContexto } from '@/lib/bot-v2/contexto'
import { promptPrecios } from '@/lib/bot-v2/prompts'

describe('esCarteraGrande: 50 clientes o más, por el piso del rango', () => {
  it.each([
    ['50_100', true], ['mas_de_100', true], ['100+', true], ['más de 200', true], ['80', true],
    ['20_50', false], ['menos_de_20', false], ['30', false], [null, false], ['', false],
  ])('%s → %s', (v, esperado) => expect(esCarteraGrande(v)).toBe(esperado))
})

describe('la bienvenida tras registrarse', () => {
  it('a la cartera grande: el asesor en vez de «uno por uno», y lo dice el texto', () => {
    const b = botonesCartera({ grande: true })
    expect(b.map((x) => x.id)).toEqual(['cartera_foto', 'cartera_excel', 'cartera_asesor'])
    expect(b).toHaveLength(3) // WhatsApp no admite más de 3 botones
    expect(mensajeBienvenida('Ana', { grande: true })).toMatch(/te los cargamos nosotros/)
  })
  it('a la pequeña: igual que antes', () => {
    expect(botonesCartera().map((x) => x.id)).toEqual(['cartera_foto', 'cartera_excel', 'cartera_mano'])
    expect(mensajeBienvenida('Ana')).not.toMatch(/cargamos nosotros/)
  })
  it('el botón del asesor tiene respuesta y abre la carga', () => {
    expect(esBotonDeCartera('cartera_asesor')).toBe(true)
    const r = respuestaDeBoton('cartera_asesor')
    expect(r.abrirCarga).toBe(true)
    expect(r.texto).toMatch(/cargar-cartera/)
  })
  it('el registro pide `cantClientes` y lo usa (un select sin él decide «no» callado)', () => {
    expect(readFileSync('lib/bot/telefono.js', 'utf8')).toMatch(/select: \{ id: true, telefono: true, organizationId: true, estado: true, cantClientes: true \}/)
    const reg = readFileSync('app/api/auth/registro/route.js', 'utf8')
    expect(reg).toMatch(/const grande = botLeads\.some\(\(b\) => esCarteraGrande\(b\.cantClientes\)\)/)
    expect(reg).toMatch(/sendButtons\(lead\.telefono, texto, botonesCartera\(\{ grande \}\)\)/)
  })
  it('el webhook abre la carga al tocar el botón', () => {
    const wh = readFileSync('app/api/webhook/whatsapp-cloud/route.js', 'utf8')
    expect(wh).toMatch(/if \(r\.abrirCarga\) \{/)
    expect(wh).toMatch(/await abrirSolicitud\(orgId, \{ origen: 'whatsapp' \}\)/)
  })
})

const cuentaBase = { plan: 'Básico', enPrueba: false, vigente: true, vence: '2026-11-03T12:00:00.000Z', clientes: 140, ofertaNequi: false, cargaAbierta: null }

describe('el contexto de la cuenta del dueño', () => {
  it('dice plan, estado y clientes, y prohíbe la prueba gratis', () => {
    const t = textoContexto(contextoDe([], { yaRegistrado: true, cuenta: cuentaBase }))
    expect(t).toMatch(/plan Básico, ya paga, al día hasta el 3 de noviembre, 140 clientes cargados/)
    expect(t).toMatch(/NO le ofrezcas prueba gratis/)
    expect(t).not.toMatch(/35 %/)
    expect(t).not.toMatch(/cargar-cartera/)
  })
  it('la oferta del 35 % solo si le aplica', () => {
    expect(textoContexto(contextoDe([], { yaRegistrado: true, cuenta: { ...cuentaBase, ofertaNequi: true } }))).toMatch(/35 % más barato/)
  })
  it('con pocos clientes ofrece el asesor; con la carga ya pedida, no la vuelve a ofrecer', () => {
    expect(textoContexto(contextoDe([], { yaRegistrado: true, cuenta: { ...cuentaBase, clientes: 2, enPrueba: true } }))).toMatch(/cargar-cartera/)
    const pedida = textoContexto(contextoDe([], { yaRegistrado: true, cuenta: { ...cuentaBase, clientes: 0, cargaAbierta: 'en_revision' } }))
    expect(pedida).toMatch(/el equipo la está cargando/)
    expect(pedida).not.toMatch(/ofrécele que se los carguemos/)
  })
  it('sin registro no hay cuenta aunque llegue una', () => {
    expect(contextoDe([], { yaRegistrado: false, cuenta: cuentaBase }).cuenta).toBeNull()
  })
  it('la cartera grande sin registrar: el asesor como respuesta a «es mucho trabajo»', () => {
    expect(textoContexto(contextoDe([], { lead: { cantClientes: 'mas_de_100' } }))).toMatch(/Maneja 50 clientes o más/)
    expect(textoContexto(contextoDe([], { lead: { cantClientes: '20_50' } }))).not.toMatch(/Maneja 50/)
  })
  it('precios a un cliente: su plan y dónde pagar, sin la prueba gratis del ejemplo de venta', () => {
    const ctx = contextoDe([], { yaRegistrado: true, cuenta: cuentaBase })
    const p = promptPrecios({ nombre: 'Ana', historial: '', clientes: null, contexto: ctx })
    expect(p).toMatch(/YA ES CLIENTE/)
    expect(p).not.toMatch(/Puede probarlo hasta/)
    expect(promptPrecios({ nombre: 'Ana', historial: '', clientes: null, contexto: contextoDe([], {}) })).toMatch(/Puede probarlo hasta/)
  })
})

import { respuestaPagoDeCuenta, ofrecerCargaConAsesor, respuestaCargaConAsesor } from '@/lib/bot-v2/respuestas-cuenta'

describe('respuestas fijas que leen la cuenta', () => {
  it('pagar: su plan con su precio, y la oferta solo si le aplica', () => {
    const sin = respuestaPagoDeCuenta({ ...cuentaBase, precio: 59000 })
    expect(sin).toMatch(/^Su plan Básico vale \$59\.000 al mes\. Se paga desde su misma cuenta/)
    expect(sin).not.toMatch(/35 %/)
    expect(respuestaPagoDeCuenta({ ...cuentaBase, precio: 59000, ofertaNequi: true })).toMatch(/Nequi guardado[^\n]*35 % más barato/)
    expect(respuestaPagoDeCuenta(null)).toMatch(/^Se paga desde su misma cuenta/)
  })
  it.each([
    'no he tenido tiempo de pasar los clientes',
    'me da pereza meter todos los prestamos',
    'son como 200, cómo los cargo',
    'tengo mas de 150 clientes',
  ])('«%s» con pocos clientes → se los cargamos', (t) => {
    expect(ofrecerCargaConAsesor(t, { ...cuentaBase, clientes: 2 })).toBe(true)
  })
  it('no: ya tiene cartera, ya la pidió, o habla de otra cosa', () => {
    expect(ofrecerCargaConAsesor('no he tenido tiempo de pasar los clientes', { ...cuentaBase, clientes: 40 })).toBe(false)
    expect(ofrecerCargaConAsesor('no he tenido tiempo de pasar los clientes', { ...cuentaBase, clientes: 0, cargaAbierta: 'recibida' })).toBe(false)
    expect(ofrecerCargaConAsesor('cuánto vale el plan', { ...cuentaBase, clientes: 0 })).toBe(false)
    expect(ofrecerCargaConAsesor('no he tenido tiempo', null)).toBe(false)
  })
  it('la respuesta lleva el enlace de la carga', () => expect(respuestaCargaConAsesor()).toMatch(/\/cargar-cartera/))
  it('el agente la abre ANTES de decir «mándemelas por aquí»', () => {
    const src = readFileSync('lib/bot-v2/agente.js', 'utf8')
    const abre = src.indexOf('await abrirSolicitud(orgDelUsuario')
    expect(abre).toBeGreaterThan(-1)
    expect(src.indexOf('mensaje: respuestaCargaConAsesor()')).toBeGreaterThan(abre)
  })
  it('el lead con el conteo del formulario: no se lo vuelve a preguntar', () => {
    expect(textoContexto(contextoDe([], { lead: { cantClientes: '20_50' } }))).toMatch(/maneja 20 a 50 clientes: NO le preguntes/)
  })
})
