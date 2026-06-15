import { generarGuia } from './motor.mjs'

// Selecciona el primer cliente reciente y avanza al paso 2 del formulario
async function elegirClienteYContinuar(page) {
  await page.getByText('Prueba hoy', { exact: false }).first().click()
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: /Continuar/i }).click()
  await page.waitForTimeout(2500)
}

await generarGuia({
  slug: 'crear-prestamo',
  login: true,
  pasos: [
    {
      goto: '/dashboard',
      titulo: 'Paso 1 — Abrir nuevo préstamo',
      msg: 'Toca el botón + (amarillo, abajo a la derecha) y elige "Nuevo préstamo".',
      resaltar: (p) => p.getByRole('button', { name: /Acciones r/i }).first(),
      forma: 'circulo',
    },
    {
      goto: '/prestamos/nuevo',
      titulo: 'Paso 2 — Elegir el cliente',
      msg: 'Busca el cliente por nombre o cédula, o toca uno de los recientes. Luego "Continuar".',
      resaltar: (p) => p.getByText('Prueba hoy', { exact: false }).first(),
      forma: 'rect',
    },
    {
      accion: elegirClienteYContinuar,
      titulo: 'Paso 3 — Monto e interés',
      msg: 'Escribe el monto que prestas y el % de interés mensual que cobras.',
      resaltar: (p) => p.locator('input').first(),
      forma: 'rect',
    },
    {
      titulo: 'Paso 4 — Personalizar (opcional pero útil)',
      msg: 'Toca "Personalizar préstamo" para elegir la frecuencia (diario, semanal, etc.), la fecha y más.',
      resaltar: (p) => p.getByText(/Personalizar pr/i).first(),
      forma: 'rect',
    },
    {
      accion: async (p) => { await p.getByText(/Personalizar pr/i).first().click() },
      scrollTo: 380,
      titulo: 'Paso 5 — Frecuencia, plazo y fecha',
      msg: 'Elige cómo cobras el interés, la frecuencia, el plazo y la fecha de inicio. Aquí también está "Días sin cobro".',
    },
    {
      scrollTo: 99999,
      titulo: 'Paso 6 — Crear el préstamo',
      msg: 'Revisa todo y toca "Crear préstamo". ¡Listo, ya quedó registrado!',
      resaltar: (p) => p.getByRole('button', { name: /Crear pr/i }).first(),
      forma: 'rect',
    },
  ],
})
