'use client'

/* La guía para instalar cuando NO se puede de un toque (lib/instalar.js).
 *
 *   'abrir-en-chrome' — Android dentro de Facebook, Instagram o WhatsApp: ahí
 *                       el teléfono no deja instalar. Un botón salta a Chrome.
 *   'ios-dentro'      — iPhone dentro de otra app: abrirla en Safari, con el
 *                       enlace ya copiado para pegarlo.
 *   'ios-safari'      — iPhone en Safari: una flecha que apunta al botón
 *                       Compartir de abajo, y después «Agregar a inicio».
 *   'ios-chrome'      — iPhone en Chrome: igual, pero Compartir va arriba a la
 *                       derecha.
 *
 * ⚠ APPLE NO DEJA INSTALAR DE UN TOQUE. Lo que se gana es no tener que buscar:
 * la flecha está encima de su propia pantalla, señalando el botón de verdad, en
 * vez de una lista de pasos que hay que leer y traducir a la pantalla.
 *
 * Sirve dentro de la app y en la página pública /instalar: no depende de nada
 * del panel. */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { enlaceAChrome, detectar } from '@/lib/instalar'

const NOMBRE_APP = { facebook: 'Facebook', instagram: 'Instagram', whatsapp: 'WhatsApp', tiktok: 'TikTok' }

const Compartir = ({ tam = 26, color = '#0A84FF' }) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M8 8.5H6.5A1.5 1.5 0 005 10v9a1.5 1.5 0 001.5 1.5h11A1.5 1.5 0 0019 19v-9a1.5 1.5 0 00-1.5-1.5H16M12 14V3.5M8.5 7L12 3.5 15.5 7" />
  </svg>
)
const AgregarInicio = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
    <rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8.5v7M8.5 12h7" />
  </svg>
)

const ESTILO = `
@keyframes cfFlechaAbajo { 0%,100% { transform: translate(-50%, 0) } 50% { transform: translate(-50%, 12px) } }
@keyframes cfFlechaArriba { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-12px) } }
.cf-flecha-abajo { animation: cfFlechaAbajo 1.1s cubic-bezier(.45,0,.55,1) infinite; }
.cf-flecha-arriba { animation: cfFlechaArriba 1.1s cubic-bezier(.45,0,.55,1) infinite; }
@media (prefers-reduced-motion: reduce) { .cf-flecha-abajo, .cf-flecha-arriba { animation: none } }
`

const boton = {
  height: 52, borderRadius: 14, border: 0, cursor: 'pointer', font: 'inherit', fontSize: 16, fontWeight: 700,
  background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  textDecoration: 'none', width: '100%',
}
const secundario = { ...boton, height: 44, background: 'transparent', color: 'var(--cf-ink-2)', fontSize: 15, fontWeight: 600 }

/** La hoja de abajo para los saltos de navegador. */
function Hoja({ titulo, children, onCerrar }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} onClick={onCerrar} style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 480, background: 'var(--cf-surface)', borderRadius: '20px 20px 0 0',
        padding: '22px 20px max(20px, env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--cf-ink)' }}>{titulo}</span>
        {children}
      </div>
    </div>
  )
}

export default function GuiaInstalar({ camino, onCerrar }) {
  const [paso, setPaso] = useState(0)
  const [copiado, setCopiado] = useState(false)
  const det = typeof navigator !== 'undefined' ? detectar(navigator.userAgent) : { dentroDe: null }
  const dentro = NOMBRE_APP[det.dentroDe] ?? 'otra app'

  if (camino === 'abrir-en-chrome') {
    return createPortal(
      <Hoja titulo="Ábrela en Chrome para instalarla" onCerrar={onCerrar}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--cf-ink-2)' }}>
          Estás dentro de {dentro}, y desde ahí el teléfono no deja instalar apps. Toca el botón: se abre en Chrome y ahí la instalas de un toque.
        </p>
        <a href={enlaceAChrome(window.location.href)} style={boton}>Abrir en Chrome</a>
        <button type="button" onClick={onCerrar} style={secundario}>Ahora no</button>
      </Hoja>,
      document.body,
    )
  }

  if (camino === 'ios-dentro') {
    const copiar = async () => {
      try { await navigator.clipboard.writeText(window.location.href); setCopiado(true) } catch { setCopiado(false) }
    }
    return createPortal(
      <Hoja titulo="Ábrela en Safari para instalarla" onCerrar={onCerrar}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--cf-ink-2)' }}>
          Estás dentro de {dentro}, y desde ahí el iPhone no deja instalar apps. Toca los tres puntos (···) de esta pantalla y elige «Abrir en Safari» o «Abrir en el navegador».
        </p>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--cf-ink-3)' }}>
          ¿No aparece? Copia el enlace, abre Safari y pégalo arriba.
        </p>
        <button type="button" onClick={copiar} style={boton}>{copiado ? 'Enlace copiado' : 'Copiar el enlace'}</button>
        <button type="button" onClick={onCerrar} style={secundario}>Ahora no</button>
      </Hoja>,
      document.body,
    )
  }

  // ── iPhone: la flecha encima de su propia pantalla ──
  const arriba = camino === 'ios-chrome'
  const pasos = [
    {
      titulo: 'Toca Compartir',
      texto: arriba
        ? 'Es este botón, arriba a la derecha, junto a la dirección.'
        : 'Es este botón, abajo en el centro. Si no lo ves, toca ··· abajo a la derecha y luego Compartir.',
      icono: <Compartir />,
    },
    { titulo: 'Toca «Agregar a inicio»', texto: 'Baja un poco en la lista que se abre. A veces dice «Agregar a la pantalla de inicio».', icono: <AgregarInicio /> },
    { titulo: 'Toca «Agregar»', texto: 'Arriba a la derecha. La app queda en tu pantalla de inicio, con su icono.', icono: <span style={{ fontSize: 15, fontWeight: 700, color: '#0A84FF' }}>Agregar</span> },
  ]
  const p = pasos[paso]
  const ultimo = paso === pasos.length - 1

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Cómo instalar la app en el iPhone" style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.72)', color: '#fff',
      display: 'flex', flexDirection: 'column', justifyContent: arriba ? 'flex-start' : 'flex-end',
      padding: arriba ? 'max(70px, env(safe-area-inset-top)) 16px 0' : '0 16px 110px',
    }}>
      <style>{ESTILO}</style>
      {/* La flecha: solo en el primer paso, que es el que hay que encontrar. */}
      {paso === 0 && (arriba
        ? <svg className="cf-flecha-arriba" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#F5B824" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ position: 'absolute', top: 'max(6px, env(safe-area-inset-top))', right: 18 }}><path d="M12 20V5M5.5 11.5L12 5l6.5 6.5" /></svg>
        : <svg className="cf-flecha-abajo" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#F5B824" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ position: 'absolute', bottom: 22, left: '50%' }}><path d="M12 4v15M5.5 12.5L12 19l6.5-6.5" /></svg>)}

      <div style={{ background: '#fff', color: '#15161A', borderRadius: 18, padding: '18px 18px 14px', display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 440, width: '100%', alignSelf: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#7A5800' }}>Paso {paso + 1} de {pasos.length}</span>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{ width: 36, height: 36, border: 0, background: 'none', cursor: 'pointer', color: '#4A4E57', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 52, height: 52, borderRadius: 14, background: '#F3F3EF', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: '#15161A' }}>{p.icono}</span>
          <span style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.25 }}>{p.titulo}</span>
        </div>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: '#4A4E57' }}>{p.texto}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {paso > 0 && <button type="button" onClick={() => setPaso(paso - 1)} style={{ ...secundario, flex: 1, color: '#4A4E57' }}>Atrás</button>}
          <button type="button" onClick={() => (ultimo ? onCerrar() : setPaso(paso + 1))} style={{ ...boton, flex: 2 }}>{ultimo ? 'Listo' : 'Ya lo toqué'}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
