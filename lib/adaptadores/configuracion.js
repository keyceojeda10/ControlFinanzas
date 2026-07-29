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
