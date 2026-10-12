'use client'
// app/admin/cargas/page.jsx — las cargas de cartera con asesor (bloque 4).
// Abiertas primero y de la más vieja a la más nueva: se le prometió al cliente
// en máximo 24 h. Se llega desde Inicio (el menú tiene nueve entradas a propósito).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatMoney } from '@/lib/i18n'
import { SkeletonTable } from '@/components/ui/Skeleton'

const ESTADO = {
  esperando: { texto: 'Esperando archivos', color: 'var(--cf-ink-3)' },
  recibida: { texto: 'Recibida', color: 'var(--cf-ink-2)' },
  leyendo: { texto: 'Leyendo', color: 'var(--cf-ink-2)' },
  en_revision: { texto: 'Por revisar', color: 'var(--cf-gold-dark)' },
  importando: { texto: 'Importando', color: 'var(--cf-gold-dark)' },
  aprobada: { texto: 'Cargada', color: 'var(--cf-green-dark)' },
  rechazada: { texto: 'Rechazada', color: 'var(--cf-red-dark)' },
}
const ABIERTA = ['recibida', 'leyendo', 'en_revision', 'importando']

function hace(d, ahora) {
  const h = Math.floor((ahora - new Date(d)) / 3600000)
  if (h < 1) return 'hace minutos'
  if (h < 48) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} días`
}

export default function CargasAdmin() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    fetch('/api/admin/cargas').then((r) => (r.ok ? r.json() : Promise.reject(new Error('No se pudo cargar'))))
      // La hora se toma al llegar, no al pintar (el render tiene que ser puro).
      .then((j) => setDatos({ ...j, ahora: Date.now() })).catch((e) => setError(e.message))
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)', margin: 0 }}>Cargas de cartera con asesor</h1>
        <Link href="/admin/inicio" style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>Volver a Inicio</Link>
      </div>
      {error && <p role="alert" style={{ color: 'var(--cf-red-dark)', fontSize: 13 }}>{error}</p>}
      {!datos && !error && <SkeletonTable />}
      {datos && datos.cargas.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>No hay cargas en los últimos 30 días.</p>
      )}
      {datos && datos.cargas.length > 0 && (
        <div style={{ overflowX: 'auto', background: 'var(--cf-card)', border: '1px solid var(--cf-border)', borderRadius: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--cf-ink-3)' }}>
                {['Negocio', 'Estado', 'Llegó', 'Archivos', 'Filas', 'A crear', 'Prestado', 'Dudosas'].map((t) => (
                  <th key={t} style={{ padding: '10px 12px', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datos.cargas.map((c) => {
                const e = ESTADO[c.estado] ?? { texto: c.estado, color: 'var(--cf-ink-2)' }
                const tarde = ABIERTA.includes(c.estado) && datos.ahora - new Date(c.creada) > 20 * 3600000
                return (
                  <tr key={c.id} style={{ borderTop: '1px solid var(--cf-border)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <Link href={`/admin/cargas/${c.id}`} style={{ color: 'var(--cf-ink)', fontWeight: 600 }}>{c.negocio?.nombre}</Link>
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--cf-ink-3)' }}>{c.negocio?.plan} · {c.origen}</span>
                    </td>
                    <td style={{ padding: '10px 12px', color: e.color, fontWeight: 600, whiteSpace: 'nowrap' }}>{e.texto}{c.errorLectura ? ' · con error' : ''}</td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: tarde ? 'var(--cf-red-dark)' : 'var(--cf-ink-2)', fontWeight: tarde ? 700 : 400 }}>{hace(c.creada, datos.ahora)}</td>
                    <td className="cf-fig" style={{ padding: '10px 12px' }}>{c.archivos}</td>
                    <td className="cf-fig" style={{ padding: '10px 12px' }}>{c.resumen?.filas ?? '—'}</td>
                    <td className="cf-fig" style={{ padding: '10px 12px' }}>{c.resumen?.importado?.clientesCreados ?? c.resumen?.aCrear ?? '—'}</td>
                    <td className="cf-fig" style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{c.resumen ? formatMoney(c.resumen.prestado) : '—'}</td>
                    <td className="cf-fig" style={{ padding: '10px 12px', color: c.resumen?.dudosas ? 'var(--cf-gold-dark)' : 'var(--cf-ink-3)' }}>{c.resumen?.dudosas ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
