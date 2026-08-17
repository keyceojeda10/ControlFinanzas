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

const col = (clave, rotulo, tipo = 'texto', ancho = 1) => ({ clave, rotulo, tipo, ancho })

/** La foto de la cuenta: una fila por préstamo, con su persona y sus cifras. */
export const COLS_CARTERA = [
  col('cliente', 'Cliente', 'texto', 2),
  col('cedula', 'Cédula'),
  col('telefono', 'Teléfono'),
  col('direccion', 'Dirección', 'texto', 2),
  col('ruta', 'Ruta'),
  col('cobrador', 'Cobrador'),
  col('montoPrestado', 'Monto prestado', 'dinero'),
  col('totalAPagar', 'Total a pagar', 'dinero'),
  col('cuota', 'Cuota', 'dinero'),
  col('frecuencia', 'Frecuencia'),
  col('modo', 'Modo de interés'),
  col('tasa', 'Tasa %', 'pct'),
  col('plazo', 'Plazo (días)', 'numero'),
  col('inicio', 'Inicio', 'fecha'),
  col('vence', 'Vence', 'fecha'),
  col('estado', 'Estado'),
  col('pagado', 'Pagado', 'dinero'),
  col('saldo', 'Saldo', 'dinero'),
  col('capitalRestante', 'Capital restante', 'dinero'),
  col('diasMora', 'Días de mora', 'numero'),
  col('atraso', 'Atraso $', 'dinero'),
  col('proximoCobro', 'Próximo cobro', 'fecha'),
  col('ultimoPago', 'Último pago', 'fecha'),
  col('perdido', 'Perdido'),
]

export const COLS_CLIENTES = [
  col('nombre', 'Nombre', 'texto', 2),
  col('cedula', 'Cédula'),
  col('telefono', 'Teléfono'),
  col('direccion', 'Dirección', 'texto', 2),
  col('ruta', 'Ruta'),
  col('estado', 'Estado'),
  col('prestamos', 'Préstamos', 'numero'),
  col('activos', 'Activos', 'numero'),
  col('debe', 'Debe hoy', 'dinero'),
  col('diasMora', 'Días de mora', 'numero'),
  col('ultimoPago', 'Último pago', 'fecha'),
]

export const COLS_PAGOS = [
  col('fecha', 'Fecha', 'fecha'),
  col('cliente', 'Cliente', 'texto', 2),
  col('cedula', 'Cédula'),
  col('inicioPrestamo', 'Préstamo (inicio)', 'fecha'),
  col('cobrador', 'Cobrador'),
  col('monto', 'Monto', 'dinero'),
  col('tipo', 'Tipo'),
  col('metodo', 'Método'),
  col('nota', 'Nota', 'texto', 2),
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
