const BASE = 'https://app.control-finanzas.com'

const abrirHistorial = async (p) => {
  await p.goto(`${BASE}/caja`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3500)
  await p.getByText(/HISTORIAL DE CIERRES/i).first().click().catch(()=>{})
  await p.waitForTimeout(1500)
  await p.getByText(/HISTORIAL DE CIERRES/i).first().scrollIntoViewIfNeeded().catch(()=>{})
  await p.waitForTimeout(600)
}

export const def = {
  slug: 'reabrir-caja',
  login: true,
  pasos: [
    {
      goto: '/caja',
      titulo: 'Paso 1 — Entra a "Caja"',
      msg: 'Si cerraste una caja por error o necesitas corregir algo de un día ya cerrado, puedes reabrirla.',
      resaltar: (p) => p.getByText(/HISTORIAL DE CIERRES/i).first(),
      forma: 'rect',
    },
    {
      accion: abrirHistorial,
      titulo: 'Paso 2 — "Historial de cierres"',
      msg: 'Abre "Historial de cierres". Ahí están las cajas ya cerradas, por día y por cobrador.',
      resaltar: (p) => p.getByText(/HISTORIAL DE CIERRES/i).first(),
      forma: 'circulo',
    },
    {
      accion: abrirHistorial,
      titulo: 'Paso 3 — Reabre el cierre',
      msg: 'En la lista de cierres, sobre el día que quieres corregir aparece la opción "Reabrir". Tócala: podrás editar pagos o gastos de ese día y volver a cerrarlo.',
      resaltar: (p) => p.getByText(/HISTORIAL DE CIERRES|cierre|cobrador/i).first(),
      forma: null,
    },
  ],
}
