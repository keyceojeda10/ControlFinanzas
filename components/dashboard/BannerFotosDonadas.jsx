'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Modal } from '@/components/ui/Modal'
import { FORMAS, MAX_POR_ENVIO } from '@/lib/fotos-donadas'

/* ══ EL BANNER DE LA CAMPAÑA DE FOTOS ═══════════════════════════════════════
 *
 * ── POR QUÉ UN BANNER Y NO UNA NOVEDAD ──
 * Lo pidió así el dueño y tiene razón: «si lo ponemos como una novedad que se
 * pueda cerrar, la gente quiere ayudar, cierra la novedad y luego no encuentra
 * la opción». Y es literal — `lib/novedades.js` es un modal de localStorage que
 * se enseña UNA vez y no deja ni un rastro donde volver.
 *
 * Además esto no se resuelve en un clic: hay que ir por el cuaderno, tomarle
 * fotos y volver. Eso necesita algo que siga estando cuando la persona vuelva.
 *
 * ── POR QUÉ NO ES OTRA FRANJA ÁMBAR ──
 * El propio panel lo tiene escrito: «cuatro franjas ámbar no son cuatro avisos,
 * son una pared, y cuando todo está en ámbar nada lo está». Esto NO es una
 * alerta —no se pierde un peso por ignorarlo—, así que va en papel con borde y
 * un solo botón. El ámbar se queda para lo que cuesta plata.
 *
 * ── SE CIERRA SOLO ──
 * Cuando llegan las 40 fotos o pasa el lunes, lo que ocurra primero. Un banner
 * que sobra es ruido, y esta pantalla es la que el cobrador abre cada mañana.
 */

const TARJETA = {
  borderRadius: 'var(--cf-r-card)',
  background: 'var(--cf-card)',
  border: '1px solid var(--cf-border)',
}

function Camara({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
    </svg>
  )
}

export default function BannerFotosDonadas() {
  const [estado, setEstado] = useState(null)
  const [abierto, setAbierto] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/fotos-donadas')
      if (r.ok) setEstado(await r.json())
    } catch { /* sin campaña, sin banner: nunca es un error que se enseñe */ }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Ni mientras carga ni cuando cerró. Nada de huecos que salten.
  if (!estado) return null
  if (!estado.viva && !estado.mias) return null

  /* Ya colaboró: el banner deja de pedir y pasa a dar las gracias, con lo que
     mandó. Sigue visible porque puede mandar más, pero ya no insiste. */
  const yaAyudo = estado.mias > 0

  return (
    <>
      <div style={TARJETA} className="px-4 py-3.5 flex items-start gap-3">
        <div
          className="w-9 h-9 flex items-center justify-center shrink-0"
          style={{
            borderRadius: 'var(--cf-r-icon)',
            background: yaAyudo ? 'var(--cf-green-pill-bg)' : 'var(--cf-gold-tint)',
            color: yaAyudo ? 'var(--cf-green-dark)' : 'var(--cf-gold-text)',
          }}
        >
          <Camara className="w-[18px] h-[18px]" />
        </div>

        <div className="flex-1 min-w-0">
          {yaAyudo ? (
            <>
              <p className="text-[14px] font-bold" style={{ color: 'var(--cf-ink)' }}>
                Gracias — nos mandaste {estado.mias} {estado.mias === 1 ? 'foto' : 'fotos'}
              </p>
              <p className="text-[12px] mt-0.5 leading-snug" style={{ color: 'var(--cf-ink-3)' }}>
                Te avisamos apenas el cargue por fotos esté listo, y lo puedes usar de primero.
              </p>
            </>
          ) : (
            <>
              <p className="text-[14px] font-bold leading-snug" style={{ color: 'var(--cf-ink)' }}>
                ¿Nos ayudas a que el sistema aprenda a leer tu cuaderno?
              </p>
              <p className="text-[12px] mt-1 leading-snug" style={{ color: 'var(--cf-ink-3)' }}>
                Estamos enseñándole a leer tarjetas y cuadernos, para que subir tus clientes
                sea tomarles una foto en vez de teclearlos uno por uno. Nos faltan fotos de
                cuadernos de verdad.
              </p>
            </>
          )}

          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="mt-2.5 inline-flex items-center gap-1.5 px-3.5"
            style={{
              height: 38, borderRadius: 'var(--cf-r-control)',
              background: yaAyudo ? 'var(--cf-card)' : 'var(--cf-gold)',
              border: yaAyudo ? '1px solid var(--cf-border-strong)' : '1px solid transparent',
              color: yaAyudo ? 'var(--cf-ink-2)' : 'var(--cf-gold-ink)',
              font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {yaAyudo ? 'Mandar más fotos' : 'Compartir mis fotos'}
          </button>
        </div>
      </div>

      <HojaDonar
        open={abierto}
        onClose={() => setAbierto(false)}
        onListo={cargar}
      />
    </>
  )
}

/* ── LA HOJA DE SUBIDA ──────────────────────────────────────────────────────
 *
 * ⚠ AQUÍ VA EL TEXTO QUE NO SE PUEDE SUAVIZAR. Estas fotos llevan el nombre, la
 * cédula, la dirección y la deuda de los clientes del prestamista: personas que
 * no están en esta conversación. Se le dice ANTES de que elija nada, no en letra
 * chica debajo del botón, y se le da la salida de tapar la cédula — que de
 * verdad no hace falta: el sistema ya trabaja con 1.683 clientes cuya cédula es
 * `SIN-…`.
 */
function HojaDonar({ open, onClose, onListo }) {
  const [fotos, setFotos] = useState([])
  const [forma, setForma] = useState('cartulina')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) { setFotos([]); setResultado(null); setError(null) }
  }, [open])

  /* Las miniaturas se hacen con `createObjectURL` y hay que soltarlas a mano:
     diez fotos de teléfono retenidas en memoria son decenas de megas que el
     navegador no libera solo. */
  useEffect(() => () => fotos.forEach((f) => URL.revokeObjectURL(f.url)), [fotos])

  const elegir = (e) => {
    const nuevas = [...(e.target.files || [])].map((file) => ({ file, url: URL.createObjectURL(file) }))
    setFotos((prev) => [...prev, ...nuevas].slice(0, MAX_POR_ENVIO))
    setError(null)
    // Sin esto, elegir la MISMA foto dos veces no dispara `change`.
    e.target.value = ''
  }

  const quitar = (i) => setFotos((prev) => {
    URL.revokeObjectURL(prev[i].url)
    return prev.filter((_, j) => j !== i)
  })

  const enviar = async () => {
    if (!fotos.length || enviando) return
    setEnviando(true); setError(null)
    try {
      const fd = new FormData()
      fotos.forEach((f) => fd.append('fotos', f.file))
      fd.append('forma', forma)
      const r = await fetch('/api/fotos-donadas', { method: 'POST', body: fd })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error || 'No se pudieron guardar')
      setResultado(data)
      setFotos([])
      onListo?.()
    } catch (e) {
      setError(e.message || 'No se pudieron guardar las fotos')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Ayúdanos a leer los cuadernos">
      {resultado ? (
        <div className="space-y-3">
          <p className="text-[15px] font-bold" style={{ color: 'var(--cf-green-dark)' }}>
            Listo — llegaron {resultado.guardadas} {resultado.guardadas === 1 ? 'foto' : 'fotos'}
          </p>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--cf-ink-2)' }}>
            Gracias de verdad. Con esto podemos medir qué tan bien las lee el sistema
            y arreglarlo donde falle. Te avisamos apenas el cargue por fotos esté listo.
          </p>
          {resultado.rechazadas?.length > 0 && (
            <div className="px-3 py-2.5" style={{ borderRadius: 'var(--cf-r-control)', background: 'var(--cf-red-pill-bg)' }}>
              <p className="text-[12px] font-bold" style={{ color: 'var(--cf-red-dark)' }}>
                {resultado.rechazadas.length} no {resultado.rechazadas.length === 1 ? 'entró' : 'entraron'}:
              </p>
              {resultado.rechazadas.map((r, i) => (
                <p key={i} className="text-[11px] mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>
                  {r.nombre} — {r.razon}
                </p>
              ))}
            </div>
          )}
          <button type="button" onClick={onClose}
            className="w-full h-[46px] text-sm font-bold"
            style={{ borderRadius: 'var(--cf-r-control)', background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', border: 'none', cursor: 'pointer' }}>
            Cerrar
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--cf-ink-2)' }}>
            Mándanos fotos de tus tarjetas o de tu cuaderno — las que tú quieras, no hay mínimo.
            Nos sirven para medir qué tan bien las lee el sistema y arreglarlo donde falle.
          </p>

          {/* ⚠ EL AVISO DE LOS DATOS. Va antes del selector, no después. */}
          <div className="px-3.5 py-3" style={{ borderRadius: 'var(--cf-r-control)', background: 'var(--cf-fill)', border: '1px solid var(--cf-border)' }}>
            <p className="text-[12px] font-bold mb-1" style={{ color: 'var(--cf-ink)' }}>
              Antes de mandarlas, para que lo sepas
            </p>
            <ul className="text-[12px] leading-relaxed space-y-1" style={{ color: 'var(--cf-ink-2)' }}>
              <li>· Las fotos llevan los datos de tus clientes: nombre, cédula, dirección.</li>
              <li>· <strong>Si prefieres, tapa la cédula</strong> con el dedo o un papel. No la necesitamos.</li>
              <li>· Solo las usamos para enseñarle a leer al sistema. No se comparten con nadie.</li>
              <li>· Se borran cuando terminemos de revisarlas, antes del 31 de agosto.</li>
              <li>· Es voluntario y no cambia nada de tu cuenta.</li>
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.06em] mb-1.5" style={{ color: 'var(--cf-ink-3)' }}>
              ¿Cómo llevas tus registros?
            </p>
            <div className="flex gap-2 flex-wrap">
              {FORMAS.map((f) => {
                const activa = forma === f.id
                return (
                  <button key={f.id} type="button" onClick={() => setForma(f.id)}
                    className="px-3 h-[34px] text-[12px] font-bold"
                    style={{
                      borderRadius: 'var(--cf-r-pill)',
                      background: activa ? 'var(--cf-gold-tint)' : 'var(--cf-card)',
                      border: `1px solid ${activa ? 'var(--cf-gold-border)' : 'var(--cf-border)'}`,
                      color: activa ? 'var(--cf-gold-text)' : 'var(--cf-ink-2)',
                      cursor: 'pointer',
                    }}>
                    {f.rotulo}
                  </button>
                )
              })}
            </div>
          </div>

          {fotos.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {fotos.map((f, i) => (
                <div key={i} className="relative" style={{ borderRadius: 'var(--cf-r-control)', overflow: 'hidden', border: '1px solid var(--cf-border)' }}>
                  <img src={f.url} alt="" className="w-full h-[74px] object-cover" />
                  <button type="button" onClick={() => quitar(i)} aria-label="Quitar"
                    className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center"
                    style={{ borderRadius: '999px', background: 'rgba(0,0,0,.55)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* `capture` NO se pone a propósito: forzaría la cámara y la mayoría
              ya tiene las fotos tomadas en el carrete. */}
          <input ref={inputRef} type="file" accept="image/*" multiple onChange={elegir} className="hidden" />
          <button type="button" onClick={() => inputRef.current?.click()}
            className="w-full h-[46px] text-sm font-bold flex items-center justify-center gap-2"
            style={{ borderRadius: 'var(--cf-r-control)', background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)', color: 'var(--cf-ink-2)', cursor: 'pointer' }}>
            <Camara className="w-[18px] h-[18px]" />
            {fotos.length ? `Agregar más (${fotos.length} de ${MAX_POR_ENVIO})` : 'Elegir fotos'}
          </button>

          {error && (
            <p className="text-[12px] font-bold" style={{ color: 'var(--cf-red-dark)' }}>{error}</p>
          )}

          <button type="button" onClick={enviar} disabled={!fotos.length || enviando}
            className="w-full h-[46px] text-sm font-bold"
            style={{
              borderRadius: 'var(--cf-r-control)',
              background: fotos.length ? 'var(--cf-gold)' : 'var(--cf-fill)',
              color: fotos.length ? 'var(--cf-gold-ink)' : 'var(--cf-ink-4)',
              border: 'none', cursor: fotos.length ? 'pointer' : 'default',
              opacity: enviando ? 0.6 : 1,
            }}>
            {enviando ? 'Mandando…' : fotos.length ? `Mandar ${fotos.length} ${fotos.length === 1 ? 'foto' : 'fotos'}` : 'Mandar'}
          </button>
        </div>
      )}
    </Modal>
  )
}
