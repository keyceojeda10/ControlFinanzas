'use client'

import { useState } from 'react'

export default function WizardCobrador({ onComplete }) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rutaNombre, setRutaNombre] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState('cobrador') // 'cobrador' | 'ruta'
  const [cobradorCreado, setCobradorCreado] = useState(null)

  const handleCrearCobrador = async (e) => {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es requerido'); return }
    if (!email.trim()) { setError('El correo es requerido'); return }
    if (!password.trim() || password.trim().length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/cobradores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          email: email.trim(),
          password: password.trim(),
          permisos: {
            crearPrestamos: false,
            gestionarPrestamos: false,
            reportarGastos: true,
            crearClientes: false,
            editarClientes: false,
            verCapital: false,
            verCapitalRuta: false,
            verSaldoCaja: false,
            gestionarRutas: false,
            aplicarDescuentos: false,
            desembolsarLinea: false,
            reabrirCajaSinAprobacion: false,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al crear cobrador')
        return
      }
      setCobradorCreado(data)
      setStep('ruta')
      setError('')
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleCrearRuta = async (e) => {
    e.preventDefault()
    if (!rutaNombre.trim()) { setError('El nombre de la ruta es requerido'); return }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/rutas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: rutaNombre.trim(),
          cobradorId: cobradorCreado?.id ?? cobradorCreado?.cobrador?.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al crear la ruta')
        return
      }
      onComplete({
        cobrador: cobradorCreado,
        ruta: data,
      })
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'ruta') {
    return (
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-[14px] flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Crea una ruta para {cobradorCreado?.nombre ?? nombre}
          </h2>
          <p className="text-[13px] max-w-[300px] mx-auto leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            La ruta agrupa los clientes que este cobrador va a visitar. Después puedes agregar clientes a esta ruta.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-2.5 rounded-[10px] mb-4"
          style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="#22c55e" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-[11px]" style={{ color: '#22c55e' }}>
            Cobrador <strong>{cobradorCreado?.nombre ?? nombre}</strong> creado
          </p>
        </div>

        <form onSubmit={handleCrearRuta} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm rounded-[12px] px-4 py-3"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <div className="rounded-[16px] p-5"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <label className="block text-[12px] font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Nombre de la ruta
            </label>
            <input
              type="text"
              value={rutaNombre}
              onChange={(e) => { setRutaNombre(e.target.value); setError('') }}
              placeholder="Ej: Ruta Centro, Ruta Norte..."
              autoFocus
              className="w-full h-12 rounded-[12px] px-4 text-[15px] transition-all outline-none"
              style={{
                background: 'var(--color-bg-surface)',
                border: '1.5px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
            <p className="text-[11px] mt-2" style={{ color: 'var(--color-text-muted)' }}>
              Ponle un nombre que identifique la zona. Después puedes agregar más rutas.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !rutaNombre.trim()}
            className="w-full h-12 rounded-[12px] text-base font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            style={{ background: '#3b82f6', color: '#fff' }}>
            {loading ? (
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : 'Crear ruta y asignar cobrador'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-[14px] flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6' }}>
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
              d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
          Crea tu primer cobrador
        </h2>
        <p className="text-[13px] max-w-[300px] mx-auto leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          El cobrador cobra desde su celular con su propia cuenta. Tú ves todo en tiempo real.
        </p>
      </div>

      <form onSubmit={handleCrearCobrador} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 text-sm rounded-[12px] px-4 py-3"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        <div className="rounded-[16px] p-5 space-y-4"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>

          <div>
            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Nombre del cobrador
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => { setNombre(e.target.value); setError('') }}
              placeholder="Nombre completo"
              autoFocus
              className="w-full h-11 rounded-[10px] px-4 text-[14px] transition-all outline-none"
              style={{
                background: 'var(--color-bg-surface)',
                border: '1.5px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Correo del cobrador
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError('') }}
              placeholder="cobrador@correo.com"
              className="w-full h-11 rounded-[10px] px-4 text-[14px] transition-all outline-none"
              style={{
                background: 'var(--color-bg-surface)',
                border: '1.5px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Contraseña
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError('') }}
              placeholder="Mínimo 6 caracteres"
              className="w-full h-11 rounded-[10px] px-4 text-[14px] transition-all outline-none"
              style={{
                background: 'var(--color-bg-surface)',
                border: '1.5px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
            <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Dale esta contraseña a tu cobrador para que entre al sistema.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !nombre.trim() || !email.trim() || !password.trim()}
          className="w-full h-12 rounded-[12px] text-base font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
          style={{ background: '#8b5cf6', color: '#fff' }}>
          {loading ? (
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : 'Crear cobrador'}
        </button>
      </form>
    </div>
  )
}
