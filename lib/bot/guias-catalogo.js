// lib/bot/guias-catalogo.js — Catalogo de guias visuales (tutoriales con
// screenshots anotados) que el bot de WhatsApp puede enviar cuando un usuario
// pregunta "como hago X" en el sistema.
//
// Las imagenes viven en /public/guias/<slug>/paso-N.png y se sirven publicas
// en https://app.control-finanzas.com/guias/<slug>/paso-N.png — por eso el bot
// puede mandarlas por la Cloud API usando { image: { link } } sin subirlas a
// Meta (ver lib/bot/guias-sender.js).
//
// `pasos` = cuantas imagenes paso-N.png tiene la guia (en orden 1..N).
// `titulo` = encabezado humano. `claves` = sinonimos/temas para que el modelo
// haga match con lo que pregunta el usuario.

export const BASE_URL = process.env.GUIAS_BASE_URL || 'https://app.control-finanzas.com'

export const GUIAS = {
  // ── Primeros pasos ─────────────────────────────────────────────
  'crear-cuenta':        { pasos: 3, titulo: 'Cómo crear una cuenta', claves: 'registrarse, crear cuenta, abrir cuenta, registro, empezar' },
  'primer-ingreso':      { pasos: 4, titulo: 'Primer ingreso (recorrido inicial)', claves: 'primera vez, recorrido, onboarding, empezar, demo, datos de ejemplo' },

  // ── Clientes ───────────────────────────────────────────────────
  'crear-cliente':       { pasos: 4, titulo: 'Cómo crear un cliente', claves: 'crear cliente, agregar cliente, nuevo cliente, registrar cliente' },
  'editar-cliente':      { pasos: 3, titulo: 'Cómo editar un cliente', claves: 'editar cliente, cambiar datos del cliente, modificar cliente, corregir nombre o telefono' },
  'eliminar-cliente':    { pasos: 3, titulo: 'Cómo eliminar un cliente', claves: 'eliminar cliente, borrar cliente, quitar cliente' },
  'inactivar-cliente':   { pasos: 3, titulo: 'Cómo inactivar un cliente', claves: 'inactivar cliente, pausar cliente, desactivar cliente, ocultar cliente' },
  'reagendar-visita':    { pasos: 3, titulo: 'Cómo reagendar una visita', claves: 'reagendar, cambiar fecha de cobro, mover visita, posponer cobro' },
  'trasladar-cliente':   { pasos: 3, titulo: 'Cómo trasladar un cliente a otra ruta', claves: 'trasladar cliente, mover cliente de ruta, cambiar de ruta, reasignar ruta' },
  'importar-cartulina':  { pasos: 3, titulo: 'Cómo importar desde cartulina (foto)', claves: 'cartulina, importar tarjeta, foto del cliente, OCR, pasar de la libreta, leer la tarjeta' },

  // ── Prestamos ──────────────────────────────────────────────────
  'crear-prestamo':      { pasos: 6, titulo: 'Cómo crear un préstamo', claves: 'crear prestamo, nuevo prestamo, prestar, registrar prestamo, dar credito' },
  'registrar-pago':      { pasos: 4, titulo: 'Cómo registrar un pago', claves: 'registrar pago, cobrar, abonar, anotar pago, recibir cuota' },
  'editar-eliminar-prestamo': { pasos: 5, titulo: 'Cómo editar o eliminar un préstamo', claves: 'editar prestamo, eliminar prestamo, borrar prestamo, modificar plazo, cancelar prestamo, cerrar anticipado' },
  'renovar-prestamo':    { pasos: 3, titulo: 'Cómo renovar un préstamo', claves: 'renovar, prestar mas, refinanciar, volver a prestar, cartulina nueva' },
  'aplicar-recargo':     { pasos: 3, titulo: 'Cómo aplicar un recargo', claves: 'recargo, mora, multa, sumar al saldo, cobro extra' },
  'aplicar-descuento':   { pasos: 3, titulo: 'Cómo aplicar un descuento', claves: 'descuento, perdonar, rebajar deuda, quitar mora, acuerdo de pago' },
  'anular-un-pago':      { pasos: 3, titulo: 'Cómo anular un pago', claves: 'anular pago, borrar pago, deshacer pago, pago equivocado, corregir abono' },
  'marcar-prestamo-perdido': { pasos: 3, titulo: 'Cómo marcar un préstamo como perdido', claves: 'prestamo perdido, incobrable, clavo, dar de baja, perdida' },
  'enviar-recibo-whatsapp': { pasos: 3, titulo: 'Cómo enviar el recibo por WhatsApp', claves: 'enviar recibo, mandar comprobante, resumen por whatsapp, recibo del pago' },

  // ── Rutas ──────────────────────────────────────────────────────
  'crear-ruta':          { pasos: 3, titulo: 'Cómo crear una ruta', claves: 'crear ruta, nueva ruta, agregar ruta, zona de cobro' },
  'cobrar-desde-ruta':   { pasos: 4, titulo: 'Cómo cobrar desde la ruta', claves: 'cobrar desde ruta, ruta del dia, salir a cobrar, lista de cobro' },
  'organizar-ruta':      { pasos: 3, titulo: 'Cómo organizar/ordenar una ruta', claves: 'organizar ruta, ordenar ruta, optimizar ruta, orden de visitas' },

  // ── Dinero / caja / capital ────────────────────────────────────
  'ver-caja':            { pasos: 5, titulo: 'Cómo leer la caja', claves: 'caja, leer la caja, ver caja, saldo del dia, cuanto entro y salio' },
  'capital':             { pasos: 3, titulo: 'Cómo manejar el capital', claves: 'capital, fondo, dinero para prestar, movimientos de capital' },
  'inyectar-capital':    { pasos: 3, titulo: 'Cómo inyectar (agregar) capital', claves: 'inyectar capital, agregar capital, meter plata, sumar al capital, ingreso de dinero' },
  'retirar-capital':     { pasos: 3, titulo: 'Cómo retirar capital', claves: 'retirar capital, sacar plata, quitar del capital, egreso de dinero' },
  'hacer-ajuste-caja':   { pasos: 3, titulo: 'Cómo hacer un ajuste de caja', claves: 'ajuste de caja, cuadrar caja, corregir descuadre, ajustar saldo, sobrante o faltante' },
  'cuadrar-caja-con-cobradores': { pasos: 3, titulo: 'Cómo cuadrar la caja con los cobradores', claves: 'cuadrar con cobradores, cuadre del dia, revisar diferencias, cuanto entrego cada cobrador' },
  'cerrar-caja':         { pasos: 3, titulo: 'Cómo cerrar la caja', claves: 'cerrar caja, cierre del dia, confirmar cobradores, sellar el dia' },
  'reabrir-caja':        { pasos: 3, titulo: 'Cómo reabrir una caja', claves: 'reabrir caja, corregir cierre, abrir cierre anterior, deshacer cierre' },
  'pagar-mensualidad':   { pasos: 3, titulo: 'Cómo pagar la mensualidad del sistema', claves: 'pagar mensualidad, pagar el plan, activar plan, pagar suscripcion' },

  // ── Gastos ─────────────────────────────────────────────────────
  'agregar-mi-gasto':    { pasos: 3, titulo: 'Cómo agregar un gasto propio', claves: 'agregar gasto, mi gasto, registrar gasto, anotar gasto propio' },
  'aprobar-rechazar-gastos-cobradores': { pasos: 3, titulo: 'Cómo aprobar o rechazar gastos de cobradores', claves: 'aprobar gastos, rechazar gastos, gastos de cobradores, gastos pendientes' },

  // ── Avanzado / configuracion ───────────────────────────────────
  'crear-cobrador':      { pasos: 4, titulo: 'Cómo crear un cobrador', claves: 'crear cobrador, agregar cobrador, nuevo usuario, dar acceso a cobrador' },
  'lucas-ia':            { pasos: 3, titulo: 'Cómo usar Lucas IA', claves: 'lucas, asistente, inteligencia artificial, registrar por voz, preguntar ganancias' },
  'configuracion':       { pasos: 5, titulo: 'Cómo entrar a configuración', claves: 'configuracion, ajustes, perfil, organizacion, apariencia, notificaciones' },
}

// Devuelve la guia si el slug existe, o null.
export function getGuia(slug) {
  if (!slug) return null
  const g = GUIAS[slug]
  if (!g) return null
  return { slug, ...g }
}

// URLs publicas de las imagenes de una guia, en orden (paso-1..paso-N).
export function urlsDeGuia(slug) {
  const g = GUIAS[slug]
  if (!g) return []
  return Array.from({ length: g.pasos }, (_, i) =>
    `${BASE_URL}/guias/${slug}/paso-${i + 1}.png`
  )
}

// Lista compacta "slug — titulo (claves)" para inyectar en el system prompt,
// asi el modelo sabe que guias existen y cuando enviarlas.
export function catalogoParaPrompt() {
  return Object.entries(GUIAS)
    .map(([slug, g]) => `- ${slug}: ${g.titulo} (${g.claves})`)
    .join('\n')
}
