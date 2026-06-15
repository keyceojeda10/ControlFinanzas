import { generarGuia } from './motor.mjs'

// Avanza del paso Plan al paso Datos eligiendo el plan Inicial
const irADatos = async (p) => {
  await p.getByText('Inicial', { exact: false }).first().click().catch(()=>{})
  await p.waitForTimeout(500)
  await p.getByText(/Continuar con/i).first().click()
    .catch(async ()=>{ await p.getByRole('button', { name: /Continuar/i }).first().click() })
  await p.waitForTimeout(2500)
}

await generarGuia({
  slug: 'crear-cuenta',
  login: false, // registro es publico
  pasos: [
    {
      goto: '/registro?r=2',
      titulo: 'Paso 1 — Elige tu plan',
      msg: 'Entra a app.control-finanzas.com/registro. Elige un plan (puedes empezar con el Inicial) y toca "Continuar". Son 14 días gratis, sin tarjeta.',
      resaltar: (p) => p.getByText('Inicial', { exact: false }).first(),
      forma: 'rect',
    },
    {
      goto: '/registro?r=2',
      accion: irADatos,
      titulo: 'Paso 2 — Tus datos',
      msg: 'Llena el nombre de tu negocio, tu nombre, tu WhatsApp, correo y una contraseña. Elige verificar por WhatsApp (recomendado) o correo.',
      resaltar: (p) => p.getByText(/VERIFICAR CUENTA CON/i).first(),
      forma: 'rect',
    },
    {
      goto: '/registro?r=2',
      accion: irADatos,
      scrollTo: 99999,
      titulo: 'Paso 3 — Crear la cuenta',
      msg: 'Acepta los términos y toca "Crear cuenta gratis". Luego te llega un código (por WhatsApp o correo) para verificar y entrar.',
      resaltar: (p) => p.getByRole('button', { name: /Crear cuenta gratis/i }).first(),
      forma: 'rect',
    },
  ],
})
