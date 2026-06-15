import { generarGuia } from './motor.mjs'

// Abre el menu "Mas" del bottom nav
const abrirMas = async (p) => {
  await p.getByRole('button', { name: /M(a|á)s opciones/i }).first().click()
  await p.waitForTimeout(1500)
}
// Lucas IA visible dentro del sheet (no el del FAB, que esta oculto)
const lucasEnSheet = (p) => p.locator('button:visible, a:visible').filter({ hasText: /^Lucas IA$/ }).first()

await generarGuia({
  slug: 'lucas-ia',
  login: true,
  pasos: [
    {
      goto: '/dashboard',
      accion: abrirMas,
      titulo: 'Paso 1 — Abre Lucas IA',
      msg: 'Toca el menú (icono de cuadritos, abajo) y elige "Lucas IA". Es tu asistente inteligente.',
      resaltar: lucasEnSheet,
      forma: 'rect',
    },
    {
      goto: '/dashboard',
      accion: async (p) => { await abrirMas(p); await lucasEnSheet(p).click(); await p.waitForTimeout(2500) },
      titulo: 'Paso 2 — Pregúntale lo que sea',
      msg: 'Escríbele o háblale por voz: "cuánto estoy ganando", "quién me debe más", "Pedro me pagó 50 mil" y registra el pago solo.',
      resaltar: null,
    },
    {
      goto: '/dashboard',
      accion: async (p) => { await abrirMas(p); await lucasEnSheet(p).click(); await p.waitForTimeout(2500) },
      titulo: 'Paso 3 — Preguntas rápidas',
      msg: 'Abajo tiene preguntas listas para tocar. Lucas está en los planes Crecimiento en adelante.',
      resaltar: (p) => p.getByText(/Cuánto estoy ganando/i).first(),
      forma: 'rect',
    },
  ],
})
