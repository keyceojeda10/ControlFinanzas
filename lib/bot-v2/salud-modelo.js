// lib/bot-v2/salud-modelo.js
//
// ══ EL BOT ESTUVO TRES DÍAS CON EL MODELO DE RESPALDO Y NADIE SE ENTERÓ ════
//
// Los días 14, 15 y 16 de agosto de 2026 el log de producción acumuló **147
// veces** el mismo error: «Your credit balance is too low». La cuenta de
// Anthropic se quedó sin saldo.
//
// No costó un solo cliente —el respaldo de DeepSeek absorbió las tres días
// enteros, cero leads se quedaron sin respuesta y los registros no bajaron: 10,
// 7 y 8 organizaciones nuevas contra 8-12 los días de alrededor— pero eso fue
// suerte del diseño, no vigilancia. Si la próxima vez cae también el respaldo,
// el bot se queda mudo y nos enteramos por un cliente.
//
// ⚠ LA SEÑAL SALE DE LA BASE, NO DE UN CONTADOR EN MEMORIA. `registrarGasto`
// ya anota el proveedor de CADA llamada, así que la propia tabla dice quién
// está atendiendo. Un contador en el proceso no sobrevive a un reinicio y se
// duplicaría con las dos instancias de PM2; la tabla no tiene ninguno de los
// dos problemas. Así se ve el incidente, sin ambigüedad:
//
//     13 ago   anthropic 89                        ← normal
//     14 ago   anthropic 55 · deepseek 48          ← empieza a caer
//     15 ago   anthropic  0 · deepseek 74          ← caído entero
//     16 ago   anthropic 34 · deepseek 25          ← vuelve
//     17 ago   anthropic 82                        ← normal
//
// Un día sano es 100 % del principal. El respaldo suelto (1 llamada en un día)
// es ruido normal y NO tiene que despertar a nadie.

const PRINCIPAL = 'anthropic'

/* Cuánto respaldo hay que ver para creerse que el principal está caído. Con
   menos, es una llamada que reventó y reintentó: pasa y no significa nada. */
const MINIMO_PARA_CREERSELO = 3

/**
 * ¿Cómo está el modelo del bot en la última hora?
 *
 * @returns {Promise<{estado:'sano'|'respaldo'|'mudo'|'quieto', principal:number,
 *                    respaldo:number, mensajesDeLeads:number}>}
 *
 *   sano    — el principal está atendiendo.
 *   respaldo— el principal no atiende y el de reserva está cargando con todo.
 *   mudo    — llegaron mensajes de leads y NO hubo ni una llamada a ningún
 *             modelo. Es el caso grave: el bot no está contestando.
 *   quieto  — no pasó nada en la hora. No es noticia.
 */
export async function saludDelModelo(prisma, { minutos = 60, ahora = Date.now() } = {}) {
  const desde = new Date(ahora - minutos * 60_000)

  const [porProveedor, mensajesDeLeads] = await Promise.all([
    prisma.botGastoApi.groupBy({
      by: ['proveedor'],
      where: { createdAt: { gte: desde } },
      _count: { _all: true },
    }),
    prisma.botConversacion.count({ where: { rol: 'lead', createdAt: { gte: desde } } }),
  ])

  const cuenta = (p) => porProveedor.find((x) => x.proveedor === p)?._count?._all ?? 0
  const principal = cuenta(PRINCIPAL)
  const respaldo = porProveedor
    .filter((x) => x.proveedor !== PRINCIPAL)
    .reduce((a, x) => a + (x._count?._all ?? 0), 0)

  /* ⚠ EL ORDEN DE LAS PREGUNTAS IMPORTA. «Mudo» se comprueba antes que
     «quieto»: si llegaron mensajes y no hubo NI UNA llamada, da igual que la
     hora fuera floja — eso es que no está contestando. */
  if (principal === 0 && respaldo === 0) {
    return mensajesDeLeads >= MINIMO_PARA_CREERSELO
      ? { estado: 'mudo', principal, respaldo, mensajesDeLeads }
      : { estado: 'quieto', principal, respaldo, mensajesDeLeads }
  }

  if (principal === 0 && respaldo >= MINIMO_PARA_CREERSELO) {
    return { estado: 'respaldo', principal, respaldo, mensajesDeLeads }
  }

  return { estado: 'sano', principal, respaldo, mensajesDeLeads }
}

/** El aviso, en las palabras de quien lo va a leer a las tres de la mañana. */
export function avisoDelModelo(salud) {
  if (salud.estado === 'mudo') {
    return '🔴 <b>El bot no está contestando</b>\n\n' +
      `Llegaron ${salud.mensajesDeLeads} mensajes de leads en la última hora y ` +
      'no hubo ni una llamada a ningún modelo. Los dos proveedores están caídos ' +
      'o el bot está atascado.\n\n' +
      'Mirar <code>pm2 logs cf --err</code> y el saldo de Anthropic y DeepSeek.'
  }
  return '🟡 <b>El bot está con el modelo de respaldo</b>\n\n' +
    `En la última hora: 0 llamadas al principal y ${salud.respaldo} al de reserva. ` +
    'Sigue contestando, así que no se pierde ningún lead, pero con peor calidad.\n\n' +
    'Lo más probable es que se haya acabado el saldo de Anthropic — ' +
    'pasó los días 14, 15 y 16 de agosto y duró tres días sin que nadie lo viera.'
}

export const RECUPERADO = '✅ <b>El bot volvió a su modelo principal</b>'
