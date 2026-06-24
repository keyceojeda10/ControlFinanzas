// Test del sistema multi-agente: router + prompts
// Ejecutar: node lib/bot/test-multiagente.js
// Verifica que el router clasifique correctamente y que los prompts
// estén bien ensamblados. NO llama a la IA — solo valida lógica local.

import { clasificar } from './router.js'
import { PROMPT_VENTAS } from './prompts/ventas.js'
import { PROMPT_SOPORTE } from './prompts/soporte.js'
import { PROMPT_CLIENTE } from './prompts/cliente.js'
import { construirContextoLead, construirContextoDatos, CONOCIMIENTO_TECNICO } from './prompts/contexto.js'

let passed = 0
let failed = 0

function test(desc, fn) {
  try {
    fn()
    passed++
    console.log(`  ✓ ${desc}`)
  } catch (e) {
    failed++
    console.error(`  ✗ ${desc}: ${e.message}`)
  }
}

function eq(a, b) {
  if (a !== b) throw new Error(`esperaba "${b}", obtuvo "${a}"`)
}

// ── ROUTER ──────────────────────────────────────────────────────────

console.log('\n=== ROUTER ===')

// Ventas (default)
test('msg genérico → ventas', () => eq(clasificar({ mensaje: 'Hola quiero información', estadoRegistro: 'no_registrado' }), 'ventas'))
test('msg vacío → ventas', () => eq(clasificar({ mensaje: '', estadoRegistro: 'no_registrado' }), 'ventas'))
test('cuanto cuesta → ventas', () => eq(clasificar({ mensaje: 'Cuánto cuesta el plan?', estadoRegistro: 'no_registrado' }), 'ventas'))
test('si me interesa → ventas', () => eq(clasificar({ mensaje: 'Sí me interesa', estadoRegistro: 'no_registrado' }), 'ventas'))
test('como me registro → ventas', () => eq(clasificar({ mensaje: 'Cómo me registro?', estadoRegistro: 'no_registrado' }), 'ventas'))
test('quiero probarlo → ventas', () => eq(clasificar({ mensaje: 'Quiero probarlo', estadoRegistro: 'no_registrado' }), 'ventas'))

// Escalamiento
test('quiero hablar con alguien → escalamiento', () => eq(clasificar({ mensaje: 'Quiero hablar con alguien', estadoRegistro: 'no_registrado' }), 'escalamiento'))
test('persona real → escalamiento', () => eq(clasificar({ mensaje: 'Necesito una persona real', estadoRegistro: 'no_registrado' }), 'escalamiento'))
test('videollamada → escalamiento', () => eq(clasificar({ mensaje: 'Puedo hacer videollamada?', estadoRegistro: 'no_registrado' }), 'escalamiento'))
test('asesor → escalamiento', () => eq(clasificar({ mensaje: 'Paseme un asesor', estadoRegistro: 'no_registrado' }), 'escalamiento'))
test('llamada registrado → escalamiento', () => eq(clasificar({ mensaje: 'Quiero una llamada', estadoRegistro: 'registrado_starter' }), 'escalamiento'))

// Soporte (no registrado)
test('no puedo entrar → soporte', () => eq(clasificar({ mensaje: 'No puedo entrar a mi cuenta', estadoRegistro: 'no_registrado' }), 'soporte'))
test('error → soporte', () => eq(clasificar({ mensaje: 'Me sale un error', estadoRegistro: 'no_registrado' }), 'soporte'))
test('no funciona → soporte', () => eq(clasificar({ mensaje: 'No funciona la página', estadoRegistro: 'no_registrado' }), 'soporte'))
test('no me deja → soporte', () => eq(clasificar({ mensaje: 'No me deja registrar el pago', estadoRegistro: 'no_registrado' }), 'soporte'))
test('pantalla blanca → soporte', () => eq(clasificar({ mensaje: 'Se queda en pantalla blanca', estadoRegistro: 'no_registrado' }), 'soporte'))

// "como hago" de lead no registrado → ventas (quiere info, no soporte real)
test('como hago para probar (no registrado) → ventas', () => eq(clasificar({ mensaje: 'Cómo hago para probar?', estadoRegistro: 'no_registrado' }), 'ventas'))
test('explicame (no registrado) → ventas', () => eq(clasificar({ mensaje: 'Explícame cómo funciona', estadoRegistro: 'no_registrado' }), 'ventas'))

// Cliente registrado
test('msg genérico registrado → cliente', () => eq(clasificar({ mensaje: 'Hola', estadoRegistro: 'registrado_starter' }), 'cliente'))
test('como creo un préstamo (registrado) → cliente', () => eq(clasificar({ mensaje: 'Como creo un préstamo?', estadoRegistro: 'registrado_demo_starter' }), 'cliente'))
test('no puedo entrar (registrado) → cliente', () => eq(clasificar({ mensaje: 'No puedo entrar', estadoRegistro: 'registrado_starter' }), 'cliente'))
test('como pago (registrado) → escalamiento', () => eq(clasificar({ mensaje: 'Como pago el plan?', estadoRegistro: 'registrado_starter' }), 'escalamiento'))
test('se vencio mi prueba → escalamiento', () => eq(clasificar({ mensaje: 'Se me venció la prueba', estadoRegistro: 'registrado_demo_starter' }), 'escalamiento'))
test('quiero seguir (registrado) → escalamiento', () => eq(clasificar({ mensaje: 'Quiero seguir usando el sistema', estadoRegistro: 'registrado_starter' }), 'escalamiento'))

// Edge cases
test('no si quiero → ventas (no es rechazo)', () => eq(clasificar({ mensaje: 'No si quiero', estadoRegistro: 'no_registrado' }), 'ventas'))
test('si si → ventas', () => eq(clasificar({ mensaje: 'Si si', estadoRegistro: 'no_registrado' }), 'ventas'))
test('dale → ventas', () => eq(clasificar({ mensaje: 'Dale', estadoRegistro: 'no_registrado' }), 'ventas'))
test('mensaje automático WA → ventas', () => eq(clasificar({ mensaje: 'Gracias por comunicarte con nosotros', estadoRegistro: 'no_registrado' }), 'ventas'))

// ── PROMPTS ─────────────────────────────────────────────────────────

console.log('\n=== PROMPTS ===')

test('prompt ventas no menciona soporte técnico como rol', () => {
  if (PROMPT_VENTAS.includes('Eres soporte tecnico')) throw new Error('ventas tiene rol de soporte')
})
test('prompt ventas tiene flujo de conversación', () => {
  if (!PROMPT_VENTAS.includes('FLUJO DE CONVERSACION')) throw new Error('falta flujo')
})
test('prompt ventas NO tiene conocimiento técnico detallado', () => {
  if (PROMPT_VENTAS.includes('Modos de interes')) throw new Error('tiene conocimiento técnico que no le corresponde')
})

test('prompt soporte tiene regla de un solo intento', () => {
  if (!PROMPT_SOPORTE.includes('UNA sola indicacion')) throw new Error('falta regla')
})
test('prompt soporte NO tiene flujo de ventas', () => {
  if (PROMPT_SOPORTE.includes('FLUJO DE CONVERSACION')) throw new Error('tiene flujo de ventas')
})
test('prompt soporte escala sin dar numero al lead', () => {
  if (!PROMPT_SOPORTE.includes('asesor')) throw new Error('falta mencion de asesor para escalar')
  if (PROMPT_SOPORTE.includes('301 199 3001')) throw new Error('no debe incluir numero de soporte directo')
})

test('prompt cliente NO manda link de registro', () => {
  if (PROMPT_CLIENTE.includes('registro?r=2')) throw new Error('tiene link de registro')
})
test('prompt cliente tiene regla de respaldo', () => {
  if (!PROMPT_CLIENTE.includes('REGLA DE RESPALDO')) throw new Error('falta regla de respaldo')
})
test('prompt cliente maneja pagos del servicio', () => {
  if (!PROMPT_CLIENTE.includes('PAGOS DEL SERVICIO')) throw new Error('falta sección pagos')
})

// ── CONTEXTO ────────────────────────────────────────────────────────

console.log('\n=== CONTEXTO ===')

test('construirContextoLead genera datos correctos', () => {
  const lead = { nombre: 'Pedro', telefono: '3001234567', metodoActual: 'cuaderno_papel', cantClientes: '20_50' }
  const ctx = construirContextoLead(lead, 'no_registrado', 'mañana (buenos días)', '2026-06-22 09:30')
  if (!ctx.includes('Pedro')) throw new Error('falta nombre')
  if (!ctx.includes('cuaderno_papel')) throw new Error('falta método')
  if (!ctx.includes('YA SABES')) throw new Error('falta instrucción de no repetir')
})

test('construirContextoLead sin datos de formulario no pone IMPORTANTE', () => {
  const lead = { nombre: 'Maria', telefono: '3007654321' }
  const ctx = construirContextoLead(lead, 'no_registrado', 'tarde (buenas tardes)', '2026-06-22 15:00')
  if (ctx.includes('YA SABES')) throw new Error('no debería decir YA SABES sin datos de formulario')
})

test('construirContextoDatos tiene planes y URLs', () => {
  const datos = construirContextoDatos()
  if (!datos.includes('39.000')) throw new Error('falta precio plan inicial')
  if (!datos.includes('registro?r=2')) throw new Error('falta link registro')
  if (!datos.includes('cal.com')) throw new Error('falta link videollamada')
  if (!datos.includes('301 199 3001')) throw new Error('falta teléfono soporte')
  if (!datos.includes('youtu.be')) throw new Error('falta link video')
})

test('CONOCIMIENTO_TECNICO tiene info técnica', () => {
  if (!CONOCIMIENTO_TECNICO.includes('Modos de interes')) throw new Error('falta modos')
  if (!CONOCIMIENTO_TECNICO.includes('Mercancia')) throw new Error('falta mercancia')
  if (!CONOCIMIENTO_TECNICO.toLowerCase().includes('offline')) throw new Error('falta offline')
})

// ── TOKEN SIZE ──────────────────────────────────────────────────────

console.log('\n=== TAMAÑO DE PROMPTS ===')

const datosCtx = construirContextoDatos()

const promptVentasFull = PROMPT_VENTAS + '\n' + datosCtx
const promptSoporteFull = PROMPT_SOPORTE + '\n' + CONOCIMIENTO_TECNICO + '\n' + datosCtx
const promptClienteFull = PROMPT_CLIENTE + '\n' + CONOCIMIENTO_TECNICO + '\n' + datosCtx

const tokensAprox = (s) => Math.round(s.length / 3.5)

console.log(`  Ventas:  ${promptVentasFull.length} chars (~${tokensAprox(promptVentasFull)} tokens)`)
console.log(`  Soporte: ${promptSoporteFull.length} chars (~${tokensAprox(promptSoporteFull)} tokens)`)
console.log(`  Cliente: ${promptClienteFull.length} chars (~${tokensAprox(promptClienteFull)} tokens)`)
console.log(`  ANTES:   40151 chars (~11472 tokens) — prompt único`)
console.log(`  Reducción ventas: ${Math.round((1 - promptVentasFull.length / 40151) * 100)}%`)
console.log(`  Reducción soporte: ${Math.round((1 - promptSoporteFull.length / 40151) * 100)}%`)
console.log(`  Reducción cliente: ${Math.round((1 - promptClienteFull.length / 40151) * 100)}%`)

// ── RESULTADOS ──────────────────────────────────────────────────────

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
