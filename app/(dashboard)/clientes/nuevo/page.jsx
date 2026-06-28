'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter }   from 'next/navigation'
import { useAuth }     from '@/hooks/useAuth'
import ClienteForm     from '@/components/clientes/ClienteForm'
import { planTieneFotos } from '@/lib/planes'

export default function NuevoClientePage() {
  const router = useRouter()
  const { session, puedeCrearClientes, esOwner, loading } = useAuth()
  const [datosCartulina, setDatosCartulina] = useState(null)
  const [metodo, setMetodo] = useState(null) // null = selector, 'manual' | 'foto'
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrError, setOcrError] = useState('')
  const [ocrAdvertencias, setOcrAdvertencias] = useState([])
  const fotoInputRef = useRef(null)

  useEffect(() => {
    if (!loading && !puedeCrearClientes) router.replace('/clientes')
  }, [loading, puedeCrearClientes, router])

  const handleFotoUpload = async (e) => {
    const archivos = Array.from(e.target.files ?? [])
    if (!archivos.length) return
    if (fotoInputRef.current) fotoInputRef.current.value = ''

    setOcrLoading(true)
    setOcrError('')
    setOcrAdvertencias([])

    const fd = new FormData()
    archivos.forEach(f => fd.append('fotos', f))

    try {
      const res = await fetch('/api/herramientas/leer-cartulina', { method: 'POST', body: fd })
      const json = await res.json()

      if (!res.ok) {
        setOcrError(json.error ?? 'No pudimos leer la foto')
        setOcrLoading(false)
        return
      }

      if (json.advertencias?.length) setOcrAdvertencias(json.advertencias)
      setDatosCartulina(json.datos)
      setMetodo('foto')
    } catch {
      setOcrError('Error de conexion. Intenta de nuevo.')
    } finally {
      setOcrLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <svg className="animate-spin w-6 h-6 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  if (!puedeCrearClientes) return null

  // Pantalla selector
  if (!metodo) {
    return (
      <div className="max-w-lg mx-auto">
        <input ref={fotoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFotoUpload} />

        <div className="mb-8">
          <button onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm transition-colors mb-3"
            style={{ color: 'var(--color-text-muted)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </button>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Nuevo cliente</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Como quieres registrar al cliente?</p>
        </div>

        <div className="space-y-3">
          {/* Opcion: Escanear cartulina */}
          <button
            type="button"
            onClick={() => fotoInputRef.current?.click()}
            disabled={ocrLoading}
            className="w-full text-left rounded-2xl p-5 transition-all active:scale-[0.98] disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 8%, var(--color-bg-card)), var(--color-bg-card))',
              border: '1.5px solid color-mix(in srgb, var(--color-accent) 30%, var(--color-border))',
            }}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', color: 'var(--color-accent)' }}>
                {ocrLoading ? (
                  <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  {ocrLoading ? 'Leyendo foto...' : 'Desde foto'}
                </h3>
                <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  {ocrLoading ? 'La IA esta extrayendo los datos' : 'Toma foto de la cartulina, cuaderno o libreta. La IA extrae los datos automaticamente.'}
                </p>
              </div>
            </div>
          </button>

          {/* Opcion: Manual */}
          <button
            type="button"
            onClick={() => setMetodo('manual')}
            disabled={ocrLoading}
            className="w-full text-left rounded-2xl p-5 transition-all active:scale-[0.98] disabled:opacity-60"
            style={{
              background: 'var(--color-bg-card)',
              border: '1.5px solid var(--color-border)',
            }}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'color-mix(in srgb, var(--color-info, #3b82f6) 12%, transparent)', color: 'var(--color-info, #3b82f6)' }}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>Crear manual</h3>
                <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  Escribe los datos del cliente paso a paso.
                </p>
              </div>
            </div>
          </button>
        </div>

        {ocrError && (
          <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
            style={{ background: 'var(--color-danger-dim)', color: 'var(--color-danger)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)' }}>
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {ocrError}
          </div>
        )}

        {ocrAdvertencias.length > 0 && (
          <div className="mt-3 space-y-1">
            {ocrAdvertencias.map((a, i) => (
              <p key={i} className="text-[11px]" style={{ color: 'var(--color-warning)' }}>{a}</p>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Wizard del formulario
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-5">
        <button
          onClick={() => { setMetodo(null); setDatosCartulina(null); setOcrError(''); setOcrAdvertencias([]) }}
          className="flex items-center gap-1.5 text-sm transition-colors mb-3"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Cambiar metodo
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 22%, transparent), color-mix(in srgb, var(--color-accent) 12%, transparent))',
              border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
              color: 'var(--color-accent)',
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
              {metodo === 'foto' ? 'Revisa los datos' : 'Nuevo cliente'}
            </h1>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {metodo === 'foto' ? 'Datos extraidos de la foto. Verifica y completa.' : 'Registra los datos del cliente'}
            </p>
          </div>
        </div>
      </div>

      <ClienteForm
        plan={session?.user?.plan ?? 'starter'}
        puedeSubirFoto={planTieneFotos(session?.user?.plan)}
        datosIniciales={datosCartulina}
        esOwner={esOwner}
      />
    </div>
  )
}
