'use client'
/* ── «PAGA EL AÑO» CUANDO EL PLAN ESTÁ POR VENCER (1 nov 2026) ───────────────
 *
 * Aprobado por el dueño con los mockups: el año a la vista en el momento en
 * que quien paga a mano decide si renueva. Cuándo sale lo dice
 * `debeAbrirseHojaAno` (lib/aviso-pagar-ano.js); una vez por vencimiento, en
 * este aparato.
 *
 * El botón no cobra aquí: lleva a la pantalla del plan con el año ya elegido
 * (`?periodo=anual`), que es la que sabe cobrar por cada pasarela. La cifra sale
 * de `mesYAno`, la misma cuenta del checkout: con precio preferencial o
 * adicionales, aquí dice lo mismo que se cobrará.
 *
 * ⚠ NUNCA ENCIMA DE OTRA VENTANA (la misma regla de AvisoOfertaNequi).
 */

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import HojaInferior, { salirDeHojaHacia } from '@/components/cf/HojaInferior'
import { BotonPrimario, BotonTexto } from '@/components/cf/primitivos'
import { formatMoney } from '@/lib/i18n'
import { pedirCompartido } from '@/lib/pedir-compartido'
import { debeAbrirseHojaAno, llaveHojaAno } from '@/lib/aviso-pagar-ano'
import { mesYAno } from '@/lib/precio-desde-estado'
import EnlaceProfeSuelto from '@/components/tutoriales/EnlaceProfeSuelto'

const fechaLarga = (d) => new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', timeZone: 'America/Bogota' })
const leer = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const apuntar = (k) => { try { localStorage.setItem(k, '1') } catch {} }
/* Sin esto no se supo en 6 días que el botón no llevaba a ninguna parte. */
const marcar = (evento, metadata) => {
  fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ evento, pagina: '/aviso-pagar-ano', metadata }),
  }).catch(() => {})
}

export default function AvisoPagarElAno() {
  const { rol, session } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [d, setD] = useState(null)
  const yaSalio = useRef(false)
  const orgId = session?.user?.organizationId
  const country = session?.user?.country ?? 'co'

  useEffect(() => {
    if (rol !== 'owner' || !orgId || d || yaSalio.current) return
    if (pathname?.startsWith('/configuracion/plan')) return // ahí ya está el año
    let vivo = true
    const listo = () => new Promise((ok) => {
      const despues = () => setTimeout(ok, 3000) // después de la novedad del profe (1,5 s), para verla si salió
      if (document.readyState === 'complete') despues()
      else window.addEventListener('load', despues, { once: true })
    })
    Promise.all([pedirCompartido('/api/pagos/estado', { ventanaMs: 60_000 }), listo()])
      .then(([estado]) => {
        if (!vivo || yaSalio.current || !debeAbrirseHojaAno(estado, { rol })) return
        const llave = llaveHojaAno(orgId, estado.fechaVencimiento)
        if (leer(llave)) return
        const precios = mesYAno(estado, country)
        if (!precios || !(precios.ahorroAno > 0)) return
        if (document.querySelector('[role="dialog"]')) return // otra ventana abierta
        yaSalio.current = true
        apuntar(llave)
        marcar('hoja_ano_vista', { dias: estado.diasRestantes })
        setD({ estado, precios })
      })
      .catch(() => {})
    return () => { vivo = false }
  }, [rol, orgId, country, pathname, d])

  if (!d) return null
  const { estado, precios } = d
  const cerrar = () => setD(null)
  /* ⚠ `salirDeHojaHacia`: cerrar una hoja y empujar no navega (navegar-desde-una-hoja.test.js).
     Entre el 2 y el 8 nov 2026 este botón cerraba la hoja y dejaba a la persona donde estaba. */
  const irA = (periodo) => {
    marcar('hoja_ano_tocada', { periodo })
    setD(null)
    salirDeHojaHacia(router, `/configuracion/plan?periodo=${periodo}`)
  }

  return (
    <HojaInferior
      abierta
      onCerrar={cerrar}
      titulo={`Tu plan vence el ${fechaLarga(estado.fechaVencimiento)}`}
      subtitulo="Renueva y sigues cobrando sin que se corte nada."
      accion={
        <>
          <BotonPrimario style={{ flex: 2 }} onClick={() => irA('anual')}>
            Pagar el año · <span className="cf-num">{formatMoney(precios.ano)}</span>
          </BotonPrimario>
          <BotonTexto style={{ flex: 1 }} onClick={cerrar}>Más tarde</BotonTexto>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button type="button" onClick={() => irA('anual')} style={{
          textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer',
          background: 'var(--cf-card)', border: '2px solid var(--cf-ink)', borderRadius: 16,
          padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>Paga el año</span>
              <span style={{
                height: 22, padding: '0 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center',
                fontSize: 11, fontWeight: 800, background: 'var(--cf-green-pill-bg)', color: 'var(--cf-green-dark)',
                border: '1px solid var(--cf-green-pill-border)',
              }}>2 meses gratis</span>
            </span>
            <span className="cf-fig" style={{ fontSize: 18 }}>{formatMoney(precios.ano)}</span>
          </span>
          <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
            <span style={{ color: 'var(--cf-green-dark)', fontWeight: 700 }}>Te ahorras <span className="cf-num">{formatMoney(precios.ahorroAno)}</span></span>
            <span className="cf-num" style={{ color: 'var(--cf-ink-3)' }}>{formatMoney(precios.anoAlMes)} al mes</span>
          </span>
        </button>

        <button type="button" onClick={() => irA('mensual')} style={{
          textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer',
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)', borderRadius: 16,
          padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Un mes</span>
          <span className="cf-fig" style={{ fontSize: 18 }}>{formatMoney(precios.mes)}</span>
        </button>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <EnlaceProfeSuelto id="inicio-plan" pregunta="¿Cómo se paga?" capitulo="Pagar en Wompi" origen="aviso-pagar-ano" />
        </div>
      </div>
    </HojaInferior>
  )
}
