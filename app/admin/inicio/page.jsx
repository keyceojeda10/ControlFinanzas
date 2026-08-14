'use client'

/* ══ INICIO — LA CABECERA DEL PANEL ══════════════════════════════════════════
 *
 * Sustituye a Dashboard, Negocio y Métricas: tres pantallas que contestaban lo
 * mismo con cifras distintas. Lo que dijo el dueño el 14 ago 2026:
 *
 *   «Hay un montón de paneles, pero con datos iguales que se duplican y son
 *    igual de irrelevantes. El MRR puede decir 2.500.000, pero a día de hoy no
 *    sé cuántos ya me han pagado.»
 *
 * Por eso lo PRIMERO que se ve no es el MRR, es lo que entró. El MRR es una
 * promesa; el libro de pagos es plata. Van juntos a propósito: la promesa
 * debajo del hecho, para que la distancia entre las dos se vea sola.
 *
 * ⚠ Nada de esta pantalla cuenta a las 210 organizaciones sin arrancar. Eran el
 *   43% del total y engordaban todas las cifras del panel viejo.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatMoney } from '@/lib/i18n'
import { Tarjeta, FilaTarjeta, BloqueOscuro, TiraCifras, Pastilla, EstadoVacio } from '@/components/cf/primitivos'
import { BarrasVerticales, PilaEsqueletos } from '@/components/cf/primitivos2'
import { SEGMENTOS } from '@/lib/admin/segmentos'

const TITULO = { fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)' }
const AYUDA  = { fontSize: 12, color: 'var(--cf-ink-3)' }

function Seccion({ titulo, ayuda, children, accion }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <h2 style={TITULO}>{titulo}</h2>
          {ayuda && <p style={AYUDA}>{ayuda}</p>}
        </div>
        {accion}
      </div>
      {children}
    </section>
  )
}

function Telefono({ numero }) {
  if (!numero) return <span style={{ ...AYUDA, fontStyle: 'italic' }}>sin teléfono</span>
  return (
    <a
      href={`https://wa.me/${String(numero).replace(/\D/g, '')}`}
      target="_blank" rel="noreferrer"
      style={{ fontSize: 12, color: 'var(--cf-gold-text)', textDecoration: 'none', whiteSpace: 'nowrap' }}
    >
      {numero}
    </a>
  )
}

export default function AdminInicio() {
  const [d, setD]       = useState(null)
  const [error, setErr] = useState(null)

  useEffect(() => {
    fetch('/api/admin/inicio')
      .then((r) => r.json())
      .then((j) => (j?.error ? setErr(j.error) : setD(j)))
      .catch(() => setErr('No se pudo cargar'))
  }, [])

  if (error) return <p style={{ fontSize: 13, color: 'var(--cf-red)' }}>{error}</p>
  if (!d) return <PilaEsqueletos cuantos={4} alto={116} />

  const { entro, deberiaEntrar, vivos, aLlamar } = d
  const diferencia = entro.esteMes - entro.mesPasado

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26, maxWidth: 760, margin: '0 auto' }}>

      {/* ── 1 · CUÁNTO ENTRÓ ─────────────────────────────────────────────── */}
      <Seccion
        titulo="Lo que entró este mes"
        ayuda="Pagos registrados, no proyección"
      >
        <BloqueOscuro etiqueta="Cobrado este mes" cifra={formatMoney(entro.esteMes)} tono="ganancia">
          <TiraCifras
            sobreOscuro
            columnas={[
              { etiqueta: 'Mes pasado', valor: formatMoney(entro.mesPasado) },
              {
                etiqueta: diferencia >= 0 ? 'Más que el pasado' : 'Menos que el pasado',
                valor: formatMoney(Math.abs(diferencia)),
              },
              { etiqueta: 'Pagos', valor: String(entro.pagosEsteMes) },
            ]}
          />
        </BloqueOscuro>

        {entro.serie?.length > 0 && (
          <Tarjeta style={{ padding: 16 }}>
            <BarrasVerticales
              alto={104}
              barras={entro.serie.map((m, i) => ({
                valor: m.entro,
                etiqueta: m.rotulo,
                tono: i === entro.serie.length - 1 ? 'oro' : 'inactiva',
              }))}
            />
          </Tarjeta>
        )}

        {/* Honestidad sobre el origen del dato: lo de antes de agosto se rescató
            leyendo el texto de los registros de administración. */}
        {entro.reconstruidos > 0 && (
          <p style={{ ...AYUDA, lineHeight: 1.5 }}>
            {entro.reconstruidos} de esos pagos se reconstruyeron a partir de los registros de
            administración, porque hasta hoy el sistema no guardaba el historial. Los nuevos
            quedan apuntados solos.
          </p>
        )}
      </Seccion>

      {/* ── 2 · CUÁNTO DEBERÍA ENTRAR ────────────────────────────────────── */}
      <Seccion
        titulo="Lo que debería entrar"
        ayuda={`${deberiaEntrar.pagando} suscripciones al día`}
      >
        <Tarjeta>
          <FilaTarjeta primera>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%' }}>
              <span style={{ fontSize: 13, color: 'var(--cf-ink-2)' }}>Al mes, si todos renuevan</span>
              <span className="cf-fig" style={{ fontSize: 16, fontWeight: 700, color: 'var(--cf-ink)' }}>
                {formatMoney(deberiaEntrar.mrr)}
              </span>
            </div>
          </FilaTarjeta>
          <FilaTarjeta>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%' }}>
              <span style={{ fontSize: 13, color: 'var(--cf-ink-2)' }}>Vence en 7 días</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Pastilla tono={deberiaEntrar.vencenPronto > 0 ? 'atraso' : 'neutro'} numerica>
                  {deberiaEntrar.vencenPronto}
                </Pastilla>
                <span className="cf-fig" style={{ fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)' }}>
                  {formatMoney(deberiaEntrar.montoVencePronto)}
                </span>
              </span>
            </div>
          </FilaTarjeta>
        </Tarjeta>

        {deberiaEntrar.proximos?.length > 0 && (
          <Tarjeta>
            {deberiaEntrar.proximos.map((p, i) => (
              <FilaTarjeta key={p.id} primera={i === 0}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', minWidth: 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    {/* El nombre no se recorta: es lo que identifica. */}
                    <Link href={`/admin/organizaciones/${p.id}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--cf-ink)', textDecoration: 'none' }}>
                      {p.nombre}
                    </Link>
                    <Telefono numero={p.ownerTelefono} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flex: 'none' }}>
                    <span className="cf-fig" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cf-ink)' }}>
                      {formatMoney(p.precio)}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--cf-ink-3)' }}>
                      {p.diasRestantes <= 0 ? 'hoy' : p.diasRestantes === 1 ? 'mañana' : `en ${p.diasRestantes} días`}
                    </span>
                  </div>
                </div>
              </FilaTarjeta>
            ))}
          </Tarjeta>
        )}
      </Seccion>

      {/* ── 3 · QUIÉN ESTÁ VIVO ──────────────────────────────────────────── */}
      <Seccion titulo="Quién está usando el sistema" ayuda={`${vivos.totalReal} negocios de verdad, sin contar los que nunca arrancaron`}>
        <Tarjeta style={{ padding: 16 }}>
          <TiraCifras
            columnas={[
              { etiqueta: 'Ahora mismo', valor: String(vivos.activosAhora) },
              { etiqueta: 'Se registraron hoy', valor: String(vivos.registrosHoy) },
              { etiqueta: 'Esta semana', valor: String(vivos.registrosSemana) },
              { etiqueta: 'Este mes', valor: String(vivos.registrosMes) },
            ]}
          />
        </Tarjeta>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--cf-gap-chips)' }}>
          {SEGMENTOS.map((s) => (
            <Link key={s.id} href={`/admin/organizaciones?segmento=${s.id}`} style={{ textDecoration: 'none' }}>
              <Pastilla tono={s.tono} numerica>
                {s.rotulo} · {vivos.porSegmento?.[s.id] ?? 0}
              </Pastilla>
            </Link>
          ))}
        </div>
      </Seccion>

      {/* ── 4 · QUÉ SE ESTÁ CAYENDO ──────────────────────────────────────── */}
      <Seccion
        titulo="A quién llamar"
        ayuda="Pagaron y se fueron, o probaron en serio y se les venció"
      >
        {aLlamar.length === 0 ? (
          <EstadoVacio
            titulo="Nadie por ahora"
            explicacion="Ni bajas de pago ni pruebas vencidas con datos cargados."
          />
        ) : (
          <Tarjeta>
            {aLlamar.map((c, i) => (
              <FilaTarjeta key={c.id} primera={i === 0}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', minWidth: 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    <Link href={`/admin/organizaciones/${c.id}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--cf-ink)', textDecoration: 'none' }}>
                      {c.nombre}
                    </Link>
                    <span style={{ fontSize: 11, color: 'var(--cf-ink-3)' }}>
                      {c.clientes} clientes · {c.prestamos} préstamos · {c.diasSinActividad} días sin entrar
                    </span>
                    <Telefono numero={c.ownerTelefono} />
                  </div>
                  <Pastilla tono={c.segmento === 'churn' ? 'mora' : 'neutro'}>
                    {c.segmento === 'churn' ? 'Pagaba' : 'Probó'}
                  </Pastilla>
                </div>
              </FilaTarjeta>
            ))}
          </Tarjeta>
        )}
      </Seccion>
    </div>
  )
}
