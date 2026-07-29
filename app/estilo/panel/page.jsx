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
        props: adaptarPanel({ ...CRUDO, cobros: { hoy: 0, cantidadHoy: 0, interesGanadoHoy: 0, ayer: 1180000, ayerAEstaHora: 0, sparkline7d: [980000, 1120000, 1040000, 1210000, 890000, 1180000, 0] } }, { ...base, hora: 7 }) },
      { titulo: '16:40 · a media tarde',
        props: adaptarPanel({ ...CRUDO, cobros: { hoy: 680000, cantidadHoy: 14, interesGanadoHoy: 142000, ayer: 1180000, ayerAEstaHora: 520000, sparkline7d: [980000, 1120000, 1040000, 1210000, 890000, 1180000, 680000] } }, { ...base, hora: 16 }) },
    ]} />
  )
}
