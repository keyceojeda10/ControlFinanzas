import { generarGuia } from './motor.mjs'

const abrirRuta = async (p) => {
  await p.getByText('Ruta de Carlos perez', { exact: false }).first().click()
  await p.waitForTimeout(3500)
}

await generarGuia({
  slug: 'organizar-ruta',
  login: true,
  pasos: [
    {
      goto: '/rutas',
      titulo: 'Paso 1 — Abre la ruta',
      msg: 'En "Rutas", toca la ruta que quieres organizar.',
      resaltar: (p) => p.getByText('Ruta de Carlos perez', { exact: false }).first(),
      forma: 'rect',
    },
    {
      accion: async (p) => { await abrirRuta(p); await p.evaluate(() => window.scrollTo(0, 720)); await p.waitForTimeout(500) },
      titulo: 'Paso 2 — Ordenar ruta',
      msg: 'Toca la pestaña "Ordenar ruta" para cambiar el orden en que visitas a los clientes.',
      resaltar: (p) => p.getByText('Ordenar ruta', { exact: false }).first(),
      forma: 'rect',
    },
    {
      goto: '/rutas',
      accion: async (p) => { await abrirRuta(p); await p.evaluate(() => window.scrollTo(0, 560)); await p.waitForTimeout(500) },
      titulo: 'Paso 3 — Optimizar automático',
      msg: 'O toca "Optimizar" para que el sistema ordene la ruta solo, por cercanía (necesita la ubicación de los clientes).',
      resaltar: (p) => p.getByText('Optimizar', { exact: false }).first(),
      forma: 'rect',
    },
  ],
})
