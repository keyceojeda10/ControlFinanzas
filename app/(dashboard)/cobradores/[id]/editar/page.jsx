'use client'
// app/(dashboard)/cobradores/[id]/editar/page.jsx

import { useState, useEffect, use } from 'react'
import { useRouter }                from 'next/navigation'
import { useAuth }                  from '@/hooks/useAuth'
import { Input }                    from '@/components/ui/Input'
import { Button }                   from '@/components/ui/Button'
import CompartirCredenciales        from '@/components/cobradores/CompartirCredenciales'

export default function EditarCobrador({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const { session, esOwner, loading: authLoading } = useAuth()

  const [nombre,    setNombre]    = useState('')
  const [email,     setEmail]     = useState('')
  const [telefono,  setTelefono]  = useState('')
  const [password,  setPassword]  = useState('')
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [exito,     setExito]     = useState(false)
  const [credencialesGuardadas, setCredencialesGuardadas] = useState(null)
  const [permisos,  setPermisos]  = useState({
    crearPrestamos: false,
    gestionarPrestamos: false,
    reportarGastos: true,
    crearClientes:  false,
    editarClientes: false,
  })

  useEffect(() => {
    if (!authLoading && !esOwner) router.replace('/cobradores')
  }, [authLoading, esOwner, router])

  useEffect(() => {
    fetch(`/api/cobradores/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setNombre(data.nombre || '')
        setEmail(data.email || '')
        setTelefono(data.telefono || '')
        if (data.permisos) {
          setPermisos({
            crearPrestamos: data.permisos.crearPrestamos ?? false,
            gestionarPrestamos: data.permisos.gestionarPrestamos ?? data.permisos.crearPrestamos ?? false,
            reportarGastos: data.permisos.reportarGastos ?? true,
            crearClientes:  data.permisos.crearClientes  ?? false,
            editarClientes: data.permisos.editarClientes ?? false,
          })
        }
      })
      .catch(() => setError('No se pudo cargar el cobrador'))
      .finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es requerido'); return }
    if (!email.trim())  { setError('El correo es requerido'); return }
    if (password && password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }

    setSaving(true)
    setError('')
    setExito(false)

    const body = { nombre: nombre.trim(), email: email.trim(), telefono, permisos }
    if (password) body.password = password

    try {
      const res = await fetch(`/api/cobradores/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al guardar'); return }
      setExito(true)
      // Si se cambió contraseña, mostrar opción de reenviar credenciales
      if (password) {
        setCredencialesGuardadas({ nombre: nombre.trim(), email: email.trim(), telefono, password })
      }
      setPassword('')
      setTimeout(() => setExito(false), 3000)
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-md mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-[#1a1a1a] rounded w-40" />
          <div className="h-48 bg-[#1a1a1a] rounded-[16px]" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-[#888888] hover:text-[white] transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
        <h1 className="text-xl font-bold text-[white]">Editar cobrador</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="border border-[#2a2a2a] rounded-[16px] p-5 space-y-4"
        style={{
          background: 'linear-gradient(135deg, #f5c5180A 0%, #1a1a1a 40%, #1a1a1a 70%, #f5c51805 100%)',
          boxShadow: '0 0 30px #f5c51808, 0 1px 2px rgba(0,0,0,0.3)',
        }}
      >
        {error && (
          <div className="flex items-center gap-2 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[12px] px-4 py-3">
            {error}
          </div>
        )}
        {exito && (
          <div className="flex items-center gap-2 bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)] text-[#22c55e] text-sm rounded-[12px] px-4 py-3">
            Cambios guardados correctamente
          </div>
        )}

        <Input
          label="Nombre completo"
          placeholder="Ej: Pedro Ramírez"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <Input
          label="Correo electrónico"
          type="email"
          placeholder="cobrador@ejemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div>
          <Input
            label="Teléfono (opcional)"
            type="tel"
            inputMode="numeric"
            placeholder="Ej: 3001234567"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ''))}
            autoComplete="tel"
          />
          <p className="text-[10px] text-[#888888] mt-1">
            Útil para enviarle las credenciales por WhatsApp.
          </p>
        </div>
        <div>
          <Input
            label="Nueva contraseña (opcional)"
            placeholder="Dejar vacío para no cambiar"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-[10px] text-[#888888] mt-1">
            Solo llena este campo si quieres cambiar la contraseña del cobrador.
          </p>
        </div>

        {/* Compartir credenciales después de cambiar contraseña */}
        {credencialesGuardadas && (
          <div className="border border-[rgba(16,185,129,0.3)] rounded-[12px] p-4"
            style={{ background: 'linear-gradient(135deg, #22c55e0A 0%, #1a1a1a 50%, #22c55e05 100%)' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-[#22c55e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm font-semibold text-white">Contraseña actualizada</p>
            </div>
            <p className="text-[10px] text-[#888888] mb-3">
              Envía las nuevas credenciales al cobrador. La contraseña no se mostrará de nuevo.
            </p>
            <CompartirCredenciales
              nombreCobrador={credencialesGuardadas.nombre}
              email={credencialesGuardadas.email}
              password={credencialesGuardadas.password}
              telefono={credencialesGuardadas.telefono}
              nombreOwner={session?.user?.nombre}
            />
          </div>
        )}

        {/* Permisos */}
        <div className="border-t border-[#2a2a2a] pt-4">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-3">Permisos del cobrador</p>
          <div className="space-y-3">
            {[
              { key: 'crearPrestamos', label: 'Crear préstamos', desc: 'Puede registrar préstamos nuevos para clientes de su ruta' },
              { key: 'gestionarPrestamos', label: 'Gestión de préstamos', desc: 'Renovar préstamos, modificar plazos, aplicar recargos y descuentos' },
              { key: 'reportarGastos', label: 'Reportar gastos menores', desc: 'Puede registrar gastos menores en caja (hoy o ayer)' },
              { key: 'crearClientes',  label: 'Crear clientes',  desc: 'Puede registrar nuevos clientes (se asignan a su ruta)' },
              { key: 'editarClientes', label: 'Editar clientes', desc: 'Puede modificar datos como teléfono, dirección, etc.' },
            ].map((p) => (
              <div key={p.key} className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[white]">{p.label}</p>
                  <p className="text-[10px] text-[#666666] leading-snug">{p.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPermisos(prev => {
                    if (p.key === 'crearPrestamos') {
                      const nuevoValor = !prev.crearPrestamos
                      return {
                        ...prev,
                        crearPrestamos: nuevoValor,
                        ...(nuevoValor ? {} : { gestionarPrestamos: false }),
                      }
                    }
                    return { ...prev, [p.key]: !prev[p.key] }
                  })}
                  disabled={p.key === 'gestionarPrestamos' && !permisos.crearPrestamos}
                  className={[
                    'relative w-10 h-[22px] rounded-full transition-colors shrink-0 mt-0.5',
                    permisos[p.key] ? 'bg-[#f5c518]' : 'bg-[#333333]',
                    p.key === 'gestionarPrestamos' && !permisos.crearPrestamos ? 'opacity-50 cursor-not-allowed' : '',
                  ].join(' ')}
                >
                  <span className={[
                    'absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white transition-transform shadow-sm',
                    permisos[p.key] ? 'left-[20px]' : 'left-[2px]',
                  ].join(' ')} />
                </button>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-[#888888] mt-2">
            Nota: "Gestión de préstamos" es un permiso avanzado e independiente para cambios administrativos de créditos.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={() => router.back()} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </div>
  )
}
