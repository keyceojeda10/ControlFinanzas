import { abrirPrestamo, abrirGestion } from './_helpers.mjs'

export const def = {
  slug: 'aplicar-recargo',
  login: true,
  pasos: [
    {
      accion: abrirPrestamo,
      titulo: 'Paso 1 — Abre el préstamo',
      msg: 'En "Préstamos", toca el préstamo al que quieres aplicarle un recargo (mora, interés extra, etc.).',
      resaltar: (p) => p.getByRole('button', { name: /Gesti.n/i }).first(),
      forma: 'circulo',
    },
    {
      accion: abrirGestion,
      titulo: 'Paso 2 — Abre "Gestión"',
      msg: 'Toca "Gestión" y luego "Recargo". El recargo SUMA dinero al saldo del préstamo (lo que el cliente debe pagar).',
      resaltar: (p) => p.getByRole('button', { name: /^Recargo$/i }).first(),
      forma: 'circulo',
    },
    {
      accion: async (p) => {
        await abrirGestion(p)
        await p.getByRole('button', { name: /^Recargo$/i }).first().click().catch(()=>{})
        await p.waitForTimeout(2000)
      },
      titulo: 'Paso 3 — Monto y motivo',
      msg: 'Escribe el monto del recargo y el motivo (mora, gasto de cobranza...). Confirma y el saldo del cliente sube automáticamente.',
      resaltar: (p) => p.getByRole('button', { name: /Aplicar|Guardar|Confirmar|Recargo/i }).last(),
      forma: 'circulo',
    },
  ],
}
