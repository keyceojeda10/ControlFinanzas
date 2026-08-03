'use client'

import { useState, useEffect, useCallback } from 'react'
import { useCabecera } from '@/components/armazon/Armazon'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { StaggeredList } from '@/components/ui/StaggeredList'
import { formatMoney } from '@/lib/i18n'
import CardWaves from '@/components/ui/CardWaves'
import Avatar from '@/components/ui/Avatar'
import { useTheme } from '@/lib/theme/ThemeProvider'

const ESTADOS = [
  { value: '',         label: 'Todas' },
  { value: 'activa',   label: 'Activas' },
  { value: 'congelada', label: 'Congeladas' },
  { value: 'cerrada',  label: 'Cerradas' },
]

export default function LineasCreditoPage() {
  useCabecera({ titulo: 'Líneas de crédito' })

  const { esOwner, esCobrador, loading: authLoading } = useAuth()
  const router = useRouter()
  const [lineas, setLineas] = useState([])
  // Cuál se está viendo en el panel de la derecha. Sin valor cae a la primera,
  // para que el 1440 nunca salga con media pantalla en blanco —que es justo lo
  // que la lámina viene a arreglar.
  const [seleccionada, setSeleccionada] = useState(null)
  const [buscar, setBuscar] = useState('')
  const [estado, setEstado] = useState('activa')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && esCobrador) router.replace('/dashboard')
  }, [authLoading, esCobrador, router])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (estado) params.set('estado', estado)
      if (buscar) params.set('buscar', buscar)
      const res = await fetch(`/api/lineas-credito?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLineas(data)
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }, [estado, buscar])

  useEffect(() => { cargar() }, [cargar])

  if (authLoading) return <div className="p-4 space-y-3">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>

  const totalSaldo = lineas.reduce((s, l) => s + (l.saldoTotal || 0), 0)
  const totalCupo = lineas.reduce((s, l) => s + l.cupoMaximo, 0)

  // Sin `px-4`: el relleno lateral lo pone el armazon (`layout.jsx` con su
  // `px-5`) y sumarle 16 mas dejaba las tarjetas en 321px desde x=36 cuando la
  // zona util es 353 desde x=20.
  return (
    <div className="max-w-2xl lg:max-w-5xl mx-auto py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        {/* El titulo lo pone el armazon; el CONTEO se queda, que es lo que
            cambia y lo unico que la cabecera no puede saber. */}
        <div>
          <p className="text-xs text-[var(--cf-ink-3)]">
            {lineas.length} línea{lineas.length !== 1 ? 's' : ''} · Saldo total {formatMoney(totalSaldo)}
          </p>
        </div>
        {esOwner && (
          <Link href="/lineas-credito/nueva" className="cf-btn-primary inline-flex items-center justify-center font-medium rounded-[12px] border transition-all h-9 px-3 text-xs">
            + Nueva línea
          </Link>
        )}
      </div>

      {/* Explicacion */}
      <div className="mb-4 p-3 rounded-xl text-[11px] text-[var(--cf-ink-3)] leading-relaxed" style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
        Una línea de crédito funciona como un cupo rotativo: le apruebas un monto máximo al cliente y él puede pedir plata varias veces sin crear un préstamo nuevo cada vez. Al final del mes se genera un corte con lo que debe (capital + intereses) y puede pagar todo o una parte. Lo que no pague, rota al siguiente mes.
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
        {ESTADOS.map(e => (
          <button
            key={e.value}
            onClick={() => setEstado(e.value)}
            className={`shrink-0 px-3.5 h-9 rounded-full text-xs font-semibold transition-colors ${
              estado === e.value
                ? 'bg-[var(--cf-ink)] text-[var(--cf-surface)]'
                : 'bg-[var(--cf-card)] text-[var(--cf-ink-2)] border border-[var(--cf-border)]'
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>

      {/* Buscar */}
      <div className="relative mb-4">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--cf-ink-3)] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Buscar por nombre o cédula..."
          value={buscar}
          onChange={e => setBuscar(e.target.value)}
          className="w-full h-10 pl-11 pr-3 rounded-xl bg-[var(--cf-card)] border border-[var(--cf-border)] text-sm text-[var(--cf-ink)] placeholder-[var(--cf-ink-3)]"
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>
      ) : lineas.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-12 h-12 mx-auto text-[var(--cf-ink-3)] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15A2.25 2.25 0 002.25 6.75v10.5A2.25 2.25 0 004.5 19.5z" />
          </svg>
          {/* CON FILTRO Y SIN NADA NO SON EL MISMO VACIO.
              El filtro «Activas» viene puesto por defecto, asi que un negocio que
              no ha creado NINGUNA linea leia «no se encontraron lineas con esos
              filtros» y se quedaba sin salida: ni le explica que es esto ni le
              ofrece crear la primera. */}
          {buscar || estado ? (
            <>
              <p className="text-sm text-[var(--cf-ink-3)]">Ninguna línea con este filtro.</p>
              <button
                type="button"
                onClick={() => { setBuscar(''); setEstado('') }}
                className="mt-3 text-xs font-bold"
                style={{ color: 'var(--cf-gold-dark)' }}
              >
                Ver todas
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-[var(--cf-ink)]">
                Todavía no tienes líneas de crédito
              </p>
              <p className="text-[13px] text-[var(--cf-ink-3)] mt-1 max-w-xs mx-auto leading-relaxed">
                Un cupo que el cliente usa varias veces sin abrirle un préstamo cada vez.
              </p>
              {esOwner && (
                <Link href="/lineas-credito/nueva" className="cf-btn-primary inline-flex items-center justify-center font-medium rounded-[12px] border transition-all h-10 px-4 text-[13px] mt-4">
                  Crear la primera
                </Link>
              )}
            </>
          )}
        </div>
      ) : (
        /* ── LISTA Y DETALLE EN LA MISMA PANTALLA (T32-02) ──
           La lámina: «Hoy la lista dedica un 1440 entero a una sola tarjeta y
           el resto es blanco; hay que hacer clic para ver algo. Con pocos
           elementos lo correcto es lista y detalle en la misma pantalla.»
           Comprobado con una línea real: era exactamente eso.

           En móvil no cambia nada: la tarjeta sigue llevando a su ficha. */
        <div className="lg:grid lg:gap-4 lg:items-start" style={{ gridTemplateColumns: 'minmax(0,1fr) 380px' }}>
          <StaggeredList className="space-y-3">
            {lineas.map(linea => (
              <LineaCreditoCard
                key={linea.id}
                linea={linea}
                seleccionada={linea.id === (seleccionada ?? lineas[0]?.id)}
                onSeleccionar={() => setSeleccionada(linea.id)}
              />
            ))}
          </StaggeredList>

          <PanelLinea linea={lineas.find(l => l.id === (seleccionada ?? lineas[0]?.id))} />
        </div>
      )}
    </div>
  )
}

/* ── EL PANEL DE LA DERECHA ────────────────────────────────────────────────
   Solo cifras YA CALCULADAS por `calcularSaldoLinea` en el servidor. Aquí no se
   calcula interés ni proyección: una cifra de dinero inventada en el cliente es
   la forma más fácil de que dos pantallas se contradigan.

   El día de corte sube de tamaño porque la lámina lo llama el producto: «en un
   cupo rotativo la fecha de corte es el producto y hoy está en gris de 12px». */
function PanelLinea({ linea }) {
  if (!linea) return null

  const movimientos = [
    ...(linea.desembolsos || []).map(d => ({
      id: `d${d.id}`, fecha: d.createdAt, tipo: 'Le dio plata',
      interes: null, capital: -Math.round(d.monto),
    })),
    ...(linea.pagosLinea || []).map(p => ({
      id: `p${p.id}`, fecha: p.createdAt, tipo: 'Le pagó',
      interes: Math.round(p.montoAInteres || 0), capital: Math.round(p.montoACapital || 0),
    })),
  ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

  return (
    <aside className="hidden lg:block sticky top-4 rounded-[16px] p-4"
      style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
      <p className="text-[10px] font-extrabold uppercase tracking-[.07em]" style={{ color: 'var(--cf-ink-3)' }}>
        Corte
      </p>
      <p className="text-[19px] font-bold mt-0.5" style={{ color: 'var(--cf-ink)' }}>
        Día {linea.diaCorte} de cada mes
      </p>

      <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop: '1px solid var(--cf-border)' }}>
        {[
          ['Debe hoy', linea.saldoTotal],
          ['De eso, capital', linea.capitalUsado],
          ['De eso, intereses', linea.interesesPendientes],
          ['Le queda de cupo', linea.cupoDisponible],
        ].map(([etiqueta, valor]) => (
          <div key={etiqueta} className="flex items-center justify-between gap-3">
            <span className="text-[12px]" style={{ color: 'var(--cf-ink-3)' }}>{etiqueta}</span>
            <span className="cf-fig text-[13px] font-bold" style={{ color: 'var(--cf-ink)' }}>
              {formatMoney(valor ?? 0)}
            </span>
          </div>
        ))}
      </div>

      {/* Las dos columnas que la lámina pide: «cuánto fue a interés y cuánto a
          capital», que es con lo que se discute un cobro. */}
      <p className="text-[10px] font-extrabold uppercase tracking-[.07em] mt-4 mb-1.5" style={{ color: 'var(--cf-ink-3)' }}>
        Movimientos
      </p>
      {movimientos.length === 0 ? (
        <p className="text-[12px]" style={{ color: 'var(--cf-ink-3)' }}>Todavía no hay.</p>
      ) : (
        <div className="space-y-1.5">
          <div className="grid gap-2 text-[9.5px] font-extrabold uppercase tracking-[.06em]"
            style={{ gridTemplateColumns: '1fr 68px 78px', color: 'var(--cf-ink-3)' }}>
            <span>Qué pasó</span>
            <span style={{ textAlign: 'right' }}>A interés</span>
            <span style={{ textAlign: 'right' }}>A capital</span>
          </div>
          {movimientos.slice(0, 6).map(m => (
            <div key={m.id} className="grid gap-2 items-baseline"
              style={{ gridTemplateColumns: '1fr 68px 78px' }}>
              <span className="text-[12px] truncate" style={{ color: 'var(--cf-ink)' }}>
                {m.tipo}
                <span className="text-[10px] ml-1.5" style={{ color: 'var(--cf-ink-3)' }}>
                  {new Date(m.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                </span>
              </span>
              <span className="cf-fig text-[12px]" style={{ textAlign: 'right', color: 'var(--cf-ink-3)' }}>
                {m.interes === null ? '—' : formatMoney(m.interes)}
              </span>
              <span className="cf-fig text-[12px] font-semibold" style={{
                textAlign: 'right',
                color: m.capital < 0 ? 'var(--cf-ink-2)' : 'var(--cf-green-dark)',
              }}>
                {/* El signo DELANTE del símbolo. `formatMoney(-8000000)` da
                    «$-8.000.000», que se lee mal y no es como lo pinta la caja.
                    Se formatea el valor absoluto y el menos se pone aparte. */}
                {m.capital < 0 ? '−' : ''}{formatMoney(Math.abs(m.capital))}
              </span>
            </div>
          ))}
        </div>
      )}

      <Link href={`/lineas-credito/${linea.id}`}
        className="block text-center text-[12px] font-bold mt-4 rounded-[10px] py-2"
        style={{
          color: 'var(--cf-gold-dark)',
          background: 'color-mix(in srgb, var(--cf-gold) 10%, transparent)',
        }}>
        Abrir la línea
      </Link>
    </aside>
  )
}

function LineaCreditoCard({ linea, seleccionada, onSeleccionar }) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const porcentajeUsado = linea.cupoMaximo > 0
    ? Math.round((linea.capitalUsado || 0) / linea.cupoMaximo * 100)
    : 0

  const congelada = linea.estado === 'congelada'
  const cerrada = linea.estado === 'cerrada'

  const P = isDark
    ? congelada ? {
        grad: 'linear-gradient(135deg, #2a2410 0%, #3d3518 40%, #4a3f1c 60%, #352d14 100%)',
        ink: '#f0e4be', sub: 'rgba(240, 228, 190, 0.65)', accent: '#eab308',
        track: 'rgba(240, 228, 190, 0.14)', border: 'rgba(234, 179, 8, 0.32)',
        shadow: '0 8px 20px rgba(0,0,0,0.35)', waves: 'rgba(234,179,8,0.07)',
        sheen: 'linear-gradient(105deg, transparent 35%, rgba(255,230,100,0.08) 48%, rgba(255,240,150,0.12) 52%, transparent 65%)',
      }
      : cerrada ? {
        grad: 'linear-gradient(135deg, #1a1d22 0%, #22262c 55%, #282d35 100%)',
        ink: '#c8cdd5', sub: 'rgba(200, 205, 213, 0.55)', accent: '#94a3b8',
        track: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.22)',
        shadow: '0 8px 20px rgba(0,0,0,0.35)', waves: 'rgba(148,163,184,0.05)',
        sheen: 'none',
      }
      : {
        grad: 'linear-gradient(135deg, #0a1628 0%, #112244 25%, #1e3a6e 50%, #153060 75%, #0d1f3d 100%)',
        ink: '#e0ecff', sub: 'rgba(180, 210, 255, 0.65)', accent: '#60a5fa',
        track: 'rgba(96, 165, 250, 0.16)', border: 'rgba(96, 165, 250, 0.35)',
        shadow: '0 8px 22px rgba(0,0,0,0.45)', waves: 'rgba(100,180,255,0.09)',
        sheen: 'linear-gradient(105deg, transparent 30%, rgba(120,180,255,0.10) 45%, rgba(200,225,255,0.14) 50%, rgba(120,180,255,0.10) 55%, transparent 70%)',
      }
    : congelada ? {
        grad: 'linear-gradient(135deg, #b45309 0%, #d97706 25%, var(--cf-gold-dark) 50%, #d97706 75%, #b45309 100%)',
        ink: '#ffffff', sub: 'rgba(255, 255, 255, 0.72)', accent: '#fef3c7',
        track: 'rgba(255, 255, 255, 0.18)', border: 'rgba(255, 255, 255, 0.25)',
        shadow: '0 6px 18px rgba(180, 83, 9, 0.25)', waves: 'rgba(255,255,255,0.07)',
        sheen: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.10) 48%, rgba(255,255,255,0.18) 52%, transparent 65%)',
      }
      : cerrada ? {
        grad: 'linear-gradient(135deg, var(--cf-ink-3) 0%, #94a3b8 50%, var(--cf-ink-3) 100%)',
        ink: '#f8fafc', sub: 'rgba(248, 250, 252, 0.65)', accent: '#e2e8f0',
        track: 'rgba(255, 255, 255, 0.14)', border: 'rgba(255, 255, 255, 0.20)',
        shadow: '0 6px 18px rgba(0,0,0,0.12)', waves: 'rgba(255,255,255,0.05)',
        sheen: 'none',
      }
      : {
        grad: 'linear-gradient(135deg, #1e40af 0%, #2563eb 25%, #3b82f6 50%, #2563eb 75%, #1e40af 100%)',
        ink: '#ffffff', sub: 'rgba(255, 255, 255, 0.72)', accent: '#bfdbfe',
        track: 'rgba(255, 255, 255, 0.18)', border: 'rgba(255, 255, 255, 0.25)',
        shadow: '0 6px 20px rgba(30, 64, 175, 0.28)', waves: 'rgba(255,255,255,0.08)',
        sheen: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.12) 55%, transparent 70%)',
      }

  const estadoLabel = linea.estado.charAt(0).toUpperCase() + linea.estado.slice(1)

  return (
    <Card
      as={Link}
      href={`/lineas-credito/${linea.id}`}
      // ── EN ESCRITORIO SELECCIONA, NO NAVEGA ──
      // El detalle está AL LADO: irse a otra pantalla seria perder la lista que
      // la lamina quiere tener a la vista. En movil no hay panel, asi que el
      // enlace hace lo de siempre —y sigue siendo un <a> de verdad, con lo que
      // «abrir en pestaña nueva» tambien funciona en los dos casos.
      onClick={(e) => {
        if (onSeleccionar && window.matchMedia('(min-width: 1024px)').matches) {
          e.preventDefault()
          onSeleccionar()
        }
      }}
      padding={false}
      className="block px-4 py-4 group relative overflow-hidden"
      // UN SOLO `style`. Habia dos y el segundo pisaba al primero, asi que el
      // resalte de la tarjeta elegida NO SE PINTABA NUNCA. No lo vio el servidor
      // de desarrollo, ni las pruebas, ni el barrido de rutas: lo caza el
      // `build`, que es el unico que compila de verdad.
      style={{
        background: P.grad,
        border: `1px solid ${P.border}`,
        boxShadow: P.shadow,
        ...(seleccionada ? { outline: '2px solid var(--cf-gold)', outlineOffset: 2 } : null),
      }}
    >
      <CardWaves tint={P.waves} />
      {P.sheen && P.sheen !== 'none' && (
        <div className="absolute inset-0 pointer-events-none" style={{ background: P.sheen }} />
      )}

      <div className="relative">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar
              nombre={linea.cliente?.nombre}
              size={34}
              fontSize={12}
              style={{ border: `2px solid color-mix(in srgb, ${P.ink} 20%, transparent)` }}
            />
            <div className="min-w-0">
              <p className="text-sm font-bold truncate leading-tight" style={{ color: P.ink }}>
                {linea.cliente?.nombre}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: P.sub }}>
                CC {linea.cliente?.cedula} · Cupo {formatMoney(linea.cupoMaximo)}
              </p>
            </div>
          </div>
          <span
            className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{
              background: `color-mix(in srgb, ${P.accent} 14%, transparent)`,
              color: P.accent,
              border: `1px solid color-mix(in srgb, ${P.accent} 26%, transparent)`,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: P.accent }} />
            {estadoLabel}
          </span>
        </div>

        <div className="mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] mb-1" style={{ color: P.sub }}>
            Saldo actual
          </p>
          <p
            className="font-mono-display font-bold leading-none tracking-tight"
            style={{ color: P.ink, fontSize: 'clamp(20px, 5vw, 24px)' }}
          >
            {formatMoney(linea.saldoTotal || 0)}
          </p>
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span style={{ color: P.sub }}>Uso del cupo</span>
            <span className="font-mono-display font-bold" style={{ color: P.accent }}>
              {porcentajeUsado}%
            </span>
          </div>
          <div className="h-[5px] rounded-full overflow-hidden" style={{ background: P.track }}>
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${Math.max(porcentajeUsado, 2)}%`, background: P.accent }}
            />
          </div>
        </div>

        <div
          className="grid grid-cols-2 gap-2 pt-2.5"
          style={{ borderTop: `1px solid ${P.track}` }}
        >
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: P.sub }}>Disponible</p>
            <p className="text-[12px] font-mono-display font-bold mt-0.5" style={{ color: P.ink }}>
              {formatMoney(linea.cupoDisponible || 0)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: P.sub }}>Tasa mensual</p>
            <p className="text-[12px] font-mono-display font-bold mt-0.5" style={{ color: P.ink }}>
              {linea.tasaInteres}%
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
