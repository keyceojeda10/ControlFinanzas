import { generarGuia } from './motor.mjs'

await generarGuia({
  slug: 'crear-cliente',
  login: true,
  pasos: [
    {
      goto: '/dashboard',
      titulo: 'Paso 1 — Nuevo cliente',
      msg: 'Desde el inicio toca "Nuevo cliente" (o el botón + abajo). También está en la sección Clientes.',
      resaltar: (p) => p.getByText('Nuevo cliente', { exact: false }).first(),
      forma: 'rect',
    },
    {
      goto: '/clientes/nuevo',
      titulo: 'Paso 2 — Datos básicos',
      msg: 'Pon el nombre, la cédula y el celular. Eso es lo mínimo para registrarlo. Luego toca "Continuar".',
      resaltar: (p) => p.getByText(/¿Qui.n es tu cliente/i).first(),
      forma: 'rect',
    },
    {
      goto: '/clientes/nuevo',
      titulo: 'Paso 3 — Atajo: importar cartulina',
      msg: 'Si llevas el cliente en cartulina, toca "Importar desde cartulina" y súbele hasta 5 fotos: el sistema lee los datos solo.',
      resaltar: (p) => p.getByText(/Importar desde cartulina/i).first(),
      forma: 'rect',
    },
    {
      goto: '/clientes/nuevo',
      scrollTo: 99999,
      titulo: 'Paso 4 — Continuar y guardar',
      msg: 'Toca "Continuar". Los siguientes pasos (ubicación y ruta) son opcionales: puedes asignarle ruta/grupo o dejarlo así y guardar.',
      resaltar: (p) => p.getByRole('button', { name: /Continuar/i }).first(),
      forma: 'rect',
    },
  ],
})
