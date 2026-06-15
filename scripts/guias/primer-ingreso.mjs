import { generarGuia } from './motor.mjs'

// Cierra el modal de "agrega tu telefono" si aparece, para ver el onboarding
const cerrarModalTel = async (p) => {
  const r = p.getByText(/Recordar m.s tarde/i).first()
  if (await r.count()) { await r.click().catch(()=>{}); await p.waitForTimeout(800) }
}

await generarGuia({
  slug: 'primer-ingreso',
  login: true,
  pasos: [
    {
      goto: '/dashboard',
      accion: async (p) => { await cerrarModalTel(p); await p.waitForTimeout(500) },
      titulo: 'Paso 1 — ¡Bienvenido!',
      msg: 'La primera vez que entras, el sistema te da un recorrido guiado para empezar fácil.',
      resaltar: (p) => p.getByText(/CÓMO QUIERES EMPEZAR/i).first(),
      forma: 'rect',
    },
    {
      goto: '/dashboard',
      accion: async (p) => { await cerrarModalTel(p); await p.evaluate(()=>window.scrollTo(0,99999)); await p.waitForTimeout(500) },
      titulo: 'Paso 2 — Probar sin riesgo (demo)',
      msg: '"Explorar con datos demo": el sistema crea un cliente y préstamo de ejemplo para que practiques. Al terminar se borran solos y tu cuenta queda limpia.',
      resaltar: (p) => p.getByText(/Explorar con datos demo/i).first(),
      forma: 'rect',
    },
    {
      goto: '/dashboard',
      accion: async (p) => { await cerrarModalTel(p); await p.evaluate(()=>window.scrollTo(0,99999)); await p.waitForTimeout(500) },
      titulo: 'Paso 3 — Empezar de verdad',
      msg: '"Empezar con mi primer cliente real": registra ya tu primer cliente y préstamo de verdad. Ideal si tienes la cartera lista.',
      resaltar: (p) => p.getByText(/primer cliente real/i).first(),
      forma: 'rect',
    },
    {
      goto: '/dashboard',
      accion: async (p) => { await cerrarModalTel(p); await p.evaluate(()=>window.scrollTo(0,99999)); await p.waitForTimeout(500) },
      titulo: 'Paso 4 — O ir directo',
      msg: 'Si ya conoces el sistema, toca "Ya conozco el sistema — ir al dashboard" y empieza a usarlo.',
      resaltar: (p) => p.getByText(/Ya conozco el sistema/i).first(),
      forma: 'rect',
    },
  ],
})
