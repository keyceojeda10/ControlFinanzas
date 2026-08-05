import { PLANTILLAS as MOTOR, generarTextoPlantilla } from '@/lib/whatsapp-plantillas'

/**
 * El puente entre el MOTOR de plantillas y la hoja de T11-01.
 *
 * ══ POR QUÉ EXISTE ═══════════════════════════════════════════════════════════
 *
 * El rediseño montó una hoja nueva y bonita… con plantillas nuevas escritas de
 * cero, de una línea:
 *
 *   nueva → «Hola X, hoy vence tu cuota de $366.667. Puedes pagar en efectivo
 *            o por transferencia. — Negocio»
 *   vieja → saludo + línea de pago CON FECHA + resumen con saldo, cuotas
 *           pendientes y próximo pago + cierre + firma
 *
 * Y el motor viejo, con sus 14 plantillas, sus secciones que se encienden y
 * apagan, sus campos extra y su configuración por organización, quedó escondido
 * detrás de un enlace de 12px que pone «Editar las plantillas».
 *
 * Reportado por el dueño con las palabras de sus clientes: «el modal nuevo está
 * prácticamente inservible, son mensajes bastante vacíos, sin ninguna
 * información; las plantillas buenas están en el modal viejo y escondidas».
 *
 * Es el patrón que ya está documentado en este proyecto: EL REDISEÑO PIERDE
 * FUNCIONES EN SILENCIO. La pantalla nueva se ve mejor y hace menos, y nadie lo
 * nota hasta que un cliente lo dice.
 *
 * Así que la hoja se queda —leer el mensaje antes de mandarlo es lo que aporta—
 * pero el CONTENIDO sale del motor de siempre. Nada que mantener por duplicado:
 * si el dueño edita una sección, cambia aquí también.
 */

/* Las cuatro familias de la hoja, con las plantillas del motor que les tocan.
   El motor no tiene familias: se ordenaba por `aplica()` en una lista larga. */
const FAMILIAS_MOTOR = [
  {
    id: 'cobro',
    etiqueta: 'Cobro',
    ids: ['recordatorio', 'historial', 'visita', 'comprobante'],
  },
  {
    id: 'atraso',
    etiqueta: 'Atraso',
    ids: ['mora_suave', 'mora_firme', 'mora_critica'],
  },
  {
    // ⚠ `credito_aprobado` VIVE AQUI, no en «Pago».
    //
    // Estaba en «Pago» —la familia de acusar recibo— y no es eso: es el aviso
    // de que se le APROBO un credito, con su monto, su cuota y su plazo. Un
    // cliente al que le acaban de prestar no espera un mensaje de la seccion
    // de pagos.
    //
    // Ademas lo dejaba escondido: al crear un prestamo la hoja abria en
    // «Cobro» y habia que ir a buscarlo dos pestañas mas alla.
    id: 'renovar',
    etiqueta: 'Renovar',
    ids: ['credito_aprobado', 'oferta_credito', 'renovacion', 'felicitacion'],
  },
  {
    id: 'pago',
    etiqueta: 'Pago',
    ids: ['pago_confirmacion', 'gracias_corto'],
  },
]

/** El contexto que espera el motor, armado desde lo que tiene la pantalla. */
export function contextoMotor({ cliente, prestamo, orgNombre, ocultarSaldo, pago, camposRecibo }) {
  return { cliente, prestamo, orgNombre, ocultarSaldo, pago, camposRecibo }
}

/**
 * Las plantillas de una familia, ya generadas y listas para pintar.
 *
 * Devuelve la misma forma que `preparaPlantilla`: la hoja no sabe —ni tiene por
 * qué— de dónde salió el texto.
 *
 * `trozos` va con un solo trozo `dato: false`: el motor devuelve texto ya
 * armado y no deja saber qué parte la puso el sistema. Resaltar a ojo —buscando
 * el nombre o la cifra dentro del texto— marcaría de más y de menos: el nombre
 * del negocio puede llevar el del dueño, y una cifra puede repetirse.
 * Mejor sin resaltado que con uno que miente.
 */
export function plantillasDeFamilia(familiaId, ctx, orgId) {
  const familia = FAMILIAS_MOTOR.find((f) => f.id === familiaId)
  if (!familia) return []

  const lista = familia.ids
    .map((id) => {
      const tmpl = MOTOR.find((t) => t.id === id)
      if (!tmpl) return null

      // `aplica()` decide si la plantilla tiene sentido para ESTE préstamo: no
      // se le ofrece «aviso de mora» a quien está al día ni «gracias por tu
      // pago» a quien no ha pagado. Sin este filtro, la familia «Atraso» de un
      // cliente al día enseñaría tres mensajes que no pegan.
      if (typeof tmpl.aplica === 'function') {
        try { if (!tmpl.aplica(ctx)) return null } catch { return null }
      }

      const texto = generarTextoPlantilla(id, ctx, orgId)
      // Una plantilla que sale vacía no se pinta: es una tarjeta que al pulsarla
      // abre WhatsApp sin nada escrito.
      if (!texto || !texto.trim()) return null

      return {
        id,
        titulo: tmpl.label,
        resumen: tmpl.desc,
        texto,
        trozos: [{ texto, dato: false }],
        faltan: [],
      }
    })
    .filter(Boolean)

  return lista
}

/**
 * Las familias que de verdad tienen algo que ofrecer.
 *
 * Una pestaña que al abrirse no enseña ninguna plantilla es peor que una
 * pestaña que no está: el cobrador la pulsa, ve el vacío y no sabe si es un
 * fallo o si no hay nada.
 */
export function familiasConPlantillas(ctx, orgId) {
  return FAMILIAS_MOTOR
    .filter((f) => plantillasDeFamilia(f.id, ctx, orgId).length > 0)
    .map((f) => ({ id: f.id, etiqueta: f.etiqueta }))
}

/** «Escribir un mensaje libre», que la hoja pinta aparte y siempre. */
export const PLANTILLA_LIBRE = {
  id: 'libre',
  titulo: 'Escribir un mensaje libre',
  resumen: 'Se abre WhatsApp vacío con el número del cliente.',
  libre: true,
  trozos: [],
  texto: '',
  faltan: [],
}

/**
 * En que familia vive una plantilla.
 *
 * La hoja la usa para ABRIRSE YA en el sitio correcto cuando le piden una
 * plantilla concreta —«credito aprobado» al crear un prestamo, la confirmacion
 * al registrar un pago—, en vez de abrir en «Cobro» y obligar a buscarla.
 *
 * Antes ese caso encendia el MODAL VIEJO, que es el que el dueño quiere
 * retirar: «el modal anterior no deberia de existir ya».
 *
 * Devuelve `null` si la plantilla no esta en ninguna familia (el mensaje
 * libre, por ejemplo): quien llame decide que hacer con eso.
 */
export function familiaDe(plantillaId) {
  if (!plantillaId) return null
  return FAMILIAS_MOTOR.find((f) => f.ids.includes(plantillaId))?.id ?? null
}
