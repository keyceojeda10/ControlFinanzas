import { redirect } from 'next/navigation'

/* Esta pantalla se fundió en el índice de informes el 16 ago 2026.
 *
 *   «Los reportes de bajar hay que unificarlos en los nuevos reportes que
 *    hicimos, lo mismo: cada reporte con su pantalla individual, con sus
 *    filtros y con sus dos formatos.» — el dueño
 *
 * Sus cinco descargas son ahora informes normales, con pantalla y con PDF
 * además del Excel: Cartera completa, Clientes, Pagos uno por uno, Ficha de
 * cobradores y Todo en bruto.
 *
 * Queda la redirección y no un 404: la gente tiene el enlace guardado.
 */
export default function BajarRedirigido() {
  redirect('/reportes')
}
