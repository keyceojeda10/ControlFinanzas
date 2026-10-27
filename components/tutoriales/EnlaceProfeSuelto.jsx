'use client'
// components/tutoriales/EnlaceProfeSuelto.jsx — un video del profe donde no hay armazón.
//
// La pastilla, el minuto y el enlace (`PiezasProfe`) viven dentro de
// `ProfeProvider`, que está en el layout del dashboard. «Tu suscripción venció»
// queda FUERA: con el plan vencido no se entra al armazón. Y es justo ahí donde
// el dueño necesita «Cómo pagar tu plan»; el catálogo lo pide junto a «Renovar
// mi plan» (27 oct 2026). Esto es ese enlace con su propio reproductor, sin el
// resto del profe (ni novedad, ni hoja de ayuda).
//
// Las mismas reglas que el enlace de adentro: solo lo terminado, solo para
// quien es el video, y nada si la persona ocultó los tutoriales en este
// teléfono (lo guardado por `ProfeProvider`).
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import ReproductorProfe from './ReproductorProfe'
import { videosPara, profeHabilitado, desdeDe, duracionDe, reloj } from '@/lib/tutoriales/profe'

const enviar = (cuerpo) => fetch('/api/tutoriales', {
  method: 'POST',
  keepalive: true,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(cuerpo),
}).catch(() => {})

export default function EnlaceProfeSuelto({ id, junto, pregunta, origen }) {
  const { data: session } = useSession()
  const [abierto, setAbierto] = useState(false)
  // Hasta leer lo guardado no se pinta: si no, el enlace sale y se va bajo el dedo.
  const [guardado, setGuardado] = useState(null)
  const usuario = session?.user?.id ?? ''
  const rol = session?.user?.rol ?? ''

  useEffect(() => {
    if (!usuario) return
    try { setGuardado(JSON.parse(localStorage.getItem(`cf:profe:${usuario}`) || '{}') ?? {}) } catch { setGuardado({}) }
  }, [usuario])

  if (!guardado || !rol || rol === 'superadmin') return null
  if (!profeHabilitado(session?.user?.organizationId) || guardado.botonVisible === false) return null
  const video = videosPara({ rol, paraCobradores: guardado.paraCobradores !== false }).find((v) => v.id === id)
  if (!video || !(video.para ?? []).includes(rol === 'cobrador' ? 'cobrador' : 'dueno')) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label={`${pregunta} Ver el video: ${video.titulo}`}
        className="h-11 rounded-[12px] font-semibold text-[13px] flex items-center justify-center gap-2"
        style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--cf-gold-dark)' }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 001.5.86l12.5-7.5a1 1 0 000-1.72L8.5 3.64A1 1 0 007 4.5z" /></svg>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pregunta} · {reloj(duracionDe(video, junto))}</span>
      </button>
      {abierto && (
        <ReproductorProfe
          video={video}
          desde={desdeDe(video, junto)}
          onCerrar={() => setAbierto(false)}
          onApuntar={(tipo, extra) => enviar({ tipo, id: video.id, origen, via: 'enlace', ...extra })}
          onVisto={() => enviar({ tipo: 'visto', id: video.id })}
          onTarea={() => {}}
        />
      )}
    </>
  )
}
