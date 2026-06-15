const BASE = 'https://app.control-finanzas.com'

export const def = {
  slug: 'hacer-ajuste-caja',
  login: true,
  pasos: [
    {
      goto: '/caja',
      titulo: 'Paso 1 — Entra a "Caja"',
      msg: 'Si el dinero físico no coincide con lo que muestra el sistema, puedes corregirlo con un ajuste, sin tener que cuadrar a mano.',
      resaltar: (p) => p.getByText(/SALDO EN CAJA/i).first(),
      forma: 'rect',
    },
    {
      goto: '/caja',
      accion: async (p) => {
        await p.getByRole('button', { name: /Ajustar saldo/i }).first().scrollIntoViewIfNeeded().catch(()=>{})
        await p.waitForTimeout(600)
      },
      titulo: 'Paso 2 — "Ajustar saldo general"',
      msg: 'Baja y toca "Ajustar saldo general". Sirve para corregir un descuadre (sobrante o faltante) que no viene de un cobro o gasto.',
      resaltar: (p) => p.getByRole('button', { name: /Ajustar saldo/i }).first(),
      forma: 'circulo',
    },
    {
      goto: '/caja',
      accion: async (p) => {
        await p.getByRole('button', { name: /Ajustar saldo/i }).first().click().catch(()=>{})
        await p.waitForTimeout(2000)
      },
      titulo: 'Paso 3 — Ingreso/Egreso y monto',
      msg: 'Elige "Ingreso" si en la caja sobra plata o "Egreso" si falta, escribe el monto y el motivo. Toca "Guardar movimiento": la caja queda cuadrada.',
      resaltar: (p) => p.getByRole('button', { name: /Guardar movimiento|Guardar|Confirmar/i }).last(),
      forma: 'circulo',
    },
  ],
}
