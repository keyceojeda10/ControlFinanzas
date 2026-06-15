const BASE = 'https://app.control-finanzas.com'

export const def = {
  slug: 'agregar-mi-gasto',
  login: true,
  pasos: [
    {
      goto: '/gastos',
      titulo: 'Paso 1 — Entra a "Gastos"',
      msg: 'En "Gastos" registras los gastos del negocio. Para anotar uno tuyo (no de un cobrador), usa el botón "Mi gasto".',
      resaltar: (p) => p.getByRole('button', { name: /Mi gasto/i }).first(),
      forma: 'circulo',
    },
    {
      goto: '/gastos',
      accion: async (p) => {
        await p.getByRole('button', { name: /Mi gasto/i }).first().click().catch(()=>{})
        await p.waitForTimeout(2000)
      },
      titulo: 'Paso 2 — Tipo de gasto',
      msg: 'Se abre "Reportar gasto menor". Elige el tipo (gasolina, reparación, otro...). Deja "Mi gasto (sin cobrador)" para que sea tuyo.',
      resaltar: (p) => p.getByText('TIPO DE GASTO', { exact: false }).first(),
      forma: 'rect',
    },
    {
      goto: '/gastos',
      accion: async (p) => {
        await p.getByRole('button', { name: /Mi gasto/i }).first().click().catch(()=>{})
        await p.waitForTimeout(2000)
      },
      titulo: 'Paso 3 — Monto y guarda',
      msg: 'Escribe el monto del gasto y toca "Registrar". Queda registrado al instante y el saldo de capital se actualiza solo.',
      resaltar: (p) => p.getByText('Monto', { exact: false }).first(),
      forma: 'rect',
    },
  ],
}
