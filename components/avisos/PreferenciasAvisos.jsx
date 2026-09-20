'use client'

// components/avisos/PreferenciasAvisos.jsx — QUÉ AVISOS QUIERO Y DÓNDE.
//
// Antes esto era UN interruptor —«Notificaciones push: Activadas»— escondido en
// Configuración bajo la pestaña «Avisos por WhatsApp», con el título en
// `text-white` sobre una tarjeta blanca (no se leía en tema claro). Lo encontró
// el 14 % de los dueños, y quien se cansaba de los avisos de mora solo podía
// apagarlo TODO (19 sep 2026).
//
// Tres preguntas, en el orden en que importan:
//   1 · ¿Te avisamos a ESTE teléfono?        (el permiso del navegador)
//   2 · ¿A qué hora quieres el resumen?       (un aviso al día, no cuarenta)
//   3 · ¿De qué quieres enterarte?            (por grupos, no por tipo)
//
// Los grupos y sus textos salen de `lib/avisos-preferencias.js`: es la misma
// lista que obedece el servidor. Se guarda solo, al tocar.

import { useEffect, useState } from 'react'
import { Tarjeta } from '@/components/cf/primitivos'
import { Toggle } from '@/components/ui/Toggle'
import { GRUPOS, HORAS_RESUMEN } from '@/lib/avisos-preferencias'
import { estadoPush, activarPush, desactivarPush } from '@/lib/push-cliente'

const rotulo = { fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }

function hora12(h) {
  const sufijo = h >= 12 ? 'p. m.' : 'a. m.'
  const n = h % 12 === 0 ? 12 : h % 12
  return `${n}:00 ${sufijo}`
}

export default function PreferenciasAvisos() {
  const [prefs, setPrefs] = useState(null)
  const [rol, setRol] = useState('owner')
  const [push, setPush] = useState(null)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let vivo = true
    fetch('/api/notificaciones/preferencias', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (vivo) { setPrefs(d.prefs); setRol(d.rol === 'cobrador' ? 'cobrador' : 'owner') } })
      .catch(() => { if (vivo) setError('No se pudieron cargar tus preferencias.') })
    estadoPush().then((e) => { if (vivo) setPush(e) })
    return () => { vivo = false }
  }, [])

  // Se pinta el cambio YA y se guarda detrás; si el servidor falla, vuelve atrás.
  const guardar = (siguiente) => {
    const anterior = prefs
    setPrefs(siguiente)
    setError('')
    fetch('/api/notificaciones/preferencias', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(siguiente),
    }).then((r) => { if (!r.ok) throw new Error() })
      .catch(() => { setPrefs(anterior); setError('No se pudo guardar. Revisa tu conexión.') })
  }

  const alternarPush = async () => {
    setTrabajando(true)
    setPush(push === 'encendido' ? await desactivarPush() : await activarPush())
    setTrabajando(false)
  }

  const grupos = GRUPOS.filter((g) => g.roles.includes(rol))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ── 1 · Este teléfono ── */}
      <Tarjeta>
        <span style={rotulo}>En este teléfono</span>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)' }}>
              Avisarme aunque la app esté cerrada
            </span>
            <span style={{ display: 'block', fontSize: 13, color: 'var(--cf-ink-2)', lineHeight: 1.45, marginTop: 2 }}>
              {push === 'encendido' ? 'Encendido en este teléfono. En otro teléfono se enciende aparte.'
                : push === 'bloqueado' ? 'Tu navegador lo tiene bloqueado. Se habilita en los ajustes del navegador, en los permisos de este sitio.'
                : push === 'sin-soporte' ? 'Este navegador no puede recibir avisos. En iPhone, instala la app en la pantalla de inicio.'
                : 'Apagado: solo los ves al abrir la campana.'}
            </span>
          </span>
          {(push === 'encendido' || push === 'apagado') && (
            <Toggle checked={push === 'encendido'} onChange={alternarPush} disabled={trabajando} />
          )}
        </div>
      </Tarjeta>

      {/* ── 2 · El resumen ── */}
      {rol === 'owner' && prefs && (
        <Tarjeta>
          <span style={rotulo}>El resumen del día</span>
          <span style={{ fontSize: 13, color: 'var(--cf-ink-2)', lineHeight: 1.45 }}>
            Un solo aviso con lo que entró, lo que prestaste, quién se atrasó y quién no ha cerrado caja.
            Los días sin movimiento no se manda.
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {[...HORAS_RESUMEN, null].map((h) => {
              const activo = prefs.resumenHora === h
              return (
                <button key={String(h)} type="button" onClick={() => guardar({ ...prefs, resumenHora: h })} className="cf-num" style={{
                  height: 36, padding: '0 13px', borderRadius: 'var(--cf-r-pill)', cursor: 'pointer',
                  fontSize: 13, fontWeight: activo ? 700 : 600,
                  background: activo ? 'var(--cf-ink)' : 'var(--cf-card)',
                  color: activo ? 'var(--cf-surface)' : 'var(--cf-ink-2)',
                  border: `1px solid ${activo ? 'var(--cf-ink)' : 'var(--cf-border)'}`,
                }}>{h === null ? 'No mandarlo' : hora12(h)}</button>
              )
            })}
          </div>
        </Tarjeta>
      )}

      {/* ── 3 · De qué ── */}
      {prefs && (
        <Tarjeta style={{ gap: 0 }}>
          <span style={{ ...rotulo, marginBottom: 6 }}>De qué quieres enterarte</span>
          {grupos.map((g, i) => (
            <div key={g.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
              padding: '13px 0', borderTop: i === 0 ? 'none' : '1px solid var(--cf-hairline)',
            }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)' }}>{g.titulo[rol]}</span>
                <span style={{ display: 'block', fontSize: 13, color: 'var(--cf-ink-2)', lineHeight: 1.45, marginTop: 2 }}>{g.nota[rol]}</span>
              </span>
              <Toggle
                checked={prefs.grupos[g.id] !== false}
                disabled={!!g.fijo}
                onChange={(v) => guardar({ ...prefs, grupos: { ...prefs.grupos, [g.id]: v } })}
              />
            </div>
          ))}
        </Tarjeta>
      )}

      {error && <span style={{ fontSize: 13, color: 'var(--cf-red-dark)' }}>{error}</span>}
    </div>
  )
}
