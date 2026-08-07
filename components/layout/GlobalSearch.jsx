'use client'

// ── T34-03 · LA BUSQUEDA GLOBAL ──
//
// Lo que cambia respecto al buscador anterior, y por que:
//
// 1. LA BUSQUEDA VACIA YA NO REPITE EL CAMPO. Antes, con el campo en blanco,
//    arriba decia «buscar clientes, rutas, caja, configuracion» y debajo «busca
//    clientes, prestamos, rutas, caja, gastos, configuracion…». Dos listas que
//    ni siquiera coincidian, ocupando la pantalla entera para no decir nada.
//    Ahora enseña los ultimos que abriste, los cinco saltos que mas se usan, y
//    la accion que trae aqui a la mitad de la gente: prestarle a alguien nuevo.
//
// 2. EL CAMPO PIDE LO QUE SE TECLEA: «nombre, cedula o telefono». En este
//    negocio se busca por cedula tanto como por nombre.
//
// 3. LOS RESULTADOS VAN EN UNA SOLA LISTA. Antes iban en tres grupos con su
//    rotulo cada uno, y con dos resultados por grupo son tres titulos para
//    cinco filas. Al que busca «Steven» le da igual si Steven es un cliente o
//    un prestamo: quiere llegar a Steven.
//
// 4. EL ARO DEL AVATAR TRAE EL ESTADO. Quien busca a alguien casi siempre
//    quiere saber como va, no solo entrar.
//
// Se conserva entero lo que ya funcionaba y no es diseño: la consulta a
// `/api/buscar` con su rebote, el respaldo contra la copia local cuando no hay
// internet, el catalogo de comandos y el manejo de teclado.

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { obtenerComandos, filtrarComandos } from '@/lib/searchCommands'
import { obtenerClientesOffline, obtenerRutasOffline } from '@/lib/offline'
import { aFilasBusqueda } from '@/lib/adaptadores/busqueda'
import { leerRecientes } from '@/lib/recientes'
import { BusquedaGlobal } from '@/components/pantallas/Estados'

/* Los cinco saltos de la lamina. No son «todos los destinos» —para eso esta el
   menu—: son los que se repiten a diario. `soloDueno` marca los que un cobrador
   no puede ver, para no ofrecerle una puerta que da a un 403. */
const ATAJOS = [
  { id: 'cobrar', texto: 'Cobrar hoy', href: '/cobros-hoy', d: 'M8.5 12.5l2.5 2.5 4.5-5', extra: <circle cx="12" cy="12" r="8.5" /> },
  { id: 'caja', texto: 'Caja', href: '/caja', d: '', extra: <rect x="3" y="7" width="18" height="12" rx="2.5" /> },
  { id: 'capital', texto: 'Mi plata', href: '/capital', d: 'M4 20V9l8-5 8 5v11z', soloDueno: true },
  { id: 'gastos', texto: 'Gastos', href: '/gastos', d: 'M6 4h12v16H6zM9 9h6M9 13h4' },
  { id: 'config', texto: 'Configuración', href: '/configuracion', d: 'M12 3v3M12 18v3M3 12h3M18 12h3', extra: <circle cx="12" cy="12" r="3" />, soloDueno: true },
]

function IconoAtajo({ d, extra }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-2)"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
      {extra}
      {d && <path d={d} />}
    </svg>
  )
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const [recientes, setRecientes] = useState([])
  const router = useRouter()
  const debounceRef = useRef(null)
  const { esCobrador, ...auth } = useAuth()

  // Catalogo de comandos locales (navegacion/acciones/config) segun rol.
  const comandos = useMemo(() => obtenerComandos({
    esCobrador,
    permisos: {
      puedeCrearPrestamos: auth.puedeCrearPrestamos,
      puedeCrearClientes: auth.puedeCrearClientes,
    },
  }), [esCobrador, auth.puedeCrearPrestamos, auth.puedeCrearClientes])

  // Comandos locales que matchean la query — instantaneo, sin API.
  const comandosFiltrados = useMemo(
    () => (query.trim().length >= 1 ? filtrarComandos(comandos, query, 8) : []),
    [comandos, query]
  )

  // La lupa de la cabecera y de la barra lateral. Ctrl+K no existe en un
  // telefono, asi que sin esto la busqueda no se podia abrir desde el movil.
  useEffect(() => {
    const abrir = () => setOpen(true)
    window.addEventListener('cf:abrir-buscador', abrir)
    return () => window.removeEventListener('cf:abrir-buscador', abrir)
  }, [])

  // Ctrl+K / Cmd+K to open
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Al abrir: campo limpio y los recientes releidos. Se leen AQUI y no al
  // montar porque entre una apertura y otra el usuario abrio cosas, y una lista
  // de recientes congelada al arrancar la app seria mentira a los diez minutos.
  useEffect(() => {
    if (!open) return
    setQuery('')
    setResults(null)
    setSelected(0)
    setRecientes(leerRecientes())
  }, [open])

  // Con el buscador abierto, el fondo no se mueve. Sin esto, en movil se
  // arrastra la pagina de detras y al cerrar apareces en otro sitio.
  useEffect(() => {
    if (!open) return
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previo }
  }, [open])

  const buscarOffline = useCallback(async (q) => {
    const ql = q.toLowerCase()
    const clientes = await obtenerClientesOffline()
    const rutas = await obtenerRutasOffline()
    const clientesMatch = (clientes || [])
      .filter(c => c.nombre?.toLowerCase().includes(ql) || c.cedula?.toLowerCase().includes(ql) || c.telefono?.includes(q))
      .slice(0, 8)
      .map(c => ({ id: c.id, nombre: c.nombre, cedula: c.cedula, telefono: c.telefono, tipo: 'cliente' }))
    const prestamosMatch = []
    for (const c of (clientes || [])) {
      for (const p of (c.prestamos || [])) {
        if (prestamosMatch.length >= 5) break
        if (c.nombre?.toLowerCase().includes(ql)) {
          // `clienteId` tambien sin internet, o el adaptador no puede juntar el
          // prestamo con su dueño y el mismo nombre sale dos veces.
          prestamosMatch.push({ id: p.id, clienteId: c.id, clienteNombre: c.nombre, saldoPendiente: p.saldoPendiente, tipo: 'prestamo' })
        }
      }
    }
    const rutasMatch = (rutas || [])
      .filter(r => r.nombre?.toLowerCase().includes(ql))
      .slice(0, 5)
      .map(r => ({ id: r.id, nombre: r.nombre, tipo: 'ruta' }))
    return { clientes: clientesMatch, prestamos: prestamosMatch, rutas: rutasMatch }
  }, [])

  const search = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults(null); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/buscar?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data)
        fetch('/api/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ evento: 'busqueda_global' }),
        }).catch(() => {})
      } else {
        setResults(await buscarOffline(q))
      }
    } catch {
      try { setResults(await buscarOffline(q)) } catch { setResults(null) }
    }
    setLoading(false)
  }, [buscarOffline])

  const onTexto = (val) => {
    setQuery(val)
    setSelected(0)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 300)
  }

  const ir = useCallback((href) => {
    if (!href) return
    setOpen(false)
    router.push(href)
  }, [router])

  // Los resultados de verdad y los destinos del catalogo, en UNA lista.
  //
  // LA GENTE VA PRIMERO, y los destinos como mucho tres. Al reves —que es como
  // estaba— escribir una letra devolvia ocho destinos y ningun cliente: la API
  // no contesta hasta la segunda letra, asi que la pantalla se llenaba de
  // «Analiticas, Apariencia, Dashboard, Cobrar hoy…» por contener una «a».
  // Y con dos letras, buscar a Carlos lo dejaba debajo de «cartera» y «carga
  // masiva». Este buscador es para llegar a una PERSONA; los destinos son un
  // extra que no puede mandar sobre lo que se vino a buscar.
  const filas = useMemo(() => {
    const texto = query.trim()
    if (texto.length === 0) return []
    const gente = aFilasBusqueda(results)
    // Desde dos letras, igual que la API: con una sola, «a» los trae todos.
    const destinos = texto.length < 2 ? [] : comandosFiltrados.slice(0, 3).map((c) => ({
      id: `cmd-${c.id}`,
      tipo: 'comando',
      nombre: c.label,
      detalle: c.sub,
      iniciales: '›',
      href: c.href,
    }))
    return [...gente, ...destinos]
  }, [comandosFiltrados, results, query])

  // Teclado: solo tiene sentido con teclado, o sea en escritorio.
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected((p) => Math.min(p + 1, filas.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected((p) => Math.max(p - 1, 0))
      } else if (e.key === 'Enter' && filas[selected]) {
        e.preventDefault()
        ir(filas[selected].href)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, filas, selected, ir])

  if (!open) return null

  const atajos = ATAJOS
    .filter((a) => !(a.soloDueno && esCobrador))
    .map((a) => ({ ...a, icono: <IconoAtajo d={a.d} extra={a.extra} /> }))

  const escribiendo = query.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-start sm:justify-center sm:pt-[10vh]">
      <div className="absolute inset-0 bg-black/72 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* En movil es una hoja que sube y tapa casi todo, como la lamina: con el
          teclado abierto una tarjeta flotante deja 200px utiles y el primer
          resultado ya no se ve. Los 56px de arriba son la cabecera de la app
          asomando bajo el velo — dicen que esto va ENCIMA de donde estabas, y
          de paso dan sitio para cerrar tocando fuera.
          En escritorio sigue siendo una tarjeta centrada. */}
      <div
        className="relative w-full mt-14 sm:mt-0 sm:max-w-lg sm:mx-4 sm:rounded-[16px] overflow-hidden sm:max-h-[76vh] sm:max-h-[76dvh] flex"
        style={{ background: 'var(--cf-surface)', boxShadow: '0 -12px 32px rgba(20,20,28,.2)' }}
      >
        <BusquedaGlobal
          texto={query}
          onTexto={onTexto}
          onCerrar={() => setOpen(false)}
          recientes={recientes}
          atajos={atajos}
          onAtajo={(a) => ir(a.href)}
          onAbrir={(f) => ir(f.href)}
          resultados={filas}
          vacio={
            loading ? 'Buscando…'
              : escribiendo ? `Nada con «${query.trim()}». Prueba con la cédula o el teléfono.`
                : null
          }
          accion={auth.puedeCrearPrestamos === false ? null : {
            texto: 'Prestarle a alguien nuevo',
            nota: 'crear cliente y préstamo de una vez',
            onIr: () => ir('/prestamos/nuevo'),
          }}
          pie={recientes.length === 0 ? 'Escribe un nombre, una cédula o un teléfono' : null}
        />
      </div>
    </div>
  )
}
