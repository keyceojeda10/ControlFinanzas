'use client'
// components/rutas/HojaRutaImprimible.jsx
// Hoja de cobro imprimible de una ruta, para entregársela en papel al cobrador.
// Se renderiza siempre en el DOM pero oculta en pantalla; solo aparece en
// @media print. Se dispara con window.print() desde el botón "Imprimir".
//
// Diseño pensado para papel B/N: texto negro sobre blanco, líneas finas,
// numerada en el orden de la ruta, con casilla para marcar a mano lo recogido.

import { formatMoney } from '@/lib/i18n'

const fmtFechaLarga = () =>
  new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export default function HojaRutaImprimible({ ruta, clientes }) {
  // Solo clientes con cobro hoy o con saldo (los que el cobrador debe visitar).
  const lista = (clientes || []).filter(
    (c) => c.estado !== 'completado' && (c.cobroPendienteHoy || c.cuota > 0 || (c.diasMora || 0) > 0)
  )

  const totalEsperado = lista.reduce((a, c) => a + (c.cobroPendienteHoy ? Math.round(c.cuota || 0) : 0), 0)
  const enMora = lista.filter((c) => (c.diasMora || 0) > 0).length

  return (
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
          <p className="hr-count">{lista.length} clientes · {enMora} en mora</p>
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
            <th className="hr-c-saldo">Saldo</th>
            <th className="hr-c-rec">Recogido</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((c, i) => (
            <tr key={c.id}>
              <td className="hr-c-num">{i + 1}</td>
              <td className="hr-c-cli">
                <span className="hr-nombre">{c.nombre}</span>
                {c.cedula ? <span className="hr-ced">CC {c.cedula}</span> : null}
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
              <td className="hr-c-saldo">{formatMoney(c.montoEnMora || c.cuota || 0)}</td>
              <td className="hr-c-rec"></td>
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

      <p className="hr-pie-marca">Control Finanzas · Generado el {new Date().toLocaleString('es-CO')}</p>

      <style jsx global>{`
        .hoja-ruta-print { display: none; }
        @media print {
          /* Ocultar TODO menos la hoja */
          body * { visibility: hidden !important; }
          .hoja-ruta-print, .hoja-ruta-print * { visibility: visible !important; }
          .hoja-ruta-print {
            display: block !important;
            position: absolute;
            left: 0; top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
            color: #000;
            background: #fff;
            font-family: Arial, Helvetica, sans-serif;
          }
          @page { size: A4; margin: 14mm 12mm; }

          .hr-head {
            display: flex; justify-content: space-between; align-items: flex-start;
            border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px;
          }
          .hr-title { font-size: 18px; font-weight: 800; margin: 0; }
          .hr-sub { font-size: 12px; margin: 4px 0 0; }
          .hr-meta { text-align: right; }
          .hr-fecha { font-size: 12px; margin: 0; text-transform: capitalize; }
          .hr-count { font-size: 11px; margin: 3px 0 0; color: #333; }

          .hr-table { width: 100%; border-collapse: collapse; font-size: 11px; }
          .hr-table th {
            text-align: left; border-bottom: 1.5px solid #000; padding: 5px 4px;
            font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em;
          }
          .hr-table td { border-bottom: 1px solid #bbb; padding: 7px 4px; vertical-align: top; }
          .hr-table tr { page-break-inside: avoid; }

          .hr-c-num { width: 22px; text-align: center; color: #444; }
          .hr-c-cuota, .hr-c-saldo { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
          .hr-c-rec { width: 70px; border-left: 1px solid #ddd; }
          .hr-c-est { width: 60px; }

          .hr-nombre { display: block; font-weight: 700; }
          .hr-ced { display: block; font-size: 9px; color: #555; }
          .hr-dir { display: block; }
          .hr-tel { display: block; font-size: 10px; color: #555; }
          .hr-mora { font-weight: 700; }
          .hr-aldia { color: #444; }

          .hr-foot {
            display: flex; gap: 24px; margin-top: 16px; padding-top: 10px;
            border-top: 2px solid #000;
          }
          .hr-foot-box { font-size: 11px; }
          .hr-foot-box span { display: block; color: #333; margin-bottom: 3px; }
          .hr-foot-box strong { font-size: 14px; }
          .hr-blank { font-weight: 400; }

          .hr-pie-marca { margin-top: 18px; font-size: 9px; color: #888; text-align: center; }
        }
      `}</style>
    </div>
  )
}
