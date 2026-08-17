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
import { Tabla, PieTabla, PilaEsqueletos } from '@/components/cf/primitivos2'

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
  const [verTodas, setVerTodas] = useState(false)

  const cargar = useCallback(async () => {
    if (!informe?.ver || bloqueado) return
    setCargando(true); setError('')
    try {
      const qs = parametrosDe(informe, periodo, { fecha })
      /* ⚠ `ver` PUEDE TRAER YA SU PROPIA CONSULTA. Los cuatro volcados comparten
         API y se distinguen por `?tipo=`, así que pegar «?periodo=…» detrás daba
         `datos?tipo=pagos?desde=…`: un segundo `?` que el servidor lee como
         parte del valor. La rama de descarga ya lo hacía bien; esta no. */
      const res = await fetch(`${informe.ver}${qs.toString() ? `${informe.ver.includes('?') ? '&' : '?'}${qs}` : ''}`)
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

  /* ⚠ LA PANTALLA SE CORTA; LA DESCARGA NO.
   *
   * «Cartera completa» son 24 columnas y en un negocio real 77 filas: sin tope,
   * el móvil salía de **51.103 píxeles** —una ficha por fila con 24 renglones
   * cada una— y ni siquiera llegaba a pintar el botón de bajar. Ya pasó antes
   * con una lista de 36.000px.
   *
   * Se enseñan las primeras y se dice cuántas faltan, con `PieTabla`, que es la
   * pieza que la app ya usa para esto. El PDF y el Excel siguen bajando TODAS:
   * el tope es de la pantalla, no del informe. */
  const TOPE_EN_PANTALLA = 50
  const filasVisibles = useMemo(
    () => (verTodas ? (vista?.tabla.filas ?? []) : (vista?.tabla.filas ?? []).slice(0, TOPE_EN_PANTALLA)),
    [vista, verTodas],
  )

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
      /* ⚠ LA EXTENSIÓN SALE DE LO QUE LLEGÓ, NO DE LO QUE SE PIDIÓ.
         Antes se ponía `.pdf` salvo que el botón dijera Excel, y «Todo en
         bruto» —que baja por su propia ruta y siempre da un xlsx— se guardaba
         como `.pdf`: un archivo que no abre en ningún programa. Se mira el
         tipo de la respuesta, que es lo único que no puede mentir. */
      const tipo = res.headers.get('content-type') ?? ''
      const ext = tipo.includes('spreadsheet') || tipo.includes('excel') ? 'xlsx'
        : tipo.includes('pdf') ? 'pdf'
        : tipo.includes('csv') ? 'csv'
        : (formato === 'excel' ? 'xlsx' : 'pdf')
      a.download = `${informe.id}-${periodo}.${ext}`
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

      {/* ⚠ LA FRASE NO SE REPITE AQUÍ. `useCabecera` ya la pone de subtítulo,
          y en la captura salía dos veces seguidas: en la cabecera y en una
          tarjeta debajo diciendo exactamente lo mismo. */}

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
            <>
            {/* ── PC: LA TABLA ───────────────────────────────────────────
                ⚠ La clase va en un `div` DE FUERA, no en la `Tarjeta`:
                `Tarjeta` pone `display: flex` en línea y el estilo en línea le
                gana a `.hidden` de Tailwind. Con la clase puesta en ella, en el
                teléfono salían LAS DOS —la tabla recortada encima de las
                fichas—. Se ve en la captura; en el JSX parecía correcto. */}
            <div className="hidden lg:block">
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
                filas={filasVisibles.map((f) => {
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
              {vista.tabla.filas.length > filasVisibles.length && (
                <PieTabla
                  visibles={filasVisibles.length}
                  deTotal={vista.tabla.filas.length}
                  onVerTodos={() => setVerTodas(true)}
                />
              )}
            </Tarjeta>
            </div>

            {/* ── MÓVIL: UNA FICHA POR FILA ────────────────────────────────
                ⚠ NO ES LA TABLA ENCOGIDA. En 412px, seis columnas dejaban
                «Ruta…», «Juan…» y «$33…»: hasta el dinero salía cortado, que es
                lo único que no se puede recortar en esta app. Se ve en la
                captura; en el JSX la tabla parece correcta. */}
            <div className="lg:hidden">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cf-gap-cards)' }}>
              {filasVisibles.map((f, i) => {
                const [primera, ...resto] = vista.tabla.columnas
                return (
                  <Tarjeta key={i} style={{ padding: '13px 15px' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)', marginBottom: 8 }}>
                      {f[primera.clave] == null || f[primera.clave] === '' ? '—' : String(f[primera.clave])}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {resto.map((c) => (
                        <div key={c.clave} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                          <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{c.rotulo}</span>
                          <span className={c.tipo === 'texto' ? undefined : 'cf-num'}
                            style={{ fontSize: 14, fontWeight: 500, color: 'var(--cf-ink)', textAlign: 'right' }}>
                            {c.tipo === 'dinero' ? formatMoney(Math.round(Number(f[c.clave]) || 0), pais)
                              : c.tipo === 'pct' ? `${f[c.clave] ?? 0}%`
                              : f[c.clave] == null || f[c.clave] === '' ? '—' : String(f[c.clave])}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Tarjeta>
                )
              })}
              {vista.tabla.filas.length > filasVisibles.length && (
                <Tarjeta style={{ padding: 0 }}>
                  <PieTabla
                    visibles={filasVisibles.length}
                    deTotal={vista.tabla.filas.length}
                    onVerTodos={() => setVerTodas(true)}
                  />
                </Tarjeta>
              )}
            </div>
            </div>
            </>
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
          {/* Los que bajan por su propia ruta tienen UN formato y lo declaran:
              poner «PDF» en el botón del volcado en bruto era prometer un papel
              y entregar una hoja de cálculo. */}
          <BotonPrimario
            onClick={() => bajar(informe.formatoPropio ?? 'pdf')}
            disabled={!!bajando}
            style={{ flex: '1 1 140px' }}
          >
            {/* `bajando` a secas ponía «Armando…» en ESTE botón mientras se
                armaba el Excel del de al lado. */}
            {bajando === (informe.formatoPropio ?? 'pdf')
              ? 'Armando…'
              : (informe.formatoPropio === 'excel' ? 'Excel' : 'PDF')}
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
