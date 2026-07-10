'use client'

import { useState, useCallback } from 'react'
import WizardProgress   from './wizard/WizardProgress'
import WizardWelcome    from './wizard/WizardWelcome'
import WizardCartulina  from './wizard/WizardCartulina'
import WizardExito      from './wizard/WizardExito'
import WizardAyuda      from './wizard/WizardAyuda'

/*
  Onboarding v3 — simplificado.

  Step 0: Welcome + solo/equipo
  Step 1: Importar cartulina (foto → IA → cliente+préstamo automático)
  Step 2: Exito

  Se eliminaron: Capital, Cobrador, Cliente manual, Préstamo manual, Features.
  El 95% de usuarios saltaba el wizard anterior. Este tiene 1 acción real
  (subir foto) que da valor inmediato: ver sus datos en el sistema.
*/

const persistStep = (step, flujo) => {
  fetch('/api/onboarding/progreso', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'progress', step, flujo }),
  }).catch(() => {})
}

export default function OnboardingWizard({
  nombre,
  onComplete,
  onMinimize,
  initialStep = 0,
  initialFlujo = null,
  plan = 'basic',
}) {
  const [step,          setStep]          = useState(initialStep > 2 ? 0 : initialStep)
  const [flujo,         setFlujo]         = useState(initialFlujo)
  const [currentPlan,   setCurrentPlan]   = useState(plan)
  const [importResult,  setImportResult]  = useState(null)
  const [showBounce,    setShowBounce]    = useState(false)

  const bounce = (cb) => {
    setShowBounce(true)
    setTimeout(() => { setShowBounce(false); cb() }, 700)
  }

  // Step 0: Welcome
  const handleWelcomeDone = useCallback((tipo, nuevoPlan) => {
    setFlujo(tipo)
    if (nuevoPlan) setCurrentPlan(nuevoPlan)
    persistStep(1, tipo)
    setStep(1)
  }, [])

  // Step 1: Cartulina importada
  const handleCartullinaDone = useCallback((result) => {
    setImportResult(result)
    persistStep(2, flujo)
    bounce(() => setStep(2))
  }, [flujo])

  // Step 1: Cartulina saltada
  const handleCartulinaSkip = useCallback(() => {
    persistStep(2, flujo)
    setStep(2)
  }, [flujo])

  // Step 2: Finish
  const handleFinish = useCallback(() => {
    persistStep(99, flujo)
    onComplete?.()
  }, [flujo, onComplete])

  // Back
  const handleBack = useCallback(() => {
    if (step === 1) {
      setStep(0)
      setFlujo(null)
      persistStep(0, null)
    }
  }, [step])

  const progressInfo = step === 1 ? { current: 1, total: 1 } : null

  if (showBounce) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div style={{ animation: 'wizardBounce 0.6s ease' }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(245,197,24,0.15)' }}>
            <svg className="w-10 h-10" fill="none" stroke="#f5c518" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <style>{`
          @keyframes wizardBounce {
            0%   { transform: scale(0.5); opacity: 0; }
            60%  { transform: scale(1.15); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    )
  }

  const BackButton = step === 1 ? (
    <button
      onClick={handleBack}
      className="flex items-center gap-1 text-[12px] mb-4 transition-colors cursor-pointer"
      style={{ color: 'var(--color-text-muted)' }}>
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Volver
    </button>
  ) : null

  return (
    <div className="max-w-lg mx-auto wizard-step-enter">
      {progressInfo && (
        <WizardProgress step={progressInfo.current} totalSteps={progressInfo.total} />
      )}

      {BackButton}

      {step === 0 && (
        <WizardWelcome
          nombre={nombre}
          plan={currentPlan}
          onSelect={handleWelcomeDone}
          onMinimize={onMinimize}
        />
      )}

      {step === 1 && flujo && (
        <WizardCartulina
          onComplete={handleCartullinaDone}
          onSkip={handleCartulinaSkip}
        />
      )}

      {step === 2 && flujo && (
        <WizardExito
          cliente={importResult?.clientesCreados > 0 ? { nombre: `${importResult.clientesCreados} importados` } : null}
          prestamo={importResult?.prestamosCreados > 0 ? { montoPrestado: 0, totalAPagar: 0, cuotaDiaria: 0, frecuencia: 'diario' } : null}
          flujo={flujo}
          onFinish={handleFinish}
        />
      )}

      {step < 2 && <WizardAyuda />}
    </div>
  )
}
