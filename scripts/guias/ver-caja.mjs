import { generarGuia } from './motor.mjs'

await generarGuia({
  slug: 'ver-caja',
  login: true,
  pasos: [
    {
      goto: '/dashboard',
      titulo: 'Paso 1 — Abre la Caja',
      msg: 'Desde el inicio toca "Ver caja" (o el icono de $ en el menú de abajo). Ahí ves el efectivo que entró y salió hoy.',
      resaltar: (p) => p.getByText('Ver caja', { exact: false }).first(),
      forma: 'rect',
    },
    {
      goto: '/caja',
      titulo: 'Paso 2 — Tu saldo en caja',
      msg: 'Arriba ves el SALDO EN CAJA = base inicial + cobrado − prestado − gastos. Es la plata que tienes ahora.',
      resaltar: (p) => p.getByText(/SALDO EN CAJA/i).first(),
      forma: 'rect',
    },
    {
      goto: '/caja',
      titulo: 'Paso 3 — Cambia la vista',
      msg: 'Con las pestañas eliges "Caja del día", "Caja por ruta" (ver cada ruta aparte) o "Cuadre del día".',
      resaltar: (p) => p.getByText('Caja por ruta', { exact: false }).first(),
      forma: 'rect',
    },
    {
      goto: '/caja',
      titulo: 'Paso 4 — Filtra por fecha',
      msg: 'Puedes ver la caja de Hoy, Ayer, 7 días, 30 días o un rango personalizado.',
      resaltar: (p) => p.getByText('30 días', { exact: false }).first(),
      forma: 'rect',
    },
    {
      goto: '/caja',
      accion: async (p) => { await p.evaluate(() => window.scrollTo(0, 430)); await p.waitForTimeout(500) },
      titulo: 'Paso 5 — Cerrar la caja del día',
      msg: 'Al final del día, escribe cuánto recogiste y toca "Cierre del día". El sistema compara con lo registrado y avisa si hay diferencia.',
      resaltar: (p) => p.getByText(/Cierre del d|Cerrar d/i).first(),
      forma: 'rect',
    },
  ],
})
