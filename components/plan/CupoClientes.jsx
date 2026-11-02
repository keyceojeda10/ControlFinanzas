'use client'
/* ── EL CUPO DE CLIENTES: LA LÍNEA GRIS Y «DESBLOQUEA EL PLAN…» (1 nov 2026) ──
 *
 * Las reglas y el porqué están en lib/cupo-clientes.js. Aquí solo se pinta:
 *   · la línea «92 de 100 clientes de tu plan · Ver planes», gris, con una
 *     barra delgada; nada de franjas de color.
 *   · la hoja, dos veces en total (85 % y 95 %), con lo que gana al subir y la
 *     diferencia de precio dicha como «todo por solo $X más al mes».
 * Solo para el dueño: el cobrador no decide el plan (plan_lo_maneja_el_dueno).
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import HojaInferior from '@/components/cf/HojaInferior'
import { BotonPrimario, BotonTexto } from '@/components/cf/primitivos'
import { formatMoney } from '@/lib/i18n'
import { pedirCompartido } from '@/lib/pedir-compartido'
import {
  mostrarLineaCupo, umbralPendiente, beneficiosDeSubir, diferenciaMensual, llaveCupo, UMBRALES,
} from '@/lib/cupo-clientes'

const ICONOS = {
  reportes: <><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></>,
  excel:    <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18" /></>,
  papel:    <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>,
  equipo:   <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  rutas:    <><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></>,
  lucas:    <><path d="M8 10h.01M12 10h.01M16 10h.01M21 12a9 9 0 01-13.36 7.88L3 21l1.12-4.64A9 9 0 1121 12z" /></>,
  clientes: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></>,
}

const leerVistos = (orgId, plan) => UMBRALES.filter((u) => {
  try { return !!localStorage.getItem(llaveCupo(orgId, plan, u)) } catch { return false }
})
const apuntar = (orgId, plan, umbrales) => umbrales.forEach((u) => {
  try { localStorage.setItem(llaveCupo(orgId, plan, u), '1') } catch {}
})

export default function CupoClientes() {
  const { rol, session } = useAuth()
  const router = useRouter()
  const [uso, setUso] = useState(null)
  const [hoja, setHoja] = useState(false)
  const yaMire = useRef(false)
  const orgId = session?.user?.organizationId
  const country = session?.user?.country ?? 'co'

  useEffect(() => {
    if (rol !== 'owner' || !orgId) return
    let vivo = true
    pedirCompartido('/api/plan/uso', { ventanaMs: 60_000 })
      .then((u) => { if (vivo && u) setUso(u) })
      .catch(() => {})
    return () => { vivo = false }
  }, [rol, orgId])

  useEffect(() => {
    if (!uso || yaMire.current || !orgId) return
    yaMire.current = true
    const umbral = umbralPendiente(uso, leerVistos(orgId, uso.plan))
    if (umbral == null) return
    const t = setTimeout(() => {
      /* ⚠ Si hay otra ventana abierta (la del Nequi, la novedad del profe), no
         sale y NO se da por vista: sale en la próxima visita. Se marcaba antes
         de saber si salía, y quien entraba con otra ventana no la veía nunca. */
      if (document.querySelector('[role="dialog"]')) return
      // Las de abajo se dan por vistas: nunca dos hojas seguidas.
      apuntar(orgId, uso.plan, UMBRALES.filter((u) => u <= umbral))
      setHoja(true)
    }, 3000) // después de la novedad del profe (1,5 s), para verla si salió
    return () => clearTimeout(t)
  }, [uso, orgId])

  if (rol !== 'owner' || !mostrarLineaCupo(uso)) return null
  const { usado, limite } = uso.clientes
  const quedan = Math.max(0, limite - usado)
  const subir = beneficiosDeSubir(uso.plan)
  const precio = diferenciaMensual(uso.plan, country)
  const verPlanes = () => { setHoja(false); router.push('/configuracion/plan') }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>
            <span className="cf-num" style={{ fontWeight: 600, color: 'var(--cf-ink)' }}>{usado.toLocaleString('es-CO')}</span>
            {' '}de <span className="cf-num">{limite.toLocaleString('es-CO')}</span> clientes de tu plan
          </span>
          <button type="button" onClick={() => setHoja(true)} style={{
            minHeight: 32, border: 0, background: 'none', padding: 0, cursor: 'pointer', font: 'inherit',
            fontSize: 13, fontWeight: 700, color: 'var(--cf-gold-dark)',
          }}>Ver planes</button>
        </div>
        <div aria-hidden style={{ height: 4, borderRadius: 999, background: 'var(--cf-fill-2)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, (usado / limite) * 100)}%`, height: '100%', borderRadius: 999, background: 'var(--cf-ink-4)' }} />
        </div>
      </div>

      {hoja && subir && (
        <HojaInferior
          abierta
          onCerrar={() => setHoja(false)}
          titulo={`Tu negocio está creciendo. Desbloquea el plan ${subir.nombre}`}
          subtitulo={quedan > 0
            ? `Te quedan ${quedan.toLocaleString('es-CO')} ${quedan === 1 ? 'cliente' : 'clientes'} en tu plan.`
            : 'Llegaste al tope de clientes de tu plan.'}
          accion={
            <>
              <BotonPrimario style={{ flex: 2 }} onClick={verPlanes}>Desbloquear el {subir.nombre}</BotonPrimario>
              <BotonTexto style={{ flex: 1 }} onClick={() => setHoja(false)}>Ahora no</BotonTexto>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {subir.lista.map((b) => (
                <li key={b.titulo} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span aria-hidden style={{
                    flex: 'none', width: 36, height: 36, borderRadius: 10, background: 'var(--cf-ink)', color: 'var(--cf-card)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {ICONOS[b.icono] ?? ICONOS.clientes}
                    </svg>
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--cf-ink)' }}>{b.titulo}</span>
                    <span style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--cf-ink-3)' }}>{b.texto}</span>
                  </span>
                </li>
              ))}
            </ul>
            {precio && precio.diferencia > 0 && (
              <div style={{
                background: 'var(--cf-card-alt)', border: '1px solid var(--cf-border-soft)', borderRadius: 16,
                padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cf-ink-3)' }}>Todo esto por solo</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--cf-ink)' }}>
                    <span className="cf-fig" style={{ fontSize: 26 }}>{formatMoney(precio.diferencia)}</span> más al mes
                  </span>
                </span>
                <span style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--cf-ink-3)', textAlign: 'right' }}>
                  Plan {subir.nombre}<br /><span className="cf-num">{formatMoney(precio.precioSiguiente)}</span>/mes
                </span>
              </div>
            )}
          </div>
        </HojaInferior>
      )}
    </>
  )
}
