'use client'
// app/admin/seguimiento/page.jsx — cómo va el seguimiento (reenganche, en
// riesgo, la oferta del 35 %) y si Meta aprobó las plantillas. Se llega desde
// Inicio: el menú del panel tiene nueve entradas a propósito.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SkeletonTable } from '@/components/ui/Skeleton'

const MOTIVO = {
  precio: 'El precio', no_uso: 'No alcanzó a usarla', falta_algo: 'Le falta algo',
  otro_sistema: 'Cambió de sistema', cerro: 'Cerró el negocio', otro: 'Otro motivo',
}
const PASO = {
  d3_motivo: '¿Nos dice el motivo?', d7_oferta: 'Oferta del 35 %', d21_datos: 'Sus datos siguen guardados',
  aviso: 'Cobros sin registrar', oferta: 'Campaña del 35 %',
}

const fecha = (d) => (d ? new Date(d).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }) : '')

function Cifra({ titulo, valor, pie }) {
  return (
    <div className="rounded-[12px] p-3" style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>{titulo}</p>
      <p className="text-[24px] font-bold font-mono-display mt-1" style={{ color: 'var(--cf-ink)' }}>{valor}</p>
      {pie && <p className="text-[11px] mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>{pie}</p>}
    </div>
  )
}

function Seccion({ titulo, children }) {
  return (
    <section className="rounded-[12px] p-4" style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
      <h2 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--cf-ink)' }}>{titulo}</h2>
      {children}
    </section>
  )
}

export default function SeguimientoAdmin() {
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    fetch('/api/admin/seguimiento').then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setD).catch(() => setError('No se pudo cargar el seguimiento.'))
  }, [])

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <Link href="/admin/inicio" className="text-[12px]" style={{ color: 'var(--cf-gold-dark)' }}>← Inicio</Link>
        <h1 className="text-xl font-bold mt-1" style={{ color: 'var(--cf-ink)' }}>Seguimiento</h1>
        <p className="text-[13px]" style={{ color: 'var(--cf-ink-3)' }}>
          Reenganche de quien se fue, aviso a quien dejó de usar la app y la oferta del 35 % por Nequi guardado. Últimos 30 días.
        </p>
      </div>

      {error && <p className="text-[13px]" style={{ color: 'var(--cf-red-dark)' }}>{error}</p>}
      {!d && !error && <SkeletonTable rows={6} />}

      {d && (<>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Cifra titulo="Bajas preguntadas" valor={d.bajasPreguntadas} pie={`${d.bajasRecuperadas} volvieron a pagar`} />
          <Cifra titulo="Cobro automático" valor={d.oferta.negociosConCobroAutomatico} pie="meta: 30 (eran 8 el 12 oct)" />
          <Cifra titulo="Oferta del 35 %" valor={d.oferta.aplicada} pie={`aplicadas · ${d.oferta.disponible} esperando`} />
          <Cifra titulo="Avisos a Carlos" valor={d.escalados} pie={`${d.noMolestar} pidieron no más mensajes`} />
        </div>

        <Seccion titulo="Lo que se mandó">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ color: 'var(--cf-ink-3)' }} className="text-left text-[11px] uppercase tracking-wide">
                  <th className="py-1.5 pr-3">Mensaje</th><th className="py-1.5 pr-3 text-right">Enviados</th>
                  <th className="py-1.5 pr-3 text-right">Respondieron</th><th className="py-1.5 text-right">Con error</th>
                </tr>
              </thead>
              <tbody>
                {d.porPaso.length === 0 && (
                  <tr><td colSpan={4} className="py-2" style={{ color: 'var(--cf-ink-3)' }}>Todavía no sale nada: las plantillas esperan la aprobación de Meta.</td></tr>
                )}
                {d.porPaso.map((p) => (
                  <tr key={`${p.caso}${p.paso}`} style={{ borderTop: '1px solid var(--cf-border)' }}>
                    <td className="py-2 pr-3" style={{ color: 'var(--cf-ink)' }}>{PASO[p.paso] ?? p.paso}</td>
                    <td className="py-2 pr-3 text-right font-mono-display">{p.enviados}</td>
                    <td className="py-2 pr-3 text-right font-mono-display">{p.respondidos}</td>
                    <td className="py-2 text-right font-mono-display" style={{ color: p.errores ? 'var(--cf-red-dark)' : 'var(--cf-ink-3)' }}>{p.errores}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Seccion>

        <div className="grid sm:grid-cols-2 gap-4">
          <Seccion titulo="Por qué se fueron">
            <ul className="space-y-1.5 text-[13px]">
              {Object.entries(d.motivos).map(([m, n]) => (
                <li key={m} className="flex justify-between"><span style={{ color: 'var(--cf-ink-2)' }}>{MOTIVO[m] ?? m}</span><span className="font-mono-display">{n}</span></li>
              ))}
            </ul>
          </Seccion>
          <Seccion titulo="Plantillas en Meta">
            <ul className="space-y-1.5 text-[12px]">
              {d.plantillas.map((p) => (
                <li key={p.nombre} className="flex justify-between gap-2">
                  <span className="font-mono-display" style={{ color: 'var(--cf-ink-2)' }}>{p.nombre}</span>
                  <span style={{ color: p.estado === 'APPROVED' ? 'var(--cf-green-dark)' : p.estado === 'REJECTED' ? 'var(--cf-red-dark)' : 'var(--cf-ink-3)' }}>
                    {p.estado === 'APPROVED' ? 'aprobada' : p.estado === 'PENDING' ? 'en revisión' : p.estado === 'REJECTED' ? 'rechazada' : p.estado}
                    {p.categoria && p.categoria !== p.pedida ? ` · Meta la pasó a ${p.categoria.toLowerCase()}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </Seccion>
        </div>

        <Seccion titulo="Lo que respondieron">
          {d.respuestas.length === 0
            ? <p className="text-[13px]" style={{ color: 'var(--cf-ink-3)' }}>Nadie ha respondido todavía.</p>
            : (
              <ul className="space-y-2">
                {d.respuestas.map((r, i) => (
                  <li key={i} className="text-[13px]" style={{ borderTop: i ? '1px solid var(--cf-border)' : 'none', paddingTop: i ? 8 : 0 }}>
                    <span className="font-semibold" style={{ color: 'var(--cf-ink)' }}>{r.negocio}</span>
                    <span className="text-[11px] ml-2" style={{ color: 'var(--cf-ink-3)' }}>{PASO[r.paso] ?? r.paso} · {fecha(r.cuando)}</span>
                    <span className="block" style={{ color: 'var(--cf-ink-2)' }}>«{r.respuesta}»</span>
                  </li>
                ))}
              </ul>
            )}
        </Seccion>
      </>)}
    </div>
  )
}
