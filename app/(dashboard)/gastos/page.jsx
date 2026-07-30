'use client'

// app/(dashboard)/gastos/page.jsx — gastos de cobradores y capital.
//
// ══ UN GASTO PENDIENTE ES TRABAJO, NO UN REGISTRO ══════════════════════════
//
// No hay lámina de esta pantalla —el paquete solo dibuja T06-04, la hoja de
// registrar un gasto—, así que se construye con las reglas del sistema y con la
// pregunta que el dueño trae: ¿CUÁNTO ME VAN A SACAR DE LA CAJA HOY?
//
// Por eso el total pendiente va en bloque oscuro y arriba del todo: es plata que
// va a salir en cuanto se pulse «Aprobar». Lo aprobado y lo rechazado son
// historia y se consultan; lo pendiente es una bandeja de entrada.
//
// ══ EL COLOR SE QUITA, NO SE AÑADE ═════════════════════════════════════════
//
// La versión anterior teñía cada tarjeta del color de su estado —ámbar, verde,
// rojo— DENTRO de una lista ya filtrada por ese mismo estado. Todas del mismo
// color y todas con una pastilla repitiendo el nombre de la pestaña en la que
// estás. Eso no informa: gasta la atención que necesita el monto.
//
// Aquí el estado lo dice la pestaña, y el color solo aparece en las dos acciones
// que mueven plata.

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useCountry } from '@/hooks/useCountry'
import { formatMoney } from '@/lib/i18n'
import CapitalTab from '@/components/capital/CapitalTab'
import ReportarGasto from '@/components/gastos/ReportarGasto'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Tarjeta, BloqueOscuro, Chip, EstadoVacio } from '@/components/cf/primitivos'
import { GrupoSegmentado, PilaEsqueletos } from '@/components/cf/primitivos2'

const ESTADOS = [
  { id: 'pendiente', etiqueta: 'Pendientes' },
  { id: 'aprobado', etiqueta: 'Aprobados' },
  { id: 'rechazado', etiqueta: 'Rechazados' },
]

const VACIO = {
  pendiente: {
    titulo: 'No hay nada por aprobar',
    explicacion: 'Cuando un cobrador reporte un gasto en la calle, aparece aquí para que lo apruebes o lo rechaces.',
  },
  aprobado: {
    titulo: 'Todavía no has aprobado ningún gasto',
    explicacion: 'Los gastos que apruebes salen del capital y quedan registrados aquí.',
  },
  rechazado: {
    titulo: 'No has rechazado ningún gasto',
    explicacion: 'Un gasto rechazado no toca el capital, pero queda para que el cobrador vea la respuesta.',
  },
}

const hoyBogota = () => new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)

const cuando = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Bogota',
  })
}

export default function GastosPage() {
  const { esOwner, loading: authLoading } = useAuth()
  const { country } = useCountry()
  const searchParams = useSearchParams()
  const fmt = useCallback((v) => formatMoney(v, country), [country])

  const [vista, setVista] = useState(() => (searchParams?.get('tab') === 'capital' ? 'capital' : 'gastos'))
  const [estado, setEstado] = useState('pendiente')
  const [abrirReportar, setAbrirReportar] = useState(false)
  const [fecha, setFecha] = useState('')
  const [cobradorId, setCobradorId] = useState('')
  const [cobradores, setCobradores] = useState([])
  const [gastos, setGastos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(null)
  const [aBorrar, setABorrar] = useState(null)

  const traer = useCallback(async () => {
    setCargando(true)
    try {
      const params = new URLSearchParams()
      if (estado) params.set('estado', estado)
      if (fecha) params.set('fecha', fecha)
      if (cobradorId) params.set('cobrador', cobradorId)
      const res = await fetch(`/api/gastos?${params}`, { cache: 'no-store' })
      setGastos(res.ok ? (await res.json()) || [] : [])
    } catch {
      setGastos([])
    } finally {
      setCargando(false)
    }
  }, [estado, fecha, cobradorId])

  useEffect(() => {
    if (!esOwner) return
    fetch('/api/cobradores').then((r) => (r.ok ? r.json() : []))
      .then((d) => setCobradores(Array.isArray(d) ? d : [])).catch(() => {})
  }, [esOwner])

  useEffect(() => { if (vista === 'gastos') traer() }, [traer, vista])

  const total = useMemo(() => gastos.reduce((a, g) => a + (g.monto || 0), 0), [gastos])

  const decidir = async (gasto, nuevo) => {
    setProcesando(gasto.id)
    try {
      const res = await fetch(`/api/gastos/${gasto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevo }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert(d.error || 'No se pudo actualizar')
        return
      }
      traer()
    } finally {
      setProcesando(null)
    }
  }

  const borrar = async (gasto) => {
    setABorrar(null)
    setProcesando(gasto.id)
    try {
      const res = await fetch(`/api/gastos/${gasto.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert(d.error || 'No se pudo eliminar')
        return
      }
      traer()
    } finally {
      setProcesando(null)
    }
  }

  if (authLoading) return <PilaEsqueletos cuantos={3} alto={96} />

  if (!esOwner) {
    return (
      <p style={{ padding: 16, textAlign: 'center', color: 'var(--cf-ink-3)', fontSize: 14 }}>
        Solo el administrador puede gestionar gastos.
      </p>
    )
  }

  const hayFiltro = Boolean(fecha || cobradorId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 21, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)',
          }}>Gastos</span>
          <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>
            Lo que se sale del capital
          </span>
        </div>
        {vista === 'gastos' && (
          <button type="button" onClick={() => setAbrirReportar(true)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 14px',
            borderRadius: 12, flex: 'none', cursor: 'pointer', border: 0,
            background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
            font: 'inherit', fontSize: 13.5, fontWeight: 700,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Anotar gasto
          </button>
        )}
      </div>

      <ReportarGasto
        open={abrirReportar}
        onClose={() => setAbrirReportar(false)}
        onSuccess={() => { setAbrirReportar(false); traer() }}
        fecha={fecha || undefined}
        cobradores={cobradores}
      />

      {/* Dos cosas distintas: lo que piden los cobradores y el fondo del que sale.
          Segmentado, no pestañas con icono: son dos, y la palabra basta. */}
      <GrupoSegmentado
        opciones={[
          { id: 'gastos', nombre: 'Gastos' },
          { id: 'capital', nombre: 'Capital' },
        ]}
        valor={vista}
        onElegir={setVista}
        alto={44}
      />

      {vista === 'capital' ? <CapitalTab /> : (
        <>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {ESTADOS.map((e) => (
              <Chip key={e.id} activo={estado === e.id} onClick={() => setEstado(e.id)}>
                {e.etiqueta}
              </Chip>
            ))}
          </div>

          {/* LA CIFRA ES LO QUE VA A SALIR DE LA CAJA. En pendientes va en dorado
              —es una decisión que falta por tomar—; en las otras dos es historia y
              va en blanco. */}
          <BloqueOscuro
            etiqueta={`Total ${ESTADOS.find((e) => e.id === estado)?.etiqueta.toLowerCase()}`}
            cifra={fmt(total)}
            tono={estado === 'pendiente' ? 'ganancia' : 'neutro'}
          >
            <span style={{ fontSize: 13, color: '#A3A8B2' }} className="cf-num">
              {gastos.length} {gastos.length === 1 ? 'gasto' : 'gastos'}
              {hayFiltro ? ' · con filtro' : ''}
            </span>
          </BloqueOscuro>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 12px',
              borderRadius: 11, cursor: 'pointer', flex: 'none',
              background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-3)"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
                <path d="M8 3v4M16 3v4M4 11h16M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="cf-num" style={{
                fontSize: 12.5, fontWeight: 600,
                color: fecha ? 'var(--cf-ink)' : 'var(--cf-ink-3)',
              }}>
                {fecha
                  ? new Date(`${fecha}T12:00:00-05:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' })
                  : 'Cualquier fecha'}
              </span>
              <input type="date" value={fecha} max={hoyBogota()}
                onChange={(e) => setFecha(e.target.value)}
                style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
            </label>

            {cobradores.length > 0 && (
              <div style={{
                position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 7,
                height: 36, padding: '0 12px', borderRadius: 11, flex: 'none',
                background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
              }}>
                <span style={{
                  fontSize: 12.5, fontWeight: 600,
                  color: cobradorId ? 'var(--cf-ink)' : 'var(--cf-ink-3)',
                }}>
                  {cobradores.find((c) => c.id === cobradorId)?.nombre ?? 'Todos'}
                </span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--cf-chevron)"
                  strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                <select value={cobradorId} onChange={(e) => setCobradorId(e.target.value)}
                  aria-label="Cobrador"
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', font: 'inherit' }}>
                  <option value="">Todos los cobradores</option>
                  {cobradores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            )}

            {/* Quitar el filtro tiene que costar un toque. Sin esto la lista sale
                vacía y parece que no hay gastos. */}
            {hayFiltro && (
              <button type="button" onClick={() => { setFecha(''); setCobradorId('') }} style={{
                background: 'none', border: 0, padding: '0 4px', cursor: 'pointer', flex: 'none',
                font: 'inherit', fontSize: 12.5, fontWeight: 700, color: 'var(--cf-gold-dark)',
              }}>Quitar filtro</button>
            )}
          </div>

          {cargando ? <PilaEsqueletos cuantos={3} alto={104} /> : gastos.length === 0 ? (
            <EstadoVacio
              titulo={hayFiltro ? 'Nada con ese filtro' : VACIO[estado].titulo}
              explicacion={hayFiltro
                ? 'Puede que el gasto esté en otra fecha o de otro cobrador.'
                : VACIO[estado].explicacion}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {gastos.map((g) => (
                <Tarjeta key={g.id} style={{ gap: 0, padding: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '15px 17px' }}>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{
                        fontSize: 15, fontWeight: 600, color: 'var(--cf-ink)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{g.description}</span>
                      {/* QUIÉN Y CUÁNDO. Sin el nombre, aprobar es firmar a ciegas. */}
                      <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>
                        {g.cobradorNombre || 'Tú'} · {cuando(g.fecha)}
                      </span>
                    </div>
                    <span className="cf-fig" style={{ fontSize: 17, flex: 'none', color: 'var(--cf-ink)' }}>
                      {fmt(g.monto)}
                    </span>
                  </div>

                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '11px 17px',
                    borderTop: '1px solid var(--cf-hairline)',
                  }}>
                    {/* Borrar va a la izquierda y sin color: es una corrección de
                        algo mal metido, no la acción de esta pantalla. */}
                    <button type="button" onClick={() => setABorrar(g)} disabled={procesando === g.id}
                      aria-label="Eliminar gasto" style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 34, height: 34, flex: 'none', borderRadius: 10,
                        background: 'none', border: 0, padding: 0, cursor: 'pointer',
                        opacity: procesando === g.id ? .4 : 1,
                      }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-4)"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" />
                      </svg>
                    </button>

                    <span style={{ flex: 1 }} />

                    {g.estado === 'pendiente' ? (
                      <>
                        <button type="button" disabled={procesando === g.id}
                          onClick={() => decidir(g, 'rechazado')} style={{
                            height: 36, padding: '0 14px', borderRadius: 11, flex: 'none',
                            cursor: 'pointer', background: 'var(--cf-card)',
                            border: '1px solid var(--cf-border-strong)',
                            font: 'inherit', fontSize: 13.5, fontWeight: 600, color: 'var(--cf-ink-2)',
                            opacity: procesando === g.id ? .4 : 1,
                          }}>Rechazar</button>
                        {/* APROBAR SACA LA PLATA. Es la única acción con color de
                            toda la lista. */}
                        <button type="button" disabled={procesando === g.id}
                          onClick={() => decidir(g, 'aprobado')} style={{
                            height: 36, padding: '0 16px', borderRadius: 11, flex: 'none',
                            cursor: 'pointer', border: 0,
                            background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
                            font: 'inherit', fontSize: 13.5, fontWeight: 700,
                            opacity: procesando === g.id ? .4 : 1,
                          }}>{procesando === g.id ? 'Un momento…' : 'Aprobar'}</button>
                      </>
                    ) : (
                      // Ya decidido: se puede deshacer, y decirlo así —«Volver a
                      // pendiente»— es más claro que un botón por estado.
                      <button type="button" disabled={procesando === g.id}
                        onClick={() => decidir(g, 'pendiente')} style={{
                          height: 36, padding: '0 14px', borderRadius: 11, flex: 'none',
                          cursor: 'pointer', background: 'var(--cf-card)',
                          border: '1px solid var(--cf-border-strong)',
                          font: 'inherit', fontSize: 13.5, fontWeight: 600, color: 'var(--cf-ink-2)',
                          opacity: procesando === g.id ? .4 : 1,
                        }}>Volver a pendiente</button>
                    )}
                  </div>
                </Tarjeta>
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmModal
        open={Boolean(aBorrar)}
        title="Eliminar gasto"
        message={aBorrar
          ? (aBorrar.estado === 'aprobado'
            ? `Eliminar «${aBorrar.description}» por ${fmt(aBorrar.monto)}. Se devuelve al capital.`
            : `Eliminar «${aBorrar.description}» por ${fmt(aBorrar.monto)}.`)
          : ''}
        confirmLabel="Eliminar"
        confirmColor="red"
        onConfirm={() => borrar(aBorrar)}
        onCancel={() => setABorrar(null)}
      />
    </div>
  )
}
