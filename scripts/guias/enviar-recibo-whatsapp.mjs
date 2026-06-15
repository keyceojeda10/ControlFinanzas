import { abrirPrestamo } from './_helpers.mjs'

export const def = {
  slug: 'enviar-recibo-whatsapp',
  login: true,
  pasos: [
    {
      accion: abrirPrestamo,
      titulo: 'Paso 1 — Abre el préstamo',
      msg: 'En "Préstamos", toca el préstamo del cliente al que quieres mandarle su recibo o resumen.',
      resaltar: (p) => p.getByText('Carlitos', { exact: false }).first(),
      forma: 'rect',
    },
    {
      accion: async (p) => {
        await abrirPrestamo(p)
        await p.getByText('Enviar resumen por WhatsApp', { exact: false }).first().scrollIntoViewIfNeeded().catch(()=>{})
        await p.waitForTimeout(800)
      },
      titulo: 'Paso 2 — "Enviar resumen por WhatsApp"',
      msg: 'Baja hasta el botón "Enviar resumen por WhatsApp". Genera el resumen del préstamo (saldo, cuota, próximo cobro) listo para enviar.',
      resaltar: (p) => p.getByText('Enviar resumen por WhatsApp', { exact: false }).first(),
      forma: 'circulo',
    },
    {
      accion: async (p) => {
        await abrirPrestamo(p)
        await p.getByText('Enviar resumen por WhatsApp', { exact: false }).first().click().catch(()=>{})
        await p.waitForTimeout(2500)
      },
      titulo: 'Paso 3 — Se abre WhatsApp',
      msg: 'Se abre WhatsApp con el mensaje ya escrito al número del cliente. Solo revisa y toca enviar. Si no tiene celular guardado, agrégalo primero en su ficha.',
      resaltar: (p) => p.getByText(/WhatsApp|Enviar|recibo|comprobante/i).first(),
      forma: null,
    },
  ],
}
