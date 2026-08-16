'use client'
// components/prestamos/RegistrarPago.jsx - Modal de registro de pago

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useCountry } from '@/hooks/useCountry'
import { useAuth }    from '@/hooks/useAuth'
import { useRouter }   from 'next/navigation'
import { Modal }       from '@/components/ui/Modal'
import { Button }      from '@/components/ui/Button'
import { Input }       from '@/components/ui/Input'
import BotonImprimirRecibo  from '@/components/ui/BotonImprimirRecibo'
import BotonCompartirRecibo from '@/components/ui/BotonCompartirRecibo'
import HojaWhatsApp from '@/components/whatsapp/HojaWhatsApp'
import { ChecklistCamposRecibo, getDefaultCampos } from '@/components/recibos/CamposReciboEditor'
import { generarTextoPlantilla } from '@/lib/whatsapp-plantillas'
import { formatearTelefono, abrirWhatsApp } from '@/lib/whatsapp'
import MoneyInput           from '@/components/ui/MoneyInput'
import MetodoPagoSelector   from '@/components/pagos/MetodoPagoSelector'
import HojaInferior        from '@/components/cf/HojaInferior'
import RegistrarCobro, { PieRegistrarCobro } from '@/components/pantallas/RegistrarCobro'
import AbonoPorDias from '@/components/pantallas/AbonoPorDias'
// El comprobante del rediseño, el mismo que ya salía en el cobro desde la ruta.
import { Recibo } from '@/components/pantallas/Recibo'
import { imprimirRecibo, guardarReciboImagen } from '@/lib/recibo-acciones'
import { getPlataformaInfo } from '@/components/ui/LogoPlataforma'
import { formatFechaCobroRelativa, siguientePeriodo } from '@/lib/calculos'
import { FilaInterruptor } from '@/components/cf/primitivos2'
import {
  adaptarDespuesDelPago, atajosDeMonto, mediosParaHoja, medioAGuardar,
  montoCrudo, montoParaMostrar, montoCrudoConModo, montoParaMostrarConModo,
} from '@/lib/adaptadores/pago'
import { Recargo, Descuento, PieGestion } from '@/components/pantallas/Gestion'
import {
  adaptarRecargo, atajosDeRecargo, adaptarDescuento, atajosDeDescuento,
} from '@/lib/adaptadores/gestion'
import { elInteresSubeLaDeuda }                            from '@/lib/dinero/modos'
import { guardarPagoPendiente, actualizarPrestamoOffline }  from '@/lib/offline'
import { obtenerCoordsRapido }                              from '@/lib/geo'

export default function RegistrarPago({
  prestamoId, cuotaDiaria, saldoPendiente,
  open, onClose, onSuccess,
  cliente, prestamo, rutaNav,
  presetPago,
  // tabInicial: 'pago' (default) | 'capital' | 'recargo' | 'descuento'
  // Cuando se abre desde botones "Recargo" / "Descuento" / "Abono a capital".
  tabInicial = 'pago',
  montoAlDia = 0,
  cancelarHoy = 0,
}) {
  const router = useRouter()
  const { formatMoney } = useCountry()
  const { puedeAplicarDescuentos, orgNombre, ocultarSaldoWA, organizationId, camposRecibo: camposReciboOrg, modoAbreviado } = useAuth()

  // ── EL MODO ABREVIADO, EN LA HOJA NUEVA ──
  // Se escribe en miles: «40» son $40.000. `MoneyInput` lo hace desde siempre,
  // pero el rediseño puso aquí un campo propio y la conversión se perdió sin
  // avisar: el modo seguía encendido en configuración y no hacía nada. Lo
  // reportó un cobrador creyendo que se le había desactivado solo.
  const camposRecibo = (Array.isArray(cliente?.camposRecibo) && cliente.camposRecibo.length > 0)
    ? cliente.camposRecibo
    : (Array.isArray(camposReciboOrg) && camposReciboOrg.length > 0 ? camposReciboOrg : getDefaultCampos())

  // Pre-llena con la cuota, pero nunca más que el saldo pendiente (último pago de saldos pequeños)
  const montoInicial = Math.min(Math.round(cuotaDiaria ?? 0), Math.round(saldoPendiente ?? 0))
  const [monto,        setMonto]        = useState(String(montoInicial))

  // ── ⚠ EL CAMPO GUARDA LO QUE SE TECLEA, NO EL VALOR MULTIPLICADO ────────
  //
  // La primera versión guardaba en `monto` el valor YA multiplicado y lo
  // volvía a dividir para pintarlo. Eso monta un bucle: cada tecla se
  // multiplica otra vez sobre lo anterior. Tecleando «40500» salía
  // **$40.500.000**, el pago no pasaba la validación y al cobrador se le
  // «devolvía» la pantalla sin decir por qué. Lo reportó un cliente en vivo.
  //
  //   tecla 4 -> 4.000     tecla 5 -> 405.000
  //   tecla 0 -> 40.000    tecla 0 -> 4.050.000    tecla 0 -> 40.500.000
  //
  // Ahora `montoTecleado` es LITERALMENTE lo que hay en el campo, y la
  // multiplicación se hace UNA sola vez, al enviar (`montoReal`). Es como lo
  // hace `MoneyInput`, que nunca tuvo este fallo.
  //
  // `monto` sigue en pesos reales porque los atajos («Cuota», «Todo», «Al
  // día») lo fijan con la cifra de verdad; al tocarlos se refleja convertido.
  const [montoTecleado, setMontoTecleado] = useState(null)
  // Los atajos y los efectos fijan `monto` con la cifra REAL. Al hacerlo hay
  // que olvidar lo tecleado, o el campo seguiría pintando el texto viejo.
  const fijarMonto = (v) => { setMontoTecleado(null); setMonto(v) }
  const verMonto = (v) => (
    montoTecleado != null
      ? montoParaMostrar(montoTecleado, undefined)
      : montoParaMostrarConModo(v, modoAbreviado, undefined)
  )
  const leerMonto = (v) => {
    const crudo = montoCrudo(v)
    setMontoTecleado(crudo)
    // Lo que se guarda SÍ va en pesos reales: es lo que se envía y lo que leen
    // el resumen, los avisos de tope y la proyección de «después de este pago».
    return montoCrudoConModo(crudo, modoAbreviado)
  }
  const [tipo,         setTipo]         = useState('completo')
  const [metodoPago,   setMetodoPago]   = useState('efectivo')
  const [plataforma,   setPlataforma]   = useState('')
  const [metodoPagoId, setMetodoPagoId] = useState(null)
  const [metodosPago,  setMetodosPago]  = useState([])
  const [nota,         setNota]         = useState('')
  // LO RARO VA PLEGADO. Esta es la hoja de T02-04/T08-01: monto, a qué se aplica,
  // cómo pagó, y qué queda después. Recargo, descuento y abono por días viven
  // detrás de una línea, y al abrirla se cae al formulario completo de siempre —el
  // que ya sabe hacer todo eso y lleva tiempo probado en la calle.
  //
  // NO SE REESCRIBE EL MOTOR. Este archivo tiene la cola offline, el recibo por
  // WhatsApp, la foto de evidencia, las coordenadas y el aviso de duplicado. Piel
  // nueva, motor igual: rehacer de cero 1.058 líneas que ESCRIBEN PAGOS para
  // cambiar cómo se ve es la forma más rápida de perder un cobro en el campo.
  const [verFormularioCompleto, setVerFormularioCompleto] = useState(false)
  /* «Cobrar el interés y aplazar el cobro» — el interruptor de la hoja de pago.
     Encendido por defecto; la explicación de por qué está junto a `puedeAplazar`,
     donde se pinta.

     ⚠ VIVE AQUÍ ARRIBA Y NO JUNTO A SU INTERRUPTOR. Este componente tiene dos
     `return` a media función —los del comprobante—, así que un hook declarado
     después de ellos se deja de ejecutar en cuanto el pago se guarda. Eso es
     exactamente lo que tiró la pantalla el 16 ago 2026. Todos los hooks de este
     archivo van en este bloque, antes del primer `return`. */
  const [aplazar, setAplazar] = useState(true)
  // Encendido por defecto, como lo dibuja la lámina, y RECORDADO: un cobrador que
  // lo apaga no quiere apagarlo cliente por cliente.
  const [enviarRecibo, setEnviarRecibo] = useState(true)
  useEffect(() => {
    try {
      const guardado = localStorage.getItem('cf:recibo-al-confirmar')
      if (guardado !== null) setEnviarRecibo(guardado === '1')
    } catch {}
  }, [])
  const cambiarRecibo = (valor) => {
    setEnviarRecibo(valor)
    try { localStorage.setItem('cf:recibo-al-confirmar', valor ? '1' : '0') } catch {}
  }
  const [diasAbonados, setDiasAbonados] = useState(null)
  // La hoja de «Abonar por días». Antes este enlace mandaba al FORMULARIO VIEJO
  // entero —con sus seis tipos de pago— porque el deslizador solo vivía allí.
  // Ahora es una hoja propia que hace una sola cosa: convertir días en plata.
  const [verAbonoDias, setVerAbonoDias] = useState(false)
  // Valor visual del slider — se anima entre cambios para que las transiciones
  // (boton mora, ponerse al dia) se sientan fluidas en vez de saltar de golpe.
  const [sliderVisual, setSliderVisual] = useState(1)
  const sliderAnimRef = useRef(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [exitoso,      setExitoso]      = useState(false)
  const [pagoGuardado, setPagoGuardado] = useState(null)
  const [prestamoAct,  setPrestamoAct]  = useState(null)
  const [fotoEvidencia, setFotoEvidencia] = useState(null)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [vistaComprobante, setVistaComprobante] = useState(false)
  const [modalWA, setModalWA] = useState(false)
  const [camposLocal, setCamposLocal] = useState(camposRecibo)
  const [editandoCampos, setEditandoCampos] = useState(false)
  const fotoInputRef = useRef(null)
  const prevOpenRef = useRef(false)

  useEffect(() => {
    const wasOpen = prevOpenRef.current
    prevOpenRef.current = open
    if (!open) return
    // Solo resetear campos al ABRIR el modal (transicion false→true).
    // Si ya estaba abierto y cambia saldoPendiente/cuotaDiaria por un
    // rerender del padre, NO pisar el monto que el usuario escribio.
    if (wasOpen) return

    // El pliegue se reinicia AL ABRIR. Sin esto, quien toca una vez «Recargo,
    // descuento y abono por días» se queda en el formulario viejo para siempre: la
    // hoja nueva no se vuelve a ver en esa sesión.
    // Los tipos que YA TIENEN hoja propia arrancan en la hoja. Cuando solo la
    // tenia el pago, esto era `tabInicial !== 'pago'`, y al darles hoja a recargo y
    // descuento seguia mandandolos al formulario viejo: la hoja nueva no se veia
    // NUNCA. Lo caze abriendola en la app, no con una prueba.
    // Y volvio a pasar con `capital` e `intereses`: entrar por el boton de
    // «Abono a capital» abria el formulario viejo aunque la hoja ya supiera
    // pintarlos. Cada tipo que gana hoja hay que anadirlo AQUI tambien.
    setVerFormularioCompleto(!['pago', 'recargo', 'descuento', 'capital', 'intereses'].includes(tabInicial))

    if (tabInicial === 'recargo' || tabInicial === 'descuento') {
      fijarMonto('')
      setTipo(tabInicial)
      setNota('')
      setDiasAbonados(null)
      setSliderVisual(1)
      setError('')
      return
    }
    if (tabInicial === 'capital') {
      fijarMonto('')
      setTipo('capital')
      setNota('')
      setDiasAbonados(null)
      setSliderVisual(1)
      setError('')
      return
    }
    if (tabInicial === 'intereses') {
      const interesesPend = prestamo?.cuotasAmortizacion
        ?.filter(f => new Date(f.fechaEsperada) <= new Date() && (f.pagado || 0) < f.cuotaTotal)
        ?.reduce((acc, f) => acc + Math.max(0, f.interes - (f.interesPagado || 0)), 0) ?? 0
      setMonto(String(Math.round(interesesPend)))
      setTipo('intereses')
      setNota('')
      setDiasAbonados(null)
      setSliderVisual(1)
      setError('')
      return
    }

    const montoBase = Math.min(Math.round(cuotaDiaria ?? 0), Math.round(saldoPendiente ?? 0))
    const montoPreset = Number(presetPago?.monto)
    const montoFinal = montoPreset > 0
      ? Math.min(Math.round(montoPreset), Math.round(saldoPendiente ?? 0))
      : montoBase

    fijarMonto(String(montoFinal))
    setTipo(presetPago?.tipo ?? (montoFinal >= montoBase ? 'completo' : 'parcial'))
    const cuota = Math.max(1, Math.round(cuotaDiaria ?? 1))
    const diasCalc = montoPreset > 0 ? Math.min(30, Math.max(1, Math.round(montoFinal / cuota))) : null
    setDiasAbonados(diasCalc)
    setSliderVisual(diasCalc ?? 1)
    setError('')
    setVistaComprobante(false)
    setEditandoCampos(false)
    setCamposLocal(camposRecibo)
  }, [open, presetPago, cuotaDiaria, saldoPendiente, tabInicial])

  // Animacion del slider visual: cuando diasAbonados cambia (por boton de mora,
  // ponerse al dia o snap), interpola gradualmente desde el valor visual actual
  // hasta el nuevo. Si el cambio viene del propio drag del slider, va instantaneo.
  useEffect(() => {
    const target = diasAbonados ?? 1
    const from = sliderVisual
    if (from === target) return
    // Si la diferencia es 1, no animar (es el drag manual)
    if (Math.abs(target - from) <= 1) {
      setSliderVisual(target)
      return
    }
    // Animar con requestAnimationFrame
    if (sliderAnimRef.current) cancelAnimationFrame(sliderAnimRef.current)
    const start = performance.now()
    const duration = 350
    const tick = (now) => {
      const elapsed = now - start
      const progress = Math.min(1, elapsed / duration)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = from + (target - from) * eased
      setSliderVisual(progress >= 1 ? target : current)
      if (progress < 1) sliderAnimRef.current = requestAnimationFrame(tick)
    }
    sliderAnimRef.current = requestAnimationFrame(tick)
    return () => {
      if (sliderAnimRef.current) cancelAnimationFrame(sliderAnimRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diasAbonados])

  useEffect(() => {
    fetch('/api/metodos-pago').then(r => r.ok ? r.json() : []).then(setMetodosPago).catch(() => {})
  }, [])

  const handleSubmit = async ({ confirmarDuplicado = false } = {}) => {
    let m = Number(monto)
    if (!m || m <= 0) { setError('Ingresa un monto válido'); return }
    // Nota obligatoria para recargo y descuento (auditoria).
    if ((tipo === 'recargo' || tipo === 'descuento') && !nota.trim()) {
      setError('El motivo es obligatorio para recargo y descuento')
      return
    }
    // Descuento: validacion preventiva — no exceder espacio disponible.
    if (tipo === 'descuento') {
      const totalPag = Number(prestamo?.totalPagado || 0)
      const totalAP = Number(prestamo?.totalAPagar || 0)
      const espacioDescuento = Math.max(0, totalAP - totalPag)
      if (m > espacioDescuento) {
        setError(`Máximo permitido: ${formatMoney(espacioDescuento)} (no puede exceder lo no pagado).`)
        return
      }
    }
    // Limitar al saldo en lugar de bloquear (permite cobrar saldos pequeños)
    // Excepcion: recargo NO se limita (suma al saldo) y descuento ya valido arriba.
    if (tipo !== 'recargo' && tipo !== 'descuento' && m > saldoPendiente) {
      m = Math.round(saldoPendiente)
    }

    setLoading(true)
    setError('')

    // Geolocalizacion del cobro (MVP). No bloquea si falla: timeout corto,
    // si el usuario nego permiso o el GPS no responde -> coords = null.
    // Solo se pide para pagos reales, no para ajustes (recargo/descuento) que
    // los hace el owner desde el detalle del prestamo, no en campo.
    const necesitaGeo = !['recargo', 'descuento'].includes(tipo)
    const coords = necesitaGeo ? await obtenerCoordsRapido() : null

    // Fix #6: helper para encolar offline — usado tanto en catch de red como en 503 del SW
    const encolarOffline = async () => {
      try {
        await guardarPagoPendiente({
          prestamoId,
          montoPagado: m,
          tipo,
          nota,
          diasAbonados,
          metodoPago,
          plataforma,
          clienteNombre: cliente?.nombre,
          // Las coords viajan con el pago cuando sincronice.
          ...(coords ?? {}),
        })
        await actualizarPrestamoOffline(prestamoId, { montoPagado: m, tipo, nota })
        window.dispatchEvent(new Event('paymentQueued'))
        const saldoNuevo = Math.max(0, (prestamo?.saldoPendiente || 0) - m)
        const totalPagadoNuevo = (prestamo?.totalPagado || 0) + m
        const porcentajeNuevo = prestamo?.totalAPagar > 0
          ? Math.round((totalPagadoNuevo / prestamo.totalAPagar) * 100)
          : 0
        const prestamoActualizado = prestamo ? {
          ...prestamo,
          saldoPendiente: saldoNuevo,
          totalPagado: totalPagadoNuevo,
          porcentajePagado: porcentajeNuevo,
          pagoHoy: true,
          estado: saldoNuevo <= 0 ? 'completado' : prestamo.estado,
        } : prestamo
        const pagoOffline = { montoPagado: m, fechaPago: new Date().toISOString(), offline: true }
        setPagoGuardado(pagoOffline)
        setPrestamoAct(prestamoActualizado)
        setExitoso(true)
        setError('')
        onSuccess?.(prestamoActualizado, pagoOffline)
        return true
      } catch {
        setError('No se pudo guardar el pago offline.')
        return false
      }
    }

    try {
      const qs = confirmarDuplicado ? '?confirmarDuplicado=1' : ''
      const res  = await fetch(`/api/prestamos/${prestamoId}/pagos${qs}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ montoPagado: m, tipo, nota, diasAbonados, metodoPago, ...(metodoPagoId ? { metodoPagoId } : {}), plataforma, ...(coords ?? {}), ...(puedeAplazar && aplazar ? { aplazarUnPeriodo: true } : {}) }),
      })
      // Fix #6: el Service Worker puede responder 503 cuando no hay red en vez
      // de dejar fallar el fetch. Tratarlo igual que offline.
      if (res.status === 503 && !navigator.onLine) {
        await encolarOffline()
        return
      }
      const data = await res.json()
      if (res.status === 409 && data?.duplicado) {
        setLoading(false)
        const hace = Math.round((Date.now() - new Date(data.pagoReciente.fechaPago).getTime()) / 1000)
        const ok = window.confirm(
          `Ya se registró un pago idéntico hace ${hace}s.\n\n¿Confirmas que este es un pago adicional y no un duplicado?`
        )
        if (ok) {
          return handleSubmit({ confirmarDuplicado: true })
        }
        return
      }
      if (!res.ok) { setError(data.error ?? 'Error al registrar el pago'); return }

      const pagoId = data.pagos?.[0]?.id ?? null
      const pagoParaWA = { id: pagoId, montoPagado: m, fechaPago: new Date().toISOString(), metodoPago, plataforma }
      setPagoGuardado(pagoParaWA)
      setPrestamoAct(data)
      setExitoso(true)
      onSuccess?.(data, pagoParaWA)
    } catch {
      // Si el fetch se cayo, el pago se encola SIEMPRE. Antes esto dependia de
      // navigator.onLine, que solo dice si hay interfaz de red, no si hay
      // internet: con una barra de senal, EDGE o portal cautivo devuelve true,
      // el fetch falla igual, y el cobrador perdia una cuota que ya tenia en el
      // bolsillo. Encolar de mas es inofensivo (el servidor deduplica); encolar
      // de menos es plata perdida.
      try {
        await encolarOffline()
        return
      } catch {
        setError('No se pudo guardar el pago. Intenta de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  const guardarCamposCliente = async (campos) => {
    if (!cliente?.id) return
    setCamposLocal(campos)
    try {
      await fetch(`/api/clientes/${cliente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camposRecibo: campos }),
      })
    } catch {}
  }

  const subirFotoEvidencia = async (file) => {
    if (!pagoGuardado?.id || subiendoFoto) return
    setSubiendoFoto(true)
    try {
      const fd = new FormData()
      fd.append('foto', file)
      const res = await fetch(`/api/pagos/${pagoGuardado.id}/foto`, { method: 'POST', body: fd })
      if (res.ok) {
        const { fotoUrl } = await res.json()
        setFotoEvidencia(fotoUrl)
      }
    } catch {} finally {
      setSubiendoFoto(false)
    }
  }

  const handleCerrar = () => {
    setExitoso(false)
    setPagoGuardado(null)
    setPrestamoAct(null)
    setFotoEvidencia(null)
    setMonto(String(Math.min(Math.round(cuotaDiaria ?? 0), Math.round(saldoPendiente ?? 0))))
    setTipo('completo')
    setMetodoPago('efectivo')
    setPlataforma('')
    setNota('')
    setDiasAbonados(null)
    setError('')
    onClose?.()
  }

  const handleAbonoDias = (dias) => {
    const montoAbono = Math.min(Math.round(cuotaDiaria * dias), Math.round(saldoPendiente ?? 0))
    fijarMonto(String(montoAbono))
    setDiasAbonados(dias)
    setError('')
  }

  // ── Lógica siguiente cliente en ruta ────────────────────────
  const getNextInRuta = () => {
    if (!rutaNav || !cliente) return null
    const idx = rutaNav.clientes.findIndex(c => c.id === cliente.id)
    if (idx < 0) return null
    const isLast = idx >= rutaNav.clientes.length - 1
    return { idx, isLast, next: isLast ? null : rutaNav.clientes[idx + 1] }
  }

  const navigateNextInRuta = () => {
    const info = getNextInRuta()
    if (!info) return
    const getDate = () => new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const getRutaCobroUrl = (clienteRuta) => {
      const prestamosIds = Array.isArray(clienteRuta?.prestamosActivosIds)
        ? clienteRuta.prestamosActivosIds.filter(Boolean)
        : (clienteRuta?.prestamoActivo ? [clienteRuta.prestamoActivo] : [])

      if (prestamosIds.length === 1) {
        return `/prestamos/${prestamosIds[0]}?openPago=1&fromRuta=1`
      }
      return `/clientes/${clienteRuta.id}`
    }

    if (info.isLast) {
      sessionStorage.removeItem('cf-ruta-nav')
      const url = `/rutas/${rutaNav.rutaId}`
      navigator.onLine ? router.push(url) : (window.location.href = url)
    } else {
      const newNav = { ...rutaNav, currentIndex: info.idx + 1 }
      sessionStorage.setItem('cf-ruta-nav', JSON.stringify(newNav))
      localStorage.setItem(`cf-ruta-progress-${rutaNav.rutaId}`, JSON.stringify({
        clienteId: info.next.id, clienteNombre: info.next.nombre, index: info.idx + 1, date: getDate(),
      }))
      const url = getRutaCobroUrl(info.next)
      navigator.onLine ? router.push(url) : (window.location.href = url)
    }
  }

  // EL INTERRUPTOR HACE LO QUE DICE. Lo había dejado como estado y nada lo
  // consumía: un control que se mueve y no pasa nada, que es el patrón que ya
  // llevaba siete apariciones en este rediseño (el FAB, la campana, las props de la
  // barra lateral, `sinMargen`, mis propios enlaces de filtro, la barra de acción de
  // la ficha, el aviso de la tabla).
  //
  // Lo que hace es ABRIR EL BORRADOR del recibo, el mismo que arma el botón «Enviar
  // por WhatsApp» de la pantalla de éxito. No envía nada: quien pulsa enviar es el
  // usuario, dentro de WhatsApp. Y solo con teléfono y en un pago de verdad —de un
  // recargo no se manda recibo, porque no hubo cobro.
  const reciboDisparadoRef = useRef(false)
  useEffect(() => {
    if (!exitoso || !pagoGuardado) { reciboDisparadoRef.current = false; return }
    if (reciboDisparadoRef.current) return
    if (!enviarRecibo) return
    if (!cliente?.telefono) return
    if (['recargo', 'descuento'].includes(pagoGuardado.tipo)) return
    reciboDisparadoRef.current = true
    const tel = formatearTelefono(cliente.telefono)
    if (!tel) return
    const texto = generarTextoPlantilla('pago_confirmacion', {
      cliente, prestamo: prestamoAct ?? prestamo, pago: pagoGuardado,
      orgNombre, ocultarSaldo: ocultarSaldoWA, camposRecibo: camposLocal,
    }, organizationId)
    abrirWhatsApp(`https://wa.me/${tel}?text=${encodeURIComponent(texto)}`)
  }, [exitoso, pagoGuardado, enviarRecibo, cliente, prestamoAct, prestamo,
      orgNombre, ocultarSaldoWA, camposLocal, organizationId])

  // ── Vista comprobante (segundo paso desde éxito) ──────────────
  if (exitoso && pagoGuardado && vistaComprobante) {
    const prestamoWA = prestamoAct ?? prestamo

    return (
      <Modal
        open={open}
        onClose={() => setVistaComprobante(false)}
        title="Generar comprobante"
      >
        <div className="space-y-4">
          <p className="text-xs text-[var(--cf-ink-3)]">
            Selecciona los campos que aparecen en el comprobante impreso de este cliente.
          </p>

          <ChecklistCamposRecibo
            campos={camposLocal}
            onChange={(newCampos) => guardarCamposCliente(newCampos)}
          />

          <div className="pt-2 border-t border-[var(--cf-border)] flex gap-2">
            <BotonCompartirRecibo cliente={cliente} prestamo={prestamoWA} pago={pagoGuardado} orgNombre={orgNombre} camposRecibo={camposLocal} label="Compartir" />
            <BotonImprimirRecibo cliente={cliente} prestamo={prestamoWA} pago={pagoGuardado} orgNombre={orgNombre} camposRecibo={camposLocal} />
          </div>
        </div>
      </Modal>
    )
  }

  // ══ EL COMPROBANTE, UNO SOLO PARA LOS TRES CAMINOS ═════════════════════════
  //
  // Aquí había una versión escrita a mano, y en el cobro desde la ruta salía
  // `components/pantallas/Recibo`. El dueño lo reportó: «el modal de pago
  // registrado es diferente en varios lugares… necesito consistencia y no tener
  // dos modales de pago registrado».
  //
  // La migración a las pantallas del rediseño ya se había hecho para la CAPTURA
  // del pago (`RegistrarCobro`, `AbonoPorDias`, `Gestion`) y se quedó a medias:
  // la pantalla de éxito nunca se cambió. Es el mismo desajuste que ya se
  // corrigió con Recargo/Descuento (ver `prestamos/[id]/page.jsx:2202`), donde
  // «se pulsaba una fila del menú rediseñado y encima aparecía la pantalla
  // vieja».
  //
  // ⚠ LO QUE LA VIEJA HACÍA Y LA NUEVA NO. Se llevaron las cuatro al `Recibo`,
  // porque un rediseño que se lleva funciones por delante ya rompió una vez el
  // modo abreviado sin que nadie se enterara:
  //
  //   · el título por tipo — un recargo no es «Pago registrado»
  //   · el aviso de guardado sin señal — con visto verde, el cobrador cree que
  //     ya subió; es el más importante de los cuatro
  //   · el medio de pago — desde que la caja se discrimina por Nequi/efectivo,
  //     es lo que ata el recibo con el cuadre
  //   · la foto de evidencia
  //
  // Lo que NO se lleva: la tarjeta de «Cuota N de M / Saldo / Progreso». El
  // saldo ya está dentro del troquelado del `Recibo` y el resto es información
  // del préstamo, que está a un toque en su ficha — repetirla aquí era llenar el
  // comprobante de cosas que el cliente no se lleva.
  if (exitoso && pagoGuardado) {
    const prestamoWA = prestamoAct ?? prestamo
    const rutaInfo = getNextInRuta()
    const off = Boolean(pagoGuardado.offline)

    // «Efectivo» o «Transferencia · Nequi». En un recargo o un descuento no hay
    // medio: no entró ni salió dinero.
    const medioPago = (!off && !['recargo', 'descuento'].includes(tipo) && pagoGuardado.metodoPago)
      ? (pagoGuardado.metodoPago === 'transferencia'
          ? (pagoGuardado.plataforma ? `Transferencia · ${pagoGuardado.plataforma}` : 'Transferencia')
          : 'Efectivo')
      : null

    /* A PANTALLA COMPLETA, no dentro del `Modal` genérico. El `Recibo` ya trae
       su propia cabecera y su botonera, así que el `Modal` le pondría un título
       encima del suyo y un pie debajo del suyo. Y es como se monta en la ruta
       (`rutas/[id]/page.jsx:1527`), que es justo la mitad que se veía bien: si
       uno sale a pantalla completa y el otro en una ventanita, siguen siendo dos
       pantallas distintas aunque compartan componente.

       `--cf-surface`, no `--cf-bg`: ese token NO EXISTE, y un nombre inventado
       no da error — la capa sale transparente. Lo caza `tokens-existen`. */
    if (!open || typeof document === 'undefined') return null

    return createPortal(
      <div data-recibo="1" style={{
        position: 'fixed', inset: 0, zIndex: 10002,
        background: 'var(--cf-surface)', overflowY: 'auto',
      }}>
        <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
          <Recibo
            /* `capital` e `intereses` se alcanzan desde el propio «¿A qué se
               aplica?» de la hoja. `recargo` y `descuento` HOY NO llegan aquí
               —la ficha los abre por `Gestion.jsx` con su propia hoja, ver
               `prestamos/[id]/page.jsx:941`—, pero el componente sigue
               aceptando `tabInicial='recargo'`, así que las dos ramas se quedan:
               el día que alguien vuelva a entrar por ahí, el comprobante no
               dirá «Pago registrado» de un recargo. */
            titulo={
              tipo === 'recargo' ? 'Recargo aplicado' :
              tipo === 'descuento' ? 'Descuento aplicado' :
              tipo === 'capital' ? 'Abono a capital' :
              tipo === 'intereses' ? 'Pago de interés' :
              'Pago registrado'
            }
            offline={off}
            monto={formatMoney(pagoGuardado.montoPagado)}
            cliente={cliente?.nombre ?? '—'}
            medioPago={medioPago}
            saldo={prestamoWA?.saldoPendiente != null
              ? formatMoney(Math.round(prestamoWA.saldoPendiente)) : null}
            proximoCobro={prestamoWA?.proximoCobro
              ? formatFechaCobroRelativa(prestamoWA.proximoCobro) : null}
            negocio={orgNombre}
            cuando={new Date().toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}
            telefono={cliente?.telefono ?? null}
            /* La misma barra que ya salía aquí: la cifra viene de la foto de
               `sessionStorage`, así que hay que SUMARLE el pago recién hecho o
               la barra se queda atrás justo en el cobro que se está mirando. */
            progresoDia={(rutaNav?.esperadoHoy > 0 && !off && !['recargo', 'descuento'].includes(tipo))
              ? (() => {
                  const llevo = Math.round((rutaNav.recaudadoHoy ?? 0) + (pagoGuardado.montoPagado ?? 0))
                  const meta = Math.round(rutaNav.esperadoHoy)
                  return {
                    texto: `${formatMoney(llevo)} de ${formatMoney(meta)}`,
                    porcentaje: Math.max(2, Math.min(100, Math.round((llevo / meta) * 100))),
                  }
                })()
              : null}
            /* Sin `id` en el servidor no hay dónde colgar la foto, así que el
               pago guardado sin señal no la ofrece. */
            evidencia={(pagoGuardado?.id && !off) ? {
              url: fotoEvidencia,
              subiendo: subiendoFoto,
              onAdjuntar: () => fotoInputRef.current?.click(),
            } : null}
            onWhatsApp={() => setModalWA(true)}
            /* Los dos hacen la acción de verdad, no abren un paso intermedio. El
               checklist de «qué campos salen en el impreso» sigue existiendo,
               pero es configuración del cliente y no tiene por qué interponerse
               cada vez que alguien quiere el papel. */
            onGuardarImagen={() => guardarReciboImagen({
              cliente, prestamo: prestamoWA, pago: pagoGuardado, orgNombre, camposRecibo: camposLocal,
            })}
            onImprimir={() => imprimirRecibo({
              cliente, prestamo: prestamoWA, pago: pagoGuardado, orgNombre, camposRecibo: camposLocal,
            })}
            onSiguiente={rutaInfo ? navigateNextInRuta : null}
            siguienteNombre={rutaInfo && !rutaInfo.isLast ? rutaInfo.next?.nombre : null}
            onCerrar={handleCerrar}
          />
        </div>

        <input
          ref={fotoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) subirFotoEvidencia(f)
            e.target.value = ''
          }}
        />

        <HojaWhatsApp
          open={modalWA}
          onClose={() => setModalWA(false)}
          cliente={cliente}
          prestamo={prestamoWA}
          pago={pagoGuardado}
          orgNombre={orgNombre}
          ocultarSaldo={ocultarSaldoWA}
          organizationId={organizationId}
          camposRecibo={camposLocal}
        />
      </div>,
      document.body,
    )
  }

  // «cuota 13 de 24». Dice A QUIÉN se le cobra y por dónde va: con la ficha tapada
  // detrás de la hoja, sin esto el cobrador teclea a ciegas.
  const contextoCuota = (() => {
    const porPeriodo = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }[prestamo?.frecuencia] ?? 1
    const total = prestamo?.cuotasAmortizacion?.length
      || (prestamo?.diasPlazo ? Math.round(prestamo.diasPlazo / porPeriodo) : 0)
    const pendientes = Number(prestamo?.cuotasPendientes ?? 0)
    if (!(total > 0) || !(pendientes > 0) || pendientes > total) return null
    return `cuota ${total - pendientes + 1} de ${total}`
  })()

  // ¿En ESTE préstamo el pago de interés sube la deuda? Es la pregunta que
  // separa «paga lo que ya debía» de «compra tiempo», y de ella cuelgan el
  // texto de la hoja, la proyección del saldo y lo que hace el servidor.
  //
  // La hoja siempre recibe el préstamo con `cuotasAmortizacion` cargadas (la
  // ficha las incluye), así que el guardia de `elInteresSubeLaDeuda` no salta.
  const subeLaDeuda = elInteresSubeLaDeuda(prestamo ?? {})

  /* ══ COBRAR EL INTERÉS Y APLAZAR, EN EL MISMO GESTO ══════════════════════
   *
   * «Yo tengo clientes que en la quincena no me pueden dar la cuota, pero me
   *  dan el interés. Lo que hago es recibir el interés hoy y la cuota queda
   *  para la próxima quincena, pero sigue siendo igual.»
   *   — un prestamista, 16 ago 2026, explicando por qué seguía en Excel.
   *
   * El cobro del interés ya hacía su parte —la cuota no baja y la deuda sube—
   * pero mover la fecha era irse a otra pantalla. Aquí se ofrece en el mismo
   * sitio, y el servidor hace las dos cosas en la misma petición: si se hiciera
   * en dos, la segunda podía fallar y dejar el interés cobrado sin el aplazo.
   *
   * ⚠ ENCENDIDO POR DEFECTO, PERO A LA VISTA Y CON LA FECHA ESCRITA. Cobrar
   *   solo el interés en modo clásico ES comprar tiempo: si no se aplaza, el
   *   cliente aparece debiendo mañana lo mismo que hoy. Se apaga con un toque
   *   para el caso contrario —«me paga el interés y mañana trae la cuota»—.
   *
   * ⚠ SOLO donde el interés sube la deuda. Con tabla de amortización el interés
   *   ya estaba pactado y aplazar movería un calendario que nadie renegoció. */
  /* ⚠ `aplazar` NO SE DECLARA AQUÍ: es un hook y arriba hay dos salidas.
   *
   * Estaba en esta línea y rompía la pantalla justo al guardar el pago.
   * Reportado el 16 ago 2026: «estoy tratando de pasar los pagos y no se le va
   * el comprobante al cliente». Medido en producción: 15 caídas en una hora, en
   * 4 negocios, 4 usuarios y 3 clases de teléfono distintos.
   *
   * El orden es el fallo: mientras se escribe el pago, `exitoso` es falso y este
   * hook se ejecuta. Al guardarlo, `exitoso` pasa a true y el componente sale
   * ANTES por el `return` del comprobante (línea ~564), así que el hook ya no
   * corre. React cuenta un hook menos que en el render anterior y revienta con
   * el error #300 — y el prestamista ve la pantalla de «no podemos conectarnos»
   * EN LUGAR del recibo. El pago sí quedó guardado; lo que se cae es enseñarlo.
   *
   * La declaración se fue arriba con los demás `useState`. Aquí solo quedan los
   * valores derivados, que son cuentas y pueden ir donde sea. */
  const puedeAplazar = tipo === 'intereses' && subeLaDeuda && Boolean(prestamo?.proximoCobro)

  const fechaAplazada = puedeAplazar
    ? siguientePeriodo(prestamo.proximoCobro, prestamo?.frecuencia, prestamo?.diaCobroMes)
    : null

  // «¿A qué se aplica?» — las tres de la lámina.
  //
  // «Interés» SALE SIEMPRE desde el 2 ago 2026. Antes se escondía en cuota fija
  // con este argumento: «el interés ya viene dentro del total y no hay nada que
  // pagar por separado». La premisa era cierta y la conclusión no: en la calle el
  // cliente SÍ le paga a veces solo el interés, y el modo clásico son 2.886 de los
  // 5.134 préstamos vivos. El botón faltaba justo donde más se necesitaba.
  //
  // Lo que cambia es lo que SIGNIFICA, no si se puede:
  //   · CON tabla → paga el interés que ya debía. La deuda no sube.
  //   · SIN tabla → compra tiempo. El capital no baja y el total SUBE.
  // Lo decide `elInteresSubeLaDeuda`, y la hoja lo explica antes de confirmar.
  const aplicacionesDePago = [
    { id: 'completo', etiqueta: 'Cuota' },
    { id: 'capital', etiqueta: 'Capital' },
    { id: 'intereses', etiqueta: 'Interés' },
  ]

  // ── Vista formulario ──────────────────────────────────────────
  const tituloModal =
    tipo === 'recargo' ? 'Agregar recargo' :
    tipo === 'descuento' ? 'Aplicar descuento' :
    tipo === 'capital' ? 'Abono a capital' :
    // «Pago a intereses» describe el caso CON tabla: paga el interés que ya
    // debía. Sin tabla el título tiene que decir lo otro, que es lo que de
    // verdad pasa — el capital no baja y el préstamo se alarga.
    tipo === 'intereses' ? (subeLaDeuda ? 'Solo interés' : 'Pago a intereses') :
    'Registrar pago'
  const labelBoton =
    tipo === 'recargo' ? 'Aplicar recargo' :
    tipo === 'descuento' ? 'Aplicar descuento' :
    tipo === 'capital' ? 'Confirmar abono' :
    tipo === 'intereses' ? 'Confirmar pago' :
    'Confirmar pago'

  // Aviso de excedente: en modos simples (cuota fija/clasico) pagar mas que la
  // cuota adelanta cuotas SIN perdonar interes (el interes ya viene en el total).
  // Si el prestamista queria reducir capital, debe usar "A capital". El cliente
  // reporto que no podia distinguir el destino del excedente: este aviso lo hace
  // explicito y ofrece la eleccion. En modos con tabla la semantica es otra (no aplica).
  const esModoSimpleExcedente = !['lineal', 'lineal_dinamico', 'solo_interes', 'saldo'].includes(prestamo?.modoInteres)
  const cuotaRefExcedente = Math.round(cuotaDiaria ?? 0)
  const excedentePago = Math.round(Number(monto) || 0) - cuotaRefExcedente
  const mostrarAvisoExcedente =
    esModoSimpleExcedente &&
    (tipo === 'completo' || tipo === 'parcial') &&
    cuotaRefExcedente > 0 &&
    excedentePago > 100 &&
    Math.round(Number(monto) || 0) < Math.round(saldoPendiente ?? 0)

  // Lo que el formulario viejo explicaba en sus dos recuadros de color, para que
  // baje a la hoja. Es la única pieza que capital e interés tenían y la hoja no:
  // sin ella, «Capital» y «Cuota» se ven igual y nadie sabe qué cambia al elegir.
  // El ahorro en intereses se calcula IGUAL que en el formulario (era su única
  // cuenta propia); no se inventa nada nuevo.
  const explicacionAplicacion = (() => {
    if (tipo === 'capital') {
      const m = Math.round(Number(monto) || 0)
      let ahorro = null
      if (m > 0 && prestamo?.tasaInteres > 0 && prestamo?.fechaInicio) {
        const ahora = new Date(Date.now() - 5 * 60 * 60 * 1000)
        const diasTrans = Math.max(0, Math.floor((ahora - new Date(prestamo.fechaInicio)) / 86400000))
        const diasRest = Math.max(0, (prestamo.diasPlazo || 0) - diasTrans)
        ahorro = Math.round(m * (prestamo.tasaInteres / 100) * (diasRest / 30))
      }
      return {
        titulo: 'Abono a capital',
        texto: 'Reduce el capital y los intereses sobre ese monto. El préstamo termina antes.',
        cifra: ahorro > 0 ? { etiqueta: 'Ahorro en intereses', valor: formatMoney(ahorro) } : null,
      }
    }
    if (tipo === 'intereses') {
      // Las dos cosas que puede significar «me pagó el interés» son DISTINTAS y
      // el texto tiene que decir cuál es. Con la frase de la tabla en un préstamo
      // clásico, el prestamista leería «cubre las cuotas vencidas» y lo que de
      // verdad pasa es que la deuda SUBE. Eso no se puede descubrir después de
      // guardar.
      if (subeLaDeuda) {
        const m = Math.round(Number(monto) || 0)
        return {
          titulo: 'Le compra tiempo',
          texto: 'El capital NO baja: el cliente paga la ganancia y sigue debiendo lo mismo. '
            + 'El préstamo se alarga y ese interés es tuyo.',
          // El SALDO no se mueve —sube el total y baja lo pagado, en la misma
          // cantidad— así que enseñarlo no dice nada. Lo que cambia, y es lo que
          // el dueño quiere ver, es lo que se gana por la espera.
          cifra: m > 0 ? { etiqueta: 'Tu ganancia sube', valor: formatMoney(m) } : null,
        }
      }
      return {
        titulo: 'Pago a intereses',
        texto: 'Cubre solo los intereses de las cuotas vencidas. El capital queda pendiente pero no genera mora adicional.',
        cifra: null,
      }
    }
    return null
  })()

  // ── LAS HOJAS DE AJUSTE: T13-01 RECARGO Y T19-03 DESCUENTO ────────────────
  //
  // Mismo criterio que la hoja de pago: piel nueva, motor igual. El envío, la nota
  // obligatoria, el permiso de gestionar y la guardia de DESCUENTO_EXCESIVO siguen
  // siendo los de este archivo.
  //
  // El MOTIVO es obligatorio en los dos y ya lo era: se reutiliza `nota`, que es el
  // campo que el endpoint espera. Sin motivo no se puede confirmar, y eso se dice
  // apagando el botón en vez de dejar que el servidor lo rechace después.
  if ((tipo === 'recargo' || tipo === 'descuento') && !verFormularioCompleto) {
    const esRecargo = tipo === 'recargo'
    const montoNum = Math.round(Number(monto) || 0)
    const base = { ...(prestamo ?? {}), saldoPendiente, cuotaDiaria }
    const atajos = esRecargo ? atajosDeRecargo(base) : atajosDeDescuento(base)
    const atajoActivo = atajos.find((a) => a.monto === montoNum)?.id ?? null
    const datos = esRecargo ? adaptarRecargo(base, montoNum) : adaptarDescuento(base, montoNum)
    const sinMotivo = !nota.trim()
    // El tope del descuento se dice ANTES, no después de que el dueño le prometió el
    // perdón al cliente: el servidor lo rechaza con DESCUENTO_EXCESIVO.
    const pasaDelTope = !esRecargo && Boolean(datos?.excede)

    return (
      <HojaInferior
        abierta={open}
        onCerrar={onClose}
        titulo={esRecargo ? 'Recargo por mora' : 'Perdonarle una parte'}
        subtitulo={[
          cliente?.nombre,
          Number(prestamo?.diasMora ?? 0) > 0
            ? `lleva ${prestamo.diasMora} ${prestamo.diasMora === 1 ? 'día' : 'días'} de atraso`
            : null,
        ].filter(Boolean).join(' · ') || null}
        accion={
          <PieGestion
            onCancelar={onClose}
            onAceptar={handleSubmit}
            textoAceptar={montoNum > 0
              ? `${esRecargo ? 'Aplicar' : 'Perdonar'} ${formatMoney(montoNum)}`
              : (esRecargo ? 'Aplicar' : 'Perdonar')}
            aceptando={loading}
            deshabilitado={!(montoNum > 0) || sinMotivo || pasaDelTope}
            error={error || (pasaDelTope
              ? `No puedes perdonar más de ${formatMoney(datos.tope)}: es todo lo que queda por cobrar.`
              : sinMotivo && montoNum > 0 ? 'Escribe el motivo: queda en el historial.' : null)}
          />
        }
      >
        {esRecargo ? (
          <Recargo
            monto={verMonto(monto)}
            onMonto={(v) => setMonto(leerMonto(v))}
            atajos={atajos}
            atajoActivo={atajoActivo}
            onAtajo={(a) => { if (a.monto) fijarMonto(String(a.monto)) }}
            motivo={nota}
            onMotivo={setNota}
            {...(datos ?? {})}
          />
        ) : (
          <Descuento
            monto={verMonto(monto)}
            onMonto={(v) => setMonto(leerMonto(v))}
            atajos={atajos}
            atajoActivo={atajoActivo}
            onAtajo={(a) => { if (a.monto) fijarMonto(String(a.monto)) }}
            motivo={nota}
            onMotivo={setNota}
            {...(datos ?? {})}
          />
        )}
      </HojaInferior>
    )
  }

  // ── LA HOJA DE T02-04 / T08-01 ─────────────────────────────────────────────
  //
  // Es el camino del 90%: un pago normal. Lo RARO —recargo, descuento y abono por
  // días— sigue detrás del enlace, que es lo que dice el pie de la lámina.
  //
  // CAPITAL E INTERÉS NO SON «LO RARO». La hoja los ofrece como botones de primera
  // fila en «¿A qué se aplica?», y mandarlos al formulario viejo desmontaba la hoja
  // debajo del dedo: el dueño lo reportó como «cambia por el modal viejo». Un botón
  // de esta hoja tiene que resolverse EN esta hoja. Lo que el formulario viejo sabía
  // hacer y aquí faltaba —explicar a dónde va la plata y dejar apuntar el motivo—
  // baja con la hoja; el envío es el mismo `handleSubmit` de siempre.
  const esPagoNormal = tipo === 'completo' || tipo === 'parcial'
    || tipo === 'capital' || tipo === 'intereses'
  // ── EL ENLACE DICE LO QUE DE VERDAD ABRE ──
  // Decía «Recargo, descuento y abono por días» y abría el FORMULARIO
  // VIEJO, el de antes del rediseño. Reportado con captura: «abre el modal
  // viejo, creo que eso está mal».
  //
  // El recargo y el descuento YA tienen sus hojas nuevas —se llega por
  // «Gestión»—, así que nombrarlos aquí mandaba al sitio viejo por un camino
  // que ya existe mejor. Lo que NO se rehízo es el ABONO POR DÍAS: su
  // deslizador solo vive en ese formulario.
  //
  // El enlace se queda —quitarlo perdería el abono por días— pero deja de
  // prometer recargo y descuento.
  if (esPagoNormal && !verFormularioCompleto) {
    const medios = mediosParaHoja(metodosPago, (nombre) => getPlataformaInfo(nombre)?.color)
    // Qué casilla está marcada. En la DB `metodoPago` solo dice
    // efectivo/transferencia; la cuenta concreta la dice `metodoPagoId`. Son dos
    // campos y confundirlos descuadra la caja por cuenta.
    const medioElegido = metodoPago === 'transferencia' && metodoPagoId ? metodoPagoId : 'efectivo'
    const elegido = medioAGuardar(medios, medioElegido)

    const montoNum = Math.round(Number(monto) || 0)
    // `montoAlDia` y `cancelarHoy` los manda la pagina: el primero lo calcula
    // el servidor con los festivos de la organizacion, el segundo viene del
    // endpoint de liquidacion. Si no llegan, esos dos atajos no salen.
    //
    // Y SOLO EN UN COBRO NORMAL. Los tres —«Cuota», «Al día», «Cancelar hoy»—
    // responden a la pregunta de la cuota, y en un abono a capital ninguno
    // significa nada: la gracia del abono es que el dueño elige cuánto. Ofrecer
    // «Cuota» ahí sugiere una cifra que no es la del tipo elegido, y esta es la
    // pantalla donde una cifra sugerida termina cobrada.
    const conAtajos = tipo === 'completo' || tipo === 'parcial'
    const atajos = conAtajos
      ? atajosDeMonto({ saldoPendiente, cuotaDiaria, montoAlDia, cancelarHoy })
      : []
    const atajoActivo = atajos.find((a) => a.monto === montoNum)?.id ?? null

    const { filas } = adaptarDespuesDelPago(
      { ...(prestamo ?? {}), saldoPendiente, cuotaDiaria },
      {
        monto: montoNum,
        tipo,
        // Si el interés SUBE la deuda, el saldo no se mueve: entra la plata y a
        // la vez crece el total. El adaptador no puede saberlo solo.
        interesSubeLaDeuda: subeLaDeuda,
        metodoPago,
        nombreCuenta: elegido.nombreCuenta,
        // El próximo cobro se pinta TAL CUAL lo dio la API. No se recalcula aquí:
        // ya hay tres funciones que responden a esa pregunta y se contradicen.
        proximoCobroTexto: prestamo?.proximoCobro ? formatFechaCobroRelativa(prestamo.proximoCobro) : null,
        // Si la fecha ya pasó, la fila se calla. Con 58 días de mora `proximoCobro`
        // apunta al primer cobro impagado y salía «Próximo cobro: lun, 1 de jun» en
        // pleno julio, dentro del bloque que proyecta el futuro.
        proximoCobroFuturo: prestamo?.proximoCobro
          ? new Date(prestamo.proximoCobro).getTime() >= Date.now() - 86400000
          : false,
      },
    )

    // ── LO QUE NECESITA LA HOJA DE «ABONAR POR DÍAS» ──
    // `cuota × días`, con tope el saldo: pedir 30 días cuando quedan 12 no
    // puede proponer más de lo que se debe.
    const cuotaDia = Math.max(1, Math.round(cuotaDiaria ?? 1))
    const techo = Math.round(saldoPendiente ?? 0)
    const diasParaHoja = diasAbonados || 1
    const montoDeLosDias = Math.min(cuotaDia * diasParaHoja, techo)

    // Cuántos días representa un monto, para que el deslizador acompañe al
    // atajo en vez de quedarse en 1 mientras el monto dice otra cosa.
    const diasDeMonto = (m) => Math.min(30, Math.max(1, Math.round((Number(m) || 0) / cuotaDia)))

    const atajosDeDias = [
      Number(prestamo?.montoEnMora) > 0 && {
        id: 'mora', tono: 'mora', montoExacto: true,
        texto: Number(prestamo?.cuotasEnMora) > 0
          ? `Pagar mora · ${prestamo.cuotasEnMora} ${prestamo.cuotasEnMora === 1 ? 'cuota' : 'cuotas'}`
          : 'Pagar mora',
        monto: Math.min(Math.round(prestamo.montoEnMora), techo),
        dias: diasDeMonto(Math.min(Math.round(prestamo.montoEnMora), techo)),
      },
      Number(prestamo?.montoParaPonerseAlDia) > 0
        && Number(prestamo?.montoParaPonerseAlDia) !== Number(prestamo?.montoEnMora) && {
        id: 'aldia', montoExacto: true,
        texto: 'Ponerse al día',
        monto: Math.min(Math.round(prestamo.montoParaPonerseAlDia), techo),
        dias: diasDeMonto(Math.min(Math.round(prestamo.montoParaPonerseAlDia), techo)),
      },
    ].filter(Boolean)

    // Las próximas pendientes, solo en los modos que llevan tabla. El faltante
    // de una cuota no suele ser un número redondo de días: por eso se pone tal
    // cual en vez de pasarlo por el deslizador.
    const cuotasPendientesHoja = (
      ['lineal', 'lineal_dinamico', 'solo_interes'].includes(prestamo?.modoInteres)
        && Array.isArray(prestamo?.cuotasAmortizacion)
        ? [...prestamo.cuotasAmortizacion]
            .sort((a, b) => a.numeroPeriodo - b.numeroPeriodo)
            .filter((f) => (f.pagado || 0) < f.cuotaTotal)
            .slice(0, 3)
            .map((f) => ({
              id: f.numeroPeriodo,
              rotulo: `${({ diario: 'Día', semanal: 'Sem', quincenal: 'Qna', mensual: 'Mes' })[prestamo.frecuencia] || 'Per'} ${f.numeroPeriodo}`,
              monto: Math.round(Math.max(0, f.cuotaTotal - (f.pagado || 0))),
              vencida: Boolean(f.fechaEsperada && new Date(f.fechaEsperada) < new Date()),
              globo: prestamo.modoInteres === 'solo_interes' && f.numeroPeriodo === prestamo.cuotasAmortizacion.length,
            }))
        : []
    )

    return (
      <>
      <HojaInferior
        abierta={open}
        onCerrar={onClose}
        // El título lo decide el tipo, que ya lo sabía `tituloModal`: con
        // «Registrar pago» fijo, elegir «Capital» dejaba la hoja diciendo lo
        // mismo que antes de elegir y no había forma de saber qué se iba a hacer.
        titulo={tituloModal}
        subtitulo={[cliente?.nombre, contextoCuota].filter(Boolean).join(' · ') || null}
        accion={
          <PieRegistrarCobro
            // En un cobro normal es «Confirmar $27.500», tal cual la lámina. En
            // capital e interés el verbo importa —«Confirmar abono $50.000»—
            // porque es lo único que distingue lo que está a punto de pasar.
            textoConfirmar={(() => {
              const verbo = tipo === 'capital' ? 'Confirmar abono' : 'Confirmar'
              return montoNum > 0 ? `${verbo} ${formatMoney(montoNum)}` : verbo
            })()}
            onConfirmar={handleSubmit}
            confirmando={loading}
            deshabilitado={!(montoNum > 0)}
            error={error}
            recibo={enviarRecibo}
            onRecibo={cambiarRecibo}
          />
        }
      >
        <RegistrarCobro
          // Se VE agrupado y se GUARDA crudo: el estado va al servidor con
          // `Number(monto)`, y con puntos dentro eso daría NaN. El campo enseñaba
          // «20000», y con seis cifras seguidas —«1250000»— nadie distingue un
          // millón doscientos cincuenta mil de ciento veinticinco mil.
          monto={verMonto(monto)}
          onMonto={(v) => setMonto(leerMonto(v))}
          atajos={atajos}
          atajoActivo={atajoActivo}
          onAtajo={(a) => fijarMonto(String(a.monto))}
          aplicaciones={aplicacionesDePago}
          aplicacion={tipo}
          // La hoja NO se desmonta al cambiar de aplicación: las tres opciones
          // que pinta se resuelven aquí dentro.
          onAplicacion={(a) => {
            /* ⚠ AL PASAR A «INTERÉS» EL MONTO SE VACÍA, no se hereda la cuota.
               La hoja llega con la cuota puesta —$175.000— porque el caso normal
               es cobrarla. En «Solo interés» esa herencia es peligrosa: el
               bloque decía «Tu ganancia sube $175.000» y un toque de más subía
               la deuda esa cantidad, y ahora además aplazaría el cobro.

               Y contradecía lo que el propio servidor dice de este pago: «el
               monto lo pone el prestamista porque es lo que pactó con ESE
               cliente; adivinarlo sería inventar una cifra». Vaciarlo es
               obligar a escribir los $50.000 que se pactaron. */
            if (a.id === 'intereses' && subeLaDeuda) setMonto('')
            setTipo(a.id)
          }}
          explicacion={explicacionAplicacion}
          // La nota solo en capital e interés: en un cobro normal es un campo más
          // que estorba en la pantalla que se opera de pie.
          nota={nota}
          onNota={explicacionAplicacion ? setNota : undefined}
          medios={medios}
          medio={medioElegido}
          onMedio={(m) => {
            const g = medioAGuardar(medios, m.id)
            setMetodoPago(g.metodoPago)
            setMetodoPagoId(g.metodoPagoId)
            setPlataforma(g.nombreCuenta || '')
          }}
          extraExplicacion={puedeAplazar && fechaAplazada ? (
            <div style={{ marginTop: 9, paddingTop: 11, borderTop: '1px solid var(--cf-border)' }}>
              <FilaInterruptor
                etiqueta="Aplazar el próximo cobro"
                explicacion={`La cuota de ${formatMoney(Math.round(cuotaDiaria ?? 0))} queda para el ${formatFechaCobroRelativa(fechaAplazada)}. No cambia de monto.`}
                encendido={aplazar}
                onCambiar={setAplazar}
              />
            </div>
          ) : null}
          despues={filas}
          textoLoRaro="Abonar por días"
          onLoRaro={() => setVerAbonoDias(true)}
        />
        </HojaInferior>

        {/* ── ABONAR POR DÍAS ──
            Va FUERA de la hoja de cobro y con su propia `HojaInferior`, no
            dentro: dos hojas anidadas comparten el velo y el gesto de cerrar,
            y cerrar la de arriba se llevaba la de abajo. Se apila encima. */}
        <HojaInferior
          abierta={verAbonoDias}
          onCerrar={() => setVerAbonoDias(false)}
          titulo="Abonar por días"
          subtitulo={[cliente?.nombre, `cuota ${formatMoney(Math.round(cuotaDiaria ?? 0))}`].filter(Boolean).join(' · ')}
          accion={
            <PieRegistrarCobro
              // La cifra del botón sale de `monto`, NO de recalcular los días:
              // si se pulsó «Pagar mora» el monto es exacto ($47.300) y no un
              // múltiplo de la cuota. Recalcular aquí lo pisaría.
              textoConfirmar={montoNum > 0 ? `Poner ${formatMoney(montoNum)}` : 'Poner el monto'}
              onConfirmar={() => {
                // NO cobra: deja el monto puesto y devuelve a la hoja de cobro,
                // que es donde se elige el medio y se confirma. Cobrar desde
                // aquí saltaría la pregunta de «¿cómo te pagó?».
                setTipo(montoNum >= (cuotaDiaria ?? 0) ? 'completo' : 'parcial')
                setVerAbonoDias(false)
              }}
              deshabilitado={!(montoNum > 0)}
            />
          }
        >
          <AbonoPorDias
            dias={diasParaHoja}
            visual={sliderVisual}
            // Lo que hay escrito, por lo mismo que el botón: tras «Pagar mora»
            // la cifra es la de la mora, no `cuota × días`.
            monto={montoNum > 0 ? montoNum : montoDeLosDias}
            onDias={handleAbonoDias}
            atajos={atajosDeDias}
            // El monto del atajo es EXACTO (la mora son $47.300, no «7 días»).
            // El deslizador se mueve solo para acompañar, pero manda la cifra:
            // por eso se fija después de `handleAbonoDias`, que la redondearía
            // a días enteros.
            onAtajo={(a) => {
              handleAbonoDias(a.dias)
              fijarMonto(String(Math.round(a.monto)))
              setSliderVisual(a.dias)
            }}
            cuotas={cuotasPendientesHoja}
            onCuota={(c) => {
              fijarMonto(String(Math.round(c.monto)))
              setTipo(c.monto >= (cuotaDiaria ?? 0) ? 'completo' : 'parcial')
              setDiasAbonados(null)
              setVerAbonoDias(false)
            }}
          />
        </HojaInferior>
      </>
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tituloModal}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} loading={loading}>{labelBoton}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 bg-[var(--cf-red-pill-bg)] border border-[color-mix(in_srgb,var(--cf-red-dark)_30%,transparent)] text-[var(--cf-red-dark)] text-sm rounded-[10px] px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex justify-between items-center text-sm">
          <span className="text-[var(--cf-ink-3)]">Cuota</span>
          <span className="font-semibold text-[var(--cf-ink)] font-mono-display">{formatMoney(cuotaDiaria)}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-[var(--cf-ink-3)]">Saldo pendiente</span>
          <span className="font-semibold text-[var(--cf-ink)] font-mono-display">{formatMoney(saldoPendiente)}</span>
        </div>

        {/* Desglose de cuotas pendientes para modos con tabla de amortización */}
        {['lineal', 'lineal_dinamico', 'solo_interes'].includes(prestamo?.modoInteres) && prestamo?.cuotasAmortizacion?.length > 0 && (() => {
          const filas = [...prestamo.cuotasAmortizacion]
            .sort((a, b) => a.numeroPeriodo - b.numeroPeriodo)
            .filter(f => (f.pagado || 0) < f.cuotaTotal)
            .slice(0, 3)
          if (!filas.length) return null
          const totalFilas = prestamo.cuotasAmortizacion.length
          const LABEL_FREQ = { diario: 'Dia', semanal: 'Sem', quincenal: 'Qna', mensual: 'Mes' }
          const labelP = LABEL_FREQ[prestamo.frecuencia] || 'Per'
          return (
            <div className="rounded-[10px] border border-[var(--cf-border)] bg-[var(--cf-surface)] p-2.5 space-y-1.5">
              <p className="text-[10px] font-semibold text-[var(--cf-ink-3)] uppercase tracking-wide">
                Próximas cuotas pendientes
              </p>
              {filas.map(f => {
                const faltante = Math.round(Math.max(0, f.cuotaTotal - (f.pagado || 0)))
                const esBalloon = prestamo.modoInteres === 'solo_interes' && f.numeroPeriodo === totalFilas
                const vencida = f.fechaEsperada && new Date(f.fechaEsperada) < new Date()
                return (
                  <button
                    key={f.numeroPeriodo}
                    type="button"
                    onClick={() => {
                      fijarMonto(String(faltante))
                      setTipo(faltante >= (cuotaDiaria ?? 0) ? 'completo' : 'parcial')
                      setDiasAbonados(null)
                    }}
                    className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--cf-fill)] transition-colors text-left"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] font-medium" style={{ color: vencida ? 'var(--cf-red-dark)' : 'var(--cf-ink-3)' }}>
                        {labelP} {f.numeroPeriodo}
                      </span>
                      {esBalloon && (
                        <span className="text-[11px] font-bold px-1 py-px rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--cf-red-dark)' }}>
                          Globo
                        </span>
                      )}
                      {vencida && (
                        <span className="text-[11px] font-bold px-1 py-px rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--cf-red-dark)' }}>
                          Vencida
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-semibold font-mono-display" style={{ color: 'var(--cf-gold)' }}>
                      {formatMoney(faltante)}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })()}

        {/* Atajos para no recalcular mora / ponerse al dia manualmente.
            Al pulsar, calculamos cuantos dias equivale el monto y movemos
            tambien el slider de abono rapido para que el usuario vea visualmente
            el progreso. Si supera 30 dias (max del slider), se capea en 30. */}
        {tipo !== 'capital' && tipo !== 'recargo' && tipo !== 'descuento' && tipo !== 'intereses' && (() => {
          const cuota = Math.max(1, Math.round(cuotaDiaria ?? 1))
          const diasParaMonto = (m) => Math.min(30, Math.max(1, Math.round((Number(m) || 0) / cuota)))
          return (
          <div className="grid grid-cols-1 gap-2">
            {Number(prestamo?.montoEnMora) > 0 && (
              <button
                type="button"
                onClick={() => {
                  const montoFinal = Math.min(Math.round(prestamo.montoEnMora), Math.round(saldoPendiente ?? 0))
                  const dias = diasParaMonto(montoFinal)
                  fijarMonto(String(montoFinal))
                  setTipo('completo')
                  setDiasAbonados(dias)
                  setSliderVisual(dias)
                }}
                className="h-11 rounded-[12px] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] text-[var(--cf-red-dark)] text-sm font-semibold hover:bg-[rgba(239,68,68,0.15)] transition-colors"
              >
                Pagar mora
                {Number(prestamo?.cuotasEnMora) > 0 ? ` (${prestamo.cuotasEnMora} cuota${prestamo.cuotasEnMora === 1 ? '' : 's'})` : ''}
                {' · '}
                {formatMoney(prestamo.montoEnMora)}
              </button>
            )}

            {Number(prestamo?.montoParaPonerseAlDia) > 0 && Number(prestamo?.montoParaPonerseAlDia) !== Number(prestamo?.montoEnMora) && (
              <button
                type="button"
                onClick={() => {
                  const montoFinal = Math.min(Math.round(prestamo.montoParaPonerseAlDia), Math.round(saldoPendiente ?? 0))
                  const dias = diasParaMonto(montoFinal)
                  fijarMonto(String(montoFinal))
                  setTipo('completo')
                  setDiasAbonados(dias)
                  setSliderVisual(dias)
                }}
                className="h-11 rounded-[12px] border border-[rgba(245,197,24,0.3)] bg-[rgba(245,197,24,0.1)] text-[var(--cf-gold)] text-sm font-semibold hover:bg-[rgba(245,197,24,0.18)] transition-colors"
              >
                Ponerse al día · {formatMoney(prestamo.montoParaPonerseAlDia)}
              </button>
            )}
          </div>
          )
        })()}

        {/* Slider de abono rápido por días */}
        {tipo !== 'capital' && tipo !== 'recargo' && tipo !== 'descuento' && tipo !== 'intereses' && (() => {
          const val = diasAbonados || 1
          // Valor mostrado en el slider (puede ser fraccional durante la animacion)
          const visual = sliderVisual
          const SNAPS = [7, 15, 30]
          const isSnap = SNAPS.includes(val)
          const snapLabel = val === 7 ? '1 sem' : val === 15 ? 'Quinc.' : val === 30 ? '1 mes' : null
          const pctVisual = ((visual - 1) / 29 * 100)
          return (
          <div className="border-t border-[var(--cf-border)] pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-medium text-[var(--cf-ink-3)] uppercase tracking-[0.05em]">
                Abono rápido por días
              </p>
              {diasAbonados && (
                <span className={`text-sm font-bold font-mono-display transition-colors ${isSnap ? 'text-[var(--cf-gold)]' : 'text-[var(--cf-green-dark)]'}`}>
                  {diasAbonados} {diasAbonados === 1 ? 'día' : 'días'}
                  {snapLabel && <span className="text-[10px] font-normal text-[var(--cf-ink-3)] ml-1">({snapLabel})</span>}
                  {' — '}{formatMoney(Number(monto))}
                </span>
              )}
            </div>
            {/* Track visual + thumb animado. Usamos un contenedor relative con
                un track de fondo, fill animado y thumb posicionado por porcentaje.
                El input range nativo va encima invisible para capturar el drag. */}
            <div className="relative h-6 flex items-center select-none">
              {/* Track de fondo */}
              <div className="absolute inset-x-0 h-2 rounded-full" style={{ background: 'var(--cf-fill)' }} />
              {/* Fill verde animado */}
              <div
                className="absolute h-2 rounded-full"
                style={{
                  width: `${pctVisual}%`,
                  background: 'linear-gradient(to right, color-mix(in srgb, var(--cf-green-dark) 85%, black), var(--cf-green-dark))',
                  boxShadow: pctVisual > 5 ? '0 0 6px rgba(34, 197, 94, 0.25)' : 'none',
                }}
              />
              {/* Thumb */}
              <div
                className="absolute w-5 h-5 rounded-full pointer-events-none"
                style={{
                  left: `calc(${pctVisual}% - 10px)`,
                  background: 'var(--cf-green-dark)',
                  border: '3px solid var(--cf-surface)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.3), 0 0 0 1px rgba(34, 197, 94, 0.3)',
                }}
              />
              {/* Input range invisible para drag manual */}
              <input
                type="range"
                min={1}
                max={30}
                value={val}
                onChange={(e) => handleAbonoDias(Number(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
                style={{ height: '24px' }}
              />
            </div>
            {/* Tick marks */}
            <div className="relative h-5 mt-1">
              <span className="absolute left-0 text-[10px] text-[var(--cf-ink-3)]">1</span>
              {SNAPS.map((s) => {
                const pct = ((s - 1) / 29 * 100)
                const active = val === s
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleAbonoDias(s)}
                    className={`absolute -translate-x-1/2 text-[10px] font-medium transition-all cursor-pointer ${active ? 'text-[var(--cf-gold)] scale-110' : 'text-[var(--cf-ink-3)] hover:text-[var(--cf-ink-2)]'}`}
                    style={{ left: `${pct}%` }}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          </div>
          )
        })()}

        <div className="border-t border-[var(--cf-border)] pt-4 space-y-4">
          <MoneyInput
            label="Monto del pago *"
            value={monto}
            onChange={(e) => {
              fijarMonto(e.target.value)
              setError('')
              // Si el usuario edita manualmente el monto, limpiar diasAbonados
              // para evitar que el backend recalcule monto = cuotaDiaria * dias.
              if (diasAbonados !== null) setDiasAbonados(null)
            }}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-[var(--cf-ink-3)] uppercase tracking-[0.05em]">Tipo</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'completo', label: 'Completo',  color: 'var(--cf-gold)' },
                { key: 'parcial',  label: 'Parcial',   color: 'var(--cf-gold)' },
                { key: 'capital',  label: 'A capital',  color: 'var(--cf-ink-2)' },
                { key: 'recargo',  label: 'Recargo',   color: 'var(--cf-gold-dark)' },
                // Sale en TODOS los modos, igual que en la hoja nueva. Esta lista
                // decía tres modos y la de la hoja cuatro: en `saldo` la pastilla
                // aparecía en un sitio y en el otro no.
                { key: 'intereses', label: 'Intereses', color: 'var(--cf-gold-dark)' },
                // Descuento solo visible si el usuario tiene el permiso (riesgo: reduce saldo).
                ...(puedeAplicarDescuentos ? [{ key: 'descuento', label: 'Descuento', color: 'var(--cf-green-dark)' }] : []),
              ].map(({ key, label, color }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setTipo(key)
                    if (key === 'capital' || key === 'recargo' || key === 'descuento' || key === 'intereses') {
                      setDiasAbonados(null)
                      if (key === 'intereses') {
                        const interesesPend = prestamo?.cuotasAmortizacion
                          ?.filter(f => new Date(f.fechaEsperada) <= new Date() && (f.pagado || 0) < f.cuotaTotal)
                          ?.reduce((acc, f) => acc + Math.max(0, f.interes - (f.interesPagado || 0)), 0) ?? 0
                        setMonto(String(Math.round(interesesPend)))
                      } else {
                        fijarMonto('')
                      }
                    }
                  }}
                  className={[
                    'h-11 rounded-[10px] border text-xs font-medium transition-all cursor-pointer',
                    tipo === key
                      ? `border-[${color}] text-[${color}]`
                      : 'bg-transparent border-[var(--cf-border)] text-[var(--cf-ink-3)] hover:bg-[var(--cf-surface)]',
                  ].join(' ')}
                  style={tipo === key ? { backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)`, borderColor: color, color } : undefined}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Aviso de excedente sobre la cuota (modos simples): explicar destino */}
          {mostrarAvisoExcedente && (
            <div
              className="px-3 py-2.5 rounded-[10px] border text-xs"
              style={{ background: 'color-mix(in srgb, var(--cf-ink-2) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--cf-ink-2) 25%, transparent)' }}
            >
              <p className="font-medium mb-1" style={{ color: 'var(--cf-ink-2)' }}>
                Estás cobrando {formatMoney(excedentePago)} más que la cuota
              </p>
              <p className="text-[var(--cf-ink-3)] mb-2">
                Así como está, ese excedente <strong>adelanta las próximas cuotas</strong> (el interés ya viene incluido en el total, no se descuenta nada). Si querías que <strong>reduzca el capital y perdone parte del interés</strong>, cámbialo a abono a capital.
              </p>
              <button
                type="button"
                onClick={() => { setTipo('capital'); setDiasAbonados(null) }}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[11px] font-semibold transition-all cursor-pointer"
                style={{ background: 'color-mix(in srgb, var(--cf-ink-2) 12%, transparent)', color: 'var(--cf-ink-2)', border: '1px solid color-mix(in srgb, var(--cf-ink-2) 30%, transparent)' }}
              >
                Cambiar a abono a capital
              </button>
            </div>
          )}

          {/* Preview para recargo/descuento */}
          {(tipo === 'recargo' || tipo === 'descuento') && Number(monto) > 0 && (
            <div
              className="px-3 py-2.5 rounded-[10px] border"
              style={{
                background: tipo === 'recargo' ? 'rgba(249,115,22,0.08)' : 'rgba(34,197,94,0.08)',
                borderColor: tipo === 'recargo' ? 'rgba(249,115,22,0.2)' : 'rgba(34,197,94,0.2)',
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[var(--cf-ink-3)]">
                  {tipo === 'recargo' ? 'Recargo' : 'Descuento'}
                </span>
                <span
                  className="text-sm font-semibold font-mono-display"
                  style={{ color: tipo === 'recargo' ? 'var(--cf-gold-dark)' : 'var(--cf-green-dark)' }}
                >
                  {tipo === 'recargo' ? '+' : '−'}{formatMoney(Number(monto))}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--cf-ink-3)]">Nuevo saldo</span>
                <span className="text-sm font-bold text-[var(--cf-ink)] font-mono-display">
                  {formatMoney(tipo === 'recargo'
                    ? saldoPendiente + Number(monto)
                    : Math.max(0, saldoPendiente - Number(monto)))}
                </span>
              </div>
            </div>
          )}

          {tipo === 'capital' && (
            <div className="bg-[rgba(168,85,247,0.08)] border border-[rgba(168,85,247,0.2)] rounded-[10px] px-3 py-2.5 text-xs">
              <p className="font-medium text-[var(--cf-ink-2)] mb-1">Abono a capital</p>
              <p className="text-[var(--cf-ink-3)]">
                Reduce el capital y los intereses sobre ese monto. El préstamo termina antes.
                {monto && Number(monto) > 0 && prestamo?.tasaInteres > 0 && (() => {
                  const ahora = new Date(Date.now() - 5 * 60 * 60 * 1000)
                  const inicio = new Date(prestamo.fechaInicio)
                  const diasTrans = Math.max(0, Math.floor((ahora - inicio) / (1000 * 60 * 60 * 24)))
                  const diasRest = Math.max(0, (prestamo.diasPlazo || 0) - diasTrans)
                  const ahorro = Math.round(Number(monto) * (prestamo.tasaInteres / 100) * (diasRest / 30))
                  return (
                    <> Ahorro en intereses: <span className="text-[var(--cf-ink-2)] font-medium font-mono-display">
                      {formatMoney(ahorro)}
                    </span></>
                  )
                })()}
              </p>
            </div>
          )}

          {tipo === 'intereses' && (
            <div className="bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.2)] rounded-[10px] px-3 py-2.5 text-xs">
              <p className="font-medium text-[var(--cf-gold-dark)] mb-1">Pago a intereses</p>
              <p className="text-[var(--cf-ink-3)]">
                Cubre solo los intereses de las cuotas vencidas. El capital queda pendiente pero no genera mora adicional.
              </p>
            </div>
          )}

          {/* Método de pago — solo para pagos reales, no ajustes */}
          {!['recargo', 'descuento'].includes(tipo) && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-[var(--cf-ink-3)] uppercase tracking-[0.05em]">Metodo de pago</span>
              <MetodoPagoSelector
                metodosPago={metodosPago}
                compact
                value={{ metodoPago, metodoPagoId }}
                onSelect={({ metodoPago: mp, metodoPagoId: mpId, plataforma: pl }) => {
                  setMetodoPago(mp)
                  setMetodoPagoId(mpId)
                  setPlataforma(pl || '')
                }}
              />
            </div>
          )}

          <Input
            label={(tipo === 'recargo' || tipo === 'descuento') ? 'Motivo (obligatorio)' : 'Nota (opcional)'}
            placeholder={
              tipo === 'recargo' ? 'Ej: Multa por 5 días de atraso' :
              tipo === 'descuento' ? 'Ej: Pago anticipado, devolucion' :
              'Ej: Pago adelantado'
            }
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  )
}
