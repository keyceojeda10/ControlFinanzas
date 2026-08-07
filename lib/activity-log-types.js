// lib/activity-log-types.js — cómo se lee cada acción del historial.
//
// ── POR QUÉ ESTÁN TODAS ────────────────────────────────────────────────────
//
// La pantalla cae al CÓDIGO CRUDO cuando la acción no está aquí
// (`actividad/page.jsx:369`: `ACCIONES[item.accion] || { label: item.accion }`),
// así que el dueño leía «registrar_aporte», «crear_socio» y «renovar_prestamo»
// en su historial. Lo reportó viendo la pantalla.
//
// Y no eran tres: el sistema escribe **48 códigos** distintos y aquí había
// **15**. Los otros 33 salían en crudo, con guiones bajos, esperando a que
// alguien tropezara con cada uno.
//
// La regla de este archivo: **si el código se escribe en algún sitio, aquí
// tiene su frase**. En el idioma del dueño y en pasado, que es como se lee un
// historial: «Creó préstamo», no «crear_prestamo».
//
// ⚠ Al añadir una acción nueva en un endpoint, añadirla TAMBIÉN aquí. Lo caza
// `lib/__tests__/acciones-con-nombre.test.js`, que compara este mapa contra los
// `accion: '...'` que hay en el código.
//
// Los iconos disponibles los pinta `actividad/page.jsx`: banknotes, user-plus,
// pencil, trash, map, calculator, arrows, receipt. Uno que no esté ahí no se
// dibuja — y una fila sin icono se lee peor que una con el genérico.
export const ACCIONES = {
  crear_prestamo:    { label: 'Creó préstamo',        icon: 'banknotes',   color: '#22c55e' },
  editar_prestamo:   { label: 'Editó préstamo',       icon: 'pencil',      color: '#f59e0b' },
  eliminar_prestamo: { label: 'Eliminó préstamo',     icon: 'trash',       color: '#ef4444' },
  registrar_pago:    { label: 'Registró pago',        icon: 'check',       color: '#22c55e' },
  editar_pago:       { label: 'Editó fecha de pago',  icon: 'pencil',      color: '#f59e0b' },
  anular_pago:       { label: 'Anuló pago',           icon: 'trash',       color: '#ef4444' },
  crear_cliente:     { label: 'Creó cliente',          icon: 'user-plus',   color: '#3b82f6' },
  editar_cliente:    { label: 'Editó cliente',         icon: 'pencil',      color: '#f59e0b' },
  eliminar_cliente:  { label: 'Eliminó cliente',       icon: 'trash',       color: '#ef4444' },
  crear_ruta:        { label: 'Creó ruta',             icon: 'map',         color: '#8b5cf6' },
  crear_cobrador:    { label: 'Creó cobrador',         icon: 'user-plus',   color: '#8b5cf6' },
  cierre_caja:       { label: 'Cerró caja',            icon: 'calculator',  color: '#f59e0b' },
  movimiento_capital:{ label: 'Movimiento de capital', icon: 'arrows',      color: '#3b82f6' },
  registrar_gasto:   { label: 'Registró gasto',        icon: 'receipt',     color: '#ef4444' },
  editar_configuracion: { label: 'Cambió configuración', icon: 'pencil',    color: '#8b5cf6' },

  // ── PRÉSTAMOS ──
  renovar_prestamo:  { label: 'Renovó préstamo',       icon: 'banknotes',  color: '#22c55e' },
  // Estas tres van escritas en un ternario —`accion: marcar ? 'x' : 'y'`— y por
  // eso se me escaparon en el primer barrido. «Clavo» es la palabra del dueño
  // para la tarjeta que ya no se recupera; no se traduce a otra cosa.
  solicitar_prestamo: { label: 'Solicitó préstamo',    icon: 'banknotes',  color: '#f59e0b' },
  marcar_clavo:      { label: 'Marcó tarjeta clavo',   icon: 'trash',      color: '#ef4444' },
  desmarcar_clavo:   { label: 'Quitó de tarjetas clavo', icon: 'banknotes', color: '#22c55e' },
  aprobar_prestamo:  { label: 'Aprobó préstamo',       icon: 'check',      color: '#22c55e' },
  rechazar_prestamo: { label: 'Rechazó préstamo',      icon: 'trash',      color: '#ef4444' },
  pago_aprobado:     { label: 'Aprobó pago',           icon: 'check',      color: '#22c55e' },
  anular_pago_fallo: { label: 'No pudo anular el pago', icon: 'trash',     color: '#ef4444' },

  // ── SOCIOS ──
  crear_socio:       { label: 'Creó socio',            icon: 'user-plus',  color: '#8b5cf6' },
  editar_socio:      { label: 'Editó socio',           icon: 'pencil',     color: '#f59e0b' },
  eliminar_socio:    { label: 'Eliminó socio',         icon: 'trash',      color: '#ef4444' },
  // El aporte y el retiro NO se dicen igual aunque compartan endpoint: uno mete
  // plata al negocio y el otro la saca.
  registrar_aporte:  { label: 'Registró aporte',       icon: 'arrows',     color: '#22c55e' },
  registrar_retiro_socio: { label: 'Registró retiro de socio', icon: 'arrows', color: '#ef4444' },
  eliminar_aporte:   { label: 'Eliminó aporte',        icon: 'trash',      color: '#ef4444' },
  repartir_utilidades: { label: 'Repartió utilidades', icon: 'arrows',     color: '#22c55e' },

  // ── CAJA Y CAPITAL ──
  ajuste_cierre_caja: { label: 'Ajustó el cierre de caja', icon: 'calculator', color: '#f59e0b' },
  confirmar_cuadre:  { label: 'Confirmó el cuadre',    icon: 'calculator', color: '#22c55e' },
  movimiento_caja_manual: { label: 'Movimiento de caja a mano', icon: 'arrows', color: '#3b82f6' },
  editar_movimiento_capital: { label: 'Editó movimiento de capital', icon: 'pencil', color: '#f59e0b' },
  eliminar_movimiento_capital: { label: 'Eliminó movimiento de capital', icon: 'trash', color: '#ef4444' },
  configurar_capital: { label: 'Configuró el capital', icon: 'calculator', color: '#8b5cf6' },
  eliminar_gasto:    { label: 'Eliminó gasto',         icon: 'trash',      color: '#ef4444' },

  // ── REAPERTURA DEL CIERRE ──
  // Son cuatro pasos del mismo trámite y se leen como tales: quién la pide,
  // quién la aprueba o la rechaza, y cuándo se abrió de verdad.
  solicitud_reapertura_cierre_caja: { label: 'Pidió reabrir la caja', icon: 'calculator', color: '#f59e0b' },
  aprobacion_reapertura_cierre_caja: { label: 'Aprobó reabrir la caja', icon: 'calculator', color: '#22c55e' },
  rechazo_reapertura_cierre_caja: { label: 'Rechazó reabrir la caja', icon: 'calculator', color: '#ef4444' },
  reapertura_cierre_caja: { label: 'Reabrió la caja',  icon: 'calculator', color: '#f59e0b' },
  push_recordatorio_cierre: { label: 'Recordó cerrar la caja', icon: 'calculator', color: '#3b82f6' },

  // ── CLIENTES Y CRM ──
  reactivar_cliente: { label: 'Reactivó cliente',      icon: 'user-plus',  color: '#22c55e' },
  inactivar:         { label: 'Inactivó',              icon: 'trash',      color: '#ef4444' },
  reagendar_visita:  { label: 'Reagendó la visita',    icon: 'pencil',     color: '#f59e0b' },
  // El cobrador cerró la visita de hoy y luego el cliente sacó más plata. Deja
  // rastro a propósito: es una anotación borrada, y el dueño tiene que poder
  // ver por qué un cliente que constaba como visitado dejó de constarlo.
  reabrir_visita:    { label: 'Volvió a abrir la visita', icon: 'pencil',   color: '#f59e0b' },
  crm_nota:          { label: 'Dejó una nota',         icon: 'pencil',     color: '#3b82f6' },
  crm_email:         { label: 'Envió un correo',       icon: 'receipt',    color: '#3b82f6' },
  crm_actualizar:    { label: 'Actualizó el seguimiento', icon: 'pencil',  color: '#3b82f6' },

  // ── CUENTA Y DATOS ──
  carga_masiva:      { label: 'Importó clientes',      icon: 'user-plus',  color: '#3b82f6' },
  editar_organizacion: { label: 'Editó el negocio',    icon: 'pencil',     color: '#8b5cf6' },
  reiniciar_cuenta:  { label: 'Reinició la cuenta',    icon: 'trash',      color: '#ef4444' },
  revertir_demo:     { label: 'Quitó los datos de prueba', icon: 'trash',  color: '#ef4444' },

  // ── LAS QUE NO SON ACCIONES ──
  // `ninguna` y `test` existen en el código pero no describen nada que el dueño
  // haya hecho. Se nombran igual: sin frase salían en crudo, y «test» en el
  // historial de un negocio real da más miedo que información.
  ninguna:           { label: 'Sin cambios',           icon: 'pencil',     color: '#94a3b8' },
  test:              { label: 'Prueba del sistema',    icon: 'pencil',     color: '#94a3b8' },
}
