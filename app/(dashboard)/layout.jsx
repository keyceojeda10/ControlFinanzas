// app/(dashboard)/layout.jsx - Layout del dashboard con Sidebar, Header y BottomNav

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Sidebar        from '@/components/layout/Sidebar'
import Header         from '@/components/layout/Header'
import BottomNav      from '@/components/layout/BottomNav'
import PageWrapper    from '@/components/layout/PageWrapper'
import SinRutaBanner         from '@/components/layout/SinRutaBanner'
import VerificarEmailBanner  from '@/components/layout/VerificarEmailBanner'
import SuscripcionBanner     from '@/components/layout/SuscripcionBanner'
import GlobalSearch        from '@/components/layout/GlobalSearch'
import NotificationPrompt from '@/components/NotificationPrompt'
import Analytics          from '@/components/Analytics'
import { InstallBanner } from '@/components/layout/InstallButton'

// Bloqueo definitivo de suscripcion vencida: lee DB en cada request.
// El middleware no puede hacerlo (Edge runtime sin Prisma) y el JWT puede
// estar stale porque getToken solo decifra cookie sin refrescar.
async function bloquearSiVencida() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return
  if (session.user.rol === 'superadmin') return

  const hdrs = await headers()
  const pathname = hdrs.get('x-invoke-path') || hdrs.get('x-pathname') || ''
  // Permitir acceso a la pagina de plan aunque este vencido
  if (pathname.includes('/configuracion/plan')) return

  const sub = await prisma.suscripcion.findFirst({
    where: {
      organizationId: session.user.organizationId,
      OR: [{ mpStatus: null }, { mpStatus: { not: 'pending' } }],
    },
    orderBy: { fechaVencimiento: 'desc' },
    select: { fechaVencimiento: true },
  })
  if (sub?.fechaVencimiento && new Date(sub.fechaVencimiento) < new Date()) {
    redirect('/suscripcion-vencida')
  }
}

export default async function DashboardLayout({ children }) {
  await bloquearSiVencida()
  return (
    <div className="flex min-h-dvh bg-[#060609]">
      {/* Sidebar – visible solo en lg+ */}
      <Sidebar />

      {/* Área principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header – visible solo en mobile */}
        <Header />

        {/* Aviso verificar email (periodo de gracia 24h) */}
        <VerificarEmailBanner />

        {/* Aviso vencimiento de suscripcion (solo <=7 dias o vencida) */}
        <SuscripcionBanner />

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
