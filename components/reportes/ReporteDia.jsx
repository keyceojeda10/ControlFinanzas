'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatMoney } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'

const fmtHora = (d) => {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Bogota',
  })
}

const fmtFechaDisplay = (fecha) => {
  if (!fecha) return ''
  const d = new Date(fecha + 'T12:00:00-05:00')
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' })
}

const getColombiaDateStr = () => {
  const d = new Date(Date.now() - 5 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

export default function ReporteDia({ open, onClose, rutasDisponibles = [], fechaInicial }) {
  const { esOwner, esCobrador, session, orgNombre } = useAuth()
  const [fecha, setFecha] = useState(fechaInicial || getColombiaDateStr())
  const [rutasSeleccionadas, setRutasSeleccionadas] = useState([])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [compartiendo, setCompartiendo] = useState(false)
  const reporteRef = useRef(null)

  useEffect(() => {
    if (open && rutasDisponibles.length > 0 && rutasSeleccionadas.length === 0) {
      if (esCobrador) {
        setRutasSeleccionadas(rutasDisponibles.map(r => r.id))
      }
    }
  }, [open, rutasDisponibles, esCobrador])

  const cargarReporte = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ fecha })
      if (rutasSeleccionadas.length > 0) {
        params.set('rutas', rutasSeleccionadas.join(','))
      }
      const res = await fetch(`/api/reportes/dia?${params}`)
      if (!res.ok) throw new Error('Error al cargar reporte')
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [fecha, rutasSeleccionadas])

  /* ── SE CARGA SOLO AL ABRIR ────────────────────────────────────────────────
   *
   * Reportado por el dueño el 16 ago 2026: «en caja está ese botón que dice
   * reporte, cuando le doy ahí solamente aparece un selector de fecha y no hace
   * más nada».
   *
   * Era literal, y la causa eran dos condiciones que se cerraban entre sí:
   *
   *   · el reporte solo se cargaba con `rutasSeleccionadas.length > 0`, y para
   *     un dueño esa lista arranca VACÍA (el auto-seleccionar de arriba es solo
   *     para el cobrador),
   *   · las pastillas para elegir ruta solo se pintan con MÁS DE UNA ruta,
   *   · y el botón «Generar reporte» solo aparece si ya hay rutas elegidas.
   *
   * O sea: un dueño con una ruta o con ninguna no tenía forma de llegar al
   * reporte. Ni pastillas que tocar, ni botón, ni carga automática. Solo el
   * selector de fecha, que es exactamente lo que él fotografió.
   *
   * Sin filtro, `/api/reportes/dia` ya devuelve TODAS las rutas y además los
   * clientes sin ruta asignada, que es lo que se quiere por defecto. Las
   * pastillas siguen ahí para acotar cuando hay varias, y ahora recargan solas
   * al tocarlas en vez de obligar a pulsar «Generar» otra vez. */
  useEffect(() => {
    if (open) cargarReporte()
  }, [open, cargarReporte])

  const toggleRuta = (id) => {
    setRutasSeleccionadas(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    )
  }

  const seleccionarTodas = () => {
    if (rutasSeleccionadas.length === rutasDisponibles.length) {
      setRutasSeleccionadas([])
    } else {
      setRutasSeleccionadas(rutasDisponibles.map(r => r.id))
    }
  }

  const imprimir = () => {
    const el = reporteRef.current
    if (!el) return
    const win = window.open('', '_blank', 'width=800,height=600')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte del dia - ${fmtFechaDisplay(data?.fecha)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; padding: 16px; font-size: 12px; }
  h1 { font-size: 16px; margin-bottom: 2px; }
  h2 { font-size: 13px; margin: 14px 0 6px; border-bottom: 1.5px solid #111; padding-bottom: 3px; text-transform: uppercase; letter-spacing: 0.03em; }
  .sub { color: #555; font-size: 11px; margin-bottom: 12px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px; }
  .stat { border: 1px solid #ddd; border-radius: 6px; padding: 8px; }
  .stat-label { font-size: 10px; color: #666; text-transform: uppercase; }
  .stat-value { font-size: 16px; font-weight: 700; margin-top: 2px; }
  .stat-value.green { color: #16a34a; }
  .stat-value.red { color: #dc2626; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px; }
  th { text-align: left; border-bottom: 1.5px solid #111; padding: 5px 4px; font-size: 10px; text-transform: uppercase; }
  td { border-bottom: 1px solid #ddd; padding: 5px 4px; }
  .right { text-align: right; font-variant-numeric: tabular-nums; }
  .mono { font-variant-numeric: tabular-nums; }
  .badge { display: inline-block; font-size: 9px; padding: 1px 6px; border-radius: 4px; font-weight: 600; }
  .badge-ok { background: #dcfce7; color: #166534; }
  .badge-warn { background: #fef3c7; color: #92400e; }
  .badge-info { background: #dbeafe; color: #1e40af; }
  .footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #bbb; font-size: 9px; color: #888; text-align: center; }
  .ruta-row { background: #f8f8f8; }
  @page { size: A4; margin: 12mm; }
  @media print { body { padding: 0; } }
</style></head><body>`)

    win.document.write(`<h1>${data?.organizacion || 'Reporte del dia'}</h1>`)
    win.document.write(`<p class="sub">${fmtFechaDisplay(data?.fecha)} &mdash; ${data?.rutas?.map(r => r.nombre).join(', ')}</p>`)

    const r = data?.resumen
    win.document.write(`<h2>Resumen</h2>`)
    win.document.write(`<div class="grid">
      <div class="stat"><div class="stat-label">Recaudado</div><div class="stat-value green">${formatMoney(r?.totalRecaudado)}</div></div>
      <div class="stat"><div class="stat-label">Esperado</div><div class="stat-value">${formatMoney(r?.totalEsperado)}</div></div>
      <div class="stat"><div class="stat-label">Tasa recaudo</div><div class="stat-value">${r?.tasaRecaudo || 0}%</div></div>
      <div class="stat"><div class="stat-label">Gastos</div><div class="stat-value red">${formatMoney(r?.totalGastos)}</div></div>
      <div class="stat"><div class="stat-label">Disponible</div><div class="stat-value">${formatMoney(r?.disponible)}</div></div>
      <div class="stat"><div class="stat-label">Pagos / Pendientes</div><div class="stat-value">${r?.pagosCount || 0} / ${r?.pendientesCount || 0}</div></div>
    </div>`)

    if (data?.porRuta?.length > 1) {
      win.document.write(`<h2>Por ruta</h2><table><thead><tr><th>Ruta</th><th>Cobrador</th><th class="right">Recaudado</th><th class="right">Esperado</th><th class="right">Pagos</th><th class="right">Pendientes</th></tr></thead><tbody>`)
      for (const rr of data.porRuta) {
        win.document.write(`<tr class="ruta-row"><td>${rr.nombre}</td><td>${rr.cobrador || '-'}</td><td class="right mono">${formatMoney(rr.recaudado)}</td><td class="right mono">${formatMoney(rr.esperado)}</td><td class="right">${rr.pagosCount}</td><td class="right">${rr.pendientesCount}</td></tr>`)
      }
      win.document.write(`</tbody></table>`)
    }

    win.document.write(`<h2>Pagos del dia (${data?.pagos?.length || 0})</h2>`)
    if (data?.pagos?.length > 0) {
      win.document.write(`<table><thead><tr><th>#</th><th>Cliente</th><th>Hora</th><th class="right">Monto</th><th>Tipo</th></tr></thead><tbody>`)
      data.pagos.forEach((p, i) => {
        const metodo = p.metodoPago === 'transferencia' ? (p.plataforma ? `Transf. (${p.plataforma})` : 'Transf.') : ''
        win.document.write(`<tr><td>${i + 1}</td><td>${p.clienteNombre}${p.clienteCedula ? ` <small style="color:#888">${p.clienteCedula}</small>` : ''}</td><td>${fmtHora(p.hora)}</td><td class="right mono">${formatMoney(p.monto)}</td><td>${metodo ? `<span class="badge badge-info">${metodo}</span>` : ''}</td></tr>`)
      })
      win.document.write(`<tr style="border-top:2px solid #111"><td></td><td><strong>Total</strong></td><td></td><td class="right mono"><strong>${formatMoney(r?.totalRecaudado)}</strong></td><td></td></tr>`)
      win.document.write(`</tbody></table>`)
    } else {
      win.document.write(`<p style="color:#888;font-size:11px;">Sin pagos registrados</p>`)
    }

    if (data?.pendientes?.length > 0) {
      win.document.write(`<h2>No pagaron (${data.pendientes.length})</h2>`)
      win.document.write(`<table><thead><tr><th>#</th><th>Cliente</th><th>Contacto</th><th class="right">Cuota</th><th class="right">Saldo</th></tr></thead><tbody>`)
      data.pendientes.forEach((p, i) => {
        win.document.write(`<tr><td>${i + 1}</td><td>${p.clienteNombre}${p.clienteCedula ? ` <small style="color:#888">${p.clienteCedula}</small>` : ''}</td><td>${p.clienteTelefono || '-'}</td><td class="right mono">${formatMoney(p.cuotaTotal)}</td><td class="right mono">${formatMoney(p.saldoPendiente)}</td></tr>`)
      })
      win.document.write(`</tbody></table>`)
    }

    if (data?.gastos?.length > 0) {
      win.document.write(`<h2>Gastos (${data.gastos.length})</h2>`)
      win.document.write(`<table><thead><tr><th>#</th><th>Descripcion</th><th class="right">Monto</th><th>Estado</th></tr></thead><tbody>`)
      data.gastos.forEach((g, i) => {
        win.document.write(`<tr><td>${i + 1}</td><td>${g.descripcion}</td><td class="right mono">${formatMoney(g.monto)}</td><td><span class="badge ${g.estado === 'aprobado' ? 'badge-ok' : 'badge-warn'}">${g.estado}</span></td></tr>`)
      })
      win.document.write(`</tbody></table>`)
    }

    win.document.write(`<div class="footer">Control Finanzas &middot; Generado el ${new Date().toLocaleString('es-CO')}</div>`)
    win.document.write(`</body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 300)
  }

  const compartirTexto = async () => {
    if (!data) return
    setCompartiendo(true)
    try {
      const r = data.resumen
      let texto = `*Reporte del dia*\n${fmtFechaDisplay(data.fecha)}\n`
      texto += `${data.rutas.map(rt => rt.nombre).join(', ')}\n\n`
      texto += `Recaudado: ${formatMoney(r.totalRecaudado)}\n`
      texto += `Esperado: ${formatMoney(r.totalEsperado)}\n`
      texto += `Tasa recaudo: ${r.tasaRecaudo}%\n`
      texto += `Gastos: ${formatMoney(r.totalGastos)}\n`
      texto += `Disponible: ${formatMoney(r.disponible)}\n\n`

      if (data.pagos.length > 0) {
        texto += `*Pagos (${data.pagos.length})*\n`
        data.pagos.forEach((p, i) => {
          texto += `${i + 1}. ${p.clienteNombre} — ${formatMoney(p.monto)}\n`
        })
        texto += `\n`
      }

      if (data.pendientes.length > 0) {
        texto += `*No pagaron (${data.pendientes.length})*\n`
        data.pendientes.forEach((p, i) => {
          texto += `${i + 1}. ${p.clienteNombre} — Cuota: ${formatMoney(p.cuotaTotal)}\n`
        })
        texto += `\n`
      }

      if (data.gastos.length > 0) {
        texto += `*Gastos (${data.gastos.length})*\n`
        data.gastos.forEach((g, i) => {
          texto += `${i + 1}. ${g.descripcion} — ${formatMoney(g.monto)}\n`
        })
      }

      // El reporte lleva nombres de deudores y cuotas, y se comparte por
      // WhatsApp: lo firma el negocio, no el software. Ver la nota de
      // `lib/whatsapp-plantillas.js`.
      if (orgNombre) texto += `\n_${orgNombre}_`

      if (navigator.share) {
        await navigator.share({ title: 'Reporte del dia', text: texto })
      } else {
        await navigator.clipboard.writeText(texto)
        alert('Reporte copiado al portapapeles')
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        try { await navigator.clipboard.writeText('Error al compartir') } catch {}
      }
    } finally {
      setCompartiendo(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Reporte del dia" size="lg">
      <div className="space-y-3" ref={reporteRef}>
        {/* Selector de fecha */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fecha}
            max={getColombiaDateStr()}
            onChange={(e) => setFecha(e.target.value)}
            className="flex-1 h-9 rounded-[10px] border border-[var(--cf-border)] bg-[var(--cf-card)] px-3 text-sm text-[var(--cf-ink)] focus:outline-none focus:border-[var(--cf-ink-2)]"
          />
        </div>

        {/* Selector de rutas (owner) */}
        {esOwner && rutasDisponibles.length > 1 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-[var(--cf-ink-3)]">Rutas</p>
              <button
                type="button"
                onClick={seleccionarTodas}
                className="text-[11px] font-semibold text-[var(--cf-ink-2)]"
              >
                {rutasSeleccionadas.length === rutasDisponibles.length ? 'Deseleccionar' : 'Todas'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {rutasDisponibles.map(r => {
                const sel = rutasSeleccionadas.includes(r.id)
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleRuta(r.id)}
                    className="px-2.5 py-1 rounded-[8px] text-xs font-medium transition-colors"
                    style={{
                      background: sel ? 'var(--cf-ink-2)' : 'var(--cf-fill)',
                      color: sel ? '#fff' : 'var(--cf-ink-3)',
                      border: `1px solid ${sel ? 'var(--cf-ink-2)' : 'var(--cf-border)'}`,
                    }}
                  >
                    {r.nombre}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Reintentar. Ya no es la ÚNICA forma de llegar al reporte —ese era el
            fallo— sino la salida cuando la carga automática no trajo nada. */}
        {!data && !loading && (
          <Button onClick={cargarReporte} size="sm" className="w-full">Generar reporte</Button>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-[var(--cf-ink-2)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="p-3 rounded-[10px] text-sm text-[var(--cf-red-dark)]" style={{ background: 'var(--cf-red-pill-bg)' }}>
            {error}
          </div>
        )}

        {data && !loading && (
          <>
            {/* Header */}
            <div className="text-center pb-2" style={{ borderBottom: '1px solid var(--cf-border)' }}>
              <p className="text-[11px] text-[var(--cf-ink-3)] capitalize">{fmtFechaDisplay(data.fecha)}</p>
              <p className="text-xs text-[var(--cf-ink-3)]">{data.rutas.map(r => r.nombre).join(', ')}</p>
            </div>

            {/* Resumen */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Recaudado', value: formatMoney(data.resumen.totalRecaudado), color: 'var(--cf-green-dark)' },
                { label: 'Esperado', value: formatMoney(data.resumen.totalEsperado), color: 'var(--cf-ink)' },
                { label: 'Recaudo', value: `${data.resumen.tasaRecaudo}%`, color: data.resumen.tasaRecaudo >= 80 ? 'var(--cf-green-dark)' : data.resumen.tasaRecaudo >= 50 ? 'var(--cf-gold-dark)' : 'var(--cf-red-dark)' },
                { label: 'Gastos', value: formatMoney(data.resumen.totalGastos), color: 'var(--cf-red-dark)' },
                { label: 'Disponible', value: formatMoney(data.resumen.disponible), color: 'var(--cf-ink-2)' },
                { label: 'Pagos', value: `${data.resumen.pagosCount}`, color: 'var(--cf-ink)' },
              ].map(s => (
                <div key={s.label} className="rounded-[10px] px-2.5 py-2" style={{ background: 'var(--cf-fill)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cf-ink-3)]">{s.label}</p>
                  <p className="text-sm font-bold font-mono-display" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Por ruta (si hay más de 1) */}
            {data.porRuta.length > 1 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cf-ink-3)] mb-1.5">Por ruta</p>
                <div className="space-y-1.5">
                  {data.porRuta.map(rr => (
                    <div key={rr.id} className="flex items-center justify-between rounded-[8px] px-2.5 py-1.5" style={{ background: 'var(--cf-fill)' }}>
                      <div>
                        <p className="text-xs font-semibold text-[var(--cf-ink)]">{rr.nombre}</p>
                        {rr.cobrador && <p className="text-[10px] text-[var(--cf-ink-3)]">{rr.cobrador}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold font-mono-display text-[var(--cf-green-dark)]">{formatMoney(rr.recaudado)}</p>
                        <p className="text-[10px] text-[var(--cf-ink-3)]">{rr.pagosCount} pagos · {rr.pendientesCount} pend.</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pagos del día */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cf-ink-3)] mb-1.5">
                Pagos del dia ({data.pagos.length})
              </p>
              {data.pagos.length > 0 ? (
                <div className="space-y-0.5 max-h-[280px] overflow-y-auto">
                  {data.pagos.map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between px-2 py-1.5 rounded-[6px]" style={{ background: i % 2 === 0 ? 'transparent' : 'var(--cf-fill)' }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-[var(--cf-ink-3)] w-5 text-right shrink-0">{i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-xs text-[var(--cf-ink)] truncate">{p.clienteNombre}</p>
                          <p className="text-[10px] text-[var(--cf-ink-3)]">{fmtHora(p.hora)}{p.metodoPago === 'transferencia' ? ' · Transf.' : ''}</p>
                        </div>
                      </div>
                      <p className="text-xs font-bold font-mono-display text-[var(--cf-green-dark)] shrink-0">{formatMoney(p.monto)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--cf-ink-3)] py-3 text-center">Sin pagos registrados</p>
              )}
            </div>

            {/* No pagaron */}
            {data.pendientes.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cf-ink-3)] mb-1.5">
                  No pagaron ({data.pendientes.length})
                </p>
                <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
                  {data.pendientes.map((p, i) => (
                    <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded-[6px]" style={{ background: i % 2 === 0 ? 'transparent' : 'var(--cf-fill)' }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-[var(--cf-ink-3)] w-5 text-right shrink-0">{i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-xs text-[var(--cf-ink)] truncate">{p.clienteNombre}</p>
                          {p.clienteTelefono && <p className="text-[10px] text-[var(--cf-ink-3)]">{p.clienteTelefono}</p>}
                        </div>
                      </div>
                      <p className="text-xs font-bold font-mono-display text-[var(--cf-red-dark)] shrink-0">{formatMoney(p.cuotaTotal)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Gastos */}
            {data.gastos.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cf-ink-3)] mb-1.5">
                  Gastos ({data.gastos.length})
                </p>
                <div className="space-y-0.5">
                  {data.gastos.map((g, i) => (
                    <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded-[6px]" style={{ background: i % 2 === 0 ? 'transparent' : 'var(--cf-fill)' }}>
                      <p className="text-xs text-[var(--cf-ink)] truncate">{g.descripcion}</p>
                      <p className="text-xs font-bold font-mono-display text-[var(--cf-red-dark)] shrink-0">{formatMoney(g.monto)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Acciones */}
            <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid var(--cf-border)' }}>
              <Button onClick={imprimir} size="sm" variant="outline" className="flex-1 gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.25 7.234l.002.001" />
                </svg>
                Imprimir
              </Button>
              <Button onClick={compartirTexto} size="sm" variant="outline" className="flex-1 gap-1.5" disabled={compartiendo}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
                Compartir
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
