'use client'
// components/clientes/ClienteForm.jsx - Formulario reutilizable para crear/editar cliente

import { useState, useEffect } from 'react'
import { useRouter }           from 'next/navigation'
import dynamic                 from 'next/dynamic'
import { Input, Select }       from '@/components/ui/Input'
import { Button }              from '@/components/ui/Button'
import DiasSinCobroSelector    from '@/components/ui/DiasSinCobroSelector'
import { guardarClientePendiente, encolarMutacion } from '@/lib/offline'

const LocationPicker = dynamic(() => import('@/components/clientes/LocationPicker'), { ssr: false })

// Validación de teléfono colombiano: 10 dígitos, empieza en 3
const validarTelefono = (v) => /^3\d{9}$/.test(v.replace(/\s/g, ''))

// Card de seccion con icono cuadrado del color. Definida fuera del componente
// para que React no la desmonte/remonte en cada render (causa perdida de focus).
const SectionCard = ({ icon, title, color = 'var(--color-accent)', children }) => (
  <div
    className="rounded-[16px] p-4"
    style={{
      background: `linear-gradient(135deg, color-mix(in srgb, ${color} 6%, var(--color-bg-card)) 0%, var(--color-bg-card) 100%)`,
      border: '1px solid var(--color-border)',
    }}
  >
    <div className="flex items-center gap-2 mb-3">
      <div className="w-6 h-6 rounded-[6px] flex items-center justify-center"
        style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
      >
        <span className="w-3.5 h-3.5">{icon}</span>
      </div>
      <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color }}>
        {title}
      </p>
    </div>
    <div className="space-y-3">{children}</div>
  </div>
)

export default function ClienteForm({ clienteInicial = null, plan = 'basic' }) {
  const router = useRouter()
  const esEdicion = !!clienteInicial

  const [form, setForm] = useState({
    nombre:     clienteInicial?.nombre     ?? '',
    cedula:     clienteInicial?.cedula     ?? '',
    telefono:   clienteInicial?.telefono   ?? '',
    direccion:  clienteInicial?.direccion  ?? '',
    referencia: clienteInicial?.referencia ?? '',
    notas:      clienteInicial?.notas      ?? '',
    rutaId:     clienteInicial?.rutaId     ?? '',
    grupoCobroId: clienteInicial?.grupoCobroId ?? '',
    latitud:    clienteInicial?.latitud    ?? null,
    longitud:   clienteInicial?.longitud   ?? null,
  })
  const [errores, setErrores]   = useState({})
  const [rutas,   setRutas]     = useState([])
  const [grupos,  setGrupos]    = useState([])
  const [loading, setLoading]   = useState(false)
  const [error,   setError]     = useState('')
  const [scoreData, setScoreData] = useState(null)
  const [avanzadoOpen, setAvanzadoOpen] = useState(false)
  const [diasSinCobro, setDiasSinCobro] = useState(() => {
    try { return JSON.parse(clienteInicial?.diasSinCobro || '[]') } catch { return [] }
  })

  // Consulta de score crediticio debounced al escribir cédula
  const habilitadoScore = !esEdicion && ['standard', 'professional'].includes(plan)
  useEffect(() => {
    if (!habilitadoScore) return
    const cedula = form.cedula.trim()
    if (cedula.length < 6 || !/^\d{6,12}$/.test(cedula)) {
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

  // Cargar rutas solo para plan standard+
  useEffect(() => {
    if (['starter', 'basic'].includes(plan)) return
    fetch('/api/rutas')
      .then((r) => r.json())
      .then((data) => setRutas(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [plan])

  // Cargar grupos para asignación rápida desde el formulario
  useEffect(() => {
    fetch('/api/grupos')
      .then((r) => r.json())
      .then((data) => setGrupos(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const set = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    setErrores((prev) => ({ ...prev, [field]: '' }))
  }

  const validar = () => {
    const errs = {}
    if (!form.nombre.trim())    errs.nombre   = 'El nombre es requerido'
    if (!form.cedula.trim())    errs.cedula   = 'La cédula es requerida'
    if (!form.telefono.trim())  errs.telefono = 'El teléfono es requerido'

    if (form.cedula && !/^\d{6,12}$/.test(form.cedula.trim())) {
      errs.cedula = 'La cédula debe tener entre 6 y 12 dígitos numéricos'
    }
    if (form.telefono && !validarTelefono(form.telefono)) {
      errs.telefono = 'Ingresa un celular colombiano válido (ej: 3001234567)'
    }
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validar()
    if (Object.keys(errs).length) { setErrores(errs); return }

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
      grupoCobroId: form.grupoCobroId || undefined,
      latitud:    form.latitud,
      longitud:   form.longitud,
      diasSinCobro: diasSinCobro.length > 0 ? diasSinCobro : null,
    }

    // Si offline y es creación nueva, encolar y volver a la lista (que ya
    // está cacheada). No navegamos al detalle por ID temporal porque el SW
    // no tiene esa URL en cache y mostraría "Sin conexión".
    if (!esEdicion && typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        await guardarClientePendiente(payload)
        try { sessionStorage.setItem('cf-toast', 'Cliente guardado. Se sincronizara al volver online.') } catch {}
        router.push('/clientes')
        return
      } catch {
        setError('No se pudo guardar offline.')
        setLoading(false)
        return
      }
    }

    // Si offline y es edicion, encolar mutacion (optimistic update al cache local)
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

      // SW puede responder 503 sin red — encolar
      if (res.status === 503 && !esEdicion && !navigator.onLine) {
        await guardarClientePendiente(payload)
        try { sessionStorage.setItem('cf-toast', 'Cliente guardado. Se sincronizara al volver online.') } catch {}
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

      router.push(`/clientes/${data.id}`)
      router.refresh()
    } catch {
      // Fallback offline si el fetch falló por red
      if (!esEdicion && !navigator.onLine) {
        try {
          await guardarClientePendiente(payload)
          try { sessionStorage.setItem('cf-toast', 'Cliente guardado. Se sincronizara al volver online.') } catch {}
          router.push('/clientes')
          return
        } catch { /* abajo */ }
      }
      if (esEdicion && !navigator.onLine) {
        try {
          await encolarMutacion({ tipo: 'cliente.update', entityId: clienteInicial.id, payload })
          try { sessionStorage.setItem('cf-toast', 'Cambios guardados. Se sincronizaran al volver online.') } catch {}
          router.push(`/clientes/${clienteInicial.id}`)
          return
        } catch { /* abajo */ }
      }
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2.5 rounded-[12px] px-4 py-3 text-sm"
          style={{ background: 'var(--color-danger-dim)', color: 'var(--color-danger)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)' }}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          {error}
        </div>
      )}

      {/* Datos basicos */}
      <SectionCard
        title="Datos básicos"
        color="var(--color-accent)"
        icon={<svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Nombre completo *"
            placeholder="Ej: Juan García"
            value={form.nombre}
            onChange={set('nombre')}
            error={errores.nombre}
            autoComplete="name"
          />
          <div>
            <Input
              label="Cédula *"
              placeholder="Ej: 1023456789"
              value={form.cedula}
              onChange={set('cedula')}
              error={errores.cedula}
              inputMode="numeric"
              disabled={esEdicion}
            />
            {scoreData?.encontrado && (() => {
              const sColor = scoreData.score === 'rojo' ? 'var(--color-danger)' : scoreData.score === 'amarillo' ? 'var(--color-accent)' : 'var(--color-success)'
              return (
                <div className="mt-1.5 text-xs px-3 py-2 rounded-[10px] flex items-center gap-2"
                  style={{ background: `color-mix(in srgb, ${sColor} 10%, transparent)`, color: sColor, border: `1px solid color-mix(in srgb, ${sColor} 25%, transparent)` }}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sColor }} />
                  {scoreData.score === 'rojo' && 'Cliente con mora activa en otras entidades'}
                  {scoreData.score === 'amarillo' && 'Cliente con créditos activos en otras entidades'}
                  {scoreData.score === 'verde' && 'Sin historial negativo en la plataforma'}
                </div>
              )
            })()}
          </div>
        </div>
      </SectionCard>

      {/* Contacto */}
      <SectionCard
        title="Contacto"
        color="#22c55e"
        icon={<svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Teléfono *"
            placeholder="Ej: 3001234567"
            value={form.telefono}
            onChange={set('telefono')}
            error={errores.telefono}
            inputMode="tel"
          />
          <Input
            label="Referencia"
            placeholder="Ej: Tienda La Esquina"
            value={form.referencia}
            onChange={set('referencia')}
            error={errores.referencia}
            maxLength={100}
          />
          <div className="sm:col-span-2 space-y-2">
            <Input
              label="Dirección"
              placeholder="Calle, barrio, ciudad..."
              value={form.direccion}
              onChange={set('direccion')}
              error={errores.direccion}
            />
            <LocationPicker
              latitud={form.latitud}
              longitud={form.longitud}
              onLocationChange={(lat, lng) => setForm((prev) => ({ ...prev, latitud: lat, longitud: lng }))}
            />
          </div>
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: 'var(--color-text-secondary)' }}>
              Notas
            </label>
            <textarea
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              placeholder="Notas adicionales sobre el cliente..."
              maxLength={500}
              rows={3}
              className="cf-input w-full px-3 py-2 rounded-[12px] border text-sm resize-none"
              style={{ background: 'var(--color-bg-hover)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            />
            <span className="text-[10px] text-right" style={{ color: 'var(--color-text-muted)' }}>{form.notas.length}/500</span>
          </div>
        </div>
      </SectionCard>

      {/* Ruta + grupo (organizacional) */}
      {(!['starter', 'basic'].includes(plan) && rutas.length > 0) || grupos.length > 0 ? (
        <SectionCard
          title="Asignación"
          color="#a855f7"
          icon={<svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75v11.25m6-9v11.25m5.25-14.25L15 8.25l-6-2.25L3.75 8.25v12l5.25-2.25 6 2.25 5.25-2.25v-12z" /></svg>}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!['starter', 'basic'].includes(plan) && rutas.length > 0 && (
              <Select label="Ruta" value={form.rutaId} onChange={set('rutaId')}>
                <option value="">Sin ruta asignada</option>
                {rutas.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </Select>
            )}
            {grupos.length > 0 && (
              <Select label="Grupo de cobro" value={form.grupoCobroId} onChange={set('grupoCobroId')}>
                <option value="">Sin grupo</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>{g.nombre}</option>
                ))}
              </Select>
            )}
          </div>
        </SectionCard>
      ) : null}

      {/* Avanzado — collapsable card */}
      <div className="rounded-[16px] overflow-hidden" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        <button
          type="button"
          onClick={() => setAvanzadoOpen(v => !v)}
          className="w-full px-4 py-2.5 flex items-center justify-between gap-2 transition-colors hover:bg-[var(--color-bg-hover)]"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-[6px] flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--color-warning) 18%, transparent)', color: 'var(--color-warning)' }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.425-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
              </svg>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-warning)' }}>
              Opciones avanzadas
            </p>
          </div>
          <div className="flex items-center gap-2">
            {diasSinCobro.length > 0 && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: 'color-mix(in srgb, var(--color-warning) 15%, transparent)', color: 'var(--color-warning)' }}
              >
                {diasSinCobro.length} {diasSinCobro.length === 1 ? 'día' : 'días'} sin cobro
              </span>
            )}
            <svg className={`w-4 h-4 transition-transform shrink-0 ${avanzadoOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--color-text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>
        {avanzadoOpen && (
          <div className="px-4 pb-4 pt-1">
            <p className="text-[11px] font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Días sin cobro</p>
            <p className="text-[10px] leading-snug mb-2" style={{ color: 'var(--color-text-muted)' }}>
              Este cliente no será cobrado estos días. Si no configuras nada, hereda de la ruta o la organización.
            </p>
            <DiasSinCobroSelector value={diasSinCobro} onChange={setDiasSinCobro} compact />
          </div>
        )}
      </div>

      {/* Botones de accion */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button type="submit" loading={loading}>
          {esEdicion ? 'Guardar cambios' : 'Crear cliente'}
        </Button>
      </div>
    </form>
  )
}
