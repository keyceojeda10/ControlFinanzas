'use client'
// TEMPORAL — comprobar que el cazador manda el arbol de componentes.
import CazadorDeErrores from '@/components/armazon/CazadorDeErrores'
function ComponenteQueRevienta() { throw new Error('prueba del cazador') }
function UnPadre({ children }) { return <div>{children}</div> }
export default function ProbarError() {
  return <CazadorDeErrores><UnPadre><ComponenteQueRevienta /></UnPadre></CazadorDeErrores>
}
