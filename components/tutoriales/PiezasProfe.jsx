'use client'

/* Las piezas de los videos del profe (Adenda 6 · Tutoriales en video).
 *
 * Un solo icono para todo: el triángulo de play con la duración al lado. «La
 * duración es lo que hace que alguien lo toque.»
 *
 *   PastillaProfe    — UNA por pantalla, en la cabecera (o arriba en la barra
 *                      lateral en escritorio). «▶ 1:20» con un video; «▶ 5»
 *                      con varios, que abre la ayuda de la pantalla.
 *   BotonMinutoProfe — en los MENÚS de opciones (Gestión, Editar la ruta): a la
 *                      derecha de cada fila, con fondo propio para que nadie lo
 *                      toque queriendo hacer la acción.
 *   EnlaceProfe      — en un FORMULARIO, en la cabecera de la sección donde la
 *                      gente se equivoca: la pregunta, «▶ ¿Cuál elijo? · 0:45».
 *   AvisoPrimeraVez  — arriba de la tarea, solo donde equivocarse la primera vez
 *                      cuesta plata. Sin ✕: «Ya sé cómo».
 *
 * Todo lo tocable mide 44px. Ninguno ocupa un sitio que otro necesite: con
 * «Botones de video» apagado desaparecen y la pantalla no cambia de forma.
 *
 * ⚠ El cuadrito del play es CARBÓN con triángulo dorado, el mismo par del botón
 * +: se reconoce como algo que se toca, pero no es dorado relleno — el dorado
 * está reservado a la acción principal (DESIGN.md §1). */

import { useEffect, useState } from 'react'
import { desdeDe, duracionDe, reloj } from '@/lib/tutoriales/profe'
import { useProfe } from './ProfeProvider'

const Triangulo = ({ tam = 11, color = 'var(--cf-gold)' }) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" fill={color} aria-hidden style={{ flex: 'none' }}>
    <path d="M7 4.5v15l13-7.5z" />
  </svg>
)
const Check = ({ tam = 13, color = 'currentColor' }) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none' }}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

/** El cuadrito: carbón con triángulo dorado; visto, check (gris o verde). */
export function IconoPlay({ tam = 28, radio = 8, visto = false, verde = false }) {
  const fondo = visto ? (verde ? 'var(--cf-green)' : 'var(--cf-fill)') : 'var(--cf-ink)'
  return (
    <span aria-hidden style={{
      width: tam, height: tam, borderRadius: radio, flex: 'none', background: fondo,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      border: visto && !verde ? '1px solid var(--cf-border)' : 0,
    }}>
      {visto ? <Check tam={Math.round(tam * 0.46)} color={verde ? '#fff' : 'var(--cf-ink-3)'} /> : <Triangulo tam={Math.round(tam * 0.4)} />}
    </span>
  )
}

const usaBotones = (profe) => Boolean(profe?.activo && profe.botonVisible)

/* ── QUE SE NOTE QUE HAY VIDEOS (Carlos, 19 oct 2026) ──────────────────────
 * «Puede pasar muy desapercibido.» Mientras haya videos sin ver en la
 * pantalla, la pastilla lleva un punto dorado. Y la PRIMERA vez que se entra a
 * una pantalla con videos por ver, la pastilla se mueve un instante y sale una
 * burbuja «2 videos por ver» que se va sola. Una vez por pantalla (en este
 * teléfono): avisar cada vez enseña a no mirar.
 *
 * Sin sonido: el navegador no deja sonar nada sin un toque, y un cobrador con
 * el cliente al lado no quiere que el teléfono suene solo. Sin movimiento para
 * quien pidió «reducir movimiento». */
const AVISADAS = 'cf:profe:avisadas'
function yaAvisada(clave) {
  try { return JSON.parse(localStorage.getItem(AVISADAS) || '[]').includes(clave) } catch { return true }
}
function marcarAvisada(clave) {
  try {
    const lista = JSON.parse(localStorage.getItem(AVISADAS) || '[]').filter((c) => c !== clave)
    localStorage.setItem(AVISADAS, JSON.stringify([...lista, clave].slice(-200)))
  } catch {}
}

const ANIMACION = `
@keyframes cfProfeLlama { 0%,60%,100% { transform: scale(1) } 15% { transform: scale(1.1) } 38% { transform: scale(1.06) } }
@keyframes cfProfeAro { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--cf-gold) 50%, transparent) } 100% { box-shadow: 0 0 0 12px color-mix(in srgb, var(--cf-gold) 0%, transparent) } }
@keyframes cfProfeBurbuja { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: none } }
.cf-profe-llama { animation: cfProfeLlama 1.4s cubic-bezier(.22,1,.36,1) 2, cfProfeAro 1.4s ease-out 3; }
.cf-profe-burbuja { animation: cfProfeBurbuja .35s cubic-bezier(.22,1,.36,1) both; }
@media (prefers-reduced-motion: reduce) { .cf-profe-llama, .cf-profe-burbuja { animation: none } }
`

const Punto = ({ style }) => (
  <span aria-hidden style={{
    position: 'absolute', width: 10, height: 10, borderRadius: 999, background: 'var(--cf-gold)',
    border: '2px solid var(--cf-surface)', ...style,
  }} />
)

/**
 * La pastilla de la pantalla. `lateral`: la versión de la barra de escritorio,
 * con su nombre al lado (allí sobra sitio y no hay cabecera).
 */
export function PastillaProfe({ lateral = false }) {
  const profe = useProfe()
  const [llamando, setLlamando] = useState(false)
  const todos = profe?.ayuda?.todos ?? []
  const activa = usaBotones(profe) && todos.length > 0
  const porVer = activa ? todos.filter((v) => !profe.vistos.has(v.id)).length : 0
  const clave = todos.map((v) => v.id).join(',')
  const cargado = Boolean(profe?.cargado)

  // La primera vez en esta pantalla con videos por ver: se mueve y avisa.
  // Espera a la respuesta del servidor: si no, avisaría de videos ya vistos.
  useEffect(() => {
    if (lateral || !activa || !porVer || !cargado || yaAvisada(clave)) return undefined
    marcarAvisada(clave)
    setLlamando(true)
    const t = setTimeout(() => setLlamando(false), 6000)
    return () => clearTimeout(t)
  }, [lateral, activa, porVer, cargado, clave])

  if (!activa) return null
  const uno = todos.length === 1
  const etiqueta = uno ? reloj(todos[0].duracion) : String(todos.length)
  const todosVistos = porVer === 0
  const titulo = uno ? `Ver el video: ${todos[0].titulo}` : `Ayuda de esta pantalla: ${todos.length} videos`
  const abrir = () => { setLlamando(false); profe.abrirAyuda() }

  if (lateral) {
    return (
      <button type="button" onClick={abrir} aria-label={porVer ? `${titulo}, ${porVer} por ver` : titulo} style={{
        position: 'relative', display: 'flex', alignItems: 'center', gap: 10, width: '100%', height: 44, padding: '0 12px 0 8px',
        borderRadius: 12, border: '1px solid var(--cf-border)', background: 'var(--cf-card)',
        cursor: 'pointer', font: 'inherit', textAlign: 'left',
      }}>
        <IconoPlay visto={todosVistos} />
        {/* Corto: «Ayuda de esta pantalla» se partía en dos renglones en la barra. */}
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: 'var(--cf-ink)', whiteSpace: 'nowrap' }}>
          {uno ? 'Video de ayuda' : 'Videos de ayuda'}
        </span>
        {porVer > 0 && <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--cf-gold)', flex: 'none' }} />}
        <span className="cf-fig" style={{ fontSize: 12, fontWeight: 700, color: 'var(--cf-ink-2)', fontVariantNumeric: 'tabular-nums' }}>
          {etiqueta}
        </span>
      </button>
    )
  }
  return (
    <span style={{ position: 'relative', display: 'inline-flex', flex: 'none' }}>
      <style>{ANIMACION}</style>
      <button type="button" onClick={abrir} aria-label={porVer ? `${titulo}, ${porVer} por ver` : titulo} title={titulo}
        className={llamando ? 'cf-profe-llama' : undefined} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 14px 0 8px', flex: 'none',
          borderRadius: 12, background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          cursor: 'pointer', font: 'inherit',
        }}>
        <IconoPlay visto={todosVistos} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cf-ink)', fontVariantNumeric: 'tabular-nums' }}>{etiqueta}</span>
      </button>
      {porVer > 0 && <Punto style={{ top: -3, right: -3 }} />}
      {llamando && (
        <button type="button" onClick={abrir} className="cf-profe-burbuja" style={{
          position: 'absolute', top: 'calc(100% + 10px)', right: 0, zIndex: 1,
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '9px 13px',
          borderRadius: 12, border: 0, cursor: 'pointer', font: 'inherit', textAlign: 'left', whiteSpace: 'nowrap',
          background: '#15161A', color: '#F3F3F6', boxShadow: 'var(--cf-sh-float)',
        }}>
          <span aria-hidden style={{ position: 'absolute', top: -5, right: 18, width: 10, height: 10, background: '#15161A', transform: 'rotate(45deg)', borderRadius: 2 }} />
          <span style={{ fontSize: 14, fontWeight: 700 }}>{porVer} {porVer === 1 ? 'video por ver' : 'videos por ver'}</span>
          <span style={{ fontSize: 12, color: '#A3A8B2' }}>El profe te explica esta pantalla</span>
        </button>
      )}
    </span>
  )
}

/** El botón de minuto de una fila de menú: «▶ 1:20». Tocar la fila hace la
 *  acción; tocar este, abre el video en la parte de esa opción. */
export function BotonMinutoProfe({ id, junto, oscuro = false, style }) {
  const profe = useProfe()
  if (!usaBotones(profe)) return null
  const video = profe.visibles.find((v) => v.id === id)
  if (!video) return null
  const visto = profe.vistos.has(id)
  return (
    <button
      type="button"
      aria-label={`Ver el video: ${video.titulo}`}
      title={`Ver el video: ${video.titulo}`}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); profe.abrir(id, { desde: desdeDe(video, junto), via: 'minuto' }) }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, height: 44, padding: '0 11px', flex: 'none',
        borderRadius: 12, cursor: 'pointer', font: 'inherit',
        // Sobre el bloque oscuro (el menú del +): claro sobre carbón, 4,5:1 o más.
        ...(oscuro
          ? { background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)', color: '#D5D8DE' }
          : { background: 'var(--cf-fill)', border: '1px solid var(--cf-border-soft, var(--cf-border))', color: 'var(--cf-ink-2)' }),
        ...style,
      }}
    >
      {visto ? <Check tam={11} /> : <Triangulo tam={9} color="currentColor" />}
      <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{reloj(duracionDe(video, junto))}</span>
    </button>
  )
}

/** El enlace de una sección de formulario: la pregunta de quien duda.
 *  Se extiende con margen negativo para medir 44px sin mover la cabecera. */
export function EnlaceProfe({ id, junto, pregunta = '¿Cuál elijo?', style }) {
  const profe = useProfe()
  if (!usaBotones(profe)) return null
  const video = profe.visibles.find((v) => v.id === id)
  if (!video) return null
  return (
    <button
      type="button"
      aria-label={`${pregunta} Ver el video: ${video.titulo}`}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); profe.abrir(id, { desde: desdeDe(video, junto), via: 'enlace' }) }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, height: 44, margin: '-13px -8px -13px 0', padding: '0 8px',
        border: 0, background: 'none', cursor: 'pointer', font: 'inherit', flex: 'none',
        color: 'var(--cf-gold-dark)', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', ...style,
      }}
    >
      <Triangulo tam={12} color="currentColor" />
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pregunta} · {reloj(duracionDe(video, junto))}</span>
    </button>
  )
}

/** La tarjeta de primera vez, arriba de la tarea. `nombre` es una entrada de
 *  `PRIMERA_VEZ` (lib/tutoriales/profe.js). No sale si ya lo hizo alguna vez,
 *  si ya vio el video, si tocó «Ya sé cómo» o si apagó los avisos. */
export function AvisoPrimeraVez({ nombre, style }) {
  const profe = useProfe()
  const aviso = profe?.avisoDe(nombre)
  if (!aviso) return null
  const { video, desde } = aviso
  const dura = reloj(desde ? Math.max(0, video.duracion - desde) : video.duracion)
  return (
    <section aria-label={aviso.titulo} style={{
      borderRadius: 'var(--cf-r-card)', overflow: 'hidden', background: 'var(--cf-card)',
      border: '1px solid var(--cf-border)', boxShadow: 'var(--cf-sh-card)', ...style,
    }}>
      <button type="button" onClick={() => profe.abrir(video.id, { desde, via: 'aviso' })} aria-label={`Ver el video: ${video.titulo}`} style={{
        position: 'relative', display: 'block', width: '100%', height: 168, border: 0, padding: 0, cursor: 'pointer',
        background: '#22232A', overflow: 'hidden',
      }}>
        {video.poster && <img src={video.poster} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55, display: 'block' }} />}
        <span aria-hidden style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
          width: 56, height: 56, borderRadius: 999, background: 'var(--cf-gold)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Triangulo tam={20} color="var(--cf-gold-ink)" /></span>
        <span className="cf-fig" style={{
          position: 'absolute', right: 10, bottom: 10, padding: '2px 8px', borderRadius: 8,
          background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 12, fontWeight: 700,
        }}>{dura}</span>
      </button>
      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--cf-ink)' }}>{aviso.titulo}</span>
        <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--cf-ink-2)' }}>{aviso.porque}</span>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button type="button" onClick={() => profe.abrir(video.id, { desde, via: 'aviso' })} style={{
            flex: 1.4, height: 48, borderRadius: 'var(--cf-r-control)', border: 0, cursor: 'pointer', font: 'inherit',
            fontSize: 14, fontWeight: 700, background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
          }}>Ver en {dura}</button>
          <button type="button" onClick={() => profe.descartarAviso(video.id)} style={{
            flex: 1, height: 48, borderRadius: 'var(--cf-r-control)', cursor: 'pointer', font: 'inherit',
            fontSize: 14, fontWeight: 600, background: 'var(--cf-card)', color: 'var(--cf-ink)', border: '1px solid var(--cf-border-strong)',
          }}>Ya sé cómo</button>
        </div>
      </div>
    </section>
  )
}
