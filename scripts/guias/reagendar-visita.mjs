const abrirCliente = async (p) => {
  await p.goto('https://app.control-finanzas.com/clientes', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3500)
  await p.getByText('Prueba hoy', { exact: false }).first().click().catch(()=>{})
  await p.waitForTimeout(3500)
}

export const def = {
  slug: 'reagendar-visita',
  login: true,
  pasos: [
    {
      accion: async (p) => { await abrirCliente(p) },
      titulo: 'Paso 1 — Abre el cliente',
      msg: 'Entra a "Clientes" y toca el cliente al que quieres mover la próxima visita de cobro.',
      resaltar: (p) => p.getByText('Prueba hoy', { exact: false }).first(),
      forma: 'rect',
    },
    {
      accion: async (p) => { await abrirCliente(p) },
      titulo: 'Paso 2 — Toca "Reagendar visita"',
      msg: 'Usa "Reagendar visita" para cambiar la fecha del próximo cobro sin afectar el plan de pagos (ej: el cliente avisó que paga otro día).',
      resaltar: (p) => p.getByRole('button', { name: /Reagendar/i }).first(),
      forma: 'circulo',
    },
    {
      accion: async (p) => {
        await abrirCliente(p)
        await p.getByRole('button', { name: /Reagendar/i }).first().click().catch(()=>{})
        await p.waitForTimeout(2000)
      },
      titulo: 'Paso 3 — Elige la nueva fecha',
      msg: 'Marca el motivo (no estaba, pidió plazo, etc.) y la nueva fecha: mañana, próximo día hábil o una fecha específica. Confirma con "Reagendar visita".',
      resaltar: (p) => p.getByRole('button', { name: /Reagendar|Guardar|Confirmar/i }).last(),
      forma: 'circulo',
    },
  ],
}
