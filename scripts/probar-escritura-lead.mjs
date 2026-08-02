// ¿Se puede seguir escribiendo en `Lead` sin el valor por defecto?
//
// Es LA pregunta que deja el arreglo cerrado. Quitar el `DEFAULT` sólo rompe a
// quien insertara sin traer la columna; Prisma siempre la trae en un campo
// `@updatedAt`, pero eso hay que verlo, no suponerlo.
//
// Crea un lead de mentira POR PRISMA —el mismo camino que usan el webhook y el
// registro—, comprueba que `updatedAt` se llenó, lo modifica para ver que la
// fecha se mueve sola, y lo borra.
//
//   node --import ./scripts/alias-loader.mjs scripts/probar-escritura-lead.mjs

import { prisma } from '@/lib/prisma'

const marca = `PRUEBA-BORRAR-${Date.now()}`
let creado = null

try {
  creado = await prisma.lead.create({
    data: { nombre: marca, telefono: '+000000000000', estado: 'nuevo' },
  })
  console.log('creado    :', creado.id)
  console.log('updatedAt :', creado.updatedAt, creado.updatedAt ? '✓ se llenó' : '✗ VACÍO')

  await new Promise((r) => setTimeout(r, 1100))
  const tocado = await prisma.lead.update({
    where: { id: creado.id },
    data: { estado: 'contactado' },
  })
  const semovio = tocado.updatedAt.getTime() > creado.updatedAt.getTime()
  console.log('tras editar:', tocado.updatedAt, semovio ? '✓ se movió sola' : '✗ NO SE MOVIÓ')

  if (!creado.updatedAt || !semovio) process.exitCode = 1
  else console.log('\nEscribir y editar leads sigue funcionando.')
} finally {
  if (creado) {
    await prisma.lead.delete({ where: { id: creado.id } })
    console.log('(lead de prueba borrado)')
  }
  await prisma.$disconnect()
}
