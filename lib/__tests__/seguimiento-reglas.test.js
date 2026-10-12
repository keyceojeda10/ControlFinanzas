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
      const oferta = src.indexOf('await aplicarOfertaNequi(session.user.organizationId)')
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
