// Backtest del bot v2 contra los casos criticos del v1.
// Ejecutar: node lib/bot-v2/backtest.mjs

import { clasificar } from './clasificador.js'
import { sanitizar, detectarViolaciones } from './sanitizador.js'

const CASOS = [
  {
    nombre: 'Chelini — Primer contacto (lead responde al template)',
    texto: 'hola si me interesa',
    yaRegistrado: false,
    historial: 0,
    errorV1: 'Parrafo enorme con todas las funciones',
    esperado: 'Saludo corto con UNA pregunta',
  },
  {
    nombre: 'Leymar — "No lo pude instalar"',
    texto: 'No lo pude instalar',
    yaRegistrado: true,
    historial: 5,
    errorV1: 'Dio pasos tecnicos: 1. Abra Chrome 2. Vaya a...',
    esperado: 'ESCALAR a soporte',
  },
  {
    nombre: 'Leymar — "no sé cómo es instalarlo"',
    texto: 'Manito, lo que no sé cómo es instalarlo, por eso es que no he podido',
    yaRegistrado: true,
    historial: 8,
    errorV1: 'Repitio "No es una app de la tienda, abra Chrome..."',
    esperado: 'ESCALAR a soporte',
  },
  {
    nombre: 'Henry — "No lo supe usar"',
    texto: 'Bueno. Dias. No lo supe usar',
    yaRegistrado: true,
    historial: 6,
    errorV1: 'Ofrecio capturas paso a paso (soporte, no ventas)',
    esperado: 'ESCALAR a soporte',
  },
  {
    nombre: 'Cristian — "El sistema no me lo permite"',
    texto: 'Y el sistema no me lo permite',
    yaRegistrado: true,
    historial: 5,
    errorV1: 'Siguio explicando funciones',
    esperado: 'ESCALAR a soporte',
  },
  {
    nombre: 'Erazo — "manejo pura cartulina" (NO debe escalar)',
    texto: 'Si, yo manejo es pura cartulina y lo demas es pura cartulina, toca sacarle al tema para organizar todo',
    yaRegistrado: true,
    historial: 3,
    errorV1: 'Escalo innecesariamente',
    esperado: 'NO escalar — es conversacion de ventas normal',
  },
  {
    nombre: 'Lead pregunta "como pagan mis clientes"',
    texto: 'y como hacen los clientes para pagar?',
    yaRegistrado: false,
    historial: 2,
    errorV1: 'Invento "tiendas y corresponsales"',
    esperado: 'Respuesta de ventas sin inventar funciones',
  },
  {
    nombre: 'Lead pregunta precio',
    texto: 'cuanto vale el plan?',
    yaRegistrado: false,
    historial: 2,
    errorV1: 'Dijo "depende del numero de clientes"',
    esperado: 'Precio FIJO del plan recomendado',
  },
  {
    nombre: 'Lead dice "quiero pagar"',
    texto: 'quiero pagar el plan, como hago?',
    yaRegistrado: true,
    historial: 4,
    errorV1: 'Intento explicar proceso de pago',
    esperado: 'ESCALAR a soporte',
  },
  {
    nombre: 'Lead dice "no me interesa"',
    texto: 'no me interesa gracias',
    yaRegistrado: false,
    historial: 2,
    errorV1: 'Siguio insistiendo',
    esperado: 'Rechazo — despedida cortes',
  },
  // ---- Nuevos casos: fixes de auditoria julio 2026 ----
  {
    nombre: 'Lead nuevo pregunta "precio del plan" — NO escalar',
    texto: 'hola me pueden decir el precio del plan?',
    yaRegistrado: false,
    historial: 1,
    errorV1: 'Escalaba a soporte en vez de mostrar precios',
    esperado: 'NO escalar — es pregunta de preventa',
  },
  {
    nombre: 'Lead registrado pregunta "precio del plan" — SI escalar',
    texto: 'quiero saber el precio del plan para renovar',
    yaRegistrado: true,
    historial: 5,
    errorV1: 'n/a',
    esperado: 'ESCALAR (registrado con intencion de pago)',
  },
  {
    nombre: 'Lead nuevo dice "como hago" — NO escalar',
    texto: 'como hago para probarlo?',
    yaRegistrado: false,
    historial: 2,
    errorV1: 'Escalaba a soporte, perdia la venta',
    esperado: 'NO escalar — es pregunta de preventa',
  },
  {
    nombre: 'Lead registrado dice "como hago" — SI escalar',
    texto: 'como hago para agregar un cobrador?',
    yaRegistrado: true,
    historial: 4,
    errorV1: 'n/a',
    esperado: 'ESCALAR a soporte (registrado)',
  },
  {
    nombre: 'Lead nuevo dice "como se usa" — NO escalar',
    texto: 'como se usa el sistema?',
    yaRegistrado: false,
    historial: 1,
    errorV1: 'Escalaba a soporte',
    esperado: 'NO escalar — es curiosidad preventa',
  },
  {
    nombre: 'Lead nuevo dice "no entiendo" — NO escalar',
    texto: 'no entiendo bien como funciona eso',
    yaRegistrado: false,
    historial: 3,
    errorV1: 'Escalaba a soporte',
    esperado: 'NO escalar — es preventa',
  },
  {
    nombre: 'Lead nuevo con error tecnico real — SI escalar',
    texto: 'me sale error cuando intento registrarme',
    yaRegistrado: false,
    historial: 2,
    errorV1: 'n/a',
    esperado: 'ESCALAR (soporte tecnico real)',
  },
  {
    nombre: 'Lead dice "ya tengo 50 clientes" — NO es objecion',
    texto: 'ya tengo 50 clientes y me cuesta llevar la cuenta',
    yaRegistrado: false,
    historial: 2,
    errorV1: 'Entraba en flujo de OBJECION',
    esperado: 'NO escalar — descripcion del negocio, no objecion',
  },
  {
    nombre: 'Lead dice "ya tengo mi libreta" — SI es objecion',
    texto: 'ya tengo mi libreta y me funciona bien',
    yaRegistrado: false,
    historial: 3,
    errorV1: 'n/a',
    esperado: 'NO escalar — es objecion pero la maneja el AI',
  },
]

console.log('='.repeat(70))
console.log(' BACKTEST BOT V2 — Clasificador')
console.log('='.repeat(70))

let pasados = 0, fallados = 0

for (const caso of CASOS) {
  const result = clasificar(caso.texto, { yaRegistrado: caso.yaRegistrado })
  const debeEscalar = caso.esperado.includes('ESCALAR')
  const debeRechazo = caso.esperado.includes('Rechazo')
  const noDebeEscalar = caso.esperado.includes('NO escalar')

  let ok = false
  if (debeEscalar && result.tipo === 'escalar') ok = true
  if (debeRechazo && result.tipo === 'rechazo') ok = true
  if (noDebeEscalar && result.tipo === 'ventas') ok = true
  if (!debeEscalar && !debeRechazo && !noDebeEscalar && result.tipo === 'ventas') ok = true

  const emoji = ok ? 'PASS' : 'FAIL'
  if (ok) pasados++; else fallados++

  console.log(`\n[${emoji}] ${caso.nombre}`)
  console.log(`  Texto: "${(caso.texto || '(vacio)').slice(0, 60)}"`)
  console.log(`  V1 error: ${caso.errorV1}`)
  console.log(`  Esperado: ${caso.esperado}`)
  console.log(`  V2 result: tipo=${result.tipo}, razon=${result.razon || 'n/a'}`)
}

console.log('\n' + '='.repeat(70))
console.log(' BACKTEST BOT V2 — Sanitizador')
console.log('='.repeat(70))

const testsSanitizador = [
  { input: 'Puede pagar en tiendas y corresponsales de Efecty', violacionEsperada: true },
  { input: 'El plan depende del número de clientes que maneje', violacionEsperada: true },
  { input: 'Soy Daniela, del equipo de Control Finanzas', violacionEsperada: true },
  { input: 'Me llamo Carlos y le ayudo', violacionEsperada: true },
  { input: 'Puede descargar la app en el Play Store', violacionEsperada: true },
  { input: 'Para usted el plan Inicial sale en $39.000 al mes', violacionEsperada: false },
  { input: 'Quiere probarlo 14 dias gratis?', violacionEsperada: false },
  { input: 'Con el codigo PROMO20 tiene descuento', violacionEsperada: true },
  { input: 'Le paso al Nequi y Daviplata', violacionEsperada: true },
  { input: 'La app la encuentra en el App Store', violacionEsperada: true },
  { input: 'PSE o pago con tarjeta desde la plataforma', violacionEsperada: true },
  { input: 'Se registra con nombre, correo y contrasena', violacionEsperada: false },
  { input: 'Usted ve al segundo cuanto cobro cada cobrador', violacionEsperada: false },
  { input: 'Un prestamista me conto que ahorro mucho tiempo', violacionEsperada: true },
  { input: 'Le dejo un video de 15 dias', violacionEsperada: true },
  { input: 'El plan anual del Inicial sale en $390.000', violacionEsperada: false },
  { input: 'El trimestral con descuento queda en $105.300', violacionEsperada: false },
  { input: 'Le sale en $85.000 al mes', violacionEsperada: false },
  // ---- Nuevos tests: auditoria 80 chats julio 2026 ----
  { input: 'El sistema le envia recordatorios automaticos de pago a sus clientes', violacionEsperada: true },
  { input: 'Recibe su aviso automatico el dia del pago', violacionEsperada: true },
  { input: 'Le envia recordatorios de cobro a sus deudores', violacionEsperada: true },
  { input: 'Quedo atenta si necesita algo', violacionEsperada: true },
  { input: 'Quedo atento si necesita algo', violacionEsperada: false },
  { input: 'En la parte de abajo donde dice Cupon le pone GRATIS14', violacionEsperada: true },
  { input: 'El plan anual le queda en $39.000 por todo el ano', violacionEsperada: true },
  // ⚠ "ano" sin tilde: antes el patrón anual con ñ lo dejaba pasar y el lead
  // recibía un precio anual falso; el sanitizador lo corrige a $390.000.
  { input: 'Le sale en $88.500 al mes', violacionEsperada: true },
]

let sanPasados = 0, sanFallados = 0

for (const test of testsSanitizador) {
  const violaciones = detectarViolaciones(test.input)
  const limpio = sanitizar(test.input)
  const hayViolacion = violaciones.length > 0 || limpio !== test.input

  const ok = hayViolacion === test.violacionEsperada
  if (ok) sanPasados++; else sanFallados++

  const emoji = ok ? 'PASS' : 'FAIL'
  console.log(`[${emoji}] "${test.input.slice(0, 55)}..." → ${violaciones.length > 0 ? violaciones.join(', ') : 'limpio'}${limpio !== test.input ? ' [SANITIZADO]' : ''}`)
}

console.log('\n' + '='.repeat(70))
console.log(` RESULTADO FINAL`)
console.log('='.repeat(70))
console.log(`  Clasificador: ${pasados}/${CASOS.length} pasaron (${fallados} fallaron)`)
console.log(`  Sanitizador:  ${sanPasados}/${testsSanitizador.length} pasaron (${sanFallados} fallaron)`)
console.log()

if (fallados > 0 || sanFallados > 0) {
  console.log('  ⚠️  HAY FALLOS — revisar los casos marcados FAIL')
} else {
  console.log('  ✅ TODOS LOS TESTS PASARON')
}
