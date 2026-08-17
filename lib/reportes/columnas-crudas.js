/* ══ LAS COLUMNAS DE LOS VOLCADOS, EN UN SOLO SITIO ══════════════════════════
 *
 * Pedido por el dueño el 16 ago 2026, cerrando el centro de informes:
 *
 *   «Los reportes de bajar hay que unificarlos en los nuevos reportes que
 *    hicimos, lo mismo: cada reporte con su pantalla individual, con sus
 *    filtros y con sus dos formatos. Si esos reportes de bajar van a quedar
 *    diferentes a todos los reportes que hicimos, hay que unificarlos también.»
 *
 * `/reportes/bajar` era la última pantalla que se salía del sistema: bajaba
 * cinco Excel sueltos y no se podía ni mirar antes ni pedir en PDF.
 *
 * ── POR QUÉ LAS COLUMNAS VIVEN AQUÍ Y NO EN CADA SITIO ──────────────────────
 *
 * Las mismas filas alimentan ahora TRES salidas —la pantalla, el PDF y el
 * Excel— y las tres tienen que decir lo mismo. Con la lista de columnas escrita
 * en cada una, basta que alguien añada una para que el Excel tenga un dato que
 * la pantalla no enseña; y esa es exactamente la clase de discrepancia que este
 * proyecto lleva la semana entera arreglando.
 *
 * `tipo` decide el formato en las tres a la vez (ver lib/reportes/vistas.js):
 * `dinero` se escribe como número con formato de moneda en el Excel —si va como
 * texto, Excel no suma la columna— y con el símbolo del país en pantalla.
 */

/* ⚠ `enPantalla: false` NO ESCONDE EL DATO: lo saca de la PANTALLA Y DEL PDF, y
 * lo deja en el Excel, que es donde cabe.
 *
 * «Cartera completa» son 24 columnas. En un PC de 1440px eso da 37 píxeles por
 * columna y la tabla salía con TODO recortado: «C…», «$…», «di…». Hasta el
 * dinero y el nombre, que son las dos cosas que esta app no recorta nunca. En
 * la hoja carta del PDF pasa lo mismo.
 *
 * La regla del proyecto es explícita: si algo no cabe, SE QUITA CONTENIDO — no
 * se encoge ni se recorta. Así que la pantalla y el PDF enseñan las columnas con
 * las que se trabaja, y el Excel se lleva las veinticuatro. La pantalla lo dice
 * en una línea, para que nadie crea que el archivo trae menos. */
const col = (clave, rotulo, tipo = 'texto', ancho = 1, enPantalla = true) =>
  ({ clave, rotulo, tipo, ancho, enPantalla })

/** La foto de la cuenta: una fila por préstamo, con su persona y sus cifras. */
export const COLS_CARTERA = [
  col('cliente', 'Cliente', 'texto', 2),
  col('cedula', 'Cédula', 'texto', 1, false),
  col('telefono', 'Teléfono', 'texto', 1, false),
  col('direccion', 'Dirección', 'texto', 2, false),
  col('ruta', 'Ruta'),
  col('cobrador', 'Cobrador', 'texto', 1, false),
  col('montoPrestado', 'Monto prestado', 'dinero'),
  col('totalAPagar', 'Total a pagar', 'dinero', 1, false),
  col('cuota', 'Cuota', 'dinero'),
  col('frecuencia', 'Frecuencia', 'texto', 1, false),
  col('modo', 'Modo de interés', 'texto', 1, false),
  col('tasa', 'Tasa %', 'pct', 1, false),
  col('plazo', 'Plazo (días)', 'numero', 1, false),
  col('inicio', 'Inicio', 'fecha', 1, false),
  col('vence', 'Vence', 'fecha', 1, false),
  col('estado', 'Estado', 'texto', 1, false),
  col('pagado', 'Pagado', 'dinero'),
  col('saldo', 'Saldo', 'dinero'),
  col('capitalRestante', 'Capital restante', 'dinero', 1, false),
  col('diasMora', 'Días de mora', 'numero'),
  col('atraso', 'Atraso $', 'dinero', 1, false),
  col('proximoCobro', 'Próximo cobro', 'fecha'),
  col('ultimoPago', 'Último pago', 'fecha', 1, false),
  col('perdido', 'Perdido', 'texto', 1, false),
]

export const COLS_CLIENTES = [
  col('nombre', 'Nombre', 'texto', 2),
  col('cedula', 'Cédula', 'texto', 1, false),
  col('telefono', 'Teléfono'),
  col('direccion', 'Dirección', 'texto', 2, false),
  col('ruta', 'Ruta'),
  col('estado', 'Estado', 'texto', 1, false),
  col('prestamos', 'Préstamos', 'numero', 1, false),
  col('activos', 'Activos', 'numero'),
  col('debe', 'Debe hoy', 'dinero'),
  col('diasMora', 'Días de mora', 'numero'),
  col('ultimoPago', 'Último pago', 'fecha'),
]

export const COLS_PAGOS = [
  col('fecha', 'Fecha', 'fecha'),
  col('cliente', 'Cliente', 'texto', 2),
  col('cedula', 'Cédula', 'texto', 1, false),
  col('inicioPrestamo', 'Préstamo (inicio)', 'fecha', 1, false),
  col('cobrador', 'Cobrador'),
  col('monto', 'Monto', 'dinero'),
  col('tipo', 'Tipo'),
  col('metodo', 'Método'),
  col('nota', 'Nota', 'texto', 2, false),
]

export const COLS_COBRADORES = [
  col('nombre', 'Cobrador', 'texto', 2),
  col('email', 'Correo', 'texto', 2),
  col('telefono', 'Teléfono'),
  col('rutas', 'Rutas', 'texto', 2),
  col('activo', 'Activo'),
]

export const COLUMNAS_CRUDAS = {
  cartera: COLS_CARTERA,
  clientes: COLS_CLIENTES,
  pagos: COLS_PAGOS,
  cobradores: COLS_COBRADORES,
}

/** Las que caben en una pantalla y en una hoja carta. El Excel las lleva todas. */
export const soloDePantalla = (columnas = []) => columnas.filter((c) => c.enPantalla !== false)

/** Un objeto-fila a la lista de celdas que espera el escritor de Excel. */
export const aFila = (obj, columnas) => columnas.map((c) => obj[c.clave] ?? '')

/** Las letras de columna que llevan formato de moneda, sacadas del `tipo`. */
export function columnasDeDinero(columnas) {
  const letra = (i) => {
    let s = ''
    for (let n = i; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s
    return s
  }
  return columnas.map((c, i) => (c.tipo === 'dinero' ? letra(i) : null)).filter(Boolean)
}
