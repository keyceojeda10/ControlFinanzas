import { generarGuia } from './motor.mjs'

await generarGuia({
  slug: 'registrar-pago',
  login: true,
  pasos: [
    {
      goto: '/prestamos',
      titulo: 'Paso 1 — Abre el préstamo',
      msg: 'En "Préstamos", toca el cliente al que le vas a registrar el pago.',
      resaltar: (p) => p.getByText('Prueba hoy', { exact: false }).first(),
      forma: 'rect',
    },
    {
      accion: async (p) => {
        await p.getByText('Prueba hoy', { exact: false }).first().click()
        await p.waitForTimeout(3500)
      },
      titulo: 'Paso 2 — Toca "Cobros"',
      msg: 'En la pantalla del préstamo, toca "Cobros" para registrar el pago del día o un abono.',
      resaltar: (p) => p.getByText('Cobros', { exact: false }).first(),
      forma: 'rect',
    },
    {
      accion: async (p) => {
        await p.getByText('Cobros', { exact: false }).first().click()
        await p.waitForTimeout(2000)
      },
      titulo: 'Paso 3 — Registra el cobro',
      msg: 'Elige el tipo de cobro. "Hacer abono extraordinario" sirve para registrar un pago. Pon el monto y confirma.',
      resaltar: (p) => p.getByText(/abono extraordinario/i).first(),
      forma: 'rect',
    },
    {
      goto: '/prestamos',
      accion: async (p) => {
        await p.getByText('Prueba hoy', { exact: false }).first().click()
        await p.waitForTimeout(3500)
        await p.evaluate(() => window.scrollTo(0, 99999))
        await p.waitForTimeout(500)
      },
      titulo: 'Paso 4 — Enviar el recibo',
      msg: 'Después de registrar el pago, toca "Enviar resumen por WhatsApp" para mandarle el recibo al cliente con un toque.',
      resaltar: (p) => p.getByText(/Enviar resumen por WhatsApp/i).first(),
      forma: 'rect',
    },
  ],
})
