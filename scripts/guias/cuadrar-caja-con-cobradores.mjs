const BASE = 'https://app.control-finanzas.com'

const abrirCuadre = async (p) => {
  await p.goto(`${BASE}/caja`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3500)
  await p.getByText('Cuadre del día', { exact: false }).first().click().catch(()=>{})
  await p.waitForTimeout(1800)
}

export const def = {
  slug: 'cuadrar-caja-con-cobradores',
  login: true,
  pasos: [
    {
      goto: '/caja',
      titulo: 'Paso 1 — Entra a "Caja"',
      msg: 'Al final del día comparas lo que cada cobrador entregó con lo que el sistema esperaba. Eso es cuadrar la caja con tus cobradores.',
      resaltar: (p) => p.getByText('Cuadre del día', { exact: false }).first(),
      forma: 'circulo',
    },
    {
      accion: abrirCuadre,
      titulo: 'Paso 2 — Filtra "Con diferencia"',
      msg: 'En "Cuadre del día" usa la pestaña "Con diferencia" para ver solo los cobradores cuyo dinero NO cuadra (sobrante o faltante).',
      resaltar: (p) => p.getByText('Con diferencia', { exact: false }).first(),
      forma: 'circulo',
    },
    {
      accion: abrirCuadre,
      titulo: 'Paso 3 — Revisa y confirma',
      msg: 'En cada cobrador ves "recibido / sistema" y la diferencia. Habla con él si hay descuadre y toca "Confirmar" cuando quede claro. Los que cuadran exacto puedes confirmarlos todos juntos.',
      resaltar: (p) => p.getByRole('button', { name: /^Confirmar$/i }).first(),
      forma: 'circulo',
    },
  ],
}
