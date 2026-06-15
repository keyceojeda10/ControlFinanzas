const BASE = 'https://app.control-finanzas.com'

const abrirCuadre = async (p) => {
  await p.goto(`${BASE}/caja`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3500)
  await p.getByText('Cuadre del día', { exact: false }).first().click().catch(()=>{})
  await p.waitForTimeout(1800)
}

export const def = {
  slug: 'cerrar-caja',
  login: true,
  pasos: [
    {
      goto: '/caja',
      titulo: 'Paso 1 — Entra a "Caja"',
      msg: 'Cerrar la caja del día = confirmar el cuadre de tus cobradores. Después de cerrar, el día queda sellado en el historial.',
      resaltar: (p) => p.getByText('Cuadre del día', { exact: false }).first(),
      forma: 'circulo',
    },
    {
      accion: abrirCuadre,
      titulo: 'Paso 2 — "Cuadre del día"',
      msg: 'Toca "Cuadre del día". Ahí ves cuántos cobradores ya cuadraron (ej: 0/6) y el total recibido vs lo que esperaba el sistema.',
      resaltar: (p) => p.getByText(/CUADRE DEL D.A/i).first(),
      forma: 'rect',
    },
    {
      accion: abrirCuadre,
      titulo: 'Paso 3 — Confirma y cierra',
      msg: 'Si todos cuadran, toca "Confirmar … cobradores que cuadran exacto" para cerrar de una. O confirma uno por uno con su botón "Confirmar". Tip: cada cobrador también cierra su caja desde su cuenta.',
      resaltar: (p) => p.getByRole('button', { name: /Confirmar.*cobradores|Confirmar/i }).first(),
      forma: 'circulo',
    },
  ],
}
