'use client'
// app/(dashboard)/tutoriales/page.jsx — Tutoriales para clientes.
//
// EL TÍTULO LO PONE EL ARMAZÓN, NO LA PÁGINA. Tenía su propio <h1> «Tutoriales»
// debajo del que ya dibuja la cabecera: dos títulos iguales, uno encima de otro.
// Es el mismo defecto que ya apareció en cobradores y en la ficha del préstamo,
// y por eso existe `useCabecera` — para que la página DIGA qué pone la cabecera
// en vez de dibujarse una propia.

import TutorialesList from '@/components/TutorialesList'
import { useCabecera } from '@/components/armazon/Armazon'

export default function TutorialesPage() {
  useCabecera({
    titulo: 'Tutoriales',
    subtitulo: 'Aprende a usar cada función del sistema paso a paso',
  })

  return <TutorialesList showCopyButton={false} />
}
