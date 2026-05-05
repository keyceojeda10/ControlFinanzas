'use client'
// components/auth/AuthInput.jsx — Input premium con icono y toggle de password

import { useState } from 'react'

export default function AuthInput({
  label,
  icon,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  id,
  showPasswordToggle = false,
  ...props
}) {
  const [showPass, setShowPass] = useState(false)
  const isPass = type === 'password'
  const realType = isPass && showPass ? 'text' : type

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-[11px] font-medium uppercase tracking-[0.05em]"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <span className="block w-4 h-4">{icon}</span>
          </span>
        )}
        <input
          id={id}
          type={realType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          className="cf-input w-full h-11 rounded-[12px] text-sm transition-all"
          style={{
            paddingLeft:  icon ? '38px' : '12px',
            paddingRight: (isPass && showPasswordToggle) ? '40px' : '12px',
            background:   'rgba(255,255,255,0.03)',
            border:       '1px solid rgba(255,255,255,0.08)',
            color:        'var(--color-text-primary)',
          }}
          {...props}
        />
        {isPass && showPasswordToggle && (
          <button
            type="button"
            onClick={() => setShowPass((v) => !v)}
            tabIndex={-1}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-[8px] flex items-center justify-center hover:bg-white/5 transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPass ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
