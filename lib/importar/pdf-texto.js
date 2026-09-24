/* El texto de un PDF, página por página, con la posición de cada pieza. Lo usa
   la ruta /api/carga-masiva/leer-pdf; el lector de cada plantilla (hoy, la
   planilla de Crossbox) decide qué hay en él. Solo en el servidor. */
import { getDocumentProxy } from 'unpdf'

export const MAX_BYTES_PDF = 5 * 1024 * 1024
export const MAX_PAGINAS_PDF = 30

export const MENSAJES_PDF = {
  falta: 'Elige el PDF de tu planilla.',
  noEsPdf: 'Ese archivo no es un PDF.',
  pesado: 'El PDF pesa más de 5 MB. Escríbenos por WhatsApp y te ayudamos.',
  paginas: (n) => `Tu PDF tiene ${n} páginas; el máximo es ${MAX_PAGINAS_PDF}. Escríbenos por WhatsApp y te ayudamos.`,
  desconocido: 'Este PDF no es una planilla que sepamos leer. Escríbenos por WhatsApp y te ayudamos.',
  incompleto: 'No pudimos leer la planilla completa: los totales no cuadran con las filas. Escríbenos por WhatsApp y te ayudamos.',
}

export async function paginasDePdf(buffer, { maxPaginas = MAX_PAGINAS_PDF } = {}) {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  // M12: cerrar SIEMPRE el documento que abre unpdf — se corte temprano por
  // exceder el tope de páginas, reviente leyendo una página, o termine bien.
  // Sin esto cada PDF leído dejaba sus páginas y recursos en memoria.
  try {
    if (pdf.numPages > maxPaginas) return { error: 'demasiadas-paginas', numPages: pdf.numPages }
    const paginas = []
    for (let p = 1; p <= pdf.numPages; p++) {
      const { items } = await (await pdf.getPage(p)).getTextContent()
      paginas.push(items
        .filter((i) => typeof i.str === 'string' && i.str.trim())
        .map((i) => ({ str: i.str, x: Math.round(i.transform[4]), y: Math.round(i.transform[5]) })))
    }
    return { paginas }
  } finally {
    await pdf.destroy?.()
  }
}
