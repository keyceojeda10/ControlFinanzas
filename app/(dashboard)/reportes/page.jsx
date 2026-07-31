'use client'
// app/(dashboard)/reportes/page.jsx — Reportes escalonados por plan

import { formatMoney } from '@/lib/i18n'
import { useCabecera } from '@/components/armazon/Armazon'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth }             from '@/hooks/useAuth'
import { Card }                from '@/components/ui/Card'
import { SkeletonCard }        from '@/components/ui/Skeleton'
import EmptyState              from '@/components/ui/EmptyState'
import { nivelReportes }       from '@/lib/planes'
import { Reportes }             from '@/components/pantallas/Reportes'
import { ComoVaEntrando, SegurosCobrados, CobrosDelMes } from '@/components/pantallas/ReportesDetalle'
import { aGrafica, aSeguros, aCobrosMes } from '@/lib/adaptadores/reportes-detalle'
import { abreviarMillones }     from '@/lib/adaptadores/ruta'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'

// ── Fechas helper (timezone Colombia UTC-5) ─────────────────────
const getColombiaDate = () => new Date(Date.now() - 5 * 60 * 60 * 1000)
const hoy       = () => getColombiaDate().toISOString().slice(0, 10)
const inicioMes = () => {
  const d = getColombiaDate(); d.setDate(1)
  return d.toISOString().slice(0, 10)
}

// ── Tooltip personalizado ──────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--cf-surface)] border border-[var(--cf-border)] rounded-[12px] px-3 py-2 text-xs shadow-xl">
      <p className="text-[var(--cf-ink-3)] mb-1">{label}</p>
      <p className="text-[var(--cf-green-dark)] font-bold">{formatMoney(payload[0]?.value ?? 0)}</p>
    </div>
  )
}

// ── Gate de plan ───────────────────────────────────────────────
function PlanGate() {
  const features = [
    { label: 'Ingresos diario / semanal / mensual', color: 'var(--cf-green-dark)' },
    { label: 'Cobros programados por mes', color: 'var(--cf-gold-dark)' },
    { label: 'Rendimiento por cobrador', color: 'var(--cf-ink-2)' },
    { label: 'Cartera y analisis por ruta', color: 'var(--cf-ink-2)' },
    { label: 'Exportar a PDF y Excel', color: 'var(--cf-red-dark)' },
  ]
  return (
    <div className="max-w-xl mx-auto mt-8">
      {/* Sin <h1>: la cabecera ya dice «Reportes». */}
      <div className="rounded-[20px] p-6 text-center cf-card-shadow"
        style={{
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--cf-gold) 8%, var(--cf-card)) 0%, var(--cf-card) 100%)',
          border: '1px solid color-mix(in srgb, var(--cf-gold) 22%, var(--cf-border))',
        }}
      >
        <div className="w-14 h-14 rounded-[16px] flex items-center justify-center mx-auto mb-4"
          style={{ background: 'color-mix(in srgb, var(--cf-gold) 15%, transparent)' }}
        >
          <svg className="w-7 h-7" style={{ color: 'var(--cf-gold)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        </div>
        <p className="text-base font-bold mb-1" style={{ color: 'var(--cf-ink)' }}>Reportes y analisis</p>
        <p className="text-[13px] mb-5" style={{ color: 'var(--cf-ink-3)' }}>
          Visualiza el rendimiento de tu negocio con datos en tiempo real.
        </p>
        <div className="inline-flex flex-col gap-2.5 text-left mb-5">
          {features.map((f) => (
            <div key={f.label} className="flex items-center gap-2.5">
              <div className="w-4 h-4 rounded-[6px] flex items-center justify-center shrink-0"
                style={{ background: `color-mix(in srgb, ${f.color} 18%, transparent)` }}
              >
                <svg className="w-2.5 h-2.5" style={{ color: f.color }} fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <span className="text-[12px]" style={{ color: 'var(--cf-ink-2)' }}>{f.label}</span>
            </div>
          ))}
        </div>
        <a
          href="/configuracion/plan"
          className="inline-flex items-center gap-2 text-[13px] font-bold px-5 py-2.5 rounded-[12px] transition-all"
          style={{
            background: 'var(--cf-gold)',
            color: 'var(--cf-gold-ink)',
          }}
        >
          Ver planes
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </a>
      </div>
    </div>
  )
}

// ── Nudge de upgrade para secciones bloqueadas ─────────────────
function UpgradeNudge({ titulo, planRequerido }) {
  const labelPlan = planRequerido === 'standard' ? 'Profesional' : 'Empresarial'
  return (
    <div className="rounded-[16px] px-4 py-4 flex items-center gap-3"
      style={{
        background: 'linear-gradient(135deg, color-mix(in srgb, var(--cf-gold) 5%, var(--cf-card)) 0%, var(--cf-card) 100%)',
        border: '1px solid color-mix(in srgb, var(--cf-gold) 12%, var(--cf-border))',
      }}
    >
      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
        style={{ background: 'color-mix(in srgb, var(--cf-gold) 12%, transparent)' }}
      >
        <svg className="w-4 h-4" style={{ color: 'var(--cf-gold)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold" style={{ color: 'var(--cf-ink)' }}>{titulo}</p>
        <p className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>
          Disponible en plan <span className="font-semibold" style={{ color: 'var(--cf-gold)' }}>{labelPlan}</span>
        </p>
      </div>
      <a
        href="/configuracion/plan"
        className="text-[11px] font-semibold px-3 py-1.5 rounded-[8px] transition-all shrink-0"
        style={{
          background: 'color-mix(in srgb, var(--cf-gold) 12%, transparent)',
          color: 'var(--cf-gold)',
          border: '1px solid color-mix(in srgb, var(--cf-gold) 25%, transparent)',
        }}
      >
        Mejorar
      </a>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────
export default function ReportesPage() {
  useCabecera({ titulo: 'Reportes', subtitulo: 'Análisis de tu cartera y cobradores' })

  const { session, esOwner, loading: authLoading } = useAuth()
  const router = useRouter()

    const plan = session?.user?.plan ?? 'starter'

  const [resumen,    setResumen]    = useState(null)
  const [ingresos,   setIngresos]   = useState([])
  const [cartera,    setCartera]    = useState([])
  const [cobsData,   setCobsData]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [periodoIngresos, setPeriodoIngresos] = useState('diario')
  // Seguros por ruta (carga independiente, con su propio periodo)
  const [seguros, setSeguros] = useState(null)
  const [periodoSeguros, setPeriodoSeguros] = useState('mes')
  // Cobros del mes (reporte mensual)
  const [cobrosMes, setCobrosMes] = useState(null)
  const [cobrosMesLoading, setCobrosMesLoading] = useState(false)
  const [mesCobros, setMesCobros] = useState(() => {
    const d = getColombiaDate()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const [desde, setDesde] = useState(inicioMes())
  const [hasta, setHasta]  = useState(hoy())

  const nivel = nivelReportes(plan)

  // ── LOS DOCE ÚLTIMOS MESES ──
  // Era un `<input type="month">`, que en cada sistema se dibuja distinto —en
  // unos con calendario, en otros con dos ruedas— y en ninguno se parece a la
  // app. Doce meses cubren de sobra lo que se consulta, y se leen sin abrir
  // nada.
  const mesesDisponibles = useMemo(() => {
    const NOMBRE = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    const hoy = new Date()
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      return {
        valor: `${d.getFullYear()}-${mm}`,
        texto: `${NOMBRE[d.getMonth()]} ${d.getFullYear()}`,
      }
    })
  }, [])

  // Lo que DE VERDAD entró en el mes elegido, para poder decir cuánto falta.
  // Va aparte de `resumen` porque ese usa el rango de fechas de arriba, que
  // casi nunca es el mes: compararlos daría un «falta» que no significa nada.
  const [entradoMes, setEntradoMes] = useState(null)
  useEffect(() => {
    if (authLoading || !esOwner || nivel < 1 || !mesCobros) return
    let vivo = true
    const [y, m] = mesCobros.split('-').map(Number)
    const ultimo = new Date(y, m, 0).getDate()
    const d1 = `${mesCobros}-01`
    const d2 = `${mesCobros}-${String(ultimo).padStart(2, '0')}`
    setEntradoMes(null)
    fetch(`/api/reportes/resumen?desde=${d1}&hasta=${d2}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo && d) setEntradoMes(d.pagos?.totalPeriodo ?? null) })
      .catch(() => {})
    return () => { vivo = false }
  }, [mesCobros, authLoading, esOwner, nivel])

  // La hoja para imprimir. Se saca del JSX porque eran 38 líneas de HTML dentro
  // de un `onClick`.
  const imprimirCobrosMes = useCallback(() => {
    if (!cobrosMes?.rutas?.length) return
    const ventana = window.open('', '_blank')
    if (!ventana) return
    const pesos = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`
    // LOS BORDES IBAN CON `var(--cf-border)`, que en una ventana nueva NO
    // EXISTE: la tabla salía sin una sola línea. Aquí van literales, que es lo
    // único que funciona fuera de la app.
    const filas = cobrosMes.rutas.flatMap((r) => r.clientes.map((c) => `<tr>
      <td>${r.ruta}</td><td>${c.nombre}</td><td>${c.telefono || ''}</td>
      <td class="n">${c.cuotasMes}</td>
      <td class="n b">${pesos(c.totalMes)}</td>
      <td class="n gris">${pesos(c.saldoPendiente)}</td></tr>`))
    ventana.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Cobros ${cobrosMes.monthLabel}</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:20px;color:#111}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th{text-align:left;padding:6px 8px;border-bottom:2px solid #111;font-size:11px;text-transform:uppercase}
        td{padding:4px 8px;border-bottom:1px solid #dddddd}
        .n{text-align:right;font-variant-numeric:tabular-nums}
        .b{font-weight:600}
        .gris{color:#666}
        .total td{font-weight:700;border-top:2px solid #111;padding-top:8px}
        @media print{body{padding:10px}}
      </style></head><body>
      <h2 style="margin-bottom:4px">Cobros programados</h2>
      <p style="color:#666;margin-bottom:16px;font-size:14px">${cobrosMes.monthLabel} — ${cobrosMes.totalClientes} clientes</p>
      <table><thead><tr><th>Ruta</th><th>Cliente</th><th>Tel</th>
      <th class="n">Cuotas</th><th class="n">Total mes</th><th class="n">Saldo</th></tr></thead>
      <tbody>${filas.join('')}
      <tr class="total"><td colspan="4">TOTAL</td><td class="n">${pesos(cobrosMes.granTotal)}</td><td></td></tr>
      </tbody></table></body></html>`)
    ventana.document.close()
    ventana.focus()
    ventana.print()
  }, [cobrosMes])


  const fetchAll = async () => {
    setLoading(true)
    setError('')
    try {
      const qs = `desde=${desde}&hasta=${hasta}`
      const promises = [
        fetch(`/api/reportes/resumen?${qs}`),
        fetch(`/api/reportes/ingresos?periodo=${periodoIngresos}&${qs}`),
      ]
      if (nivel >= 2) {
        promises.push(fetch('/api/reportes/cartera'))
        promises.push(fetch(`/api/reportes/cobradores?${qs}`))
      }
      const responses = await Promise.all(promises)
      const jsons = await Promise.all(responses.map((r) => r.json()))
      const [r, i, c, cb] = jsons
      if (!responses[0].ok) { setError(r.error ?? 'Error'); return }
      setResumen(r)
      setIngresos(Array.isArray(i.data) ? i.data : [])
      if (nivel >= 2) {
        setCartera(Array.isArray(c) ? c : [])
        setCobsData(Array.isArray(cb) ? cb : [])
      }
    } catch {
      setError('No se pudieron cargar los reportes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && esOwner && nivel >= 1) fetchAll()
    else if (!authLoading) setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, periodoIngresos, desde, hasta])

  // Seguros por ruta: carga independiente con su propio periodo
  useEffect(() => {
    if (authLoading || !esOwner || nivel < 2) return
    fetch(`/api/reportes/seguros?periodo=${periodoSeguros}`)
      .then(r => r.json())
      .then(d => setSeguros(d?.items ? d : null))
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, periodoSeguros, nivel])

  // Cobros del mes: carga independiente con su propio selector de mes (nivel 1+)
  useEffect(() => {
    if (authLoading || !esOwner || nivel < 1) return
    setCobrosMesLoading(true)
    const [y, m] = mesCobros.split('-').map(Number)
    fetch(`/api/reportes/cobros-mes?year=${y}&month=${m}`)
      .then(r => r.json())
      .then(d => setCobrosMes(d?.rutas ? d : null))
      .catch(() => {})
      .finally(() => setCobrosMesLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, mesCobros, nivel])

  if (authLoading || (loading && nivel >= 1 && esOwner)) {
    return (
      <div className="max-w-3xl lg:max-w-6xl mx-auto space-y-4">
        <SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
    )
  }

  if (!esOwner || nivel === 0) return <PlanGate />

  // Top recaudacion del periodo (medalla)
  // ── EL HALLAZGO: solo si es cierto ──
  //
  // Un reporte que solo enseña cifras deja el trabajo de encontrar el problema al
  // dueño, que es justo el trabajo que no tiene tiempo de hacer. Este busca uno
  // concreto: COBRADORES QUE COBRAN Y NO REGISTRAN.
  //
  // La condición es estricta a propósito. Tiene que haber cobradores, tiene que
  // haber entrado plata en el período, y TODOS tienen que marcar cero. Si uno
  // solo registró algo, el problema es de ese cobrador y no de la práctica, y
  // decirlo en grande sería una acusación falsa a los demás.
  //
  // Un hallazgo equivocado quema la sección para siempre: la segunda vez que el
  // dueño lea algo que sabe que no es verdad, deja de leer las de arriba también.
  const hallazgo = (() => {
    if (nivel < 2 || cobsData.length === 0) return {}
    const entro = resumen?.pagos?.totalPeriodo ?? 0
    if (entro <= 0) return {}
    const registraron = cobsData.filter((c) => (c.totalRecogido || 0) > 0)
    if (registraron.length > 0) return {}
    return {
      hallazgoTitulo: cobsData.length === 1
        ? 'Tu cobrador no registró un peso'
        : `Ninguno de tus ${cobsData.length} cobradores registró un peso`,
      hallazgoDetalle: `Entraron ${formatMoney(entro)} en el período y todos los pagos llevan tu nombre. O estás cobrando tú solo, o están cobrando sin registrarlo.`,
    }
  })()

  // Las rutas que no movieron nada. Van aparte de la lista porque una ruta en
  // cero no se compara con las otras: se pregunta qué pasó.
  const sinPeso = (() => {
    if (nivel < 2) return null
    const paradas = cartera.filter((r) => (r.cuotaDiariaTotal || 0) <= 0)
    if (paradas.length === 0) return null
    return {
      titulo: `${paradas.length} ${paradas.length === 1 ? 'ruta sin un peso' : 'rutas sin un peso'}`,
      detalle: paradas.map((r) => r.ruta).slice(0, 3).join(' · '),
    }
  })()

  const topCobradores = nivel >= 2 ? [...cobsData].sort((a, b) => (b.totalRecogido || 0) - (a.totalRecogido || 0)).slice(0, 3) : []

  return (
    <div className="max-w-3xl lg:max-w-6xl mx-auto space-y-5">
      {/* Header + filtro fechas como chips de periodo + date pickers */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          {/* Titulo y subtitulo, en la cabecera del armazon. */}
          <div />
        </div>
        {/* Chips de período rápido + date inputs */}
        <div className="rounded-[12px] p-2.5 flex flex-wrap items-center gap-2"
          style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}
        >
          {[
            { id: 'hoy', label: 'Hoy', from: hoy, to: hoy },
            { id: 'mes', label: 'Este mes', from: inicioMes, to: hoy },
            { id: '7d', label: 'Últimos 7d', from: () => { const d = getColombiaDate(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10) }, to: hoy },
            { id: '30d', label: 'Últimos 30d', from: () => { const d = getColombiaDate(); d.setDate(d.getDate() - 29); return d.toISOString().slice(0, 10) }, to: hoy },
          ].map((p) => {
            const active = desde === p.from() && hasta === p.to()
            return (
              <button
                key={p.id}
                onClick={() => { setDesde(p.from()); setHasta(p.to()) }}
                className="text-[11px] px-2.5 py-1 rounded-[8px] font-medium transition-all"
                style={{
                  background: active ? 'color-mix(in srgb, var(--cf-gold) 18%, transparent)' : 'transparent',
                  color: active ? 'var(--cf-gold)' : 'var(--cf-ink-3)',
                  border: active ? '1px solid color-mix(in srgb, var(--cf-gold) 35%, transparent)' : '1px solid transparent',
                }}
              >
                {p.label}
              </button>
            )
          })}
          <div className="flex items-center gap-1.5 ml-auto">
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="h-7 px-2 rounded-[8px] border bg-transparent text-[11px] focus:outline-none transition-all"
              style={{ borderColor: 'var(--cf-border)', color: 'var(--cf-ink)' }}
            />
            <span className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>—</span>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="h-7 px-2 rounded-[8px] border bg-transparent text-[11px] focus:outline-none transition-all"
              style={{ borderColor: 'var(--cf-border)', color: 'var(--cf-ink)' }}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-[12px] px-4 py-3 text-sm"
          style={{ background: 'var(--cf-red-pill-bg)', color: 'var(--cf-red-dark)', border: '1px solid color-mix(in srgb, var(--cf-red-dark) 30%, transparent)' }}
        >
          {error}
        </div>
      )}

      {/* ── T30 · Lo que entró, y lo que hay que mirar ──
          Sustituye al héroe verde con brillo, a los cuatro KPI con icono
          circular de colores, a la tarjeta de «interés ganado» y a las dos de
          capital prestado y completados. Eran SEIS tarjetas para cinco cifras.

          Tres decisiones que trae la lámina:

            · UNA CIFRA GRANDE, LAS DEMÁS DENTRO. Las cuatro no son cuatro
              noticias: son el contexto de la de arriba, así que van en la misma
              tinta y dentro del mismo bloque. Ocho tarjetas de colores hacen que
              ninguna destaque.
            · EL HALLAZGO. Un reporte que solo enseña cifras deja el trabajo de
              encontrar el problema al dueño. Este busca uno concreto y lo dice
              con palabras. Y NO SE INVENTA: solo aparece cuando es cierto —ver
              abajo la condición—, porque un hallazgo falso quema la sección para
              siempre.
            · LAS RUTAS ORDENADAS POR CARTERA, con lo que rinde cada una al día.

          Lo que NO se toca: la gráfica de ingresos, los seguros, el podio de
          cobradores, el listado en PDF y las exportaciones. */}
      {resumen && (
        <Reportes
          entroEtiqueta="Entró en el período"
          entro={formatMoney(resumen.pagos.totalPeriodo)}
          entroDetalle={`${resumen.pagos.cantidad} ${resumen.pagos.cantidad === 1 ? 'pago' : 'pagos'}`}
          cifras={[
            { etiqueta: 'Clientes', valor: String(resumen.clientes.total) },
            { etiqueta: 'En mora', valor: String(resumen.clientes.enMora) },
            { etiqueta: 'Activos', valor: String(resumen.prestamos.activos) },
            // ABREVIADA. Son cuatro columnas en 390px y «$8.369.659» completo
            // desborda la última y se corta contra el borde. Ocho millones se
            // leen igual de bien como «$8,4M», y la cifra exacta está en la
            // cartera por ruta de abajo.
            { etiqueta: 'Cartera', valor: abreviarMillones(resumen.prestamos.saldoPorCobrar ?? resumen.prestamos.carteraActiva, formatMoney) },
          ]}
          {...hallazgo}
          rutasTotal={cartera.length > 0 ? `${cartera.length} ${cartera.length === 1 ? 'ruta' : 'rutas'}` : null}
          rutas={nivel >= 2 ? cartera.map((r) => ({
            id: r.id,
            nombre: r.ruta,
            detalle: `${r.cobrador || 'sin cobrador'} · ${r.clientes} ${r.clientes === 1 ? 'cliente' : 'clientes'}`,
            cartera: formatMoney(r.saldoPendiente),
            porDia: `${formatMoney(r.cuotaDiariaTotal)}/día`,
          })) : []}
          sinPeso={sinPeso}
        />
      )}

      {/* ── T33-01 · Cómo va entrando ─────────────────────────
          Eran barras de Recharts con dos verdes —fuerte la última, claro las
          demás— y sin un solo número encima. Pintar la última de otro color
          sugiere que hoy es especial, y no lo es: es la barra que aún no ha
          terminado. Y para saber cuánto entra al día había que mirar veinte
          barras y estimar.

          Ahora son barras planas de un solo dorado, y debajo va escrito lo que
          la gráfica tenía que decir: el día grande y la media. */}
      <ComoVaEntrando
        periodo={periodoIngresos}
        onPeriodo={setPeriodoIngresos}
        {...aGrafica(ingresos)}
      />

      {/* La cartera por ruta subió dentro de <Reportes>: estaba dos pantallas
          más abajo que las cifras que explica. El aviso de plan se queda, que es
          lo único que esta tarjeta añadía cuando no se tiene. */}
      {nivel < 2 && <UpgradeNudge titulo="Cartera por ruta" planRequerido="standard" />}

      {/* ── T33-01 · Seguros cobrados ─────────────────────────
          El período era un `<select>` nativo, que en cada teléfono se ve
          distinto y en ninguno se ve como la app. */}
      {nivel >= 2 && seguros && (
        <SegurosCobrados
          periodo={periodoSeguros}
          onPeriodo={setPeriodoSeguros}
          {...aSeguros(seguros)}
        />
      )}

      {/* ── T33-01 · Cobros del mes ───────────────────────────
          Era un título, un desplegable y una tabla: para saber si el mes iba
          bien había que sumar mentalmente. Ahora la cifra manda, va arriba y en
          oscuro, y al lado lo que YA entró con lo que falta.

          «Ya entró» sale de los pagos del mismo mes, y solo se enseña si se
          pudo pedir: en una pantalla de plata, un hueco es mejor que un número
          inventado. */}
      {nivel >= 1 && (
        <CobrosDelMes
          mes={mesCobros}
          onMes={setMesCobros}
          meses={mesesDisponibles}
          cargando={cobrosMesLoading}
          onImprimir={cobrosMes?.rutas?.length > 0 ? imprimirCobrosMes : null}
          {...aCobrosMes(cobrosMes, entradoMes)}
        />
      )}

      {/* ── 4. Top cobradores (podio visual) + lista completa ── */}
      {nivel < 2 && <UpgradeNudge titulo="Rendimiento de cobradores" planRequerido="standard" />}
      {nivel >= 2 && cobsData.length > 0 && (
        <div className="rounded-[20px] px-4 py-4 cf-card-shadow"
          style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-[8px] flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--cf-ink-2) 18%, transparent)', color: 'var(--cf-ink-2)' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
              </svg>
            </div>
            <p className="text-[12px] font-extrabold uppercase tracking-[.07em]" style={{ color: 'var(--cf-ink-2)' }}>Rendimiento de cobradores</p>
          </div>

          {/* Top 3 podio si hay >= 2 */}
          {topCobradores.length >= 2 && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[1, 0, 2].map((idx) => {
                const c = topCobradores[idx]
                if (!c) return <div key={idx} />
                const medalColor = idx === 0 ? 'var(--cf-gold)' : idx === 1 ? '#94a3b8' : '#cd7f32'
                const medalLabel = idx === 0 ? '#1' : idx === 1 ? '#2' : '#3'
                return (
                  <div
                    key={c.id}
                    className={`rounded-[12px] px-2 py-3 text-center transition-all ${idx === 0 ? '-mt-2' : ''}`}
                    style={{
                      background: `linear-gradient(135deg, color-mix(in srgb, ${medalColor} 14%, var(--cf-surface)) 0%, var(--cf-surface) 100%)`,
                      border: `1px solid color-mix(in srgb, ${medalColor} 30%, transparent)`,
                      boxShadow: idx === 0 ? `0 0 16px color-mix(in srgb, ${medalColor} 25%, transparent)` : 'none',
                    }}
                  >
                    <div className="w-8 h-8 mx-auto rounded-full flex items-center justify-center text-[12px] font-bold mb-1.5"
                      style={{ background: `color-mix(in srgb, ${medalColor} 25%, transparent)`, color: medalColor, border: `2px solid ${medalColor}` }}
                    >
                      {medalLabel}
                    </div>
                    <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--cf-ink)' }}>{c.nombre}</p>
                    <p className="text-[12px] font-bold font-mono-display mt-0.5" style={{ color: medalColor }}>{formatMoney(c.totalRecogido || 0)}</p>
                    <p className="text-[9px] mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>{c.eficiencia}% eficiencia</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Lista completa con barras */}
          <div className="space-y-2.5">
            {cobsData.map((c) => {
              const totalGastos = c.totalGastos || 0
              const totalDesembolsado = c.totalDesembolsado || 0
              const saldoRealCaja = c.saldoRealCaja ?? ((c.totalRecogido || 0) - totalGastos - totalDesembolsado)
              const eficColor = c.eficiencia >= 95 ? 'var(--cf-green-dark)' : c.eficiencia >= 80 ? 'var(--cf-gold-dark)' : 'var(--cf-red-dark)'
              return (
                <div
                  key={c.id}
                  className="rounded-[12px] px-3 py-2.5"
                  style={{ background: 'var(--cf-surface)', border: '1px solid var(--cf-border)' }}
                >
                  <div className="flex justify-between items-baseline mb-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--cf-ink)' }}>{c.nombre}</p>
                      <p className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>{c.ruta} · {c.diasTrabajados} días</p>
                    </div>
                    <span
                      className="text-[12px] font-bold font-mono-display px-2 py-0.5 rounded-full shrink-0 ml-2"
                      style={{ background: `color-mix(in srgb, ${eficColor} 15%, transparent)`, color: eficColor, border: `1px solid color-mix(in srgb, ${eficColor} 25%, transparent)` }}
                    >
                      {c.eficiencia}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: 'var(--cf-fill)' }}>
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{
                        width: `${Math.min(100, c.eficiencia)}%`,
                        background: `linear-gradient(90deg, color-mix(in srgb, ${eficColor} 60%, transparent), ${eficColor})`,
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>
                    <span>Esperado: <span className="font-mono-display">{formatMoney(c.totalEsperado)}</span></span>
                    <span>Recogido: <span className="font-mono-display" style={{ color: 'var(--cf-green-dark)' }}>{formatMoney(c.totalRecogido)}</span></span>
                    <span>Gastos: <span className="font-mono-display" style={{ color: 'var(--cf-red-dark)' }}>{formatMoney(totalGastos)}</span></span>
                    <span>Desembolsado: <span className="font-mono-display" style={{ color: 'var(--cf-gold-dark)' }}>{formatMoney(totalDesembolsado)}</span></span>
                    <span>Saldo real: <span className="font-mono-display" style={{ color: saldoRealCaja >= 0 ? 'var(--cf-ink-2)' : 'var(--cf-red-dark)' }}>{formatMoney(saldoRealCaja)}</span></span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── BAJAR INFORMACIÓN · T33-02 ─────────────────────────
          Aquí vivían TRES tarjetas de descarga —el listado «quién me debe», el
          resumen en PDF y los cuatro Excel—, 193 líneas al final de una página
          de 3.700 píxeles. Después de todo el scroll, y con los filtros del
          listado sueltos y sin resultado a la vista: se elegía ruta, orden y
          mora sin saber cuántos clientes iban a salir, así que se bajaba el PDF
          para ver qué traía y, si no era eso, otra vez.

          Ahora son su propia pantalla, con los filtros dentro de la tarjeta,
          encima del botón y con la cuenta hecha. Bajar un Excel para el
          contador no es «mirar cómo va el negocio»: es otra tarea. */}
      <button
        type="button"
        onClick={() => router.push('/reportes/bajar')}
        className="w-full rounded-[20px] px-4 py-4 cf-card-shadow flex items-center gap-3 text-left"
        style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}
      >
        <span className="w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0"
          style={{ background: 'var(--cf-fill)' }}>
          <svg className="w-[18px] h-[18px]" fill="none" stroke="var(--cf-ink-2)" strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M12 4v11M8 12l4 4 4-4M5 20h14" />
          </svg>
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[14px] font-bold" style={{ color: 'var(--cf-ink)' }}>
            Bajar información
          </span>
          <span className="block text-[12px]" style={{ color: 'var(--cf-ink-3)' }}>
            Quién me debe, cómo me fue y tus datos en Excel
          </span>
        </span>
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="var(--cf-ink-3)" strokeWidth={2.2}
          strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}

