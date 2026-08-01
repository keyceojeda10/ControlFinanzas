import '@/app/globals.css'

export const metadata = {
  title: 'Mi Portal - Control Finanzas',
  description: 'Consulta el estado de tus préstamos',
}

export default function PortalLayout({ children }) {
  return (
    <div className="min-h-screen bg-[var(--cf-surface)]">
      {children}
    </div>
  )
}
