'use client'
// components/layout/Contenido.jsx

/* ⚠ NO SOBRA: es el arreglo del error #418 (cf-v1256) para los layouts que no
   pasan por PageWrapper — el panel de administración y el portal del deudor.

   `children` puede llegar como un dato del servidor que todavía no ha terminado
   de bajar. Puesto directo dentro de un elemento HTML (<main>, <div>), quien se
   suspende esperándolo es ese elemento: React ya lo había reclamado al hidratar,
   al repetirlo intenta reclamarlo otra vez, no cuadra y tira la pantalla entera.
   Con un componente en medio se suspende y se repite él, que no reclama nada.

   Tiene que ser un componente DE CLIENTE: en un layout del servidor una función
   normal se ejecuta allá y no deja nada en el navegador que pueda suspenderse.
   Ver PageWrapper.jsx, donde se midió (4 de 111 cargas antes, 0 de 215 después). */
export default function Contenido({ children }) {
  return children
}
