'use client'
/* ── EL 35 % POR DEJAR EL NEQUI GUARDADO, DENTRO DE LA APP (12 oct 2026) ─────
 *
 * La oferta salía SOLO por WhatsApp (`oferta_nequi`, lib/seguimiento/motor.js) y
 * dentro del sistema no se veía en ningún lado. Un cliente le escribió al dueño
 * preguntando si aplicaba y cómo hacía: «si está usando el sistema es más
 * práctico que el sistema lo guíe, con el botón para que enseguida se vaya a
 * registrar el Nequi».
 *
 * Sale al DUEÑO que tiene la oferta esperando (`ofertaNequi` de
 * /api/pagos/estado) y todavía no tiene el cobro automático. El botón abre la
 * hoja de pago con «Se cobra solo» (`?suscribir=1`), donde se guarda el Nequi.
 *
 * Y dice la FECHA en que vence el plan: con 2 o 3 días por delante la app no
 * avisaba nada (el banner de la suscripción solo sale el último día), mientras
 * el WhatsApp decía «le quedan 3 días». Lo que dice el teléfono y lo que dice
 * la app tienen que ser lo mismo.
 *
 * Se cierra con la X y no vuelve en tres días (localStorage, por teléfono).
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { pedirCompartido } from '@/lib/pedir-compartido'
import { debeVerseOfertaNequi } from '@/lib/oferta-nequi-aviso'

const CLAVE = 'cf-oferta-nequi-cerrada'
const DIAS_CERRADO = 3

const leer = () => { try { return Number(localStorage.getItem(CLAVE)) || 0 } catch { return 0 } }
const guardar = (v) => { try { localStorage.setItem(CLAVE, String(v)) } catch {} }

const fechaCorta = (d) => new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', timeZone: 'America/Bogota' })

export default function OfertaNequiBanner() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [estado, setEstado] = useState(null)
  const [cerradoHasta, setCerradoHasta] = useState(0)
  const rol = session?.user?.rol

  useEffect(() => {
    if (rol !== 'owner') return
    let vivo = true
    setCerradoHasta(leer())
    // El mismo pedido que el banner de la suscripción: compartido, no se repite.
    pedirCompartido('/api/pagos/estado', { ventanaMs: 60_000 })
      .then((d) => { if (vivo && d) setEstado(d) })
    return () => { vivo = false }
  }, [rol, pathname])

  if (!debeVerseOfertaNequi(estado, { rol, cerradoHasta })) return null
  if (pathname?.startsWith('/configuracion/plan')) return null // ahí ya se dice, junto al botón

  const pct = estado.ofertaNequi
  const dias = Number(estado.diasRestantes)
  const vencePronto = estado.fechaVencimiento && Number.isFinite(dias) && dias >= 0 && dias <= 5
  const cerrar = () => {
    const hasta = Date.now() + DIAS_CERRADO * 86400000
    guardar(hasta)
    setCerradoHasta(hasta)
  }

  return (
    <div className="border-b" style={{
      background: 'color-mix(in srgb, var(--cf-green-dark) 7%, var(--cf-card))',
      borderColor: 'color-mix(in srgb, var(--cf-green-dark) 22%, var(--cf-border))',
    }}>
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: 'color-mix(in srgb, var(--cf-green-dark) 16%, transparent)', color: 'var(--cf-green-dark)' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6M9.5 8.5h.01M14.5 13.5h.01M20 12a8 8 0 11-16 0 8 8 0 0116 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-[12rem]">
          <p className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--cf-green-dark)' }}>
            {estado.planPagado === false ? 'Tu primer mes' : 'Tu próximo mes'} {pct} % más barato
          </p>
          <p className="text-[12px] mt-0.5 leading-snug" style={{ color: 'var(--cf-ink-2)' }}>
            {vencePronto
              ? `Tu plan vence el ${fechaCorta(estado.fechaVencimiento)}. Si dejas tu Nequi guardado, se renueva solo y ese mes te sale ${pct} % más barato (solo ese mes).`
              : `Deja tu Nequi guardado para el pago automático y tu próximo mes sale ${pct} % más barato (solo ese mes). Lo quitas cuando quieras.`}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          <Link
            href="/configuracion/plan?suscribir=1"
            className="h-9 px-3.5 rounded-[10px] text-[13px] font-semibold inline-flex items-center"
            style={{ background: 'var(--cf-green-dark)', color: '#fff' }}
          >
            Guardar mi Nequi
          </Link>
          <button type="button" onClick={cerrar} aria-label="Cerrar el aviso"
            className="w-9 h-9 rounded-[10px] inline-flex items-center justify-center"
            style={{ color: 'var(--cf-ink-3)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
