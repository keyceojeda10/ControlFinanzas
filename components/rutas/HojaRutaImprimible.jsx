'use client'
// components/rutas/HojaRutaImprimible.jsx
// Hoja de cobro imprimible de una ruta, para entregársela en papel al cobrador.
// Se renderiza siempre en el DOM pero oculta en pantalla; solo aparece en
// @media print. Se dispara con window.print() desde el botón "Imprimir".
//
// Diseño pensado para papel B/N: texto negro sobre blanco, líneas finas,
// numerada en el orden de la ruta, con casilla para marcar a mano lo recogido.
// Estilo alineado al Reporte del dia (stat grid con cajas bordeadas, headers
// uppercase con borde fino, filas alternadas para lectura rápida).

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatMoney } from '@/lib/i18n'

const fmtFechaLarga = () =>
  new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export default function HojaRutaImprimible({ ruta, clientes }) {
  // La hoja se monta como hijo DIRECTO de <body> mediante un portal.
  //
  // Antes vivia dentro del arbol de la pagina de ruta y se ocultaba todo lo
  // demas con `visibility: hidden`. Pero visibility oculta SIN sacar del flujo:
  // el dashboard entero seguia ocupando su alto y seguia generando saltos de
  // pagina. Por eso salian la hoja util y despues 5-7 hojas en blanco (el alto
  // del dashboard). Con el portal se puede usar `display: none`, que si saca
  // del flujo y elimina esas paginas.
  const [montado, setMontado] = useState(false)
  useEffect(() => { setMontado(true) }, [])
  // Solo clientes con cobro hoy o con saldo (los que el cobrador debe visitar).
  const lista = (clientes || []).filter(
    (c) => c.estado !== 'completado' && (c.cobroPendienteHoy || c.cuota > 0 || (c.diasMora || 0) > 0)
  )

  const totalEsperado = lista.reduce((a, c) => a + (c.cobroPendienteHoy ? Math.round(c.cuota || 0) : 0), 0)
  const enMora = lista.filter((c) => (c.diasMora || 0) > 0).length

  if (!montado) return null

  return createPortal(
    <div className="hoja-ruta-print" aria-hidden="true">
      {/* Encabezado */}
      <div className="hr-head">
        <div>
          <h1 className="hr-title">{ruta?.nombre || 'Ruta de cobro'}</h1>
          <p className="hr-sub">
            Cobrador: <strong>{ruta?.cobrador?.nombre || '________________'}</strong>
          </p>
        </div>
        <div className="hr-meta">
          <p className="hr-fecha">{fmtFechaLarga()}</p>
          <p className="hr-count">{lista.length} clientes &middot; {enMora} en mora</p>
        </div>
      </div>

      {/* Resumen tipo stat grid (igual al Reporte del dia) */}
      <div className="hr-grid">
        <div className="hr-stat">
          <p className="hr-stat-label">Total esperado hoy</p>
          <p className="hr-stat-value">{formatMoney(totalEsperado)}</p>
        </div>
        <div className="hr-stat">
          <p className="hr-stat-label">Clientes</p>
          <p className="hr-stat-value">{lista.length}</p>
        </div>
        <div className="hr-stat">
          <p className="hr-stat-label">En mora</p>
          <p className="hr-stat-value">{enMora}</p>
        </div>
      </div>

      {/* Tabla */}
      <table className="hr-table">
        <thead>
          <tr>
            <th className="hr-c-num">#</th>
            <th className="hr-c-cli">Cliente</th>
            <th className="hr-c-dir">Dirección / Teléfono</th>
            <th className="hr-c-est">Estado</th>
            <th className="hr-c-cuota">Cuota hoy</th>
            <th className="hr-c-saldo">Debe (total)</th>
            <th className="hr-c-rec">Recogido</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((c, i) => (
            <tr key={c.id} className={i % 2 === 1 ? 'hr-row-alt' : ''}>
              <td className="hr-c-num">{i + 1}</td>
              <td className="hr-c-cli">
                <span className="hr-nombre">{c.nombre}</span>
                {c.cedula && !c.cedula.startsWith('SIN-') ? <span className="hr-ced">CC {c.cedula}</span> : null}
              </td>
              <td className="hr-c-dir">
                {c.direccion ? <span className="hr-dir">{c.direccion}</span> : null}
                {c.telefono ? <span className="hr-tel">{c.telefono}</span> : null}
              </td>
              <td className="hr-c-est">
                {(c.diasMora || 0) > 0 ? (
                  <span className="hr-mora">{c.diasMora}d mora</span>
                ) : (
                  <span className="hr-aldia">Al día</span>
                )}
              </td>
              <td className="hr-c-cuota">{c.cobroPendienteHoy ? formatMoney(c.cuota) : '—'}</td>
              {/* Esta columna decia "Saldo" y mostraba la MORA (o, si no habia
                  mora, la cuota del dia). En la calle eso es peligroso: un
                  cliente pide cancelar todo, el cobrador lee "Saldo $18.000" y
                  cobra $18.000 por un prestamo que debe $340.000. Ahora es el
                  saldo real, sumando todos los prestamos activos del cliente. */}
              <td className="hr-c-saldo">
                {formatMoney(
                  (c.prestamosActivos || []).reduce((s, p) => s + (p.saldoPendiente || 0), 0)
                )}
              </td>
              <td className="hr-c-rec">
                <span className="hr-rec-box" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pie con totales */}
      <div className="hr-foot">
        <div className="hr-foot-box">
          <span>Total esperado hoy</span>
          <strong>{formatMoney(totalEsperado)}</strong>
        </div>
        <div className="hr-foot-box">
          <span>Total recogido</span>
          <strong className="hr-blank">$ ____________</strong>
        </div>
        <div className="hr-foot-box">
          <span>Firma cobrador</span>
          <strong className="hr-blank">________________</strong>
        </div>
      </div>

      <p className="hr-pie-marca">Control Finanzas &middot; Generado el {new Date().toLocaleString('es-CO')}</p>

      <style jsx global>{`
        .hoja-ruta-print { display: none; }
        @media print {
          /* display:none, NO visibility:hidden. visibility oculta pero conserva
             la caja y su alto, asi que el dashboard seguia generando saltos de
             pagina: salian la hoja util y despues 5-7 hojas en blanco. Como la
             hoja ahora es hija directa de <body> (portal), se puede apagar a
             todos sus hermanos sin apagarla a ella. */
          body > *:not(.hoja-ruta-print) { display: none !important; }
          html, body {
            height: auto !important;
            overflow: visible !important;
            background: #fff !important;
          }
          /* La tabla repite encabezados si la ruta ocupa mas de una hoja. */
          .hr-table thead { display: table-header-group; }
          .hr-table tr { page-break-inside: avoid; }
          .hoja-ruta-print {
            display: block !important;
            position: static;
            width: 100%;
            padding: 0;
            margin: 0;
            color: #111;
            background: #fff;
            font-family: Arial, Helvetica, sans-serif;
          }
          @page { size: A4; margin: 14mm 12mm; }

          /* Encabezado */
          .hr-head {
            display: flex; justify-content: space-between; align-items: flex-start;
            border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px;
          }
          .hr-title { font-size: 18px; font-weight: 800; margin: 0; }
          .hr-sub { font-size: 12px; margin: 4px 0 0; color: #333; }
          .hr-meta { text-align: right; }
          .hr-fecha { font-size: 12px; margin: 0; text-transform: capitalize; }
          .hr-count { font-size: 11px; margin: 3px 0 0; color: #333; }

          /* Resumen: stat grid con cajas bordeadas */
          .hr-grid {
            display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
            margin-bottom: 14px;
          }
          .hr-stat { border: 1px solid #ccc; border-radius: 6px; padding: 8px 10px; }
          .hr-stat-label {
            font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.03em;
            margin: 0;
          }
          .hr-stat-value {
            font-size: 16px; font-weight: 700; margin: 2px 0 0;
            font-variant-numeric: tabular-nums;
          }

          /* Tabla */
          .hr-table { width: 100%; border-collapse: collapse; font-size: 11px; }
          .hr-table thead tr { border-top: 2px solid #111; }
          .hr-table th {
            text-align: left; border-bottom: 1.5px solid #111; padding: 6px 5px;
            font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; color: #111;
          }
          .hr-table tbody tr:last-child td { border-bottom: 2px solid #111; }
          .hr-table td { border-bottom: 1px solid #ddd; padding: 7px 5px; vertical-align: top; }
          .hr-table tr { page-break-inside: avoid; }
          .hr-row-alt { background: #f5f5f5; }

          .hr-c-num { width: 22px; text-align: center; color: #444; }
          .hr-c-cuota, .hr-c-saldo {
            text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums;
          }
          .hr-c-rec { width: 90px; border-left: 1px solid #ccc; text-align: center; }
          .hr-rec-box {
            display: inline-block; width: 100%; min-width: 64px; height: 20px;
            border: 1px solid #999; border-radius: 3px;
          }
          .hr-c-est { width: 62px; }

          .hr-nombre { display: block; font-weight: 700; }
          .hr-ced { display: block; font-size: 9px; color: #555; }
          .hr-dir { display: block; }
          .hr-tel { display: block; font-size: 10px; color: #555; }
          .hr-mora { font-weight: 700; }
          .hr-aldia { color: #777; font-weight: 400; }

          /* Pie con totales */
          .hr-foot {
            display: flex; gap: 12px; margin-top: 16px;
          }
          .hr-foot-box {
            flex: 1; font-size: 11px; border: 1px solid #ccc; border-radius: 6px;
            padding: 8px 10px;
          }
          .hr-foot-box span {
            display: block; color: #666; margin-bottom: 3px;
            text-transform: uppercase; font-size: 10px; letter-spacing: 0.03em;
          }
          .hr-foot-box strong { font-size: 14px; font-variant-numeric: tabular-nums; }
          .hr-blank { font-weight: 400; }

          .hr-pie-marca { margin-top: 18px; font-size: 9px; color: #999; text-align: center; }
        }
      `}</style>
    </div>,
    document.body
  )
}
