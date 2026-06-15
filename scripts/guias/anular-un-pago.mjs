import { abrirPrestamo } from './_helpers.mjs'

// Abre el detalle, expande HISTORIAL DE PAGOS y baja hasta los pagos
const abrirHistorial = async (p) => {
  await abrirPrestamo(p)
  await p.getByText(/HISTORIAL DE PAGOS/i).first().click().catch(()=>{})
  await p.waitForTimeout(1500)
  // baja hasta el primer pago de la lista (boton de anular es un icono con title)
  await p.locator('[title="Anular pago"]').first().scrollIntoViewIfNeeded().catch(()=>{})
  await p.waitForTimeout(600)
}

export const def = {
  slug: 'anular-un-pago',
  login: true,
  pasos: [
    {
      accion: abrirPrestamo,
      titulo: 'Paso 1 — Abre el préstamo',
      msg: 'En "Préstamos", toca el préstamo donde registraste un pago por error.',
      resaltar: (p) => p.getByText('Carlitos', { exact: false }).first(),
      forma: 'rect',
    },
    {
      accion: abrirHistorial,
      titulo: 'Paso 2 — Abre "Historial de pagos"',
      msg: 'Baja y toca "Historial de pagos". Cada pago muestra sus acciones: ver comprobante, editar fecha y anular.',
      resaltar: (p) => p.locator('[title="Anular pago"]').first(),
      forma: 'circulo',
    },
    {
      accion: async (p) => {
        await abrirHistorial(p)
        await p.locator('[title="Anular pago"]').first().click().catch(()=>{})
        await p.waitForTimeout(1500)
      },
      titulo: 'Paso 3 — Confirma la anulación',
      msg: 'Toca el ícono de la papelera ("Anular pago") y confirma. El abono se borra y el saldo del préstamo y la caja se recalculan solos.',
      resaltar: (p) => p.getByRole('button', { name: /^Anular$/i }).last(),
      forma: 'circulo',
    },
  ],
}
