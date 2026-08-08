// Test del bot de ventas: router + prompt + sanitizadores
// Ejecutar: node lib/bot/test-multiagente.js
// Verifica routing, prompt, postProcesado. NO llama a la IA.

import { clasificar } from './router.js'
import { PROMPT_VENTAS } from './prompts/ventas.js'
import { construirContextoLead, construirContextoDatos } from './prompts/contexto.js'
import { esMensajeAutomatico } from './filtros.js'

let passed = 0
let failed = 0

function test(desc, fn) {
  try {
    fn()
    passed++
    console.log(`  + ${desc}`)
  } catch (e) {
    failed++
    console.error(`  X ${desc}: ${e.message}`)
  }
}

function eq(a, b) {
  if (a !== b) throw new Error(`esperaba "${b}", obtuvo "${a}"`)
}

// ── ROUTER ──────────────────────────────────────────────────────────

console.log('\n=== ROUTER (solo ventas o escalamiento) ===')

// Todo va a ventas por default
test('msg generico → ventas', () => eq(clasificar({ mensaje: 'Hola quiero informacion', estadoRegistro: 'no_registrado' }), 'ventas'))
test('msg vacio → ventas', () => eq(clasificar({ mensaje: '', estadoRegistro: 'no_registrado' }), 'ventas'))
test('cuanto cuesta → ventas', () => eq(clasificar({ mensaje: 'Cuanto cuesta el plan?', estadoRegistro: 'no_registrado' }), 'ventas'))
test('si me interesa → ventas', () => eq(clasificar({ mensaje: 'Si me interesa', estadoRegistro: 'no_registrado' }), 'ventas'))
test('como me registro → ventas', () => eq(clasificar({ mensaje: 'Como me registro?', estadoRegistro: 'no_registrado' }), 'ventas'))
test('quiero probarlo → ventas', () => eq(clasificar({ mensaje: 'Quiero probarlo', estadoRegistro: 'no_registrado' }), 'ventas'))

// Problemas tecnicos ahora van a ventas (el prompt maneja el escalamiento)
test('no puedo entrar → ventas', () => eq(clasificar({ mensaje: 'No puedo entrar a mi cuenta', estadoRegistro: 'no_registrado' }), 'ventas'))
test('error → ventas', () => eq(clasificar({ mensaje: 'Me sale un error', estadoRegistro: 'no_registrado' }), 'ventas'))
test('no funciona → ventas', () => eq(clasificar({ mensaje: 'No funciona la pagina', estadoRegistro: 'no_registrado' }), 'ventas'))
test('no me funciona → ventas', () => eq(clasificar({ mensaje: 'No me funciona', estadoRegistro: 'no_registrado' }), 'ventas'))
test('pantalla blanca → ventas', () => eq(clasificar({ mensaje: 'Se queda en pantalla blanca', estadoRegistro: 'no_registrado' }), 'ventas'))
test('como hago (no registrado) → ventas', () => eq(clasificar({ mensaje: 'Como hago para probar?', estadoRegistro: 'no_registrado' }), 'ventas'))
test('explicame → ventas', () => eq(clasificar({ mensaje: 'Explicame como funciona', estadoRegistro: 'no_registrado' }), 'ventas'))

// Registrados tambien van a ventas (excepto pagos y escalamiento explicito)
test('registrado generico → ventas', () => eq(clasificar({ mensaje: 'Hola', estadoRegistro: 'registrado_starter' }), 'ventas'))
test('registrado pregunta → ventas', () => eq(clasificar({ mensaje: 'Como creo un prestamo?', estadoRegistro: 'registrado_demo_starter' }), 'ventas'))
test('registrado error → ventas', () => eq(clasificar({ mensaje: 'No puedo entrar', estadoRegistro: 'registrado_starter' }), 'ventas'))

// Escalamiento explícito
test('quiero hablar con alguien → escalamiento', () => eq(clasificar({ mensaje: 'Quiero hablar con alguien', estadoRegistro: 'no_registrado' }), 'escalamiento'))
test('persona real → escalamiento', () => eq(clasificar({ mensaje: 'Necesito una persona real', estadoRegistro: 'no_registrado' }), 'escalamiento'))
test('videollamada → escalamiento', () => eq(clasificar({ mensaje: 'Puedo hacer videollamada?', estadoRegistro: 'no_registrado' }), 'escalamiento'))
test('asesor → escalamiento', () => eq(clasificar({ mensaje: 'Paseme un asesor', estadoRegistro: 'no_registrado' }), 'escalamiento'))
test('llamada registrado → escalamiento', () => eq(clasificar({ mensaje: 'Quiero una llamada', estadoRegistro: 'registrado_starter' }), 'escalamiento'))

// Pagos registrados → escalamiento
test('como pago (registrado) → escalamiento', () => eq(clasificar({ mensaje: 'Como pago el plan?', estadoRegistro: 'registrado_starter' }), 'escalamiento'))
test('se vencio mi prueba → escalamiento', () => eq(clasificar({ mensaje: 'Se me vencio la prueba', estadoRegistro: 'registrado_demo_starter' }), 'escalamiento'))
test('quiero seguir (registrado) → escalamiento', () => eq(clasificar({ mensaje: 'Quiero seguir usando el sistema', estadoRegistro: 'registrado_starter' }), 'escalamiento'))

// Pagos NO registrados → ventas (no es escalamiento si no esta registrado)
test('quiero pagar (no registrado) → ventas', () => eq(clasificar({ mensaje: 'Quiero pagar', estadoRegistro: 'no_registrado' }), 'ventas'))

// Edge cases
test('no si quiero → ventas (no es rechazo)', () => eq(clasificar({ mensaje: 'No si quiero', estadoRegistro: 'no_registrado' }), 'ventas'))
test('dale → ventas', () => eq(clasificar({ mensaje: 'Dale', estadoRegistro: 'no_registrado' }), 'ventas'))
test('msg automatico WA → ventas', () => eq(clasificar({ mensaje: 'Gracias por comunicarte con nosotros', estadoRegistro: 'no_registrado' }), 'ventas'))

// ── PROMPT ──────────────────────────────────────────────────────────

console.log('\n=== PROMPT DE VENTAS ===')

test('prompt tiene seccion de mensajes automaticos', () => {
  if (!PROMPT_VENTAS.includes('mensajes automaticos')) throw new Error('falta seccion mensajes automaticos')
})
test('prompt tiene flujo de venta', () => {
  if (!PROMPT_VENTAS.includes('FLUJO DE VENTA')) throw new Error('falta flujo')
})
test('prompt tiene argumentos de venta', () => {
  if (!PROMPT_VENTAS.includes('ARGUMENTOS DE VENTA')) throw new Error('falta argumentos')
})
test('prompt tiene seccion de cobradores', () => {
  if (!PROMPT_VENTAS.includes('CUANDO PREGUNTA POR COBRADORES')) throw new Error('falta cobradores')
})
test('prompt tiene precios', () => {
  if (!PROMPT_VENTAS.includes('39.000')) throw new Error('falta precio')
})
test('prompt tiene objeciones', () => {
  if (!PROMPT_VENTAS.includes('OBJECIONES')) throw new Error('falta objeciones')
})
test('prompt tiene seccion de escalamiento con soporte', () => {
  if (!PROMPT_VENTAS.includes('CUANDO ESCALAS')) throw new Error('falta seccion escalamiento')
})
test('prompt comparte numero de soporte', () => {
  if (!PROMPT_VENTAS.includes('301 199 3001')) throw new Error('falta numero de soporte')
})
test('prompt NO da pasos de soporte como rol', () => {
  if (PROMPT_VENTAS.includes('Eres soporte tecnico')) throw new Error('tiene rol de soporte')
  if (PROMPT_VENTAS.includes('Resuelves problemas tecnicos')) throw new Error('tiene rol de resolver problemas')
})
test('prompt NO corrige al lead por decir app', () => {
  if (PROMPT_VENTAS.includes('NO es una app')) throw new Error('corrige por decir app')
  if (!PROMPT_VENTAS.includes('NUNCA corrijas al lead')) throw new Error('falta regla de no corregir')
})
test('prompt prohibe testimonios inventados', () => {
  if (!PROMPT_VENTAS.includes('NUNCA inventes testimonios')) throw new Error('falta prohibicion testimonios')
})
test('prompt tiene 14 dias correctos', () => {
  if (!PROMPT_VENTAS.includes('14')) throw new Error('falta 14 dias')
})

// ── CONTEXTO ────────────────────────────────────────────────────────

console.log('\n=== CONTEXTO ===')

test('construirContextoLead genera datos correctos', () => {
  const lead = { nombre: 'Pedro', telefono: '3001234567', metodoActual: 'cuaderno_papel', cantClientes: '20_50' }
  const ctx = construirContextoLead(lead, 'no_registrado', 'manana (buenos dias)', '2026-06-22 09:30')
  if (!ctx.includes('Pedro')) throw new Error('falta nombre')
  if (!ctx.includes('cuaderno_papel')) throw new Error('falta metodo')
  if (!ctx.includes('YA SABES')) throw new Error('falta instruccion de no repetir')
})

test('construirContextoLead sin datos no pone IMPORTANTE', () => {
  const lead = { nombre: 'Maria', telefono: '3007654321' }
  const ctx = construirContextoLead(lead, 'no_registrado', 'tarde (buenas tardes)', '2026-06-22 15:00')
  if (ctx.includes('YA SABES')) throw new Error('no deberia decir YA SABES sin datos')
})

test('construirContextoDatos tiene planes y URLs', () => {
  const datos = construirContextoDatos()
  if (!datos.includes('39.000')) throw new Error('falta precio plan inicial')
  if (!datos.includes('registro?r=2')) throw new Error('falta link registro')
  if (!datos.includes('cal.com')) throw new Error('falta link videollamada')
  /* ⚠ AQUÍ SE EXIGÍA QUE EL CONTEXTO TRAJERA UN ENLACE DE YOUTUBE.
     Era una prueba fijando como contrato justo lo que había que quitar: los
     videos son de marzo y enseñan la interfaz de antes del rediseño. Ahora se
     exige lo contrario. (Este archivo es del bot v1, que ya no atiende a nadie:
     el agente vivo es `lib/bot-v2/agente`.) */
  if (/youtu\.be|youtube\.com/i.test(datos)) throw new Error('el contexto NO debe traer videos')
})

test('contexto tiene soporte como dato compartible', () => {
  const datos = construirContextoDatos()
  if (!datos.includes('301 199 3001')) throw new Error('falta telefono soporte')
  if (datos.includes('NUNCA dar este numero')) throw new Error('soporte ya no es dato interno — es compartible')
})

// ── FILTRO MENSAJES AUTOMATICOS ─────────────────────────────────────

console.log('\n=== FILTRO MENSAJES AUTOMATICOS ===')

// Mensajes que SI deben filtrarse (autorespuestas de empresa)
test('filtra bienvenida Inversiones R.M.', () => {
  if (!esMensajeAutomatico('🤑 BIENVENIDO A INVERSIONES R.M. 🤑\n\nGRACIAS POR COMUNICARTE CON NOSOTROS.\n\n💵 OFRECEMOS CRÉDITOS.\n\n📞 EN BREVE UN ASESOR TE ATENDERÁ.')) throw new Error('no filtro')
})
test('filtra autorespuesta simple', () => {
  if (!esMensajeAutomatico('Gracias por comunicarte con nosotros. En breve un asesor te atenderá.')) throw new Error('no filtro')
})
test('filtra fuera de horario', () => {
  if (!esMensajeAutomatico('Respuesta automática: Estamos fuera de horario de atención.')) throw new Error('no filtro')
})
test('filtra mensaje automatico con emoji', () => {
  if (!esMensajeAutomatico('👋 Gracias por contactarnos! Ya te atendemos.')) throw new Error('no filtro')
})
test('filtra horario de atencion', () => {
  if (!esMensajeAutomatico('Gracias por su mensaje. Nuestro horario de atención es de 8am a 5pm.')) throw new Error('no filtro')
})
test('filtra te responderemos pronto', () => {
  if (!esMensajeAutomatico('📩 Hola! Gracias por escribirnos, te responderemos muy pronto.')) throw new Error('no filtro')
})

// Mensajes que NO deben filtrarse (leads reales)
test('NO filtra saludo normal', () => {
  if (esMensajeAutomatico('Hola buenas, cuanto cuesta?')) throw new Error('filtro falso positivo')
})
test('NO filtra pregunta de precio', () => {
  if (esMensajeAutomatico('cuanto me sale para 3 cobradores?')) throw new Error('filtro falso positivo')
})
test('NO filtra queja tecnica', () => {
  if (esMensajeAutomatico('el link no me sirve, no me carga')) throw new Error('filtro falso positivo')
})
test('NO filtra mensaje corto', () => {
  if (esMensajeAutomatico('Hola')) throw new Error('filtro falso positivo')
})
test('NO filtra lead que dice gracias', () => {
  if (esMensajeAutomatico('gracias por la info, me interesa')) throw new Error('filtro falso positivo')
})
test('NO filtra vacio/null', () => {
  if (esMensajeAutomatico('')) throw new Error('filtro falso positivo')
  if (esMensajeAutomatico(null)) throw new Error('filtro falso positivo null')
})

// ── TAMANO ──────────────────────────────────────────────────────────

console.log('\n=== TAMANO DEL PROMPT ===')

const datosCtx = construirContextoDatos()
const promptFull = PROMPT_VENTAS + '\n\n' + datosCtx
const tokensAprox = (s) => Math.round(s.length / 3.5)

console.log(`  Prompt completo: ${promptFull.length} chars (~${tokensAprox(promptFull)} tokens)`)
console.log(`  ANTES (multi-agente): 40151 chars (~11472 tokens)`)
console.log(`  Reduccion: ${Math.round((1 - promptFull.length / 40151) * 100)}%`)

// ── RESULTADOS ──────────────────────────────────────────────────────

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
