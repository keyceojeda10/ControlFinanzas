'use client'
// components/clientes/ClienteForm.jsx — Wizard de creacion/edicion de cliente
// Diseño "pantalla completa enfocada": cada paso tiene una pregunta grande,
// subtitulo y campos amplios con mucho espacio. Stepper minimalista arriba.

import { useState, useEffect, useRef } from 'react'
import { useRouter }           from 'next/navigation'
import dynamic                 from 'next/dynamic'
import { Input, Select }       from '@/components/ui/Input'
import { Button }              from '@/components/ui/Button'
import MoneyInput              from '@/components/ui/MoneyInput'
import DiasSinCobroSelector    from '@/components/ui/DiasSinCobroSelector'
import { guardarClientePendiente, encolarMutacion, invalidarCachePorPrefijo, obtenerRutasOffline, obtenerRutaOffline, leerDeCache } from '@/lib/offline'
import { useCountry } from '@/hooks/useCountry'

const LocationPicker = dynamic(() => import('@/components/clientes/LocationPicker'), { ssr: false })

export default function ClienteForm({ clienteInicial = null, plan = 'basic', puedeSubirFoto = false, datosIniciales = null, esOwner = false }) {
  const router = useRouter()
  const { validatePhone, validateDocument, documentConfig, phoneConfig } = useCountry()
  const esEdicion = !!clienteInicial
  const fotoInputRef = useRef(null)
  const fotoCameraRef = useRef(null)
  const [fotoFile, setFotoFile] = useState(null)
  const [fotoPreview, setFotoPreview] = useState(clienteInicial?.fotoUrl || null)

  const cedulaExistente = clienteInicial?.cedula ?? datosIniciales?.cedula ?? ''
  const [sinCedula, setSinCedula] = useState(cedulaExistente.startsWith('SIN-'))

  const [form, setForm] = useState({
    nombre:     clienteInicial?.nombre     ?? datosIniciales?.nombre     ?? '',
    cedula:     sinCedula ? '' : cedulaExistente,
    telefono:   clienteInicial?.telefono   ?? datosIniciales?.telefono   ?? '',
    direccion:  clienteInicial?.direccion  ?? datosIniciales?.direccion  ?? '',
    referencia: clienteInicial?.referencia ?? '',
    notas:      clienteInicial?.notas      ?? datosIniciales?.notas      ?? '',
    rutaId:     clienteInicial?.rutaId     ?? '',
    grupoCobroId: clienteInicial?.grupoCobroId ?? '',
    latitud:    clienteInicial?.latitud    ?? null,
    longitud:   clienteInicial?.longitud   ?? null,
    montoMaximoPrestamo: clienteInicial?.montoMaximoPrestamo ?? '',
  })
  const [errores, setErrores]   = useState({})
  const [rutas,   setRutas]     = useState([])
  const [grupos,  setGrupos]    = useState([])
  const [loading, setLoading]   = useState(false)
  const [error,   setError]     = useState('')
  const [scoreData, setScoreData] = useState(null)
  const [paso, setPaso] = useState(0)
  const [posicionEnRuta, setPosicionEnRuta] = useState('final')
  const [clientesRuta, setClientesRuta] = useState([])
  const [loadingClientesRuta, setLoadingClientesRuta] = useState(false)
  const [clienteCreado, setClienteCreado] = useState(null)

  // Cuando llegan datos de cartulina despues del montaje, pre-llenar los campos
  useEffect(() => {
    if (!datosIniciales) return
    setForm(prev => ({
      ...prev,
      nombre:    datosIniciales.nombre    || prev.nombre,
      cedula:    datosIniciales.cedula    || prev.cedula,
      telefono:  datosIniciales.telefono  || prev.telefono,
      direccion: datosIniciales.direccion || prev.direccion,
      notas:     datosIniciales.notas     || prev.notas,
    }))
    setErrores({})
  }, [datosIniciales])
  const [diasSinCobro, setDiasSinCobro] = useState(() => {
    try { return JSON.parse(clienteInicial?.diasSinCobro || '[]') } catch { return [] }
  })

  const PASOS = [
    { label: 'Datos básicos' },
    { label: 'Ubicacion' },
    { label: 'Organizacion' },
  ]

  // Consulta de score crediticio debounced al escribir cédula
  const habilitadoScore = !esEdicion && ['standard', 'professional'].includes(plan)
  useEffect(() => {
    if (!habilitadoScore) return
    const cedula = form.cedula.trim()
    if (!validateDocument(cedula)) {
      setScoreData(null)
      return
    }
    const timer = setTimeout(() => {
      fetch(`/api/clientes/score?cedula=${encodeURIComponent(cedula)}`)
        .then(r => r.json())
        .then(d => { if (!d.error) setScoreData(d); else setScoreData(null) })
        .catch(() => setScoreData(null))
    }, 500)
    return () => clearTimeout(timer)
  }, [form.cedula, habilitadoScore])

  useEffect(() => {
    if (['starter', 'basic'].includes(plan)) return
    fetch('/api/rutas')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setRutas(data)
        else return obtenerRutasOffline().then(cached => { if (cached.length) setRutas(cached) })
      })
      .catch(() => obtenerRutasOffline().then(cached => setRutas(cached)))
  }, [plan])

  useEffect(() => {
    if (!form.rutaId) { setClientesRuta([]); setPosicionEnRuta('final'); return }
    setLoadingClientesRuta(true)
    fetch(`/api/rutas/${form.rutaId}/orden`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setClientesRuta(data)
        else return obtenerRutaOffline(form.rutaId).then(cached => {
          if (cached?.clientes) setClientesRuta(cached.clientes)
        })
      })
      .catch(() => obtenerRutaOffline(form.rutaId).then(cached => {
        setClientesRuta(cached?.clientes || [])
      }).catch(() => setClientesRuta([])))
      .finally(() => setLoadingClientesRuta(false))
    setPosicionEnRuta('final')
  }, [form.rutaId])

  useEffect(() => {
    fetch('/api/grupos')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setGrupos(data)
        else return leerDeCache('sync:grupos').then(cached => { if (cached?.length) setGrupos(cached) })
      })
      .catch(() => leerDeCache('sync:grupos').then(cached => setGrupos(cached || [])))
  }, [])

  const handleFotoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  const subirFoto = async (clienteId) => {
    if (!fotoFile || !clienteId) return
    try {
      const fd = new FormData()
      fd.append('foto', fotoFile)
      await fetch(`/api/clientes/${clienteId}/foto`, { method: 'POST', body: fd })
    } catch {}
  }

  const set = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    setErrores((prev) => ({ ...prev, [field]: '' }))
  }

  // ⚠ AQUÍ VIVÍA `camposRequeridosLlenos`, QUE EXIGÍA LOS TRES CAMPOS.
  //
  // Cuando se relajó la validación a «solo el nombre» (T07-03, justo abajo)
  // esa función se quedó: ya no la llamaba nadie, pero su comentario decía que
  // controlaba el botón «Continuar» y CONTRADECÍA al de tres líneas más abajo.
  // Leyéndola, cualquiera —yo el primero— concluye que el botón sigue
  // bloqueado hasta rellenar cédula y teléfono. No lo está: el único
  // `disabled` del formulario es el de edición.
  //
  // Se borra en vez de dejarla «por si acaso»: una función muerta que dice lo
  // contrario de la viva es peor que no tener nada.
  const validarPasoEstricto = (idx) => {
    const errs = {}
    if (idx === 0) {
      // ── SOLO EL NOMBRE ES OBLIGATORIO (T07-03) ──
      //
      // Exigia nombre, cedula Y telefono. La lamina dice «solo el nombre es
      // obligatorio, lo demas lo puedes completar cuando lo visites», y su pie
      // explica por que: pedir datos en la calle frena la carga, y esa es la
      // razon de que muchos negocios se queden en cinco clientes. Cargar
      // clientes es lo que predice que la cuenta sobreviva.
      //
      // Y ya era incoherente: la carga masiva desde Excel acepta clientes SIN
      // TELEFONO. Se podian importar doscientos sin numero y no se podia crear
      // uno a mano.
      //
      // Lo que SI se sigue comprobando es que lo escrito sea valido: un
      // telefono a medias es peor que ninguno, porque el recordatorio se manda
      // y no llega.
      if (!form.nombre.trim()) errs.nombre = 'El nombre es requerido'
      if (!sinCedula && form.cedula.trim() && !validateDocument(form.cedula.trim())) {
        errs.cedula = `${documentConfig.label} no válido (ej: ${documentConfig.placeholder})`
      }
      if (form.telefono.trim() && !validatePhone(form.telefono.replace(/\s/g, ''))) {
        errs.telefono = `Ingresa un ${phoneConfig.label.toLowerCase()} válido (ej: ${phoneConfig.placeholder})`
      }
    }
    return errs
  }




  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    // Validar todos los pasos antes de enviar.
    const errs = validarPasoEstricto(0)
    if (Object.keys(errs).length) {
      setErrores(errs)
      setPaso(0)
      return
    }

    setLoading(true)
    setError('')

    // El marcador tambien cuando el campo se deja vacio, no solo con la casilla:
    // ahora la cedula es opcional y el backend la sigue usando como clave.
    const cedulaFinal = sinCedula || !form.cedula.trim()
      ? `SIN-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
      : form.cedula.trim()

    const payload = {
      nombre:     form.nombre.trim(),
      cedula:     cedulaFinal,
      telefono:   form.telefono.trim(),
      direccion:  form.direccion.trim() || undefined,
      referencia: form.referencia.trim() || undefined,
      notas:      form.notas.trim()      || undefined,
      rutaId:     form.rutaId || undefined,
      posicionEnRuta: form.rutaId && posicionEnRuta !== 'final' ? posicionEnRuta : undefined,
      grupoCobroId: form.grupoCobroId || undefined,
      latitud:    form.latitud,
      longitud:   form.longitud,
      diasSinCobro: diasSinCobro.length > 0 ? diasSinCobro : null,
      ...(esOwner && form.montoMaximoPrestamo !== '' && { montoMaximoPrestamo: Number(form.montoMaximoPrestamo) || null }),
      ...(esOwner && form.montoMaximoPrestamo === '' && esEdicion && { montoMaximoPrestamo: null }),
    }

    if (!esEdicion && typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        await guardarClientePendiente(payload)
        try { sessionStorage.setItem('cf-toast', 'Cliente guardado. Se sincronizará al volver online.') } catch {}
        router.push('/clientes')
        return
      } catch {
        setError('No se pudo guardar offline.')
        setLoading(false)
        return
      }
    }

    if (esEdicion && typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        await encolarMutacion({ tipo: 'cliente.update', entityId: clienteInicial.id, payload })
        try { sessionStorage.setItem('cf-toast', 'Cambios guardados. Se sincronizaran al volver online.') } catch {}
        router.push(`/clientes/${clienteInicial.id}`)
        return
      } catch {
        setError('No se pudo guardar offline.')
        setLoading(false)
        return
      }
    }

    try {
      const url    = esEdicion ? `/api/clientes/${clienteInicial.id}` : '/api/clientes'
      const method = esEdicion ? 'PATCH' : 'POST'

      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })

      if (res.status === 503 && !esEdicion && !navigator.onLine) {
        await guardarClientePendiente(payload)
        try { sessionStorage.setItem('cf-toast', 'Cliente guardado. Se sincronizará al volver online.') } catch {}
        router.push('/clientes')
        return
      }
      if (res.status === 503 && esEdicion && !navigator.onLine) {
        await encolarMutacion({ tipo: 'cliente.update', entityId: clienteInicial.id, payload })
        try { sessionStorage.setItem('cf-toast', 'Cambios guardados. Se sincronizaran al volver online.') } catch {}
        router.push(`/clientes/${clienteInicial.id}`)
        return
      }

      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al guardar'); return }

      invalidarCachePorPrefijo('clientes:').catch(() => {})

      if (fotoFile && data.id) await subirFoto(data.id)

      // Si vinieron datos de cartulina con información de préstamo, guardarlos
      // en sessionStorage para que /prestamos/nuevo los pre-llene automáticamente
      if (datosIniciales && data.id) {
        const datosPrestamo = {}
        if (datosIniciales.montoPrestado)  datosPrestamo.montoPrestado  = datosIniciales.montoPrestado
        if (datosIniciales.tasaInteres)    datosPrestamo.tasaInteres    = datosIniciales.tasaInteres
        if (datosIniciales.diasPlazo)      datosPrestamo.diasPlazo      = datosIniciales.diasPlazo
        if (datosIniciales.frecuencia)     datosPrestamo.frecuencia     = datosIniciales.frecuencia
        if (datosIniciales.fechaInicio)    datosPrestamo.fechaInicio    = datosIniciales.fechaInicio
        if (datosIniciales.cuotasPagadas || datosIniciales.montoPagadoHasta) {
          datosPrestamo.yaAbonado = datosIniciales.montoPagadoHasta || 0
          datosPrestamo.esEnCurso = true
        }
        if (Object.keys(datosPrestamo).length > 0) {
          datosPrestamo.clienteId = data.id
          try { sessionStorage.setItem('cf-cartulina-prestamo', JSON.stringify(datosPrestamo)) } catch {}
        }
        router.push(`/prestamos/nuevo`)
        return
      }

      if (esEdicion) {
        router.push(`/clientes/${data.id}`)
        router.refresh()
        return
      }
      setClienteCreado({ id: data.id, nombre: form.nombre || data.nombre })
    } catch {
      if (!esEdicion && !navigator.onLine) {
        try {
          await guardarClientePendiente(payload)
          try { sessionStorage.setItem('cf-toast', 'Cliente guardado. Se sincronizará al volver online.') } catch {}
          router.push('/clientes')
          return
        } catch {}
      }
      if (esEdicion && !navigator.onLine) {
        try {
          await encolarMutacion({ tipo: 'cliente.update', entityId: clienteInicial.id, payload })
          try { sessionStorage.setItem('cf-toast', 'Cambios guardados. Se sincronizaran al volver online.') } catch {}
          router.push(`/clientes/${clienteInicial.id}`)
          return
        } catch {}
      }
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }


  // Los planes de entrada no traen rutas: ahí el mensaje es otro —no es que no
  // tengas, es que no vienen— y ofrecer «crear una ruta» sería mandar a una
  // pantalla que va a decir que no.
  const planSinRutas = ['starter', 'basic'].includes(plan)

  return (
    <div className="max-w-xl mx-auto pb-32 lg:pb-32">
      {/* ── UNA PANTALLA, NO TRES PASOS (T07-03) ──
          Esto eran tres pasos con su barra de progreso: datos, ubicación y
          organización. Y de los tres, DOS ERAN ENTEROS OPCIONALES — dirección,
          referencia, ruta, grupo, tope y notas—, así que se obligaba a pasar por
          dos pantallas que casi nadie rellena para llegar a «Crear».

          La lámina pone los cinco campos que importan en una sola pantalla y
          dice «solo el nombre es obligatorio». Su pie explica por qué, y es lo
          más importante de esta pantalla: exigir datos en la calle frena la
          carga, y esa es la razón de que muchos negocios se queden en cinco
          clientes. Cargar clientes es lo que predice que la cuenta sobreviva.

          No se pierde ni un campo: los opcionales bajan a «Más datos», cerrado.
          Quien carga en la calle no lo abre; quien lo necesita, un toque. */}

      {/* Error global */}
      {error && (
        <div
          className="mt-6 flex items-center gap-2.5 rounded-[12px] px-4 py-3 text-sm"
          style={{ background: 'var(--cf-red-pill-bg)', color: 'var(--cf-red-dark)', border: '1px solid color-mix(in srgb, var(--cf-red-dark) 30%, transparent)' }}
        >
          {error}
        </div>
      )}

      {/* Paso 1 — Datos basicos */}
      {(
        <section className="mt-8">
          <h2 className="text-[22px] font-bold leading-tight" style={{ color: 'var(--cf-ink)' }}>
            {esEdicion ? 'Datos del cliente' : '¿Quien es tu cliente?'}
          </h2>
          <p className="text-sm mt-1.5" style={{ color: 'var(--cf-ink-3)' }}>
            Nombre, documento y teléfono. Lo mínimo para registrarlo.
          </p>

          {/* Foto */}
          {puedeSubirFoto && (
            <div className="flex items-center gap-4 mt-7">
              <input ref={fotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleFotoSelect} />
              <input ref={fotoCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoSelect} />
              <button
                type="button"
                onClick={() => fotoInputRef.current?.click()}
                className="relative w-20 h-20 rounded-full shrink-0 overflow-hidden transition-all active:scale-95"
                style={{
                  background: fotoPreview ? 'transparent' : 'color-mix(in srgb, var(--cf-gold) 12%, transparent)',
                  border: `2px dashed ${fotoPreview ? 'var(--cf-gold)' : 'color-mix(in srgb, var(--cf-gold) 40%, transparent)'}`,
                }}
              >
                {fotoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fotoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center w-full h-full" style={{ color: 'var(--cf-gold)' }}>
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                  </div>
                )}
              </button>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--cf-ink)' }}>
                  {fotoPreview ? 'Foto del cliente' : 'Agregar foto'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>
                  Opcional. JPG, PNG o WebP (max 5MB).
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => fotoInputRef.current?.click()}
                    className="text-xs font-medium px-2.5 py-1 rounded-full border transition-all active:scale-95"
                    style={{
                      color: 'var(--cf-gold)',
                      background: 'color-mix(in srgb, var(--cf-gold) 8%, transparent)',
                      borderColor: 'color-mix(in srgb, var(--cf-gold) 20%, transparent)',
                    }}
                  >
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                      </svg>
                      Galería
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fotoCameraRef.current?.click()}
                    className="text-xs font-medium px-2.5 py-1 rounded-full border transition-all active:scale-95"
                    style={{
                      color: 'var(--cf-ink-2)',
                      background: 'var(--cf-fill)',
                      borderColor: 'var(--cf-border)',
                    }}
                  >
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                      </svg>
                      Cámara
                    </span>
                  </button>
                  {fotoFile && (
                    <button
                      type="button"
                      onClick={() => { setFotoFile(null); setFotoPreview(clienteInicial?.fotoUrl || null) }}
                      className="text-xs font-medium"
                      style={{ color: 'var(--cf-red-dark)' }}
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="mt-7 space-y-5">
            <Input
              label="Nombre completo"
              placeholder="Ej: Juan García"
              value={form.nombre}
              onChange={set('nombre')}
              error={errores.nombre}
              autoComplete="name"
              autoFocus
            />
            <div>
              {!sinCedula && (
                <>
                  <Input
                    label={`${documentConfig.label}`}
                    placeholder={`Ej: ${documentConfig.placeholder}`}
                    value={form.cedula}
                    onChange={set('cedula')}
                    error={errores.cedula}
                    inputMode={/[a-zA-Z]/.test(documentConfig.placeholder) ? 'text' : 'numeric'}
                    disabled={esEdicion}
                  />
                  {scoreData?.encontrado && (() => {
                    const sColor = scoreData.score === 'rojo' ? 'var(--cf-red-dark)' : scoreData.score === 'amarillo' ? 'var(--cf-gold)' : 'var(--cf-green-dark)'
                    return (
                      <div className="mt-2 text-xs px-3 py-2 rounded-[10px] flex items-center gap-2"
                        style={{ background: `color-mix(in srgb, ${sColor} 10%, transparent)`, color: sColor, border: `1px solid color-mix(in srgb, ${sColor} 25%, transparent)` }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sColor }} />
                        {scoreData.score === 'rojo' && 'Cliente con mora activa en otras entidades'}
                        {scoreData.score === 'amarillo' && 'Cliente con creditos activos en otras entidades'}
                        {scoreData.score === 'verde' && 'Sin historial negativo en la plataforma'}
                      </div>
                    )
                  })()}
                </>
              )}
              {!esEdicion && (
                <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sinCedula}
                    onChange={(e) => {
                      setSinCedula(e.target.checked)
                      if (e.target.checked) {
                        setForm(prev => ({ ...prev, cedula: '' }))
                        setErrores(prev => ({ ...prev, cedula: '' }))
                      }
                    }}
                    className="accent-[var(--cf-gold)] w-4 h-4 rounded"
                  />
                  <span className="text-[12px]" style={{ color: 'var(--cf-ink-2)' }}>
                    No tengo la cédula
                  </span>
                </label>
              )}
            </div>
            <Input
              label={phoneConfig.label}
              placeholder={`Ej: ${phoneConfig.placeholder}`}
              value={form.telefono}
              onChange={set('telefono')}
              error={errores.telefono}
              inputMode="tel"
            />
          </div>
        </section>
      )}

      {/* Paso 2 — Ubicacion */}
      {(
        <section className="mt-8">
          <h2 className="text-[22px] font-bold leading-tight" style={{ color: 'var(--cf-ink)' }}>
            ¿Donde lo ubicamos?
          </h2>
          <p className="text-sm mt-1.5" style={{ color: 'var(--cf-ink-3)' }}>
            Dirección y referencias. Sirve para visitarlo y enrutarlo.
          </p>

          <div className="mt-7 space-y-5">
            <Input
              label="Dirección"
              placeholder="Calle, barrio, ciudad..."
              value={form.direccion}
              onChange={set('direccion')}
              error={errores.direccion}
            />
            <Input
              label="Referencia"
              placeholder="Ej: Tienda La Esquina, frente al colegio"
              value={form.referencia}
              onChange={set('referencia')}
              error={errores.referencia}
              maxLength={100}
            />
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>
                Ubicación en el mapa (opcional)
              </label>
              <div className="mt-2">
                <LocationPicker
                  latitud={form.latitud}
                  longitud={form.longitud}
                  onLocationChange={(lat, lng) => setForm((prev) => ({ ...prev, latitud: lat, longitud: lng }))}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Paso 3 — Organizacion */}
      {(
        <section className="mt-8">
          <h2 className="text-[22px] font-bold leading-tight" style={{ color: 'var(--cf-ink)' }}>
            ¿Lo asignamos a una ruta?
          </h2>
          <p className="text-sm mt-1.5" style={{ color: 'var(--cf-ink-3)' }}>
            Esto es opcional. Puedes crearlo sin ruta y asignarla después.
          </p>

          <div className="mt-7 space-y-5">
            {/* ── UNA PREGUNTA QUE LA PANTALLA NO DEJABA RESPONDER ──
                El título dice «¿Lo asignamos a una ruta?» y el selector iba
                detrás de `rutas.length > 0 &&`, sin `else`. Con cero rutas —que
                es como empieza todo el mundo— se leía la pregunta, se leía «si
                tienes rutas o grupos definidos, asígnalo aquí», y debajo no
                había ningún control de ruta. Nada explicaba por qué.

                Ahora hay tres respuestas posibles y las tres se dicen: no
                tienes rutas todavía, tu plan no las incluye, o aquí están. */}
            {planSinRutas ? (
              <div className="rounded-[14px] px-4 py-3.5" style={{
                background: 'var(--cf-gold-tint-2)', border: '1px solid var(--cf-gold-border)',
              }}>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--cf-ink-2)' }}>
                  Las rutas vienen con los planes de más arriba. Puedes crear el
                  cliente igual: se le asigna ruta después, sin volver a teclear
                  nada.
                </p>
              </div>
            ) : rutas.length === 0 ? (
              <div className="rounded-[14px] px-4 py-3.5" style={{
                background: 'var(--cf-fill)', border: '1px solid var(--cf-border)',
              }}>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--cf-ink-2)' }}>
                  Todavía no tienes rutas. Crea el cliente sin ruta y se la
                  asignas cuando tengas una — no se pierde nada.
                </p>
                <a
                  href="/rutas"
                  className="inline-block mt-2.5 text-[13px] font-bold"
                  style={{ color: 'var(--cf-gold-dark)' }}
                >
                  Ver mis rutas
                </a>
              </div>
            ) : null}

            {!planSinRutas && rutas.length > 0 && (
              <>
                <Select label="Ruta" value={form.rutaId} onChange={set('rutaId')}>
                  <option value="">Sin ruta asignada</option>
                  {rutas.map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </Select>

                {form.rutaId && !esEdicion && clientesRuta.length > 0 && (
                  <Select
                    label="Posicion en la ruta"
                    value={posicionEnRuta}
                    onChange={(e) => setPosicionEnRuta(e.target.value)}
                  >
                    <option value="final">Al final de la ruta</option>
                    <option value="inicio">Al inicio de la ruta</option>
                    {clientesRuta.map((c, i) => (
                      <option key={c.id} value={c.id}>Despues de {i + 1}. {c.nombre}</option>
                    ))}
                  </Select>
                )}
                {form.rutaId && !esEdicion && loadingClientesRuta && (
                  <p className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>Cargando clientes de la ruta...</p>
                )}
              </>
            )}
            {grupos.length > 0 && (
              <Select label="Grupo de cobro" value={form.grupoCobroId} onChange={set('grupoCobroId')}>
                <option value="">Sin grupo</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>{g.nombre}</option>
                ))}
              </Select>
            )}

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>
                Días sin cobro (opcional)
              </label>
              <p className="text-[11px] leading-snug mt-1 mb-2" style={{ color: 'var(--cf-ink-3)' }}>
                Este cliente no será cobrado en los días que selecciones. Si no defines nada, hereda de la ruta o la organización.
              </p>
              <DiasSinCobroSelector value={diasSinCobro} onChange={setDiasSinCobro} compact />
            </div>

            {esOwner && (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>
                  Tope maximo de prestamo
                </label>
                <p className="text-[11px] leading-snug mt-1 mb-2" style={{ color: 'var(--cf-ink-3)' }}>
                  Monto maximo que se le puede prestar a este cliente. Dejalo vacio para sin limite.
                </p>
                <MoneyInput
                  value={form.montoMaximoPrestamo}
                  onChange={(e) => setForm({ ...form, montoMaximoPrestamo: e.target.value })}
                  placeholder="Sin limite"
                />
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>
                Notas
              </label>
              <textarea
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                placeholder="Notas adicionales sobre el cliente..."
                maxLength={500}
                rows={4}
                className="cf-input w-full mt-1.5 px-3 py-2.5 rounded-[12px] border text-sm resize-none"
                style={{ background: 'var(--cf-fill)', borderColor: 'var(--cf-border)', color: 'var(--cf-ink)' }}
              />
              <span className="text-[10px] text-right block mt-1" style={{ color: 'var(--cf-ink-3)' }}>{form.notas.length}/500</span>
            </div>
          </div>
        </section>
      )}

      {/* Footer fijo abajo: cancel/atras + siguiente/guardar.
          ⚠ VA PEGADO AL BORDE. Si aquí vuelve a aparecer un `bottom` calculado
          para esquivar la pastilla, el arreglo está en el sitio equivocado: en
          un formulario la pastilla no debe estar (`TAREA` en `lib/armazon.js`).
          Subir la barra deja un hueco muerto debajo en las pantallas que nunca
          tuvieron pastilla. Ya pasó una vez. */}
      <div
        className="fixed left-0 right-0 lg:left-[var(--cf-w-sidebar)] bottom-0 z-[46] px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] lg:px-6 lg:pb-6"
        style={{
          background: 'var(--cf-surface)',
          borderTop: '1px solid var(--cf-border)',
          boxShadow: 'var(--cf-sh-sheet)',
        }}
      >
        <div className="max-w-xl mx-auto flex items-center gap-3">
          {/* UN SOLO BOTON. «Atrás» y «Siguiente» eran de los pasos, y
              «Cancelar» es lo mismo que la flecha de volver de la cabecera:
              dos formas de no hacer nada, ocupando la mitad del pie. */}
          <Button
            type="button"
            onClick={handleSubmit}
            loading={loading}
            className="flex-1"
          >
            {esEdicion ? 'Guardar cambios' : 'Crear cliente'}
          </Button>
        </div>
      </div>

      {clienteCreado && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div
            className="w-[90%] max-w-sm rounded-2xl p-6 text-center"
            style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}
          >
            <div className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.12)' }}>
              <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--cf-ink)' }}>Cliente creado</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--cf-ink-2)' }}>{clienteCreado.nombre}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => router.push(`/prestamos/nuevo?clienteId=${clienteCreado.id}`)}
                className="w-full h-12 rounded-xl font-semibold text-sm text-black transition-all"
                style={{ background: 'var(--cf-gold)' }}
              >
                Crear préstamo ahora
              </button>
              {/* ══ T07-03 · ENCADENAR OTRO, SIN VOLVER A LA LISTA ══
                  Las dos salidas eran «crear préstamo» y «ver ficha», y las dos
                  SACAN del formulario. Quien está cargando su cartera no quiere
                  ninguna de las dos: quiere meter el siguiente. Tenía que ir a
                  la lista y pulsar «nuevo» por cada cliente.
                  Es la pantalla del negocio que arranca, y cargar clientes es
                  justo lo que predice que la cuenta sobreviva: 311 de 411 están
                  en cinco clientes o menos.
                  LA RUTA SE CONSERVA: se cargan de una en una, y volver a
                  elegirla veinte veces es la clase de fricción que hace
                  abandonar a media carga. */}
              <button
                onClick={() => {
                  setForm((prev) => ({
                    ...prev,
                    nombre: '', cedula: '', telefono: '', direccion: '',
                    referencia: '', notas: '',
                    latitud: null, longitud: null, montoMaximoPrestamo: '',
                  }))
                  setErrores({})
                  setSinCedula(false)
                  setPaso(0)
                  setClienteCreado(null)
                  window.scrollTo({ top: 0 })
                }}
                className="w-full h-12 rounded-xl font-semibold text-sm transition-all"
                style={{ color: 'var(--cf-ink)', background: 'var(--cf-fill)' }}
              >
                Cargar otro cliente
              </button>
              <button
                onClick={() => router.push(`/clientes/${clienteCreado.id}`)}
                className="w-full h-11 rounded-xl font-medium text-sm transition-all"
                style={{ color: 'var(--cf-ink-2)' }}
              >
                Ver ficha del cliente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
