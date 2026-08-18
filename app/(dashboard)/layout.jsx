// app/(dashboard)/layout.jsx - Layout del dashboard con Sidebar, Header y BottomNav

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import BarraLateral   from '@/components/armazon/BarraLateral'
import { iniciales }  from '@/lib/armazon'
import Armazon, { VolverEscritorio } from '@/components/armazon/Armazon'
import PageWrapper    from '@/components/layout/PageWrapper'
import PaisActivo     from '@/components/layout/PaisActivo'
import SinRutaBanner         from '@/components/layout/SinRutaBanner'
import AvisoVerificarCorreo from '@/components/armazon/AvisoVerificarCorreo'
import PilaAvisos, { Ranura } from '@/components/armazon/PilaAvisos'
import AvisoSinSenal from '@/components/armazon/AvisoSinSenal'
import SuscripcionBanner     from '@/components/layout/SuscripcionBanner'
import LimitesPlanBanner     from '@/components/layout/LimitesPlanBanner'
import GlobalSearch        from '@/components/layout/GlobalSearch'
import Analytics          from '@/components/Analytics'
import CompletarTelefonoModal from '@/components/layout/CompletarTelefonoModal'
import NovedadesModal from '@/components/layout/NovedadesModal'
import UbicacionProvider from '@/components/providers/UbicacionProvider'
import SesionTracker from '@/components/providers/SesionTracker'
import { AccionesProvider } from '@/components/acciones/AccionesProvider'
import PuertaInstalacion from '@/components/layout/PuertaInstalacion'

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
  /* El avatar baja POR EL MISMO CAMINO que el nombre, y por el mismo motivo: si
     se leyera de `useSession()` el servidor pintaría las iniciales y el cliente
     el dibujo, con el parpadeo en cada carga que ese comentario ya explica.

     No bajaba, y por eso el usuario elegía su avatar en configuración y seguía
     viendo «CC» en la cabecera: el dato estaba en la sesión (`lib/auth.js:331`)
     y en la base (`User.avatarId`), pero nadie se lo pasaba al armazón. */
  const avatarId = session?.user?.avatarId ?? null
  return (
    /* ⚠ EL PROVEEDOR VA POR FUERA DE TODO, incluido el buscador global.
       Cada pantalla apunta sus acciones al montarse y el buscador las lee: si
       el proveedor estuviera dentro del árbol de las pantallas, el buscador
       —que se monta al final de este mismo layout— no las vería. */
    <AccionesProvider>
    <Armazon nombre={nombre} rol={session?.user?.rol ?? ''} avatarId={avatarId}>
    {/* El país de la organización, para las 465 llamadas a `formatMoney` que no
        lo pasan. Ver el porqué en el propio componente. */}
    <PaisActivo country={session?.user?.country ?? 'co'} />
    {/* ⚠ EL ALTO MÍNIMO DESCUENTA LA CABECERA Y EL HUECO DE LA PASTILLA.
        Con `min-h-screen` a secas la cuenta salía 56 (cabecera) + 844 (esto) +
        112 (el hueco) = 1012 en una ventana de 844: TODA pantalla corta se
        deslizaba 168px para no enseñar nada. Reportado en Socios —«hay mucho
        espacio en blanco, no sé por qué»— pero pasaba en las diez que medí.

        `--cf-hueco-pie` lo pone el armazón: 112px cuando hay pastilla y 0
        cuando no, que es lo que no podía saber esta capa. Y va también de
        `padding-bottom`, para que el hueco siga estando en las pantallas
        largas: es lo que evita que la pastilla se coma la última tarjeta.

        Sentado no hay pastilla ni cabecera móvil, y manda `lg:h-screen`. */}
    <div
      className="flex min-h-[calc(100dvh-56px-var(--cf-hueco-pie,0px))] pb-[var(--cf-hueco-pie,0px)] lg:min-h-0 lg:h-screen lg:pb-0"
      style={{ background: 'var(--cf-surface)' }}
    >
      {/* La barra lateral NUNCA se oculta: quien usa PC esta revisando, no
          cobrando en la calle. La regla de supresion es exclusiva de movil.

          SE MONTABA SIN UNA SOLA PROP. Nombre, rol e iniciales tienen valor por
          defecto vacio, asi que en escritorio el pie de la barra pintaba un
          circulo azul sin letras y dos lineas de texto en blanco. Es el mismo
          fallo del FAB muerto: el componente estaba bien, nadie lo conectaba.

          Bajan del SERVIDOR, igual que en la cabecera movil: derivarlos de
          useSession() en cliente hace que el servidor pinte «·» y el cliente
          las iniciales — desajuste de hidratacion y parpadeo en cada carga. */}
      <BarraLateral
        nombre={nombre}
        rol={session?.user?.rol ?? ''}
        iniciales={iniciales(nombre)}
        avatarId={avatarId}
      />

      {/* Área principal */}
      {/* mobile: flex-col sin overflow → body scrollea (evita GPU artifacts Android) */}
      {/* desktop: overflow-y-auto + h-dvh → scroll interno con sidebar fija */}
      <div className="flex-1 flex flex-col min-w-0 lg:overflow-y-auto">

        {/* ── UNA SOLA FRANJA ──
            Los cuatro avisos siguen decidiendo por su cuenta si les toca; lo
            que cambia es que ya no se apilan. La pila mira cuál de ellos pintó
            algo, deja arriba al de más dinero en juego y cuenta el resto.

            El orden vive en lib/adaptadores/avisos.js con sus pruebas: primero
            lo que impide cobrar, después lo que caduca, y al final lo cómodo.
            Antes los cuatro se apilaban y lo primero que veía el dueño al abrir
            era que le iban a cobrar la suscripción. */}
        {/* ── SIN SEÑAL, ARRIBA DEL TODO (T05-05) ──
            Va ANTES de la pila de avisos y no dentro: la pila enseña UNO solo y
            ordena por urgencia, y quedarse sin red no compite con «te caduca la
            suscripción» — es la condición bajo la que se lee todo lo demás. */}
        <AvisoSinSenal />

        <PilaAvisos>
          <Ranura id="sinRuta"><SinRutaBanner /></Ranura>
          <Ranura id="suscripcion"><SuscripcionBanner /></Ranura>
          <Ranura id="limitePlan"><LimitesPlanBanner /></Ranura>
          <Ranura id="verificarCorreo"><AvisoVerificarCorreo /></Ranura>
        </PilaAvisos>

        {/* El margen lateral lo pone el LAYOUT mientras conviven pantallas
            viejas y nuevas: las viejas dependian de el y al quitarlo se pegaron
            todas al borde. Las nuevas lo desactivan con `sinMargen`.
            El padding-bottom sigue fuera: el contenido pasa POR DEBAJO de la
            pastilla a proposito, y cada pantalla reserva su hueco final. */}
        <main className="flex-1 px-5 py-5 lg:px-6 lg:py-6">
          {/* La salida de las pantallas de detalle EN PC, donde no hay cabecera.
              Va aquí dentro y no en `Armazon` porque aquél envuelve también a la
              barra lateral: pintada allí salía por encima de ella y a todo el
              ancho de la ventana. */}
          <VolverEscritorio />
          <PageWrapper>{children}</PageWrapper>
        </main>
      </div>

      {/* Búsqueda global (Ctrl+K) */}
      <GlobalSearch />

      {/* La guía de instalación, con timbre global: hasta ahora no se podía
          enlazar desde ningún sitio. Ver el porqué en el componente. */}
      <PuertaInstalacion />

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
    </AccionesProvider>
  )
}
