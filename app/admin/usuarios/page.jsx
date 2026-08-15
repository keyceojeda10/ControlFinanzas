'use client'

/* ══ USUARIOS — UNA LISTA EN VEZ DE SEIS ═════════════════════════════════════
 *
 * «Es un panel de superadministrador que no superadministra nada en absoluto.»
 *  — el dueño, 16 ago 2026.
 *
 * Medido antes de tocar nada: SEIS secciones consultaban la misma tabla para
 * contestar variantes de la misma pregunta —Pruebas, Organizaciones,
 * Suscripciones, Activación, Retención y CRM—, unas 2.500 líneas, y cada una
 * segmentaba a su manera. La misma organización salía «activa» en una y
 * «muerta» en otra.
 *
 * Esta es la lista. Lo que cambia entre vistas es el filtro, nunca la
 * definición: esa vive en `lib/admin/segmentos.js`.
 *
 * ⚠ PC = TABLA, MÓVIL = FICHAS. La misma decisión que en clientes: de pie con
 *   el teléfono se lee una ficha; sentado con 485 negocios se lee una tabla.
 */

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { formatMoney } from '@/lib/i18n'
import { Tarjeta, FilaTarjeta, Pastilla, Campo, EstadoVacio } from '@/components/cf/primitivos'
import { Tabla, PilaEsqueletos } from '@/components/cf/primitivos2'

const AYUDA = { fontSize: 12, color: 'var(--cf-ink-3)' }

const ORDENES = [
  { id: 'valor',     rotulo: 'Los que más pagan' },
  { id: 'vence',     rotulo: 'Los que vencen antes' },
  { id: 'actividad', rotulo: 'Los más activos' },
  { id: 'recientes', rotulo: 'Los más nuevos' },
  { id: 'clientes',  rotulo: 'Los que más clientes tienen' },
  { id: 'nombre',    rotulo: 'Por nombre' },
]

function Buscador({ valor, onCambio }) {
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <Campo
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        placeholder="Negocio, dueño, correo o teléfono"
        style={{ paddingLeft: 38 }}
        aria-label="Buscar usuario"
      />
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-3)" strokeWidth="2"
        aria-hidden style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
      </svg>
    </div>
  )
}

function diasTexto(n) {
  if (n == null) return '—'
  if (n < 0) return `venció hace ${Math.abs(n)}d`
  if (n === 0) return 'hoy'
  return `en ${n}d`
}

function actividadTexto(n) {
  if (n == null) return '—'
  if (n <= 0) return 'hoy'
  if (n === 1) return 'ayer'
  return `hace ${n}d`
}

/* La ficha del teléfono. Un superadministrador que abre esta lista lo hace
   porque alguien le escribió: el número tiene que ser pulsable, no decorativo. */
function Telefono({ numero, chico = false }) {
  if (!numero) return <span style={{ ...AYUDA, fontStyle: 'italic' }}>sin teléfono</span>
  return (
    <a href={`https://wa.me/${String(numero).replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={{ fontSize: chico ? 12 : 13, color: 'var(--cf-gold-text)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
      {numero}
    </a>
  )
}

function ListaUsuarios() {
  const params = useSearchParams()
  const [q, setQ]               = useState('')
  const [segmento, setSegmento] = useState(params.get('segmento') || 'todos')
  const [orden, setOrden]       = useState('valor')
  const [d, setD]               = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError]       = useState(null)

  /* El buscador espera a que dejes de escribir. Sin esto son 485 negocios
     resegmentados con cada tecla. */
  const temporizador = useRef(null)
  const [qDiferido, setQDiferido] = useState('')
  useEffect(() => {
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setQDiferido(q), 250)
    return () => clearTimeout(temporizador.current)
  }, [q])

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      /* ⚠ 50, no 200. Con 200 la página medía 36.000px en el teléfono: eso no
         es una lista, es un muro. Para encontrar a alguien está el buscador; la
         lista larga solo sirve para perderse. Lo que queda fuera se DICE. */
      const qs = new URLSearchParams({ segmento, orden, limite: '50' })
      if (qDiferido.trim()) qs.set('q', qDiferido.trim())
      const r = await fetch(`/api/admin/usuarios?${qs}`)
      const j = await r.json()
      if (j?.error) setError(j.error); else { setD(j); setError(null) }
    } catch { setError('No se pudo cargar') } finally { setCargando(false) }
  }, [qDiferido, segmento, orden])

  useEffect(() => { cargar() }, [cargar])

  if (error) return <p style={{ fontSize: 13, color: 'var(--cf-red)' }}>{error}</p>
  if (!d && cargando) return <PilaEsqueletos cuantos={5} alto={64} />
  if (!d) return null

  const { usuarios, total, mostrados, porSegmento, segmentos, resumen } = d

  const columnas = [
    { clave: 'negocio',   titulo: 'Negocio' },
    { clave: 'estado',    titulo: 'Estado',   ancho: 130 },
    { clave: 'clientes',  titulo: 'Clientes', ancho: 84,  cifra: true },
    { clave: 'prestamos', titulo: 'Préstamos', ancho: 92, cifra: true },
    { clave: 'paga',      titulo: 'Paga',     ancho: 108, cifra: true, fuerte: true },
    { clave: 'vence',     titulo: 'Vence',    ancho: 116, cifra: true },
    { clave: 'visto',     titulo: 'Se le vio', ancho: 100, cifra: true },
  ]

  const filas = usuarios.map((u) => ({
    id: u.id,
    negocio: u.nombre,
    estado: segmentos.find((s) => s.id === u.segmento)?.rotulo ?? u.segmento,
    clientes: u.clientes,
    prestamos: u.prestamos,
    paga: u.precio > 0 ? formatMoney(u.precio) : '—',
    vence: diasTexto(u.diasRestantes),
    visto: actividadTexto(u.diasSinActividad),
    onClick: () => { window.location.href = `/admin/organizaciones/${u.id}` },
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1240, margin: '0 auto' }}>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--cf-ink)' }}>Usuarios</h1>
        <p style={AYUDA}>
          {resumen.totalReal} negocios de verdad de {resumen.organizaciones} · {formatMoney(resumen.mrr)} al mes
        </p>
      </div>

      {/* ⚠ En el teléfono van UNO DEBAJO DEL OTRO. En la misma fila, el
          desplegable se comía el ancho y el buscador se quedaba en «Negocio»:
          no se leía qué se puede buscar, que es justo lo que lo hace útil. */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <Buscador valor={q} onCambio={setQ} />
        <select
          value={orden}
          onChange={(e) => setOrden(e.target.value)}
          className="w-full sm:w-auto"
          style={{
            height: 'var(--cf-h-field)', borderRadius: 'var(--cf-r-control)',
            border: '1px solid var(--cf-border)', background: 'var(--cf-card)',
            color: 'var(--cf-ink)', fontSize: 13, padding: '0 12px', flex: 'none',
          }}
          aria-label="Ordenar por"
        >
          {ORDENES.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
        </select>
      </div>

      {/* Las pastillas llevan el conteo del TOTAL, no de lo filtrado: son por lo
          que se filtra, y unas pastillas que cambian al pulsarlas marean. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--cf-gap-chips)' }}>
        <button type="button" onClick={() => setSegmento('todos')} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}>
          <Pastilla tono={segmento === 'todos' ? 'destacado' : 'neutro'} numerica>
            Todos · {resumen.organizaciones}
          </Pastilla>
        </button>
        {segmentos.map((s) => (
          <button key={s.id} type="button" onClick={() => setSegmento(s.id)} title={s.ayuda}
            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}>
            <Pastilla tono={segmento === s.id ? 'destacado' : s.tono} numerica>
              {s.rotulo} · {porSegmento?.[s.id] ?? 0}
            </Pastilla>
          </button>
        ))}
      </div>

      {total === 0 ? (
        <EstadoVacio
          titulo="Nadie con eso"
          explicacion={q ? `No encuentro «${q}» en nombre, dueño, correo ni teléfono.` : 'No hay usuarios en este grupo.'}
        />
      ) : (
        <>
          {/* ── PC: la tabla ── */}
          <div className="hidden lg:block">
            <Tabla columnas={columnas} filas={filas} />
          </div>

          {/* ── Móvil: fichas ── */}
          {/* ⚠ El hueco va por CLASE, no por `style`: un `display` en línea gana
              a `lg:hidden` y las fichas se pintaban también en escritorio. */}
          <div className="lg:hidden flex flex-col gap-3">
            {usuarios.map((u) => (
              <Tarjeta key={u.id}>
                <FilaTarjeta primera>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      {/* El nombre NO se recorta: es lo que identifica. */}
                      {/* El nombre NO se recorta —es lo que identifica— pero SÍ
                          se parte: hay negocios cuyo nombre es un correo entero
                          sin espacios, y se montaba encima de la pastilla. */}
                      <Link href={`/admin/organizaciones/${u.id}`}
                        style={{
                          fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)',
                          textDecoration: 'none', minWidth: 0, overflowWrap: 'anywhere',
                        }}>
                        {u.nombre}
                      </Link>
                      <Pastilla tono={segmentos.find((s) => s.id === u.segmento)?.tono ?? 'neutro'}>
                        {segmentos.find((s) => s.id === u.segmento)?.rotulo ?? u.segmento}
                      </Pastilla>
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--cf-ink-2)' }}>{u.ownerNombre || 'sin nombre'}</span>
                    <Telefono numero={u.ownerTelefono} chico />
                    <span style={{ fontSize: 11, color: 'var(--cf-ink-3)' }}>
                      {u.clientes} clientes · {u.prestamos} préstamos · se le vio {actividadTexto(u.diasSinActividad)}
                      {u.precio > 0 && ` · paga ${formatMoney(u.precio)}`}
                      {u.diasRestantes != null && ` · vence ${diasTexto(u.diasRestantes)}`}
                    </span>
                  </div>
                </FilaTarjeta>
              </Tarjeta>
            ))}
          </div>

          {/* Nada de recortes en silencio: si la lista está cortada, se dice. */}
          {mostrados < total && (
            <p style={AYUDA}>
              Se ven {mostrados} de {total}. Afina la búsqueda o el filtro para ver el resto.
            </p>
          )}
        </>
      )}
    </div>
  )
}

/* `useSearchParams` obliga a la frontera de Suspense: sin ella el build se cae
   al prerenderizar. Mismo patrón que `configuracion`. */
export default function AdminUsuarios() {
  return (
    <Suspense fallback={<PilaEsqueletos cuantos={5} alto={64} />}>
      <ListaUsuarios />
    </Suspense>
  )
}
