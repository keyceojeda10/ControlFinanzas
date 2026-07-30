// components/ui/ProgressBar.jsx

export default function ProgressBar({ value = 0, color, height = 6, animated = true, className = '' }) {
  const pct = Math.min(100, Math.max(0, value))

  return (
    <div
      className={`w-full rounded-full overflow-hidden ${className}`}
      style={{ height: `${height}px`, background: 'var(--cf-fill)' }}
    >
      <div
        className={animated ? 'animate-grow' : ''}
        style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: 'inherit',
          background: color || 'var(--cf-green-dark)',
          transformOrigin: 'left',
        }}
      />
    </div>
  )
}
