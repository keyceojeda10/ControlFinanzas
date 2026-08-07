'use client'

import { createPortal } from 'react-dom'

export function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true
}

function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

function isAndroid() {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent)
}

function isSafari() {
  if (typeof navigator === 'undefined') return false
  return /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent)
}

function isSamsungBrowser() {
  if (typeof navigator === 'undefined') return false
  return /SamsungBrowser/i.test(navigator.userAgent)
}

export function getBrowserName() {
  if (typeof navigator === 'undefined') return 'otro'
  const ua = navigator.userAgent
  if (/CriOS/i.test(ua)) return 'chrome-ios'
  if (/FxiOS/i.test(ua)) return 'firefox-ios'
  if (/EdgiOS/i.test(ua)) return 'edge-ios'
  if (isIOS() && isSafari()) return 'safari'
  if (isSamsungBrowser()) return 'samsung'
  if (/Edg/i.test(ua)) return 'edge'
  if (/Chrome/i.test(ua)) return 'chrome'
  if (/Firefox/i.test(ua)) return 'firefox'
  return 'otro'
}

export function getDeviceType() {
  if (isIOS()) return 'ios'
  if (isAndroid()) return 'android'
  return 'desktop'
}

// ═══ ICONOS SVG para los pasos ═══
// Compartir iOS (cuadrado con flecha arriba)
const IconShareIOS = () => (
  <svg className="w-7 h-7 text-[#007AFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
)
// 3 puntos vertical
const IconDotsVertical = () => (
  <svg className="w-7 h-7 text-[var(--cf-ink-3)]" fill="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
  </svg>
)
// 3 puntos horizontal
const IconDotsHorizontal = () => (
  <svg className="w-7 h-7 text-[var(--cf-ink-3)]" fill="currentColor" viewBox="0 0 24 24">
    <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
  </svg>
)
// Desplazar abajo (scroll)
const IconScrollDown = () => (
  <svg className="w-7 h-7 text-[var(--cf-gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
  </svg>
)
// Agregar / Plus en cuadrado
const IconAddSquare = () => (
  <svg className="w-7 h-7 text-[var(--cf-gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)
// Check / Listo
const IconCheck = () => (
  <svg className="w-7 h-7 text-[var(--cf-green-dark)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)
// Instalar (descarga)
const IconInstall = () => (
  <svg className="w-7 h-7 text-[var(--cf-gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)
// Plus simple
const IconPlus = () => (
  <svg className="w-7 h-7 text-[var(--cf-gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
)
// Monitor con flecha (desktop install)
const IconDesktopInstall = () => (
  <svg className="w-7 h-7 text-[var(--cf-gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
)
// Info
const IconInfo = () => (
  <svg className="w-7 h-7 text-[var(--cf-ink-3)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const ICON_MAP = {
  'share-ios': IconShareIOS,
  'scroll': IconScrollDown,
  'add': IconAddSquare,
  'check': IconCheck,
  'dots-v': IconDotsVertical,
  'dots-h': IconDotsHorizontal,
  'install': IconInstall,
  'plus': IconPlus,
  'desktop': IconDesktopInstall,
  'info': IconInfo,
}

// ═══ INSTRUCCIONES por dispositivo + navegador ═══
function getInstructions() {
  const device = getDeviceType()
  const browser = getBrowserName()

  // iOS (iPhone / iPad)
  if (device === 'ios') {
    if (browser === 'safari') {
      return {
        title: 'Instalar desde Safari',
        steps: [
          { icon: 'share-ios', text: 'Toca el icono de **Compartir** en la barra inferior de Safari', sub: 'Es este icono, abajo en el centro de la pantalla' },
          { icon: 'scroll', text: 'Desplaza hacia abajo en el menú que aparece', sub: 'Busca la opcion "Agregar a pantalla de inicio"' },
          { icon: 'add', text: 'Toca **"Agregar a pantalla de inicio"**', sub: null },
          { icon: 'check', text: 'Toca **"Agregar"** arriba a la derecha', sub: 'Listo! La app aparecera en tu pantalla de inicio' },
        ]
      }
    }
    if (browser === 'chrome-ios') {
      return {
        title: 'Instalar desde Chrome',
        steps: [
          { icon: 'share-ios', text: 'Toca el icono de **Compartir** en la barra de Chrome', sub: 'Es este icono, esta arriba al lado de la barra de direcciones' },
          { icon: 'scroll', text: 'Desplaza hacia abajo en el menú que aparece', sub: 'Busca la opcion "Agregar a pantalla de inicio"' },
          { icon: 'add', text: 'Toca **"Agregar a pantalla de inicio"**', sub: null },
          { icon: 'check', text: 'Ponle nombre y toca **"Agregar"**', sub: 'Listo! La app queda instalada en tu celular' },
        ]
      }
    }
    if (browser === 'firefox-ios') {
      return {
        title: 'Instalar desde Firefox',
        steps: [
          { icon: 'share-ios', text: 'Toca el icono de **Compartir** en la barra de Firefox', sub: 'Es este icono, junto a la barra de direcciones' },
          { icon: 'scroll', text: 'Desplaza hacia abajo en el menú', sub: 'Busca "Agregar a pantalla de inicio"' },
          { icon: 'add', text: 'Toca **"Agregar a pantalla de inicio"**', sub: null },
          { icon: 'check', text: 'Toca **"Agregar"** y listo', sub: 'La app aparecera en tu pantalla de inicio' },
        ]
      }
    }
    if (browser === 'edge-ios') {
      return {
        title: 'Instalar desde Edge',
        steps: [
          { icon: 'share-ios', text: 'Toca el icono de **Compartir** en la barra de Edge', sub: 'Es este icono, junto a la barra de direcciones' },
          { icon: 'scroll', text: 'Desplaza hacia abajo en el menú', sub: 'Busca "Agregar a pantalla de inicio"' },
          { icon: 'add', text: 'Toca **"Agregar a pantalla de inicio"**', sub: null },
          { icon: 'check', text: 'Toca **"Agregar"** y listo', sub: 'La app aparecera en tu pantalla de inicio' },
        ]
      }
    }
    return {
      title: 'Instalar en tu iPhone',
      steps: [
        { icon: 'share-ios', text: 'Busca el icono de **Compartir** en tu navegador', sub: 'Es este icono (cuadrado con flecha hacia arriba)' },
        { icon: 'scroll', text: 'Desplaza hacia abajo en el menú', sub: 'Busca "Agregar a pantalla de inicio"' },
        { icon: 'add', text: 'Toca **"Agregar a pantalla de inicio"**', sub: null },
        { icon: 'check', text: 'Toca **"Agregar"** y listo', sub: null },
      ]
    }
  }

  // Android
  if (device === 'android') {
    if (browser === 'samsung') {
      return {
        title: 'Instalar desde Samsung Internet',
        steps: [
          { icon: 'plus', text: 'Si ves un icono **+** en la barra de direcciones, tocalo', sub: 'Aparece cuando el sitio se puede instalar como app' },
          { icon: 'add', text: 'Selecciona **"Pantalla de inicio"**', sub: 'Si no ves el +, toca los 3 puntos del menú y busca "Agregar a pantalla de inicio"' },
          { icon: 'check', text: 'Confirma tocando **"Agregar"**', sub: 'Listo! La app aparecera en tu pantalla de inicio' },
        ]
      }
    }
    if (browser === 'edge') {
      return {
        title: 'Instalar desde Edge',
        steps: [
          { icon: 'dots-h', text: 'Toca los **3 puntos** del menú de Edge', sub: 'Estan abajo en el centro de la pantalla' },
          { icon: 'add', text: 'Toca **"Agregar a pantalla de inicio"**', sub: null },
          { icon: 'check', text: 'Confirma tocando **"Agregar"**', sub: 'Listo! La app aparecera en tu pantalla de inicio' },
        ]
      }
    }
    if (browser === 'firefox') {
      return {
        title: 'Instalar desde Firefox',
        steps: [
          { icon: 'dots-v', text: 'Toca los **3 puntos** del menú de Firefox', sub: 'Estan abajo a la derecha de la pantalla' },
          { icon: 'install', text: 'Toca **"Instalar"** o **"Agregar a pantalla de inicio"**', sub: null },
          { icon: 'check', text: 'Confirma tocando **"Agregar"**', sub: 'Listo! La app aparecera en tu pantalla de inicio' },
        ]
      }
    }
    return {
      title: 'Instalar desde Chrome',
      steps: [
        { icon: 'dots-v', text: 'Toca los **3 puntos** del menú de Chrome', sub: 'Estan arriba a la derecha de la pantalla' },
        { icon: 'install', text: 'Toca **"Instalar app"** o **"Agregar a pantalla de inicio"**', sub: null },
        { icon: 'check', text: 'Confirma tocando **"Instalar"**', sub: 'Listo! La app aparecera en tu pantalla de inicio y en tus aplicaciones' },
      ]
    }
  }

  // Desktop (Windows / Mac / Linux)
  if (browser === 'edge') {
    return {
      title: 'Instalar desde Edge',
      steps: [
        { icon: 'desktop', text: 'Busca el icono de **App disponible** en la barra de direcciones', sub: 'Es un icono con un + que aparece a la derecha de la URL' },
        { icon: 'install', text: 'Haz clic en **"Instalar"**', sub: 'Si no lo ves, haz clic en los 3 puntos del menú y busca "Instalar sitio como app"' },
        { icon: 'check', text: 'Listo! La app se abrira como ventana independiente', sub: 'Puedes acceder desde el menú de inicio (Windows) o Launchpad (Mac)' },
      ]
    }
  }
  if (browser === 'firefox') {
    return {
      title: 'Instalar desde Firefox',
      steps: [
        { icon: 'info', text: 'Firefox de escritorio no permite instalar apps web', sub: null },
        { icon: 'desktop', text: 'Abre este sitio en **Chrome** o **Edge**', sub: 'Copia: app.control-finanzas.com y abrelo en Chrome o Edge' },
        { icon: 'install', text: 'Ahi veras el icono de **instalar** en la barra de direcciones', sub: null },
      ]
    }
  }
  return {
    title: 'Instalar desde Chrome',
    steps: [
      { icon: 'desktop', text: 'Busca el icono de **instalar** en la barra de direcciones', sub: 'Es un icono de monitor con una flecha, a la derecha de la URL' },
      { icon: 'install', text: 'Haz clic en **"Instalar"**', sub: 'Si no lo ves, haz clic en los 3 puntos del menú y busca "Instalar Control Finanzas"' },
      { icon: 'check', text: 'Listo! La app se abrira como ventana independiente', sub: 'Puedes acceder desde el menú de inicio (Windows) o Launchpad (Mac)' },
    ]
  }
}

function renderBoldText(text) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} className="text-[var(--cf-ink)]">{part}</strong>
      : <span key={i}>{part}</span>
  )
}

// ═══ MODAL DE INSTRUCCIONES (compartido) ═══
export function InstallGuideModal({ onClose }) {
  const instructions = getInstructions()

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/70 px-0 sm:px-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-sm bg-[var(--cf-surface)] border-t border-x sm:border border-[var(--cf-border)] rounded-t-[20px] sm:rounded-[20px] flex flex-col max-h-[85vh] max-h-[85dvh] sm:max-h-[80vh] sm:max-h-[80dvh]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header fijo */}
        <div className="px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-semibold text-[var(--cf-ink)]">{instructions.title}</h3>
            <button onClick={onClose} className="text-[var(--cf-ink-3)] hover:text-[var(--cf-ink)] p-1 -mr-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-[var(--cf-ink-3)]">Agrega la app a tu celular para acceder más rápido y usarla sin internet.</p>
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto px-5 pb-2">
          <div className="space-y-4">
            {instructions.steps.map((step, i) => {
              const StepIconComponent = ICON_MAP[step.icon]
              return (
                <div key={i} className="flex items-start gap-3 p-3 rounded-[12px] bg-[var(--cf-fill)] border border-[var(--cf-border)]">
                  {/* Numero + Icono en fila */}
                  <div className="shrink-0 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[var(--cf-gold)] flex items-center justify-center text-[var(--cf-ink)] text-xs font-bold">
                      {i + 1}
                    </div>
                    {StepIconComponent && (
                      <div className="w-11 h-11 rounded-[12px] bg-[var(--cf-fill)] flex items-center justify-center">
                        <StepIconComponent />
                      </div>
                    )}
                  </div>
                  {/* Texto */}
                  <div className="pt-1 min-w-0 flex-1">
                    <p className="text-[13px] leading-snug" style={{ color: 'var(--cf-ink-2)' }}>{renderBoldText(step.text)}</p>
                    {step.sub && <p className="text-[11px] mt-1 leading-snug" style={{ color: 'var(--cf-ink-3)' }}>{step.sub}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer fijo */}
        <div className="px-5 pb-5 pt-3 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-[12px] bg-[var(--cf-gold)] text-[var(--cf-ink)] text-sm font-bold hover:bg-[var(--cf-gold-dark)] transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

