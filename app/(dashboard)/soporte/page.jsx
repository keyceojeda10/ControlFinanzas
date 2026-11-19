'use client'

import { useState, useEffect } from 'react'
import { useCabecera } from '@/components/armazon/Armazon'
import Link from 'next/link'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { leerDeCache, guardarEnCache } from '@/lib/offline'
import { useCountry } from '@/hooks/useCountry'
import { fechaCortaDelInstante } from '@/lib/adaptadores/cobros'

const WHATSAPP_SOPORTE = '573011993001'
const whatsappLink = (mensaje) =>
  `https://wa.me/${WHATSAPP_SOPORTE}?text=${encodeURIComponent(mensaje)}`

const TIPO_LABEL = {
  bug: 'Error',
  pregunta: 'Pregunta',
  solicitud: 'Solicitud',
  problema_pago: 'Pago',
  otro: 'Otro',
}

const ESTADO_BADGE = {
  abierto: { label: 'Abierto' },
  en_progreso: { label: 'En progreso' },
  resuelto: { label: 'Resuelto' },
  cerrado: { label: 'Cerrado' },
}

const ESTADO_COLOR = {
  abierto: 'var(--cf-gold-dark)',
  en_progreso: 'var(--cf-ink-2)',
  resuelto: 'var(--cf-green-dark)',
  cerrado: 'var(--cf-ink-2)',
}

const ICONO_WHATSAPP = (tam) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

/* Una fila al estilo de «Más» y Configuración: icono, nombre, una línea que dice
   qué hay y la flecha. `externo`: WhatsApp, que abre otra app. */
function FilaSoporte({ href, externo = false, icono, fondo = 'var(--cf-fill)', color = 'var(--cf-ink-2)', titulo, linea, extra = null, primera = false }) {
  const contenido = (
    <>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 42, minWidth: 42, height: 42, borderRadius: 12, flex: 'none', background: fondo, color,
      }}>{icono}</span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 17, fontWeight: 500, letterSpacing: '-.01em', color: 'var(--cf-ink)', lineHeight: 1.25, overflowWrap: 'anywhere' }}>{titulo}</span>
        {linea && <span style={{ fontSize: 14, lineHeight: 1.35, color: 'var(--cf-ink-3)' }}>{linea}</span>}
      </span>
      {extra}
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink)"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none' }}>
        <path d="M9 5.5l6.5 6.5L9 18.5" />
      </svg>
    </>
  )
  const estilo = {
    display: 'flex', alignItems: 'center', gap: 14, minHeight: 72, padding: '14px 20px',
    textDecoration: 'none', background: 'var(--cf-card)', borderTop: primera ? 0 : '1px solid var(--cf-border)',
  }
  return externo
    ? <a href={href} target="_blank" rel="noopener noreferrer" style={estilo}>{contenido}</a>
    : <Link href={href} style={estilo}>{contenido}</Link>
}

function Grupo({ titulo, children }) {
  return (
    <>
      <div style={{ padding: '18px 20px 10px', fontSize: 16, color: 'var(--cf-ink-3)' }}>{titulo}</div>
      <div className="cf-soporte-grupo">{children}</div>
    </>
  )
}

export default function SoportePage() {
  useCabecera({ titulo: 'Soporte', subtitulo: 'Crea un ticket o revisa el estado de tus solicitudes' })

  const { country } = useCountry()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/soporte')
      .then(r => r.json())
      .then(data => {
        const lista = Array.isArray(data) ? data : []
        setTickets(lista)
        guardarEnCache('soporte:tickets', lista).catch(() => {})
      })
      .catch(async () => {
        try {
          const cached = await leerDeCache('soporte:tickets')
          if (cached) setTickets(cached)
        } catch {}
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    /* ══ CON EL ESTILO DE «MÁS» (18 nov 2026) ═════════════════════════════════
       Era un botón dorado suelto arriba a la derecha, una tarjeta centrada para
       WhatsApp y otra tarjeta vacía. Ahora son dos grupos de filas: cómo
       pedir ayuda (WhatsApp, que es lo más rápido, y el ticket) y lo que ya
       pediste. El dorado se queda para la plata (DESIGN.md). */
    <div className="cf-soporte max-w-3xl lg:max-w-6xl mx-auto">
      <style>{`
        .cf-soporte { margin: -20px -20px 0; }
        .cf-soporte-grupo { background: var(--cf-card); border-top: 1px solid var(--cf-border); border-bottom: 1px solid var(--cf-border); }
        @media (min-width: 1024px) {
          .cf-soporte { margin: 0 auto; }
          .cf-soporte-grupo { border: 1px solid var(--cf-border); border-radius: 16px; overflow: hidden; }
        }
      `}</style>
      {/* ── LA CABECERA ENTERA SE VA AL ARMAZON ──
          Dibujaba un icono dorado de 40px, «Soporte» a 25px y su subtitulo,
          todo JUSTO DEBAJO de la cabecera que ya dice «Soporte». */}

      <Grupo titulo="¿Cómo te ayudamos?">
        <FilaSoporte primera externo
          href={whatsappLink('Hola, necesito ayuda con Control Finanzas.')}
          icono={ICONO_WHATSAPP(22)} fondo="color-mix(in srgb, #25D366 16%, transparent)" color="#1DA851"
          titulo="Escríbenos por WhatsApp" linea="La respuesta más rápida, directo con nosotros" />
        <FilaSoporte href="/soporte/nuevo"
          icono={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>}
          titulo="Crear un ticket" linea="Cuéntanos qué pasa y lo seguimos aquí" />
      </Grupo>

      <Grupo titulo={tickets.length ? `Tus solicitudes · ${tickets.length}` : 'Tus solicitudes'}>
        {loading ? (
          <div style={{ padding: 16 }} className="space-y-3"><SkeletonCard /><SkeletonCard /></div>
        ) : tickets.length === 0 ? (
          <p style={{ margin: 0, padding: '18px 20px', fontSize: 15, lineHeight: 1.45, color: 'var(--cf-ink-3)' }}>
            Todavía no has abierto ninguna. Cuando lo hagas, aquí ves cómo va y lo que te respondemos.
          </p>
        ) : tickets.map((t, n) => {
          const estado = ESTADO_BADGE[t.estado] || ESTADO_BADGE.abierto
          const eColor = ESTADO_COLOR[t.estado] || ESTADO_COLOR.abierto
          const mensajesNuevos = t._count?.mensajes || 0
          return (
            <FilaSoporte key={t.id} primera={n === 0} href={`/soporte/${t.id}`}
              fondo={`color-mix(in srgb, ${eColor} 14%, transparent)`} color={eColor}
              icono={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>}
              titulo={t.asunto}
              linea={<>
                <span style={{ color: eColor, fontWeight: 600 }}>{estado.label}</span>
                {' · '}{TIPO_LABEL[t.tipo] || t.tipo}
                {' · '}{fechaCortaDelInstante(t.createdAt, country)}
              </>}
              extra={mensajesNuevos > 0 ? (
                <span className="cf-num" aria-label={`${mensajesNuevos} mensajes`} style={{
                  minWidth: 22, height: 22, padding: '0 6px', borderRadius: 999, flex: 'none',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--cf-ink)', color: 'var(--cf-card)', fontSize: 12, fontWeight: 700,
                }}>{mensajesNuevos}</span>
              ) : null}
            />
          )
        })}
      </Grupo>
    </div>
  )
}
