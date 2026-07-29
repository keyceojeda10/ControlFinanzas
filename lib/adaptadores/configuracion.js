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
export function seccionesConfig({ rol = 'owner', hayEquipo = false, hayRutas = false } = {}) {
  const esOwner = rol === 'owner' || rol === 'superadmin'

  return [
    // Lo que cambia el trabajo de todos los días va primero.
    { id: 'comoPrestas', nombre: 'Cómo prestas', nota: 'Lo que se rellena solo al crear un préstamo', visible: esOwner },
    { id: 'negocio',     nombre: 'Tu negocio',   nota: 'Nombre, moneda, país',                        visible: esOwner },
    { id: 'whatsapp',    nombre: 'Avisos por WhatsApp', nota: 'Qué se le manda al cliente y cuándo',  visible: esOwner },

    // Solo si aplican. En 19 de cada 20 cuentas, estas dos no existen.
    { id: 'rutas',  nombre: 'Rutas',  nota: 'Cómo se reparte la cobranza', visible: esOwner && hayRutas },
    { id: 'equipo', nombre: 'Equipo', nota: 'Quién entra y qué puede hacer', visible: esOwner && hayEquipo },

    // «Plan y pagos», no «Suscripción»: suscripción es lo que la app le cobra a
    // él; plan y pagos es lo que él viene a mirar.
    { id: 'plan', nombre: 'Plan y pagos', nota: 'Qué tienes y qué se renueva', visible: esOwner },

    // Al final lo que se toca una vez y no se vuelve a mirar.
    { id: 'datos',      nombre: 'Tus datos',        nota: 'Tu nombre, correo y teléfono', visible: true },
    { id: 'seguridad',  nombre: 'Seguridad y datos', nota: 'Contraseña y copia de tu información', visible: true },
  ].filter((s) => s.visible)
}

/** Los ids visibles, que es lo que necesita el menú. */
export function idsVisibles(ctx) {
  return seccionesConfig(ctx).map((s) => s.id)
}
