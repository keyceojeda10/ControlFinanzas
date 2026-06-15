import { generarGuia } from './motor.mjs'

await generarGuia({
  slug: 'crear-cobrador',
  login: true,
  pasos: [
    {
      goto: '/cobradores',
      titulo: 'Paso 1 — Nuevo cobrador',
      msg: 'Entra a "Cobradores" (en el menú de herramientas) y toca el botón para crear uno nuevo.',
      resaltar: (p) => p.getByRole('button', { name: /Nuevo cobrador|Agregar|Crear/i }).first(),
      forma: 'rect',
    },
    {
      goto: '/cobradores/nuevo',
      titulo: 'Paso 2 — Datos y acceso',
      msg: 'Pon su nombre y teléfono. En "Acceso al sistema" define el correo y una contraseña temporal: con eso entrará el cobrador.',
      resaltar: (p) => p.getByText(/ACCESO AL SISTEMA/i).first(),
      forma: 'rect',
    },
    {
      goto: '/cobradores/nuevo',
      accion: async (p) => { await p.evaluate(() => window.scrollTo(0, 520)); await p.waitForTimeout(500) },
      titulo: 'Paso 3 — Permisos',
      msg: 'Activa solo lo que quieras que pueda hacer (crear préstamos, reportar gastos, etc.). Ojo: "descuentos y liquidaciones" solo a gente de confianza.',
      resaltar: (p) => p.getByText(/PERMISOS DEL COBRADOR/i).first(),
      forma: 'rect',
    },
    {
      goto: '/cobradores/nuevo',
      accion: async (p) => { await p.evaluate(() => window.scrollTo(0, 99999)); await p.waitForTimeout(500) },
      titulo: 'Paso 4 — Crear',
      msg: 'Toca "Crear cobrador". Si pusiste su teléfono, podrás enviarle las credenciales directo por WhatsApp.',
      resaltar: (p) => p.getByRole('button', { name: /Crear cobrador/i }).first(),
      forma: 'rect',
    },
  ],
})
