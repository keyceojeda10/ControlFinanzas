// Vista previa de «03 · Plan excedido» con casos reales, para poder mirarla sin
// tener una cuenta que de verdad haya pasado el tope.
//
// Los tres casos son los que cambian la pantalla: el que acaba de pasarse, el
// que necesita saltarse un plan porque el mínimo le quedaría corto, y el que
// todavía no tiene cartera (ahí el porcentaje no se puede calcular).

import { adaptarPlanExcedido } from '@/lib/adaptadores/planes'
import Vista from './Vista'

export const dynamic = 'force-dynamic'

const fmt = (n) => '$' + Number(n).toLocaleString('es-CO')

const CASOS = [
  { titulo: 'Justo pasado · 160 de 150', datos: { plan: 'starter', clientes: 160, carteraPorCobrar: 25100000 } },
  { titulo: 'El mínimo NO es el bueno · 400', datos: { plan: 'basic', clientes: 400, carteraPorCobrar: 61000000 } },
  { titulo: 'Sin cartera todavía', datos: { plan: 'starter', clientes: 160, carteraPorCobrar: 0 } },
]

export default function Previa() {
  return (
    <Vista
      casos={CASOS.map((c) => ({
        titulo: c.titulo,
        clientes: c.datos.clientes,
        vista: adaptarPlanExcedido(c.datos, fmt),
      }))}
    />
  )
}
