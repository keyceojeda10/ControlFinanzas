'use client'
// app/(dashboard)/cobradores/[id]/page.jsx - Detalle del cobrador

import { formatMoney } from '@/lib/i18n'
import { useState, useEffect, useCallback, use } from 'react'
import { useRouter }                from 'next/navigation'
import { useAuth }                  from '@/hooks/useAuth'
import { Badge }                    from '@/components/ui/Badge'
import { Card }                     from '@/components/ui/Card'
import { SkeletonCard }             from '@/components/ui/Skeleton'
import { useCabecera }              from '@/components/armazon/Armazon'
import CompartirCredenciales        from '@/components/cobradores/CompartirCredenciales'
import Link                         from 'next/link'
import { ConfirmModal }             from '@/components/ui/ConfirmModal'
import { RegistrarAcciones } from '@/components/acciones/AccionesProvider'
import QueNecesitas from '@/components/acciones/QueNecesitas'

export default function CobradorDetallePage({ params }) {
  return <CobradorDetalleInner params={params} />
}

function CobradorDetalleInner({ params }) {
  const { id }      = use(params)
  const router      = useRouter()
  const { session } = useAuth()

  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [toggling, setToggling] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState(false)
  const [showReenviar, setShowReenviar] = useState(false)
  const [nuevaPass, setNuevaPass]       = useState('')
  const [reseteando, setReseteando]     = useState(false)

  /* ══ ASIGNARLE UNA RUTA ════════════════════════════════════════════════
   *
   * ⚠ ESTO NO SE PODÍA HACER EN NINGUNA PANTALLA. La lista de cobradores avisa
   * «una cuenta sin ruta no puede cobrar nada, asígnale una» y ofrece un botón
   * «Asignar» que trae AQUÍ — y aquí solo ponía «Sin ruta asignada», sin nada
   * que tocar. La ficha de la ruta tampoco: su «Cambiar el cobrador de la ruta»
   * devuelve a /cobradores, o sea al mismo sitio. El círculo estaba cerrado y la
   * única salida era crear una ruta NUEVA, que es donde sí se elige cobrador.
   *
   * En producción hay 6 cobradores activos sin ninguna ruta, y tres de ellos son
   * del mismo negocio, que tiene 9 rutas y 2 esperando sin cobrador.
   *
   * El API ya lo hacía todo (`PATCH /api/rutas/[id]` con `cobradorId`, con su
   * guarda de cierre del día y su `?forzar=1`). Solo faltaba con qué llamarlo.
   *
   * ⚠ Y SE LISTAN TODAS SUS RUTAS, no una. `Ruta.cobradorId` es uno-a-muchos y
   * `/api/cobradores/[id]` devuelve `rutas[0]`: con dos rutas, la ficha enseñaba
   * una y la otra quedaba invisible. Asignar a ciegas habría dejado cobradores
   * con rutas que nadie ve. */
  const [rutasOrg, setRutasOrg] = useState(null)
  const [asignando, setAsignando] = useState(false)
  const [errorRuta, setErrorRuta] = useState('')
  const [forzarRuta, setForzarRuta] = useState(null) // { rutaId, mensaje }
  const esOwner = session?.user?.rol === 'owner'

  const fetchRutas = useCallback(async () => {
    if (!esOwner) return
    try {
      const res = await fetch('/api/rutas')
      setRutasOrg(res.ok ? await res.json() : [])
    } catch { setRutasOrg([]) }
  }, [esOwner])

  useEffect(() => { fetchRutas() }, [fetchRutas])

  /** Pone (o quita) este cobrador en una ruta. `null` la deja sin cobrador. */
  const asignarRuta = async (rutaId, quien, forzar = false) => {
    setAsignando(true)
    setErrorRuta('')
    try {
      const res = await fetch(`/api/rutas/${rutaId}${forzar ? '?forzar=1' : ''}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cobradorId: quien }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        // 409: el cobrador anterior ya cerró caja o tiene pagos de hoy en esa
        // ruta. No se pisa en silencio — se pregunta.
        if (d?.cambioBloqueado) { setForzarRuta({ rutaId, quien, mensaje: d.error }); return }
        setErrorRuta(d?.error || 'No se pudo asignar la ruta.')
        return
      }
      setForzarRuta(null)
      await Promise.all([fetchRutas(), fetchCobrador()])
    } catch {
      setErrorRuta('No se pudo asignar la ruta.')
    } finally {
      setAsignando(false)
    }
  }

  const fetchCobrador = useCallback(async () => {
    try {
      const res = await fetch(`/api/cobradores/${id}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      setError('No se pudo cargar el cobrador.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchCobrador() }, [fetchCobrador])

  const toggleActivo = async () => {
    if (!data) return
    setToggling(true)
    try {
      const res = await fetch(`/api/cobradores/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !data.activo }),
      })
      if (!res.ok) throw new Error()
      setData((prev) => ({ ...prev, activo: !prev.activo }))
    } catch {
      setError('No se pudo cambiar el estado.')
    } finally {
      setToggling(false)
    }
  }

  /* ── LA CABECERA DEL SISTEMA ──────────────────────────────────────────────
   * Esta ficha no la llamaba, así que salía vacía —solo la flecha— y en
   * ESCRITORIO no tenía ni salida: `VolverEscritorio` hace `if (!de?.titulo)
   * return null`, o sea que sin cabecera no hay botón de volver en PC.
   *
   * Se copia el patrón de `prestamos/[id]` y `clientes/[id]`: nombre arriba,
   * una línea de contexto separada por `·`. No se inventa otro.
   *
   * ⚠ VA ANTES DEL `if (loading) return`: es un hook. */
  useCabecera({
    titulo: data?.nombre,
    subtitulo: data ? [
      data.ruta?.nombre ?? 'sin ruta',
      data.activo === false ? 'inactivo' : 'activo',
    ].filter(Boolean).join(' · ') : null,
  })

  if (loading) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <SkeletonCard /><SkeletonCard />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="cf-card-shadow bg-[var(--cf-red-pill-bg)] border border-[color-mix(in_srgb,var(--cf-red-dark)_30%,transparent)] text-[var(--cf-red-dark)] rounded-[20px] p-6 text-center">
          <p className="font-semibold mb-2">{error || 'Cobrador no encontrado'}</p>
          <button onClick={() => router.back()} className="text-sm underline">Volver</button>
        </div>
      </div>
    )
  }

  const ruta = data.ruta
  const clientes = ruta?.clientes ?? []
  /* `rutas[0]` es lo que devuelve el API; las de verdad salen de `/api/rutas`,
     que trae todas las del negocio con su cobrador. Mientras carga se enseña la
     que ya venía, para que la tarjeta no parpadee de «con ruta» a «sin ruta». */
  const susRutas = rutasOrg ? rutasOrg.filter((r) => r.cobrador?.id === id) : (ruta ? [ruta] : [])
  const rutasLibres = rutasOrg ? rutasOrg.filter((r) => r.cobrador?.id !== id) : []

  /* ══ LO QUE SE PUEDE HACER CON ESTE COBRADOR ═════════════════════════════
   *
   * Las tres acciones serias de esta pantalla son invisibles: activar/suspender
   * es una PASTILLA que parece una etiqueta de estado, editar y eliminar son
   * dos iconos sin una palabra al lado, y enviar las credenciales está dentro
   * de un acordeón cerrado. Nada de eso se lee; se descubre pulsando.
   *
   * ⚠ Los PERMISOS no se registran aquí: viven en la pantalla de editar, y es
   * ahí donde hay que llevar a quien pregunta «cómo restringir al cobrador».
   * Por eso «permisos» es sinónimo de editar y no una acción propia. */
  const accionesCobrador = [
    { id: 'cobr-editar', label: 'Editar el cobrador y sus permisos', pista: 'Qué puede ver y hacer',
      sinonimos: ['editar', 'permisos', 'restringir', 'limitar al cobrador', 'que no vea',
        'que no pueda borrar', 'cambiar el nombre', 'cambiar la ruta'],
      ejecutar: () => router.push(`/cobradores/${id}/editar`) },
    { id: 'cobr-credenciales', label: 'Enviar o cambiar la contraseña', pista: 'Mandarle el usuario y la clave',
      sinonimos: ['credenciales', 'contraseña', 'clave', 'no puede entrar', 'reenviar acceso',
        'resetear la clave', 'usuario y clave'],
      ejecutar: () => setShowReenviar(true) },
    { id: 'cobr-suspender', label: 'Activar o suspender el cobrador', pista: 'Quitarle el acceso sin borrarlo',
      sinonimos: ['suspender', 'desactivar', 'bloquear', 'quitarle el acceso', 'activar',
        'inactivar cobrador'],
      ejecutar: () => toggleActivo() },
    { id: 'cobr-eliminar', label: 'Eliminar el cobrador', pista: 'No se puede deshacer',
      sinonimos: ['eliminar', 'borrar cobrador', 'quitar cobrador', 'se fue'],
      ejecutar: () => setConfirmEliminar(true) },
  ]

  return (
    <div className="max-w-xl lg:max-w-4xl mx-auto space-y-4 pb-4">

      {/* Va arriba del hero: las tres acciones que esconde esta pantalla están
          repartidas entre una pastilla, dos iconos pelados y un acordeón. */}
      <RegistrarAcciones clave="cobrador" acciones={accionesCobrador} />
      <QueNecesitas ejemplos={['permisos', 'contraseña', 'suspender']} />
      {/* Back */}

      {/* HERO CARD: cobrador + stats + acciones */}
      {(() => {
        const heroColor = data.activo ? 'var(--cf-ink-2)' : 'var(--cf-ink-3)'
        return (
          <div
            className="cf-hero-card relative rounded-[20px] overflow-hidden"
            style={{
              background: `linear-gradient(135deg, color-mix(in srgb, ${heroColor} 14%, var(--cf-card)) 0%, var(--cf-card) 50%, color-mix(in srgb, ${heroColor} 8%, var(--cf-card)) 100%)`,
              border: `1px solid color-mix(in srgb, ${heroColor} 25%, var(--cf-border))`,
              boxShadow: `0 8px 32px color-mix(in srgb, ${heroColor} 18%, transparent)`,
            }}
          >
            <div className="hero-glow absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none hidden lg:block"
              style={{ background: `radial-gradient(circle, color-mix(in srgb, ${heroColor} 35%, transparent), transparent 70%)`, filter: 'blur(20px)' }} />
            <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
              style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '16px 16px', color: heroColor }} />

            <div className="relative px-5 py-5 sm:px-6 sm:py-6">
              {/* Top: avatar + nombre + acciones circulares */}
              <div className="flex items-start gap-3 mb-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-[20px] font-bold shrink-0"
                  style={{
                    background: `color-mix(in srgb, ${heroColor} 18%, transparent)`,
                    color: heroColor,
                    border: `2px solid color-mix(in srgb, ${heroColor} 40%, transparent)`,
                  }}
                >
                  {data.nombre?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-bold leading-tight truncate" style={{ color: 'var(--cf-ink)' }}>{data.nombre}</h1>
                  <p className="text-[12px] mt-0.5 truncate" style={{ color: 'var(--cf-ink-3)' }}>{data.email}</p>
                  {data.telefono && <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--cf-ink-3)' }}>{data.telefono}</p>}
                  <button
                    onClick={toggleActivo}
                    disabled={toggling}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1.5 disabled:opacity-50"
                    style={{
                      background: `color-mix(in srgb, ${heroColor} 15%, transparent)`,
                      color: heroColor,
                      border: `1px solid color-mix(in srgb, ${heroColor} 25%, transparent)`,
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: heroColor }} />
                    {data.activo ? 'Activo' : 'Inactivo'}
                  </button>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Link
                    href={`/cobradores/${id}/editar`}
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                    style={{ background: 'var(--cf-fill)', color: 'var(--cf-ink-2)', border: '1px solid var(--cf-border)' }}
                    title="Editar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                    </svg>
                  </Link>
                  <button
                    onClick={() => setConfirmEliminar(true)}
                    disabled={eliminando}
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                    style={{ background: 'color-mix(in srgb, var(--cf-red-dark) 12%, transparent)', color: 'var(--cf-red-dark)', border: '1px solid color-mix(in srgb, var(--cf-red-dark) 25%, transparent)' }}
                    title="Eliminar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Stats: recaudado hoy en grande + 2 chips a la derecha */}
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--cf-ink-2)' }}>
                    Recaudado hoy
                  </p>
                  <p
                    className="font-mono-display font-bold leading-none tracking-tight truncate"
                    style={{
                      color: 'var(--cf-green-dark)',
                      fontSize: 'clamp(28px, 8vw, 36px)',
                      textShadow: '0 0 30px color-mix(in srgb, var(--cf-green-dark) 25%, transparent)',
                    }}
                  >
                    {formatMoney(data.recaudadoHoy ?? 0)}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <div className="rounded-[12px] px-2.5 py-1.5 text-right" style={{ background: 'color-mix(in srgb, var(--cf-ink-3) 10%, transparent)' }}>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--cf-ink-3)' }}>Cobros</p>
                    <p className="text-[14px] font-bold font-mono-display" style={{ color: 'var(--cf-ink)' }}>{data.pagosMes ?? 0}</p>
                  </div>
                  <div className="rounded-[12px] px-2.5 py-1.5 text-right" style={{ background: 'color-mix(in srgb, var(--cf-ink-3) 10%, transparent)' }}>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--cf-ink-3)' }}>Clientes</p>
                    <p className="text-[14px] font-bold font-mono-display" style={{ color: 'var(--cf-ink)' }}>{clientes.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Reenviar credenciales */}
      <Card>
        {!showReenviar ? (
          <button
            onClick={() => setShowReenviar(true)}
            className="w-full flex items-center gap-3 text-left"
          >
            <div className="w-9 h-9 rounded-full bg-[color-mix(in_srgb,var(--cf-ink-2)_12%,transparent)] flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-[var(--cf-ink-2)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--cf-ink)]">Enviar credenciales</p>
              <p className="text-[10px] text-[var(--cf-ink-3)]">Resetea la contraseña y envía los datos de acceso por WhatsApp</p>
            </div>
            <svg className="w-4 h-4 text-[var(--cf-ink-3)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : !nuevaPass ? (
          <div className="space-y-3">
            <p className="text-[11px] font-extrabold uppercase tracking-[.07em]" style={{ color: 'var(--cf-ink-3)' }}>Resetear contraseña</p>
            <p className="text-xs text-[var(--cf-ink-3)]">
              Se generará una contraseña temporal que podrás enviarle al cobrador.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowReenviar(false)}
                className="flex-1 h-10 rounded-[12px] bg-[var(--cf-fill)] border border-[var(--cf-border)] text-[var(--cf-ink)] text-sm font-medium transition-colors hover:bg-[var(--cf-fill)]"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  setReseteando(true)
                  const tempPass = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 10)
                  try {
                    const res = await fetch(`/api/cobradores/${id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ password: tempPass }),
                    })
                    if (!res.ok) { setError('Error al resetear contraseña'); setShowReenviar(false); return }
                    setNuevaPass(tempPass)
                  } catch {
                    setError('Error de conexión')
                    setShowReenviar(false)
                  } finally {
                    setReseteando(false)
                  }
                }}
                disabled={reseteando}
                className="flex-1 h-10 rounded-[12px] bg-[var(--cf-gold)] hover:bg-[var(--cf-gold-dark)] text-[var(--cf-ink)] text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {reseteando ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Reseteando...
                  </>
                ) : 'Generar contraseña'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[var(--cf-green-dark)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm font-semibold text-[var(--cf-ink)]">Contraseña reseteada</p>
            </div>
            <div className="bg-[var(--cf-card)] border border-[var(--cf-border)] rounded-[12px] px-3 py-2">
              <p className="text-[10px] text-[var(--cf-ink-3)]">Nueva contraseña temporal</p>
              <p className="text-sm font-bold text-[var(--cf-gold)] font-mono">{nuevaPass}</p>
            </div>
            <CompartirCredenciales
              nombreCobrador={data.nombre}
              email={data.email}
              password={nuevaPass}
              telefono={data.telefono}
              nombreOwner={session?.user?.nombre}
            />
            <button
              onClick={() => { setShowReenviar(false); setNuevaPass('') }}
              className="w-full text-[10px] text-[var(--cf-ink-3)] hover:text-[var(--cf-ink-3)] transition-colors text-center pt-1"
            >
              Cerrar
            </button>
          </div>
        )}
      </Card>

      {/* Ruta */}
      <Card>
        <p className="text-[11px] font-extrabold uppercase tracking-[.07em] mb-3" style={{ color: 'var(--cf-ink-3)' }}>
          {susRutas.length > 1 ? `Rutas asignadas (${susRutas.length})` : 'Ruta asignada'}
        </p>

        {susRutas.length > 0 ? (
          <div className="flex flex-col gap-1">
            {susRutas.map((r) => (
              <div key={r.id} className="flex items-center gap-3">
                <Link href={`/rutas/${r.id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:bg-[var(--cf-card)] -mx-1 px-1 py-2 rounded-[12px] transition-colors">
                  <div className="w-9 h-9 rounded-full bg-[rgba(245,197,24,0.15)] flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-[var(--cf-gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </div>
                  {/* El nombre de la ruta NO se recorta: baja de renglón. */}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--cf-ink)]">{r.nombre}</p>
                    {/* ⚠ `cantidadClientes`, que es lo que devuelve `/api/rutas`.
                        Escribí `r.clientes.length` de memoria: el campo no viene,
                        daba `undefined`, y mi propio respaldo lo tapaba con un 0.
                        La ruta con 5 clientes decía «0 clientes» y no falla nada.
                        Se vio en la captura, no en el código. */}
                    <p className="text-xs text-[var(--cf-ink-3)]">
                      {`${r.cantidadClientes ?? (r.id === ruta?.id ? clientes.length : 0)} clientes`}
                    </p>
                  </div>
                </Link>
                {esOwner && (
                  <button type="button" disabled={asignando}
                    onClick={() => asignarRuta(r.id, null)}
                    className="text-[11px] font-semibold shrink-0 px-2 py-1 rounded-[8px]"
                    style={{ color: 'var(--cf-ink-3)', background: 'var(--cf-fill)' }}>
                    Quitar
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--cf-gold-dark)]">
            Sin ruta asignada{esOwner ? ': así no puede cobrar nada.' : ''}
          </p>
        )}

        {/* El asignador. Solo el dueño, y solo si el negocio tiene alguna ruta
            que este cobrador no lleve ya. */}
        {esOwner && rutasLibres.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-3">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--cf-ink-3)' }}>
              {susRutas.length > 0 ? 'Darle otra ruta' : 'Darle una ruta'}
            </span>
            <select
              value=""
              disabled={asignando}
              onChange={(e) => { if (e.target.value) asignarRuta(e.target.value, id) }}
              className="w-full"
              style={{
                height: 46, padding: '0 12px', borderRadius: 'var(--cf-r-control)',
                background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
                font: 'inherit', fontSize: 15, color: 'var(--cf-ink)',
              }}
            >
              <option value="">Elige una ruta…</option>
              {rutasLibres.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.cobrador ? `${r.nombre} — la lleva ${r.cobrador.nombre}` : `${r.nombre} — sin cobrador`}
                </option>
              ))}
            </select>
          </div>
        )}

        {esOwner && rutasOrg?.length === 0 && (
          <p className="text-[12px] mt-3" style={{ color: 'var(--cf-ink-3)' }}>
            Todavía no tienes rutas. Crea una en «Rutas» y podrás asignársela aquí.
          </p>
        )}

        {errorRuta && (
          <p className="text-[12px] mt-2" style={{ color: 'var(--cf-red-dark)' }}>{errorRuta}</p>
        )}
      </Card>

      {/* El cobrador anterior ya cerró caja o tiene pagos de hoy en esa ruta.
          Cambiarlo fragmentaría el cierre, así que se pregunta en vez de
          pisarlo — el API lo devuelve como 409 y aquí se ofrece el `forzar`. */}
      {/* ⚠ Las props son las de ESTE ConfirmModal: `onCancel`, `confirmLabel` y
          `confirmColor`. Escribí `onClose`, `confirmText` y `danger` de memoria,
          y sin TypeScript eso no revienta: sale un modal que no se puede
          cerrar. */}
      <ConfirmModal
        open={!!forzarRuta}
        onCancel={() => setForzarRuta(null)}
        onConfirm={() => asignarRuta(forzarRuta.rutaId, forzarRuta.quien, true)}
        title="¿Cambiar el cobrador de todos modos?"
        message={forzarRuta?.mensaje}
        confirmLabel="Cambiar igual"
        confirmColor="red"
        loading={asignando}
      />

      {/* Clientes de la ruta */}
      {clientes.length > 0 && (
        <Card>
          <p className="text-[11px] font-extrabold uppercase tracking-[.07em] mb-3" style={{ color: 'var(--cf-ink-3)' }}>
            Clientes ({clientes.length})
          </p>
          <div className="space-y-2">
            {clientes.map((c) => (
              <Link
                key={c.id}
                href={`/clientes/${c.id}`}
                className="flex items-center justify-between py-2 border-b border-[var(--cf-border)] last:border-0 hover:bg-[var(--cf-card)] -mx-1 px-1 rounded-[8px] transition-colors"
              >
                <p className="text-sm text-[var(--cf-ink)]">{c.nombre}</p>
                <Badge variant={c.estado === 'mora' ? 'red' : c.estado === 'activo' ? 'green' : 'gray'}>
                  {c.estado === 'mora' ? 'En mora' : c.estado === 'activo' ? 'Al día' : 'Cancelado'}
                </Badge>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <ConfirmModal
        open={confirmEliminar}
        title={`Eliminar cobrador`}
        message={data ? `¿Eliminar a "${data.nombre}"? ${data.recaudadoHoy > 0 || data.pagosMes > 0 ? 'Tiene historial de pagos, se desactivará en vez de eliminarse.' : 'Se eliminará permanentemente.'}` : ''}
        confirmLabel="Eliminar"
        confirmColor="red"
        onConfirm={async () => {
          setConfirmEliminar(false)
          setEliminando(true)
          const res = await fetch(`/api/cobradores/${id}`, { method: 'DELETE' })
          if (res.ok) router.push('/cobradores')
          else { alert('Error al eliminar'); setEliminando(false) }
        }}
        onCancel={() => setConfirmEliminar(false)}
      />
    </div>
  )
}
