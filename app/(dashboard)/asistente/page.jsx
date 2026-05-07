// app/(dashboard)/asistente/page.jsx — Pagina dedicada del asistente Fin
import AsistenteChat from '@/components/asistente/AsistenteChat'

export const metadata = { title: 'Asistente IA — Control Finanzas' }

export default function AsistentePage() {
  return (
    <div className="min-h-screen" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-2xl mx-auto h-[calc(100vh-80px)] lg:h-[calc(100vh-40px)] flex flex-col">
        <AsistenteChat />
      </div>
    </div>
  )
}
