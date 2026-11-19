'use client'

import { useState, useEffect } from 'react'
import { useRouter }           from 'next/navigation'
import { signIn }              from 'next-auth/react'
import Link                    from 'next/link'
import { EspinaProgreso }      from '@/components/armazon/CabeceraMovil'
import AuthInput               from '@/components/auth/AuthInput'
import { getCountryConfig, validatePhone, formatMoney } from '@/lib/i18n'
import { tramosDePlan, presentacionDelPlan, INCLUYEN_TODOS } from '@/lib/adaptadores/planes'
import { PLANES_CONFIG, PLANES_DEL_REGISTRO, DIAS_PRUEBA } from '@/lib/planes'
import { getCountryList } from '@/lib/countries'
import { normalizarEmail } from '@/lib/normalizar-email'
import { origenDelRegistro } from '@/lib/origen-registro'

const PAISES = getCountryList()
/* ⚠ ESTA LISTA VA A LA PAR DE `COUNTRIES`. Los países salen de
   `getCountryList()`, pero la bandera se busca aquí: un país nuevo sin su
   entrada aparece en el desplegable SIN icono y nadie se entera hasta que lo
   ve un usuario. Lo vigila `paises-completos.test.js`. */
const FLAGS = {
  co: '\u{1F1E8}\u{1F1F4}', mx: '\u{1F1F2}\u{1F1FD}', pe: '\u{1F1F5}\u{1F1EA}',
  ec: '\u{1F1EA}\u{1F1E8}', do: '\u{1F1E9}\u{1F1F4}', hn: '\u{1F1ED}\u{1F1F3}',
  gt: '\u{1F1EC}\u{1F1F9}', sv: '\u{1F1F8}\u{1F1FB}', ni: '\u{1F1F3}\u{1F1EE}',
  pa: '\u{1F1F5}\u{1F1E6}', ve: '\u{1F1FB}\u{1F1EA}', us: '\u{1F1FA}\u{1F1F8}',
  cr: '\u{1F1E8}\u{1F1F7}',
  // El cono sur
  ar: '\u{1F1E6}\u{1F1F7}', cl: '\u{1F1E8}\u{1F1F1}', bo: '\u{1F1E7}\u{1F1F4}',
  py: '\u{1F1F5}\u{1F1FE}', uy: '\u{1F1FA}\u{1F1FE}',
}

const LIGHT = {
  bg: '#f4f4f1', bgCard: '#ffffff', bgCardHover: 'rgba(20,20,28,0.03)',
  border: 'rgba(20,20,28,0.08)', borderLight: 'rgba(20,20,28,0.06)',
  text: '#15161a', textSecondary: '#676b73', textMuted: '#9a9da5',
  gradient: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(231,164,0,0.10) 0%, transparent 70%)',
  optionBg: '#ffffff',
}
const DARK = {
  bg: '#0c0d11', bgCard: '#16171c', bgCardHover: '#1e2027',
  border: 'rgba(255,255,255,0.08)', borderLight: 'rgba(255,255,255,0.06)',
  text: '#f3f3f6', textSecondary: '#9ea1ab', textMuted: '#666973',
  gradient: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(245,184,36,0.07) 0%, transparent 70%)',
  optionBg: '#16171c',
}

function useTheme() {
  const [light, setLight] = useState(false)
  useEffect(() => {
    const resolve = () => {
      const dt = document.documentElement.getAttribute('data-theme')
      if (dt) return dt === 'light'
      return window.matchMedia('(prefers-color-scheme: light)').matches
    }
    setLight(resolve())
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const handler = () => setLight(resolve())
    mq.addEventListener('change', handler)
    const obs = new MutationObserver(handler)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => { mq.removeEventListener('change', handler); obs.disconnect() }
  }, [])
  return light ? LIGHT : DARK
}

/* ══ EL REGISTRO DE ANTES DEL 16 JUL 2026, CON EL DISEÑO DE HOY (18 nov) ══
   Tres pasos, como el registro que mejor funcionó: 1 · elegir el plan, con su
   precio; 2 · los datos, en una sola pantalla; y verificar el código, que no
   entra en la espina porque ya no es registro sino confirmar.

   Por qué volvió: medido por semana de registro en producción, hasta la semana
   del 6 jul entre el 71 y el 81 % de los nuevos cargaba un cliente en 3 días;
   el 16 jul el registro pasó a cinco mini-pasos y el plan se puso solo, en
   silencio, y cayó al 53 % esa semana y al 35 % las dos siguientes. El dueño:
   «el flujo tal cual, pero adaptado al diseño moderno». El plan elegido llega
   al servidor y la prueba corre en él (`/api/auth/registro`), y el asistente
   ya no lo vuelve a preguntar (`planYaElegido`). */
const PASOS = 2

/* ── EL PIE DEL WIZARD ─────────────────────────────────────────────────────
   Reportado: «el botón no está muy pegado al input… se ve un espacio todo feo
   ahí que no tiene sentido».

   Tenía razón, y el canon lo dibuja así: `T07-02-registro` pone la acción en un
   pie de `flex: none` con fondo propio y borde superior, con «Atrás» y
   «Continuar» EN LA MISMA FILA (`flex: 1` y `flex: 2`, o sea el doble de ancho
   para el que avanza). El botón iba suelto bajo el campo con un `mt-6`, así que
   en una pantalla alta quedaba flotando en medio y debajo un vacío enorme.

   Con el pie abajo, el hueco deja de ser un error: es el respiro entre lo que se
   teclea y lo que se pulsa, y el pulgar llega sin estirarse. */
function PieWizard({ onAtras, onSeguir, seguirBloqueado, seguirTexto = 'Continuar', cargando, theme }) {
  return (
    <div
      /* ⚠ PEGADO ABAJO Y SIEMPRE A LA VISTA.
         Reportado al registrarse de cero: «los botones salen escondidos, hay
         que rodarse un poquito hacia abajo, y es ilógico con el montón de
         espacio que hay».
         Eran dos cosas a la vez:
         1) El contenedor medía `100vh`, y en el navegador móvil eso INCLUYE la
            franja que tapa la barra de direcciones. El pie quedaba anclado al
            fondo de una caja más alta que lo que se ve. Se arregla con `dvh`,
            que es la altura que de verdad queda (el proyecto ya usa el par
            `vh`+`dvh` en las hojas y la barra lateral).
         2) Y aun con la altura buena, un paso largo empujaba el pie fuera de
            la pantalla. Con `sticky` se queda pegado abajo mientras se
            desplaza, así que la acción NUNCA hay que ir a buscarla.
         Lleva fondo propio porque un pie transparente deja pasar el texto por
         debajo de los botones. */
      className="flex-none flex gap-2.5 mt-auto sticky bottom-0 z-10"
      style={{
        padding: '14px 0 calc(14px + env(safe-area-inset-bottom, 0px))',
        marginBottom: 'calc(-1 * env(safe-area-inset-bottom, 0px))',
        background: theme.bg,
        borderTop: `1px solid ${theme.borderLight}`,
      }}
    >
      {onAtras && (
        <button
          type="button"
          onClick={onAtras}
          className="h-12 rounded-[14px] font-semibold text-[15px] transition-all cursor-pointer active:scale-[0.98]"
          style={{ flex: 1, background: theme.bgCard, border: `1px solid ${theme.border}`, color: theme.textSecondary }}
        >
          Atrás
        </button>
      )}
      <button
        type="button"
        onClick={onSeguir}
        disabled={seguirBloqueado || cargando}
        /* `flex: 2` cuando hay «Atrás»: el doble de ancho, como en la lámina.
           No es cosmético — dice cuál de los dos es la acción. */
        className="h-12 rounded-[14px] font-bold text-[16px] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]"
        style={{
          flex: onAtras ? 2 : 1,
          background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 85%, #000))',
          color: '#3a2900',
          boxShadow: '0 2px 8px color-mix(in srgb, var(--color-accent) 25%, transparent)',
        }}
      >
        {cargando ? 'Un momento…' : seguirTexto}
      </button>
    </div>
  )
}

export default function RegistroForm({ refCode, planParam, countryParam, origenParam }) {
  const router = useRouter()
  const t = useTheme()

  const countryInicial = PAISES.some(p => p.code === countryParam) ? countryParam : 'co'

  // Arranca en el primer paso REAL. La portada de bienvenida se quito: nadie se
  // registra para leer una portada, y era un clic entero antes de escribir nada.
  const [step, setStep] = useState(1)
  const [country, setCountry] = useState(countryInicial)
  const countryCfg = getCountryConfig(country)
  // El plan que trae el enlace (la web lo manda en `?plan=`) sale marcado; si no, Inicial.
  const [planElegido, setPlanElegido] = useState(PLANES_DEL_REGISTRO.includes(planParam) ? planParam : 'starter')
  const fmt = (n) => formatMoney(n, country)
  const tramosSolo = tramosDePlan(country, fmt, 2, 'solo')
  const tramosEquipo = tramosDePlan(country, fmt, 3, 'equipo')
  const tramoElegido = [...tramosSolo, ...tramosEquipo].find((x) => x.id === planElegido)
  const nombrePlan = tramoElegido?.texto ?? PLANES_CONFIG[planElegido]?.nombre ?? 'Inicial'
  const precioPlan = tramoElegido?.precio ?? ''
  const nombrePais = PAISES.find((p) => p.code === country)?.name ?? ''

  const [form, setForm] = useState({
    nombre: '',
    nombreOrganizacion: '',
    telefono: '',
    email: '',
    emailConfirm: '',
    password: '',
    passwordConfirm: '',
    terminosAceptados: false,
  })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [referrer, setReferrer] = useState(null)

  const [otpDigits, setOtpDigits]         = useState(['', '', '', '', '', ''])
  const [otpLoading, setOtpLoading]       = useState(false)
  const [otpError, setOtpError]           = useState('')
  const [otpReenviado, setOtpReenviado]   = useState(false)
  const [otpReenviando, setOtpReenviando] = useState(false)
  const [verificarPor, setVerificarPor]   = useState('whatsapp')

  useEffect(() => {
    if (!refCode) return
    fetch(`/api/auth/validar-referido?code=${encodeURIComponent(refCode)}`)
      .then((r) => r.json())
      .then((data) => { if (data.valid) setReferrer({ nombreOrg: data.nombreOrg }) })
      .catch(() => {})
  }, [refCode])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [step])

  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setError('') }

  const goNext = () => setStep(s => s + 1)
  const goBack = () => { setStep(s => s - 1); setError('') }

  const handleSubmit = async () => {
    setError('')
    // Todo en una pantalla, así que se dice qué falta empezando por arriba.
    if (!form.nombreOrganizacion.trim()) { setError('Ingresa el nombre de tu negocio'); return }
    if (!form.nombre.trim()) { setError('Ingresa tu nombre'); return }
    const soloNumeros = form.telefono.replace(/\D/g, '')
    if (!soloNumeros) { setError('Ingresa tu número de WhatsApp'); return }
    if (!validatePhone(soloNumeros, country)) { setError(`Número inválido. Ej: ${countryCfg.phonePlaceholder}`); return }
    if (!form.email.trim()) { setError('Ingresa tu correo electrónico'); return }
    if (normalizarEmail(form.email) !== normalizarEmail(form.emailConfirm)) { setError('Los dos correos no coinciden'); return }
    if (form.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    if (form.password !== form.passwordConfirm) { setError('Las dos contraseñas no coinciden'); return }
    if (!form.terminosAceptados) { setError('Debes aceptar los términos y condiciones'); return }

    const telefonoLimpio = form.telefono.replace(/\D/g, '')

    setLoading(true)
    try {
      const res = await fetch('/api/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombreOrganizacion: form.nombreOrganizacion,
          nombre: form.nombre,
          email: form.email,
          telefono: telefonoLimpio,
          password: form.password,
          terminosAceptados: form.terminosAceptados,
          ...(refCode ? { ref: refCode } : {}),
          plan: planElegido,
          country,
          canal: verificarPor,
          // De dónde vino: la web lo manda en `?o=` (lib/origen-registro.js).
          origen: origenDelRegistro(origenParam),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al registrar'); return }

      if (typeof window !== 'undefined' && window.fbq) window.fbq('track', 'Lead')
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'conversion', {
          send_to: 'AW-18050279366/LY3nCKOGrcgcEMbPhZ9D',
          value: 39000.0, currency: 'COP',
        })
      }
      /* ⚠ `PASOS + 1`, NO un número escrito a mano.
         Aquí decía `setStep(5)` y al juntar nombre y negocio la verificación
         pasó a ser el paso 4: la cuenta se creaba bien y la pantalla siguiente
         salía EN BLANCO, porque ningún bloque responde al 5. No lo cazó ni el
         build ni las pruebas — solo se ve registrándose de verdad.

         Atado a `PASOS` para que el día que se añada o quite un paso, esto
         siga apuntando a la verificación y no a la nada. */
      setStep(PASOS + 1)
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerificarOtp = async (codigoFinal) => {
    const codigo = codigoFinal || otpDigits.join('')
    if (codigo.length !== 6) { setOtpError('Ingresa el código de 6 dígitos'); return }
    setOtpLoading(true)
    setOtpError('')
    try {
      const res = await fetch('/api/auth/verificar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizarEmail(form.email), codigo }),
      })
      const data = await res.json()
      if (!res.ok) { setOtpError(data.error || 'Código inválido'); setOtpLoading(false); return }

      const login = await signIn('credentials', {
        email: normalizarEmail(form.email),
        password: form.password,
        redirect: false,
      })
      if (login?.ok) { router.push('/dashboard'); return }
      router.push('/login')
    } catch {
      setOtpError('Error de conexión')
    } finally {
      setOtpLoading(false)
    }
  }

  const handleSaltarVerificacion = async () => {
    setOtpLoading(true)
    const login = await signIn('credentials', {
      email: normalizarEmail(form.email),
      password: form.password,
      redirect: false,
    })
    if (login?.ok) { router.push('/dashboard'); return }
    router.push('/login')
  }

  const handleReenviarOtp = async () => {
    if (otpReenviando || otpReenviado) return
    setOtpReenviando(true)
    try {
      await fetch('/api/auth/reenviar-verificacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizarEmail(form.email), canal: verificarPor }),
      })
      setOtpReenviado(true)
      setOtpDigits(['', '', '', '', '', ''])
      setOtpError('')
      setTimeout(() => setOtpReenviado(false), 30000)
    } finally {
      setOtpReenviando(false)
    }
  }

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return
    const newDigits = [...otpDigits]
    newDigits[index] = value.slice(-1)
    setOtpDigits(newDigits)
    if (value && index < 5) document.getElementById(`otp-${index + 1}`)?.focus()
    if (value && index === 5) {
      const codigo = newDigits.join('')
      if (codigo.length === 6) handleVerificarOtp(codigo)
    }
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0)
      document.getElementById(`otp-${index - 1}`)?.focus()
  }

  const handleOtpPaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const newDigits = [...otpDigits]
    for (let i = 0; i < 6; i++) newDigits[i] = pasted[i] || ''
    setOtpDigits(newDigits)
    if (pasted.length === 6) handleVerificarOtp(pasted)
  }

  const selectedFlag = FLAGS[country] || '\u{1F310}'
  const accentColor = verificarPor === 'whatsapp' ? '#25d366' : 'var(--color-accent)'

  return (
    <div
      /* `min-h-screen` (100vh) se queda de respaldo para navegadores viejos y
         `min-h-[100dvh]` manda donde se entiende: en móvil, 100vh cuenta la
         franja de la barra de direcciones, y todo lo anclado abajo queda fuera
         de la vista. */
      className="min-h-screen min-h-[100dvh] flex flex-col"
      style={{ background: t.bg }}
    >
      <div className="absolute inset-x-0 top-0 h-64 pointer-events-none" style={{ background: t.gradient }} />

      {/* ── EL PIE, ABAJO DE VERDAD ──
          Reportado: «se ve un espacio todo feo ahí que no tiene sentido».

          El pie ya estaba, pero la columna no tenía altura: se quedaba donde
          acabara el contenido —a media pantalla— y debajo un vacío enorme.
          Medido a 393×852: el botón caía en y=412 de 852.

          `flex-1` en la columna y `mt-auto` en el pie: el contenido se queda
          arriba y la acción baja al borde, que es donde llega el pulgar. En
          escritorio se centra, que es donde tiene sentido. */}
      <div className="relative flex-1 flex flex-col items-center px-5 py-8 lg:py-12">
        <div className="w-full max-w-md flex-1 flex flex-col lg:flex-none">

          {/* Logo */}
          <div className="mb-6">
            <Link href="/login" className="inline-flex items-center gap-2.5">
              <img src="/logo-icon.svg" alt="" width={36} height={36} />
              <span className="flex flex-col leading-[1.1]" style={{ fontFamily: 'var(--font-space-grotesk)', color: t.text }}>
                <span className="text-[15px] font-bold tracking-[-0.01em]">Control</span>
                <span className="text-[13px] font-medium tracking-[0.02em]" style={{ color: t.textSecondary }}>Finanzas</span>
              </span>
            </Link>
          </div>

          {/* La MISMA espina del onboarding: el usuario nuevo ve UNA sola barra
              desde que se registra hasta que carga su cartera, no una por
              tramo. El paso 5 ya no es registro, es confirmar. */}
          {step <= PASOS && (
            <div className="mb-6">
              <EspinaProgreso paso={step} total={PASOS} />
              <p className="text-[11px] mt-2" style={{ color: t.textMuted }}>
                Paso {step} de {PASOS}
              </p>
            </div>
          )}

          {/* Referido badge */}
          {referrer && step < PASOS + 1 && (
            <div className="flex items-center gap-2 rounded-[10px] px-3 py-2 mb-5"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 7%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 20%, transparent)' }}>
              <svg className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-accent)' }} fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-[12px]" style={{ color: 'var(--color-accent)' }}>
                Referido por <strong>{referrer.nombreOrg}</strong>
              </span>
            </div>
          )}

          {/* Error global */}
          {error && step > 0 && step < PASOS + 1 && (
            <div className="flex items-center gap-2.5 text-[13px] rounded-[10px] px-4 py-3 mb-5"
              style={{ background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)', color: 'var(--color-danger)' }}>
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {/* ── Paso 1: el plan ── */}
          {step === 1 && (
            <div className="flex-1 flex flex-col">
              <h1 className="text-[26px] lg:text-[30px] leading-[1.15] font-semibold mb-2"
                style={{ color: t.text, fontFamily: 'var(--font-space-grotesk)' }}>
                Crea tu cuenta
              </h1>
              <p className="text-[15px] mb-5" style={{ color: t.textSecondary }}>
                {DIAS_PRUEBA} días gratis · Sin tarjeta de crédito
              </p>

              {/* El país va primero: de él salen los precios de los planes. */}
              <div className="relative mb-6 rounded-[14px] cursor-pointer"
                style={{ background: t.bgCard, border: `1.5px solid ${t.border}` }}>
                <div className="flex items-center gap-3 px-4 h-[52px] pointer-events-none">
                  <span className="text-[20px] leading-none shrink-0">{selectedFlag}</span>
                  <span className="flex-1 text-[16px] font-medium" style={{ color: t.text }}>{nombrePais}</span>
                  <svg className="w-4 h-4 shrink-0" style={{ color: t.textMuted }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
                <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="País"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
                  {PAISES.map(p => (
                    <option key={p.code} value={p.code} style={{ background: t.optionBg, color: t.text }}>{p.name}</option>
                  ))}
                </select>
              </div>

              {[
                { perfil: 'solo', titulo: 'Cobras solo', linea: 'Sin cobradores', tramos: tramosSolo },
                { perfil: 'equipo', titulo: 'Con equipo', linea: 'Tienes cobradores', tramos: tramosEquipo },
              ].map((g) => (
                <div key={g.perfil} className="mb-5">
                  <p className="mb-2.5 text-[15px] font-semibold" style={{ color: t.textSecondary }}>
                    {g.titulo} <span className="font-normal" style={{ color: t.textMuted }}>· {g.linea}</span>
                  </p>
                  <div role="radiogroup" aria-label={g.titulo} className="flex flex-col gap-2.5">
                    {g.tramos.map((tr) => {
                      const elegido = planElegido === tr.id
                      const p = presentacionDelPlan(tr.id)
                      return (
                        <button key={tr.id} type="button" role="radio" aria-checked={elegido}
                          onClick={() => setPlanElegido(tr.id)}
                          className="w-full text-left rounded-[16px] px-4 py-4 flex items-start gap-3 transition-all active:scale-[0.99]"
                          style={{
                            background: elegido ? 'color-mix(in srgb, var(--color-accent) 9%, ' + t.bgCard + ')' : t.bgCard,
                            border: `1.5px solid ${elegido ? 'var(--color-accent)' : t.border}`,
                          }}>
                          <span aria-hidden className="mt-0.5 shrink-0 inline-flex items-center justify-center rounded-full"
                            style={{ width: 22, height: 22, border: `2px solid ${elegido ? 'var(--color-accent)' : t.border}`, background: elegido ? 'var(--color-accent)' : 'transparent' }}>
                            {elegido && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3a2900" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                            )}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="flex items-baseline justify-between gap-3">
                              <span className="flex items-center gap-2 flex-wrap min-w-0">
                                <span className="text-[17px] font-bold" style={{ color: t.text }}>{tr.texto}</span>
                                {/* Junto al nombre y no encima de la esquina: ahí tapaba el precio. */}
                                {p?.popular && (
                                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                                    style={{ background: 'var(--color-accent)', color: '#3a2900' }}>
                                    Popular
                                  </span>
                                )}
                              </span>
                              <span className="cf-num shrink-0 text-[17px] font-bold" style={{ color: t.text, fontFamily: 'var(--font-space-grotesk)' }}>
                                {tr.precio}<span className="text-[12px] font-medium" style={{ color: t.textMuted }}>/mes</span>
                              </span>
                            </span>
                            {/* La frase de julio: dice para quién es, antes de la lista. */}
                            {p?.descripcion && (
                              <span className="block text-[14px] mt-1 leading-snug" style={{ color: t.textSecondary }}>{p.descripcion}</span>
                            )}
                            <span className="flex flex-col gap-1.5 mt-2.5">
                              {(p?.incluye ?? []).map((linea) => (
                                <span key={linea} className="flex items-start gap-2 text-[13px] leading-snug" style={{ color: t.text }}>
                                  <svg className="shrink-0 mt-[2px]" width="14" height="14" viewBox="0 0 24 24" fill="none"
                                    stroke={elegido ? 'var(--color-accent)' : t.textMuted} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                    <path d="M5 13l4 4L19 7" />
                                  </svg>
                                  {linea}
                                </span>
                              ))}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Lo que trae cualquier plan, dicho una vez y no repetido en cada tarjeta. */}
              <div className="rounded-[16px] px-4 py-3.5 mb-4" style={{ background: t.bgCard, border: `1px solid ${t.borderLight}` }}>
                <p className="text-[14px] font-bold mb-2" style={{ color: t.text }}>Todos los planes incluyen</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                  {INCLUYEN_TODOS.map((linea) => (
                    <span key={linea} className="flex items-start gap-2 text-[13px]" style={{ color: t.textSecondary }}>
                      <svg className="shrink-0 mt-[2px]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)"
                        strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 13l4 4L19 7" /></svg>
                      {linea}
                    </span>
                  ))}
                </div>
              </div>

              <p className="text-[12px] leading-relaxed mb-1 px-1" style={{ color: t.textMuted }}>
                Al terminar la prueba quedas en <strong style={{ color: t.text }}>{nombrePlan}</strong>. Puedes cambiar de plan cuando quieras.
              </p>

              <PieWizard
                onSeguir={() => { setError(''); goNext() }}
                seguirTexto={`Continuar con ${nombrePlan}`}
                theme={t}
              />
            </div>
          )}

          {/* ── Paso 2: los datos, en una sola pantalla ── */}
          {step === 2 && (
            <div className="flex-1 flex flex-col">
              <h1 className="text-[26px] lg:text-[30px] leading-[1.15] font-semibold mb-4"
                style={{ color: t.text, fontFamily: 'var(--font-space-grotesk)' }}>
                Tus datos
              </h1>

              {/* El plan elegido, con su salida: «Cambiar» vuelve al paso 1. */}
              <div className="rounded-[14px] px-4 py-3 mb-5 flex items-center justify-between gap-3"
                style={{ background: 'color-mix(in srgb, var(--color-accent) 8%, ' + t.bgCard + ')', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold" style={{ color: t.text }}>Plan {nombrePlan}</span>
                  <span className="block text-[13px]" style={{ color: t.textSecondary }}>
                    {DIAS_PRUEBA} días gratis · luego {precioPlan}/mes
                  </span>
                </span>
                <button type="button" onClick={goBack} className="shrink-0 text-[14px] font-semibold px-3 h-9 rounded-[10px]"
                  style={{ color: t.text, background: t.bgCard, border: `1px solid ${t.border}` }}>
                  Cambiar
                </button>
              </div>

              {/* Por dónde le llega el código: como en julio, se elige. */}
              <p className="mb-2.5 text-[15px] font-semibold" style={{ color: t.textSecondary }}>Recibir el código de verificación por</p>
              <div role="radiogroup" aria-label="Recibir el código por" className="grid grid-cols-2 gap-2.5 mb-6">
                {[
                  { id: 'whatsapp', nombre: 'WhatsApp', linea: 'Recomendado', color: '#25d366' },
                  { id: 'email', nombre: 'Correo', linea: 'Alternativo', color: 'var(--color-accent)' },
                ].map((c) => {
                  const activo = verificarPor === c.id
                  return (
                    /* El logo a la IZQUIERDA del nombre (el dueño): encima agrandaba
                       la caja. Con color propio solo cuando está elegido. */
                    <button key={c.id} type="button" role="radio" aria-checked={activo}
                      onClick={() => { setVerificarPor(c.id); setError('') }}
                      className="rounded-[14px] px-3 py-3 text-left transition-all flex items-center gap-2.5 min-w-0"
                      style={{ background: t.bgCard, border: `1.5px solid ${activo ? c.color : t.border}` }}>
                      <span aria-hidden className="shrink-0 inline-flex items-center justify-center rounded-full"
                        style={{ width: 34, height: 34, background: `color-mix(in srgb, ${c.color} ${activo ? 16 : 10}%, transparent)`, color: c.id === 'whatsapp' ? '#25d366' : (activo ? 'var(--color-accent)' : t.textSecondary) }}>
                        {c.id === 'whatsapp' ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                          </svg>
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[15px] font-bold" style={{ color: t.text }}>{c.nombre}</span>
                        <span className="block text-[12px] leading-tight" style={{ color: activo ? t.textSecondary : t.textMuted }}>{c.linea}</span>
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="space-y-3">
                <AuthInput label="Nombre del negocio" value={form.nombreOrganizacion} onChange={set('nombreOrganizacion')}
                  placeholder="Ej: Préstamos García"
                  icon={<svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21" /></svg>} />
                <AuthInput label="Tu nombre" value={form.nombre} onChange={set('nombre')} placeholder="Ej: Carlos García" autoComplete="name"
                  icon={<svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>} />

                {/* El WhatsApp con el país como prefijo (T07-02-registro). */}
                <div>
                  {/* Mismo rótulo que los demás campos (AuthInput). */}
                  <p className="text-[12.5px] font-bold uppercase tracking-[0.06em] mb-1.5" style={{ color: 'var(--cf-ink-3)' }}>Número de WhatsApp</p>
                  <div className="flex items-stretch rounded-[12px] overflow-hidden"
                    style={{ background: t.bgCard, border: `1.5px solid ${t.border}` }}>
                    <div className="relative flex items-center gap-1.5 pl-3.5 pr-2.5 shrink-0 cursor-pointer"
                      style={{ borderRight: `1px solid ${t.borderLight}` }}>
                      <span className="text-[19px] leading-none">{selectedFlag}</span>
                      <span className="cf-num text-[15px] font-semibold whitespace-nowrap" style={{ color: t.text }}>{countryCfg.phonePrefix}</span>
                      <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="País"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
                        {PAISES.map(p => (
                          <option key={p.code} value={p.code} style={{ background: t.optionBg, color: t.text }}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <input type="tel" inputMode="numeric" value={form.telefono}
                      onChange={(e) => { setForm({ ...form, telefono: e.target.value.replace(/\D/g, '').slice(0, countryCfg.phoneDigits) }); setError('') }}
                      placeholder={countryCfg.phonePlaceholder} autoComplete="tel" maxLength={countryCfg.phoneDigits}
                      aria-label="Número de WhatsApp"
                      className="cf-num flex-1 min-w-0 h-[52px] px-3.5 text-[16px] font-medium bg-transparent outline-none"
                      style={{ color: t.text }} />
                  </div>
                  <p className="text-[12px] mt-1.5" style={{ color: t.textMuted }}>Nunca te vamos a escribir para venderte nada.</p>
                </div>

                <AuthInput label="Correo electrónico" type="email" value={form.email} onChange={set('email')}
                  placeholder="usuario@ejemplo.com" autoComplete="email"
                  icon={<svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>} />
                <AuthInput label="Confirmar correo" type="email" value={form.emailConfirm} onChange={set('emailConfirm')}
                  placeholder="Repite tu correo" autoComplete="email"
                  icon={<svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
                <AuthInput label="Contraseña" type="password" value={form.password} onChange={set('password')}
                  placeholder="Mínimo 8 caracteres" autoComplete="new-password" showPasswordToggle
                  icon={<svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>} />
                <AuthInput label="Confirmar contraseña" type="password" value={form.passwordConfirm} onChange={set('passwordConfirm')}
                  placeholder="Repite tu contraseña" autoComplete="new-password" showPasswordToggle
                  icon={<svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
              </div>

              <label className="flex items-start gap-3 cursor-pointer mt-5">
                <input type="checkbox" checked={form.terminosAceptados}
                  onChange={(e) => setForm({ ...form, terminosAceptados: e.target.checked })}
                  className="mt-0.5 w-5 h-5 rounded cursor-pointer accent-[var(--color-accent)]" />
                <span className="text-[13px] leading-relaxed" style={{ color: t.textSecondary }}>
                  Acepto los{' '}
                  <a href="https://control-finanzas.com/terminos-uso" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--color-accent)' }}>Términos de uso</a>{' '}y la{' '}
                  <a href="https://control-finanzas.com/privacidad" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--color-accent)' }}>Política de privacidad</a>
                </span>
              </label>

              <PieWizard
                onAtras={goBack}
                onSeguir={handleSubmit}
                seguirBloqueado={!form.nombreOrganizacion.trim() || !form.nombre.trim() || !form.telefono.trim() || !form.email.trim() || !form.password || !form.terminosAceptados}
                seguirTexto="Crear cuenta gratis"
                cargando={loading}
                theme={t}
              />
            </div>
          )}

          {/* ── Step 5: Verificacion OTP ── */}
          {step === PASOS + 1 && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center mb-5"
                style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: verificarPor === 'whatsapp' ? 'rgba(37,211,102,0.12)' : 'rgba(245,197,24,0.1)',
                  border: `2px solid ${verificarPor === 'whatsapp' ? 'rgba(37,211,102,0.4)' : 'rgba(245,197,24,0.3)'}`,
                }}>
                {verificarPor === 'whatsapp' ? (
                  <svg style={{ width: 34, height: 34, color: '#25d366' }} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                ) : (
                  <svg style={{ width: 34, height: 34, color: 'var(--color-accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )}
              </div>

              <h2 className="text-[24px] font-bold mb-2" style={{ color: t.text }}>
                {verificarPor === 'whatsapp' ? 'Revisa tu WhatsApp' : 'Verifica tu correo'}
              </h2>
              <p className="text-[14px] mb-1" style={{ color: t.textSecondary }}>
                Enviamos un código de 6 dígitos a
              </p>
              <p className="text-[16px] font-bold mb-5" style={{ color: accentColor }}>
                {verificarPor === 'whatsapp'
                  ? `+${form.telefono.replace(/\D/g, '')}`
                  : normalizarEmail(form.email)}
              </p>

              {/* Toggle canal */}
              <button
                type="button"
                onClick={async () => {
                  const nuevo = verificarPor === 'whatsapp' ? 'email' : 'whatsapp'
                  setVerificarPor(nuevo)
                  setOtpDigits(['', '', '', '', '', ''])
                  setOtpError('')
                  setOtpReenviado(false)
                  try {
                    await fetch('/api/auth/reenviar-verificacion', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: normalizarEmail(form.email), canal: nuevo }),
                    })
                  } catch {}
                }}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-[8px] mb-6 transition-all"
                style={{ background: t.bgCardHover, border: `1px solid ${t.border}`, color: t.textSecondary }}
              >
                {verificarPor === 'whatsapp' ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    Verificar por correo
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Verificar por WhatsApp
                  </>
                )}
              </button>

              {otpError && (
                <div className="flex items-center justify-center gap-2 text-[13px] rounded-[10px] px-4 py-2.5 mb-4"
                  style={{ background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)', color: 'var(--color-danger)' }}>
                  {otpError}
                </div>
              )}

              <div className="flex justify-center gap-2.5 mb-6" onPaste={handleOtpPaste}>
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    autoFocus={i === 0}
                    disabled={otpLoading}
                    className="w-11 text-center text-[22px] font-bold rounded-[12px] outline-none transition-all cf-campo-grande"
                    style={{
                      height: 52,
                      background: t.bgCardHover,
                      border: `1.5px solid ${digit ? accentColor + '99' : t.border}`,
                      color: t.text,
                      caretColor: accentColor,
                    }}
                  />
                ))}
              </div>

              <button
                onClick={() => handleVerificarOtp()}
                disabled={otpLoading || otpDigits.join('').length !== 6}
                className="w-full h-12 rounded-[12px] text-[15px] font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 mb-4"
                style={{ background: accentColor, color: '#3a2900' }}
              >
                {otpLoading ? 'Verificando...' : 'Verificar'}
              </button>

              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={handleReenviarOtp}
                  disabled={otpReenviando || otpReenviado}
                  className="text-[13px] font-semibold transition-colors disabled:opacity-50"
                  style={{ color: otpReenviado ? 'var(--color-success)' : accentColor }}
                >
                  {otpReenviado ? 'Código reenviado' : otpReenviando ? 'Reenviando...' : 'Reenviar código'}
                </button>
                <button
                  onClick={handleSaltarVerificacion}
                  disabled={otpLoading}
                  className="text-[12px] transition-colors"
                  style={{ color: t.textMuted }}
                >
                  Saltar por ahora
                </button>
              </div>

              <p className="text-[12px] mt-5 leading-relaxed" style={{ color: t.textMuted }}>
                {verificarPor === 'whatsapp'
                  ? 'El mensaje llega en segundos. Si no llega, usa el botón de verificar por correo.'
                  : 'Revisa tu bandeja y la carpeta de spam. El código expira en 30 minutos.'}
              </p>
            </div>
          )}

          {/* Vivia en la portada. Sin portada va en el PRIMER paso, que es
              donde alguien se da cuenta de que se equivoco de pantalla. */}
          {step === 1 && (
            <p className="text-[14px] mt-8 text-center" style={{ color: t.textMuted }}>
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="font-semibold hover:underline" style={{ color: 'var(--color-accent)' }}>
                Inicia sesión
              </Link>
            </p>
          )}

          {(step === 1 || step === PASOS) && <div className="flex items-center justify-center gap-2.5 mt-6 text-[12px] flex-wrap" style={{ color: t.textMuted }}>
            <span className="inline-flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              Conexión cifrada SSL
            </span>
            <span>·</span>
            <span>Tus datos están seguros</span>
            <span>·</span>
            <span>Soporte en español</span>
          </div>}
        </div>
      </div>
    </div>
  )
}
