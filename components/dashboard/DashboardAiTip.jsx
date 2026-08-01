'use client'
// components/dashboard/DashboardAiTip.jsx — Tip sutil de IA basado en data del dashboard

import { useState, useEffect } from 'react'

function generarTip(data) {
  if (!data) return null

  const { cobros, prestamos, clientes } = data

  // Mora: se calcula con los campos que la API SI devuelve (clientes.total y
  // clientes.enMora). Antes leia data.mora.porcentajeMora y data.clientes
  // .nuevosEsteMes, que no existen en /api/dashboard/resumen: dos de las cuatro
  // ramas nunca se ejecutaban.
  if (clientes?.total > 0 && clientes?.enMora > 0) {
    const pct = Math.round((clientes.enMora / clientes.total) * 100)
    if (pct > 15) {
      return `${clientes.enMora} de tus ${clientes.total} clientes están en mora (${pct}%). Priorízalos en la ruta de hoy.`
    }
  }

  // Tip de recaudo vs meta.
  //
  // ⚠ LA META ES `esperadoHoy`, NO `cuotaDiariaTotal`.
  //
  // `cuotaDiariaTotal` es la suma de las cuotas de TODA la cartera sin mirar a
  // quien le toca hoy — la propia pantalla la rotula «es un techo, no lo que
  // toca cobrar hoy». Usarla aqui hacia que el panel dijera 48% y este consejo,
  // tres centimetros mas abajo, dijera 9% sobre el mismo dia. En una cartera
  // semanal el techo es siete veces la meta real.
  const metaHoy = prestamos?.esperadoHoy ?? 0
  if (cobros?.hoy > 0 && metaHoy > 0) {
    const pct = Math.round((cobros.hoy / metaHoy) * 100)
    if (pct >= 100) {
      return `Excelente día: ya alcanzaste el ${pct}% de lo que tocaba cobrar hoy. ${cobros.cantidadHoy} pagos registrados.`
    }
    if (pct < 50 && new Date().getHours() > 14) {
      const falta = metaHoy - cobros.hoy
      return `Llevas ${pct}% de lo que tocaba cobrar hoy${falta > 0 ? ` — faltan $${Math.round(falta).toLocaleString('es-CO')}` : ''}.`
    }
  }

  // Comparacion con ayer. `cobros.ayer` es el dia de ayer COMPLETO, no "ayer a
  // esta hora": el texto decia lo segundo y a las 8am siempre comparaba contra
  // 24 horas enteras.
  if (cobros?.ayer > 0 && cobros?.hoy > cobros.ayer) {
    return `Hoy ya llevas un ${Math.round(((cobros.hoy - cobros.ayer) / cobros.ayer) * 100)}% más de lo que cobraste en todo el día de ayer.`
  }

  return null
}

export default function DashboardAiTip({ data }) {
  const [tip, setTip] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const generated = generarTip(data)
    if (generated) setTip(generated)
  }, [data])

  if (!tip || dismissed) return null

  return (
    <div
      className="rounded-[12px] px-4 py-3 flex items-start gap-3"
      style={{
        background: 'color-mix(in srgb, var(--cf-gold) 5%, transparent)',
        border: '1px solid color-mix(in srgb, var(--cf-gold) 22%, var(--cf-border))',
      }}
    >
      <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--cf-gold)' }}>
        <path d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z" />
      </svg>
      <p className="text-xs flex-1 leading-relaxed" style={{ color: 'var(--cf-ink-2)' }}>
        {tip}
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 w-5 h-5 flex items-center justify-center rounded transition-colors"
        style={{ color: 'var(--cf-ink-3)' }}
        aria-label="Cerrar tip"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
