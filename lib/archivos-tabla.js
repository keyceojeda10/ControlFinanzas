// lib/archivos-tabla.js — qué archivos deja elegir el selector.
//
// ══ POR QUÉ NO BASTA CON LAS EXTENSIONES ═══════════════════════════════════
//
// «No me carga. El archivo para subirlo. No me deja seleccionarlo» — desde el
// móvil, 15 ago 2026. En la captura se ve el selector de Android mostrando un
// archivo de Drive rotulado «Hoja de cálculo» que no responde.
//
// Android NO filtra por extensión: el selector de documentos filtra por TIPO
// MIME. Chrome traduce `.xlsx,.xls,.csv` a los tres MIME de ofimática, y todo
// lo que el proveedor declare distinto queda apagado aunque sea el archivo
// correcto. Pasa constantemente:
//
//   · lo que llega por WhatsApp suele declararse `application/octet-stream`
//   · muchos gestores marcan los CSV como `text/plain` o
//     `text/comma-separated-values`
//
// Restringir tanto no nos protegía de nada: el lector es SheetJS, que abre
// xlsx, xls, csv y ODS, y lo que no pueda abrir cae en su propio mensaje de
// error. El precio de ser estricto aquí lo paga quien SÍ trae su archivo.
//
// ⚠ LO QUE ESTO NO ARREGLA. Una hoja NATIVA de Google (`Hoja de cálculo` en
// Drive, MIME `application/vnd.google-apps.spreadsheet`) no es un archivo con
// bytes: hay que exportarla. No existe `accept` que la haga elegible, así que
// va explicado en pantalla — ver `AVISO_HOJA_DE_GOOGLE`.
export const ACCEPT_TABLA = [
  '.xlsx', '.xls', '.csv', '.ods',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.oasis.opendocument.spreadsheet',
  'text/csv',
  'text/comma-separated-values',
  'text/plain',
  // El comodín de los proveedores que no saben decir qué mandan. Sin esto, el
  // archivo bueno llegado por WhatsApp se ve gris y no se puede tocar.
  'application/octet-stream',
].join(',')

export const AVISO_HOJA_DE_GOOGLE =
  '¿Está en Google Sheets? Ábrelo, toca Archivo → Descargar → Microsoft Excel (.xlsx) y sube ese. Las hojas de Google no se pueden elegir directamente.'
