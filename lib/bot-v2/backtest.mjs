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
