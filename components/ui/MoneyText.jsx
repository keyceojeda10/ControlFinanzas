// components/ui/MoneyText.jsx
// Cifras monetarias con Space Grotesk, tabular-nums, tracking -0.02em

export default function MoneyText({ value, currency = '$', size = 'md', color, className = '', style: extraStyle }) {
  const sizes = {
    xs:   'text-[13px]',
    sm:   'text-[16px]',
    md:   'text-[24px]',
    lg:   'text-[29px]',
    xl:   'text-[34px]',
    hero: 'text-[44px]',
  }

  const formatted = typeof value === 'number'
    ? value.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : value

  return (
    <span
      className={`font-mono-display font-bold ${sizes[size] || sizes.md} ${className}`}
      style={{
        color: color || 'var(--color-text-primary)',
        ...extraStyle,
      }}
    >
      {currency}{formatted}
    </span>
  )
}
