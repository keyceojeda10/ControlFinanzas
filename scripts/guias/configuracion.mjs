import { generarGuia } from './motor.mjs'

await generarGuia({
  slug: 'configuracion',
  login: true,
  pasos: [
    {
      goto: '/configuracion',
      titulo: 'Paso 1 — Tu configuración',
      msg: 'Entra a "Configuración". Arriba están las secciones: Mi perfil, Organización, Suscripción, Referidos, Notificaciones y Apariencia.',
      resaltar: (p) => p.getByText('Organización', { exact: false }).first(),
      forma: 'rect',
    },
    {
      goto: '/configuracion',
      titulo: 'Paso 2 — Tu perfil',
      msg: 'En "Mi perfil" cambias tu nombre, tu número de WhatsApp, tu foto y tu contraseña.',
      resaltar: (p) => p.getByText(/INFORMACIÓN PERSONAL/i).first(),
      forma: 'rect',
    },
    {
      goto: '/configuracion?tab=organizacion',
      titulo: 'Paso 3 — Datos del negocio',
      msg: 'En "Organización" configuras el nombre de tu negocio, el país/moneda y ajustes como días sin cobro.',
      resaltar: (p) => p.getByText('Organización', { exact: false }).first(),
      forma: 'rect',
    },
    {
      goto: '/configuracion?tab=apariencia',
      titulo: 'Paso 4 — Tema claro u oscuro',
      msg: 'En "Apariencia" eliges el tema claro u oscuro de la app, a tu gusto.',
      resaltar: (p) => p.getByText('Apariencia', { exact: false }).first(),
      forma: 'rect',
    },
    {
      goto: '/configuracion?tab=notificaciones',
      titulo: 'Paso 5 — Notificaciones',
      msg: 'En "Notificaciones" activas los avisos (pagos, recordatorios) que quieres recibir.',
      resaltar: (p) => p.getByText('Notificaciones', { exact: false }).first(),
      forma: 'rect',
    },
  ],
})
