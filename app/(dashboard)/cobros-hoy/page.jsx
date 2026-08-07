'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { formatMoney } from '@/lib/i18n'
import { Modal } from '@/components/ui/Modal'
import { obtenerCoordsRapido } from '@/lib/geo'
import { StaggeredList } from '@/components/ui/StaggeredList'
import MonedaCF from '@/components/ui/MonedaCF'
import MetodoPagoSelector from '@/components/pagos/MetodoPagoSelector'
import { obtenerRutasOffline, guardarEnCache, leerDeCache, guardarPagoPendiente, obtenerPagosPendientes } from '@/lib/offline'
import CobrarHoy from '@/components/pantallas/CobrarHoy'
import HojaWhatsApp from '@/components/whatsapp/HojaWhatsApp'
import {
  adaptarCobrosHoy, ORDENES, RANGOS_ATRASO, conteosAtraso, resumenSeleccion,
} from '@/lib/adaptadores/cobros'
import HojaFiltros from '@/components/pantallas/HojaFiltros'

export default function CobrosHoyPage() {
  // `orgNombre` y `ocultarSaldoWA` son para la hoja de WhatsApp: la firma del
  // mensaje y la preferencia de no mandar el saldo por chat.
  const { user, orgNombre, ocultarSaldoWA, organizationId, loading: authLoading } = useAuth()
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  // A quién se le va a escribir. La hoja de plantillas se monta abajo.
  const [waCliente, setWaCliente] = useState(null)
  const [error, setError]         = useState('')

  const [modalPago, setModalPago]         = useState(null)
  const [pagando, setPagando]             = useState(null)
  const [pagoOk, setPagoOk]               = useState(null)
  const [undoPago, setUndoPago]           = useState(null)
  const [confirmDuplicado, setConfirmDuplicado] = useState(null)
  const undoTimerRef = useRef(null)
  const [metaCumplida, setMetaCumplida] = useState(false)
  const [rutasColapsadas, setRutasColapsadas] = useState({})
  const [montoParcial, setMontoParcial] = useState('')
  const [modoParcial, setModoParcial] = useState(false)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [fotoSubida, setFotoSubida] = useState(false)
  const fotoInputRef = useRef(null)
  const [metodosPago, setMetodosPago] = useState([])

  // ── Lo que pide T02-02 y la pantalla no tenia ──
  //
  // `orden`: los tres chips (orden de ruta / mas atrasados / cerca de mi).
  // `coords`: sin ellas «Cerca de mi» se deshabilita en vez de fingir una
  //   ordenacion por distancia — mandar al cobrador a caminar mal cuesta
  //   gasolina y tiempo de verdad, no solo una lista fea.
  // `sinSubir`: los cobros que estan en la cola offline. Es el unico dato de
  //   esta pantalla que el cobrador no puede resolver caminando: si se queda sin
  //   bateria con dos cobros sin subir, esos cobros no existen.
  const [orden, setOrden] = useState('ruta')
  // ── LOS FILTROS DE T03-02 ──
  // Hasta ahora esta pantalla solo ordenaba, con tres chips. La lamina añade
  // rangos de atraso CON CONTEO, ruta, y dos interruptores. Viven aca y no en
  // la URL porque son de la jornada: se rearman cada mañana, no se comparten.
  const [hojaFiltros, setHojaFiltros] = useState(false)
  const [filtros, setFiltros] = useState({ atraso: '', rutaId: '', ocultarCobrados: false })
  const cambiar = (k, v) => setFiltros((f) => ({ ...f, [k]: v }))
  const [coords, setCoords] = useState(null)
  const [sinSubir, setSinSubir] = useState(0)

  useEffect(() => {
    let vivo = true
    obtenerCoordsRapido().then((c) => { if (vivo && c) setCoords(c) }).catch(() => {})
    // `obtenerPagosPendientes` es la que existe: devuelve la cola, no el conteo.
    obtenerPagosPendientes().then((p) => { if (vivo) setSinSubir((p || []).length) }).catch(() => {})
    return () => { vivo = false }
  }, [])

  const construirCobrosOffline = useCallback(async () => {
    const rutas = await obtenerRutasOffline()
    if (!rutas?.length) return null
    const clientes = []
    let esperado = 0, recaudado = 0
    for (const r of rutas) {
      for (const c of (r.clientes || [])) {
        if (!c.prestamos?.length && !c.cuota) continue
        const pagado = c.pagadoHoy || false
        const cuota = c.cuota || c.cuotaDiaria || 0
        clientes.push({
          id: c.id, nombre: c.nombre, cedula: c.cedula, telefono: c.telefono,
          direccion: c.direccion, estado: c.estado, pagadoHoy: pagado,
          cuota, diasMora: c.diasMora || 0, rutaNombre: r.nombre, rutaId: r.id,
          cobroPendienteHoy: c.cobroPendienteHoy ?? !pagado,
          prestamos: c.prestamos || [],
          offline: true,
        })
        esperado += cuota
        if (pagado) recaudado += cuota
      }
    }
    const pendientes = clientes.filter(c => c.cobroPendienteHoy).length
    const pagados = clientes.filter(c => c.pagadoHoy).length
    return {
      clientes,
      resumen: { total: clientes.length, pendientes, pagados, esperadoHoy: esperado, recaudadoHoy: recaudado },
      offline: true,
    }
  }, [])

  const fetchCobros = useCallback(async () => {
    try {
      const cached = await leerDeCache('cobros-hoy')
      if (cached) { setData(cached); setLoading(false) }
    } catch {}
    try {
      const r = await fetch(`/api/cobros-hoy?t=${Date.now()}`, { cache: 'no-store' })
      const d = await r.json()
      if (d.error) {
        const offline = await construirCobrosOffline()
        if (offline) { setData(offline); setError('') }
        else setError(d.error)
      } else {
        setData(d); setError('')
        guardarEnCache('cobros-hoy', d).catch(() => {})
      }
    } catch {
      const offline = await construirCobrosOffline()
      if (offline) { setData(offline); setError('') }
      else setError('No se pudo cargar los cobros de hoy.')
    } finally {
      setLoading(false)
    }
  }, [construirCobrosOffline])

  useEffect(() => { fetchCobros() }, [fetchCobros])

  useEffect(() => {
    fetch('/api/metodos-pago').then(r => r.ok ? r.json() : []).then(setMetodosPago).catch(() => {})
  }, [])

  // Refrescar cuando el usuario vuelve a la app despues de tenerla en
  // segundo plano (ej. revisar WhatsApp). Sin esto, los cobradores ven
  // estados de pago desactualizados en campo.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') fetchCobros() }
    const onFocus = () => fetchCobros()
    const onOnline = () => fetchCobros()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onOnline)
    }
  }, [fetchCobros])

  // Detectar meta cumplida
  useEffect(() => {
    if (!data?.resumen) return
    const { recaudadoHoy, esperadoHoy } = data.resumen
    if (esperadoHoy > 0 && recaudadoHoy >= esperadoHoy && !metaCumplida) {
      setMetaCumplida(true)
    }
  }, [data, metaCumplida])

  const abrirPago = (cliente) => {
    if (pagando) return
    const activos = cliente.prestamosActivos ?? []
    if (activos.length === 0) return
    if (activos.length > 1) {
      setModalPago({ id: cliente.id, nombre: cliente.nombre, cuota: null, prestamoActivo: null, prestamosActivos: activos, abonoConPendiente: false })
      return
    }
    const p = activos[0]
    const cuota = p.cuotaDiaria || cliente.cuota
    if (!cuota || cuota <= 0) return
    setModoParcial(false)
    setMontoParcial('')
    setModalPago({ id: cliente.id, nombre: cliente.nombre, cuota, prestamoActivo: p.id, prestamosActivos: activos, abonoConPendiente: cliente.pagoHoy && cliente.cobroPendienteHoy, esBalloon: p.esBalloon || false, cuotaNumero: p.cuotaNumero ?? null, modoInteres: p.modoInteres, cuotaExtraHoy: p.cuotaExtraHoy || false, montoCuotaExtra: p.montoCuotaExtra || 0 })
  }

  const elegirPrestamo = (prestamoId, cuota, extra = {}) => {
    if (!modalPago) return
    setModalPago(prev => prev ? { ...prev, prestamoActivo: prestamoId, cuota, esBalloon: extra.esBalloon || false, cuotaNumero: extra.cuotaNumero ?? null, modoInteres: extra.modoInteres, cuotaExtraHoy: extra.cuotaExtraHoy || false, montoCuotaExtra: extra.montoCuotaExtra || 0 } : prev)
  }

  const ejecutarPago = async (metodoPago, { confirmarDuplicado = false, montoCustom = null, metodoPagoId = null, plataforma = null } = {}) => {
    try { sessionStorage.setItem('cf-ultimo-metodo-pago', metodoPago) } catch {}
    if (!modalPago || pagando) return
    const { id: clienteId, nombre, cuota, prestamoActivo } = modalPago
    const montoFinal = montoCustom ?? cuota
    const tipoPago = montoCustom && montoCustom < cuota ? 'parcial' : 'completo'
    setModalPago(null)
    setModoParcial(false)
    setMontoParcial('')
    setPagando(clienteId)
    const coords = await obtenerCoordsRapido().catch(() => null)

    setData(prev => prev ? {
      ...prev,
      clientes: prev.clientes.map(c =>
        c.id === clienteId ? { ...c, pagoHoy: true, cobroPendienteHoy: false } : c
      ),
      resumen: {
        ...prev.resumen,
        pendientes: tipoPago === 'completo' ? Math.max(0, prev.resumen.pendientes - 1) : prev.resumen.pendientes,
        pagados: tipoPago === 'completo' ? prev.resumen.pagados + 1 : prev.resumen.pagados,
        recaudadoHoy: prev.resumen.recaudadoHoy + montoFinal,
      }
    } : prev)

    try {
      const url = `/api/prestamos/${prestamoActivo}/pagos${confirmarDuplicado ? '?confirmarDuplicado=1' : ''}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ montoPagado: montoFinal, tipo: tipoPago, diasAbonados: tipoPago === 'completo' ? 1 : 0, metodoPago, ...(metodoPagoId ? { metodoPagoId } : {}), ...(coords ?? {}) }),
      })

      if (res.ok) {
        const d = await res.json()
        const pagoId = d.pagos?.[0]?.id
        setPagoOk(clienteId)
        setTimeout(() => setPagoOk(null), 1200)
        fetchCobros()
        if (pagoId) {
          if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
          setUndoPago({ pagoId, prestamoId: prestamoActivo, clienteNombre: nombre })
          setFotoSubida(false)
          undoTimerRef.current = setTimeout(() => setUndoPago(null), 10000)
        }
      } else if (res.status === 409) {
        const d = await res.json().catch(() => ({}))
        if (d?.duplicado && !confirmarDuplicado) {
          fetchCobros()
          setConfirmDuplicado({ clienteId, nombre, cuota, prestamoActivo, metodoPago, metodoPagoId })
        } else {
          alert(d?.error || 'No se pudo registrar el pago')
          fetchCobros()
        }
      } else {
        const d = await res.json().catch(() => ({}))
        alert(d?.error || 'No se pudo registrar el pago')
        fetchCobros()
      }
    } catch {
      // Esta pantalla es la pestana principal del cobrador y era la unica de
      // las tres rutas de cobro que NO encolaba offline: mostraba un alert y
      // fetchCobros() revertia el pago que ya se habia cobrado en la puerta.
      try {
        await guardarPagoPendiente({
          prestamoId: prestamoActivo,
          montoPagado: montoFinal,
          tipo: tipoPago,
          diasAbonados: tipoPago === 'completo' ? 1 : 0,
          metodoPago,
          ...(metodoPagoId ? { metodoPagoId } : {}),
          clienteNombre: nombre,
          ...(coords ?? {}),
        })
        window.dispatchEvent(new Event('paymentQueued'))
        setPagoOk(clienteId)
        setTimeout(() => setPagoOk(null), 1200)
      } catch {
        alert('No se pudo guardar el pago. Intenta de nuevo.')
        fetchCobros()
      }
    } finally {
      setPagando(null)
    }
  }

  const subirFotoQuick = async (file) => {
    if (!undoPago?.pagoId || subiendoFoto) return
    setSubiendoFoto(true)
    try {
      const fd = new FormData()
      fd.append('foto', file)
      const res = await fetch(`/api/pagos/${undoPago.pagoId}/foto`, { method: 'POST', body: fd })
      if (res.ok) setFotoSubida(true)
    } catch {} finally {
      setSubiendoFoto(false)
    }
  }

  const deshacerPago = async () => {
    if (!undoPago) return
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoPago(null)
    try {
      await fetch(`/api/pagos/${undoPago.pagoId}`, { method: 'DELETE' })
      fetchCobros()
    } catch {}
  }

  if (authLoading || loading) return (
    <div className="max-w-2xl lg:max-w-[1180px] mx-auto space-y-3 px-1">
      <div className="rounded-[20px] h-28 animate-pulse" style={{ background: 'var(--cf-card)' }} />
      <div className="rounded-[16px] h-16 animate-pulse" style={{ background: 'var(--cf-card)' }} />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-[16px] h-[76px] animate-pulse" style={{ background: 'var(--cf-card)' }} />
      ))}
    </div>
  )

  // El muro "solo para cobradores" se quito: el dueño que cobra solo (95% de
  // las organizaciones) tambien necesita saber a quien le toca hoy, y el
  // dashboard no responde eso. La API ya distingue por rol que clientes trae.

  const clientes = data?.clientes ?? []
  const resumen = data?.resumen ?? {}
  const pendientes = clientes.filter(c => c.cobroPendienteHoy)
  const pagados = clientes.filter(c => !c.cobroPendienteHoy && c.pagoHoy)

  const rutasPendientes = (() => {
    const map = {}
    pendientes.forEach(c => {
      const ruta = c.rutaNombre || 'Sin ruta'
      if (!map[ruta]) map[ruta] = []
      map[ruta].push(c)
    })
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]))
  })()
  const pct = resumen.esperadoHoy > 0
    ? Math.min(100, Math.round((resumen.recaudadoHoy / resumen.esperadoHoy) * 100))
    : 0

  // Lo que la hoja necesita saber, todo derivado — nada de estado paralelo.
  const conteos = conteosAtraso(data?.clientes, filtros)
  const seleccion = resumenSeleccion(data?.clientes, filtros, user?.country)
  // Las rutas que tienen a alguien HOY, con cuantos. El grupo de ruta solo se
  // enseña si hay mas de una: con una sola es un filtro que no filtra.
  const rutasDeHoy = Object.values((data?.clientes ?? []).reduce((m, c) => {
    const id = c.rutaId ?? ''
    if (!id) return m
    m[id] = m[id] ?? { id, nombre: c.rutaNombre || 'Sin ruta', n: 0 }
    m[id].n += 1
    return m
  }, {}))

  return (
    // SIN `px-1` NI `space-y-4`: los pone la pantalla nueva. Con ellos, la fila
    // medía 302px desde x44 —20 del layout + 4 de acá + 20 de la pantalla— y los
    // nombres se truncaban a «Ana Milena G...». La lámina la pone a 350 desde x20.
    <div className="max-w-2xl lg:max-w-5xl mx-auto">

      {/* ── LA PANTALLA NUEVA, T02-02 «el arreglo del muro» ──
          Sustituye al hero dorado con degradado, a las listas agrupadas a mano y
          a la lista aparte de cobrados: 246 lineas de presentacion que ahora
          viven en components/pantallas/CobrarHoy.jsx contra su lamina.

          LO QUE NO SE TOCA: el modal de cobro, la cola offline, la subida de
          foto, el deshacer y el aviso de duplicado. Eso es la funcionalidad de
          la pantalla y sigue igual — solo cambia lo que se ve.

          El cambio de fondo: los cobrados ya NO van en una lista aparte al final.
          Se quedan tachados EN SU SITIO, que es lo que pide la lamina: el
          cobrador recorre la calle en orden, y si el cobrado desaparece de la
          lista pierde la referencia de donde iba. */}
      {/* ── LA HOJA DE «FILTRAR Y ORDENAR» (T03-02) ──
          Reusa `HojaFiltros`, la misma de prestamos y clientes, con dos cosas
          que la lamina pide y no tenia: los conteos al lado de cada rango y un
          boton que dice cuanta plata queda seleccionada.

          Los conteos se calculan IGNORANDO el propio rango: si se contaran
          sobre la lista ya filtrada, al entrar en «+30d» los otros tres dirian
          0 y pareceria que no hay nadie en ellos. */}
      <HojaFiltros
        abierta={hojaFiltros}
        onCerrar={() => setHojaFiltros(false)}
        titulo="Filtrar y ordenar"
        accion={seleccion.texto}
        onLimpiar={() => { setFiltros({ atraso: '', rutaId: '', ocultarCobrados: false }); setOrden('ruta') }}
        grupos={[
          {
            id: 'orden', tipo: 'orden', titulo: 'Ordenar por', valor: orden,
            onCambiar: setOrden,
            // «Cerca de mi» sin GPS no se ofrece: fingir una ordenacion por
            // distancia manda al cobrador a caminar mal, y eso cuesta gasolina.
            opciones: ORDENES
              .filter((o) => o.id !== 'cerca' || !!coords)
              .map((o) => ({ valor: o.id, nombre: o.nombre })),
          },
          {
            id: 'atraso', titulo: 'Atraso', valor: filtros.atraso,
            onCambiar: (v) => cambiar('atraso', v),
            opciones: RANGOS_ATRASO.map((r) => ({
              valor: r.id, nombre: r.nombre, conteo: conteos[r.id],
            })),
          },
          ...(rutasDeHoy.length > 1 ? [{
            id: 'ruta', titulo: 'Ruta', valor: filtros.rutaId,
            onCambiar: (v) => cambiar('rutaId', v),
            // «Todas» cuenta CLIENTES, no rutas. Decía 2 —las rutas que hay— al lado de
              // un «Todos · 6» que son clientes: el mismo sitio contando dos cosas.
              opciones: [{ valor: '', nombre: 'Todas', conteo: rutasDeHoy.reduce((n, r) => n + r.n, 0) },
              ...rutasDeHoy.map((r) => ({ valor: r.id, nombre: r.nombre, conteo: r.n }))],
          }] : []),
          {
            id: 'interruptores', tipo: 'interruptores',
            onCambiar: (k, v) => cambiar(k, v),
            opciones: [
              { valor: 'ocultarCobrados', nombre: 'Ocultar los ya cobrados', activo: filtros.ocultarCobrados },
            ],
          },
        ]}
      />

      <CobrarHoy
        {...adaptarCobrosHoy(data, { pais: user?.country, orden, filtros, coords })}
        sinMargen
        orden={orden}
        onOrden={setOrden}
        onFiltros={() => setHojaFiltros(true)}
        nFiltros={(filtros.atraso ? 1 : 0) + (filtros.rutaId ? 1 : 0) + (filtros.ocultarCobrados ? 1 : 0)}
        hayGps={!!coords}
        sinSubir={sinSubir}
        onCobrar={(fila) => {
          const c = clientes.find((x) => x.id === fila.id)
          if (c) abrirPago(c)
        }}
        onEmpezar={() => {
          const primero = clientes.find((x) => x.cobroPendienteHoy)
          if (primero) abrirPago(primero)
        }}
        onMapa={(fila) => {
          // Con fila: la parada actual, a su dirección. Sin ella: el botón del
          // encabezado, que lleva al mapa de rutas.
          const c = fila ? clientes.find((x) => x.id === fila.id) : null
          const destino = c?.latitud && c?.longitud
            ? `${c.latitud},${c.longitud}`
            : [c?.direccion, c?.referencia].filter(Boolean).join(' ')
          if (destino) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`, '_blank')
          } else if (c) {
            // ⚠ SIN DIRECCIÓN NO SE MANDA A OTRA PANTALLA.
            // Caía en `/rutas`, que no tiene nada que ver con el botón: el
            // cobrador pulsaba «Mapa» y se encontraba en la lista de rutas, sin
            // saber por qué. Reportado: «mandan a otras opciones del sistema
            // completamente diferentes».
            // Se dice lo que pasa y se ofrece lo único que lo arregla: ponerle
            // la dirección, que es un dato del cliente.
            if (confirm(`${c.nombre} no tiene dirección ni ubicación guardada, así que no hay a dónde llevarte.

¿Quieres abrir su ficha para ponérsela?`)) {
              window.location.href = `/clientes/${c.id}`
            }
          }
        }}
        onWhatsApp={(fila) => {
          // ⚠ ABRE LA HOJA DE PLANTILLAS, no un `wa.me` pelado.
          // Antes se abría WhatsApp con el chat VACÍO: el cobrador tenía que
          // escribir el mensaje a mano delante de alguien que le debe plata.
          // Reportado: «el WhatsApp no manda ni siquiera a las plantillas».
          // La misma hoja que la ficha del cliente, con sus cuatro familias.
          const c = clientes.find((x) => x.id === fila.id)
          if (c) setWaCliente(c)
        }}
        onMas={(fila) => { window.location.href = `/clientes/${fila.id}` }}
      />


      {/* ── La hoja de plantillas, la misma que la ficha del cliente ──
          Se le pasa el préstamo con más saldo: es el que decide qué mensaje
          toca —cuánto debe y cuántos días lleva de atraso—. Con varios activos,
          escribir sobre el más pequeño diría lo que no es. */}
      <HojaWhatsApp
        open={!!waCliente}
        onClose={() => setWaCliente(null)}
        cliente={waCliente}
        prestamo={(waCliente?.prestamosActivos ?? [])
          .slice()
          .sort((a, b) => (b.saldoPendiente ?? 0) - (a.saldoPendiente ?? 0))[0] ?? null}
        orgNombre={orgNombre}
        ocultarSaldo={ocultarSaldoWA}
        organizationId={organizationId}
      />

      {/* ── Modal: elegir método de pago ── */}
      <Modal open={!!modalPago} onClose={() => setModalPago(null)} title="Cobro rápido">
        {modalPago && !modalPago.prestamoActivo && (modalPago.prestamosActivos?.length ?? 0) > 1 && (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: 'var(--cf-ink-3)' }}>
              <span className="font-medium" style={{ color: 'var(--cf-ink)' }}>{modalPago.nombre}</span> tiene varios préstamos. Elige cual cobrar.
            </p>
            <div className="space-y-2">
              {modalPago.prestamosActivos.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => elegirPrestamo(p.id, p.cuotaDiaria, { esBalloon: p.esBalloon, cuotaNumero: p.cuotaNumero, modoInteres: p.modoInteres, cuotaExtraHoy: p.cuotaExtraHoy, montoCuotaExtra: p.montoCuotaExtra })}
                  disabled={!p.cuotaDiaria || p.cuotaDiaria <= 0}
                  className="w-full text-left px-4 py-3.5 rounded-[12px] border transition-all active:scale-[0.99] disabled:opacity-50"
                  style={{ background: 'var(--cf-card)', borderColor: 'var(--cf-border)' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold" style={{ color: 'var(--cf-ink)' }}>Préstamo {i + 1}</p>
                    <span className="text-sm font-bold font-mono-display" style={{ color: 'var(--cf-green-dark)' }}>{formatMoney(p.cuotaDiaria ?? 0)}</span>
                  </div>
                  {p.diasMora > 0 && (
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--cf-red-dark)' }}>{p.diasMora} días de atraso</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {modalPago && modalPago.prestamoActivo && (() => {
          return (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm" style={{ color: 'var(--cf-ink-3)' }}>{modoParcial ? 'Pago parcial para' : 'Registrar 1 cuota para'}</p>
              <p className="text-base font-bold mt-1" style={{ color: 'var(--cf-ink)' }}>{modalPago.nombre}</p>
              {!modoParcial ? (
                <p className="text-3xl font-extrabold font-mono-display mt-2" style={{ color: 'var(--cf-green-dark)' }}>{formatMoney(modalPago.cuota)}</p>
              ) : (
                <div className="mt-3 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold" style={{ color: 'var(--cf-ink-3)' }}>$</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={montoParcial}
                    onChange={e => setMontoParcial(e.target.value)}
                    placeholder="Monto"
                    autoFocus
                    className="w-full text-center text-2xl font-extrabold font-mono-display py-3 pl-8 pr-3 rounded-[12px] border outline-none"
                    style={{ background: 'var(--cf-card)', borderColor: 'var(--cf-border)', color: 'var(--cf-ink)' }}
                    min={1}
                    max={modalPago.cuota}
                  />
                  <p className="text-[11px] mt-1.5" style={{ color: 'var(--cf-ink-3)' }}>Cuota completa: {formatMoney(modalPago.cuota)}</p>
                </div>
              )}
            </div>
            <button
              onClick={() => { setModoParcial(!modoParcial); setMontoParcial('') }}
              className="w-full text-center text-[12px] font-medium py-1.5 rounded-lg transition-all"
              style={{ color: 'var(--cf-ink-2)' }}
            >
              {modoParcial ? 'Cobrar cuota completa' : 'Cobrar otro monto'}
            </button>
            {modalPago.esBalloon && (
              <div className="rounded-[12px] px-3 py-2.5 text-center" style={{ background: 'color-mix(in srgb, var(--cf-red-dark) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--cf-red-dark) 25%, transparent)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--cf-red-dark)' }}>Cuota de capital + interés (globo)</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>Esta es la última cuota. Incluye la devolución del capital completo mas el interés del período.</p>
              </div>
            )}
            {modalPago.cuotaExtraHoy && (
              <div className="rounded-[12px] px-3 py-2.5 text-center" style={{ background: 'color-mix(in srgb, var(--cf-ink-2) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--cf-ink-2) 25%, transparent)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--cf-ink-2)' }}>Cuota extra programada: {formatMoney(modalPago.montoCuotaExtra)}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>Esta cuota incluye un abono extra a capital. Ya está incluido en el monto total.</p>
              </div>
            )}
            {modalPago.cuotaNumero && ['lineal', 'lineal_dinamico', 'solo_interes', 'saldo'].includes(modalPago.modoInteres) && (
              <p className="text-[10px] text-center" style={{ color: 'var(--cf-ink-3)' }}>Cuota #{modalPago.cuotaNumero}</p>
            )}
            {modalPago.abonoConPendiente && (
              <div className="rounded-[12px] px-3 py-2.5 text-center" style={{ background: 'color-mix(in srgb, var(--cf-gold-dark) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--cf-gold-dark) 25%, transparent)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--cf-gold-dark)' }}>Tiene cuotas atrasadas</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>Ya pagó hoy pero aún debe mas. Cada registro cubre 1 cuota.</p>
              </div>
            )}
            <MetodoPagoSelector
              metodosPago={metodosPago}
              disabled={!!pagando}
              onSelect={({ metodoPago: mp, metodoPagoId: mpId }) => {
                const monto = modoParcial ? parseFloat(montoParcial) : null
                if (modoParcial && (!monto || monto <= 0 || monto > modalPago.cuota)) return
                ejecutarPago(mp, { montoCustom: monto, metodoPagoId: mpId })
              }}
            />
          </div>
          )
        })()}
      </Modal>

      {/* ── Modal: confirmar pago duplicado ── */}
      <Modal
        open={!!confirmDuplicado}
        onClose={() => { setConfirmDuplicado(null); fetchCobros() }}
        title="Pago duplicado"
      >
        {confirmDuplicado && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--cf-ink-2)' }}>
              <span className="font-medium" style={{ color: 'var(--cf-ink)' }}>{confirmDuplicado.nombre}</span> ya recibio un pago por{' '}
              <span className="font-bold font-mono-display" style={{ color: 'var(--cf-gold-dark)' }}>{formatMoney(confirmDuplicado.cuota)}</span> hace menos de 1 minuto.
            </p>
            <p className="text-sm" style={{ color: 'var(--cf-ink-3)' }}>Registrar este pago de todos modos?</p>
            <div className="flex gap-3">
              <button
                onClick={() => { const d = confirmDuplicado; setConfirmDuplicado(null); setModalPago({ id: d.clienteId, nombre: d.nombre, cuota: d.cuota, prestamoActivo: d.prestamoActivo, prestamosActivos: [], abonoConPendiente: false }); ejecutarPago(d.metodoPago, { confirmarDuplicado: true, metodoPagoId: d.metodoPagoId }) }}
                className="flex-1 py-2.5 rounded-[12px] text-sm font-semibold transition-all"
                style={{ background: 'var(--cf-gold-dark)', color: 'var(--cf-gold-ink)' }}
              >
                Si, registrar igual
              </button>
              <button
                onClick={() => { setConfirmDuplicado(null); fetchCobros() }}
                className="flex-1 py-2.5 rounded-[12px] text-sm font-medium transition-all"
                style={{ background: 'var(--cf-fill)', color: 'var(--cf-ink-2)', border: '1px solid var(--cf-border)' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Toast: deshacer pago ── */}
      <input
        ref={fotoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) subirFotoQuick(f)
          e.target.value = ''
        }}
      />
      {undoPago && (
        <div className="fixed bottom-24 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-6 sm:w-auto z-50 animate-slide-up">
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-[12px] border sm:min-w-[320px]"
            style={{ background: 'rgba(15,15,22,0.98)', border: '1px solid rgba(34,197,94,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--cf-green-dark) 20%, transparent)' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--cf-green-dark)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-sm flex-1 truncate" style={{ color: 'var(--cf-ink)' }}>Pago registrado — {undoPago.clienteNombre}</span>
            <button
              onClick={() => fotoInputRef.current?.click()}
              disabled={subiendoFoto || fotoSubida}
              className="shrink-0 transition-colors disabled:opacity-50"
              style={{ color: fotoSubida ? 'var(--cf-green-dark)' : 'var(--cf-ink-3)' }}
              title={fotoSubida ? 'Foto guardada' : 'Adjuntar foto'}
            >
              {subiendoFoto ? (
                <svg className="w-4 h-4 animate-spin" fill="currentColor" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" fill="none" strokeWidth={3} />
                  <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : fotoSubida ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
            <button onClick={deshacerPago} className="text-sm font-bold shrink-0 transition-colors" style={{ color: 'var(--cf-gold)' }}>
              Deshacer
            </button>
            <button onClick={() => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); setUndoPago(null) }} className="shrink-0 transition-colors" style={{ color: 'var(--cf-ink-3)' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ClienteCard({ cliente, pagando, pagoOk, onCobrar, showRuta = true }) {
  const pagado = !cliente.cobroPendienteHoy && cliente.pagoHoy
  const enMora = cliente.diasMora > 0

  const borderColor = pagoOk
    ? 'color-mix(in srgb, var(--cf-green-dark) 40%, var(--cf-border))'
    : enMora && !pagado
      ? 'color-mix(in srgb, var(--cf-red-dark) 25%, var(--cf-border))'
      : pagado
        ? 'color-mix(in srgb, var(--cf-green-dark) 20%, var(--cf-border))'
        : 'var(--cf-border)'

  const bgColor = pagoOk
    ? 'color-mix(in srgb, var(--cf-green-dark) 8%, var(--cf-card))'
    : enMora && !pagado
      ? 'color-mix(in srgb, var(--cf-red-dark) 4%, var(--cf-card))'
      : 'var(--cf-card)'

  return (
    <div
      className="rounded-[16px] px-4 py-3.5 flex items-center gap-3 transition-all"
      style={{ background: bgColor, border: `1px solid ${borderColor}` }}
    >
      {/* Avatar */}
      <div
        className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0 text-sm font-bold"
        style={{
          background: pagado
            ? 'color-mix(in srgb, var(--cf-green-dark) 15%, transparent)'
            : enMora
              ? 'color-mix(in srgb, var(--cf-red-dark) 12%, transparent)'
              : 'color-mix(in srgb, var(--cf-gold) 12%, transparent)',
          color: pagado ? 'var(--cf-green-dark)' : enMora ? 'var(--cf-red-dark)' : 'var(--cf-gold)',
        }}
      >
        {pagado
          ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          : cliente.nombre.charAt(0).toUpperCase()
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <Link href={`/clientes/${cliente.id}`} className="text-[15px] font-semibold truncate block" style={{ color: 'var(--cf-ink)' }}>{cliente.nombre}</Link>
        {cliente.direccion && (
          <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>{cliente.direccion}</p>
        )}
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {enMora && !pagado && (
            <>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                style={{ background: 'color-mix(in srgb, var(--cf-red-dark) 15%, transparent)', color: 'var(--cf-red-dark)' }}
              >
                {cliente.diasMora}d atraso
              </span>
              {cliente.montoParaPonerseAlDia > cliente.cuota && (
                <span className="text-[10px]" style={{ color: 'var(--cf-gold-dark)' }}>
                  Al día: {formatMoney(cliente.montoParaPonerseAlDia)}
                </span>
              )}
            </>
          )}
          {cliente.cuotaExtraHoy && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-md"
              style={{ background: 'color-mix(in srgb, var(--cf-ink-2) 15%, transparent)', color: 'var(--cf-ink-2)' }}
            >
              +Extra {formatMoney(cliente.montoCuotaExtra)}
            </span>
          )}
          {showRuta && cliente.rutaNombre && (
            <span className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>{cliente.rutaNombre}</span>
          )}
          {pagado && (
            <span className="text-[10px] font-medium" style={{ color: 'var(--cf-green-dark)' }}>Pagó hoy</span>
          )}
        </div>
      </div>

      {/* Acción */}
      {pagado ? (
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold font-mono-display" style={{ color: 'var(--cf-green-dark)' }}>{formatMoney(cliente.cuota)}</p>
          <Link href={`/clientes/${cliente.id}`} className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>Ver detalle</Link>
        </div>
      ) : (
        <button
          onClick={onCobrar}
          disabled={pagando}
          className="shrink-0 px-4 h-11 rounded-[12px] font-bold text-sm font-mono-display transition-all active:scale-95 disabled:opacity-60"
          style={{
            background: pagando ? 'var(--cf-fill)' : enMora ? 'var(--cf-red-dark)' : 'var(--cf-green-dark)',
            color: '#fff',
            minWidth: '90px',
          }}
        >
          {pagando
            ? <svg className="w-4 h-4 animate-spin mx-auto" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            : formatMoney(cliente.cuota)
          }
        </button>
      )}
    </div>
  )
}
