// lib/adaptadores/configuracion.js — las secciones de Configuración.
//
// LA DECISIÓN DEL DISEÑO, en su nota: «Ocho secciones nombradas COMO EL DUEÑO
// PIENSA —"cómo prestas", "avisos por WhatsApp", "tus datos"— en vez de por
// módulo técnico. El modo de trabajo es explícito: esta cuenta tiene equipo, así
// que Rutas y Equipo se ven; en las 19 de cada 20 cuentas que cobran solas,
// AMBOS DESAPARECEN DEL MENÚ.»
//
// Hoy las pestañas se llaman «Organización», «Suscripción», «Referidos»,
// «Notificaciones», «Apariencia». Ninguna es una palabra que un prestamista use
// para hablar de su negocio: son los nombres de las tablas. «Suscripción» es lo
// que la app le cobra a él; «Plan y pagos» es lo que él quiere mirar.
//
// Y el ocultar no es cosmético. Es la misma regla que ya aplica «Más»: catorce
// filas de las que cuatro no aplican es peor que diez que sí.

/**
 * @param {object} ctx
 *  - rol            'owner' | 'cobrador' | 'superadmin'
 *  - hayEquipo      la cuenta tiene más de un usuario
 *  - hayRutas       la cuenta usa rutas
 *
 * `orden` importa: primero lo que el dueño toca seguido —cómo presta—, y al
 * final lo que se mira una vez —sus datos, la seguridad—.
 */
export function seccionesConfig({ rol = 'owner', cobradores = 0 } = {}) {
  const esOwner = rol === 'owner' || rol === 'superadmin'
  const hayEquipo = cobradores > 0

  // El ORDEN es el del diseño, y no es alfabético ni por importancia técnica:
  // va de lo que define el negocio a lo que se toca una vez.
  return [
    { id: 'negocio',     nombre: 'Tu negocio',          visible: esOwner },
    { id: 'comoPrestas', nombre: 'Cómo prestas',        visible: esOwner },
    { id: 'plan',        nombre: 'Plan y pagos',        visible: esOwner },
    // Equipo lleva SU CIFRA al lado, como en el diseño. Un «Equipo» pelado no
    // dice si hay uno o nueve.
    { id: 'equipo',      nombre: 'Equipo', cifra: cobradores, visible: esOwner && hayEquipo },
    { id: 'portal',      nombre: 'Portal del cliente',  visible: esOwner },
    { id: 'whatsapp',    nombre: 'Avisos por WhatsApp', visible: esOwner },
    { id: 'seguridad',   nombre: 'Seguridad',           visible: true },
    { id: 'datos',       nombre: 'Tus datos',           visible: true },
  ].filter((s) => s.visible)
}

/**
 * El bloque «Modo de trabajo», abajo a la izquierda. No es decoración: es lo que
 * explica POR QUÉ el menú tiene las secciones que tiene.
 *
 * «En el 95% de las organizaciones el dueño cobra él mismo. La app se comporta
 * como UNA PERSONA por defecto y todo lo de equipo aparece solo cuando existe un
 * segundo usuario.» Sin esta caja, alguien que contrata a su primer cobrador ve
 * aparecer secciones nuevas de la nada y no sabe qué tocó.
 */
export function modoDeTrabajo(cobradores = 0) {
  const n = Number(cobradores) || 0
  if (n === 0) {
    return {
      titulo: 'Cobras tú solo',
      nota: 'Cuando crees el primer cobrador aparecerán Rutas y Equipo.',
    }
  }
  return {
    titulo: `Con equipo · ${n} cobrador${n === 1 ? '' : 'es'}`,
    nota: 'Rutas y Equipo están visibles porque hay cobradores. Si no hubiera ninguno, ambos se ocultan y la app se comporta como una sola persona.',
  }
}

/** Los ids visibles, que es lo que necesita el menú. */
export function idsVisibles(ctx) {
  return seccionesConfig(ctx).map((s) => s.id)
}

/* ══ El índice de móvil (T10-01) ═══════════════════════════════════════════
   CADA FILA LLEVA SU VALOR ACTUAL, y ese es todo el punto: «¿en qué tasa quedé?»
   se responde SIN ENTRAR. Un índice de ocho nombres pelados obliga a abrir ocho
   pantallas para saber cómo está configurado el negocio.

   Y la regla que lo hace fiable: UN VALOR QUE NO SE SABE NO SE INVENTA. Si el
   dato no ha llegado, la fila va sin valor. Enseñar «Diario · 20%» por defecto
   cuando el dueño configuró otra cosa es peor que no enseñar nada — se toman
   decisiones mirando esa línea. */

const FRECUENCIAS = {
  diario: 'Diario', semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual',
}

/** El valor de cada fila del índice, a partir de lo que el API devuelve. */
export function valoresIndice({ org, uso, pais, cobradores = 0, diasParaRenovar } = {}) {
  const valores = {}

  // Tu negocio: país y moneda. Es lo que define cómo se lee TODA cifra.
  if (pais?.nombre) {
    valores.negocio = pais.moneda ? `${pais.nombre} · ${pais.moneda}` : pais.nombre
  }

  // Cómo prestas: frecuencia y tasa, que es la pregunta que más se repite.
  const frec = FRECUENCIAS[org?.frecuenciaDefault] ?? null
  const tasa = org?.tasaDefault != null ? `${formateaTasa(org.tasaDefault)}%` : null
  // «Sin definir» NO es inventarse un valor: es el estado real, y además es el
  // único accionable de la lista. Sin él, la fila parece configurada y el dueño
  // descubre que no lo estaba al crear el préstamo, escribiendo la tasa a mano
  // por enésima vez. Solo se le dice al dueño: un cobrador no puede arreglarlo.
  valores.comoPrestas = (frec || tasa)
    ? [frec, tasa].filter(Boolean).join(' · ')
    : (org ? 'sin definir' : null)

  // Plan y pagos: cuándo se renueva. El nombre del plan ya está arriba, en la
  // cabecera del negocio; repetirlo aquí no añade nada.
  if (Number.isFinite(diasParaRenovar)) {
    valores.plan = diasParaRenovar < 0 ? 'vencido'
      : diasParaRenovar === 0 ? 'renueva hoy'
      : `renueva en ${diasParaRenovar} día${diasParaRenovar === 1 ? '' : 's'}`
  }

  // Equipo: cuántos son. Un «Equipo» pelado no dice si hay uno o nueve.
  const n = Number(cobradores) || 0
  if (n > 0) valores.equipo = `${n} cobrador${n === 1 ? '' : 'es'}`

  // Clientes del plan: va en la nota de la cabecera, no en una fila.
  if (uso?.clientes?.usado != null && uso?.clientes?.limite != null) {
    valores.clientesNota = `${uso.clientes.usado} de ${uso.clientes.limite} clientes`
  }

  return valores
}

/** La tasa sin decimales inútiles: 20 y no 20.0, pero 20,5 se conserva. */
function formateaTasa(t) {
  const n = Number(t)
  if (!Number.isFinite(n)) return ''
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

/** Las filas del índice, ya con su valor. Lo que se le pasa a
 *  `IndiceConfiguracion` sin que la pantalla tenga que saber de dónde sale. */
export function filasIndice(ctx = {}, valores = {}) {
  return seccionesConfig(ctx).map((s) => ({
    id: s.id,
    nombre: s.nombre,
    // `alerta` gana sobre `valor`: un problema real tapa al dato de estado.
    alerta: valores[`${s.id}Alerta`] ?? null,
    valor: valores[s.id] ?? null,
  }))
}
