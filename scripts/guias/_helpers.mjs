// Helpers compartidos por las guias de prestamos.
const BASE = 'https://app.control-finanzas.com'

// Abre el detalle de un prestamo (toca la card de "Carlitos" en /prestamos).
export const abrirPrestamo = async (p) => {
  await p.goto(`${BASE}/prestamos`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3500)
  await p.getByText('Carlitos', { exact: false }).first().click().catch(()=>{})
  await p.waitForTimeout(3500)
}

// Abre el detalle y luego el sheet "Gestión del préstamo".
export const abrirGestion = async (p) => {
  await abrirPrestamo(p)
  await p.getByRole('button', { name: /Gesti.n/i }).first().click().catch(()=>{})
  await p.waitForTimeout(2000)
}
