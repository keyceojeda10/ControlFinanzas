'use client'
// components/layout/PageWrapper.jsx
// Envuelve el contenido de cada página.
// SIN key={pathname}: ese key remontaba TODO el arbol en cada navegacion
// (React destruye y reconstruye todo) → flash visual. Sin el, React reconcilia
// normalmente y la transicion entre pantallas es fluida.

/* ⚠ `Contenido` NO SOBRA (8 nov 2026). `children` puede llegar como un dato del
   servidor que todavía no ha terminado de bajar. Puesto directo dentro del
   <div>, quien se suspende esperándolo es el propio <div>: React ya lo había
   reclamado al hidratar, al repetirlo intenta reclamarlo otra vez con el puntero
   ya adentro, no cuadra y tira el armazón entero (error #418). Pasaba en 4 de
   111 cargas, y solo con los archivos en caché, que es lo normal en un teléfono.
   Con un componente en medio se suspende y se repite él, que no reclama nada. */
function Contenido({ children }) {
  return children
}

export default function PageWrapper({ children }) {
  return (
    <div className="page-transition h-full">
      <Contenido>{children}</Contenido>
    </div>
  )
}
