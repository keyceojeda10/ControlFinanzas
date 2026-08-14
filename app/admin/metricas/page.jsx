import { redirect } from 'next/navigation'

/* Esta pantalla se fundió en /admin/inicio el 14 ago 2026. Las tres —Dashboard,
 * Negocio y Métricas— contestaban la misma pregunta con cifras distintas, y la
 * de aquí llegó a mostrar un MRR de $23.038.000 donde había $2.570.800.
 *
 * Queda el redirección porque el dueño tiene marcadores. */
export default function MetricasRedirigido() {
  redirect('/admin/inicio')
}
