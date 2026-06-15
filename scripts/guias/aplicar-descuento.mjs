import { abrirPrestamo, abrirGestion } from './_helpers.mjs'

export const def = {
  slug: 'aplicar-descuento',
  login: true,
  pasos: [
    {
      accion: abrirPrestamo,
      titulo: 'Paso 1 — Abre el préstamo',
      msg: 'En "Préstamos", toca el préstamo al que quieres hacerle un descuento (perdonar parte de la deuda).',
      resaltar: (p) => p.getByRole('button', { name: /Gesti.n/i }).first(),
      forma: 'circulo',
    },
    {
      accion: abrirGestion,
      titulo: 'Paso 2 — Abre "Gestión"',
      msg: 'Toca "Gestión" y luego "Descuento". El descuento RESTA dinero del saldo: úsalo para perdonar mora o cerrar un acuerdo de pago.',
      resaltar: (p) => p.getByRole('button', { name: /^Descuento$/i }).first(),
      forma: 'circulo',
    },
    {
      accion: async (p) => {
        await abrirGestion(p)
        await p.getByRole('button', { name: /^Descuento$/i }).first().click().catch(()=>{})
        await p.waitForTimeout(2000)
      },
      titulo: 'Paso 3 — Monto y motivo',
      msg: 'Escribe cuánto descontar y el motivo. Confirma y el saldo del cliente baja. No afecta tu capital prestado, solo lo que falta cobrar.',
      resaltar: (p) => p.getByRole('button', { name: /Aplicar|Guardar|Confirmar|Descuento/i }).last(),
      forma: 'circulo',
    },
  ],
}
