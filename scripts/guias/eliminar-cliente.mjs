const abrirCliente = async (p) => {
  await p.goto('https://app.control-finanzas.com/clientes', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3500)
  await p.getByText('Prueba hoy', { exact: false }).first().click().catch(()=>{})
  await p.waitForTimeout(3500)
}

export const def = {
  slug: 'eliminar-cliente',
  login: true,
  pasos: [
    {
      accion: async (p) => { await abrirCliente(p) },
      titulo: 'Paso 1 — Abre el cliente',
      msg: 'Entra a "Clientes" y toca el cliente que quieres eliminar para abrir su ficha.',
      resaltar: (p) => p.getByText('Prueba hoy', { exact: false }).first(),
      forma: 'rect',
    },
    {
      accion: async (p) => { await abrirCliente(p) },
      titulo: 'Paso 2 — Toca "Eliminar"',
      msg: 'En la ficha, toca "Eliminar". OJO: solo puedes eliminar clientes SIN préstamos activos. Si tiene préstamos, primero ciérralos o usa "Inactivar".',
      resaltar: (p) => p.getByRole('button', { name: /^Eliminar$/i }).first(),
      forma: 'circulo',
    },
    {
      accion: async (p) => {
        await abrirCliente(p)
        await p.getByRole('button', { name: /^Eliminar$/i }).first().click().catch(()=>{})
        await p.waitForTimeout(2000)
      },
      titulo: 'Paso 3 — Confirma',
      msg: 'El sistema te pide confirmar porque la eliminación es permanente. Confirma solo si estás seguro: se borra el cliente y su historial.',
      resaltar: (p) => p.getByRole('button', { name: /Eliminar|Confirmar|S.,/i }).last(),
      forma: 'circulo',
    },
  ],
}
