import { generarGuia } from './motor.mjs'

await generarGuia({
  slug: 'pagar-mensualidad',
  login: true,
  pasos: [
    {
      goto: '/dashboard',
      titulo: 'Paso 1 — Abre "Ver mi plan"',
      msg: 'Toca el botón + (abajo a la derecha) y elige "Ver mi plan". También está en Configuración.',
      resaltar: (p) => p.getByRole('button', { name: /Acciones r/i }).first(),
      forma: 'circulo',
    },
    {
      goto: '/configuracion/plan',
      titulo: 'Paso 2 — Revisa tu vencimiento',
      msg: 'Aquí ves tu plan, cuándo se renueva y cuántos días te quedan. Atento a esa fecha para no perder acceso.',
      resaltar: (p) => p.getByText(/VENCIMIENTO/i).first(),
      forma: 'rect',
    },
    {
      goto: '/configuracion/plan',
      accion: async (p) => { await p.evaluate(() => window.scrollTo(0, 99999)); await p.waitForTimeout(500) },
      titulo: 'Paso 3 — Pagar / renovar',
      msg: 'Para pagar tu mensualidad, toca "Soporte" (WhatsApp) o escribe al 301 199 3001 (7am a 10pm). Ahí te ayudan con el medio de pago y activan tu plan.',
      resaltar: (p) => p.getByText(/Soporte/i).last(),
      forma: 'rect',
    },
  ],
})
