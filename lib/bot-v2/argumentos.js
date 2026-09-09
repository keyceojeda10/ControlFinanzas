// lib/bot-v2/argumentos.js — CON QUÉ SE VENDE. (BOT v3 · el vendedor)
//
// ══ POR QUÉ EXISTE ══════════════════════════════════════════════════════════
//
// El dueño, el 8 sep 2026, viendo el bot contestar:
//
//   «El bot en general no parece un bot de ventas… contesta preguntas, no
//    incita, no tiene ese picante para la venta, no deja deseando. Es malísimo
//    vendiendo. Hay que meterle un agente de ventas dentro, que saque todo lo
//    bueno que tenemos y lo exponga, desde la primera frase.»
//
// Tenía razón, y la causa no era el modelo: **el bot no tenía con qué vender**.
// Su conocimiento del producto eran veinticuatro funciones descritas por lo que
// SON —«rutas de cobro por zona, cada una con su capital independiente»—, que
// es una ficha técnica. Ni un dolor, ni un coste, ni una prueba, ni una
// objeción respondida. Un vendedor sin argumentos solo puede recitar catálogo.
//
// ══ DE DÓNDE SALE CADA COSA ═════════════════════════════════════════════════
//
// Nada de esto está inventado. Sale de tres sitios que ya existían:
//
//  1. `~/Documents/BotAdsManager/guia_ventas_whatsapp_control_finanzas.txt`
//     (marzo 2026): la secuencia de venta escrita para WhatsApp, con las
//     respuestas por segmento y las objeciones. El bot no la conocía.
//  2. El test A/B de julio (194 leads): el hook de **dolor directo** convirtió
//     **9,4 veces más** que la pregunta abierta. Genera MENOS respuestas (38 %
//     contra 57 %) y más ventas: filtrar es bueno.
//  3. La base de producción, para las cifras. ⚠ La guía decía «más de 500
//     prestamistas» y el 8 sep eran 301: una cifra falsa mata la venta el día
//     que el lead la comprueba.
//
// ══ LA FORMA DE UN ARGUMENTO ════════════════════════════════════════════════
//
// dolor → lo que cuesta seguir igual → la prueba → el siguiente paso.
// Esa es la diferencia entre «tenemos rutas» y «¿sabe cuánto le entregó de
// menos el cobrador el mes pasado? Con esto lo ve al segundo».

import { EMPRESA } from './kb.js'

/* ⚠ VERIFICADO EN PRODUCCIÓN EL 8 SEP 2026. Volver a contarlo antes de subirlo:
   una cifra vieja es una cifra falsa. Se saca con:
     SELECT COUNT(DISTINCT o.id) FROM Organization o
       JOIN Prestamo p ON p.organizationId=o.id WHERE o.activo=1;   → negocios
     SELECT COUNT(*) FROM Cliente;                                  → clientes */
export const PRUEBA_SOCIAL = {
  negocios: 301,
  clientes: 8141,
  paises: 4,
  verificado: '2026-09-08',
  frase: 'Ya hay más de 300 prestamistas llevando su cartera aquí, con más de 8.000 clientes entre todos.',
}

/* Cómo cobra el lead. Lo dice él en el primer o segundo turno, y cambia TODO
   el argumento: al que cobra solo le duele el tiempo; al que tiene cobradores
   le duele no poder verificar. Mezclarlos es el error clásico. */
export const SEGMENTOS = {
  solo: /\b(?:yo (?:solo|mismo|cobro)|cobro yo|solo yo|yo me encargo|sin cobradores?|nadie m[aá]s|yo (?:lo )?manejo)\b/i,
  cobradores: /\b(?:cobradores?|muchachos?|empleados?|trabajadores?|tengo gente|mi gente|un chico|una persona que cobra)\b/i,
  diario: /\b(?:diario|gota a gota|gota|pagadiario|paga diario|todos los d[ií]as)\b/i,
  plazos: /\b(?:quincenal|mensual|quincena|a un mes|tres meses|largo plazo)\b/i,
  mercancia: /\b(?:mercanc[ií]a|art[ií]culos?|electrodom[eé]sticos?|muebles?|vendo a cr[eé]dito|motos?|ropa)\b/i,
}

/**
 * Cada argumento: a quién le habla, qué le duele, qué le cuesta seguir igual,
 * qué hace el sistema y qué le pedimos después.
 *
 * `prueba` solo puede nombrar cosas que el sistema hace de verdad: son las
 * mismas funciones de `kb.js`, contadas desde el lado del prestamista.
 */
export const ARGUMENTOS = [
  {
    id: 'saldo_calle', para: ['solo', 'cualquiera'],
    dolor: '¿Sabe exactamente cuánto le deben hoy, o le toca sumar a mano?',
    coste: 'La mayoría dice «más o menos tengo tanto en la calle», pero nunca el número exacto. Ahí es donde se pierde plata sin darse cuenta.',
    prueba: 'Aquí lo ve en dos segundos: cuánto tiene en la calle, quién le pagó hoy y quién está en mora.',
    siguiente: '¿Cuánto calcula que tiene prestado ahora mismo?',
  },
  {
    id: 'verificar_cobrador', para: ['cobradores'],
    dolor: '¿Y usted cómo sabe que el cobrador cobró todo lo que dice que cobró?',
    coste: 'Confiar sin poder verificar es lo que más plata cuesta en este negocio, y no se nota hasta que se nota.',
    prueba: 'Cada cobrador registra desde su celular y a usted le llega al momento: cuánto recogió, a quién le cobró y quién le queda pendiente.',
    siguiente: '¿Cuántos cobradores tiene en la calle?',
  },
  {
    id: 'ya_pague', para: ['cualquiera', 'diario'],
    dolor: '¿Alguna vez un cliente le ha dicho «yo ya le pagué eso» y usted no tenía cómo demostrarle lo contrario?',
    coste: 'Esa discusión se pierde siempre, y encima le cuesta el cliente.',
    prueba: 'Cada pago queda con su recibo, y usted se lo manda por WhatsApp en el momento. Se acabó la discusión.',
    siguiente: '¿Le ha pasado?',
  },
  {
    id: 'sumar_a_mano', para: ['solo', 'diario'],
    dolor: '¿Cuánto tiempo se le va cada noche cuadrando lo del día?',
    coste: 'Una hora al día son treinta horas al mes sumando, y basta un número mal para que el cuadre no dé.',
    prueba: 'El sistema calcula las cuotas, los intereses y la mora solo. Usted marca quién pagó y ya.',
    siguiente: '¿Hoy cómo lleva las cuentas, en cuaderno o en Excel?',
  },
  {
    id: 'mora_a_tiempo', para: ['cualquiera'],
    dolor: '¿Cómo se entera de que un cliente dejó de pagar? ¿Cuando ya lleva un mes?',
    coste: 'Cuanto más tarde se entera, menos se recupera. Al que se le va la mano con un cliente ya no le cobra.',
    prueba: 'Le marca en rojo al que no paga el mismo día, y le dice cuánto lleva atrasado.',
    siguiente: '¿Cuántos tiene atrasados ahora mismo?',
  },
  {
    id: 'del_cuaderno', para: ['cualquiera'],
    dolor: 'Pasar el cuaderno da pereza, y por eso mucha gente lo deja para después.',
    coste: 'Y mientras tanto sigue sumando a mano todas las noches.',
    prueba: 'Le toma foto a las cartulinas y el sistema las lee: hasta treinta de una vez. O sube su Excel si ya lo tiene.',
    siguiente: '¿Cuántos clientes tendría que pasar?',
  },
  {
    id: 'mercancia', para: ['mercancia'],
    dolor: 'Si usted entrega mercancía a cuotas, el control es el mismo lío que con la plata, pero peor.',
    coste: 'Porque además hay que acordarse de cuánto ganó en cada artículo.',
    prueba: 'Registra el artículo con su precio y su ganancia, y el sistema le lleva las cuotas igual que un préstamo.',
    siguiente: '¿Qué es lo que entrega, electrodomésticos o de todo un poco?',
  },
  {
    id: 'donde_sea', para: ['cualquiera'],
    dolor: 'La cartera en el cuaderno se queda en el cuaderno: si no lo tiene encima, no sabe nada.',
    coste: 'Y si se moja, se pierde o se lo deja en la casa, se quedó sin negocio ese día.',
    prueba: 'Lo abre desde su celular, su computador o su tablet, y ve lo mismo en todos. Y sigue funcionando sin señal.',
    siguiente: '¿Usted cobra en la calle o desde un local?',
  },
]

/**
 * Respuestas a lo que de verdad dicen. La estructura es siempre la misma:
 * reconocer, dar la vuelta con un hecho, y devolver la pelota.
 */
export const OBJECIONES = [
  {
    id: 'caro', rx: /\bcar[oa]s?\b|\bcostos[oa]\b|no tengo (?:para|plata)|est[aá] muy alto|mucha plata/i,
    responder: `Le hago una cuenta: ¿cuántos cobros se le olvida anotar al mes? Con uno o dos de $15.000 ya pagó el sistema. La mayoría pierde más que eso sin enterarse. Y los ${EMPRESA.diasPrueba} días son gratis, sin tarjeta: si no le sirve, no paga nada.`,
  },
  {
    /* ⚠ AMPLIADA EL 9 SEP, viendo una conversación real que se perdió así.
       Un lead con 140 clientes fue diciendo, uno por uno, que su app YA hacía
       todo lo que el bot le ofrecía: «todo en tiempo real», «el sistema hace un
       cuadre», «la app que manejo tiene esa función». El bot no lo detectó ni
       una vez y le siguió vendiendo las mismas funciones, contestando «exacto»
       a todo. El lead no está preguntando: está comparando. */
    id: 'ya_tengo', rx: /\bya tengo\b|\buso (?:excel|otra|una app)\b|\btengo (?:excel|una app|otro sistema)\b|\bmi cuaderno me sirve\b|\b(?:la|mi|el) (?:app|aplicaci[oó]n|sistema|programa|plataforma) (?:que|q) (?:manejo|uso|tengo)\b|\bmi (?:app|aplicaci[oó]n|sistema|programa)\b|\bya (?:uso|manejo|trabajo con)\b|\b(?:la|el) (?:que|q) (?:uso|manejo|tengo)\b/i,
    responder: 'Bien, entonces ya sabe lo que vale tener control. Dígame una cosa: ¿qué es lo que hoy NO le resuelve? Porque si lo suyo le funciona, no le voy a pedir que lo cambie por cambiarlo.',
  },
  {
    id: 'pensarlo', rx: /\bpensarlo\b|\blo pienso\b|\bd[eé]jame ver\b|\bdespu[eé]s (?:le|te) (?:digo|aviso)\b|\bm[aá]s adelante\b/i,
    responder: `Claro, sin afán. Solo tenga en cuenta que la prueba son ${EMPRESA.diasPrueba} días y no pide tarjeta: no arriesga nada por verlo. Y si no le convence, lo borra y ya.`,
  },
  {
    id: 'seguro', rx: /\bseguro\b|\bconfiable\b|\bmis datos\b|\bhackea|\bse pierde la informaci[oó]n\b|\bestafa\b/i,
    responder: 'Sus datos son suyos y de nadie más, en servidores con cifrado. Y si algún día quiere borrar la cuenta y todo lo que tiene dentro, lo hace usted mismo desde el sistema.',
  },
  {
    id: 'es_app', rx: /\bplay store\b|\bapp store\b|\bdescargar?\b|\bes una app\b|\bocupa espacio\b/i,
    responder: 'Se abre desde el navegador, así que no ocupa espacio y entra desde cualquier celular, computador o tablet. Y si quiere, la deja como icono en su teléfono y le queda igual que una app.',
  },
  {
    id: 'no_tengo_tiempo', rx: /\bno tengo tiempo\b|\bestoy ocupad|\bahora no puedo\b|\bmás tarde\b/i,
    responder: 'Por eso mismo: lo que le quita tiempo es sumar a mano todas las noches. Pasar sus clientes toma unos minutos, y con la foto de las cartulinas menos.',
  },
  {
    id: 'no_entiendo_tecnologia', rx: /\bno s[eé] (?:de|usar)\b|\bcomplicad|\bdif[ií]cil\b|\bno soy bueno con\b|\bme da miedo\b|\bno me imagino\b/i,
    responder: `Está hecho para usarse con una mano en la calle: se marca quién pagó y ya. Y si quiere verlo antes, hay videos cortos: ${EMPRESA.linkTutoriales}`,
  },
]

/** El segmento del lead, si lo ha dicho. */
export function segmentoDe(texto = '', historial = []) {
  const todo = [texto, ...(historial || []).filter((m) => m?.rol === 'lead').map((m) => m.texto || '')].join(' ')
  for (const [id, rx] of Object.entries(SEGMENTOS)) if (rx.test(todo)) return id
  return null
}

/** La objeción que acaba de poner, si puso alguna. */
export function objecionDe(texto = '') {
  return OBJECIONES.find((o) => o.rx.test(String(texto || ''))) || null
}

/**
 * Los argumentos que le sirven a ESTE lead y que todavía no se han usado.
 * Sin esto el bot repite el mismo tres veces, que es el fallo que ya medimos.
 */
export function argumentosPara({ segmento = null, usados = [] } = {}) {
  const vale = (a) => a.para.includes(segmento) || a.para.includes('cualquiera')
  return ARGUMENTOS.filter((a) => vale(a) && !usados.includes(a.id))
}

/** El bloque que se le pone al modelo. Corto: son munición, no un guion. */
export function textoArgumentos(lista) {
  if (!lista?.length) return ''
  return ['ARGUMENTOS QUE PUEDE USAR (elija UNO, el que encaje con lo que acaba de decir):',
    ...lista.map((a) => `- ${a.dolor}\n  · lo que le cuesta: ${a.coste}\n  · lo que hacemos: ${a.prueba}\n  · y le pregunta: ${a.siguiente}`),
  ].join('\n')
}
