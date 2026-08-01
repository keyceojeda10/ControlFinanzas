// app/(dashboard)/loading.jsx — el esqueleto entre pantallas del dashboard.
//
// ── T05-06 ──
//
// Era un esqueleto propio: cuatro tarjetas en rejilla y dos bloques, con un
// degradado dorado al 2% que no aparece en ninguna lámina. Y sobre todo, NO SE
// PARECÍA A LO QUE VENÍA DESPUÉS: se anunciaban cuatro tarjetas iguales y
// llegaba un bloque negro con una lista. Eso hace que la pantalla «salte» al
// cargar, que es justo lo que un esqueleto existe para evitar.
//
// `PanelCargando` dibuja la forma real del panel: el bloque grande arriba, la
// tira de cifras y las filas. Llevaba construido y sin usar.

import { PanelCargando } from '@/components/pantallas/Cargando'

export default function DashboardLoading() {
  return (
    <div role="status" aria-live="polite">
      <PanelCargando sinMargen />
    </div>
  )
}
