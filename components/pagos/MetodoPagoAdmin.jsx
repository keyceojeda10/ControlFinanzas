'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Toggle } from '@/components/ui/Toggle'

const ICON_TRANSFER = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
  </svg>
)

const ICON_PLUS = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
)

const ICON_TRASH = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
)

export default function MetodoPagoAdmin() {
  const [metodos, setMetodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [nuevo, setNuevo] = useState('')
  const [agregando, setAgregando] = useState(false)
  const [error, setError] = useState('')

  const fetchMetodos = async () => {
    try {
      const r = await fetch('/api/metodos-pago')
      if (r.ok) setMetodos(await r.json())
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { fetchMetodos() }, [])

  /* ── ¿DE QUIÉN ES LA PLATA QUE ENTRA POR ESTA CUENTA? ─────────────────────
     Ver el porqué largo en `lib/dinero/cuentas.js`. Se guarda al vuelo y se
     refresca desde el servidor: la cifra que cambia detrás es la caja del
     cobrador, así que la pantalla no debe creerse su propio optimismo. */
  const marcarDelCobrador = async (id, valor) => {
    setError('')
    setMetodos((prev) => prev.map((m) => (m.id === id ? { ...m, esDelCobrador: valor } : m)))
    try {
      const r = await fetch(`/api/metodos-pago/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ esDelCobrador: valor }),
      })
      if (!r.ok) throw new Error()
      fetchMetodos()
    } catch {
      setError('No se pudo guardar. Revisa la conexión.')
      fetchMetodos()
    }
  }

  const agregar = async () => {
    if (!nuevo.trim()) return
    setAgregando(true)
    setError('')
    try {
      const r = await fetch('/api/metodos-pago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nuevo.trim() }),
      })
      if (r.ok) {
        setNuevo('')
        await fetchMetodos()
      } else {
        const d = await r.json().catch(() => ({}))
        setError(d.error || 'Error al agregar')
      }
    } catch {
      setError('Error de conexion')
    } finally {
      setAgregando(false)
    }
  }

  const eliminar = async (id) => {
    try {
      const r = await fetch(`/api/metodos-pago/${id}`, { method: 'DELETE' })
      if (r.ok) await fetchMetodos()
    } catch {}
  }

  if (loading) {
    return (
      <Card>
        <div className="h-20 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--cf-border)', borderTopColor: 'transparent' }} />
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-[8px] flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--cf-ink-2) 15%, transparent)', color: 'var(--cf-ink-2)' }}>
          {ICON_TRANSFER}
        </div>
        <h3 className="font-medium text-sm" style={{ color: 'var(--cf-ink)' }}>Medios de transferencia</h3>
      </div>
      <p className="text-xs mb-4" style={{ color: 'var(--cf-ink-3)' }}>
        Cuando un cobrador registra un pago por transferencia, puede elegir el medio. Estos aparecen para toda tu organizacion.
      </p>

      <div className="space-y-2 mb-4">
        {metodos.map(m => (
          <div
            key={m.id}
            className="px-3 py-2.5 rounded-[10px] border"
            style={{ borderColor: 'var(--cf-border)', background: 'var(--cf-fill)' }}
          >
            <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-[6px] flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--cf-ink-2) 12%, transparent)', color: 'var(--cf-ink-2)' }}>
                {ICON_TRANSFER}
              </div>
              <span className="text-sm font-medium truncate" style={{ color: 'var(--cf-ink)' }}>{m.nombre}</span>
              {m.esPredeterminado && (
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md shrink-0" style={{ background: 'color-mix(in srgb, var(--cf-ink-2) 12%, transparent)', color: 'var(--cf-ink-2)' }}>Default</span>
              )}
            </div>
            <button
              onClick={() => eliminar(m.id)}
              className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0 transition-colors"
              style={{ color: 'var(--cf-ink-3)' }}
              title="Eliminar"
            >
              {ICON_TRASH}
            </button>
            </div>

            {/* ── ⚠ LA PREGUNTA QUE DECIDE LA CAJA DE LA NOCHE ──────────────
                Hasta ahora el sistema daba por hecho que TODA transferencia
                llega a la oficina. Es lo que hace PRESTA MIL —«saben que ese
                dinero llegó a la cuenta de la oficina y el resto lo traen en
                efectivo»— pero no tiene por qué serlo en todos.

                Apagado, la plata que entra aquí no va en el fajo que el
                cobrador entrega. Encendido, sí: la recibió él y después se la
                pasa al negocio.

                Se responde una vez por cuenta y el sistema deja de adivinar. */}
            <div className="mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--cf-hairline)' }}>
              <Toggle
                size="sm"
                checked={!!m.esDelCobrador}
                onChange={(v) => marcarDelCobrador(m.id, v)}
                label="Le llega al cobrador"
                description={m.esDelCobrador
                  ? 'La recibe el cobrador y después te la entrega, así que cuenta en su caja del día.'
                  : 'Entra directo a tu cuenta. El cobrador no la toca, así que no se la pedimos al cerrar.'}
              />
            </div>
          </div>
        ))}
        {metodos.length === 0 && (
          <p className="text-xs text-center py-3" style={{ color: 'var(--cf-ink-3)' }}>No hay medios configurados. Agrega uno para empezar.</p>
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={nuevo}
          onChange={e => setNuevo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && agregar()}
          placeholder="Ej: Nequi, Daviplata..."
          /* ⚠ `min-w-0` NO SOBRA. Sin él, el campo no puede encogerse por debajo
             de su ancho intrínseco —`min-width: auto` es el defecto de todo hijo
             de un flex— y con la letra a 16px que `globals.css` le fuerza en
             móvil, ese mínimo son 210px. Con el botón en 113 y el hueco de 8, la
             fila pedía 331px en una caja de 298: el botón se salía 33px y 16 de
             ellos por fuera de la tarjeta. Medido en el DOM a 372px de ancho.

             Y la altura pasa de `h-9` a `h-12` para igualar al botón: `size="sm"`
             ya no son 36px, son 48. La escala quitó las alturas de 36 y 44 y
             este campo se quedó con la de antes. */
          className="flex-1 min-w-0 h-12 px-3 rounded-[10px] border text-sm outline-none transition-all"
          style={{ borderColor: 'var(--cf-border)', background: 'var(--cf-fill)', color: 'var(--cf-ink)' }}
        />
        <Button
          size="sm"
          onClick={agregar}
          loading={agregando}
          disabled={!nuevo.trim()}
        >
          <span className="flex items-center gap-1">{ICON_PLUS} Agregar</span>
        </Button>
      </div>
      {error && <p className="text-xs mt-2" style={{ color: 'var(--cf-red-dark)' }}>{error}</p>}
    </Card>
  )
}
