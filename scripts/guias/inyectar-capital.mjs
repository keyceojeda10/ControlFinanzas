const BASE = 'https://app.control-finanzas.com'

const abrirMovimiento = async (p) => {
  await p.goto(`${BASE}/capital`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3500)
  await p.getByRole('button', { name: /Movimiento/i }).first().click().catch(()=>{})
  await p.waitForTimeout(1800)
}

export const def = {
  slug: 'inyectar-capital',
  login: true,
  pasos: [
    {
      goto: '/capital',
      titulo: 'Paso 1 — Entra a "Capital"',
      msg: 'Capital es el dinero de tu negocio. Cuando metes plata propia para prestar más, la registras aquí para que la caja cuadre.',
      resaltar: (p) => p.getByText('SALDO DEL CAPITAL', { exact: false }).first(),
      forma: 'rect',
    },
    {
      goto: '/capital',
      titulo: 'Paso 2 — Toca "Movimiento"',
      msg: 'Toca "+ Movimiento" para registrar un ingreso de dinero al capital.',
      resaltar: (p) => p.getByRole('button', { name: /Movimiento/i }).first(),
      forma: 'circulo',
    },
    {
      accion: abrirMovimiento,
      titulo: 'Paso 3 — "Agregar dinero" y monto',
      msg: 'En "Tipo" deja "Agregar dinero", escribe el monto que estás metiendo y un motivo. Toca "Registrar": tu saldo disponible para prestar sube.',
      resaltar: (p) => p.getByText('Agregar dinero', { exact: false }).first(),
      forma: 'rect',
    },
  ],
}
