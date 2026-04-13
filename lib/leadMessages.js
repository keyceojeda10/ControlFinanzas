// lib/leadMessages.js — Templates de mensajes WhatsApp para leads
// Alineado con guía de ventas WhatsApp (mar 2026)
//
// REGLAS CLAVE (de la guía):
// 1. Velocidad mata — responder en menos de 5 minutos
// 2. WhatsApp no es email — mensajes CORTOS, una idea por mensaje
// 3. Objetivo del primer mensaje: QUE TE CONTESTEN, no vender
// 4. NUNCA asumir método de control sin que el lead lo diga
// 5. SIEMPRE responder precio directo, NUNCA redirigir a la web
// 6. Ofrecer MOSTRAR, no explicar ("te lo muestro en 2 min" > "te explico")
// 7. Máximo 5 intentos en 7 días — después dejarlo ir
// 8. Cada follow-up debe tener un ángulo diferente

export const CATEGORIAS = {
  inicial: { label: 'Inicial', color: '#3b82f6' },
  respuesta: { label: 'Respuesta', color: '#f59e0b' },
  objecion: { label: 'Objeción', color: '#ef4444' },
  seguimiento: { label: 'Seguimiento', color: '#f97316' },
  onboarding: { label: 'Onboarding', color: '#22c55e' },
}

// Helper: primer nombre capitalizado
function saludo(nombre) {
  if (!nombre) return 'cliente'
  const p = nombre.split(' ')[0]
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
}

export const MENSAJES = [
  // ── TOQUE 1: INICIAL (0-5 min después del formulario) ───────
  {
    id: 0,
    label: 'Primer contacto (directo)',
    category: 'inicial',
    condition: 'Para TODOS los leads nuevos. Mensaje CORTO. El objetivo es que responda, nada más. Pregunta fácil de contestar.',
    generate: ({ nombre }) => [
      `Hola ${saludo(nombre)}, acabo de ver tu solicitud.`,
      ``,
      `Una pregunta rápida: tú cobras tú mismo o tienes cobradores en la calle?`,
    ].join('\n'),
  },
  {
    id: 1,
    label: 'Filtro: no es prestamista',
    category: 'inicial',
    condition: 'Si el lead busca un préstamo o crédito para él. Responder amablemente.',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, entiendo la confusión.`,
      ``,
      `Nosotros no prestamos dinero — Control Finanzas es un sistema para personas que *ya prestan* dinero y quieren llevar el control de sus cobros, clientes y cobradores.`,
      ``,
      `Si tú prestas dinero y quieres organizarte mejor, con gusto te ayudo.`,
    ].join('\n'),
  },

  // ── RESPUESTAS SEGÚN LO QUE DIJO ────────────────────────────
  {
    id: 2,
    label: 'Cómo funciona',
    category: 'respuesta',
    condition: 'Cuando dice "dale", "sí", "cuéntame", "cómo es", "cómo funciona".',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, te explico rápido:`,
      ``,
      `Entras desde el navegador de tu celular, registras tus clientes y préstamos, y el sistema calcula las cuotas automático.`,
      ``,
      `Si tienes cobradores, cada uno registra cobros desde su celular y tú ves todo en tiempo real: quién pagó, quién debe, cuánto recogió cada cobrador.`,
      ``,
      `Quieres que te lo muestre? Son 2 minutos.`,
    ].join('\n'),
  },
  {
    id: 8,
    label: 'Cobra solo',
    category: 'respuesta',
    condition: 'Cuando dice que cobra él mismo, no tiene cobradores.',
    generate: ({ nombre }) => [
      `Ah perfecto, entonces tú llevas todo el control.`,
      ``,
      `Déjame preguntarte algo: ahora mismo, sabes exactamente cuánto te deben en total? No más o menos, sino el número exacto.`,
      ``,
      `Porque la mayoría de prestamistas que cobran solos me dicen lo mismo: "más o menos tengo X en calle" pero nunca saben el número real. Y ahí es donde se pierde plata sin darse cuenta.`,
      ``,
      `Control Finanzas te muestra eso en 2 segundos. Cuánto tienes en calle, quién te pagó hoy, quién está en mora. Todo.`,
      ``,
      `Quieres que te muestre cómo se ve? Te mando un video de 1 minuto.`,
    ].join('\n'),
  },
  {
    id: 9,
    label: 'Tiene cobradores',
    category: 'respuesta',
    condition: 'Cuando dice que tiene cobradores.',
    generate: ({ nombre }) => [
      `Uff, entonces tú sabes lo que es confiar en que el cobrador hizo bien su trabajo y no tener cómo verificar.`,
      ``,
      `Con Control Finanzas tu cobrador registra cada cobro desde su celular y a ti te llega en tiempo real. Sabes dónde está, cuánto recogió y si le falta alguien por cobrar.`,
      ``,
      `Si el cobrador dice "el cliente no estaba", tú lo puedes verificar.`,
      ``,
      `Quieres ver cómo funciona? Son 2 minutos.`,
    ].join('\n'),
  },
  {
    id: 3,
    label: 'Usa cuaderno/cartulina',
    category: 'respuesta',
    condition: 'Cuando dice que usa cuaderno, cartulina, tarjetas, libreta o gota a gota / pagadiario.',
    generate: ({ nombre }) => [
      `Entonces manejas cobros diarios. Eso con cuaderno es un dolor de cabeza, cada día anotar, cada día sumar...`,
      ``,
      `El sistema está hecho justo para eso. Registras el préstamo, le pones las cuotas diarias, y cada día solo marcas quién pagó. Al final del día sabes exactamente cuánto recogiste.`,
      ``,
      `Y si el cliente dice "yo ya pagué", le mandas el recibo por WhatsApp y se acabó la discusión.`,
      ``,
      `Te lo muestro en 2 minutos?`,
    ].join('\n'),
  },
  {
    id: 4,
    label: 'Usa Excel',
    category: 'respuesta',
    condition: 'Cuando dice que usa Excel o alguna hoja de cálculo.',
    generate: ({ nombre }) => [
      `Ah bien, o sea que ya sabes lo importante que es tener control. Eso es bueno.`,
      ``,
      `La diferencia con Control Finanzas es que está hecho específicamente para prestamistas. No es un Excel genérico.`,
      ``,
      `Maneja cuotas diarias, intereses, mora, cobradores, recibos por WhatsApp... todo lo que necesitas.`,
      ``,
      `Si quieres lo pruebas 14 días gratis y comparas. Si Excel es mejor, sigues con Excel.`,
    ].join('\n'),
  },
  {
    id: 5,
    label: 'Usa WhatsApp/notas',
    category: 'respuesta',
    condition: 'Cuando dice que lleva control por WhatsApp, notas del celular o "a la antigua".',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, por WhatsApp es difícil buscar pagos después y se mezclan los chats personales con los de cobro.`,
      ``,
      `Con el sistema cada cliente tiene su perfil con historial completo — préstamos, pagos, saldo. Y si tienes cobradores, cada uno ve solo su ruta.`,
      ``,
      `Te lo muestro en 2 minutos?`,
    ].join('\n'),
  },
  {
    id: 6,
    label: 'Usa otra app',
    category: 'respuesta',
    condition: 'Cuando dice que usa otra aplicación o programa.',
    generate: () => [
      `Cuál usas? Pregunto porque muchos se pasan a nosotros por precio y facilidad de uso.`,
      ``,
      `Si quieres comparar, puedes probar 14 días gratis sin compromiso:`,
      `https://app.control-finanzas.com/registro`,
    ].join('\n'),
  },
  {
    id: 21,
    label: 'Préstamos grandes (quincenal/mensual)',
    category: 'respuesta',
    condition: 'Cuando dice que presta a plazos más largos, quincenal o mensual.',
    generate: ({ nombre }) => [
      `Bien, entonces manejas préstamos con plazos más largos.`,
      ``,
      `El sistema te lleva el control de cada cuota, te muestra quién está al día y quién está en mora, y te calcula los intereses automáticamente.`,
      ``,
      `El día que un cliente te diga "yo no debía eso", le mandas el estado de cuenta por WhatsApp y listo.`,
      ``,
      `Quieres verlo? Te mando un video corto.`,
    ].join('\n'),
  },
  {
    id: 7,
    label: 'Pregunta precios',
    category: 'respuesta',
    condition: 'Cuando pregunta por precios. SIEMPRE responder directo. NUNCA decir "mira la web".',
    generate: () => [
      `El plan básico sale en $39.000 al mes. Pero primero pruébalo 14 días gratis sin meter tarjeta.`,
      ``,
      `Si en esos 14 días no sientes que te sirve, no pagas nada. Así de simple.`,
      ``,
      `Quieres que te mande el link para registrarte?`,
    ].join('\n'),
  },
  {
    id: 10,
    label: 'Ya se registró',
    category: 'respuesta',
    condition: 'Cuando el lead ya se registró en la plataforma.',
    generate: ({ nombre }) => [
      `Listo ${saludo(nombre)}, ya vi que te registraste!`,
      ``,
      `Lo primero que te recomiendo es meter 2 o 3 clientes de prueba para que le agarres el tiro. No tiene que ser con datos reales, es solo para que veas cómo funciona.`,
      ``,
      `Si necesitas ayuda me escribes. Estoy para servirte.`,
    ].join('\n'),
  },
  {
    id: 11,
    label: 'No es app, es sistema web',
    category: 'respuesta',
    condition: 'Cuando piensa que es una app descargable.',
    generate: ({ nombre }) => [
      `Funciona desde el navegador de tu celular, como si fuera una página web pero se ve como app.`,
      ``,
      `La ventaja es que no ocupa espacio en tu teléfono y puedes entrar desde cualquier celular o computador.`,
      ``,
      `Solo entra aquí y regístrate:`,
      `https://app.control-finanzas.com/registro`,
    ].join('\n'),
  },
  {
    id: 12,
    label: 'Permisos de cobradores',
    category: 'respuesta',
    condition: 'Cuando pregunta si los cobradores pueden ver toda la info.',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, sí — cada cobrador solo ve los clientes de su ruta. No puede ver clientes de otros cobradores ni información del negocio.`,
      ``,
      `Tú como administrador ves todo: todas las rutas, todos los pagos, cierre de caja de cada cobrador. Pero ellos solo ven lo suyo.`,
      ``,
      `Así mantienes el control sin exponer tu cartera.`,
    ].join('\n'),
  },
  {
    id: 13,
    label: 'Seguridad / datos protegidos',
    category: 'respuesta',
    condition: 'Cuando pregunta por seguridad, si pierde el celular, si datos están protegidos.',
    generate: ({ nombre }) => [
      `Sí, 100%. Los datos son tuyos y de nadie más. Usamos servidores seguros y nadie tiene acceso a tu información.`,
      ``,
      `Si pierdes el celular, solo entras desde otro dispositivo con tu usuario y contraseña y todo sigue ahí.`,
      ``,
      `Y si algún día quieres borrar tu cuenta y todos tus datos, lo haces con un clic.`,
    ].join('\n'),
  },
  {
    id: 14,
    label: 'Video / demostración',
    category: 'respuesta',
    condition: 'Cuando pide un video o quiere ver cómo se ve el sistema.',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, todavía no tenemos video pero te puedo hacer una videollamada rápida de 5 minutos y te muestro el sistema en vivo.`,
      ``,
      `O si prefieres, regístrate gratis y lo exploras tú mismo — es bastante intuitivo:`,
      `https://app.control-finanzas.com/registro`,
      `14 días gratis, sin tarjeta.`,
    ].join('\n'),
  },
  {
    id: 15,
    label: 'Sin cobros adicionales',
    category: 'respuesta',
    condition: 'Cuando pregunta si hay cobros adicionales, comisiones, costos ocultos.',
    generate: () => [
      `No, el precio del plan es todo lo que pagas — no hay cobros adicionales, ni comisiones, ni costos ocultos.`,
      ``,
      `Pagas tu plan mensual y usas el sistema sin límites dentro de lo que incluye tu plan.`,
    ].join('\n'),
  },
  {
    id: 19,
    label: 'Otro método genérico',
    category: 'respuesta',
    condition: 'Cuando dice algo que no encaja en las categorías anteriores.',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, perfecto — sin importar cómo lo lleves ahora, el sistema te va a facilitar bastante el trabajo.`,
      ``,
      `Registras tus préstamos, el sistema calcula las cuotas automático, y si tienes cobradores cada uno lleva su ruta desde el celular.`,
      ``,
      `Te lo muestro en 2 minutos?`,
    ].join('\n'),
  },

  // ── OBJECIONES ───────────────────────────────────────────────
  {
    id: 22,
    label: 'Está muy caro',
    category: 'objecion',
    condition: 'Cuando dice "está caro", "no tengo para eso", "muy costoso".',
    generate: ({ nombre }) => [
      `Entiendo. Pero déjame hacerte una pregunta:`,
      ``,
      `Cuántos cobros se te olvida anotar al mes? Uno? Dos? Si cada cobro es de $10.000 o $15.000, ya con eso pagas el sistema.`,
      ``,
      `La mayoría de prestamistas pierden más de $39.000 al mes en cobros mal anotados y ni se dan cuenta.`,
      ``,
      `Pruébalo gratis 14 días y tú mismo decides si vale la pena o no.`,
    ].join('\n'),
  },
  {
    id: 23,
    label: 'Déjame pensarlo',
    category: 'objecion',
    condition: 'Cuando dice "déjame pensarlo", "luego veo", "después miro".',
    generate: ({ nombre }) => [
      `Claro, sin afán. Solo ten en cuenta que la prueba gratis es de 14 días y no te pide tarjeta.`,
      ``,
      `O sea, no pierdes nada probándolo. Si no te gusta, lo borras y ya.`,
      ``,
      `Te dejo el link por si te animas:`,
      `https://app.control-finanzas.com/registro`,
    ].join('\n'),
  },
  {
    id: 24,
    label: 'Ya tengo un sistema',
    category: 'objecion',
    condition: 'Cuando dice "ya tengo un sistema", "ya uso algo".',
    generate: ({ nombre }) => [
      `Ah bien, o sea que ya sabes lo importante que es tener control. Eso es bueno.`,
      ``,
      `La diferencia con Control Finanzas es que está hecho específicamente para prestamistas. No es un Excel genérico ni una app de finanzas personales.`,
      ``,
      `Maneja cuotas diarias, intereses, mora, cobradores, recibos por WhatsApp... todo lo que necesitas.`,
      ``,
      `Si quieres lo pruebas 14 días gratis y comparas. Si tu sistema actual es mejor, sigues con el tuyo.`,
    ].join('\n'),
  },

  // ── SEGUIMIENTO (5 toques en 7 días) ─────────────────────────
  {
    id: 16,
    label: 'Toque 2: prueba social (24h)',
    category: 'seguimiento',
    condition: '24 horas sin respuesta. Ángulo: prueba social.',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, no sé si viste mi mensaje de ayer.`,
      ``,
      `Solo quería contarte que ya son más de 500 prestamistas en Colombia usando esto. La mayoría me dicen lo mismo: "por qué no lo conocí antes".`,
      ``,
      `Si quieres te muestro cómo funciona en 2 minutos. Si no te interesa, no hay problema, me dices y no te vuelvo a escribir.`,
    ].join('\n'),
  },
  {
    id: 25,
    label: 'Toque 2 alt: dolor directo (24h)',
    category: 'seguimiento',
    condition: '24h sin respuesta. Ángulo alternativo: dolor directo.',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, una pregunta:`,
      ``,
      `Alguna vez un cliente te ha dicho "yo ya pagué eso" y tú no tenías cómo demostrar lo contrario?`,
      ``,
      `Si te ha pasado, esto te va a interesar.`,
      `Si no, ignórame tranquilo jaja`,
    ].join('\n'),
  },
  {
    id: 17,
    label: 'Toque 3: beneficio concreto (48h)',
    category: 'seguimiento',
    condition: '48 horas sin respuesta. Ángulo: beneficio concreto con número.',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, se me quedó pendiente contarte.`,
      ``,
      `Un prestamista que usa el sistema me dijo que desde que lo tiene dejó de perder como $200.000 al mes en cobros que se le olvidaba anotar.`,
      ``,
      `La app es gratis 14 días. Sin tarjeta, sin compromiso.`,
      `Quieres que te mande el link?`,
    ].join('\n'),
  },
  {
    id: 26,
    label: 'Toque 4: link + despedida (72h)',
    category: 'seguimiento',
    condition: '72 horas (3 días) sin respuesta. Última oportunidad seria.',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, última vez que te escribo sobre esto.`,
      ``,
      `Solo quería dejarte el link por si algún día lo necesitas:`,
      `https://app.control-finanzas.com/registro`,
      ``,
      `Son 14 días gratis. Si en esos 14 días no ves que te ahorra tiempo y plata, lo borras y ya.`,
      ``,
      `Éxitos con tu negocio!`,
    ].join('\n'),
  },
  {
    id: 18,
    label: 'Toque 5: cierre definitivo (7 días)',
    category: 'seguimiento',
    condition: 'Una semana después. Cierre del ciclo con dignidad.',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, soy Carlos de Control Finanzas. Te escribí hace unos días pero entiendo que a veces no es el momento.`,
      ``,
      `Si algún día necesitas organizar tus préstamos y dejar el cuaderno, aquí estoy.`,
      ``,
      `Que te vaya bien!`,
    ].join('\n'),
  },

  // ── ONBOARDING (después del registro) ────────────────────────
  {
    id: 20,
    label: 'Post-registro: verificó correo',
    category: 'onboarding',
    condition: 'Justo después de que se registra.',
    generate: ({ nombre }) => [
      `Listo ${saludo(nombre)}, ya vi que te registraste!`,
      ``,
      `Lo primero que te recomiendo es meter 2 o 3 clientes de prueba para que le agarres el tiro. No tiene que ser con datos reales, es solo para que veas cómo funciona.`,
      ``,
      `Si necesitas ayuda me escribes. Estoy para servirte.`,
    ].join('\n'),
  },
  {
    id: 27,
    label: 'Onboarding: 24h sin usar',
    category: 'onboarding',
    condition: '24h después del registro si no ha metido clientes.',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, cómo te ha ido con el sistema?`,
      ``,
      `Si todavía no has metido tu primer cliente, te explico rápido: vas a Clientes > Nuevo Cliente, pones el nombre y el teléfono, y listo.`,
      ``,
      `Después le creas el préstamo y ya el sistema te lleva las cuotas solo.`,
      ``,
      `Cualquier duda me escribes.`,
    ].join('\n'),
  },
  {
    id: 28,
    label: 'Onboarding: 3 días sin usar',
    category: 'onboarding',
    condition: '3 días después del registro si no ha usado el sistema.',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, vi que no has tenido chance de usar el sistema. Sin afán, cada quien a su ritmo.`,
      ``,
      `Pero te cuento que los 14 días gratis ya están corriendo. Si quieres, te hago una videollamada rápida de 5 minutos y te muestro todo.`,
      ``,
      `Cuándo te queda bien?`,
    ].join('\n'),
  },
  {
    id: 29,
    label: 'Onboarding: día 10 (pre-vencimiento)',
    category: 'onboarding',
    condition: '4 días antes de que acabe el trial.',
    generate: ({ nombre }) => [
      `${saludo(nombre)}, te quedan 4 días de prueba gratis.`,
      ``,
      `Cómo te ha parecido el sistema? Te ha servido?`,
      ``,
      `Si quieres seguir usándolo después del día 14, el plan básico son $39.000/mes y te incluye todo lo que ya estás usando.`,
      ``,
      `Me dices si tienes alguna pregunta.`,
    ].join('\n'),
  },
]

// Genera link de WhatsApp con mensaje pre-cargado
export function whatsappLink(telefono, mensaje) {
  if (!telefono) return null
  const num = telefono.replace(/\D/g, '')
  return `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`
}
