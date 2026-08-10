import '@/app/globals.css'

/* ⚠ EL TITULO NO LLEVA NUESTRA MARCA.
   Decía «Mi Portal - Control Finanzas». Es la pestaña que ve el DEUDOR cuando
   entra a consultar lo que debe: en su cabeza, el nombre que aparece ahí es el
   de quien le prestó. Aquí no prestamos ni cobramos, así que no vamos a poner
   nuestro nombre encima de la deuda de nadie. */
export const metadata = {
  title: 'Consulta tu préstamo',
  description: 'Consulta el estado de tus préstamos',
}

export default function PortalLayout({ children }) {
  return (
    <div className="min-h-screen bg-[var(--cf-surface)]">
      {children}
    </div>
  )
}
