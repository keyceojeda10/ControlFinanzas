/* ── LAS PLANTILLAS DEL SEGUIMIENTO ──────────────────────────────────────────
 *
 * La única fuente de verdad: de aquí se suben a Meta
 * (`.auditoria/_subir-plantillas-seguimiento.mjs`) y de aquí lee el motor al
 * enviarlas (`variables` dice en qué orden van los {{n}}).
 *
 * ⚠ CÓMO SE ESCRIBEN PARA QUE PASEN COMO UTILITY (desde el 1 oct 2026 se
 *   cobra todo, también las respuestas del bot, y utility cuesta del orden de
 *   una décima parte que marketing):
 *   · hablan de SU cuenta con SUS datos: fechas, cantidades, montos;
 *   · nada de «aproveche», «no se lo pierda», «renueve hoy» ni descuentos;
 *   · el botón lleva a su cuenta, no a una oferta.
 *   La categoría la decide Meta por el CONTENIDO. Si reclasifica una a
 *   marketing se acepta y no se insiste: muchas reclasificaciones pueden pasar
 *   TODAS las utility de la cuenta a marketing. `oferta_nequi` es marketing a
 *   propósito: un descuento nunca es utility.
 *
 * ⚠ Meta no acepta una variable al PRINCIPIO ni al FINAL del texto («{{3}}.»
 *   cuenta como final): por eso «… por {{3}} en total.», «… hasta hoy.».
 *
 * Todas llevan la respuesta rápida «No quiero más mensajes» (salvo las que
 * confirman algo que la persona acaba de pedir): apaga el seguimiento de ese
 * negocio y es lo que Meta mira para la calidad del número.
 *
 * Ver docs/superpowers/specs/2026-10-12-seguimiento-activacion-retencion-design.md §3.
 */

const APP = 'https://app.control-finanzas.com'
export const NO_MAS_MENSAJES = 'No quiero más mensajes'

const salir = { type: 'QUICK_REPLY', text: NO_MAS_MENSAJES }
const url = (text, ruta) => ({ type: 'URL', text, url: `${APP}${ruta}` })

export const PLANTILLAS_SEGUIMIENTO = {
  cuenta_configurar: {
    categoria: 'UTILITY',
    texto: 'Hola {{1}}, para terminar de configurar su cuenta de Control Finanzas faltan sus clientes. Puede cargarlos usted desde la app, o enviarnos fotos del cuaderno o el Excel y se los dejamos cargados en 24 horas.',
    variables: ['nombre'],
    ejemplo: ['Carlos'],
    botones: [url('Cargar mis clientes', '/clientes'), { type: 'QUICK_REPLY', text: 'Que me ayuden' }, salir],
  },
  cobros_de_hoy: {
    categoria: 'UTILITY',
    texto: 'Hola {{1}}, recordatorio de su cuenta de Control Finanzas: hoy tiene {{2}} cobros programados por {{3}} en total.',
    variables: ['nombre', 'cobros', 'monto'],
    ejemplo: ['Carlos', '12', '$340.000'],
    botones: [url('Ver cobros de hoy', '/cobros-hoy'), salir],
  },
  prueba_extendida: {
    categoria: 'UTILITY',
    texto: 'Hola {{1}}, su prueba de Control Finanzas se extendió hasta el {{2}} porque registró cobros en 3 días distintos.',
    variables: ['nombre', 'fecha'],
    ejemplo: ['Carlos', '26 de octubre'],
    botones: [url('Entrar a mi cuenta', '/dashboard')],
  },
  prueba_por_vencer: {
    categoria: 'UTILITY',
    texto: 'Hola {{1}}, su prueba de Control Finanzas vence el {{2}}. En estos días registró {{3}} cobros por {{4}}. Sus datos quedan guardados.',
    variables: ['nombre', 'fecha', 'cobros', 'monto'],
    ejemplo: ['Carlos', '19 de octubre', '23', '$1.240.000'],
    botones: [url('Ver mi cuenta', '/configuracion/plan'), salir],
  },
  plan_por_vencer_v4: {
    categoria: 'UTILITY',
    texto: 'Hola {{1}}, su plan {{2}} de Control Finanzas vence el {{3}}. Su valor es de {{4}} al mes.',
    variables: ['nombre', 'plan', 'fecha', 'monto'],
    ejemplo: ['Carlos', 'Profesional', '15 de octubre', '$39.000'],
    botones: [url('Pagar mi plan', '/configuracion/plan'), salir],
  },
  plan_vencido_v3: {
    categoria: 'UTILITY',
    texto: 'Hola {{1}}, su plan de Control Finanzas venció el {{2}}. Su cuenta y sus {{3}} clientes siguen guardados.',
    variables: ['nombre', 'fecha', 'clientes'],
    ejemplo: ['Carlos', '9 de octubre', '145'],
    botones: [url('Pagar mi plan', '/configuracion/plan'), salir],
  },
  motivo_no_renovo: {
    categoria: 'UTILITY',
    texto: 'Hola {{1}}, su plan de Control Finanzas venció el {{2}} y no se renovó. ¿Nos dice el motivo? Toque una opción.',
    variables: ['nombre', 'fecha'],
    ejemplo: ['Carlos', '9 de octubre'],
    botones: [
      { type: 'QUICK_REPLY', text: 'El precio' },
      { type: 'QUICK_REPLY', text: 'No alcancé a usarla' },
      { type: 'QUICK_REPLY', text: 'Me falta algo' },
      { type: 'QUICK_REPLY', text: 'Cambié de sistema' },
      { type: 'QUICK_REPLY', text: 'Cerré el negocio' },
      { type: 'QUICK_REPLY', text: 'Otro motivo' },
      salir,
    ],
  },
  cuenta_inactiva: {
    categoria: 'UTILITY',
    texto: 'Hola {{1}}, su cuenta de Control Finanzas tiene {{2}} cobros sin registrar desde el {{3}} hasta hoy.',
    variables: ['nombre', 'cobros', 'fecha'],
    ejemplo: ['Carlos', '37', '5 de octubre'],
    botones: [url('Ver mis cobros', '/cobros-hoy'), salir],
  },
  datos_guardados: {
    categoria: 'UTILITY',
    texto: 'Hola {{1}}, su cuenta de Control Finanzas está inactiva desde el {{2}}. Sus {{3}} clientes y su historial siguen guardados para cuando quiera volver.',
    variables: ['nombre', 'fecha', 'clientes'],
    ejemplo: ['Carlos', '9 de octubre', '145'],
    botones: [url('Entrar a mi cuenta', '/login'), salir],
  },
  cartera_recibida: {
    categoria: 'UTILITY',
    texto: 'Hola {{1}}, recibimos sus {{2}} archivos para cargar su cartera en Control Finanzas. La tendrá lista en máximo 24 horas.',
    variables: ['nombre', 'archivos'],
    ejemplo: ['Carlos', '6'],
    botones: [],
  },
  cartera_cargada: {
    categoria: 'UTILITY',
    texto: 'Hola {{1}}, su cartera quedó cargada en Control Finanzas: {{2}} clientes y {{3}} en la calle. Su prueba de 7 días empieza hoy.',
    variables: ['nombre', 'clientes', 'monto'],
    ejemplo: ['Carlos', '148', '$23.400.000'],
    botones: [url('Entrar a mi cuenta', '/dashboard')],
  },
  oferta_nequi: {
    categoria: 'MARKETING',
    texto: 'Hola {{1}}, si deja su Nequi guardado para el pago automático, su próximo mes de Control Finanzas le sale con 35 % de descuento. El cobro se hace solo cada mes y lo puede quitar cuando quiera.',
    variables: ['nombre'],
    ejemplo: ['Carlos'],
    botones: [url('Guardar mi Nequi', '/configuracion/plan'), salir],
  },
}

/** El cuerpo que pide la API de Meta para crear la plantilla. */
export function definicionParaMeta(nombre) {
  const p = PLANTILLAS_SEGUIMIENTO[nombre]
  if (!p) throw new Error(`plantilla desconocida: ${nombre}`)
  const components = [{ type: 'BODY', text: p.texto, example: { body_text: [p.ejemplo] } }]
  if (p.botones.length) components.push({ type: 'BUTTONS', buttons: p.botones })
  return { name: nombre, language: 'es', category: p.categoria, components }
}

/** Los parámetros posicionales para enviarla, en el orden de `variables`. */
export function parametrosDe(nombre, datos = {}) {
  const p = PLANTILLAS_SEGUIMIENTO[nombre]
  if (!p) throw new Error(`plantilla desconocida: ${nombre}`)
  return p.variables.map((v) => {
    const valor = datos[v]
    if (valor == null || String(valor).trim() === '') throw new Error(`falta «${v}» para ${nombre}`)
    return String(valor)
  })
}
