/* Las reglas del motor de seguimiento (lib/seguimiento/reglas.js) y lo que
 * tienen que cumplir las plantillas antes de subirse a Meta. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  enHorario, puedeEnviarHoy, motivoDeRespuesta, esNoMasMensajes, esRespuestaPositiva,
  pasoVencido, motivoParaEscalar, precioConDescuento, claveVencido, diaBogota,
} from '@/lib/seguimiento/reglas'
import { PLANTILLAS_SEGUIMIENTO, definicionParaMeta, parametrosDe, NO_MAS_MENSAJES } from '@/lib/seguimiento/plantillas'

const bog = (iso) => new Date(`${iso}-05:00`)

describe('cuándo se escribe', () => {
  it('solo de 8 a. m. a 7 p. m. de Bogotá', () => {
    expect(enHorario(bog('2026-10-12T07:59:00'))).toBe(false)
    expect(enHorario(bog('2026-10-12T08:00:00'))).toBe(true)
    expect(enHorario(bog('2026-10-12T18:59:00'))).toBe(true)
    expect(enHorario(bog('2026-10-12T19:00:00'))).toBe(false)
  })
  it('un mensaje al día por negocio, contando el día en Bogotá', () => {
    const ahora = bog('2026-10-12T09:00:00')
    expect(puedeEnviarHoy({ ultimoEnvioAt: null }, ahora)).toBe(true)
    expect(puedeEnviarHoy({ ultimoEnvioAt: bog('2026-10-12T08:30:00') }, ahora)).toBe(false)
    // 11 p. m. del día anterior en Bogotá ya es el 12 en UTC: sigue siendo «ayer».
    expect(puedeEnviarHoy({ ultimoEnvioAt: bog('2026-10-11T23:00:00') }, ahora)).toBe(true)
  })
  it('nunca a quien dijo «No quiero más mensajes»', () => {
    expect(puedeEnviarHoy({ noMolestar: true, ultimoEnvioAt: null })).toBe(false)
  })
})

describe('las respuestas', () => {
  it('los botones del motivo, con o sin tildes', () => {
    expect(motivoDeRespuesta('El precio')).toBe('precio')
    expect(motivoDeRespuesta('No alcance a usarla')).toBe('no_uso')
    expect(motivoDeRespuesta('Cambié de sistema')).toBe('otro_sistema')
    expect(motivoDeRespuesta('hola')).toBeNull()
  })
  it('«No quiero más mensajes» y sus variantes escritas', () => {
    expect(esNoMasMensajes(NO_MAS_MENSAJES)).toBe(true)
    expect(esNoMasMensajes('STOP')).toBe(true)
    expect(esNoMasMensajes('no me escriban mas')).toBe(true)
    expect(esNoMasMensajes('no he podido pagar')).toBe(false)
  })
  it('positiva: quiere volver o pregunta el precio; una negación no lo es', () => {
    expect(esRespuestaPositiva('Sí quiero volver')).toBe(true)
    expect(esRespuestaPositiva('llámeme mañana')).toBe(true)
    expect(esRespuestaPositiva('¿cuánto me sale?')).toBe(true)
    expect(esRespuestaPositiva('no quiero pagar')).toBe(false)
    expect(esRespuestaPositiva('no me interesa')).toBe(false)
  })
})

describe('el reenganche de quien se fue', () => {
  const ahora = bog('2026-10-12T10:00:00')
  const hace = (d) => ({ createdAt: new Date(ahora.getTime() - d * 86400000) })

  it('D+3: la pregunta del motivo; antes, nada', () => {
    expect(pasoVencido({ diasVencido: 2, ahora })).toBeNull()
    expect(pasoVencido({ diasVencido: 3, ahora })).toBe('d3_motivo')
  })
  it('las bajas viejas (40 días) empiezan por la pregunta, no por el último mensaje', () => {
    expect(pasoVencido({ diasVencido: 40, ahora })).toBe('d3_motivo')
  })
  it('+4: la oferta solo si dijo «el precio» y no la usó', () => {
    expect(pasoVencido({ diasVencido: 7, enviados: { d3_motivo: hace(4) }, motivo: 'precio', ahora })).toBe('d7_oferta')
    expect(pasoVencido({ diasVencido: 7, enviados: { d3_motivo: hace(4) }, motivo: 'precio', ofertaNequi: 'aplicada', ahora })).toBeNull()
    expect(pasoVencido({ diasVencido: 7, enviados: { d3_motivo: hace(4) }, motivo: 'no_uso', ahora })).toBeNull()
    expect(pasoVencido({ diasVencido: 6, enviados: { d3_motivo: hace(3) }, motivo: 'precio', ahora })).toBeNull()
  })
  it('+18: «sus datos siguen guardados», salvo que cerró el negocio', () => {
    expect(pasoVencido({ diasVencido: 21, enviados: { d3_motivo: hace(18) }, ahora })).toBe('d21_datos')
    expect(pasoVencido({ diasVencido: 21, enviados: { d3_motivo: hace(18) }, motivo: 'cerro', ahora })).toBeNull()
    expect(pasoVencido({ diasVencido: 30, enviados: { d3_motivo: hace(27), d21_datos: hace(9) }, ahora })).toBeNull()
  })
  it('cada vencimiento es un caso aparte', () => {
    expect(claveVencido('o1', bog('2026-10-09T23:59:00'))).toBe('vencido:o1:2026-10-09')
    expect(claveVencido('o1', bog('2026-12-09T00:00:00'))).not.toBe(claveVencido('o1', bog('2026-10-09T00:00:00')))
  })
})

describe('el aviso a Carlos', () => {
  const ahora = bog('2026-10-12T10:00:00')
  it('solo cuentas de 100 clientes o más, y una vez', () => {
    expect(motivoParaEscalar({ clientes: 99, caso: 'en_riesgo', ahora })).toBeNull()
    expect(motivoParaEscalar({ clientes: 100, caso: 'en_riesgo', ahora })).toMatch(/Llamar/)
    expect(motivoParaEscalar({ clientes: 759, caso: 'en_riesgo', yaEscalado: true, ahora })).toBeNull()
  })
  it('por «el precio», «cambié de sistema», una respuesta positiva o 48 h sin respuesta', () => {
    expect(motivoParaEscalar({ clientes: 150, caso: 'vencido', motivo: 'precio', ahora })).toMatch(/35 %/)
    expect(motivoParaEscalar({ clientes: 150, caso: 'vencido', motivo: 'otro_sistema', ahora })).toMatch(/sistema/)
    expect(motivoParaEscalar({ clientes: 150, caso: 'vencido', positiva: true, ahora })).toMatch(/hoy/)
    const motivo = (horas, respuesta = null) => ({ createdAt: new Date(ahora.getTime() - horas * 3600000), respuesta })
    expect(motivoParaEscalar({ clientes: 150, caso: 'vencido', envioMotivo: motivo(47), ahora })).toBeNull()
    expect(motivoParaEscalar({ clientes: 150, caso: 'vencido', envioMotivo: motivo(48), ahora })).toMatch(/48 h/)
    expect(motivoParaEscalar({ clientes: 150, caso: 'vencido', envioMotivo: motivo(72, 'El precio'), motivo: null, ahora })).toBeNull()
  })
})

describe('el 35 %', () => {
  it('redondeado a la centena', () => {
    expect(precioConDescuento(39000)).toBe(25400)
    expect(precioConDescuento(79000)).toBe(51400)
  })
})

describe('las plantillas, antes de subirlas', () => {
  const nombres = Object.keys(PLANTILLAS_SEGUIMIENTO)
  it('Meta no acepta una variable al principio ni al final', () => {
    for (const n of nombres) {
      const t = PLANTILLAS_SEGUIMIENTO[n].texto
      expect(t, n).not.toMatch(/^\s*\{\{\d+\}\}/)
      expect(t, n).not.toMatch(/\{\{\d+\}\}[.!?\s]*$/)
    }
  })
  it('cada {{n}} tiene su variable y su ejemplo, en orden', () => {
    for (const n of nombres) {
      const p = PLANTILLAS_SEGUIMIENTO[n]
      const usadas = [...p.texto.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]))
      expect(usadas, n).toEqual(usadas.map((_, i) => i + 1))
      expect(p.variables.length, n).toBe(usadas.length)
      expect(p.ejemplo.length, n).toBe(usadas.length)
    }
  })
  it('los botones caben: 25 letras, los de respuesta juntos, máximo 10', () => {
    for (const n of nombres) {
      const b = PLANTILLAS_SEGUIMIENTO[n].botones
      expect(b.length, n).toBeLessThanOrEqual(10)
      for (const x of b) expect(x.text.length, `${n}: ${x.text}`).toBeLessThanOrEqual(25)
      const tipos = b.map((x) => x.type).join(',')
      expect(tipos, n).not.toMatch(/QUICK_REPLY,URL/) // agrupados: enlaces primero
    }
  })
  it('utility no lleva palabras de venta; el descuento va como marketing', () => {
    for (const n of nombres) {
      const p = PLANTILLAS_SEGUIMIENTO[n]
      if (p.categoria === 'UTILITY') expect(p.texto, n).not.toMatch(/descuento|aproveche|oferta|no se lo pierda|renueve hoy|gratis/i)
    }
    expect(PLANTILLAS_SEGUIMIENTO.oferta_nequi.categoria).toBe('MARKETING')
  })
  it('lo que se sube y lo que se envía salen de la misma definición', () => {
    expect(definicionParaMeta('cobros_de_hoy').components[0].text).toBe(PLANTILLAS_SEGUIMIENTO.cobros_de_hoy.texto)
    expect(parametrosDe('cobros_de_hoy', { nombre: 'Ana', cobros: 12, monto: '$340.000' })).toEqual(['Ana', '12', '$340.000'])
    expect(() => parametrosDe('cobros_de_hoy', { nombre: 'Ana' })).toThrow(/cobros/)
  })
})

describe('el cableado (anclado en el código)', () => {
  const leer = (r) => readFileSync(r, 'utf8')
  it('el webhook pregunta al seguimiento antes que al bot, y no descarta el botón de plantilla', () => {
    const w = leer('app/api/webhook/whatsapp-cloud/route.js')
    const i = w.indexOf('const atendido = await atenderRespuestaSeguimiento(msg)')
    expect(i).toBeGreaterThan(0)
    expect(i).toBeLessThan(w.indexOf('if (!TIPOS_SOPORTADOS.has(tipo)) return'))
    expect(w).toMatch(/if \(tipo === 'button'\) \{\s*msg = \{ \.\.\.msg, type: 'text'/)
  })
  it('las TRES vías que guardan el medio de pago aplican el 35 % antes del cobro', () => {
    for (const via of ['fuente', 'token', 'nequi']) {
      const src = leer(`app/api/pagos/wompi/${via}/route.js`)
      const oferta = src.indexOf('await aplicarOfertaNequi(session.user.organizationId')
      expect(oferta, via).toBeGreaterThan(0)
      expect(oferta, via).toBeLessThan(src.indexOf('await cobrarAhoraSiToca('))
    }
  })
  it('se reserva la fila ANTES de mandar (el doble envío se paga dos veces)', () => {
    const e = leer('lib/seguimiento/enviar.js')
    expect(e.indexOf('prisma.envioSeguimiento.create(')).toBeLessThan(e.indexOf('wa.sendTemplate('))
  })
  it('«en riesgo» mira el uso real, no lastLoginAt', () => {
    const m = leer('lib/seguimiento/motor.js')
    expect(m).toMatch(/prisma\.sesionActiva\.groupBy/)
    expect(m).not.toMatch(/lastLoginAt:/)
  })
  it('el día de Bogotá', () => {
    expect(diaBogota(bog('2026-10-12T23:30:00'))).toBe('2026-10-12')
  })
})

describe('la prueba de 7 + 7', async () => {
  const { pasoPrueba } = await import('@/lib/seguimiento/reglas')
  const base = (x = {}) => ({
    horasDesdeRegistro: 30, clientes: 10, diasCobro: 1, diasParaRegalo: 3, cobroHoy: false, cobroAyer: false,
    horasSinUso: 2, diasParaVencer: 5, premio: false, cobrosHoy: 8, hora: 12, dia: '2026-10-14', finPrueba: '2026-10-19',
    enviados: new Set(), ...x,
  })
  it('faltan 2 días: lo que hizo y que sus datos quedan (lo más urgente)', () => {
    expect(pasoPrueba(base({ diasParaVencer: 1.5 }))).toMatchObject({ plantilla: 'prueba_por_vencer', paso: 'por_vencer:2026-10-19' })
    // Si ganó el regalo, la fecha cambia y se vuelve a avisar dos días antes del NUEVO fin.
    expect(pasoPrueba(base({ diasParaVencer: 1.5, finPrueba: '2026-10-26', enviados: new Set(['por_vencer:2026-10-19']) }))).toMatchObject({ paso: 'por_vencer:2026-10-26' })
  })
  it('le falta un día para el regalo: solo push (no pasaría como utility)', () => {
    expect(pasoPrueba(base({ diasCobro: 2 }))).toMatchObject({ canal: 'push', paso: 'casi_regalo' })
    expect(pasoPrueba(base({ diasCobro: 2, premio: true }))).toBeNull()
  })
  it('sin cartera a las 24 h: cómo cargarla (y que se la cargamos)', () => {
    expect(pasoPrueba(base({ clientes: 2, diasCobro: 0 }))).toMatchObject({ plantilla: 'cuenta_configurar' })
    expect(pasoPrueba(base({ clientes: 2, diasCobro: 0, horasDesdeRegistro: 10 }))).toBeNull()
  })
  it('con cartera y sin un solo cobro: los cobros de hoy por WhatsApp', () => {
    expect(pasoPrueba(base({ diasCobro: 0 }))).toMatchObject({ plantilla: 'cobros_de_hoy', paso: 'cobros:2026-10-14' })
    expect(pasoPrueba(base({ diasCobro: 0, cobrosHoy: 0 }))).toBeNull() // hoy no le toca nada
  })
  it('cobró ayer y hoy no: push; WhatsApp solo si no abre la app hace un día', () => {
    expect(pasoPrueba(base({ cobroAyer: true }))).toMatchObject({ canal: 'push', paso: 'recordatorio:2026-10-14' })
    expect(pasoPrueba(base({ cobroAyer: true, horasSinUso: 30 }))).toMatchObject({ plantilla: 'cobros_de_hoy' })
    expect(pasoPrueba(base({ cobroAyer: true, hora: 9 }))).toBeNull() // antes de las 11
  })
  it('el WhatsApp de «cobros de hoy» sale como mucho 3 veces en toda la prueba', () => {
    const tres = new Set(['cobros:2026-10-10', 'cobros:2026-10-11', 'cobros:2026-10-12'])
    expect(pasoPrueba(base({ diasCobro: 0, enviados: tres }))).toBeNull()
  })
  it('si ya cobró hoy, no se le escribe nada de cobrar', () => {
    expect(pasoPrueba(base({ cobroHoy: true, cobroAyer: true, horasSinUso: 60 }))).toBeNull()
  })
})

describe('el cableado de la prueba (anclado en el código)', () => {
  const leer = (r) => readFileSync(r, 'utf8')
  it('el registro arranca con 7 días y deja la marca de 7 + 7', () => {
    const r = leer('app/api/auth/registro/route.js')
    expect(r).toMatch(/vencimiento\.setDate\(vencimiento\.getDate\(\) \+ DIAS_PRUEBA_BASE\)/)
    expect(r).toMatch(/await marcarPruebaSiete\(tx, org\.id\)/)
  })
  it('el regalo mueve LAS DOS fechas (la suscripción es la que corta)', () => {
    const p = leer('lib/seguimiento/prueba.js')
    expect(p).toMatch(/prisma\.suscripcion\.update\(\{ where: \{ id: sub\.id \}, data: \{ fechaVencimiento: nuevoFin \} \}\)/)
    expect(p).toMatch(/prisma\.organization\.update\(\{ where: \{ id: organizationId \}, data: \{ planDemoHasta: nuevoFin \} \}\)/)
  })
  it('el cobro dispara el regalo', () => {
    expect(leer('app/api/prestamos/[id]/pagos/route.js')).toMatch(/void evaluarPremioPrueba\(organizationId\)/)
  })
  it('los seis crons viejos se saltan a los de 7 + 7 (nadie recibe los dos)', () => {
    for (const c of ['onboarding-whatsapp', 'activacion-whatsapp', 'primer-cobro-whatsapp', 'trial-reminder', 'recovery-whatsapp', 'reactivacion']) {
      expect(leer(`app/api/cron/${c}/route.js`), c).toMatch(/\.\.\.whereSinPruebaSiete/)
    }
  })
  it('el bot ya no promete 14 días sin condición', () => {
    expect(leer('lib/bot-v2/prompts.js')).toMatch(/registra cobros \$\{EMPRESA\.diasCobroParaRegalo\} días distintos/)
    expect(leer('lib/bot-v2/prompts.js')).not.toMatch(/(?<![Hh]asta )\$\{EMPRESA\.diasPrueba\} d[ií]as gratis/)
    expect(leer('lib/leadMessages.js')).not.toMatch(/(?<![Hh]asta |esos )14 días gratis/)
  })
})

describe('el aviso «Hoy te toca cobrar» (bloque 3)', () => {
  const leer = (r) => readFileSync(r, 'utf8')
  const api = leer('app/api/seguimiento/aviso-del-dia/route.js')
  it('solo dueños en prueba que no pagan, con cobros hoy y sin cobrar todavía', () => {
    expect(api).toMatch(/session\.user\.rol !== 'owner'/)
    expect(api).toMatch(/if \(!prueba \|\| pago > 0\) return NextResponse\.json\(NO\)/)
    expect(api).toMatch(/if \(dias\.includes\(diaBogota\(ahora\)\)\) return NextResponse\.json\(NO\)/)
    expect(api).toMatch(/if \(hoy\.cobros === 0\) return NextResponse\.json\(NO\)/)
  })
  it('está montado en la app y no sale desde las 6 p. m. (toca el resumen)', () => {
    expect(leer('app/(dashboard)/layout.jsx')).toMatch(/<AvisoCobrarHoy \/>/)
    expect(leer('components/cf/AvisoCobrarHoy.jsx')).toMatch(/const HORA_TOPE = 18/)
  })
  it('«Cobrar ahora» abre el primer cobro, y el hook va antes de cualquier return', () => {
    const p = leer('app/(dashboard)/cobros-hoy/page.jsx')
    expect(leer('components/cf/AvisoCobrarHoy.jsx')).toMatch(/window\.location\.assign\('\/cobros-hoy\?empezar=1'\)/)
    expect(p.indexOf('const empezarAlCargar = useRef(')).toBeLessThan(p.indexOf('if (authLoading || loading) return ('))
  })
})
