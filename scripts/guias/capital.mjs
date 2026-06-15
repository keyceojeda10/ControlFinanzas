import { generarGuia } from './motor.mjs'

await generarGuia({
  slug: 'capital',
  login: true,
  pasos: [
    {
      goto: '/capital',
      titulo: 'Paso 1 — Tu capital',
      msg: 'Entra a "Capital" (en el menú de herramientas). Aquí ves tu fondo: el dinero disponible para prestar.',
      resaltar: (p) => p.getByText(/SALDO DEL CAPITAL/i).first(),
      forma: 'rect',
    },
    {
      goto: '/capital',
      titulo: 'Paso 2 — Agregar o retirar plata',
      msg: 'Toca "+ Movimiento" para registrar cuando metes más dinero al negocio o cuando sacas plata.',
      resaltar: (p) => p.getByText(/\+ Movimiento|Movimiento/i).first(),
      forma: 'rect',
    },
    {
      goto: '/capital',
      accion: async (p) => { await p.evaluate(() => window.scrollTo(0, 520)); await p.waitForTimeout(500) },
      titulo: 'Paso 3 — Capital por ruta',
      msg: 'Si manejas rutas, cada una tiene su propio dinero. Con "Agregar dinero" / "Retirar dinero" mueves plata de esa ruta específica.',
      resaltar: (p) => p.getByText('Agregar dinero', { exact: false }).first(),
      forma: 'rect',
    },
  ],
})
