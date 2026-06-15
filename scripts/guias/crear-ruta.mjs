import { generarGuia } from './motor.mjs'

await generarGuia({
  slug: 'crear-ruta',
  login: true,
  pasos: [
    {
      goto: '/rutas',
      titulo: 'Paso 1 — Nueva ruta',
      msg: 'Entra a "Rutas" desde el menú (icono del mapa) y toca "Nueva ruta".',
      resaltar: (p) => p.getByRole('button', { name: /Nueva ruta/i }).first(),
      forma: 'rect',
    },
    {
      accion: async (p) => {
        await p.getByRole('button', { name: /Nueva ruta/i }).first().click()
        await p.waitForTimeout(2500)
      },
      titulo: 'Paso 2 — Datos de la ruta',
      msg: 'Ponle un nombre a la ruta (ej: "Centro", "Lunes"), asígnale un cobrador si tienes, y guarda.',
      // el primer input del formulario de nueva ruta (nombre)
      resaltar: (p) => p.locator('input').first(),
      forma: 'rect',
    },
    {
      goto: '/rutas',
      accion: async (p) => {
        await p.getByText('Ruta de Carlos perez', { exact: false }).first().click()
        await p.waitForTimeout(3500)
        await p.evaluate(() => window.scrollTo(0, 520))
        await p.waitForTimeout(500)
      },
      titulo: 'Paso 3 — Agregar clientes a la ruta',
      msg: 'Abre la ruta y toca "+ Agregar" para meterle los clientes que vas a cobrar en ella.',
      resaltar: (p) => p.getByText('+ Agregar', { exact: false }).first(),
      forma: 'rect',
    },
  ],
})
