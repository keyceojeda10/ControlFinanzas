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
import Stepper                 from '@/components/ui/Stepper'
import { guardarClientePendiente, encolarMutacion } from '@/lib/offline'
import { useCountry } from '@/hooks/useCountry'

const LocationPicker = dynamic(() => import('@/components/clientes/LocationPicker'), { ssr: false })

export default function ClienteForm({ clienteInicial = null, plan = 'basic', puedeSubirFoto = false, datosIniciales = null, esOwner = false }) {
  const router = useRouter()
  const { validatePhone, validateDocument, documentConfig, phoneConfig } = useCountry()
  const esEdicion = !!clienteInicial
  const fotoInputRef = useRef(null)
  const [fotoFile, setFotoFile] = useState(null)
  const [fotoPreview, setFotoPreview] = useState(clienteInicial?.fotoUrl || null)

  const [form, setForm] = useState({
    nombre:     clienteInicial?.nombre     ?? datosIniciales?.nombre     ?? '',
    cedula:     clienteInicial?.cedula     ?? datosIniciales?.cedula     ?? '',
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
      .then((data) => setRutas(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [plan])

  useEffect(() => {
    if (!form.rutaId) { setClientesRuta([]); setPosicionEnRuta('final'); return }
    setLoadingClientesRuta(true)
    fetch(`/api/rutas/${form.rutaId}/orden`)
      .then(r => r.json())
      .then(data => setClientesRuta(Array.isArray(data) ? data : []))
      .catch(() => setClientesRuta([]))
      .finally(() => setLoadingClientesRuta(false))
    setPosicionEnRuta('final')
  }, [form.rutaId])

  useEffect(() => {
    fetch('/api/grupos')
      .then((r) => r.json())
      .then((data) => setGrupos(Array.isArray(data) ? data : []))
      .catch(() => {})
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

  // El paso 1 (Datos basicos) pide nombre, cedula y telefono — los 3 datos
  // minimos para tener un cliente registrable. Pasos 2 y 3 son opcionales.
  //
  // IMPORTANTE: hay dos niveles de validacion:
  // - camposRequeridosLlenos(idx): solo chequea que los inputs NO esten vacios.
  //   Esto controla si el boton "Continuar" esta habilitado.
  // - validarPasoEstricto(idx): incluye validacion de formato (cedula, telefono).
  //   Solo se ejecuta al hacer click en "Continuar", para que si el formato
  //   falla el usuario vea el error en el campo y sepa por que no avanzo.
  const camposRequeridosLlenos = (idx) => {
    if (idx === 0) {
      return !!form.nombre.trim() && !!form.cedula.trim() && !!form.telefono.trim()
    }
    return true
  }

  const validarPasoEstricto = (idx) => {
    const errs = {}
    if (idx === 0) {
      if (!form.nombre.trim()) errs.nombre = 'El nombre es requerido'
      if (!form.cedula.trim()) errs.cedula = 'La cédula es requerida'
      else if (!validateDocument(form.cedula.trim())) {
        errs.cedula = `${documentConfig.label} no válido (ej: ${documentConfig.placeholder})`
      }
      if (!form.telefono.trim()) errs.telefono = 'El teléfono es requerido'
      else if (!validatePhone(form.telefono.replace(/\s/g, ''))) {
        errs.telefono = `Ingresa un ${phoneConfig.label.toLowerCase()} válido (ej: ${phoneConfig.placeholder})`
      }
    }
    return errs
  }

  const puedeAvanzar = camposRequeridosLlenos(paso)

  const irAlSiguiente = () => {
    const errs = validarPasoEstricto(paso)
    if (Object.keys(errs).length) {
      setErrores(errs)
      return
    }
    setErrores({})
    setPaso(p => Math.min(PASOS.length - 1, p + 1))
  }

  const irAlAnterior = () => setPaso(p => Math.max(0, p - 1))

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

    const payload = {
      nombre:     form.nombre.trim(),
      cedula:     form.cedula.trim(),
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

  const completedIndices = []
  for (let i = 0; i < paso; i++) completedIndices.push(i)

  return (
    <div className="max-w-xl mx-auto pb-32 lg:pb-32">
      {/* Stepper */}
      <Stepper
        steps={PASOS}
        activeIndex={paso}
        completedIndices={completedIndices}
        onChange={(idx) => {
          if (idx <= paso) setPaso(idx)
        }}
      />

      {/* Error global */}
      {error && (
        <div
          className="mt-6 flex items-center gap-2.5 rounded-[12px] px-4 py-3 text-sm"
          style={{ background: 'var(--color-danger-dim)', color: 'var(--color-danger)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)' }}
        >
          {error}
        </div>
      )}

      {/* Paso 1 — Datos basicos */}
      {paso === 0 && (
        <section className="mt-8">
          <h2 className="text-[22px] font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
            {esEdicion ? 'Datos del cliente' : '¿Quien es tu cliente?'}
          </h2>
          <p className="text-sm mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
            Nombre, documento y teléfono. Lo mínimo para registrarlo.
          </p>

          {/* Foto */}
          {puedeSubirFoto && (
            <div className="flex items-center gap-4 mt-7">
              <input ref={fotoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFotoSelect} />
              <button
                type="button"
                onClick={() => fotoInputRef.current?.click()}
                className="relative w-20 h-20 rounded-full shrink-0 overflow-hidden transition-all active:scale-95"
                style={{
                  background: fotoPreview ? 'transparent' : 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
                  border: `2px dashed ${fotoPreview ? 'var(--color-accent)' : 'color-mix(in srgb, var(--color-accent) 40%, transparent)'}`,
                }}
              >
                {fotoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fotoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center w-full h-full" style={{ color: 'var(--color-accent)' }}>
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                  </div>
                )}
              </button>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {fotoPreview ? 'Foto del cliente' : 'Agregar foto'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  Opcional. JPG, PNG o WebP (max 5MB).
                </p>
                {fotoFile && (
                  <button
                    type="button"
                    onClick={() => { setFotoFile(null); setFotoPreview(clienteInicial?.fotoUrl || null) }}
                    className="text-xs mt-1.5 font-medium"
                    style={{ color: 'var(--color-danger)' }}
                  >
                    Quitar foto
                  </button>
                )}
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
                const sColor = scoreData.score === 'rojo' ? 'var(--color-danger)' : scoreData.score === 'amarillo' ? 'var(--color-accent)' : 'var(--color-success)'
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
      {paso === 1 && (
        <section className="mt-8">
          <h2 className="text-[22px] font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
            ¿Donde lo ubicamos?
          </h2>
          <p className="text-sm mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
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
              <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
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
      {paso === 2 && (
        <section className="mt-8">
          <h2 className="text-[22px] font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
            ¿Lo asignamos a una ruta?
          </h2>
          <p className="text-sm mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
            Esto es opcional. Si tienes rutas o grupos definidos, asignalo aquí para que aparezca en el listado correcto.
          </p>

          <div className="mt-7 space-y-5">
            {!['starter', 'basic'].includes(plan) && rutas.length > 0 && (
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
                  <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Cargando clientes de la ruta...</p>
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
              <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                Días sin cobro (opcional)
              </label>
              <p className="text-[11px] leading-snug mt-1 mb-2" style={{ color: 'var(--color-text-muted)' }}>
                Este cliente no será cobrado en los días que selecciones. Si no defines nada, hereda de la ruta o la organización.
              </p>
              <DiasSinCobroSelector value={diasSinCobro} onChange={setDiasSinCobro} compact />
            </div>

            {esOwner && (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                  Tope maximo de prestamo
                </label>
                <p className="text-[11px] leading-snug mt-1 mb-2" style={{ color: 'var(--color-text-muted)' }}>
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
              <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                Notas
              </label>
              <textarea
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                placeholder="Notas adicionales sobre el cliente..."
                maxLength={500}
                rows={4}
                className="cf-input w-full mt-1.5 px-3 py-2.5 rounded-[12px] border text-sm resize-none"
                style={{ background: 'var(--color-bg-hover)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              />
              <span className="text-[10px] text-right block mt-1" style={{ color: 'var(--color-text-muted)' }}>{form.notas.length}/500</span>
            </div>
          </div>
        </section>
      )}

      {/* Footer fijo abajo: cancel/atras + siguiente/guardar */}
      <div
        className="fixed left-0 right-0 lg:left-60 bottom-0 z-[45] px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] lg:px-6 lg:pb-6"
        style={{
          background: 'var(--color-bg-base)',
          borderTop: '1px solid var(--color-border)',
          boxShadow: '0 -4px 12px rgba(0,0,0,0.25)',
        }}
      >
        <div className="max-w-xl mx-auto flex items-center gap-3">
          {paso === 0 ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
              disabled={loading}
              className="flex-1"
            >
              Cancelar
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={irAlAnterior}
              disabled={loading}
              className="flex-1"
            >
              Atrás
            </Button>
          )}
          {paso < PASOS.length - 1 ? (
            <Button
              type="button"
              onClick={irAlSiguiente}
              disabled={!puedeAvanzar}
              className="flex-[2]"
            >
              Continuar
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              loading={loading}
              className="flex-[2]"
            >
              {esEdicion ? 'Guardar cambios' : 'Crear cliente'}
            </Button>
          )}
        </div>
      </div>

      {clienteCreado && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div
            className="w-[90%] max-w-sm rounded-2xl p-6 text-center"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <div className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.12)' }}>
              <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>Cliente creado</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>{clienteCreado.nombre}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => router.push(`/prestamos/nuevo?clienteId=${clienteCreado.id}`)}
                className="w-full h-12 rounded-xl font-semibold text-sm text-black transition-all"
                style={{ background: 'var(--color-accent)' }}
              >
                Crear prestamo ahora
              </button>
              <button
                onClick={() => { router.push(`/clientes/${clienteCreado.id}`); router.refresh() }}
                className="w-full h-11 rounded-xl font-medium text-sm transition-all"
                style={{ color: 'var(--color-text-secondary)', background: 'var(--color-bg-hover)' }}
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
