const BASE = 'https://app.control-finanzas.com'

const abrirPendientes = async (p) => {
  await p.goto(`${BASE}/gastos`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3500)
  await p.getByText('Pendientes', { exact: false }).first().click().catch(()=>{})
  await p.waitForTimeout(1500)
}

export const def = {
  slug: 'aprobar-rechazar-gastos-cobradores',
  login: true,
  pasos: [
    {
      goto: '/gastos',
      titulo: 'Paso 1 — Entra a "Gastos"',
      msg: 'Tus cobradores reportan gastos desde su cuenta (viáticos, imprevistos). Tú los apruebas o rechazas aquí.',
      resaltar: (p) => p.getByText('Pendientes', { exact: false }).first(),
      forma: 'circulo',
    },
    {
      accion: abrirPendientes,
      titulo: 'Paso 2 — Pestaña "Pendientes"',
      msg: 'Toca "Pendientes". Ahí aparecen los gastos que esperan tu visto bueno, con monto, concepto y cobrador.',
      resaltar: (p) => p.getByText('Pendientes', { exact: false }).first(),
      forma: 'rect',
    },
    {
      accion: abrirPendientes,
      titulo: 'Paso 3 — Aprueba o rechaza',
      msg: 'En cada gasto tienes "Aprobar" o "Rechazar". Si apruebas, el saldo de capital baja automáticamente. Si rechazas, no afecta la caja.',
      resaltar: (p) => p.getByText(/No hay gastos pendientes|Aprobar|Rechazar/i).first(),
      forma: null,
    },
  ],
}
