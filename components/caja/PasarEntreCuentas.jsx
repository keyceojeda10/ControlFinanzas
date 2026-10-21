'use client'
// components/caja/PasarEntreCuentas.jsx — pasar plata de una cuenta a otra.
//
// Préstamos Quintero Esteves, 21 oct 2026: para prestar $1.000.000 con $400.000
// en Nequi y $600.000 en Bancolombia, el préstamo deja elegir UNA cuenta y la
// caja quedaba al revés de la del banco. Aquí pasa los $400.000 a Bancolombia
// antes de prestar. No cambia el capital del negocio: solo dónde está.

import { useState, useEffect } from 'react'
import { useCountry } from '@/hooks/useCountry'
import HojaInferior from '@/components/cf/HojaInferior'
import MoneyInput from '@/components/ui/MoneyInput'
import { BotonPrimario, Chip, EtiquetaCampo, AyudaCampo, Aviso, Campo } from '@/components/cf/primitivos'
import { cuentasElegibles } from '@/lib/adaptadores/cuentas'

function Elegir({ etiqueta, cuentas, valor, onElegir, quitar, formatMoney }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <EtiquetaCampo>{etiqueta}</EtiquetaCampo>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {cuentas.filter((c) => c.key !== quitar).map((c) => (
          <Chip key={c.key} activo={valor === c.key} onClick={() => onElegir(c.key)} aria-pressed={valor === c.key}>
            {c.nombre} · {formatMoney(Math.round(c.neto))}
          </Chip>
        ))}
      </div>
    </div>
  )
}

export default function PasarEntreCuentas({ abierta, onCerrar, onHecho }) {
  const { formatMoney } = useCountry()
  const [cuentas, setCuentas] = useState(null)
  const [desde, setDesde] = useState('')
  const [hacia, setHacia] = useState('')
  const [monto, setMonto] = useState('')
  const [nota, setNota] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  // Los saldos de AHORA («Todo»), aunque la pantalla de atrás mire «Hoy».
  useEffect(() => {
    if (!abierta) return
    let vivo = true
    setDesde(''); setHacia(''); setMonto(''); setNota(''); setError(''); setCuentas(null)
    fetch('/api/caja/cuentas?periodo=todo', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('error'))))
      .then((d) => { if (vivo) setCuentas(cuentasElegibles(d.cuentas)) })
      .catch(() => { if (vivo) setError('No pude cargar tus cuentas.') })
    return () => { vivo = false }
  }, [abierta])

  const n = Math.round(Number(String(monto).replace(/[^0-9]/g, '')) || 0)
  const de = cuentas?.find((c) => c.key === desde)
  const a = cuentas?.find((c) => c.key === hacia)
  const listo = de && a && n > 0 && !enviando

  const pasar = async () => {
    if (!listo) return
    setEnviando(true)
    setError('')
    try {
      const res = await fetch('/api/caja/cuentas/traslado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ desde, hacia, monto: n, nota }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'No se pudo pasar la plata')
      onHecho?.(`Pasaste ${formatMoney(n)} de ${de.nombre} a ${a.nombre}`)
      onCerrar?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <HojaInferior
      abierta={abierta}
      onCerrar={onCerrar}
      titulo="Pasar plata entre cuentas"
      subtitulo="Tu capital no cambia: solo en qué cuenta está"
      accion={
        <BotonPrimario onClick={pasar} disabled={!listo} style={{ opacity: listo ? 1 : 0.5 }}>
          {enviando ? 'Pasando…' : n > 0 ? `Pasar ${formatMoney(n)}` : 'Pasar'}
        </BotonPrimario>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 8 }}>
        {!cuentas && !error && <AyudaCampo>Cargando tus cuentas…</AyudaCampo>}

        {cuentas && cuentas.length < 2 && (
          <Aviso>
            Necesitas al menos dos cuentas. Agrega tus cuentas (Nequi, Bancolombia…) en Configuración → Tu negocio.
          </Aviso>
        )}

        {cuentas && cuentas.length >= 2 && (
          <>
            <Elegir etiqueta="De dónde sale" cuentas={cuentas} valor={desde} formatMoney={formatMoney}
              onElegir={(k) => { setDesde(k); if (k === hacia) setHacia('') }} />
            <Elegir etiqueta="A dónde entra" cuentas={cuentas} valor={hacia} quitar={desde} formatMoney={formatMoney}
              onElegir={setHacia} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <EtiquetaCampo>Cuánto pasas</EtiquetaCampo>
              <MoneyInput value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <EtiquetaCampo>Nota (opcional)</EtiquetaCampo>
              <Campo value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} placeholder="Para el préstamo de Juan" />
            </div>

            {/* Lo que queda en cada una, antes de tocar el botón. */}
            {de && a && n > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink-2)' }}>
                  {de.nombre} queda en <strong style={{ color: de.neto - n < 0 ? 'var(--cf-red-dark)' : 'var(--cf-ink)' }}>{formatMoney(Math.round(de.neto - n))}</strong>
                </span>
                <span className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink-2)' }}>
                  {a.nombre} queda en <strong style={{ color: 'var(--cf-ink)' }}>{formatMoney(Math.round(a.neto + n))}</strong>
                </span>
              </div>
            )}
          </>
        )}

        {error && <Aviso tono="rojo">{error}</Aviso>}
      </div>
    </HojaInferior>
  )
}
