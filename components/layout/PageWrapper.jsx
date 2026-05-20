'use client'
// components/layout/PageWrapper.jsx
// Envuelve el contenido de cada página.
// SIN key={pathname}: ese key remontaba TODO el arbol en cada navegacion
// (React destruye y reconstruye todo) → flash visual. Sin el, React reconcilia
// normalmente y la transicion entre pantallas es fluida.

export default function PageWrapper({ children }) {
  return (
    <div className="page-transition h-full">
      {children}
    </div>
  )
}
