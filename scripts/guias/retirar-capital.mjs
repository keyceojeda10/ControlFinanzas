const BASE = 'https://app.control-finanzas.com'

const abrirMovimiento = async (p) => {
  await p.goto(`${BASE}/capital`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3500)
  await p.getByRole('button', { name: /Movimiento/i }).first().click().catch(()=>{})
  await p.waitForTimeout(1800)
}

export const def = {
  slug: 'retirar-capital',
  login: true,
  pasos: [
    {
      goto: '/capital',
      titulo: 'Paso 1 — Entra a "Capital"',
      msg: 'Cuando sacas plata del negocio (ganancia, gasto personal, retiro), regístralo aquí para que tu capital refleje el dinero real.',
      resaltar: (p) => p.getByText('SALDO DEL CAPITAL', { exact: false }).first(),
      forma: 'rect',
    },
    {
      goto: '/capital',
      titulo: 'Paso 2 — Toca "Movimiento"',
      msg: 'Toca "+ Movimiento" para registrar una salida de dinero del capital.',
      resaltar: (p) => p.getByRole('button', { name: /Movimiento/i }).first(),
      forma: 'circulo',
    },
    {
      accion: abrirMovimiento,
      titulo: 'Paso 3 — "Tipo": Retirar dinero',
      msg: 'En el menú "Tipo" cámbialo a "Retirar dinero", escribe el monto que sacas y el motivo. Toca "Registrar": tu saldo de capital baja.',
      resaltar: (p) => p.getByText('Agregar dinero', { exact: false }).first(),
      forma: 'circulo',
    },
  ],
}
