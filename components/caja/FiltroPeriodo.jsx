'use client'
// components/caja/FiltroPeriodo.jsx
//
// ⚠️ `hoyLocal()` y `restarDias()` usan UTC-5 FIJO — Colombia. Con 12 países en
// producción, un cobrador en México ve «hoy» corrido una hora en la franja de la
// medianoche. NO se toca aquí: las fechas de este proyecto tienen su propio
// convenio (T05:00Z al guardar, aritmética en UTC) y prod corre en UTC mientras
// dev corre en Bogotá, así que los bugs son invisibles en local. Cambiarlo sin
// medir contra datos reales es exactamente lo que ya salió mal antes.
//
// ══ E01 · DE TRES BARRAS A UNA FILA ════════════════════════════════════════
//
// Eran cinco chips permanentes + un `<input type="date">` + las pestañas: unos
// 150px de cromo antes de ver un solo peso.
//
// · FUERA EL INPUT NATIVO. `05/08/2026` con el iconito del navegador es lo
//   único de la app que no se diseñó: cambia de aspecto en cada sistema
//   operativo. Lo reemplaza una pastilla que dice el periodo Y la fecha
//   —«Hoy · mié 5 de agosto»—, que hoy estaban separados diciendo lo mismo.
// · FLECHAS DE DÍA a los lados: mirar la caja de ayer es un toque, no abrir un
//   calendario. La del futuro va apagada porque no hay futuro que mirar.
// · LOS CINCO PERIODOS BAJAN A UNA HOJA que se abre al tocar la pastilla, con
//   «este mes» añadido. Cinco chips permanentes para un control que se usa una
//   vez al día no valen la fila que ocupan.
//
// Sigue notificando al padre con { modo, fecha, desde, hasta } — el contrato no
// cambia, y por eso el resto de la caja no se entera.
//   - modo 'hoy'  -> vista de un día (usa `fecha`).
//   - modo '7d' | '30d' | 'mes' | 'rango' -> acumulado (usa `desde`/`hasta`).

import { useState } from 'react'
import HojaInferior from '@/components/cf/HojaInferior'

const OPCIONES = [
  { key: 'hoy',   label: 'Hoy' },
  { key: 'ayer',  label: 'Ayer' },
  { key: '7d',    label: 'Últimos 7' },
  { key: '30d',   label: 'Últimos 30' },
  { key: 'mes',   label: 'Este mes' },
]

// Fecha local Colombia (UTC-5) en formato YYYY-MM-DD.
function hoyLocal() {
  return new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
function restarDias(fechaStr, n) {
  const d = new Date(`${fechaStr}T12:00:00-05:00`)
  d.setDate(d.getDate() - n)
  return new Date(d.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
function sumarDias(fechaStr, n) {
  return restarDias(fechaStr, -n)
}
/** El día 1 del mes de esa fecha, en el mismo convenio. */
function primeroDelMes(fechaStr) {
  return `${fechaStr.slice(0, 7)}-01`
}

/* «mié 5 de agosto» — el día con su nombre, que es como se dice.
   Se lee a mediodía en hora de Colombia a propósito: con `new Date('2026-08-05')`
   el navegador interpreta medianoche UTC y en Bogotá eso es el día 4. */
function fechaLarga(fechaStr) {
  if (!fechaStr) return ''
  const d = new Date(`${fechaStr}T12:00:00-05:00`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-CO', {
    weekday: 'short', day: 'numeric', month: 'long', timeZone: 'America/Bogota',
  }).replace('.', '')
}
function fechaCorta(fechaStr) {
  if (!fechaStr) return ''
  const d = new Date(`${fechaStr}T12:00:00-05:00`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-CO', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Bogota',
  }).replace(/\./g, '')
}

const ICONO_CALENDARIO = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
)

function Flecha({ hacia, onClick, apagada, etiqueta }) {
  return (
    <button
      type="button"
      onClick={apagada ? undefined : onClick}
      disabled={apagada}
      aria-label={etiqueta}
      title={etiqueta}
      style={{
        width: 38, height: 38, flex: 'none', borderRadius: 12,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
        color: 'var(--cf-ink-2)', cursor: apagada ? 'default' : 'pointer',
        opacity: apagada ? .4 : 1,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d={hacia === 'atras' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
      </svg>
    </button>
  )
}

export default function FiltroPeriodo({ value, onChange }) {
  // value = { modo, fecha, desde, hasta }
  const [hoja, setHoja] = useState(false)
  const [rangoTemp, setRangoTemp] = useState(null)

  const hoy = hoyLocal()
  const modoBase = value?.modo || 'hoy'
  const ayer = restarDias(hoy, 1)
  const fecha = value?.fecha || hoy
  const esAyer = modoBase === 'hoy' && fecha === ayer
  const esHoy = modoBase === 'hoy' && fecha === hoy
  const modo = esAyer ? 'ayer' : modoBase

  const seleccionar = (nuevoModo) => {
    if (nuevoModo === 'hoy') {
      onChange({ modo: 'hoy', fecha: hoy, desde: null, hasta: null })
    } else if (nuevoModo === 'ayer') {
      onChange({ modo: 'hoy', fecha: restarDias(hoy, 1), desde: null, hasta: null })
    } else if (nuevoModo === '7d') {
      onChange({ modo: '7d', fecha: null, desde: restarDias(hoy, 6), hasta: hoy })
    } else if (nuevoModo === '30d') {
      onChange({ modo: '30d', fecha: null, desde: restarDias(hoy, 29), hasta: hoy })
    } else if (nuevoModo === 'mes') {
      // Del día 1 a hoy: «este mes» es lo que va corrido, no el mes natural
      // entero —que incluiría días que aún no han pasado—.
      onChange({ modo: 'mes', fecha: null, desde: primeroDelMes(hoy), hasta: hoy })
    } else {
      onChange({ modo: 'rango', fecha: null, desde: value?.desde || restarDias(hoy, 6), hasta: value?.hasta || hoy })
    }
    setHoja(false)
  }

  /* Lo que dice la pastilla. Con un periodo acumulado no hay «un día» que
     enseñar, así que se dice el rango: «1 ago – 5 ago». */
  const rotulo = (() => {
    if (modo === 'hoy') return 'Hoy'
    if (modo === 'ayer') return 'Ayer'
    return OPCIONES.find((o) => o.key === modo)?.label ?? 'Un rango'
  })()
  const detalle = (() => {
    if (modo === 'hoy' || modo === 'ayer') return fechaLarga(fecha)
    const d = value?.desde, h = value?.hasta
    if (!d || !h) return ''
    return `${fechaCorta(d)} – ${fechaCorta(h)}`
  })()

  /* Las flechas SOLO mueven el día, y por eso solo salen en vista de un día.
     Con «últimos 7» puestos, ¿qué sería «el día anterior»? Correr la ventana
     entera sería otra cosa distinta y nadie la pidió. */
  const flechasVisibles = modo === 'hoy' || modo === 'ayer'
  const irADia = (n) => onChange({ modo: 'hoy', fecha: n, desde: null, hasta: null })

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        {flechasVisibles && (
          <Flecha hacia="atras" etiqueta="Día anterior" onClick={() => irADia(restarDias(fecha, 1))} />
        )}

        <button
          type="button"
          onClick={() => setHoja(true)}
          style={{
            flex: 1, minWidth: 0, height: 38, padding: '0 14px', borderRadius: 12,
            display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
            font: 'inherit', textAlign: 'left',
          }}
        >
          <span style={{ color: 'var(--cf-gold-dark)', display: 'inline-flex', flex: 'none' }}>
            {ICONO_CALENDARIO}
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)', flex: 'none' }}>
            {rotulo}
          </span>
          {detalle && (
            <span style={{
              fontSize: 13, color: 'var(--cf-ink-3)', minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{detalle}</span>
          )}
        </button>

        {flechasVisibles && (
          <Flecha
            hacia="adelante"
            etiqueta="Día siguiente"
            apagada={esHoy}
            onClick={() => irADia(sumarDias(fecha, 1))}
          />
        )}
      </div>

      <HojaInferior
        abierta={hoja}
        onCerrar={() => { setHoja(false); setRangoTemp(null) }}
        titulo="Qué días quieres ver"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 0 6px' }}>
          {OPCIONES.map((o) => {
            const on = modo === o.key
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => seleccionar(o.key)}
                aria-pressed={on}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  height: 52, padding: '0 15px', borderRadius: 14, cursor: 'pointer',
                  background: on ? 'var(--cf-fill)' : 'var(--cf-card)',
                  border: on ? '1.5px solid var(--cf-gold)' : '1px solid var(--cf-border)',
                  font: 'inherit', fontSize: 15, fontWeight: on ? 700 : 600,
                  color: 'var(--cf-ink)', textAlign: 'left',
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>{o.label}</span>
                {on && (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--cf-gold-dark)"
                    strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            )
          })}

          {/* El calendario, para un día suelto o un rango. Aquí SÍ va el input
              nativo: es un selector de fecha completo y escribirlo a mano sería
              mucho código para el camino menos usado. Fuera de la fila, dentro
              de la hoja, deja de afear la cabecera. */}
          <div style={{
            marginTop: 6, padding: '13px 15px', borderRadius: 14,
            background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)' }}>
                Un día o un rango
              </span>
              <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>
                Elígelo en el calendario.
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="date"
                aria-label="Desde"
                value={(rangoTemp?.desde ?? value?.desde) || fecha}
                max={hoy}
                onChange={(e) => setRangoTemp((r) => ({ ...(r ?? {}), desde: e.target.value }))}
                style={{
                  flex: 1, minWidth: 0, height: 44, padding: '0 12px', borderRadius: 12,
                  background: 'var(--cf-fill)', border: '1px solid var(--cf-border)',
                  font: 'inherit', fontSize: 14, color: 'var(--cf-ink)', outline: 'none',
                }}
              />
              <span style={{ fontSize: 12, color: 'var(--cf-ink-3)', flex: 'none' }}>a</span>
              <input
                type="date"
                aria-label="Hasta"
                value={(rangoTemp?.hasta ?? value?.hasta) || fecha}
                max={hoy}
                onChange={(e) => setRangoTemp((r) => ({ ...(r ?? {}), hasta: e.target.value }))}
                style={{
                  flex: 1, minWidth: 0, height: 44, padding: '0 12px', borderRadius: 12,
                  background: 'var(--cf-fill)', border: '1px solid var(--cf-border)',
                  font: 'inherit', fontSize: 14, color: 'var(--cf-ink)', outline: 'none',
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const d = rangoTemp?.desde ?? value?.desde ?? fecha
                const h = rangoTemp?.hasta ?? value?.hasta ?? fecha
                // Un solo día elegido dos veces no es un rango: es ese día.
                if (d === h) onChange({ modo: 'hoy', fecha: d, desde: null, hasta: null })
                // Al revés se ordena solo, en vez de devolver una caja vacía.
                else if (d > h) onChange({ modo: 'rango', fecha: null, desde: h, hasta: d })
                else onChange({ modo: 'rango', fecha: null, desde: d, hasta: h })
                setRangoTemp(null)
                setHoja(false)
              }}
              style={{
                height: 44, borderRadius: 12, border: 0, cursor: 'pointer',
                background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
                font: 'inherit', fontSize: 14, fontWeight: 700,
              }}
            >
              Ver esos días
            </button>
          </div>
        </div>
      </HojaInferior>
    </>
  )
}
