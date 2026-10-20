'use client'
// app/(dashboard)/tutoriales/page.jsx — Tutoriales para clientes.
//
// EL TÍTULO LO PONE EL ARMAZÓN, NO LA PÁGINA. Tenía su propio <h1> «Tutoriales»
// debajo del que ya dibuja la cabecera: dos títulos iguales, uno encima de otro.
// Es el mismo defecto que ya apareció en cobradores y en la ficha del préstamo,
// y por eso existe `useCabecera` — para que la página DIGA qué pone la cabecera
// en vez de dibujarse una propia.

import TutorialesList from '@/components/TutorialesList'
import AyudaProfe from '@/components/tutoriales/AyudaProfe'
import { useAuth } from '@/hooks/useAuth'
import { useProfe } from '@/components/tutoriales/ProfeProvider'
import { useCabecera } from '@/components/armazon/Armazon'

export default function TutorialesPage() {
  const profe = useProfe()
  const { esOwner } = useAuth()
  useCabecera({
    titulo: 'Tutoriales',
    subtitulo: profe?.activo ? 'Los videos del profe, por sección' : 'Aprende a usar cada función del sistema paso a paso',
  })
  // Mientras el negocio no tiene los videos (`profeHabilitado`), las guías de
  // siempre. Hasta que conteste el servidor, nada: ni una cosa ni la otra.
  if (!profe?.activo) return profe?.cargado ? <TutorialesList showCopyButton={false} /> : null

  /* LOS VIDEOS DEL PROFE, NO LAS GUÍAS ESCRITAS (19 oct 2026). Las guías de
     `lib/tutorialesData.js` contradecían la pantalla (DETALLES-RUTAS #47). Es
     LA MISMA pantalla que Configuración → Ayuda y tutoriales, con el índice y
     los interruptores. Las guías siguen para el buscador y el panel de admin. */
  return <AyudaProfe esOwner={esOwner} />
}
