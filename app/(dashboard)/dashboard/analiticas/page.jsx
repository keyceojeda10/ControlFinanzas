'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useCabecera } from '@/components/armazon/Armazon'
import { useAuth } from '@/hooks/useAuth'
import { formatMoney } from '@/lib/i18n'
import Link from 'next/link'
import { rotulo } from '@/lib/dinero/definiciones'
import PlanGate from '@/components/ui/PlanGate'

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-[10px] bg-[var(--cf-fill)] ${className}`} />
}

function Card({ children, className = '', href }) {
  const cls = `bg-[var(--cf-card)] border border-[var(--cf-border)] rounded-[16px] p-4 lg:p-5 ${className}`
  if (href) return <Link href={href} className={`${cls} hover:border-[var(--cf-border-strong)] transition-colors block`}>{children}</Link>
  return <div className={cls}>{children}</div>
}

function Badge({ value, suffix = '%' }) {
  if (value === 0 || value === undefined) return null
  const positive = value > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${positive ? 'bg-[var(--cf-green-pill-bg)] text-[var(--cf-green-dark)]' : 'bg-[var(--cf-red-pill-bg)] text-[var(--cf-red-dark)]'}`}>
      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ transform: positive ? 'none' : 'rotate(180deg)' }}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
      </svg>
      {Math.abs(value)}{suffix}
    </span>
  )
}

function ProgressBar({ value, max, color = 'var(--cf-gold)', height = 8 }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="w-full rounded-full bg-[var(--cf-fill)] overflow-hidden" style={{ height }}>
      <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

function BarChart({ data, dataKey, color = 'var(--cf-gold)', formatValue }) {
  if (!data?.length) return null
  const max = Math.max(...data.map(d => d[dataKey]), 1)
  const fmt = formatValue || (v => v.toLocaleString())
  return (
    <div className="space-y-1.5">
      {data.map((d, i) => {
        const pct = (d[dataKey] / max) * 100
        const mesLabel = new Date(d.mes + '-15').toLocaleDateString('es', { month: 'short' })
        return (
          <div key={i} className="flex items-center gap-2.5">
            <span className="text-[11px] w-8 text-right text-[var(--cf-ink-3)] font-medium uppercase">{mesLabel}</span>
            <div className="flex-1 h-7 rounded-[6px] bg-[var(--cf-fill)] overflow-hidden relative">
              <div className="h-full rounded-[6px] transition-all duration-500 ease-out" style={{ width: `${Math.max(pct, 2)}%`, background: color }} />
              {d[dataKey] > 0 && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono font-semibold text-[var(--cf-ink-2)]">{fmt(d[dataKey])}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── LA REJILLA DE «QUÉ RINDE CADA RUTA», EN UN SOLO SITIO ──
   Cabecera y filas salen de esta MISMA constante. Cuando cada una lleva su
   propia lista de anchos, se descuadran en cuanto alguien toca una: en la lista
   de clientes la cabecera acabó con una columna más que las filas, en el JSX se
   veía correcto y solo apareció midiendo la rejilla en el navegador.
   En móvil se cae a dos columnas —nombre y ganancia— y el resto se pliega
   debajo; a 393px no caben cinco. */
const COLS_RUTA = '28px minmax(0,1fr) 92px 104px 118px'

function FilaRuta({ r, i, maxRoi, fmtShort, cabecera, huerfana }) {
  /* ⚠ `display` NO va aquí. Iba, y por eso la cabecera de la tabla —que lleva
     `hidden sm:grid`— se pintaba igualmente en el móvil: el estilo en línea le
     gana siempre a la clase, así que `hidden` no tenía ningún efecto. Medido a
     393px: «Rinde» se salía de la pantalla, de 301 a 419.

     Las filas ya lo hacían bien (se caen a dos columnas y usan `sm:!grid-cols`
     para las cinco); solo la cabecera se quedó a medias. Cada uso declara su
     propio `display` por clase. */
  const base = {
    gridTemplateColumns: COLS_RUTA,
    alignItems: 'center',
    gap: 10,
    padding: '0 16px',
  }

  if (cabecera) {
    return (
      <div className="hidden sm:grid" style={{
        ...base,
        height: 38,
        background: 'var(--cf-fill)',
        borderTop: '1px solid var(--cf-border)',
        borderBottom: '1px solid var(--cf-border)',
      }}>
        <span />
        <span className="text-[10px] font-bold uppercase tracking-[.07em] text-[var(--cf-ink-3)]">Ruta</span>
        <span className="text-[10px] font-bold uppercase tracking-[.07em] text-[var(--cf-ink-3)] text-right">Capital</span>
        <span className="text-[10px] font-bold uppercase tracking-[.07em] text-[var(--cf-ink-3)] text-right">Ganancia</span>
        <span className="text-[10px] font-bold uppercase tracking-[.07em] text-[var(--cf-ink-3)] pl-3">Rinde</span>
      </div>
    )
  }

  /* La barra se mide contra el MEJOR RENDIMIENTO, no contra el 100%: los ROI
     mensuales reales rondan el 8-17% y contra 100 todas saldrían casi vacías,
     sin diferenciar la buena de la mala. */
  const pctBarra = maxRoi > 0 ? Math.max(2, Math.min(100, Math.round((r.roi / maxRoi) * 100))) : 2
  const tinta = huerfana ? 'var(--cf-red-darker)' : undefined

  return (
    <div
      className="grid sm:!grid-cols-[28px_minmax(0,1fr)_92px_104px_118px]"
      style={{
        ...base,
        gridTemplateColumns: 'minmax(0,1fr) auto',
        rowGap: 6,
        padding: '10px 16px',
        minHeight: 46,
        borderBottom: '1px solid var(--cf-border)',
        ...(huerfana ? {
          background: 'var(--cf-red-bg)',
          borderTop: '1px solid var(--cf-red-border)',
          borderBottom: 'none',
        } : null),
      }}
    >
      {huerfana ? (
        <span className="hidden sm:flex items-center">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cf-red)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" />
          </svg>
        </span>
      ) : (
        <span className="hidden sm:block cf-fig text-[13px] text-[var(--cf-ink-4)]">{i + 1}</span>
      )}

      <span className="min-w-0 flex items-baseline gap-2">
        <span className="text-[13px] font-semibold truncate" style={{ color: tinta }}>{r.nombre}</span>
        <span className="text-[11px] shrink-0" style={{ color: huerfana ? 'var(--cf-red-dark)' : 'var(--cf-ink-3)' }}>
          {r.prestamos} {r.prestamos === 1 ? 'préstamo' : 'préstamos'}
        </span>
      </span>

      {/* En móvil la ganancia se sube al lado del nombre: es la cifra que se
          busca. Capital y rendimiento bajan al segundo renglón. */}
      <span className="sm:hidden cf-fig text-[13px] text-right" style={{ color: tinta || 'var(--cf-green-dark)' }}>
        {fmtShort(r.interesGanado)}
      </span>

      <span className="hidden sm:block cf-fig text-[13px] text-right text-[var(--cf-ink-2)]" style={{ color: tinta }}>
        {fmtShort(r.capitalDesplegado)}
      </span>
      <span className="hidden sm:block cf-fig text-[13px] text-right" style={{ color: tinta || 'var(--cf-green-dark)' }}>
        {fmtShort(r.interesGanado)}
      </span>

      {/* En móvil ocupa el renglón entero (`col-span-2`); en escritorio vuelve a
          ser la quinta columna de la rejilla, que es donde la pone la cabecera. */}
      <span className="col-span-2 sm:col-span-1 flex items-center gap-2 sm:pl-3">
        <span className="rounded-full overflow-hidden shrink-0" style={{
          width: 52, height: 6,
          background: huerfana ? 'var(--cf-red-pill-bg)' : 'var(--cf-fill)',
        }}>
          <span style={{
            display: 'block', height: 6, width: `${pctBarra}%`,
            background: huerfana ? 'var(--cf-red)' : 'var(--cf-green)',
          }} />
        </span>
        <span className="cf-fig text-[12px]" style={{ color: tinta || 'var(--cf-ink-2)' }}>{r.roi}%</span>
        <span className="sm:hidden text-[11px] text-[var(--cf-ink-3)] truncate">
          sobre {fmtShort(r.capitalDesplegado)}
        </span>
      </span>
    </div>
  )
}

const SEV_STYLES = {
  grave:    { bg: 'bg-[var(--cf-red-pill-bg)]', text: 'text-[var(--cf-red-dark)]' },
  moderada: { bg: 'bg-[var(--cf-gold-tint)]', text: 'text-[var(--cf-gold-dark)]' },
  leve:     { bg: 'bg-[var(--cf-fill)]', text: 'text-[var(--cf-ink-3)]' },
}

export default function AnaliticasPage() {
  useCabecera({ titulo: 'Analíticas' })

  const { session } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const router = useRouter()
  const [sinPlan, setSinPlan] = useState(false)
  const [showAllAlertas, setShowAllAlertas] = useState(false)

  /* El mismo PDF vive como informe «Cómo rindió el negocio», con su pantalla y
     con Excel además del PDF. Bajarlo también desde aquí, por su cuenta, es la
     segunda vía que acaba dando otra cifra. El botón se queda y lleva allí. */
  const verInformeDeRendimiento = () => router.push('/reportes/rendimiento?periodo=mes')

  const country = session?.user?.country || 'CO'
  const fmt = useCallback(v => formatMoney(v, country), [country])
  const fmtShort = useCallback(v => {
    const abs = Math.abs(v)
    if (abs >= 1_000_000) return (v < 0 ? '-' : '') + (abs / 1_000_000).toFixed(1).replace('.0', '') + 'M'
    if (abs >= 10_000) return (v < 0 ? '-' : '') + Math.round(abs / 1000) + 'K'
    return formatMoney(v, country)
  }, [country])

  useEffect(() => {
    // ── UNA PETICION ABORTADA NO ES UN ERROR ──
    // La pantalla enseñaba «signal is aborted without reason» EN ROJO, en
    // ingles y con el texto crudo del navegador. Pasa cada vez que se sale de
    // aqui antes de que termine de cargar —que es a menudo— y lo que ve el
    // dueño es su analitica rota por una frase que no significa nada para el.
    //
    // Con `AbortController`: al desmontar se cancela, y ese caso se ignora.
    // Ademas el mensaje de los errores de verdad se escribe aqui, en castellano
    // y diciendo que hacer; `e.message` puede ser cualquier cosa del navegador.
    const ctrl = new AbortController()
    fetch('/api/dashboard/analiticas', { signal: ctrl.signal })
      .then(async (r) => {
        /* ⚠ UN 403 POR PLAN NO ES UN FALLO DE CONEXION. Al cerrar Analiticas a
           Basico, este `catch` le habria dicho «revisa la conexion» a los 322
           negocios en plan Inicial: culpa del internet del cliente por algo que
           es de su plan, y ni una pista de que se arregla pagando. */
        if (r.status === 403) {
          const cuerpo = await r.json().catch(() => ({}))
          if (cuerpo?.motivo === 'plan') { setSinPlan(true); setLoading(false); return null }
        }
        if (!r.ok) throw new Error('Error cargando datos')
        return r.json()
      })
      .then((d) => { if (d) { setData(d); setLoading(false) } })
      .catch((e) => {
        if (e?.name === 'AbortError') return   // salimos de la pantalla, no es un fallo
        setError('No pudimos cargar tus números. Revisa la conexión y vuelve a intentarlo.')
        setLoading(false)
      })
    return () => ctrl.abort()
  }, [])

  if (sinPlan) {
    return (
      <PlanGate
        titulo="Analíticas de tu negocio"
        texto="Cuánto estás ganando de verdad, quién te está quedando mal y para dónde va el mes."
        incluye={[
          'Rendimiento del mes sobre lo que tienes en la calle',
          // «Ganancia neta» esta prohibido: convivia con «Utilidad neta» en
          // la misma pantalla siendo dos numeros distintos. El nombre bueno lo
          // pone `rotulo('gananciaMes')`.
          `${rotulo('gananciaMes')}, gastos y capital en calle`,
          'Quién está atrasado y cuánto hay en riesgo',
          'Recaudado y gastos de los últimos 6 meses',
          'Informe en PDF para el contador o el socio',
        ]}
      />
    )
  }

  if (loading) {
    return (
      <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-24" />
        <Skeleton className="h-56" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 lg:p-8 max-w-5xl mx-auto">
        <p className="text-[var(--cf-red-dark)] text-[14px]">{error}</p>
        <Link href="/dashboard" className="text-[13px] text-[var(--cf-ink-2)] underline mt-2 block">Volver al dashboard</Link>
      </div>
    )
  }

  const { resumen, proyeccion, alertas, alertasResumen, cartera, cobradores, tendenciaMensual, rentabilidad } = data
  const alertasVisibles = showAllAlertas ? alertas : alertas.slice(0, 5)

  /* El API ordena por GANANCIA en pesos y mete «sin ruta» como una más. Aquí se
     reordena por rendimiento y se aparta la huérfana; no se toca el API porque
     el mismo payload lo consume el PDF de rendimiento.
     `rutaId === null` es la marca de la huérfana: el API le pone el nombre
     'Sin ruta' cuando `rutaNombre` viene vacío, así que comparar por nombre
     rompería en cuanto alguien bautice una ruta suya «Sin ruta». */
  const todasLasRutas = rentabilidad?.porRuta || []
  const sinRuta = todasLasRutas.find((r) => !r.rutaId) || null
  const rutasOrdenadas = todasLasRutas.filter((r) => r.rutaId).sort((a, b) => b.roi - a.roi)
  const maxRoi = Math.max(...todasLasRutas.map((r) => r.roi || 0), 1)

  return (
    <div className="py-4 lg:p-8 max-w-5xl lg:max-w-[1180px] mx-auto pb-24 space-y-4 lg:space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        {/* Titulo en la cabecera. Se queda el boton de descargar, que es la
            unica accion de esta pantalla. */}
        <div />
        <button
          onClick={verInformeDeRendimiento}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[var(--cf-fill)] text-[var(--cf-ink-2)] hover:bg-[var(--cf-border-strong)] transition-colors text-[12px] font-medium disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Informe
        </button>
      </div>

      {/* === T31-02 · LO QUE RINDE TU CAPITAL, EN NEGRO ===
          Era una tarjeta blanca mas entre siete tarjetas blancas: la cifra que
          contesta «¿esto da o no da?» pesaba lo mismo que el resto. En carbon,
          y con las tres cifras que la sostienen en la misma fila, es lo primero
          que se lee al entrar — que es el trabajo de esta pantalla. */}
      <div style={{
        background: '#15161A', borderRadius: 'var(--cf-r-hero)',
        padding: '22px 26px', color: '#F3F3F6',
      }}>
        <div className="flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-9">
          <div style={{ flex: 'none' }}>
            <p className="text-[10px] font-bold uppercase tracking-[.1em]" style={{ color: '#A3A8B2' }}>
              Lo que rinde tu capital
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="cf-fig text-[40px] lg:text-[52px]" style={{
                letterSpacing: '-.04em', lineHeight: 1,
                color: resumen.roiMensual >= 0 ? '#2FBE6A' : '#F0575C',
              }}>{resumen.roiMensual}%</span>
              <span className="text-[13px]" style={{ color: '#A3A8B2' }}>al mes</span>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* La base es un MILLÓN, no cien pesos.
                Decía «Por cada $100 en la calle, ganas $X» con X = el ROI, que
                es un PORCENTAJE pintado como pesos. Con un 0,2% mensual la
                frase salía «ganas $0 neto»: aritméticamente son 20 centavos, y
                redondeados a pesos le decían al dueño que no gana nada.
                Con base un millón el número se lee. */}
            <p className="text-[14px] lg:text-[15px]" style={{ color: '#F3F3F6', margin: 0 }}>
              Por cada {fmt(1000000)} en la calle, ganas{' '}
              <strong style={{ color: 'var(--cf-gold-light)' }}>
                {fmt(Math.round(resumen.roiMensual * 10000))} neto
              </strong>{' '}al mes.
            </p>
            {/* La variable se llama `etiqueta`, no `rotulo`: con ese nombre
                SOMBREABA la función `rotulo()` importada dentro del map. Aquí
                funcionaba de casualidad —el array se construye fuera— pero es
                una mina para el siguiente que añada una fila. */}
            <div className="grid grid-cols-3 gap-4 mt-4 items-end">
              {[
                [rotulo('gananciaMes'), resumen.gananciaNetaMes, true],
                ['Recaudado', resumen.recaudadoMes, false],
                [rotulo('capitalEnCalle'), resumen.capitalEnCalle, false],
              ].map(([etiqueta, valor, verde]) => (
                <div key={etiqueta}>
                  {/* Dos líneas reservadas: los rótulos salen del diccionario y
                      pueden ser de cualquier largo. Sin esto, «Recaudado» ocupa
                      una línea y su cifra queda a otra altura que las demás. */}
                  <p className="text-[10px] font-bold uppercase tracking-[.09em]"
                     style={{ color: '#8A8E98', minHeight: '2.2em' }}>{etiqueta}</p>
                  <p className="cf-fig text-[15px] lg:text-[19px] mt-1 truncate" style={{
                    color: verde && valor < 0 ? '#F0575C' : '#F3F3F6',
                  }}>
                    <span className="hidden sm:inline">{fmt(valor)}</span>
                    <span className="sm:hidden">{fmtShort(valor)}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* === T31-02 · EL REPARTO EN ESCRITORIO ===
          A 1440 esto eran NUEVE tarjetas del ancho del móvil, una debajo de
          otra: la tabla de rutas quedaba a dos pantallas de scroll de la cifra
          de rendimiento que hay que comparar con ella, y media pantalla en
          blanco a los lados.
          El corte no es por tamaño: a la IZQUIERDA lo que se analiza a fondo
          —qué rinde cada ruta, quién recauda—, a la DERECHA lo que se consulta
          de un vistazo mientras se mira lo otro.
          En móvil `lg:` no aplica y sigue siendo una columna, en el mismo
          orden de siempre. */}
      <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-[1.55fr_1fr] lg:gap-5 lg:items-start">
        {/* ── COLUMNA IZQUIERDA: lo que se estudia ── */}
        <div className="space-y-4 lg:space-y-5 min-w-0">

          {/* === Alertas de mora === */}
          {alertasResumen.total > 0 && (
            <Card className={alertasResumen.graves > 0 ? '!border-[var(--cf-red-dark)]' : ''}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--cf-red-dark)]">
                    {alertasResumen.total} en mora
                  </p>
                  <p className="text-[11px] text-[var(--cf-ink-3)] mt-0.5">
                    {fmt(alertasResumen.montoTotal)} en riesgo
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  {alertasResumen.graves > 0 && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--cf-red-pill-bg)] text-[var(--cf-red-dark)] font-bold">{alertasResumen.graves} graves</span>
                  )}
                  {alertasResumen.moderadas > 0 && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--cf-gold-tint)] text-[var(--cf-gold-dark)] font-bold">{alertasResumen.moderadas} mod.</span>
                  )}
                  {alertasResumen.leves > 0 && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--cf-fill)] text-[var(--cf-ink-3)] font-bold">{alertasResumen.leves} leves</span>
                  )}
                </div>
              </div>

              <div className="space-y-0.5">
                {alertasVisibles.map(a => {
                  const sev = SEV_STYLES[a.severidad]
                  return (
                    <Link
                      key={a.prestamoId}
                      href={`/prestamos/${a.prestamoId}`}
                      className="flex items-center justify-between py-2 px-2 sm:px-3 rounded-[10px] hover:bg-[var(--cf-fill)] transition-colors group gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${sev.bg} ${sev.text} shrink-0`}>
                          {a.diasMora}d
                        </span>
                        <span className="text-[12px] sm:text-[13px] font-medium text-[var(--cf-ink)] truncate">{a.clienteNombre}</span>
                      </div>
                      <span className="text-[11px] sm:text-[12px] font-mono font-bold text-[var(--cf-ink-2)] shrink-0">{fmtShort(a.montoEnRiesgo)}</span>
                    </Link>
                  )
                })}
              </div>

              {alertas.length > 5 && (
                <button
                  onClick={(e) => { e.preventDefault(); setShowAllAlertas(!showAllAlertas) }}
                  className="w-full text-center text-[12px] text-[var(--cf-ink-2)] font-medium mt-2 py-1 hover:underline"
                >
                  {showAllAlertas ? 'Ver menos' : `Ver todos (${alertas.length})`}
                </button>
              )}
            </Card>
          )}

          {/* === T31-02 · QUÉ RINDE CADA RUTA ===
              Ordenada por RENDIMIENTO, no por ganancia. Es lo que pide el pie de la
              lámina y arregla una lectura falsa: ordenado por pesos, un 16,5% sobre
              $1,5M caía por debajo de un 8,7% sobre $6,4M, y la ruta que mejor
              trabaja el capital parecía la peor.
              Por eso van las TRES cifras juntas —capital, ganancia y %—: un
              porcentaje solo no se puede juzgar. */}
          {rutasOrdenadas.length > 0 && (
            <Card className="!p-0 overflow-hidden">
              <div className="flex items-baseline justify-between px-4 lg:px-5 pt-4 pb-3 gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--cf-ink-3)]">Qué rinde cada ruta</p>
                <span className="text-[11px] text-[var(--cf-ink-3)] shrink-0">
                  {rutasOrdenadas.length} {rutasOrdenadas.length === 1 ? 'ruta' : 'rutas'} · por rendimiento
                </span>
              </div>

              <FilaRuta cabecera />
              {rutasOrdenadas.map((r, i) => (
                <FilaRuta key={r.rutaId || i} r={r} i={i} maxRoi={maxRoi} fmtShort={fmtShort} />
              ))}

              {/* «Sin ruta» NO es una ruta, es un agujero: préstamos que no salen en
                  la pantalla de nadie. Va al pie, con su propio fondo, fuera del
                  ranking —si compitiera, su rendimiento lo colocaría entre las
                  buenas y se leería como una ruta más que va bien. */}
              {sinRuta && (
                <FilaRuta r={sinRuta} maxRoi={maxRoi} fmtShort={fmtShort} huerfana />
              )}
            </Card>
          )}

          {/* === Cobradores === */}
          {cobradores.length > 0 && (
            <Card href="/cobradores">
              <div className="flex items-start justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--cf-ink-3)]">Cobradores este mes</p>
                <svg className="w-3.5 h-3.5 text-[var(--cf-ink-3)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div className="space-y-3">
                {cobradores.map((c, i) => {
                  const max = cobradores[0]?.recaudado || 1
                  return (
                    <div key={c.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${i < 3 ? 'bg-[var(--cf-gold-tint)] text-[var(--cf-gold)]' : 'bg-[var(--cf-fill)] text-[var(--cf-ink-3)]'}`}>
                            {i + 1}
                          </span>
                          <span className="text-[12px] sm:text-[13px] font-medium truncate">{c.nombre}</span>
                          {c.rol === 'owner' && <span className="text-[11px] px-1 py-0.5 rounded bg-[var(--cf-fill)] text-[var(--cf-ink-3)] shrink-0">admin</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-[var(--cf-ink-3)] font-mono hidden sm:inline">{c.pagos} pagos</span>
                          <span className="text-[12px] sm:text-[13px] font-mono font-bold">{fmtShort(c.recaudado)}</span>
                        </div>
                      </div>
                      <div className="ml-7">
                        <ProgressBar value={c.recaudado} max={max} color={i === 0 ? 'var(--cf-gold)' : 'var(--cf-ink-2)'} height={4} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </div>

        {/* ── COLUMNA DERECHA: lo que se consulta de un vistazo ── */}
        <div className="space-y-4 lg:space-y-5 min-w-0">
          {/* === Proyección del mes === */}
          <Card>
            <div className="flex items-start justify-between mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--cf-ink-3)]">Proyección del mes</p>
              <span className="text-[10px] font-mono text-[var(--cf-ink-3)]">día {proyeccion.diasHabiles}/{proyeccion.diasHabilesTotalMes}</span>
            </div>
            <ProgressBar value={proyeccion.recaudado} max={proyeccion.esperado} color="var(--cf-gold)" height={10} />
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div>
                <p className="text-[11px] text-[var(--cf-ink-3)]">Recaudado</p>
                <p className="text-[13px] lg:text-[15px] font-mono font-bold truncate">
                  <span className="hidden sm:inline">{fmt(proyeccion.recaudado)}</span>
                  <span className="sm:hidden">{fmtShort(proyeccion.recaudado)}</span>
                </p>
              </div>
              <div className="text-center">
                <p className="text-[11px] text-[var(--cf-ink-3)]">Prom. diario</p>
                <p className="text-[13px] lg:text-[15px] font-mono font-bold text-[var(--cf-ink-2)] truncate">
                  <span className="hidden sm:inline">{fmt(proyeccion.promedioDiario)}</span>
                  <span className="sm:hidden">{fmtShort(proyeccion.promedioDiario)}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-[var(--cf-ink-3)]">Proyectado</p>
                <p className="text-[13px] lg:text-[15px] font-mono font-bold text-[var(--cf-gold)] truncate">
                  <span className="hidden sm:inline">{fmt(proyeccion.proyectado)}</span>
                  <span className="sm:hidden">{fmtShort(proyeccion.proyectado)}</span>
                </p>
              </div>
            </div>
            {proyeccion.esperado > 0 && (
              <p className="text-[10px] text-[var(--cf-ink-3)] mt-2 text-center">
                {/* CON LA CIFRA ESPERADA, o el porcentaje no se puede comprobar.
                    Salia «95% por debajo de lo esperado» justo al lado de
                    «Proyectado 1M», y las dos juntas se leen como que se contradicen:
                    si proyectas un millon, ¿un 95% por debajo de qué? Lo esperado no
                    se enseñaba en ningun sitio de la tarjeta. */}
                {proyeccion.proyectado >= proyeccion.esperado
                  ? `${Math.round(((proyeccion.proyectado / proyeccion.esperado) - 1) * 100)}% por encima de los ${fmtShort(proyeccion.esperado)} esperados`
                  : `${Math.round((1 - (proyeccion.proyectado / proyeccion.esperado)) * 100)}% por debajo de los ${fmtShort(proyeccion.esperado)} esperados`
                }
              </p>
            )}
          </Card>

          {/* === Desglose de rentabilidad === */}
          {rentabilidad && (
            <Card>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--cf-ink-3)] mb-3">De cada peso recaudado</p>
              {(() => {
                const total = rentabilidad.interesGanadoMes + rentabilidad.capitalRecuperadoMes
                const pctInteres = total > 0 ? Math.round((rentabilidad.interesGanadoMes / total) * 100) : 0
                const pctCapital = 100 - pctInteres
                return (
                  <>
                    <div className="h-3 rounded-full bg-[var(--cf-fill)] overflow-hidden flex">
                      <div className="h-full transition-all duration-500" style={{ width: `${pctInteres}%`, background: 'var(--cf-green-dark)' }} />
                      <div className="h-full transition-all duration-500" style={{ width: `${pctCapital}%`, background: 'var(--cf-gold)' }} />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[var(--cf-green-dark)] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[11px] text-[var(--cf-ink-3)]">Ganancia (interés)</p>
                          <p className="text-[14px] lg:text-[16px] font-mono font-bold text-[var(--cf-green-dark)] truncate">
                            <span className="hidden sm:inline">{fmt(rentabilidad.interesGanadoMes)}</span>
                            <span className="sm:hidden">{fmtShort(rentabilidad.interesGanadoMes)}</span>
                            <span className="text-[10px] font-normal text-[var(--cf-ink-3)] ml-1">{pctInteres}%</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[var(--cf-gold)] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[11px] text-[var(--cf-ink-3)]">Capital recuperado</p>
                          <p className="text-[14px] lg:text-[16px] font-mono font-bold truncate">
                            <span className="hidden sm:inline">{fmt(rentabilidad.capitalRecuperadoMes)}</span>
                            <span className="sm:hidden">{fmtShort(rentabilidad.capitalRecuperadoMes)}</span>
                            <span className="text-[10px] font-normal text-[var(--cf-ink-3)] ml-1">{pctCapital}%</span>
                          </p>
                        </div>
                      </div>
                    </div>
                    {resumen.gastosMes > 0 && (
                      <div className="mt-3 pt-3 border-t border-[var(--cf-border)] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-[var(--cf-red-dark)] shrink-0" />
                          <span className="text-[11px] text-[var(--cf-ink-3)]">Gastos operativos</span>
                        </div>
                        <span className="text-[13px] font-mono font-bold text-[var(--cf-red-dark)]">-{fmtShort(resumen.gastosMes)}</span>
                      </div>
                    )}
                    <div className="mt-2 pt-2 border-t border-[var(--cf-border)] flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[var(--cf-ink-2)]">{rotulo('gananciaMes')}</span>
                      <span className={`text-[15px] font-mono font-bold ${rentabilidad.utilidadMes >= 0 ? 'text-[var(--cf-green-dark)]' : 'text-[var(--cf-red-dark)]'}`}>
                        {fmtShort(rentabilidad.utilidadMes)}
                      </span>
                    </div>
                  </>
                )
              })()}
            </Card>
          )}

          {/* === Tendencia de utilidad === */}
          {tendenciaMensual?.some(t => t.interesGanado > 0) && (
            <Card>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--cf-ink-3)] mb-3">Utilidad por mes</p>
              <div className="space-y-1.5">
                {tendenciaMensual.map((d, i) => {
                  const maxUtil = Math.max(...tendenciaMensual.map(t => Math.abs(t.utilidad)), 1)
                  const pct = (Math.abs(d.utilidad) / maxUtil) * 100
                  const mesLabel = new Date(d.mes + '-15').toLocaleDateString('es', { month: 'short' })
                  const positivo = d.utilidad >= 0
                  return (
                    <div key={i} className="flex items-center gap-2.5">
                      <span className="text-[11px] w-8 text-right text-[var(--cf-ink-3)] font-medium uppercase">{mesLabel}</span>
                      <div className="flex-1 h-7 rounded-[6px] bg-[var(--cf-fill)] overflow-hidden relative">
                        <div
                          className="h-full rounded-[6px] transition-all duration-500 ease-out"
                          style={{
                            width: `${Math.max(pct, 2)}%`,
                            background: positivo ? 'var(--cf-green-dark)' : 'var(--cf-red-dark)',
                            opacity: positivo ? 1 : 0.7,
                          }}
                        />
                        {d.utilidad !== 0 && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono font-semibold text-[var(--cf-ink-2)]">
                            {fmtShort(d.utilidad)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              {rentabilidad?.rotacionCapital > 0 && (
                <div className="mt-3 pt-3 border-t border-[var(--cf-border)] flex items-center justify-between">
                  <span className="text-[11px] text-[var(--cf-ink-3)]">Rotación de capital</span>
                  <span className="text-[13px] font-mono font-bold text-[var(--cf-ink-2)]">{rentabilidad.rotacionCapital}% /mes</span>
                </div>
              )}
            </Card>
          )}

          {/* === Recaudado mensual === */}
          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--cf-ink-3)] mb-3">Recaudado por mes</p>
            <BarChart data={tendenciaMensual} dataKey="recaudado" formatValue={v => fmtShort(v)} color="var(--cf-gold)" />
          </Card>

          {/* === Clavos === */}
          {cartera.clavos > 0 && (
            <Card href="/clavos" className="!border-[var(--cf-red-dark)] border-opacity-50">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--cf-red-dark)]">Clavos</p>
                  <p className="text-[11px] text-[var(--cf-ink-3)] mt-0.5">
                    {cartera.clavos} préstamo{cartera.clavos === 1 ? '' : 's'} irrecuperable{cartera.clavos === 1 ? '' : 's'}
                  </p>
                </div>
                <p className="text-[16px] sm:text-[20px] font-mono font-bold text-[var(--cf-red-dark)] shrink-0">{fmtShort(cartera.moraIrrecuperable)}</p>
              </div>
              {resumen.capitalEnCalle > 0 && (
                <p className="text-[10px] text-[var(--cf-ink-3)] mt-2 pt-2 border-t border-[var(--cf-border)]">
                  Impacto: {Math.round((cartera.moraIrrecuperable / resumen.capitalEnCalle) * 100)}% del capital activo comprometido
                </p>
              )}
            </Card>
          )}
        </div>
      </div>
      {/* === Cartera + Negocio === */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <Card href="/prestamos" className="overflow-hidden">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cf-ink-3)]">Préstamos activos</p>
          <p className="text-[22px] lg:text-[24px] font-mono font-bold mt-1">{cartera.activos}</p>
          {cartera.pctMora > 0 && <p className="text-[11px] text-[var(--cf-red-dark)] font-medium">{cartera.pctMora}% en mora</p>}
        </Card>
        <Card className="overflow-hidden">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cf-ink-3)]">Por cobrar</p>
          <p className="text-[16px] lg:text-[22px] font-mono font-bold mt-1 text-[var(--cf-gold)] truncate">
            <span className="hidden sm:inline">{fmt(resumen.porCobrar)}</span>
            <span className="sm:hidden">{fmtShort(resumen.porCobrar)}</span>
          </p>
          <p className="text-[11px] text-[var(--cf-ink-3)] truncate">
            <span className="hidden sm:inline">{fmt(resumen.interesEnCartera)}</span>
            <span className="sm:hidden">{fmtShort(resumen.interesEnCartera)}</span>
            {' '}interés
          </p>
        </Card>
        <Card className="overflow-hidden">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cf-ink-3)]">Ticket promedio</p>
          <p className="text-[16px] lg:text-[22px] font-mono font-bold mt-1 truncate">
            <span className="hidden sm:inline">{fmt(cartera.ticketPromedio)}</span>
            <span className="sm:hidden">{fmtShort(cartera.ticketPromedio)}</span>
          </p>
          <p className="text-[11px] text-[var(--cf-ink-3)]">por préstamo</p>
        </Card>
        <Card className="overflow-hidden">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cf-ink-3)]">Clientes que repiten</p>
          <p className="text-[22px] lg:text-[24px] font-mono font-bold mt-1 text-[var(--cf-ink-2)]">{cartera.clientesRepiten}%</p>
          <p className="text-[11px] text-[var(--cf-ink-3)]">2+ préstamos</p>
        </Card>
      </div>
    </div>
  )
}
