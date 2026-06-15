import { generarGuia } from './motor.mjs'

const abrirPrestamo = async (p) => {
  await p.getByText('Prueba hoy', { exact: false }).first().click()
  await p.waitForTimeout(3500)
}

await generarGuia({
  slug: 'editar-eliminar-prestamo',
  login: true,
  pasos: [
    {
      goto: '/prestamos',
      titulo: 'Paso 1 — Abre el préstamo',
      msg: 'En "Préstamos", toca el préstamo que quieres editar o eliminar.',
      resaltar: (p) => p.getByText('Prueba hoy', { exact: false }).first(),
      forma: 'rect',
    },
    {
      accion: abrirPrestamo,
      titulo: 'Paso 2 — Toca "Gestión"',
      msg: 'En la pantalla del préstamo, toca "Gestión" (Renovar, plazo, ajustes).',
      resaltar: (p) => p.getByText('Gestión', { exact: false }).first(),
      forma: 'rect',
    },
    {
      accion: async (p) => {
        await p.getByText('Gestión', { exact: false }).first().click()
        await p.waitForTimeout(2000)
      },
      titulo: 'Paso 3 — Elige qué cambiar',
      msg: 'Aquí cambias las fechas con "Modificar plazo". NO hace falta eliminar el préstamo para corregirlo.',
      resaltar: (p) => p.getByText(/Modificar plazo/i).first(),
      forma: 'rect',
    },
    {
      goto: '/prestamos',
      accion: async (p) => {
        await abrirPrestamo(p)
        await p.getByText('Gestión', { exact: false }).first().click()
        await p.waitForTimeout(2000)
      },
      titulo: 'Paso 4 — Si el cliente paga todo antes',
      msg: 'Usa "Cerrar préstamo anticipado" para liquidar sin cobrar el interés que faltaba. NUNCA elimines el préstamo para esto (borra el historial).',
      resaltar: (p) => p.getByText(/Cerrar pr.stamo anticipado/i).first(),
      forma: 'rect',
    },
    {
      goto: '/prestamos',
      accion: async (p) => {
        await abrirPrestamo(p)
        await p.evaluate(() => window.scrollTo(0, 99999))
        await p.waitForTimeout(500)
      },
      titulo: 'Paso 5 — Eliminar (solo si es un error)',
      msg: 'Si de verdad necesitas borrarlo (fue un error), abajo del préstamo está "Cancelar préstamo". Ojo: esto sí borra el préstamo y sus pagos.',
      resaltar: (p) => p.getByText(/Cancelar pr.stamo/i).first(),
      forma: 'rect',
    },
  ],
})
