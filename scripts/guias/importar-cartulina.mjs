const BASE = 'https://app.control-finanzas.com'

export const def = {
  slug: 'importar-cartulina',
  login: true,
  pasos: [
    {
      goto: '/clientes/nuevo',
      titulo: 'Paso 1 — Nuevo cliente',
      msg: 'Para pasar tus clientes de la cartulina (tarjeta física) al sistema sin escribir todo, empieza en "Nuevo cliente".',
      resaltar: (p) => p.getByText(/¿Qui.n es tu cliente/i).first(),
      forma: 'rect',
    },
    {
      goto: '/clientes/nuevo',
      titulo: 'Paso 2 — "Importar desde cartulina"',
      msg: 'Toca "Importar desde cartulina". El sistema usa inteligencia artificial para leer los datos de la foto de tu tarjeta.',
      resaltar: (p) => p.getByText(/Importar desde cartulina/i).first(),
      forma: 'circulo',
    },
    {
      goto: '/clientes/nuevo',
      titulo: 'Paso 3 — Sube las fotos',
      msg: 'Al tocar el botón se abre tu galería/cámara. Sube hasta 5 fotos claras de la cartulina (nombre, cédula, montos, pagos). El sistema rellena los datos solo; tú solo revisas y guardas.',
      resaltar: (p) => p.getByText(/Sube hasta 5 fotos/i).first(),
      forma: 'rect',
    },
  ],
}
