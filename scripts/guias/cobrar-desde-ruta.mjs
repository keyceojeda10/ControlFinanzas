import { generarGuia } from './motor.mjs'

const abrirRuta = async (p) => {
  await p.getByText('Ruta de Carlos perez', { exact: false }).first().click()
  await p.waitForTimeout(3500)
}

await generarGuia({
  slug: 'cobrar-desde-ruta',
  login: true,
  pasos: [
    {
      goto: '/rutas',
      titulo: 'Paso 1 — Abre tu ruta',
      msg: 'En "Rutas", toca la ruta que vas a cobrar hoy.',
      resaltar: (p) => p.getByText('Ruta de Carlos perez', { exact: false }).first(),
      forma: 'rect',
    },
    {
      accion: async (p) => { await abrirRuta(p); await p.evaluate(() => window.scrollTo(0, 720)); await p.waitForTimeout(500) },
      titulo: 'Paso 2 — Trabajo del día',
      msg: 'Toca la pestaña "Trabajo del día". Ahí ves la lista de clientes que toca cobrar hoy, en orden.',
      resaltar: (p) => p.getByText('Trabajo del día', { exact: false }).first(),
      forma: 'rect',
    },
    {
      goto: '/rutas',
      accion: async (p) => { await abrirRuta(p); await p.evaluate(() => window.scrollTo(0, 760)); await p.waitForTimeout(500) },
      titulo: 'Paso 3 — Cobra cliente por cliente',
      msg: 'Toca cada cliente para registrar su pago del día. Funciona sin internet: lo cobras en la calle y se sincroniza al volver la señal.',
      // resaltar la zona de clientes (primer cliente de la lista)
      resaltar: (p) => p.getByText(/PRÓXIMOS Y AL D|Próximos/i).first(),
      forma: 'rect',
    },
    {
      goto: '/rutas',
      accion: async (p) => { await abrirRuta(p); await p.evaluate(() => window.scrollTo(0, 99999)); await p.waitForTimeout(500) },
      titulo: 'Paso 4 — Cierre de caja',
      msg: 'Al terminar el recorrido, toca "Registrar cierre de caja" para cuadrar lo que recogiste en la ruta.',
      resaltar: (p) => p.getByText(/Registrar cierre de caja/i).first(),
      forma: 'rect',
    },
  ],
})
