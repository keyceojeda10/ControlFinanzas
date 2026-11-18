// components/cf/ajustes.js — Los rótulos del estilo «Mi cuenta» (18 nov 2026).
//
// El dueño, con el índice de Configuración nuevo: «quedó muy limpio y se
// entiende bastante; me gustaría que fuese una constante en los modales y las
// opciones de configuración». Lo que lo hace leerse así es que cada cosa se
// nombra con palabras normales, no con rótulos de 10px en mayúsculas
// («NOMBRE DEL NEGOCIO», «FRECUENCIA»), que había en cada sección por separado.
//
// Un solo sitio para esos rótulos. Dentro de la escala cerrada de DESIGN.md
// (texto 13 y 15): sin tamaños nuevos.

/** El nombre de un campo de formulario, encima del control. */
export const ROTULO_CAMPO = {
  display: 'block', fontSize: 13, fontWeight: 600, letterSpacing: 0,
  textTransform: 'none', color: 'var(--cf-ink-2)', marginBottom: 8,
}

/** El nombre de un grupo de opciones («En este teléfono», «El resumen del día»).
    En gris, como los grupos del índice: si pesa igual que la fila de debajo, no
    se sabe cuál es el grupo y cuál la opción. */
export const ROTULO_GRUPO = {
  display: 'block', fontSize: 15, fontWeight: 600, letterSpacing: '-.01em',
  textTransform: 'none', color: 'var(--cf-ink-3)',
}
