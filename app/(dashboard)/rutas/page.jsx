'use client'
// app/(dashboard)/rutas/page.jsx - Lista de rutas

import { useState, useEffect, useCallback, useRef } from 'react'
import ListaRutas from '@/components/pantallas/ListaRutas'
import RutasEscritorio from '@/components/pantallas/RutasEscritorio'
import HojaInferior from '@/components/cf/HojaInferior'
import { adaptarRutas, adaptarSinRuta, resumenDelDia, bandaDelDia } from '@/lib/adaptadores/rutas'
import Link                    from 'next/link'
import { useRouter }           from 'next/navigation'
import { useAuth }             from '@/hooks/useAuth'
import { useOffline }         from '@/components/providers/OfflineProvider'
import { guardarEnCache, leerDeCache, obtenerRutasOffline } from '@/lib/offline'
import { Button }              from '@/components/ui/Button'
import { Input }               from '@/components/ui/Input'
import MoneyInput              from '@/components/ui/MoneyInput'
import { SkeletonCard }        from '@/components/ui/Skeleton'
import { Card }                from '@/components/ui/Card'
import MonedaCF                from '@/components/ui/MonedaCF'
import RutaCard                from '@/components/rutas/RutaCard'
import ModalSugerenciasRutas   from '@/components/rutas/ModalSugerenciasRutas'
import { useCountry } from '@/hooks/useCountry'
import { useMontado } from '@/hooks/useMontado'

/** El «+» dorado. Círculo, como en clientes y préstamos. */
function BotonNuevaRuta({ onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label="Nueva ruta" style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
      width: 'var(--cf-h-field)', height: 'var(--cf-h-field)', borderRadius: 999,
      background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', border: 0, cursor: 'pointer',
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  )
}

function BotonCopia({ onClick, cargando, texto, d }) {
  return (
    <button type="button" onClick={onClick} disabled={cargando} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none',
      height: 36, padding: '0 13px', borderRadius: 999, cursor: cargando ? 'default' : 'pointer',
      background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
      fontSize: 12.5, fontWeight: 600, color: 'var(--cf-ink-2)', opacity: cargando ? 0.55 : 1,
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
      {texto}
    </button>
  )
}

export default function RutasPage() {
  const router = useRouter()
  const { esOwner, loading: authLoading } = useAuth()
  const montado = useMontado()
  const { country } = useCountry()

  const { formatMoney } = useCountry()
  const { lastSyncedAt } = useOffline()
  const [rutas,    setRutas]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [showForm, setShowForm] = useState(false)
  const [nombre,   setNombre]   = useState('')
  const [capitalRuta, setCapitalRuta] = useState('')
  const [origenCapital, setOrigenCapital] = useState('nuevo') // 'nuevo' | 'existente'
  // ── QUIÉN LA RECORRE (T24-01) ──
  // La lámina lo pide en el formulario, y el endpoint YA acepta `cobradorId`
  // desde siempre: lo único que faltaba era ofrecerlo. Sin esto la ruta nace
  // huérfana y hay que entrar a la ficha a asignarla — dos pasos para algo que
  // se decide al crearla.
  const [cobradorNuevo, setCobradorNuevo] = useState('')
  const [cobradoresLista, setCobradoresLista] = useState([])
  useEffect(() => {
    if (!showForm || cobradoresLista.length) return
    fetch('/api/cobradores')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setCobradoresLista(Array.isArray(d) ? d : (d?.cobradores ?? [])))
      .catch(() => {})
  }, [showForm, cobradoresLista.length])
  const [saving,   setSaving]   = useState(false)
  const [formError, setFormError] = useState('')
  const [isOffline, setIsOffline] = useState(false)
  useEffect(() => {
    const goOnline = () => { setIsOffline(false) }
    window.addEventListener('online', goOnline)
    return () => window.removeEventListener('online', goOnline)
  }, [])
  const [backupLoading, setBackupLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [rutasPermitidas, setRutasPermitidas] = useState(null)
  // Recomendaciones de rutas (clientes sin ruta agrupados por similitud)
  const [recom, setRecom] = useState(null) // { totalSinRuta, ... }
  const [recomIgnoradoEn, setRecomIgnoradoEn] = useState(null) // valor de totalSinRuta cuando se cerro
  const [showSugerencias, setShowSugerencias] = useState(false)
  const hasLoadedOnceRef = useRef(false)

  // Modo trabajo / ordenar (drag-and-drop de rutas) — solo owner
  const [modoOrdenar, setModoOrdenar] = useState(false)
  const [dragIndex, setDragIndex] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [ordenEstado, setOrdenEstado] = useState('') // '' | 'guardando' | 'guardado' | 'error'
  const saveOrdenTimer = useRef(null)

  const guardarOrdenRutas = useCallback((lista) => {
    const rutaIds = lista.map(r => r.id)
    if (saveOrdenTimer.current) clearTimeout(saveOrdenTimer.current)
    setOrdenEstado('guardando')
    saveOrdenTimer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/rutas/reordenar', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rutaIds }),
        })
        if (!res.ok) throw new Error('fallo')
        setOrdenEstado('guardado')
        setTimeout(() => setOrdenEstado(''), 1500)
      } catch {
        setOrdenEstado('error')
      }
    }, 700)
  }, [])

  // Drag desktop (mouse)
  const onDragStart = (i) => setDragIndex(i)
  const onDragOver  = (e, i) => { e.preventDefault(); setDragOverIdx(i) }
  const onDrop = (i) => {
    if (dragIndex === null || dragIndex === i) { setDragIndex(null); setDragOverIdx(null); return }
    const lista = [...rutas]
    const [moved] = lista.splice(dragIndex, 1)
    lista.splice(i, 0, moved)
    setRutas(lista)
    guardarOrdenRutas(lista)
    setDragIndex(null); setDragOverIdx(null)
  }
  const onDragEnd = () => { setDragIndex(null); setDragOverIdx(null) }

  // Drag tactil (movil) — el drag nativo HTML5 no funciona con el dedo
  const listaRef = useRef(null)
  const tStart = useRef(null)
  const tNode = useRef(null)
  const tClone = useRef(null)
  const tIndex = useRef(null)
  const tOver = useRef(null)

  const onTouchStart = (e, i) => {
    const touch = e.touches[0]
    tStart.current = { y: touch.clientY, started: false, offsetY: null }
    tIndex.current = i
    tNode.current = e.currentTarget
  }
  const onTouchMove = (e) => {
    if (tIndex.current === null || !tStart.current) return
    const touch = e.touches[0]
    const dy = Math.abs(touch.clientY - tStart.current.y)
    if (!tStart.current.started && dy < 8) return
    e.preventDefault()
    if (!tStart.current.started) {
      tStart.current.started = true
      setDragIndex(tIndex.current)
      const node = tNode.current
      if (node) {
        const rect = node.getBoundingClientRect()
        const clone = node.cloneNode(true)
        clone.style.position = 'fixed'
        clone.style.left = `${rect.left}px`
        clone.style.width = `${rect.width}px`
        clone.style.top = `${rect.top}px`
        clone.style.zIndex = '9999'
        clone.style.opacity = '0.95'
        clone.style.transform = 'scale(1.02)'
        clone.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)'
        clone.style.border = '1px solid var(--cf-gold)'
        clone.style.pointerEvents = 'none'
        clone.style.transition = 'none'
        document.body.appendChild(clone)
        tClone.current = clone
        tStart.current.offsetY = touch.clientY - rect.top
      }
    }
    if (tClone.current && tStart.current.offsetY != null) {
      tClone.current.style.top = `${touch.clientY - tStart.current.offsetY}px`
    }
    if (listaRef.current) {
      const items = listaRef.current.querySelectorAll('[data-idx]')
      for (const item of items) {
        const rect = item.getBoundingClientRect()
        if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
          const overIdx = parseInt(item.dataset.idx)
          if (overIdx !== tOver.current) { tOver.current = overIdx; setDragOverIdx(overIdx) }
          break
        }
      }
    }
  }
  const onTouchEnd = () => {
    if (tClone.current) { document.body.removeChild(tClone.current); tClone.current = null }
    if (tIndex.current !== null && tOver.current !== null && tIndex.current !== tOver.current) {
      const lista = [...rutas]
      const [moved] = lista.splice(tIndex.current, 1)
      lista.splice(tOver.current, 0, moved)
      setRutas(lista)
      guardarOrdenRutas(lista)
    }
    tStart.current = null; tIndex.current = null; tNode.current = null; tOver.current = null
    setDragIndex(null); setDragOverIdx(null)
  }

  // Mover con botones (subir/bajar) — mas simple y a prueba de fallos en movil
  const moverRuta = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= rutas.length) return
    const lista = [...rutas]
    ;[lista[i], lista[j]] = [lista[j], lista[i]]
    setRutas(lista)
    guardarOrdenRutas(lista)
  }

  const fetchRutas = useCallback(async ({ soft = false } = {}) => {
    const shouldUseSoftRefresh = soft && hasLoadedOnceRef.current
    setError('')
    setIsOffline(false)

    // Cache-first: pintar al instante desde IndexedDB y luego revalidar.
    // Evita el flash vacio→skeleton→datos en cada navegacion repetida.
    if (!shouldUseSoftRefresh && !hasLoadedOnceRef.current) {
      try {
        const cached = await leerDeCache('rutas')
        if (cached && cached.length > 0) {
          setRutas(cached)
          setLoading(false)        // hay datos: no mostrar skeleton
          hasLoadedOnceRef.current = true
        } else {
          setLoading(true)         // primera vez sin cache: skeleton
        }
      } catch { setLoading(true) }
    }

    // Offline: go straight to IndexedDB, bypass SW cached response
    if (!navigator.onLine) {
      try {
        let cached = await leerDeCache('rutas')
        if (!cached || cached.length === 0) cached = await obtenerRutasOffline()
        if (cached && cached.length > 0) {
          setRutas(cached)
          if (!navigator.onLine) setIsOffline(true)
          setLoading(false)
          hasLoadedOnceRef.current = true
          return
        }
      } catch {}
    }

    try {
      const res = await fetch('/api/rutas')
      if (!res.ok) throw new Error()
      const d = await res.json()
      if (d.offline) throw new Error('offline')
      const rutas = Array.isArray(d) ? d : []
      setRutas(rutas)
      guardarEnCache('rutas', rutas).catch(() => {})
    } catch {
      try {
        let cached = await leerDeCache('rutas')
        if (!cached || cached.length === 0) cached = await obtenerRutasOffline()
        if (cached && cached.length > 0) { setRutas(cached); if (!navigator.onLine) setIsOffline(true); setLoading(false); hasLoadedOnceRef.current = true; return }
      } catch {}
      setError('No se pudieron cargar las rutas.')
    } finally {
      setLoading(false)
      hasLoadedOnceRef.current = true
    }
  }, [])

  useEffect(() => { fetchRutas() }, [fetchRutas])

  useEffect(() => {
    if (!esOwner) return
    fetch('/api/plan/uso')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.rutasPermitidas) setRutasPermitidas(new Set(d.rutasPermitidas)) })
      .catch(() => {})
  }, [esOwner])

  // Cargar recomendaciones (solo owner, en paralelo, sin bloquear)
  const fetchRecomendaciones = useCallback(async () => {
    if (!esOwner) return
    try {
      const r = await fetch('/api/rutas/recomendaciones')
      if (!r.ok) return
      const d = await r.json()
      setRecom(d)
    } catch {}
  }, [esOwner])

  useEffect(() => {
    if (!authLoading && esOwner) fetchRecomendaciones()
  }, [authLoading, esOwner, fetchRecomendaciones])

  // Leer valor "ignorado" desde localStorage al montar
  useEffect(() => {
    try {
      const v = localStorage.getItem('cf-rutas-recomendacion-ignored')
      if (v !== null) setRecomIgnoradoEn(Number(v))
    } catch {}
  }, [])

  const ignorarRecomendacion = () => {
    const total = recom?.totalSinRuta ?? 0
    setRecomIgnoradoEn(total)
    try { localStorage.setItem('cf-rutas-recomendacion-ignored', String(total)) } catch {}
  }

  const mostrarBannerRec =
    !!recom &&
    recom.totalSinRuta >= 3 &&
    (recomIgnoradoEn === null || recom.totalSinRuta !== recomIgnoradoEn)

  // Refresh silencioso cuando llega nueva sincronización global.
  useEffect(() => {
    if (!lastSyncedAt) return
    fetchRutas({ soft: true })
  }, [lastSyncedAt, fetchRutas])

  const crearRuta = async (e) => {
    e.preventDefault()
    if (!nombre.trim()) { setFormError('El nombre es requerido'); return }
    setSaving(true)
    setFormError('')
    try {
      const res  = await fetch('/api/rutas', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ nombre, ...(cobradorNuevo && { cobradorId: cobradorNuevo }), ...(Number(capitalRuta) > 0 && { capitalInicial: Number(capitalRuta), origenCapital }) }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error ?? 'Error al crear la ruta'); return }
      setRutas((prev) => [...prev, { ...data, cantidadClientes: 0, esperadoHoy: 0, recaudadoHoy: 0 }])
      setNombre('')
      setCapitalRuta('')
      setOrigenCapital('nuevo')
      setShowForm(false)
      router.push(`/rutas/${data.id}`)
    } catch {
      setFormError('Error de conexión.')
    } finally {
      setSaving(false)
    }
  }

  const descargarBackup = async () => {
    setBackupLoading(true)
    try {
      const res = await fetch('/api/rutas/backup')
      if (!res.ok) { alert('Error al descargar backup'); return }
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rutas-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch { alert('Error de conexión') } finally { setBackupLoading(false) }
  }

  const restaurarBackup = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (!confirm('Esto reemplazará la configuración actual de TODAS las rutas con el archivo seleccionado. ¿Continuar?')) return
      setRestoreLoading(true)
      try {
        const text = await file.text()
        const backup = JSON.parse(text)
        const res = await fetch('/api/rutas/backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(backup),
        })
        const data = await res.json()
        if (!res.ok) { alert(data.error ?? 'Error al restaurar'); return }
        alert(`Restauracion completada: ${data.restaurados} clientes reasignados`)
        window.location.reload()
      } catch { alert('Error al leer el archivo') } finally { setRestoreLoading(false) }
    }
    input.click()
  }

  // Los controles del encabezado, UNA sola vez: los usan la lista de móvil y la
  // de escritorio. Escritos dos veces, el día que cambie uno se quedan distintos
  // sin que nada falle — que es el patrón que ya lleva cinco apariciones aquí.
  const accionesRutas = (
    <>
      {rutas.length > 1 && (
        <button type="button" onClick={() => setModoOrdenar(true)} style={{
          display: 'inline-flex', alignItems: 'center', flex: 'none',
          height: 34, padding: '0 13px', borderRadius: 'var(--cf-r-pill)',
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          fontSize: 12, fontWeight: 600, color: 'var(--cf-ink-3)', cursor: 'pointer',
          fontFamily: 'var(--font-manrope), system-ui',
        }}>Ordenar</button>
      )}
      {montado && esOwner && (
        <button type="button" onClick={() => setShowForm(true)} aria-label="Nueva ruta" style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
          width: 34, height: 34, borderRadius: 999,
          background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
          color: 'var(--cf-ink)', cursor: 'pointer',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}
    </>
  )

  return (
    <div className="max-w-3xl lg:max-w-6xl mx-auto">
      {/* La cabecera del armazón ya dice «Rutas»; repetirlo en un <h1> con
          «2 rutas» debajo es decirlo dos veces y cuesta 90px. El botón ancho
          «Nueva ruta» pasa al círculo dorado: son 2-13 rutas, no hace falta un
          botón del ancho de la pantalla para algo que se toca una vez al mes.

          Las copias de seguridad se van al modo «Ordenar», que es cuando de
          verdad importan: se guarda una copia antes de cambiar el orden. */}

      {/* ── CREAR RUTA ES UNA HOJA, NO UN PANEL ENCIMA DEL TITULO ──
          Este formulario se abria INLINE y ARRIBA DEL TODO: al pulsar «+», lo
          primero de la pantalla dejaba de ser «Rutas» y pasaba a ser un
          recuadro con dos campos, un párrafo de ayuda y dos botones — con el
          titulo de la pantalla y la lista empujados fuera de la vista.

          Como hoja se comporta como el resto de la app: la pantalla se queda
          donde estaba, el formulario sube encima, y al cerrarlo vuelves a lo
          que estabas mirando. */}
      <HojaInferior
        abierta={showForm}
        onCerrar={() => { setShowForm(false); setCapitalRuta(''); setCobradorNuevo('') }}
        titulo="Nueva ruta"
        subtitulo="Un grupo de clientes que cobra la misma persona"
      >
        <form onSubmit={crearRuta} className="space-y-3">
          <Input
            placeholder="Nombre de la ruta (ej: Zona Norte)"
            value={nombre}
            onChange={(e) => { setNombre(e.target.value); setFormError('') }}
            error={formError}
            autoFocus
          />
          <p className="text-[12px]" style={{ color: 'var(--cf-ink-3)' }}>
            Ponle el nombre del barrio; es como la va a buscar el cobrador.
          </p>

          {/* ── QUIÉN LA RECORRE (T24-01) ──
              El endpoint acepta `cobradorId` desde siempre; lo que faltaba era
              ofrecerlo aquí. Sin esto la ruta nace huérfana y hay que entrar a
              su ficha a asignarla: dos pasos para algo que se decide al
              crearla. Es opcional — una ruta sin cobrador es un estado válido
              y la lista lo pinta como tal. */}
          {cobradoresLista.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--cf-ink-3)' }}>
                Quién la recorre
              </span>
              <select
                value={cobradorNuevo}
                onChange={(e) => setCobradorNuevo(e.target.value)}
                className="w-full"
                style={{
                  height: 46, padding: '0 12px', borderRadius: 'var(--cf-r-control)',
                  background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
                  font: 'inherit', fontSize: 15, color: 'var(--cf-ink)',
                }}
              >
                <option value="">Sin cobrador por ahora</option>
                {cobradoresLista.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <MoneyInput
              label="Capital de la ruta (opcional)"
              placeholder="Ej: 5.000.000"
              value={capitalRuta}
              onChange={(e) => setCapitalRuta(e.target.value)}
            />
            <p className="text-[10px] mt-1" style={{ color: 'var(--cf-ink-3)' }}>
              Asigna un capital propio para esta ruta. Si lo dejas vacío, usa el capital general.
            </p>
          </div>

          {/* Origen del capital: solo relevante si se ingresó un monto */}
          {Number(capitalRuta) > 0 && (
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[.07em] mb-1.5" style={{ color: 'var(--cf-ink-3)' }}>¿De dónde sale este capital?</p>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setOrigenCapital('nuevo')}
                  className="text-left rounded-[10px] border p-2.5 transition-colors"
                  style={{
                    borderColor: origenCapital === 'nuevo' ? 'var(--cf-gold)' : 'var(--cf-border)',
                    background: origenCapital === 'nuevo' ? 'color-mix(in srgb, var(--cf-gold) 8%, transparent)' : 'transparent',
                  }}
                >
                  <p className="text-xs font-semibold" style={{ color: 'var(--cf-ink)' }}>Es plata nueva (inyección)</p>
                  <p className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>Entra dinero nuevo: sube el capital total del negocio y se asigna a esta ruta.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setOrigenCapital('existente')}
                  className="text-left rounded-[10px] border p-2.5 transition-colors"
                  style={{
                    borderColor: origenCapital === 'existente' ? 'var(--cf-gold)' : 'var(--cf-border)',
                    background: origenCapital === 'existente' ? 'color-mix(in srgb, var(--cf-gold) 8%, transparent)' : 'transparent',
                  }}
                >
                  <p className="text-xs font-semibold" style={{ color: 'var(--cf-ink)' }}>Del capital existente</p>
                  <p className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>Se mueve del capital que ya tiene el negocio: el total NO cambia, solo se reserva para esta ruta.</p>
                </button>
              </div>
            </div>
          )}
          {/* Un solo botón: «Cancelar» ya es cerrar la hoja, y dos acciones
              donde una es «no hacer nada» reparten la atención. */}
          <Button type="submit" loading={saving} className="w-full">Crear ruta</Button>
        </form>
      </HojaInferior>

      {/* DOS ALARMAS AMBAR APILADAS PARA EL MISMO HECHO. La franja de arriba
          ya dice «Pasaste el límite de tu plan · 2/1 rutas» y ya lleva su
          «Ver planes»; este recuadro repetía el titular, repetía el botón, y
          se comía 240px. Lo único suyo era explicar qué significa «Solo
          lectura», y eso no es una alarma: es una nota. Va en gris, en una
          línea, sin caja. */}
      {rutasPermitidas && rutas.length > 0 && rutas.some(r => !rutasPermitidas.has(r.id)) && (
        <p className="text-[12px] leading-snug mb-3" style={{ color: 'var(--cf-ink-3)' }}>
          Las rutas en «Solo lectura» no admiten clientes ni préstamos nuevos.
          Reordénalas para elegir cuáles siguen activas.
        </p>
      )}

      {mostrarBannerRec && (
        <div
          className="rounded-[12px] px-4 py-3 mb-4 flex items-center gap-3"
          style={{
            background: 'color-mix(in srgb, var(--cf-gold) 6%, transparent)',
            borderLeft: '2px solid var(--cf-gold)',
          }}
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--cf-gold)' }}>
            <path d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-xs leading-snug" style={{ color: 'var(--cf-ink)' }}>
              Tienes <strong>{recom.totalSinRuta}</strong> cliente{recom.totalSinRuta === 1 ? '' : 's'} sin ruta asignada.
              {recom.gruposSugeridos?.length > 0 && (
                <> Detectamos {recom.gruposSugeridos.length} grupo{recom.gruposSugeridos.length === 1 ? '' : 's'} por dirección.</>
              )}
            </p>
          </div>
          <button
            onClick={() => setShowSugerencias(true)}
            className="shrink-0 px-3 py-1.5 rounded-[8px] text-[11px] font-semibold transition-colors"
            style={{ background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)' }}
          >
            Ver sugerencias
          </button>
          <button
            onClick={ignorarRecomendacion}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded transition-colors"
            style={{ color: 'var(--cf-ink-3)' }}
            aria-label="Ignorar"
            title="Ignorar (solo vuelve a aparecer si hay nuevos clientes sin ruta)"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {isOffline && (
        <div className="bg-[var(--cf-gold-tint)] border border-[color-mix(in_srgb,var(--cf-gold-dark)_30%,transparent)] text-[var(--cf-gold-dark)] text-xs rounded-[12px] px-4 py-2.5 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--cf-gold)] animate-pulse shrink-0" />
          Datos guardados — sin conexión
        </div>
      )}
      {error && (
        <div className="bg-[var(--cf-red-pill-bg)] border border-[color-mix(in_srgb,var(--cf-red-dark)_30%,transparent)] text-[var(--cf-red-dark)] text-sm rounded-[12px] px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {!loading && rutas.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4">
            <MonedaCF pose="vacia" size={100} />
          </div>
          <p className="text-sm font-medium text-[var(--cf-ink)]">Sin rutas aun</p>
          <p className="text-xs text-[var(--cf-ink-3)] mt-1">Crea una ruta y asignale un cobrador</p>
          <button onClick={() => setShowForm(true)} className="mt-4 text-sm text-[var(--cf-gold)] hover:underline">
            Crear primera ruta
          </button>
        </div>
      )}

      {/* Toggle modo trabajo / ordenar (owner y cobrador, con 2+ rutas).
          El cobrador solo puede reordenar sus rutas asignadas (validado en el endpoint).

          EN MODO TRABAJO NO SE PINTA ACA: va dentro de ListaRutas, en la misma
          fila del titulo, porque aca quedaba ENCIMA de el — lo primero que se
          veia al abrir Rutas no era «Rutas» sino un conmutador de modo. En modo
          Ordenar si se queda arriba: ahi la lista nueva no se monta. */}
      {!loading && rutas.length > 1 && modoOrdenar && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1 p-1 rounded-[12px]" style={{ background: 'var(--cf-fill)' }}>
            {[
              { key: false, label: 'Trabajo' },
              { key: true, label: 'Ordenar' },
            ].map(t => (
              <button
                key={String(t.key)}
                type="button"
                onClick={() => setModoOrdenar(t.key)}
                className="px-3.5 py-1.5 rounded-[8px] text-xs transition-all"
                // El seleccionado va NEGRO, no dorado: el dorado es de la plata.
                // Era el mismo amarillo del botón de dinero para decir «estás
                // en la pestaña Trabajo», que no es una cifra.
                style={modoOrdenar === t.key
                  ? { background: 'var(--cf-ink)', color: 'var(--cf-surface)', fontWeight: 700 }
                  : { color: 'var(--cf-ink-3)', fontWeight: 600 }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {modoOrdenar && (
              <span className="text-[11px]" style={{ color: ordenEstado === 'error' ? 'var(--cf-red-dark)' : 'var(--cf-ink-3)' }}>
                {ordenEstado === 'guardando' ? 'Guardando...' : ordenEstado === 'guardado' ? 'Guardado' : ordenEstado === 'error' ? 'Error al guardar' : 'Arrastra o usa las flechas'}
              </span>
            )}
            {/* En modo Ordenar el «+» sobra —nadie crea una ruta mientras
                reordena— y le quita el sitio a la pista de «arrastra». */}
            {!modoOrdenar && montado && esOwner && <BotonNuevaRuta onClick={() => setShowForm(true)} />}
          </div>
        </div>
      )}

      {/* ── AQUI HABIA UN TERCER «+» ──
          Con una sola ruta se pintaba este botón flotando entre el formulario y
          el título, ADEMÁS del que `ListaRutas` ya lleva en su fila de título y
          ADEMÁS del FAB de la pastilla: tres botones de crear en la misma
          pantalla, uno de ellos sin nada al lado que dijera qué crea.

          Se queda el de la lista, que es el que está junto a «Rutas». Cuando no
          hay ninguna, el estado vacío tiene su propio «Crear primera ruta». */}

      {/* ── T14-02 · RUTAS EN ESCRITORIO ──
          El dueño: «en el apartado de rutas no tiene una versión de PC, se ve
          como se ve en móvil y se ve bastante feo». Y era peor que eso: había un
          `lg:grid lg:grid-cols-2` envolviendo UN SOLO hijo, así que en 1440 la
          lista entera se metía en la mitad izquierda y la derecha quedaba en
          blanco. Dos columnas de mentira.

          El pie de la lámina dice que rutas NO va como tabla —«son cuatro, y lo
          que el dueño mira es el estado de cada una, no compararlas fila a
          fila»— así que en PC son las mismas tarjetas en dos columnas, con el
          estado completo: cartera, cobros de hoy y cumplimiento.

          Se pinta por CSS —`hidden lg:block`— y no midiendo la ventana: sin eso
          hay parpadeo al cargar y dos árboles con estado distinto. Las dos
          vistas comparten los handlers, así que abrir una ruta es lo mismo en
          las dos. */}
      {!loading && rutas.length > 0 && !modoOrdenar && (
        <div className="hidden lg:block">
          <RutasEscritorio
            rutas={adaptarRutas(rutas, country)}
            sinRuta={adaptarSinRuta(recom, country)}
            resumen={resumenDelDia(rutas, country)}
            acciones={accionesRutas}
            onAbrir={(r) => { window.location.href = `/rutas/${r.id}` }}
            onAsignar={(r) => { window.location.href = r?.id ? `/rutas/${r.id}` : '/clientes?filtro=sinruta' }}
            onVerSinRuta={() => { window.location.href = '/clientes?filtro=sinruta' }}
          />
        </div>
      )}

      {!loading && rutas.length > 0 && !modoOrdenar && (
        <div className="lg:hidden">
          {/* En la LISTA van solo las cifras de HOY; el acumulado de la ruta vive
              en el detalle. Mezclar las dos escalas —"$90.000 recaudado hoy" al
              lado de "$1.500.000 prestado"— hacia que el ojo se quedara con el
              numero grande, que es el que no importa al salir a cobrar. */}
          <ListaRutas
            // EL MARGEN LO PONE EL ARMAZÓN, NO EL COMPONENTE. Sin esta prop,
            // `ListaRutas` sumaba sus 20px de `--cf-pad-screen` a los 20 que ya
            // da `layout.jsx` con su `px-5`: 40 por lado, y las tarjetas salían
            // 40px más estrechas que en el resto de la app.
            //
            // Medido a 393px antes de tocarlo: la tarjeta empezaba en x=40 y
            // acababa en x=353 —313 de ancho— cuando la zona útil va de 20 a
            // 373. El dueño lo vio sin medir: «las tarjetas están muy angostas,
            // no están proporcionalmente en el ancho como las otras pantallas».
            //
            // Quinta vez el mismo patrón: prop declarada, prop no pasada, nada
            // falla y solo queda mal. Lo caza `lib/__tests__/sin-margen.test.js`.
            sinMargen
            rutas={adaptarRutas(rutas, country)}
            sinRuta={adaptarSinRuta(recom, country)}
            // «4 rutas · $34.500 de $207.500 hoy». El encabezado dice de un
            // vistazo lo que la lista solo dice sumando tarjeta por tarjeta.
            resumen={resumenDelDia(rutas, country)}
            banda={bandaDelDia(rutas, country)}
            // Los controles, en la MISMA fila del titulo. El «+» se queda porque
            // el FAB de la pastilla NO ofrece «nueva ruta» todavia: quitarlo
            // dejaria la pantalla sin forma de crear una. Cuando MenuCrear se
            // rehaga contra su lamina (T43), la ruta entra ahi y este se va.
            acciones={accionesRutas}
            onAbrir={(r) => { window.location.href = `/rutas/${r.id}` }}
            onAsignar={(r) => {
              // Dos agujeros distintos: la ruta SIN COBRADOR se resuelve
              // asignandole uno en su detalle; el cliente SIN RUTA, filtrando la
              // lista de clientes. Antes los dos iban al mismo sitio.
              window.location.href = r?.id ? `/rutas/${r.id}` : '/clientes?filtro=sinruta'
            }}
            onSalirACobrar={() => { window.location.href = '/cobros-hoy' }}
          />
        </div>
      )}

      {/* Las copias viven aquí: se guarda una antes de tocar el orden, y se
          restaura si el cambio salió mal. En la cabecera eran dos botones
          permanentes para algo que se usa el día que algo se rompe. */}
      {!loading && modoOrdenar && montado && esOwner && rutas.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <BotonCopia onClick={descargarBackup} cargando={backupLoading}
            texto={backupLoading ? 'Guardando…' : 'Guardar copia'}
            d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
          <BotonCopia onClick={restaurarBackup} cargando={restoreLoading}
            texto={restoreLoading ? 'Restaurando…' : 'Restaurar copia'}
            d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 6l-4-4-4 4M12 3v12" />
        </div>
      )}

      {/* Modo ordenar: cards no clicables, con grip (drag) y flechas subir/bajar */}
      {!loading && rutas.length > 0 && modoOrdenar && (
        <div className="space-y-2" ref={listaRef}>
          {rutas.map((r, i) => (
            <div
              key={r.id}
              data-idx={i}
              draggable
              onDragStart={() => onDragStart(i)}
              onDragOver={(e) => onDragOver(e, i)}
              onDrop={() => onDrop(i)}
              onDragEnd={onDragEnd}
              onTouchStart={(e) => onTouchStart(e, i)}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              className="flex items-center gap-2 px-3 py-3 rounded-[12px] border transition-all"
              style={{
                background: 'var(--cf-card)',
                borderColor: dragOverIdx === i ? 'var(--cf-gold)' : 'var(--cf-border)',
                opacity: dragIndex === i ? 0.5 : 1,
                cursor: 'grab',
                touchAction: 'none',
              }}
            >
              {/* Grip */}
              <svg className="w-6 h-6 shrink-0" style={{ color: 'var(--cf-ink-3)' }} fill="currentColor" viewBox="0 0 24 24">
                <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
              </svg>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--cf-ink)' }}>{r.nombre}</p>
                <p className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>
                  {r.cobrador?.nombre || 'Sin cobrador'} · {r.cantidadClientes} cliente{r.cantidadClientes !== 1 ? 's' : ''}
                </p>
              </div>
              {/* Flechas subir/bajar */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  type="button" onClick={() => moverRuta(i, -1)} disabled={i === 0}
                  className="w-7 h-7 flex items-center justify-center rounded-[8px] disabled:opacity-30"
                  style={{ background: 'var(--cf-fill)', color: 'var(--cf-ink)' }}
                  aria-label="Subir"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7"/></svg>
                </button>
                <button
                  type="button" onClick={() => moverRuta(i, 1)} disabled={i === rutas.length - 1}
                  className="w-7 h-7 flex items-center justify-center rounded-[8px] disabled:opacity-30"
                  style={{ background: 'var(--cf-fill)', color: 'var(--cf-ink)' }}
                  aria-label="Bajar"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ModalSugerenciasRutas
        open={showSugerencias}
        onClose={() => setShowSugerencias(false)}
        onSuccess={() => { fetchRutas({ soft: true }); fetchRecomendaciones() }}
      />
    </div>
  )
}

