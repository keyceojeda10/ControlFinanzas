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
  // ¿iPhone/iPad, y abierto como página en vez de como app instalada? Apple solo
  // entrega notificaciones web a la app puesta en la pantalla de inicio.
  const [ios, setIos] = useState({ es: false, instalada: false })
  const [prueba, setPrueba] = useState(null)   // { probando } | { dispositivos, llegaron, esteRecibe } | { error }

  useEffect(() => {
    let vivo = true
    fetch('/api/notificaciones/preferencias', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (vivo) { setPrefs(d.prefs); setRol(d.rol === 'cobrador' ? 'cobrador' : 'owner') } })
      .catch(() => { if (vivo) setError('No se pudieron cargar tus preferencias.') })
    estadoPush().then((e) => { if (vivo) setPush(e) })
    try {
      const ua = navigator.userAgent || ''
      const es = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
      const instalada = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
      setIos({ es, instalada: !!instalada })
    } catch {}
    return () => { vivo = false }
  }, [])

  /* ── «MÁNDAME UNA DE PRUEBA» ──
     El dueño: «me dice que me llegan… pero realmente no llega nada en el
     teléfono». La pantalla estaba llena de interruptores encendidos en un
     teléfono que no podía recibir nada, y no había forma de comprobarlo. Esto la
     manda de verdad y cuenta qué contestó cada dispositivo. */
  const probar = async () => {
    setPrueba({ probando: true })
    try {
      const reg = await navigator.serviceWorker?.ready
      const sub = await reg?.pushManager?.getSubscription()
      const res = await fetch('/api/push/probar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ esteEndpoint: sub?.endpoint ?? null }),
      })
      const d = await res.json().catch(() => ({}))
      setPrueba(res.ok ? d : { error: d.error || 'No se pudo mandar la prueba.' })
      // Si una suscripción resultó caducada, el servidor la borró: se relee el estado.
      estadoPush().then(setPush)
    } catch { setPrueba({ error: 'No se pudo mandar la prueba. Revisa tu conexión.' }) }
  }

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
      {/* ── 1 · Este teléfono ──
          LO PRIMERO QUE DICE ES SI ESTE TELÉFONO PUEDE RECIBIRLAS. Era una línea
          gris de 13px encima de ocho interruptores encendidos: se leía «todo
          activado» en un teléfono al que no le podía llegar nada. */}
      {push && push !== 'encendido' && (
        <div role="status" style={{
          borderRadius: 'var(--cf-r-card)', padding: '15px 16px', display: 'flex', flexDirection: 'column', gap: 10,
          background: 'var(--cf-card)', border: '1.5px solid var(--cf-red-dark)',
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)', lineHeight: 1.3 }}>
            A este teléfono no le están llegando las notificaciones
          </span>
          <span style={{ fontSize: 14, color: 'var(--cf-ink-2)', lineHeight: 1.5 }}>
            {push === 'sin-soporte' && ios.es && !ios.instalada
              ? 'En iPhone solo llegan a la app instalada, no a una pestaña del navegador. Es una regla de Apple. Se instala así:'
              : push === 'sin-soporte' ? 'Este navegador no puede recibir notificaciones. Ábrela en Chrome o en Safari.'
              : push === 'bloqueado' ? 'Las tienes bloqueadas para este sitio. Se habilitan en los ajustes del navegador, en los permisos de app.control-finanzas.com.'
              : 'Están apagadas aquí: solo las ves al abrir la campana, dentro de la app. Enciéndelas abajo.'}
          </span>
          {push === 'sin-soporte' && ios.es && !ios.instalada && (
            <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 5, fontSize: 14, color: 'var(--cf-ink)', lineHeight: 1.45 }}>
              <li>Abre <strong>app.control-finanzas.com</strong> en <strong>Safari</strong>.</li>
              <li>Toca el botón de <strong>Compartir</strong> y elige <strong>«Añadir a pantalla de inicio»</strong>.</li>
              <li>Abre la app desde ese icono, vuelve aquí y enciende las notificaciones.</li>
            </ol>
          )}
        </div>
      )}

      <Tarjeta>
        <span style={rotulo}>En este teléfono</span>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)' }}>
              Notificaciones en este teléfono
            </span>
            <span style={{ display: 'block', fontSize: 13, color: 'var(--cf-ink-2)', lineHeight: 1.45, marginTop: 2 }}>
              {push === 'encendido' ? 'Encendidas: te llegan aunque la app esté cerrada. En otro teléfono se encienden aparte.'
                : push === 'bloqueado' ? 'Bloqueadas por el navegador.'
                : push === 'sin-soporte' ? 'Aquí no se pueden recibir.'
                : 'Apagadas.'}
            </span>
          </span>
          {(push === 'encendido' || push === 'apagado') && (
            <Toggle checked={push === 'encendido'} onChange={alternarPush} disabled={trabajando} />
          )}
        </div>

        {push === 'encendido' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, paddingTop: 12, borderTop: '1px solid var(--cf-hairline)' }}>
            <button type="button" onClick={probar} disabled={prueba?.probando} style={{
              height: 44, borderRadius: 'var(--cf-r-control)', cursor: 'pointer', font: 'inherit',
              background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
              fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)', opacity: prueba?.probando ? 0.55 : 1,
            }}>{prueba?.probando ? 'Mandando…' : 'Mandarme una de prueba'}</button>
            {prueba?.error && <span style={{ fontSize: 13, color: 'var(--cf-red-dark)' }}>{prueba.error}</span>}
            {prueba?.dispositivos && (
              <span style={{ fontSize: 13, color: 'var(--cf-ink-2)', lineHeight: 1.5 }}>
                {prueba.dispositivos.length === 0
                  ? 'No hay ningún dispositivo suscrito. Apaga y vuelve a encender el interruptor de arriba.'
                  : prueba.esteRecibe
                    ? 'Salió hacia este teléfono. Si en unos segundos no la ves, revisa que las notificaciones de la app no estén silenciadas en los ajustes del teléfono.'
                    : `Salió a ${prueba.llegaron} de ${prueba.dispositivos.length} ${prueba.dispositivos.length === 1 ? 'dispositivo' : 'dispositivos'}, pero NO a este: apaga y vuelve a encender el interruptor de arriba.`}
                {prueba.dispositivos.some((d) => d.caducada) ? ' Se quitó un dispositivo que ya no existía.' : ''}
              </span>
            )}
          </div>
        )}
      </Tarjeta>

      {/* ── 2 · El resumen ── */}
      {rol === 'owner' && prefs && (
        <Tarjeta>
          <span style={rotulo}>El resumen del día</span>
          <span style={{ fontSize: 13, color: 'var(--cf-ink-2)', lineHeight: 1.45 }}>
            A la hora que elijas se abre tu resumen del día: cuánto entró, cuánto fue ganancia, cuánto
            prestaste y cómo quedó tu negocio. Si tienes la app cerrada, te llega como notificación.
            Los días sin movimiento no sale.
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
          <button type="button" onClick={() => window.dispatchEvent(new Event('cf:ver-resumen-del-dia'))} style={{
            height: 44, borderRadius: 'var(--cf-r-control)', cursor: 'pointer', font: 'inherit',
            background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
            fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)',
          }}>Ver el resumen de hoy ahora</button>
        </Tarjeta>
      )}

      {/* ── 3 · De qué ── */}
      {prefs && (
        <Tarjeta style={{ gap: 0 }}>
          <span style={{ ...rotulo, marginBottom: 6 }}>Qué notificaciones quieres</span>
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
