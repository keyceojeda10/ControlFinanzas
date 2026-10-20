'use client'

/* BUSCAR A UN CLIENTE DICIENDO SU NOMBRE (14 oct 2026).
 *
 * Lo pidió Héctor Fabio Cano para su cobrador, «responsable, experimentado y muy
 * eficiente», al que le cuesta leer y escribir: «que pueda decir "buscar el
 * crédito de Pepito Pérez" y que inmediatamente aparezca el cliente».
 *
 * Por eso esta pantalla es GRANDE y casi no pide leer: se toca el micrófono, se
 * dice el nombre, deja de escuchar sola al callarse, y si hay un solo cliente
 * abre su ficha y el teléfono DICE lo esencial («Pepito Pérez. Debe 250 mil. Va
 * al día.»). Si hay varios los nombra en voz alta y se toca el que es.
 *
 * ⚠ CÓMO SE OYE. Igual que el micrófono de Lucas (VoiceInput), y por lo mismo:
 * en iPhone el dictado del sistema (SpeechRecognition, que tiene que arrancar
 * DENTRO del toque); en Android y PC se graba y se transcribe en el servidor
 * (/api/voz/transcribir, Groq Whisper), porque el SpeechRecognition de Chrome
 * se queda mudo si alguna vez se negó el permiso.
 *
 * ⚠ LAS CIFRAS QUE SE LEEN son las de la ficha (`/api/clientes/[id]`): aquí no
 * se calcula ningún saldo. Ver lib/busqueda-voz.js. */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Toggle } from '@/components/ui/Toggle'
import { resumenHablado, avisoHablado } from '@/lib/busqueda-voz'

const CLAVE_LEER = 'cf-voz-leer'

const esIOS = () => typeof navigator !== 'undefined' && (/ipad|iphone|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
const reconocedor = () => (typeof window === 'undefined' ? null : (window.SpeechRecognition || window.webkitSpeechRecognition || null))
const puedeGrabar = () => typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof window.MediaRecorder !== 'undefined'

function modoDeVoz() {
  if (esIOS()) return reconocedor() ? 'nativo' : null
  if (puedeGrabar()) return 'grabar'
  return reconocedor() ? 'nativo' : null
}

const marcar = (evento, metadata) => fetch('/api/analytics/track', {
  method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ evento, pagina: typeof window !== 'undefined' ? window.location.pathname : null, metadata }),
}).catch(() => {})

function leerActivado() {
  try { return localStorage.getItem(CLAVE_LEER) !== '0' } catch { return true }
}

/** Habla en español. Corta lo que estuviera diciendo antes. */
function hablar(texto) {
  if (typeof window === 'undefined' || !window.speechSynthesis || !texto || !leerActivado()) return
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(texto)
    u.lang = 'es-CO'
    const voz = window.speechSynthesis.getVoices().find((v) => /^es[-_]/i.test(v.lang))
    if (voz) u.voice = voz
    u.rate = 0.95
    window.speechSynthesis.speak(u)
  } catch {}
}

/* iOS solo deja hablar si la primera frase sale de un toque. Se «despierta»
   con una frase muda en el mismo toque que abre el micrófono. */
function despertarVoz() {
  try {
    if (!window.speechSynthesis) return
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    window.speechSynthesis.speak(u)
  } catch {}
}

const icono = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
const Micro = ({ size = 20 }) => (
  <svg {...icono} width={size} height={size}>
    <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" />
  </svg>
)

/** `variante`: 'icono' (dentro del campo de búsqueda) o 'boton' (la pastilla
 *  grande «Decir el nombre»). `onAbrir(cliente)` lleva a su ficha. */
export default function BuscarPorVoz({ variante = 'icono', onAbrir }) {
  const [modo, setModo] = useState(null)
  const [abierta, setAbierta] = useState(false)
  // escuchando | pensando | resultados | error
  const [fase, setFase] = useState('escuchando')
  const [oido, setOido] = useState('')
  const [resultados, setResultados] = useState([])
  const [mensaje, setMensaje] = useState('')
  const [nivel, setNivel] = useState(0)
  const [leer, setLeer] = useState(true)
  const parar = useRef(() => {})     // corta y olvida lo oído
  const detener = useRef(() => {})   // corta y BUSCA lo oído («Listo»)
  const vivo = useRef(true)

  useEffect(() => {
    setModo(modoDeVoz())
    setLeer(leerActivado())
    vivo.current = true
    return () => { vivo.current = false; parar.current() }
  }, [])

  const cerrar = () => {
    parar.current()
    try { window.speechSynthesis?.cancel() } catch {}
    setAbierta(false)
  }

  const abrirCliente = (c, como) => {
    marcar('busqueda_voz_abrir', { como })
    // Lo que se lee sale de la ficha; mientras llega, ya se va a la ficha.
    fetch(`/api/clientes/${c.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) hablar(resumenHablado({ nombre: c.nombre, prestamos: d.prestamos })) })
      .catch(() => {})
    setAbierta(false)
    onAbrir?.(c)
  }

  const buscar = async (texto) => {
    if (!vivo.current) return
    setOido(texto)
    setFase('pensando')
    try {
      const r = await fetch(`/api/buscar/voz?q=${encodeURIComponent(texto)}`)
      const d = r.ok ? await r.json() : null
      if (!d) throw new Error()
      marcar('busqueda_voz', { resultados: d.resultados.length, unico: d.unico })
      if (!vivo.current) return
      if (d.unico) { abrirCliente(d.resultados[0], 'solo'); return }
      setResultados(d.resultados)
      setFase('resultados')
      hablar(avisoHablado(d.resultados))
    } catch {
      if (!vivo.current) return
      setMensaje('No pude buscar. Revisa la conexión e inténtalo otra vez.')
      setFase('error')
    }
  }

  const sinOir = () => {
    setMensaje('No te escuché. Toca el micrófono y di el nombre.')
    setFase('error')
    hablar('No te escuché. Toca el micrófono y di el nombre.')
  }

  /* ── EL DICTADO DEL SISTEMA (iPhone) ── arranca DENTRO del toque. */
  const escucharNativo = () => {
    const SR = reconocedor()
    const rec = new SR()
    rec.lang = 'es-CO'
    rec.interimResults = true
    rec.continuous = false
    rec.maxAlternatives = 1
    let texto = ''
    let fallo = false
    rec.onresult = (e) => {
      texto = Array.from(e.results).map((x) => x[0].transcript).join(' ').trim()
      setOido(texto)
    }
    rec.onerror = (e) => {
      fallo = true
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setMensaje('El teléfono no deja usar el micrófono. Actívalo en los ajustes del navegador.')
        setFase('error')
      } else if (e.error === 'no-speech') sinOir()
      else { setMensaje('No te entendí bien. Inténtalo otra vez.'); setFase('error') }
    }
    rec.onend = () => {
      if (fallo || !vivo.current) return
      if (texto) buscar(texto); else sinOir()
    }
    parar.current = () => { try { rec.abort() } catch {} }
    detener.current = () => { try { rec.stop() } catch {} }
    rec.start()
  }

  /* ── GRABAR Y TRANSCRIBIR (Android, PC) ── deja de grabar sola cuando la
     persona se calla: 1,3 s de silencio después de haber hablado. */
  const escucharGrabando = async () => {
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setMensaje('El teléfono no deja usar el micrófono. Actívalo en los ajustes del navegador.')
      setFase('error')
      return
    }
    const tipos = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
    const mime = tipos.find((m) => window.MediaRecorder.isTypeSupported?.(m)) || ''
    const mr = new window.MediaRecorder(stream, mime ? { mimeType: mime } : {})
    const trozos = []
    let ac = null, tic = null, cancelado = false
    const soltar = () => {
      clearInterval(tic)
      // `close()` devuelve una promesa: si ya estaba cerrado, rechaza FUERA del try.
      const cerrarAc = ac
      ac = null
      if (cerrarAc && cerrarAc.state !== 'closed') cerrarAc.close().catch(() => {})
      stream.getTracks().forEach((t) => t.stop())
    }
    mr.ondataavailable = (e) => { if (e.data?.size) trozos.push(e.data) }
    mr.onstop = async () => {
      soltar()
      if (cancelado || !vivo.current) return
      const blob = new Blob(trozos, { type: mime || 'audio/webm' })
      if (blob.size < 600) { sinOir(); return }
      setFase('pensando')
      try {
        const fd = new FormData()
        fd.append('audio', blob, `voz.${mime.includes('mp4') ? 'm4a' : 'webm'}`)
        fd.append('para', 'buscar_cliente')
        const r = await fetch('/api/voz/transcribir', { method: 'POST', body: fd })
        // ⚠ Si falla el SERVIDOR no es que no se oyera: decir «No te escuché»
        // culpaba a la persona de algo que era nuestro (19 oct 2026).
        if (!r.ok) throw new Error('transcribir')
        const d = await r.json()
        const texto = String(d?.texto ?? '').trim()
        if (texto) buscar(texto); else sinOir()
      } catch {
        if (!vivo.current) return
        setMensaje('No pude procesar el audio. Toca el micrófono e inténtalo otra vez.')
        setFase('error')
      }
    }
    parar.current = () => { cancelado = true; try { if (mr.state !== 'inactive') mr.stop() } catch {} ; soltar() }
    detener.current = () => { clearInterval(tic); try { if (mr.state !== 'inactive') mr.stop() } catch {} }
    mr.start()

    try {
      ac = new (window.AudioContext || window.webkitAudioContext)()
      const an = ac.createAnalyser()
      an.fftSize = 512
      ac.createMediaStreamSource(stream).connect(an)
      const datos = new Uint8Array(an.fftSize)
      const inicio = Date.now()
      let hablo = false, ultimaVoz = 0
      tic = setInterval(() => {
        an.getByteTimeDomainData(datos)
        let s = 0
        for (const v of datos) { const x = (v - 128) / 128; s += x * x }
        const rms = Math.sqrt(s / datos.length)
        setNivel(Math.min(1, rms * 8))
        const ahora = Date.now()
        if (rms > 0.035) { hablo = true; ultimaVoz = ahora }
        const callado = hablo && ahora - ultimaVoz > 1300
        const nadie = !hablo && ahora - inicio > 7000
        if (callado || nadie || ahora - inicio > 12000) {
          clearInterval(tic)
          try { if (mr.state !== 'inactive') mr.stop() } catch {}
        }
      }, 100)
    } catch {
      // Sin medidor de silencio queda el botón «Listo» y el tope de 12 s.
      tic = setTimeout(() => { try { if (mr.state !== 'inactive') mr.stop() } catch {} }, 12000)
    }
  }

  /* Siempre desde un toque: así el iPhone deja escuchar y hablar. */
  const empezar = () => {
    if (!modo) return
    parar.current()
    despertarVoz()
    try { window.speechSynthesis?.cancel() } catch {}
    setOido('')
    setResultados([])
    setMensaje('')
    setNivel(0)
    setFase('escuchando')
    setAbierta(true)
    marcar('busqueda_voz_abierta', { modo })
    if (modo === 'nativo') escucharNativo(); else escucharGrabando()
  }

  if (!modo) return null

  const boton = variante === 'boton' ? (
    <button type="button" onClick={empezar} style={{
      width: '100%', minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      borderRadius: 16, border: '1px solid var(--cf-border)', background: 'var(--cf-card)', cursor: 'pointer',
      font: 'inherit', fontSize: 16, fontWeight: 700, color: 'var(--cf-green-dark)',
    }}>
      <span style={{
        width: 36, height: 36, borderRadius: 999, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--cf-green-dark)', color: '#fff',
      }}><Micro size={18} /></span>
      Decir el nombre del cliente
    </button>
  ) : (
    <button type="button" onClick={empezar} aria-label="Buscar diciendo el nombre" style={{
      width: 36, height: 36, flex: 'none', borderRadius: 10, border: 0, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'color-mix(in srgb, var(--cf-green-dark) 12%, transparent)', color: 'var(--cf-green-dark)',
    }}><Micro size={18} /></button>
  )

  const escuchando = fase === 'escuchando'
  const titulo = escuchando ? 'Di el nombre del cliente'
    : fase === 'pensando' ? 'Buscando…'
      : fase === 'resultados' ? (resultados.length ? `Encontré ${resultados.length}` : 'No encontré a nadie')
        : 'Otra vez'

  return (
    <>
      {boton}
      {abierta && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Buscar diciendo el nombre" style={{
          position: 'fixed', inset: 0, zIndex: 10005, background: 'var(--cf-surface)', color: 'var(--cf-ink)',
          display: 'flex', flexDirection: 'column',
          padding: 'max(14px, env(safe-area-inset-top)) 20px max(20px, env(safe-area-inset-bottom))',
        }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" onClick={cerrar} style={{
              height: 40, padding: '0 6px', border: 0, background: 'none', cursor: 'pointer', font: 'inherit',
              fontSize: 15, fontWeight: 600, color: 'var(--cf-ink-2)',
            }}>Cerrar</button>
          </div>

          {/* ⚠ El halo del micrófono crece hasta 30px con la voz, y esta caja
              recorta (se desliza): con 8px arriba salía cortado en plano. */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, paddingTop: 34 }}>
            <button type="button" onClick={fase === 'escuchando' ? undefined : empezar}
              aria-label={escuchando ? 'Escuchando' : 'Decirlo otra vez'} style={{
                position: 'relative', width: 120, height: 120, flex: 'none', borderRadius: 999, border: 0,
                cursor: escuchando ? 'default' : 'pointer',
                background: 'var(--cf-green-dark)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: escuchando ? `0 0 0 ${8 + Math.round(nivel * 22)}px color-mix(in srgb, var(--cf-green-dark) 18%, transparent)` : 'none',
                transition: 'box-shadow .1s linear',
              }}>
              <Micro size={48} />
            </button>

            <span style={{
              fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 24, fontWeight: 600,
              letterSpacing: '-.02em', textAlign: 'center',
            }}>{titulo}</span>

            {oido && (
              <span style={{ fontSize: 20, lineHeight: 1.35, textAlign: 'center', color: 'var(--cf-ink-2)' }}>«{oido}»</span>
            )}

            {escuchando && (
              <button type="button" onClick={() => detener.current()} style={{
                minHeight: 48, padding: '0 20px', borderRadius: 14, cursor: 'pointer', font: 'inherit',
                fontSize: 15, fontWeight: 600, background: 'var(--cf-card)', color: 'var(--cf-ink)',
                border: '1px solid var(--cf-border-strong)',
              }}>Listo, ya lo dije</button>
            )}

            {fase === 'error' && (
              <span style={{ fontSize: 16, lineHeight: 1.45, textAlign: 'center', color: 'var(--cf-ink-2)', maxWidth: 360 }}>{mensaje}</span>
            )}

            {fase === 'resultados' && resultados.length > 0 && (
              <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {resultados.map((c) => (
                  <button key={c.id} type="button" onClick={() => abrirCliente(c, 'toque')} style={{
                    width: '100%', minHeight: 64, padding: '12px 16px', textAlign: 'left', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12, font: 'inherit',
                    background: 'var(--cf-card)', border: '1px solid var(--cf-border)', borderRadius: 16,
                  }}>
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 19, fontWeight: 700, color: 'var(--cf-ink)', overflowWrap: 'anywhere' }}>{c.nombre}</span>
                      {(c.direccion || c.cedula) && (
                        <span style={{ fontSize: 14, color: 'var(--cf-ink-3)', overflowWrap: 'anywhere' }}>{c.direccion || c.cedula}</span>
                      )}
                    </span>
                    <svg {...icono} width={20} height={20} style={{ flex: 'none', color: 'var(--cf-chevron)' }}><path d="M9 5l7 7-7 7" /></svg>
                  </button>
                ))}
              </div>
            )}

            {(fase === 'error' || fase === 'resultados') && (
              <button type="button" onClick={empezar} style={{
                minHeight: 52, padding: '0 22px', borderRadius: 14, border: 0, cursor: 'pointer', font: 'inherit',
                display: 'flex', alignItems: 'center', gap: 10, fontSize: 16, fontWeight: 700,
                background: 'var(--cf-green-dark)', color: '#fff',
              }}><Micro size={20} /> Decirlo otra vez</button>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
            <Toggle
              checked={leer}
              onChange={(v) => {
                setLeer(v)
                try { localStorage.setItem(CLAVE_LEER, v ? '1' : '0') } catch {}
                if (!v) try { window.speechSynthesis?.cancel() } catch {}
              }}
              label="Leer en voz alta"
            />
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
