const abrirCliente = async (p) => {
  await p.goto('https://app.control-finanzas.com/clientes', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3500)
  await p.getByText('Prueba hoy', { exact: false }).first().click().catch(()=>{})
  await p.waitForTimeout(3500)
}

export const def = {
  slug: 'inactivar-cliente',
  login: true,
  pasos: [
    {
      accion: async (p) => { await abrirCliente(p) },
      titulo: 'Paso 1 — Abre el cliente',
      msg: 'Entra a "Clientes" y toca el cliente que quieres pausar para abrir su ficha.',
      resaltar: (p) => p.getByText('Prueba hoy', { exact: false }).first(),
      forma: 'rect',
    },
    {
      accion: async (p) => { await abrirCliente(p) },
      titulo: 'Paso 2 — Toca "Inactivar"',
      msg: '"Inactivar" oculta al cliente de tus listas sin borrar nada. Útil cuando dejó de pagar o no quieres prestarle por ahora. Puedes reactivarlo cuando quieras.',
      resaltar: (p) => p.getByRole('button', { name: /^Inactivar$/i }).first(),
      forma: 'circulo',
    },
    {
      accion: async (p) => {
        await abrirCliente(p)
        await p.getByRole('button', { name: /^Inactivar$/i }).first().click().catch(()=>{})
        await p.waitForTimeout(2000)
      },
      titulo: 'Paso 3 — Confirma',
      msg: 'Confirma para inactivar. El cliente y su historial quedan guardados; solo deja de aparecer en las listas activas.',
      resaltar: (p) => p.getByRole('button', { name: /Inactivar|Confirmar|S.,/i }).last(),
      forma: 'circulo',
    },
  ],
}
