// app/(dashboard)/layout.jsx - Layout del dashboard con Sidebar, Header y BottomNav

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import BarraLateral   from '@/components/armazon/BarraLateral'
import Armazon        from '@/components/armazon/Armazon'
import PageWrapper    from '@/components/layout/PageWrapper'
import SinRutaBanner         from '@/components/layout/SinRutaBanner'
import VerificarEmailBanner  from '@/components/layout/VerificarEmailBanner'
import SuscripcionBanner     from '@/components/layout/SuscripcionBanner'
import LimitesPlanBanner     from '@/components/layout/LimitesPlanBanner'
import GlobalSearch        from '@/components/layout/GlobalSearch'
import Analytics          from '@/components/Analytics'
import CompletarTelefonoModal from '@/components/layout/CompletarTelefonoModal'
import NovedadesModal from '@/components/layout/NovedadesModal'
import UbicacionProvider from '@/components/providers/UbicacionProvider'
import SesionTracker from '@/components/providers/SesionTracker'

// Bloqueo definitivo de suscripcion vencida: lee DB en cada request.
// El middleware no puede hacerlo (Edge runtime sin Prisma) y el JWT puede
// estar stale porque getToken solo decifra cookie sin refrescar.
async function bloquearSiVencida() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return
  if (session.user.rol === 'superadmin') return
  // Cobradores no tienen suscripción propia — saltamos la query DB en cada request
  if (session.user.rol === 'cobrador') return

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
  // El nombre baja desde el servidor para que la cabecera no cambie entre el
  // HTML y la hidratacion. Ver el comentario de Armazon.jsx.
  const session = await getServerSession(authOptions)
  const nombre = session?.user?.nombre ?? session?.user?.name ?? ''
  return (
    <Armazon nombre={nombre}>
    <div className="flex min-h-screen lg:h-screen" style={{ background: 'var(--cf-surface)' }}>
      {/* La barra lateral NUNCA se oculta: quien usa PC esta revisando, no
          cobrando en la calle. La regla de supresion es exclusiva de movil. */}
      <BarraLateral />

      {/* Área principal */}
      {/* mobile: flex-col sin overflow → body scrollea (evita GPU artifacts Android) */}
      {/* desktop: overflow-y-auto + h-dvh → scroll interno con sidebar fija */}
      <div className="flex-1 flex flex-col min-w-0 lg:overflow-y-auto">

        {/* Aviso verificar email (periodo de gracia 24h) */}
        <VerificarEmailBanner />

        {/* Aviso vencimiento de suscripcion (solo <=7 dias o vencida) */}
        <SuscripcionBanner />

        {/* Aviso limites de plan excedidos */}
        <LimitesPlanBanner />

        {/* Aviso cobrador sin ruta */}
        <SinRutaBanner />

        {/* Contenido de la página.
            SIN padding-bottom para la pastilla: el contenido pasa POR DEBAJO a
            proposito, y cada pantalla reserva su propio hueco final. */}
        <main className="flex-1">
          <PageWrapper>{children}</PageWrapper>
        </main>
      </div>

      {/* Búsqueda global (Ctrl+K) */}
      <GlobalSearch />

      {/* Modal completar telefono (owners sin telefono) */}
      <CompletarTelefonoModal />

      {/* Modal de novedades (una vez por versión) */}
      <NovedadesModal />

      {/* GPS silencioso: cobrador envia ubicacion mientras la app esta abierta */}
      <UbicacionProvider />

      {/* Tracking silencioso de sesiones multi-dispositivo */}
      <SesionTracker />

      {/* Analytics: page view tracking */}
      <Analytics />
    </div>
    </Armazon>
  )
}
