'use client'

import { Cuadre } from '@/components/pantallas/Caja'
import { diferenciaDeCuadre, causasDeDescuadre } from '@/lib/adaptadores/cuadre'
// components/caja/CuadreDia.jsx
// Cuadre del día (solo owner): el admin verifica y confirma el efectivo que recibe de
// cada cobrador. Banner global + lista por cobrador (semáforos, problemas primero) +
// confirmar recibo (individual o en lote). Diseñado mobile-first.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { formatMoney } from '@/lib/i18n'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import MoneyInput from '@/components/ui/MoneyInput'
import { useAuth } from '@/hooks/useAuth'
import { montoCrudo, montoCrudoConModo, montoParaMostrarConModo } from '@/lib/adaptadores/pago'
import { Button } from '@/components/ui/Button'

// Config visual por estado (sin emojis: punto de color + label).
const ESTADO = {
  cuadrado:  { label: 'Cuadró',   color: 'var(--cf-green-dark)', orden: 3 },
  sobrante:  { label: 'Sobrante', color: 'var(--cf-gold-dark)', orden: 1 },
  faltante:  { label: 'Faltante', color: 'var(--cf-red-dark)',  orden: 0 },
  pendiente: { label: 'Pendiente', color: 'var(--cf-ink-3)', orden: 2 },
}

const fmtHora = (d) => d ? new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Bogota' }) : ''

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function hoyLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function CuadreDia({ fecha, abrirCobradorId = null }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos') // 'todos' | 'pendientes' | 'diferencia'
  const [modal, setModal] = useState(null)       // fila en confirmación
  // ── EL MODO ABREVIADO EN EL CUADRE ───────────────────────────────────────
  //
  // ⚠ ESTE ES EL CAMPO MÁS DELICADO DE LA APP: el efectivo que una persona le
  // entrega a otra al cerrar el día. `Cuadre` es un componente del rediseño con
  // su propio `<input>`, así que no heredaba nada de `MoneyInput` y el modo
  // abreviado no se aplicaba: quien lo tiene encendido teclea «96» para
  // registrar $96.000 y registraba $96. La diferencia se le carga al cobrador.
  //
  // `montoRecibido` guarda SIEMPRE pesos reales —es lo que viaja al servidor y
  // lo que produce la diferencia del cuadre—; `tecleado` es solo lo que se ve
  // mientras se escribe.
  const { modoAbreviado } = useAuth()
  const [montoRecibido, setMontoRecibido] = useState('')
  const [tecleado, setTecleado] = useState(null)
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  // Lo que dijo el servidor cuando no guardó. Se tragaba en silencio: el modal
  // se quedaba abierto sin decir nada y el lote no hacía nada visible
  // (DETALLES-CAJA-Y-CAPITAL #20).
  const [errorGuardar, setErrorGuardar] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/caja/cuadre?fecha=${fecha}`)
      const d = await res.json()
      setData(res.ok ? d : null)
    } catch { setData(null) } finally { setLoading(false) }
  }, [fecha])

  useEffect(() => { fetchData() }, [fetchData])

  const filas = useMemo(() => {
    const arr = [...(data?.filas || [])]
    arr.sort((a, b) => (ESTADO[a.estado]?.orden ?? 9) - (ESTADO[b.estado]?.orden ?? 9))
    if (filtro === 'pendientes') return arr.filter((f) => f.estado === 'pendiente')
    if (filtro === 'diferencia') return arr.filter((f) => f.estado === 'faltante' || f.estado === 'sobrante')
    return arr
  }, [data, filtro])

  const g = data?.resumenGlobal


  const abrirConfirmar = (fila) => {
    setErrorGuardar('')
    setModal(fila)
    // La cifra del sistema es EXACTA, no un número de miles: se olvida lo
    // tecleado para que el campo la pinte ya convertida a lo que se ve.
    setTecleado(null)
    // Al EDITAR un cuadre ya hecho se parte de lo que se CONTÓ, no de la cifra
    // del sistema: abrir y confirmar sin tocar convertía cualquier faltante en
    // «Cuadró» (DETALLES-CAJA-Y-CAPITAL #15).
    setMontoRecibido(String(fila.efectivoRecibido != null ? fila.efectivoRecibido : (fila.recaudadoSistema || 0)))
    setNota(fila.notaCuadre || '')
  }

  /* Llegando desde «Registrar cierre» de una ruta (DETALLES-RUTAS #1) se abre
     directo el «Cerrar y cuadrar» de ese cobrador. Una sola vez. */
  const yaAbierto = useRef(false)
  useEffect(() => {
    if (!abrirCobradorId || yaAbierto.current || !data?.filas) return
    const fila = data.filas.find((f) => f.cobradorId === abrirCobradorId)
    if (!fila) return
    yaAbierto.current = true
    abrirConfirmar(fila)
  }, [abrirCobradorId, data]) // eslint-disable-line react-hooks/exhaustive-deps

  const confirmar = async () => {
    if (!modal) return
    setGuardando(true)
    try {
      const res = await fetch('/api/caja/cuadre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, cobradorId: modal.cobradorId, efectivoRecibido: Number(montoRecibido), nota }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setErrorGuardar(d.error || 'No se pudo guardar el cuadre.')
        return
      }
      setModal(null)
      await fetchData()
    } catch {
      setErrorGuardar('No se pudo guardar el cuadre. Revisa la conexión.')
    } finally { setGuardando(false) }
  }

  // Solo entran al lote los cobradores que YA DECLARARON, al cerrar su caja, el
  // mismo monto que registro el sistema. Ahi el lote no inventa nada: confirma
  // una coincidencia que ya existe.
  //
  // Antes filtraba por estado === 'pendiente', que significa "el admin todavia
  // no confirmo" — NO "cuadra exacto" — y le escribia a todos
  // efectivoRecibido = recaudadoSistema. O sea que por construccion todos
  // quedaban cuadrados con diferencia 0. Si un cobrador traia $120.000 menos,
  // ese faltante quedaba firmado como cuadre perfecto y ya no habia a que
  // volver. Era una firma en blanco sobre plata real.
  const exactos = (data?.filas || []).filter(
    (f) => f.estado === 'pendiente'
      && f.entregadoReportado != null
      && Math.round(f.entregadoReportado) === Math.round(f.recaudadoSistema)
  )

  // Los pendientes que aún no entregan y los que entregaron otra cifra.
  const pendientesFilas = (data?.filas || []).filter((f) => f.estado === 'pendiente')
  const sinEntregar = pendientesFilas.filter((f) => f.entregadoReportado == null).length
  const conDiferencia = pendientesFilas.length - sinEntregar - exactos.length

  const confirmarExactos = async () => {
    if (!exactos.length) return
    setGuardando(true)
    try {
      const confirmaciones = exactos.map((f) => ({ cobradorId: f.cobradorId, efectivoRecibido: f.recaudadoSistema }))
      const res = await fetch('/api/caja/cuadre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, confirmaciones }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setErrorGuardar(d.error || 'No se pudieron confirmar.')
        return
      }
      setErrorGuardar('')
      await fetchData()
    } catch {
      setErrorGuardar('No se pudieron confirmar. Revisa la conexión.')
    } finally { setGuardando(false) }
  }

  if (loading) return <Card><p className="text-sm text-[var(--cf-ink-3)]">Cargando cuadre…</p></Card>
  if (!data || data.filas.length === 0) return null

  const difModal = modal ? Math.round(Number(montoRecibido || 0) - modal.recaudadoSistema) : 0
  // El cobrador no ha entregado: cuadrar es también cerrarle la caja del día.
  const modalCierra = !!modal && modal.estado === 'pendiente' && modal.entregadoReportado == null

  return (
    <div className="space-y-3">
      {/* Banner global */}
      <Card>
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cf-ink-3)]">Cuadre del día</p>
          <span className="text-[11px] text-[var(--cf-ink-3)]">
            <span className="font-bold" style={{ color: g.cuadraron === g.total ? 'var(--cf-green-dark)' : 'var(--cf-gold)' }}>{g.cuadraron}/{g.total}</span> cuadraron
          </span>
        </div>
        {/* El día que se está cuadrando, no siempre «hoy» (DETALLES-CAJA-Y-CAPITAL #20). */}
        <p className="text-[10px] uppercase tracking-wider text-[var(--cf-ink-3)]">
          Total recibido {!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha ?? '')) || fecha === hoyLocal() ? 'hoy' : `el ${Number(fecha.slice(8, 10))} ${MESES[Number(fecha.slice(5, 7)) - 1]}`}
        </p>
        <p className="text-2xl font-bold font-mono-display text-[var(--cf-green-dark)]">
          {formatMoney(g.totalRecibido)}
          <span className="text-xs font-normal text-[var(--cf-ink-3)]"> / {formatMoney(g.totalRecaudadoSistema)} sistema</span>
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px]">
          {g.pendientes > 0 && <span className="text-[var(--cf-ink-3)]">{g.pendientes} pendiente{g.pendientes === 1 ? '' : 's'}</span>}
          {g.conDiferencia > 0 && <span className="text-[var(--cf-red-dark)]">{g.conDiferencia} con diferencia</span>}
          {g.faltanteTotal < 0 && <span className="text-[var(--cf-red-dark)]">Faltante total: {formatMoney(g.faltanteTotal)}</span>}
        </div>
        {/* El boton aparece segun `exactos` (los que declararon lo mismo que el
            sistema), no segun `g.pendientes` (los que faltan por confirmar).
            A los que no coinciden hay que contarles la plata uno por uno. */}
        {exactos.length > 0 && (
          <button
            type="button"
            onClick={confirmarExactos}
            disabled={guardando}
            className="mt-3 w-full h-9 rounded-[10px] text-xs font-semibold text-[var(--cf-ink)] bg-[var(--cf-gold)] hover:bg-[var(--cf-gold-dark)] disabled:opacity-50 transition-colors"
          >
            Confirmar {exactos.length} que entregó{exactos.length === 1 ? '' : 'aron'} lo mismo que dice el sistema
          </button>
        )}
        {errorGuardar && !modal && (
          <p role="alert" className="mt-2 text-xs font-semibold" style={{ color: 'var(--cf-red-dark)' }}>{errorGuardar}</p>
        )}
        {/* ⚠ «NO COINCIDEN» SOLO SI YA ENTREGARON (DETALLES-CAJA #34). Antes de
            que ninguno entregara decía «2 cobradores no coinciden con el
            sistema» con los dos en «Recibido —»: el que no ha entregado no
            coincide ni deja de coincidir. Se dicen por separado. */}
        {sinEntregar > 0 && (
          <p className="mt-2 text-[11px] text-[var(--cf-ink-3)]">
            {sinEntregar} cobrador{sinEntregar === 1 ? '' : 'es'} todavía no entrega{sinEntregar === 1 ? '' : 'n'}.
          </p>
        )}
        {conDiferencia > 0 && (
          <p className="mt-2 text-[11px] text-[var(--cf-ink-3)]">
            {conDiferencia} cobrador{conDiferencia === 1 ? '' : 'es'} entregó{conDiferencia === 1 ? '' : 'aron'} otra cifra que la del sistema: cuéntale{conDiferencia === 1 ? '' : 's'} el efectivo y confirma abajo.
          </p>
        )}
      </Card>

      {/* Filtros */}
      <div className="flex gap-1 p-1 rounded-[12px]" style={{ background: 'var(--cf-fill)', border: '1px solid var(--cf-border)' }}>
        {[{ k: 'todos', l: 'Todos' }, { k: 'pendientes', l: 'Pendientes' }, { k: 'diferencia', l: 'Con diferencia' }].map((t) => (
          <button key={t.k} type="button" onClick={() => setFiltro(t.k)}
            className="flex-1 py-1.5 text-[11px] font-semibold rounded-[8px] transition-all"
            style={filtro === t.k ? { background: 'var(--cf-card)', color: 'var(--cf-gold)' } : { color: 'var(--cf-ink-3)' }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Lista por cobrador */}
      <div className="space-y-2">
        {filas.map((f) => {
          const est = ESTADO[f.estado] || ESTADO.pendiente
          const confirmado = f.estado !== 'pendiente'
          /* Sin cierre del cobrador, el dueño se la CIERRA al cuadrar: así trabaja
             PRESTA MIL, y quitarle el botón lo dejó esperando a los cobradores
             (devuelto el 17 oct 2026). El botón dice lo que hace. */
          const sinEntregar = !confirmado && f.entregadoReportado == null
          return (
            /* ── EN PC, UNA SOLA FILA ──
               La tarjeta apila el nombre arriba y las tres cifras debajo, que es
               lo correcto en 393px. Sentado, cada cobrador gastaba 1024px de
               ancho para tres números y obligaba a bajar por diez tarjetas para
               ver quién no cuadra.
               `lg:flex` la pone en línea: nombre · sistema · recibido ·
               diferencia · botón. Diez cobradores caben de un vistazo, que es la
               pregunta de esta pestaña. */
            <div key={f.cobradorId}
              className="rounded-[12px] border border-[var(--cf-border)] bg-[var(--cf-card)] p-3 lg:flex lg:items-center lg:gap-4 lg:py-2.5">
              <div className="flex items-center justify-between gap-2 lg:flex-1 lg:min-w-0">
                <div className="min-w-0 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: est.color, boxShadow: `0 0 8px ${est.color}` }} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--cf-ink)]" style={{ overflowWrap: 'anywhere' }}>{f.nombre}</p>
                    <p className="text-[11px] text-[var(--cf-ink-3)] truncate">{f.rutaNombre} · {est.label}{confirmado && f.confirmadoEn ? ` ${fmtHora(f.confirmadoEn)}` : ''}</p>
                  </div>
                </div>
                {/* El botón se va al final de la FILA en PC: aquí dentro
                    quedaría pegado al nombre, con las cifras a su derecha. */}
                <span className="lg:hidden">
                  {sinEntregar ? (
                    <button type="button" onClick={() => abrirConfirmar(f)}
                      className="shrink-0 text-[11px] font-semibold text-[var(--cf-ink)] bg-[var(--cf-gold)] hover:bg-[var(--cf-gold-dark)] rounded-[8px] px-3 py-1.5 transition-colors">
                      Cerrar y cuadrar
                    </button>
                  ) : !confirmado ? (
                    <button type="button" onClick={() => abrirConfirmar(f)}
                      className="shrink-0 text-[11px] font-semibold text-[var(--cf-ink)] bg-[var(--cf-gold)] hover:bg-[var(--cf-gold-dark)] rounded-[8px] px-3 py-1.5 transition-colors">
                      Confirmar
                    </button>
                  ) : (
                    <button type="button" onClick={() => abrirConfirmar(f)}
                      className="shrink-0 text-[11px] font-medium text-[var(--cf-gold)] hover:underline px-2 py-1">
                      Editar
                    </button>
                  )}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2.5 lg:mt-0 lg:flex lg:gap-0 lg:flex-none">
                <div className="lg:w-[140px] lg:text-right">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--cf-ink-3)]">Sistema</p>
                  <p className="text-[13px] font-bold font-mono-display text-[var(--cf-ink)]">{formatMoney(f.recaudadoSistema)}</p>
                </div>
                <div className="lg:w-[140px] lg:text-right">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--cf-ink-3)]">Recibido</p>
                  <p className="text-[13px] font-bold font-mono-display text-[var(--cf-ink)]">{f.efectivoRecibido != null ? formatMoney(f.efectivoRecibido) : '—'}</p>
                </div>
                <div className="lg:w-[140px] lg:text-right">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--cf-ink-3)]">Diferencia</p>
                  <p className="text-[13px] font-bold font-mono-display" style={{ color: f.diferencia == null ? 'var(--cf-ink-3)' : f.diferencia === 0 ? 'var(--cf-green-dark)' : f.diferencia < 0 ? 'var(--cf-red-dark)' : 'var(--cf-gold-dark)' }}>
                    {f.diferencia == null ? '—' : `${f.diferencia > 0 ? '+' : ''}${formatMoney(f.diferencia)}`}
                  </p>
                </div>
              </div>
              {/* El botón, al final de la fila en PC. Es el mismo `abrirConfirmar`
                  que el de móvil: una sola acción, dos sitios según el ancho. */}
              <span className="hidden lg:flex lg:flex-none lg:justify-end lg:w-[110px]">
                {sinEntregar ? (
                  <button type="button" onClick={() => abrirConfirmar(f)}
                    className="text-[12px] font-semibold text-[var(--cf-ink)] bg-[var(--cf-gold)] hover:bg-[var(--cf-gold-dark)] rounded-[9px] px-3.5 py-2 transition-colors whitespace-nowrap">
                    Cerrar y cuadrar
                  </button>
                ) : !confirmado ? (
                  <button type="button" onClick={() => abrirConfirmar(f)}
                    className="text-[12px] font-semibold text-[var(--cf-ink)] bg-[var(--cf-gold)] hover:bg-[var(--cf-gold-dark)] rounded-[9px] px-3.5 py-2 transition-colors">
                    Confirmar
                  </button>
                ) : (
                  <button type="button" onClick={() => abrirConfirmar(f)}
                    className="text-[12px] font-medium text-[var(--cf-gold)] hover:underline px-2 py-1">
                    Editar
                  </button>
                )}
              </span>
              {f.notaCuadre && <p className="text-[11px] text-[var(--cf-ink-3)] mt-1.5 italic lg:hidden">“{f.notaCuadre}”</p>}
            </div>
          )
        })}
        {filas.length === 0 && <p className="text-sm text-[var(--cf-ink-3)] text-center py-4">Sin cobradores en este filtro.</p>}
      </div>

      {/* Modal confirmar recibo */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal ? `${modalCierra ? 'Cerrar y cuadrar' : 'Confirmar recibo'} — ${modal.nombre}` : ''}
        footer={
          <>
            {errorGuardar && (
              <p role="alert" className="w-full text-xs font-semibold" style={{ color: 'var(--cf-red-dark)' }}>{errorGuardar}</p>
            )}
            <Button variant="secondary" onClick={() => setModal(null)} disabled={guardando}>Cancelar</Button>
            <Button onClick={confirmar} loading={guardando}>{modalCierra ? 'Cerrar y cuadrar' : 'Confirmar'}</Button>
          </>
        }
      >
        {modal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {modalCierra && (
              <p className="text-[12px] leading-snug rounded-[10px] px-3 py-2.5"
                style={{ background: 'var(--cf-gold-tint)', color: 'var(--cf-gold-text)', border: '1px solid var(--cf-gold-border)' }}>
                {modal.nombre} no ha entregado su caja. Al cuadrar se la cierras por este día: ya no podrá registrar
                cobros de ese día hasta que se la reabras.
              </p>
            )}
            {/* EL CUERPO DEL MODAL PASA A `Cuadre` (T33).
                Lo que cambia, y por qué importa en el momento en que una persona
                le entrega dinero a otra:

                · LAS CAUSAS SON BOTONES, no un «motivo (opcional)» en blanco. Un
                  campo vacío se deja vacío: el administrador tiene ocho cobradores
                  esperando. Con las cuatro causas reales a un toque, la diferencia
                  queda explicada — y una diferencia explicada es la que después se
                  puede buscar.
                · LAS CAUSAS CAMBIAN DE LADO: un faltante y un sobrante no se
                  explican igual. Faltar suele ser un gasto sin registrar; sobrar,
                  un cobro sin anotar.
                · LA DIFERENCIA TRAE SU PROPORCIÓN («4% de lo recaudado»), que es
                  lo que dice si buscar un error de conteo o un billete perdido.

                El endpoint, el guardado y `nota` no se tocan: la causa elegida
                escribe en `nota`, que es lo que ya viajaba. */}
            <Cuadre
              segunLaApp={formatMoney(modal.recaudadoSistema)}
              contado={tecleado != null ? tecleado : montoParaMostrarConModo(montoRecibido, modoAbreviado, undefined)}
              /* SOLO DÍGITOS. `MoneyInput` entregaba el valor ya limpio; el campo
                 de `Cuadre` no limpia nada, y `confirmar` hace `Number(...)`. Si
                 alguien teclea «1.200.000» —que es como se escribe aquí— eso da
                 NaN y viaja al endpoint como el efectivo recibido. Es el momento
                 en que una persona le entrega dinero a otra: no puede depender de
                 si escribió los puntos. */
              onContado={(v) => {
                const crudo = montoCrudo(v)
                setTecleado(crudo)
                setMontoRecibido(montoCrudoConModo(crudo, modoAbreviado))
              }}
              diferencia={diferenciaDeCuadre(
                { sistema: modal.recaudadoSistema, contado: montoRecibido },
                formatMoney,
              )}
              causas={difModal !== 0 ? causasDeDescuadre(difModal > 0 ? 'sobra' : 'falta') : []}
              onCausa={(c) => setNota(c.titulo)}
            />

            {/* La causa elegida se ve y se puede matizar a mano: «un gasto que no
                se registró» es el titular, y a veces hace falta decir cuál. */}
            {difModal !== 0 && (
              <input
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Puedes añadir un detalle…"
                style={{
                  width: '100%', height: 44, padding: '0 14px', borderRadius: 14,
                  background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
                  font: 'inherit', fontSize: 14, color: 'var(--cf-ink)', outline: 'none',
                }}
              />
            )}

            <p style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-3)', margin: 0 }}>
              La diferencia se registra como ajuste de caja para no descuadrar el capital.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
