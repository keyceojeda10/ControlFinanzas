'use client'
/* ══ LA PANTALLA DE UN INFORME ═══════════════════════════════════════════════
 *
 * Pedido por el dueño el 16 ago 2026, rebatiendo la primera versión:
 *
 *   «Que cada reporte tenga su página específica, y en esa página puede haber
 *    filtros específicos. La gente selecciona su filtro, crea el reporte como
 *    quiere, lo descarga, lo puede descargar tanto en PDF como Excel. Que la
 *    gente sepa qué es lo que va a descargar, sepa dónde va a buscar su
 *    reporte, sepa qué es el reporte.»
 *
 * ── ES UNA PANTALLA PARA LOS DOCE ───────────────────────────────────────────
 *
 * No doce archivos: uno, que se pinta leyendo `lib/reportes/catalogo.js`. Doce
 * pantallas parecidas son doce sitios donde el filtro de periodo acaba
 * funcionando distinto, y esta app ya tiene esa cicatriz en tres funciones de
 * fecha y en dos de ganancia.
 *
 * ⚠ LO QUE SE BAJA ES LO QUE SE VE. La tabla de aquí y la del PDF y la del
 *   Excel salen de la MISMA `vistaDe()` sobre la MISMA respuesta del API. No es
 *   que se parezcan: es el mismo dato en otro papel. Si mañana alguien calcula
 *   un total aquí para «ahorrarse» una llamada, vuelven las dos cifras.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useCabecera } from '@/components/armazon/Armazon'
import { formatMoney } from '@/lib/i18n'
import { nivelReportes } from '@/lib/planes'
import { buscarInforme, informeBloqueado, PERIODOS } from '@/lib/reportes/catalogo'
import { vistaDe } from '@/lib/reportes/vistas'
import { Tarjeta, FilaTarjeta, TiraCifras, Chip, BotonPrimario, BotonSecundario, EstadoVacio } from '@/components/cf/primitivos'
import { Tabla, PilaEsqueletos } from '@/components/cf/primitivos2'

/* El día de Colombia, no el del navegador: un cobrador en otro huso vería otro
   «hoy» que el servidor. Mismo criterio que el resto de la app. */
const hoyBogota = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10)

/** De un periodo del catálogo a los parámetros que pide SU api. */
function parametrosDe(informe, periodo, extra = {}) {
  const p = new URLSearchParams()
  const acepta = (k) => (informe.params ?? []).includes(k)

  if (acepta('periodo')) p.set('periodo', periodo)
  if (acepta('fecha')) p.set('fecha', extra.fecha || hoyBogota())
  if (acepta('mes') || acepta('anio')) {
    const base = extra.fecha ? new Date(`${extra.fecha}T12:00:00-05:00`) : new Date(Date.now() - 5 * 3600000)
    if (acepta('mes')) p.set('month', String(base.getMonth() + 1))
    if (acepta('anio')) p.set('year', String(base.getFullYear()))
  }
  if (acepta('desde') || acepta('hasta')) {
    const { desde, hasta } = rangoDe(periodo, extra)
    if (acepta('desde')) p.set('desde', desde)
    if (acepta('hasta')) p.set('hasta', hasta)
  }
  if (acepta('rutas') && extra.rutas?.length) p.set('rutas', extra.rutas.join(','))
  return p
}

/* El rango del periodo, en días de Colombia. Se calcula aquí y se manda como
   `desde`/`hasta` para los APIs que no entienden `periodo`, de modo que los dos
   grupos midan el mismo trozo de calendario. */
function rangoDe(periodo, extra = {}) {
  if (extra.desde && extra.hasta) return { desde: extra.desde, hasta: extra.hasta }
  const hoy = new Date(Date.now() - 5 * 3600000)
  const iso = (d) => d.toISOString().slice(0, 10)
  const inicio = new Date(hoy)
  if (periodo === 'hoy') { /* mismo día */ }
  else if (periodo === 'semana') inicio.setDate(hoy.getDate() - 6)
  else if (periodo === 'mes') inicio.setDate(1)
  else if (periodo === 'trimestre') inicio.setMonth(hoy.getMonth() - 2, 1)
  else if (periodo === 'semestre') inicio.setMonth(hoy.getMonth() - 5, 1)
  else if (periodo === 'anio') inicio.setMonth(0, 1)
  else if (periodo === 'todo') inicio.setFullYear(2000, 0, 1)
  return { desde: iso(inicio), hasta: iso(hoy) }
}

function Cifra({ c, pais }) {
  const color = c.tono === 'bueno' ? 'var(--cf-green-dark)'
    : c.tono === 'malo' ? 'var(--cf-red-dark)' : 'var(--cf-ink)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
        {c.etiqueta}
      </span>
      <span className="cf-fig" style={{ fontSize: 19, letterSpacing: '-.02em', color }}>
        {c.tipo === 'dinero' ? formatMoney(c.valor, pais) : String(c.valor ?? '')}
      </span>
    </div>
  )
}

export default function PantallaDeInforme() {
  const { informe: id } = useParams()
  const router = useRouter()
  const { session, plan, loading: cargandoAuth } = useAuth()
  const informe = useMemo(() => buscarInforme(String(id)), [id])

  useCabecera({ titulo: informe?.titulo ?? 'Informe', subtitulo: informe?.contesta ?? '' })

  const pais = session?.user?.country || 'co'
  const nivel = nivelReportes(plan)
  const bloqueado = informe ? informeBloqueado(informe, nivel) : false

  const [periodo, setPeriodo] = useState(informe?.periodos?.[0] ?? 'mes')
  const [fecha, setFecha] = useState(hoyBogota())
  const [crudo, setCrudo] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [bajando, setBajando] = useState(null)

  const cargar = useCallback(async () => {
    if (!informe?.ver || bloqueado) return
    setCargando(true); setError('')
    try {
      const qs = parametrosDe(informe, periodo, { fecha })
      const res = await fetch(`${informe.ver}${qs.toString() ? `?${qs}` : ''}`)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'No se pudo armar el informe')
      }
      setCrudo(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }, [informe, periodo, fecha, bloqueado])

  useEffect(() => { cargar() }, [cargar])

  const vista = useMemo(() => (crudo ? vistaDe(String(id), crudo) : null), [crudo, id])

  const bajar = async (formato) => {
    if (!informe) return
    setBajando(formato)
    try {
      /* Los que no pasan por el traductor —el listado para imprimir y el
         volcado en bruto— bajan por su propia ruta, que ya existía. */
      const qs = parametrosDe(informe, periodo, { fecha })
      const url = informe.ver
        ? `/api/reportes/descargar?informe=${informe.id}&formato=${formato}&${qs}`
        : `${informe.bajar}${informe.bajar.includes('?') ? '&' : '?'}${qs}`
      const res = await fetch(url)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'No se pudo bajar')
      }
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${informe.id}-${periodo}.${formato === 'excel' ? 'xlsx' : 'pdf'}`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      setError(e.message)
    } finally {
      setBajando(null)
    }
  }

  if (!informe) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <EstadoVacio
          titulo="Ese informe no existe"
          explicacion="Puede que el enlace esté mal escrito o que el informe se llame de otra forma."
          accion={<BotonPrimario onClick={() => router.push('/reportes')}>Ver todos los informes</BotonPrimario>}
        />
      </div>
    )
  }

  if (cargandoAuth) return <div style={{ maxWidth: 760, margin: '0 auto' }}><PilaEsqueletos cuantos={3} alto={104} /></div>

  if (bloqueado) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <EstadoVacio
          titulo="Tu plan no incluye este informe"
          explicacion={`«${informe.titulo}» ${informe.contesta.charAt(0).toLowerCase()}${informe.contesta.slice(1)}`}
          accion={<BotonPrimario onClick={() => router.push('/configuracion/plan')}>Ver planes</BotonPrimario>}
        />
      </div>
    )
  }

  const periodos = (informe.periodos ?? []).map((p) => PERIODOS[p.toUpperCase()]).filter(Boolean)
  const usaFecha = (informe.params ?? []).includes('fecha') || (informe.params ?? []).includes('mes')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900, margin: '0 auto' }}>

      {/* QUÉ ES ESTE INFORME. Va arriba y siempre: es la mitad de la petición
          —«que sepa qué es el reporte»— y lo que evita bajar el que no era. */}
      <Tarjeta style={{ padding: '14px 16px' }}>
        <p style={{ fontSize: 13, color: 'var(--cf-ink-2)', lineHeight: 1.5 }}>{informe.contesta}</p>
      </Tarjeta>

      {/* LOS FILTROS */}
      {(periodos.length > 1 || usaFecha) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {periodos.length > 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--cf-gap-chips)' }}>
              {periodos.map((p) => (
                <Chip key={p.id} activo={periodo === p.id} onClick={() => setPeriodo(p.id)}>
                  {p.rotulo}
                </Chip>
              ))}
            </div>
          )}
          {usaFecha && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>Día</span>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                max={hoyBogota()}
                className="cf-input"
                style={{
                  height: 'var(--cf-h-field)', borderRadius: 'var(--cf-r-control)',
                  border: '1px solid var(--cf-border)', background: 'var(--cf-card)',
                  color: 'var(--cf-ink)', padding: '0 12px', fontSize: 14,
                }}
              />
            </label>
          )}
        </div>
      )}

      {error && (
        <Tarjeta style={{ padding: '12px 14px', borderColor: 'var(--cf-red-pill-border)' }}>
          <p style={{ fontSize: 13, color: 'var(--cf-red-dark)' }}>{error}</p>
        </Tarjeta>
      )}

      {cargando && <PilaEsqueletos cuantos={2} alto={96} />}

      {!cargando && vista && (
        <>
          {vista.cifras.length > 0 && (
            <Tarjeta style={{ padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
                {vista.cifras.map((c, i) => <Cifra key={i} c={c} pais={pais} />)}
              </div>
            </Tarjeta>
          )}

          {vista.tabla.filas.length > 0 ? (
            <Tarjeta style={{ padding: 0, overflow: 'hidden' }}>
              <Tabla
                /* `titulo` y `cifra`, que es como los llama `Tabla`. Con
                   `rotulo`/`alinear` la cabecera salía vacía y todo a la
                   izquierda: se ve en la pantalla, no en el JSX. */
                columnas={vista.tabla.columnas.map((c) => ({
                  clave: c.clave,
                  titulo: c.rotulo,
                  cifra: c.alinear === 'der',
                }))}
                filas={vista.tabla.filas.map((f) => {
                  const salida = {}
                  for (const c of vista.tabla.columnas) {
                    const v = f[c.clave]
                    salida[c.clave] = c.tipo === 'dinero' ? formatMoney(Math.round(Number(v) || 0), pais)
                      : c.tipo === 'pct' ? `${v ?? 0}%`
                      : v == null || v === '' ? '—' : String(v)
                  }
                  return salida
                })}
              />
            </Tarjeta>
          ) : !vista.soloDescarga && (
            <EstadoVacio
              titulo="No hubo movimiento"
              explicacion="En el periodo que elegiste no hay nada que enseñar. Prueba con otro."
            />
          )}

          {vista.nota && (
            <p style={{ fontSize: 12, color: 'var(--cf-ink-3)', lineHeight: 1.5 }}>{vista.nota}</p>
          )}
        </>
      )}

      {/* LAS DESCARGAS, SIEMPRE ABAJO Y SIEMPRE LAS DOS.
          En el mismo sitio en los doce informes: quien ya bajó uno sabe dónde
          está el siguiente sin buscarlo. */}
      <Tarjeta style={{ padding: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--cf-ink-3)', marginBottom: 10 }}>
          Bajar este informe
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <BotonPrimario onClick={() => bajar('pdf')} disabled={!!bajando} style={{ flex: '1 1 140px' }}>
            {bajando === 'pdf' ? 'Armando…' : 'PDF'}
          </BotonPrimario>
          {informe.ver && (
            <BotonSecundario onClick={() => bajar('excel')} disabled={!!bajando} style={{ flex: '1 1 140px' }}>
              {bajando === 'excel' ? 'Armando…' : 'Excel'}
            </BotonSecundario>
          )}
        </div>
        <p style={{ fontSize: 11, color: 'var(--cf-ink-3)', marginTop: 8, lineHeight: 1.5 }}>
          Baja exactamente lo que estás viendo arriba, con el filtro que elegiste.
        </p>
      </Tarjeta>
    </div>
  )
}
