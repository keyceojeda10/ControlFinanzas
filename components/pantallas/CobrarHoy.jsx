'use client'

// components/pantallas/CobrarHoy.jsx — Turno 2 del handoff.
//
// LA GRAMÁTICA DE CIFRAS DEL DÍA (04-CRITERIOS § B). El orden NO es negociable:
//
//   1 · Recaudado (lo que ya entró)      ← grande
//   2 · Falta (lo que queda por cobrar)  ← al lado, mediano
//   3 · Los cobrados, colapsados en una línea con su total
//
// Nunca al revés. Lo primero que quiere saber el cobrador es cuánto lleva, no
// cuánto le falta: lleva toda la mañana juntándolo.
//
// Y los que ya cobró NO ocupan sitio. Están hechos; lo que queda es la lista de
// los que faltan. Se colapsan en una línea que se puede abrir.

import { useState } from 'react'
import TarjetaCliente from '@/components/cf/TarjetaCliente'
import { BloqueOscuro, BarraProgreso, Pastilla, EstadoVacio, BotonPrimario } from '@/components/cf/primitivos'

function LineaCobrados({ cantidad, total, abierto, onAbrir, children }) {
  if (!cantidad) return null
  return (
    <div style={{
      background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
      borderRadius: 'var(--cf-r-card)', overflow: 'hidden', flex: 'none',
    }}>
      <button type="button" onClick={onAbrir} style={{
        display: 'flex', alignItems: 'center', gap: 11, width: '100%',
        padding: '14px 19px', background: 'none', border: 0, cursor: 'pointer',
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 22, height: 22, borderRadius: 999, flex: 'none',
          background: 'var(--cf-green-pill-bg)', border: '1px solid var(--cf-green-pill-border)',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--cf-green-dark)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <span className="cf-num" style={{ flex: 1, textAlign: 'left', fontSize: 13.5, fontWeight: 600, color: 'var(--cf-ink-2)' }}>
          {cantidad} cobrado{cantidad === 1 ? '' : 's'} hoy
        </span>
        <span className="cf-fig" style={{ fontSize: 15, color: 'var(--cf-green-dark)' }}>{total}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cf-chevron)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flex: 'none', transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {abierto && <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>}
    </div>
  )
}

export default function CobrarHoy({
  recaudado = '$0',
  falta = '$0',
  porcentaje = 0,
  pendientes = [],
  cobrados = [],
  totalCobrados = '$0',
  onCobrar,
  onIrARuta,
}) {
  const [abierto, setAbierto] = useState(false)
  const terminado = pendientes.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cf-gap-cards)', padding: '8px var(--cf-pad-screen) 0' }}>

      {/* La respuesta: cuánto llevas, y al lado cuánto falta. */}
      <BloqueOscuro etiqueta="Recaudado hoy" cifra={recaudado} tono="favor">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, marginTop: -4 }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8A8E98' }}>
              Falta
            </span>
            <span className="cf-fig" style={{ fontSize: 19, color: '#F3F3F6' }}>{falta}</span>
          </span>
          <span className="cf-num" style={{ fontSize: 12, color: '#8A8E98' }}>
            {porcentaje}% de la meta
          </span>
        </div>
        <BarraProgreso porcentaje={porcentaje} tono="ok" alto={11}
          style={{ background: 'rgba(255,255,255,.10)' }} />
      </BloqueOscuro>

      {/* Los que ya cobró: colapsados. Están hechos, no ocupan sitio. */}
      <LineaCobrados cantidad={cobrados.length} total={totalCobrados} abierto={abierto} onAbrir={() => setAbierto(v => !v)}>
        {cobrados.map((c, i) => (
          <TarjetaCliente key={i} {...c} estado="aldia" etiquetaEstado="Pagó" />
        ))}
      </LineaCobrados>

      {/* Lo que falta */}
      {terminado ? (
        <EstadoVacio
          titulo="Terminaste el día"
          explicacion={`Cobraste ${totalCobrados}. No queda nadie pendiente para hoy.`}
          accion={<BotonPrimario onClick={onIrARuta}>Ver la ruta de mañana</BotonPrimario>}
        />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '4px 2px 0', flex: 'none' }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
              Faltan por cobrar
            </span>
            <Pastilla tono="neutro" numerica>{pendientes.length}</Pastilla>
          </div>
          {pendientes.map((c, i) => (
            <TarjetaCliente key={i} {...c} onClick={() => onCobrar?.(c)} />
          ))}
        </>
      )}
    </div>
  )
}
