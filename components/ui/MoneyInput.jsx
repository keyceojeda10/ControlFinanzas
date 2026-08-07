'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'

function formatWithDots(val) {
  const num = String(val).replace(/\D/g, '')
  if (!num) return ''
  return Number(num).toLocaleString('es-CO')
}

/* ── LA VARIANTE GRANDE (T16-00) ────────────────────────────────────────────
 * La lámina pone el monto del préstamo a 40px y con los atajos ($500k, $800k,
 * $1M) DENTRO del propio campo, a la derecha. Es la cifra alrededor de la que
 * gira la pantalla entera y salía igual que la cédula.
 *
 * ⚠ VA COMO VARIANTE DE ESTE COMPONENTE, NO COMO UN `<input>` NUEVO. Ya
 * reemplacé `MoneyInput` por uno propio en otro rediseño y me llevé por delante
 * el MODO ABREVIADO: el interruptor seguía encendido sin hacer nada y el
 * cobrador creyó que se le había desactivado solo. Todo lo de arriba —el x1000,
 * el «= 100.000», el formateo con puntos— tiene que seguir funcionando igual.
 *
 * ⚠ Y LLEVA `.cf-campo-grande`. `globals.css` fuerza `font-size:16px !important`
 * a TODO input por debajo de 1024px para que iOS no haga zoom; sin esa clase,
 * pedir 40px da 16 y el campo sale MÁS PEQUEÑO que las cifras de al lado. En el
 * código se ve correcto: solo aparece midiendo en el navegador.
 */
const MEDIDAS = {
  normal: {
    campo: 'h-11 rounded-[12px] text-sm pl-8 pr-3',
    signo: 'left-3 text-sm',
  },
  grande: {
    campo: 'cf-campo-grande h-[68px] rounded-[14px] pl-11 text-[34px] font-semibold tracking-[-.02em]',
    signo: 'left-4 text-[24px] font-semibold',
  },
}

export default function MoneyInput({
  label, value, onChange, placeholder, error, className = '', containerClassName = '',
  tamano = 'normal', sufijo = null, ...props
}) {
  const { modoAbreviado } = useAuth()
  const abreviado = modoAbreviado
  const grande = tamano === 'grande'
  const medidas = MEDIDAS[tamano] ?? MEDIDAS.normal

  const toDisplay = useCallback((v) => {
    if (!abreviado || !v) return v
    const n = Number(String(v).replace(/\D/g, ''))
    return n ? String(Math.round(n / 1000)) : ''
  }, [abreviado])

  const [display, setDisplay] = useState(() => formatWithDots(toDisplay(value)))
  const inputRef = useRef(null)
  const isEditingRef = useRef(false)

  useEffect(() => {
    if (isEditingRef.current) return
    const raw = String(toDisplay(value)).replace(/\D/g, '')
    const displayed = String(display).replace(/\D/g, '')
    if (raw !== displayed) {
      setDisplay(formatWithDots(toDisplay(value)))
    }
  }, [value, abreviado]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e) => {
    isEditingRef.current = true
    const raw = e.target.value.replace(/\D/g, '')
    setDisplay(formatWithDots(raw))
    const realValue = abreviado && raw ? String(Number(raw) * 1000) : raw
    onChange?.({ target: { value: realValue } })
    requestAnimationFrame(() => { isEditingRef.current = false })
  }

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label className="text-xs font-medium text-[var(--cf-ink-2)]">{label}</label>
      )}
      <div className="relative flex items-center">
        <span className={`absolute pointer-events-none select-none text-[var(--cf-ink-3)] ${medidas.signo}`}>$</span>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          className={[
            'cf-input w-full border',
            medidas.campo,
            'focus:outline-none',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error ? 'cf-input-error' : '',
            className,
          ].join(' ')}
          style={{
            // La variante grande va sobre PAPEL, no sobre el relleno gris: en la
            // lámina es la caja blanca que manda en la pantalla.
            background: grande ? 'var(--cf-card)' : 'var(--cf-fill)',
            borderColor: grande && String(display).length ? 'var(--cf-gold)' : 'var(--cf-border)',
            borderWidth: grande && String(display).length ? '1.5px' : '1px',
            color: 'var(--cf-ink)',
            // sitio para los atajos, que van dentro del campo
            paddingRight: grande ? (sufijo ? 'var(--cf-hueco-sufijo, 232px)' : '16px') : undefined,
          }}
          value={display}
          onChange={handleChange}
          placeholder={placeholder || (abreviado ? 'Ej: 100 = 100.000' : 'Ej: 500.000')}
          {...props}
        />
        {sufijo && (
          <div className="absolute right-2.5 flex items-center gap-1.5">{sufijo}</div>
        )}
        {abreviado && !sufijo && (
          <span className={`absolute right-3 font-medium pointer-events-none select-none ${grande ? 'text-xs' : 'text-[10px]'}`} style={{ color: 'var(--cf-ink-3)' }}>
            x1.000
          </span>
        )}
      </div>
      {abreviado && display && (
        <p className="text-[11px] font-semibold" style={{ color: 'var(--cf-gold)' }}>
          = {formatWithDots(String(Number(String(display).replace(/\D/g, '')) * 1000))}
        </p>
      )}
      {error && <p className="text-xs text-[var(--cf-red-dark)]">{error}</p>}
    </div>
  )
}
