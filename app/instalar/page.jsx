// app/instalar/page.jsx — «¿Cómo descargo la app?», en una página que se puede
// mandar por WhatsApp.
//
// «La gente lo pregunta muchísimo por WhatsApp» (Carlos, 19 oct 2026). Antes la
// respuesta eran capturas sueltas. Ahora es un enlace: app.control-finanzas.com/instalar,
// SIN iniciar sesión (no está en el `matcher` del middleware), con el video del
// profe y los pasos de ESE teléfono.
import InstalarApp from '@/components/tutoriales/InstalarApp'
import { videoPorId } from '@/lib/tutoriales/profe'

const video = videoPorId('inicio-instalar')

export const metadata = {
  title: 'Instala Control Finanzas en tu teléfono',
  description: 'Mira en un minuto cómo dejar la app en tu pantalla de inicio, en Android o en iPhone.',
  openGraph: {
    title: 'Instala Control Finanzas en tu teléfono',
    description: 'El profe te enseña en un minuto, en Android o en iPhone.',
    ...(video?.poster ? { images: [{ url: video.poster }] } : {}),
  },
}

export default function InstalarPage() {
  return <InstalarApp />
}
