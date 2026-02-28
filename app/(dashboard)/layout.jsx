// app/(dashboard)/layout.jsx - Layout del dashboard con Sidebar, Header y BottomNav

import Sidebar   from '@/components/layout/Sidebar'
import Header    from '@/components/layout/Header'
import BottomNav from '@/components/layout/BottomNav'

export default function DashboardLayout({ children }) {
  return (
    <div className="flex min-h-dvh bg-[#0f1117]">
      {/* Sidebar – visible solo en lg+ */}
      <Sidebar />

      {/* Área principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header – visible solo en mobile */}
        <Header />

        {/* Contenido de la página */}
        <main className="flex-1 px-4 py-5 lg:px-6 lg:py-6 pb-24 lg:pb-6 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* BottomNav – visible solo en mobile */}
      <BottomNav />
    </div>
  )
}
