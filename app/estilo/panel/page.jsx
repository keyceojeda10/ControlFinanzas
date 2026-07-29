// Vista previa del panel en sus dos momentos: antes del primer pago y a media
// tarde. Son los que cambian el titular.
import { adaptarPanel } from '@/lib/adaptadores/panel'
import Vista from './Vista'

export const dynamic = 'force-dynamic'

const CRUDO = {
  clientes: { total: 68, enMora: 9 },
  prestamos: { saldoPorCobrar: 153600000, esperadoHoy: 1240000 },
  finanzas: { patrimonio: 28500000, cajaDisponible: 2520280 },
  alertas: { clientesSinRuta: 3, prestamosSinPagosLargo: 4 },
}

export default function Previa() {
  const base = { nombre: 'Carlos Andrés', pais: 'co', clientesHoy: 23 }
  return (
    <Vista casos={[
      { titulo: '7:10 · nadie ha pagado',
        props: adaptarPanel({ ...CRUDO, cobros: { hoy: 0, interesGanadoHoy: 0 } }, { ...base, hora: 7 }) },
      { titulo: '16:40 · a media tarde',
        props: adaptarPanel({ ...CRUDO, cobros: { hoy: 680000, interesGanadoHoy: 142000 } }, { ...base, hora: 16 }) },
    ]} />
  )
}
