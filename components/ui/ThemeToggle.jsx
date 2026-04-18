'use client'

import { useTheme } from '@/lib/theme/ThemeProvider'

export default function ThemeToggle({ variant = 'button' }) {
  const { theme, resolvedTheme, setTheme } = useTheme()

  if (variant === 'segmented') {
    const opts = [
      { val: 'light',  label: 'Claro',   icon: SunIcon },
      { val: 'dark',   label: 'Oscuro',  icon: MoonIcon },
      { val: 'system', label: 'Sistema', icon: DesktopIcon },
    ]
    return (
      <div className="inline-flex rounded-[12px] p-1 gap-1" style={{ background: 'var(--color-bg-hover)', border: '1px solid var(--color-border)' }}>
        {opts.map(o => {
          const Icon = o.icon
          const active = theme === o.val
          return (
            <button
              key={o.val}
              onClick={() => setTheme(o.val)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-medium transition-all"
              style={{
                background: active ? 'var(--color-accent)' : 'transparent',
                color: active ? '#1a1a2e' : 'var(--color-text-secondary)',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {o.label}
            </button>
          )
        })}
      </div>
    )
  }

  const toggle = () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  return (
    <button
      onClick={toggle}
      title={`Cambiar a tema ${resolvedTheme === 'dark' ? 'claro' : 'oscuro'}`}
      className="flex items-center justify-center w-9 h-9 rounded-[10px] transition-colors"
      style={{
        background: 'var(--color-bg-hover)',
        border: '1px solid var(--color-border)',
        color: 'var(--color-text-primary)',
      }}
    >
      {resolvedTheme === 'dark' ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
    </button>
  )
}

function SunIcon({ className = '' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function MoonIcon({ className = '' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  )
}

function DesktopIcon({ className = '' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
}
