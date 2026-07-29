'use client'

// components/armazon/AvisoVerificarCorreo.jsx
//
// EL ARMAZÓN NO HACE TRABAJO. El aviso anterior metía un formulario completo
// —campo de 6 dígitos, verificar, reenviar— en una franja fija de ~120px que
// salía en TODAS las pantallas. Tres problemas a la vez:
//
//   1. Le robaba a cada pantalla un séptimo del teléfono, permanentemente.
//   2. Ponía una tarea en el marco, compitiendo con la tarea de la pantalla.
//      "Una pantalla, una respuesta" no admite dos.
//   3. No se podía posponer: no hay forma de decir "ahora no".
//
// Ahora la franja lleva SOLO EL HECHO, en una línea. La tarea vive en una hoja
// que se abre a propósito. Y se puede aplazar por hoy: obligar a verificar
// antes de dejar cobrar es tratar una recomendación como un bloqueo.

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import HojaInferior from '@/components/cf/HojaInferior'
import FranjaAviso from '@/components/armazon/FranjaAviso'
import { BotonPrimario, BotonTexto } from '@/components/cf/primitivos'

const APLAZADO = 'cf:verificar-correo:aplazado'

export default function AvisoVerificarCorreo() {
  const { data: session } = useSession()
  const email = session?.user?.email
  const rol = session?.user?.rol

  const [verificado, setVerificado] = useState(null)
  const [aplazado, setAplazado] = useState(true)   // hasta leer localStorage
  const [abierta, setAbierta] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [reenviado, setReenviado] = useState(false)

  useEffect(() => {
    try {
      const hasta = Number(localStorage.getItem(APLAZADO) || 0)
      setAplazado(Date.now() < hasta)
    } catch { setAplazado(false) }
  }, [])

  useEffect(() => {
    if (!email || rol === 'superadmin') return
    fetch('/api/auth/estado-verificacion')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setVerificado(d?.verificado ?? null))
      .catch(() => {})
  }, [email, rol])

  if (!email || rol === 'superadmin' || verificado !== false) return null

  async function verificar() {
    if (enviando || codigo.length !== 6) return
    setEnviando(true); setError('')
    try {
      const res = await fetch('/api/auth/verificar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || 'Ese código no es'); return }
      setVerificado(true)
      setAbierta(false)
    } catch {
      setError('No se pudo verificar. Intenta de nuevo.')
    } finally { setEnviando(false) }
  }

  async function reenviar() {
    if (reenviado) return
    setReenviado(true)
    try {
      await fetch('/api/auth/reenviar-verificacion', { method: 'POST' })
    } catch { setReenviado(false) }
  }

  function aplazar() {
    try { localStorage.setItem(APLAZADO, String(Date.now() + 24 * 60 * 60 * 1000)) } catch {}
    setAplazado(true)
    setAbierta(false)
  }

  return (
    <>
      {!aplazado && (
        <FranjaAviso
          accion="Verificar"
          onAccion={() => setAbierta(true)}
          icono={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M3 7l9 6 9-6" />
            </svg>
          }
        >
          Falta verificar tu correo
        </FranjaAviso>
      )}

      <HojaInferior
        abierta={abierta}
        onCerrar={() => setAbierta(false)}
        titulo="Verifica tu correo"
        subtitulo={`Te mandamos un código de 6 dígitos a ${email}`}
        accion={
          <>
            <BotonPrimario style={{ flex: 2 }} onClick={verificar}>
              {enviando ? 'Verificando…' : 'Verificar'}
            </BotonPrimario>
            <BotonTexto style={{ flex: 1 }} onClick={aplazar}>Ahora no</BotonTexto>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            value={codigo}
            onChange={(e) => { setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
            onKeyDown={(e) => e.key === 'Enter' && verificar()}
            inputMode="numeric"
            // type="text" y no number: el teclado numerico se pide con
            // inputMode, y number rechaza pegar el codigo desde el correo.
            type="text"
            placeholder="000000"
            autoFocus
            style={{
              height: 62, textAlign: 'center', borderRadius: 'var(--cf-r-control)',
              background: 'var(--cf-card)',
              border: `2px solid ${codigo.length === 6 ? 'var(--cf-gold)' : 'var(--cf-border-strong)'}`,
              outline: 'none',
              fontFamily: 'var(--font-space-grotesk), system-ui',
              fontVariantNumeric: 'tabular-nums lining-nums',
              // 16px es el minimo: por debajo, iOS hace zoom al enfocar.
              fontSize: 28, fontWeight: 600, letterSpacing: '.22em', textIndent: '.22em',
              color: 'var(--cf-ink)',
            }}
          />
          {error && (
            <span style={{ fontSize: 12.5, color: 'var(--cf-red-dark)', textAlign: 'center' }}>{error}</span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>¿No te llegó?</span>
            <BotonTexto onClick={reenviar} style={{ width: 'auto' }}>
              {reenviado ? 'Enviado' : 'Mandar otro'}
            </BotonTexto>
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--cf-ink-3)', textAlign: 'center', lineHeight: 1.45 }}>
            Casi siempre que no llega es porque el correo quedó mal escrito.
          </span>
        </div>
      </HojaInferior>
    </>
  )
}
