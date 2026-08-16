'use client'
/* ══ LA LISTA DE MORATORIO: PROPONE, Y ÉL CONFIRMA ═══════════════════════════
 *
 *   «Aunque tiene intereses Moratorio, no se puede aplicar, y que
 *    automáticamente aplique a los préstamos en mora.»
 *      — Miguel Ángel (Préstamos Rincón), 15 ago 2026.
 *
 * Lo de «no se puede aplicar» era un suelo de gracia que le pisaba su
 * configuración en silencio; ya está. Esto es la otra mitad: verlo todo junto en
 * vez de entrar préstamo por préstamo.
 *
 * ⚠ NO SE COBRA SOLO, Y ES A PROPÓSITO. Él lo pidió automático. Un barrido que
 *   cobra a clientes reales sin que nadie mire multiplica cualquier error por
 *   toda la cartera antes de que se note, y esto le sube la deuda a personas.
 *   Decisión del dueño: la lista propone y él confirma.
 *
 * ⚠ APLICAR VA POR EL ENDPOINT DE SIEMPRE, uno por uno:
 *   `POST /api/prestamos/[id]/pagos` con tipo `recargo`. Es el mismo que usa el
 *   botón de un préstamo suelto, el que ya mueve totales y caja bien. Una
 *   segunda vía de cobro escrita aquí es cómo se acaba teniendo dos cifras
 *   distintas para la misma plata.
 *
 * ⚠ Y SI UNO FALLA, SE DICE CUÁL. Un «se aplicaron 18 de 20» sin nombres deja al
 *   prestamista sin saber a quién volver.
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useCabecera } from '@/components/armazon/Armazon'
import { formatMoney } from '@/lib/i18n'
import { PilaEsqueletos } from '@/components/cf/primitivos2'

const Icono = ({ d, color = 'var(--cf-ink-3)', tam = 16 }) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
    <path d={d} />
  </svg>
)

export default function MoratorioPage() {
  useCabecera({ titulo: 'Interés moratorio', subtitulo: 'A quién le tocaría y cuánto' })

  const router = useRouter()
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [marcados, setMarcados] = useState(() => new Set())
  const [confirmando, setConfirmando] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [progreso, setProgreso] = useState({ hechos: 0, total: 0 })
  const [resultado, setResultado] = useState(null)

  const cargar = useCallback(() => {
    setCargando(true)
    fetch('/api/prestamos/moratorio')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('No se pudo cargar'))))
      .then((d) => {
        setDatos(d)
        // Todos marcados de entrada: lo normal es aplicarlos todos, y quien
        // quiera dejar a alguien fuera lo desmarca.
        setMarcados(new Set((d.prestamos ?? []).map((p) => p.id)))
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const lista = datos?.prestamos ?? []
  const seleccionados = lista.filter((p) => marcados.has(p.id))
  const totalMarcado = seleccionados.reduce((a, p) => a + p.monto, 0)

  const alternar = (id) => setMarcados((prev) => {
    const s = new Set(prev)
    if (s.has(id)) s.delete(id); else s.add(id)
    return s
  })

  async function aplicar() {
    setConfirmando(false)
    setAplicando(true)
    setProgreso({ hechos: 0, total: seleccionados.length })
    const fallaron = []
    let hechos = 0

    for (const p of seleccionados) {
      try {
        const res = await fetch(`/api/prestamos/${p.id}/pagos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            monto: p.monto,
            tipo: 'recargo',
            nota: `Interés moratorio · ${p.diasEfectivos} días sobre ${formatMoney(p.montoBase)} en mora`,
          }),
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          fallaron.push({ cliente: p.cliente, motivo: d.error ?? `error ${res.status}` })
        }
      } catch {
        fallaron.push({ cliente: p.cliente, motivo: 'no se pudo conectar' })
      }
      hechos += 1
      setProgreso({ hechos, total: seleccionados.length })
    }

    setAplicando(false)
    setResultado({ aplicados: seleccionados.length - fallaron.length, fallaron })
    cargar()
  }

  if (cargando) return <div className="pb-24"><PilaEsqueletos cuantos={4} alto={72} /></div>

  if (error) {
    return <p className="text-sm py-10 text-center" style={{ color: 'var(--cf-red-dark)' }}>{error}</p>
  }

  // ── Sin tasa configurada ────────────────────────────────────────────────
  if (datos && !datos.configurado) {
    return (
      <div className="pb-24 max-w-2xl mx-auto">
        <div style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)', borderRadius: 'var(--cf-r-card)', padding: '22px 19px' }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--cf-ink)' }}>Todavía no cobras interés moratorio</p>
          <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--cf-ink-2)', marginTop: 6 }}>
            Para que el sistema calcule cuánto le tocaría a cada cliente atrasado, primero pon
            la tasa mensual en la configuración. Mientras esté en cero, no se propone nada.
          </p>
          <button
            type="button"
            onClick={() => router.push('/configuracion')}
            className="mt-4 w-full text-[14px] font-bold"
            style={{ height: 44, borderRadius: 'var(--cf-r-control)', background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', border: 0 }}
          >
            Configurar la tasa
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-24 max-w-2xl lg:max-w-4xl mx-auto space-y-3">
      {/* ── Lo que hay, en una frase ─────────────────────────────────── */}
      <div style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)', borderRadius: 'var(--cf-r-card)', padding: '15px 17px' }}>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--cf-ink-2)' }}>
          {lista.length === 0
            ? `Ningún préstamo pasa de los ${datos.diasGracia} días de gracia. No hay nada que cobrar.`
            : <>Le tocaría a <b style={{ color: 'var(--cf-ink)' }}>{lista.length} de {datos.activos}</b> préstamos activos,
              con tu tasa del {datos.tasa}% mensual y {datos.diasGracia} días de gracia.</>}
        </p>
        {lista.length > 0 && (
          <>
            {/* El total arriba: es lo primero que se quiere saber, y con la lista
                larga el botón del final queda lejos. */}
            <p className="cf-fig" style={{ fontSize: 22, color: 'var(--cf-ink)', marginTop: 10 }}>
              {formatMoney(totalMarcado)}
            </p>
            <p style={{ fontSize: 12, color: 'var(--cf-ink-3)', marginTop: 4 }}>
              Nada se cobra hasta que lo confirmes. Sube la deuda del cliente, no entra a caja.
            </p>
          </>
        )}
      </div>

      {resultado && (
        <div style={{
          borderRadius: 'var(--cf-r-card)', padding: '14px 17px',
          background: resultado.fallaron.length ? 'var(--cf-red-pill-bg)' : 'var(--cf-green-pill-bg)',
          border: `1px solid ${resultado.fallaron.length ? 'color-mix(in srgb, var(--cf-red-dark) 30%, transparent)' : 'color-mix(in srgb, var(--cf-green-dark) 30%, transparent)'}`,
        }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: resultado.fallaron.length ? 'var(--cf-red-dark)' : 'var(--cf-green-dark)' }}>
            Se aplicó a {resultado.aplicados} {resultado.aplicados === 1 ? 'préstamo' : 'préstamos'}.
          </p>
          {/* Con nombres: «18 de 20» sin decir cuáles deja sin saber a quién volver. */}
          {resultado.fallaron.length > 0 && (
            <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--cf-ink-2)', marginTop: 4 }}>
              No se pudo con: {resultado.fallaron.map((f) => `${f.cliente} (${f.motivo})`).join(', ')}.
            </p>
          )}
        </div>
      )}

      {lista.map((p) => {
        const marcado = marcados.has(p.id)
        return (
          <div key={p.id}
            style={{
              background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
              borderRadius: 'var(--cf-r-card)', padding: '13px 15px',
              display: 'flex', alignItems: 'center', gap: 12,
              opacity: marcado ? 1 : 0.5,
            }}
          >
            <button
              type="button"
              onClick={() => alternar(p.id)}
              aria-label={marcado ? `Quitar a ${p.cliente}` : `Incluir a ${p.cliente}`}
              style={{
                width: 22, height: 22, flex: 'none', borderRadius: 6, cursor: 'pointer',
                background: marcado ? 'var(--cf-gold)' : 'transparent',
                border: marcado ? 'none' : '1.5px solid var(--cf-border-strong)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {marcado && <Icono d="M5 13l4 4L19 7" color="var(--cf-gold-ink)" tam={13} />}
            </button>

            <button
              type="button"
              onClick={() => router.push(`/prestamos/${p.id}`)}
              style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit' }}
            >
              {/* El nombre no se recorta: si hay varios Carlos, el apellido es lo
                  que los distingue. */}
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)' }}>{p.cliente}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--cf-ink-3)', marginTop: 2 }}>
                {p.diasMora} {p.diasMora === 1 ? 'día' : 'días'} de atraso
                {p.ruta ? ` · ${p.ruta}` : ''}
                {' · sobre '}{formatMoney(p.montoBase)}
              </span>
            </button>

            <span style={{ textAlign: 'right', flex: 'none' }}>
              <span className="cf-fig" style={{ display: 'block', fontSize: 15, color: 'var(--cf-ink)' }}>
                {formatMoney(p.monto)}
              </span>
              {/* Al chocar con el tope la cifra ya no es «lo que salió» sino «lo
                  máximo que se deja»: sin decirlo, dos casos distintos dan igual. */}
              {p.topado && (
                <span style={{ display: 'block', fontSize: 10, color: 'var(--cf-ink-3)' }}>tope del 50%</span>
              )}
            </span>
          </div>
        )
      })}

      {/* ── Aplicar, al final de la lista ────────────────────────────
          Lo puse primero como barra FIJA abajo y la pastilla de navegación se
          la comía: se veía asomar el borde dorado por detrás. Ya me pasó con el
          botón de guardar al editar cliente, y la lección de entonces fue no
          subir la barra sino quitar la causa.
          Aquí la causa era la barra: esta pantalla no es una tarea —salirse no
          pierde nada—, así que sacarle la pastilla tampoco tocaba. El botón va
          en el flujo, después de lo que hay que revisar, que además es el orden
          en que se hace: primero se mira a quién, luego se aplica. */}
      {lista.length > 0 && (
        <button
          type="button"
          disabled={!seleccionados.length || aplicando}
          onClick={() => setConfirmando(true)}
          style={{
            width: '100%', height: 50, borderRadius: 'var(--cf-r-control)', border: 0,
            marginTop: 6,
            background: seleccionados.length ? 'var(--cf-gold)' : 'var(--cf-fill)',
            color: seleccionados.length ? 'var(--cf-gold-ink)' : 'var(--cf-ink-3)',
            fontSize: 15, fontWeight: 800,
            cursor: seleccionados.length && !aplicando ? 'pointer' : 'default',
          }}
        >
          {aplicando
            ? `Aplicando… ${progreso.hechos} de ${progreso.total}`
            : seleccionados.length
              ? `Aplicar ${formatMoney(totalMarcado)} a ${seleccionados.length} ${seleccionados.length === 1 ? 'préstamo' : 'préstamos'}`
              : 'No has marcado ninguno'}
        </button>
      )}

      {/* ── La confirmación ──────────────────────────────────────────
          Sube la deuda de personas reales: se dice en qué se traduce antes de
          hacerlo, no un «¿estás seguro?». */}
      {confirmando && (
        <div
          onClick={() => setConfirmando(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--cf-card)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 520,
              padding: '20px 19px calc(20px + env(safe-area-inset-bottom))',
            }}
          >
            <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--cf-ink)' }}>
              Vas a cobrar {formatMoney(totalMarcado)} de mora
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--cf-ink-2)', marginTop: 8 }}>
              Se le sube la deuda a {seleccionados.length} {seleccionados.length === 1 ? 'cliente' : 'clientes'}.
              No entra plata a la caja: queda como recargo en cada préstamo y se cobra con las cuotas.
            </p>
            <p style={{ fontSize: 12, color: 'var(--cf-ink-3)', marginTop: 8 }}>
              Para deshacerlo hay que anular el recargo préstamo por préstamo.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button type="button" onClick={() => setConfirmando(false)}
                style={{ flex: 1, height: 46, borderRadius: 'var(--cf-r-control)', background: 'var(--cf-fill)', border: '1px solid var(--cf-border-strong)', fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button type="button" onClick={aplicar}
                style={{ flex: 1, height: 46, borderRadius: 'var(--cf-r-control)', background: 'var(--cf-gold)', border: 0, fontSize: 14, fontWeight: 800, color: 'var(--cf-gold-ink)', cursor: 'pointer' }}>
                Sí, aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
