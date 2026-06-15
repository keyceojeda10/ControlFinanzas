const abrirCliente = async (p) => {
  await p.goto('https://app.control-finanzas.com/clientes', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3500)
  await p.getByText('Prueba hoy', { exact: false }).first().click().catch(()=>{})
  await p.waitForTimeout(3500)
}

export const def = {
  slug: 'editar-cliente',
  login: true,
  pasos: [
    {
      accion: async (p) => { await abrirCliente(p) },
      titulo: 'Paso 1 — Abre el cliente',
      msg: 'Entra a "Clientes" y toca el cliente que quieres editar para ver su ficha.',
      resaltar: (p) => p.getByText('Prueba hoy', { exact: false }).first(),
      forma: 'rect',
    },
    {
      accion: async (p) => { await abrirCliente(p) },
      titulo: 'Paso 2 — Toca "Editar"',
      msg: 'En la ficha del cliente, toca el botón "Editar" para cambiar nombre, teléfono, dirección o referencia.',
      resaltar: (p) => p.getByRole('button', { name: /^Editar$/i }).first(),
      forma: 'circulo',
    },
    {
      accion: async (p) => {
        await abrirCliente(p)
        await p.getByRole('button', { name: /^Editar$/i }).first().click().catch(()=>{})
        await p.waitForTimeout(2500)
      },
      titulo: 'Paso 3 — Cambia y guarda',
      msg: 'Es un asistente de 3 pasos. Cambia nombre, cédula, teléfono o dirección y toca "Continuar" en cada paso; al final se guarda todo.',
      resaltar: (p) => p.getByRole('textbox').first(),
      forma: 'rect',
    },
  ],
}
