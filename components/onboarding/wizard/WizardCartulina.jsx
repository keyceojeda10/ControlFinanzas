'use client'

import { useState, useRef, useCallback } from 'react'

export default function WizardCartulina({ onComplete, onSkip }) {
  const [estado, setEstado] = useState('idle')
  const [mensajeError, setMensajeError] = useState('')
  const [previews, setPreviews] = useState([])
  const [resultados, setResultados] = useState([])
  const [enviando, setEnviando] = useState(false)
  const inputRef = useRef(null)
  const cameraRef = useRef(null)

  const handleArchivos = async (e) => {
    const archivos = Array.from(e.target.files ?? [])
    if (!archivos.length) return

    const urls = archivos.map(f => URL.createObjectURL(f))
    setPreviews(urls)
    setEstado('cargando')
    setMensajeError('')

    const fd = new FormData()
    archivos.forEach(f => fd.append('fotos', f))

    try {
      const res = await fetch('/api/herramientas/leer-cartulina', { method: 'POST', body: fd })
      const json = await res.json()

      if (!res.ok) {
        setEstado('error')
        setMensajeError(json.error ?? 'No pudimos leer la cartulina')
        return
      }

      // La API devuelve UN objeto (resultados[0] o la fusion de varias fotos),
      // no un array. Si esto no se normaliza, resultados.length queda undefined
      // y no se pinta ni el exito ni el vacio: pantalla en blanco sin salida.
      const datos = Array.isArray(json.datos)
        ? json.datos
        : (json.datos ? [json.datos] : [])
      setResultados(datos)
      setEstado('listo')
    } catch {
      setEstado('error')
      setMensajeError('Error de conexion. Intenta de nuevo.')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
      if (cameraRef.current) cameraRef.current.value = ''
    }
  }

  const crearDesdeResultados = useCallback(async () => {
    if (!resultados.length || enviando) return
    setEnviando(true)

    let clientesCreados = 0
    let prestamosCreados = 0
    const fallos = []

    for (const dato of resultados) {
      const quien = dato.nombre || 'Cliente sin nombre'
      try {
        // La cedula es obligatoria en /api/clientes. La cartulina casi nunca la
        // trae, asi que se genera un marcador SIN- (el mismo patron del
        // migrador) que la API acepta sin validar formato de documento.
        const cedula = dato.cedula?.trim()
          || `SIN-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

        const resC = await fetch('/api/clientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: dato.nombre || 'Cliente importado',
            cedula,
            telefono: dato.telefono || '',
            direccion: dato.direccion || '',
          }),
        })
        if (!resC.ok) {
          const err = await resC.json().catch(() => ({}))
          fallos.push(`${quien}: ${err.error || 'no se pudo crear'}`)
          continue
        }
        const cliente = await resC.json()
        clientesCreados++

        if (dato.montoPrestado && dato.montoPrestado > 0) {
          // /api/prestamos espera diasPlazo y modoInteres. Mandar numeroCuotas
          // y metodoInteres devolvia 400 "El plazo es requerido" siempre.
          const frecuencia = dato.frecuencia ?? 'diario'
          const diasPorPeriodo = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }[frecuencia] ?? 1
          const cuotas = Number(dato.numeroCuotas) > 0 ? Number(dato.numeroCuotas) : 20

          const resP = await fetch('/api/prestamos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clienteId: cliente.id,
              montoPrestado: dato.montoPrestado,
              tasaInteres: dato.tasaInteres ?? 20,
              diasPlazo: cuotas * diasPorPeriodo,
              frecuencia,
              modoInteres: 'fijo',
              fechaInicio: new Date().toISOString().split('T')[0],
            }),
          })
          if (resP.ok) prestamosCreados++
          else {
            const err = await resP.json().catch(() => ({}))
            fallos.push(`${quien}: cliente creado, pero el prestamo fallo (${err.error || 'error'})`)
          }
        }
      } catch {
        fallos.push(`${quien}: se cayo la conexion`)
      }
    }

    // No declarar exito cuando no se creo nada: antes se pasaba igual a la
    // pantalla de "Ya conoces el sistema" con cero clientes en la cuenta.
    if (clientesCreados === 0) {
      setEnviando(false)
      setEstado('error')
      setMensajeError(fallos[0] || 'No pudimos crear los clientes. Intenta de nuevo o registralos manualmente.')
      return
    }

    onComplete({ clientesCreados, prestamosCreados, fallos })
  }, [resultados, enviando, onComplete])

  const reintentar = () => {
    setEstado('idle')
    setMensajeError('')
    setPreviews([])
    setResultados([])
  }

  return (
    <div className="max-w-md mx-auto flex flex-col" style={{ minHeight: '70vh' }}>

      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-[16px] flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h2 className="text-[22px] font-bold mb-2" style={{ color: 'var(--color-text-primary)', fontFamily: "Georgia, serif" }}>
          Sube una foto de tu cartulina
        </h2>
        <p className="text-[13px] max-w-[280px] mx-auto leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          La IA lee los datos y crea el cliente con su prestamo automaticamente. Cartulina, cuaderno, libreta... lo que uses.
        </p>
      </div>

      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleArchivos} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleArchivos} />

      <div className="flex-1">

        {/* Idle: botones de subida */}
        {estado === 'idle' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="w-full flex items-center justify-center gap-3 h-14 rounded-[14px] text-[15px] font-bold transition-all active:scale-[0.98] cursor-pointer"
              style={{ background: '#a78bfa', color: '#fff' }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Tomar foto
            </button>

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full flex items-center justify-center gap-3 h-12 rounded-[14px] text-[14px] font-medium transition-all active:scale-[0.98] cursor-pointer"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
              Elegir de galeria
            </button>

            <div className="flex items-center gap-2 px-3 py-2.5 rounded-[10px] mt-2"
              style={{ background: 'rgba(245,197,24,0.05)', border: '1px solid rgba(245,197,24,0.12)' }}>
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="var(--color-accent)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                Puedes subir varias fotos a la vez. Hasta 5 por tanda.
              </p>
            </div>
          </div>
        )}

        {/* Cargando */}
        {estado === 'cargando' && (
          <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
            {previews.length > 0 && (
              <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                {previews.map((url, i) => (
                  <img key={i} src={url} alt={`Foto ${i + 1}`}
                    className="h-24 w-auto rounded-[10px] object-cover shrink-0 border border-[var(--color-border)] opacity-60" />
                ))}
              </div>
            )}
            <div className="flex items-center gap-3">
              <svg className="animate-spin w-6 h-6 text-[#a78bfa] shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <div>
                <p className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>Leyendo la cartulina...</p>
                <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>La IA esta extrayendo nombre, montos y cuotas</p>
              </div>
            </div>
          </div>
        )}

        {/* Resultados listos */}
        {estado === 'listo' && resultados.length > 0 && (
          <div className="space-y-3">
            <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--color-success)_25%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_5%,transparent)] p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-[var(--color-success)]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="text-[14px] font-semibold" style={{ color: 'var(--color-success)' }}>
                  {resultados.length === 1 ? '1 cliente encontrado' : `${resultados.length} clientes encontrados`}
                </p>
              </div>

              {resultados.map((r, i) => (
                <div key={i} className="flex items-center gap-3 py-2" style={{ borderTop: i > 0 ? '1px solid var(--color-border)' : 'none' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[12px] font-bold"
                    style={{ background: 'rgba(245,197,24,0.15)', color: 'var(--color-accent)' }}>
                    {(r.nombre || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {r.nombre || 'Sin nombre'}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                      {r.montoPrestado ? `$${Number(r.montoPrestado).toLocaleString()}` : 'Sin monto'}
                      {r.numeroCuotas ? ` · ${r.numeroCuotas} cuotas` : ''}
                      {r.tasaInteres ? ` · ${r.tasaInteres}%` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={crearDesdeResultados}
              disabled={enviando}
              className="w-full h-12 rounded-[12px] text-base font-bold transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--color-accent)', color: '#111' }}>
              {enviando ? 'Creando...' : `Importar ${resultados.length === 1 ? 'este cliente' : `${resultados.length} clientes`}`}
            </button>

            <button onClick={reintentar} className="w-full text-[12px] text-center py-2 cursor-pointer transition-colors"
              style={{ color: 'var(--color-text-muted)' }}>
              Subir otra foto
            </button>
          </div>
        )}

        {/* Sin resultados */}
        {estado === 'listo' && resultados.length === 0 && (
          <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--color-warning)_25%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_5%,transparent)] p-4 text-center">
            <p className="text-[14px] font-medium mb-2" style={{ color: 'var(--color-warning)' }}>No encontramos datos claros</p>
            <p className="text-[12px] mb-3" style={{ color: 'var(--color-text-muted)' }}>Intenta con una foto mas nítida o con mejor luz.</p>
            <button onClick={reintentar}
              className="text-[13px] font-medium underline underline-offset-2 cursor-pointer"
              style={{ color: 'var(--color-text-secondary)' }}>
              Intentar de nuevo
            </button>
          </div>
        )}

        {/* Error */}
        {estado === 'error' && (
          <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--color-danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_5%,transparent)] p-4 text-center">
            <p className="text-[14px] font-medium mb-2" style={{ color: 'var(--color-danger)' }}>{mensajeError}</p>
            <button onClick={reintentar}
              className="text-[13px] font-medium underline underline-offset-2 cursor-pointer"
              style={{ color: 'var(--color-text-secondary)' }}>
              Intentar de nuevo
            </button>
          </div>
        )}
      </div>

      {/* Saltar */}
      {(estado === 'idle' || estado === 'error') && (
        <div className="pt-4 pb-2">
          <button onClick={onSkip}
            className="w-full text-[12px] text-center py-2 cursor-pointer transition-colors"
            style={{ color: 'var(--color-text-muted)' }}>
            No tengo cartulinas, quiero registrar manualmente
          </button>
        </div>
      )}
    </div>
  )
}
