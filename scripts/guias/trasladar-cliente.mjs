const BASE = 'https://app.control-finanzas.com'

const abrirRuta = async (p) => {
  await p.goto(`${BASE}/rutas`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3500)
  await p.getByText('Ruta de Carlos perez', { exact: false }).first().click().catch(()=>{})
  await p.waitForTimeout(3500)
}

export const def = {
  slug: 'trasladar-cliente',
  login: true,
  pasos: [
    {
      goto: '/rutas',
      titulo: 'Paso 1 — Abre la ruta destino',
      msg: 'Para mover un cliente a otra ruta, entra a "Rutas" y abre la ruta a la que lo quieres pasar.',
      resaltar: (p) => p.getByText('Ruta de Carlos perez', { exact: false }).first(),
      forma: 'rect',
    },
    {
      accion: async (p) => {
        await abrirRuta(p)
        await p.getByRole('button', { name: /\+ Agregar|Agregar/i }).first().scrollIntoViewIfNeeded().catch(()=>{})
        await p.waitForTimeout(600)
      },
      titulo: 'Paso 2 — Toca "+ Agregar"',
      msg: 'Dentro de la ruta, toca "+ Agregar". Verás los clientes sin ruta y también los que están en otra ruta.',
      resaltar: (p) => p.getByRole('button', { name: /\+ Agregar|Agregar/i }).first(),
      forma: 'circulo',
    },
    {
      accion: async (p) => {
        await abrirRuta(p)
        await p.getByRole('button', { name: /\+ Agregar|Agregar/i }).first().click().catch(()=>{})
        await p.waitForTimeout(2000)
      },
      titulo: 'Paso 3 — Elige y mueve',
      msg: 'Busca el cliente (aparece bajo "Ya en otra ruta"), márcalo y confirma. Queda movido a esta ruta con todo su historial.',
      resaltar: (p) => p.getByText(/Ya en otra ruta|Agregar clientes a la ruta/i).first(),
      forma: null,
    },
  ],
}
