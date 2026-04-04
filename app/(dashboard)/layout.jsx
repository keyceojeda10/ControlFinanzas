// app/(dashboard)/layout.jsx - Layout del dashboard con Sidebar, Header y BottomNav

import Sidebar        from '@/components/layout/Sidebar'
import Header         from '@/components/layout/Header'
import BottomNav      from '@/components/layout/BottomNav'
import PageWrapper    from '@/components/layout/PageWrapper'
import SinRutaBanner  from '@/components/layout/SinRutaBanner'
import GlobalSearch        from '@/components/layout/GlobalSearch'
import NotificationPrompt from '@/components/NotificationPrompt'
import Analytics          from '@/components/Analytics'
import { InstallBanner } from '@/components/layout/InstallButton'

export default function DashboardLayout({ children }) {
  return (
    <div className="flex min-h-dvh bg-[#060609]">
      {/* Sidebar – visible solo en lg+ */}
      <Sidebar />

      {/* Área principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header – visible solo en mobile */}
        <Header />

        {/* Aviso cobrador sin ruta */}
        <SinRutaBanner />

        {/* Contenido de la página – PageWrapper anima solo al cambiar ruta */}
        <main className="flex-1 px-4 py-5 lg:px-6 lg:py-6 pb-24 lg:pb-6 overflow-y-auto">
          <PageWrapper>{children}</PageWrapper>
        </main>
      </div>

      {/* BottomNav – visible solo en mobile */}
      <BottomNav />

      {/* Búsqueda global (Ctrl+K) */}
      <GlobalSearch />

      {/* Prompt para activar notificaciones push */}
      <NotificationPrompt />

      {/* Banner instalar app (una vez por sesion) */}
      <InstallBanner />

      {/* Analytics: page view tracking */}
      <Analytics />
    </div>
  )
}
