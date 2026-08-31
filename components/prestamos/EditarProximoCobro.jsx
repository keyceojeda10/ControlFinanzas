'use client'

// components/prestamos/EditarProximoCobro.jsx — T19-01 «Aplazar el cobro».
//
// PIEL NUEVA, MOTOR IGUAL. El envío sigue siendo el de siempre —`modo:
// 'proximoCobro'` sobre `/api/prestamos/[id]`— y la restauración de la fecha
// automática también, que es la salida del bug de `proximoCobroManual` pisando el
// día ancla.
//
// LO QUE SE AÑADE: el motivo se GUARDA. `VisitaReagendada` ya lo modela con cinco
// valores —`no_estaba`, `negocio_cerrado`, `no_tenia_dinero`, `pidio_plazo`,
// `otro`— y `/api/visitas` ya sabe crearla. Sin eso, «¿qué te dijo?» habría sido un
// control que se mueve y no pasa nada, que es el patrón que ya lleva ocho
// apariciones en este rediseño.
//
// Los motivos son LOS DEL MODELO, no los cuatro que dibuja la lámina. «Le pagan el
// viernes» y «está enfermo» son ejemplos de mockup; el modelo tiene los cinco que
// el negocio de verdad necesita distinguir, y «negocio cerrado» —que la lámina no
// dibuja— es justo el que separa «no me quiso pagar» de «no pude cobrarle».
//
// Y si la visita no se puede guardar, EL APLAZAMIENTO SIGUE. La fecha es lo que
// cambia el cobro de mañana; el motivo es estadística. Perder el aplazamiento por
// no poder anotar el motivo sería cambiar lo importante por lo accesorio.

import { useState, useEffect } from 'react'
import HojaInferior from '@/components/cf/HojaInferior'
import { AplazarCobro, PieGestion } from '@/components/pantallas/Gestion'
import { adaptarAplazar, cuandosDeAplazar, fechaCorta } from '@/lib/adaptadores/gestion'

/* Los cinco de `VisitaReagendada`, con la etiqueta en cristiano. El orden es el de
   frecuencia real en la calle: no estaba primero, «otro» al final. */
const MOTIVOS = [
  { id: 'no_estaba', etiqueta: 'No estaba' },
  { id: 'no_tenia_dinero', etiqueta: 'No tenía plata' },
  { id: 'pidio_plazo', etiqueta: 'Pidió plazo' },
  { id: 'negocio_cerrado', etiqueta: 'Negocio cerrado' },
  { id: 'otro', etiqueta: 'Otro' },
]

/** `YYYY-MM-DD` en hora local, que es lo que el endpoint espera. `toISOString()`
    sobre una fecha local resta el desfase y puede devolver el día anterior. */
function aISO(d) {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

export default function EditarProximoCobro({
  /* La flecha de volver al menú de Gestión, si se llegó desde ahí. */
  onVolver, prestamoId, prestamo, open, onClose, onSuccess }) {
  const [fecha, setFecha] = useState('')
  const [cuando, setCuando] = useState('tres')
  const [motivo, setMotivo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Las tres casillas se calculan al abrir y no en cada render: con `new Date()`
  // dentro del cuerpo, «mañana» cambiaría de día si la hoja queda abierta a
  // medianoche, y peor, las fechas se recalcularían en cada tecleo.
  const [cuandos, setCuandos] = useState(() => cuandosDeAplazar())

  useEffect(() => {
    if (!open) return
    setError('')
    setMotivo(null)
    const opciones = cuandosDeAplazar()
    setCuandos(opciones)
    // Arranca en «en 3 días», que es la que la lámina trae marcada: aplazar un día
    // suele significar volver a aplazar mañana.
    setCuando('tres')
    setFecha(aISO(opciones[1].fecha))
  }, [open])

  const handleClose = () => { setError(''); onClose?.() }

  const elegirCuando = (c) => {
    setCuando(c.id)
    if (c.fecha) setFecha(aISO(c.fecha))
  }

  const handleSubmit = async () => {
    if (!fecha) { setError('Elige para cuándo'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/prestamos/${prestamoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: 'proximoCobro', proximoCobro: fecha }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'No se pudo aplazar')

      // El motivo, si se eligió. En su propio `try`: si esto falla, el aplazamiento
      // ya está hecho y no se deshace por no haber podido anotar la razón.
      if (motivo && prestamo?.cliente?.id) {
        try {
          await fetch('/api/visitas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clienteId: prestamo.cliente.id,
              prestamoId,
              rutaId: prestamo?.cliente?.rutaId ?? undefined,
              fechaOriginal: prestamo?.proximoCobro ?? new Date().toISOString(),
              fechaReagendada: fecha,
              motivo,
            }),
          })
        } catch {}
      }

      onSuccess?.()
      handleClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRestaurar = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/prestamos/${prestamoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: 'proximoCobro', proximoCobro: null }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'No se pudo restaurar')
      onSuccess?.()
      handleClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const datos = adaptarAplazar(prestamo, fecha) ?? {}
  const elegida = cuandos.find((c) => c.id === cuando)

  return (
    <HojaInferior
      onVolver={onVolver}
      abierta={open}
      onCerrar={handleClose}
      titulo="Aplazar el cobro"
      subtitulo={[
        prestamo?.cliente?.nombre,
        Number(prestamo?.diasMora ?? 0) > 0
          ? `lleva ${prestamo.diasMora} ${prestamo.diasMora === 1 ? 'día' : 'días'} de atraso`
          : null,
      ].filter(Boolean).join(' · ') || null}
      accion={
        <PieGestion
          onCancelar={handleClose}
          onAceptar={handleSubmit}
          textoAceptar={datos.cobrasDespues ? `Aplazar al ${datos.cobrasDespues}` : 'Aplazar'}
          aceptando={loading}
          deshabilitado={!fecha}
          error={error}
        />
      }
    >
      <AplazarCobro
        cuandos={cuandos}
        cuando={cuando}
        onCuando={elegirCuando}
        motivos={MOTIVOS}
        motivo={motivo}
        onMotivo={(m) => setMotivo(m.id === motivo ? null : m.id)}
        {...datos}
      />

      {/* «Otra fecha»: el selector nativo, y solo cuando hace falta. Puesto siempre
          serían dos controles para la misma cifra, que es lo que el contador de
          T13-02 vino a arreglar. */}
      {cuando === 'otra' && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 'none' }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
            textTransform: 'uppercase', color: 'var(--cf-ink-3)',
          }}>¿Qué día?</span>
          <input
            type="date"
            value={fecha}
            min={aISO(new Date())}
            onChange={(e) => setFecha(e.target.value)}
            style={{
              height: 52, padding: '0 16px', borderRadius: 14, width: '100%',
              background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
              font: 'inherit', fontSize: 16, color: 'var(--cf-ink)', outline: 'none',
            }}
          />
        </label>
      )}

      {/* LA SALIDA DEL BUG DE `proximoCobroManual`. Mientras ese campo esté puesto,
          pisa el cálculo del día ancla: cambiar la frecuencia o el día de cobro no
          mueve la fecha. Esto es lo que lo limpia, y por eso no se esconde. */}
      {prestamo?.proximoCobroManual && (
        <button type="button" onClick={handleRestaurar} disabled={loading} style={{
          alignSelf: 'flex-start', padding: '0 2px', border: 0, background: 'none',
          cursor: loading ? 'progress' : 'pointer', font: 'inherit', textAlign: 'left',
          fontSize: 12, fontWeight: 700, color: 'var(--cf-gold-dark)',
        }}>
          Volver a la fecha que calcula el sistema
          {prestamo?.proximoCobroManual ? ` (hoy está fijada al ${fechaCorta(prestamo.proximoCobroManual)})` : ''}
        </button>
      )}
    </HojaInferior>
  )
}
