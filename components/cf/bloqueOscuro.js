/**
 * La paleta del BLOQUE OSCURO del sistema.
 *
 * Es el contenedor que lleva la cifra que resuelve una pantalla: el titular del
 * panel (Adenda 4) y la banda del día en Rutas (Adenda 5 · E11). La regla del
 * sistema es que esa cifra va en bloque oscuro y NUNCA sobre dorado — «el fondo
 * dorado no es un estilo, es un error de sistema»: el dorado está reservado al
 * monto principal, la acción primaria y el foco del campo activo, así que con
 * el fondo entero dorado el monto queda del color de su propia caja y el ojo no
 * encuentra dónde mirar.
 *
 * ⚠ LOS COLORES VAN FIJOS, NO EN TOKENS DE TEMA. Estos bloques son oscuros en
 * los DOS temas, así que un token que cambie con el tema los deja mudos en uno
 * de los dos. Es exactamente el fallo que tuvo la versión dorada de la tarjeta
 * del panel: su texto usaba un token que en tema oscuro valía el mismo dorado
 * del fondo, y la tarjeta salía en blanco.
 *
 * ⚠ Y SOBRE FONDO OSCURO LOS COLORES CAMBIAN. El dorado, el verde y el rojo del
 * tema claro no tienen contraste suficiente sobre #15161A; estos son los que la
 * adenda especifica para este fondo.
 */
export const BLOQUE = {
  fondo:   '#15161A',
  tinta:   '#F3F3F6',   // la cifra
  rotulo:  '#A3A8B2',   // etiquetas y prosa
  apagado: '#8A8E98',   // contexto y valores secundarios
  oro:     '#F5B824',
  rojo:    '#F0575C',
  linea:   'rgba(255,255,255,.09)',
  pista:   'rgba(255,255,255,.12)',
  barra:   'rgba(255,255,255,.34)',   // días que cobraron todo
  barraNo: 'rgba(255,255,255,.16)',   // días que no llegaron
}

/**
 * El borde del bloque.
 *
 * ⚠ NO ES ADORNO. En tema oscuro `--cf-surface` vale EXACTAMENTE #15161A, o sea
 * el mismo color del bloque: sin borde queda a ratio 1,00 contra el fondo de la
 * app y desaparece — se ve el contenido flotando sin caja.
 *
 * El sistema ya tenía esta regla escrita en `tokens-2026.css`, y viene de un
 * reporte del dueño: «el borde está del mismo color que el fondo, entonces no
 * se ve como que fuese una caja». Allí se midió que en oscuro el relleno no
 * alcanza a dibujar la caja y que el borde tiene que hacer ese trabajo al 14%.
 */
export const BORDE_BLOQUE = '1px solid rgba(255,255,255,.14)'
