import { abrirPrestamo, abrirGestion } from './_helpers.mjs'

export const def = {
  slug: 'renovar-prestamo',
  login: true,
  pasos: [
    {
      accion: abrirPrestamo,
      titulo: 'Paso 1 — Abre el préstamo',
      msg: 'Renovar = prestarle más a un cliente que todavía tiene saldo. Abre el préstamo actual del cliente.',
      resaltar: (p) => p.getByRole('button', { name: /Gesti.n/i }).first(),
      forma: 'circulo',
    },
    {
      accion: abrirGestion,
      titulo: 'Paso 2 — "Renovar"',
      msg: 'Toca "Gestión" y luego "Renovar". El sistema toma el saldo que debe y lo suma al nuevo préstamo, sin cuadres raros en la caja.',
      resaltar: (p) => p.getByRole('button', { name: /^Renovar$/i }).first(),
      forma: 'circulo',
    },
    {
      accion: async (p) => {
        await abrirGestion(p)
        await p.getByRole('button', { name: /^Renovar$/i }).first().click().catch(()=>{})
        await p.waitForTimeout(2000)
      },
      titulo: 'Paso 3 — Monto a entregar',
      msg: 'Indica cuánto le entregas de más y el nuevo plazo/tasa. El sistema calcula el total a pagar (saldo viejo + lo nuevo) y crea el préstamo renovado.',
      resaltar: (p) => p.getByRole('textbox').first(),
      forma: 'rect',
    },
  ],
}
