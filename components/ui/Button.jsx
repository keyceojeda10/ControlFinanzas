// components/ui/Button.jsx

import { forwardRef } from 'react'

const variants = {
  primary:   'cf-btn-primary',
  secondary: 'cf-btn-secondary',
  danger:    'cf-btn-danger',
  ghost:     'cf-btn-ghost',
  success:   'cf-btn-success',
}

/* ⚠ LAS TRES ALTURAS ESTABAN FUERA DE LA ESCALA DEL SISTEMA.
 *
 * Eran `h-9` (36px), `h-11` (44px) y `h-12` (48px). Las dos primeras no existen
 * en `11-ESCALAS-Y-CONSISTENCIA.md §3`, que solo admite
 * 76·74·56·52·48·42·40·38·34. Y como `md` es el valor POR DEFECTO, los 90 de
 * 127 usos que no pasan `size` salían a 44px — una altura que el sistema no
 * tiene. Ese solo dato explica la mayor parte de los «botones de tamaños
 * distintos sin justificación» que reportó el dueño.
 *
 * La escala nueva, con el papel de cada uno:
 *   sm → 48px  botón dentro de una tarjeta (§4: ahí el máximo es 48)
 *   md → 52px  botón primario normal
 *   lg → 56px  remate de un flujo de cobro
 *
 * Los 36 usos de `sm` que hay hoy son botones de tarjeta —guardar teléfono,
 * guardar nombre— así que 48px es exactamente su papel.
 *
 * El texto también sube: la escala Manrope de §1C dice 16px/700 para el texto
 * de un botón primario y 15px para el secundario. `text-xs` (12px) en un botón
 * de 48px se veía perdido.
 */
const sizes = {
  sm: 'h-12 px-4 text-[15px] gap-2',
  md: 'h-[52px] px-5 text-[16px] gap-2',
  lg: 'h-14 px-6 text-[16px] gap-2',
}

export const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size    = 'md',
    loading = false,
    icon,
    className = '',
    ...props
  },
  ref
) {
  const base = [
    // Radio 14: el que §2 asigna al botón primario y secundario. Estaba en 12,
    // que es el del botón de ICONO. Ningún botón tenía el radio que le tocaba.
    'inline-flex items-center justify-center font-semibold rounded-[14px]',
    'border cursor-pointer select-none',
    'transition-[background,color,border-color,box-shadow,transform,filter] duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--cf-surface)]',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
    variants[variant] ?? variants.primary,
    sizes[size]       ?? sizes.md,
    className,
  ].join(' ')

  return (
    <button ref={ref} className={base} disabled={loading || props.disabled} {...props}>
      {loading ? (
        <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  )
})
