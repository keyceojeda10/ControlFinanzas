import { abrirPrestamo, abrirGestion } from './_helpers.mjs'

export const def = {
  slug: 'marcar-prestamo-perdido',
  login: true,
  pasos: [
    {
      accion: abrirPrestamo,
      titulo: 'Paso 1 — Abre el préstamo',
      msg: 'En "Préstamos", toca el préstamo que ya consideras incobrable (un "clavo").',
      resaltar: (p) => p.getByRole('button', { name: /Gesti.n/i }).first(),
      forma: 'circulo',
    },
    {
      accion: abrirGestion,
      titulo: 'Paso 2 — "Mover a préstamos perdidos"',
      msg: 'Toca "Gestión" y luego "Mover a préstamos perdidos". Esto saca el préstamo de tu cartera activa y lo registra como pérdida, sin borrar el historial.',
      resaltar: (p) => p.getByRole('button', { name: /perdidos/i }).first(),
      forma: 'circulo',
    },
    {
      accion: async (p) => {
        await abrirGestion(p)
        await p.getByRole('button', { name: /perdidos/i }).first().click().catch(()=>{})
        await p.waitForTimeout(2000)
      },
      titulo: 'Paso 3 — Confirma',
      msg: 'Confirma para marcarlo como perdido. Lo podrás ver siempre en "Más herramientas → Préstamos perdidos" por si el cliente reaparece a pagar.',
      resaltar: (p) => p.getByRole('button', { name: /Mover|Confirmar|perdido/i }).last(),
      forma: 'circulo',
    },
  ],
}
