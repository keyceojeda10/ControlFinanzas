'use client'

import { useState, useCallback, useEffect } from 'react'
import WizardProgress  from './wizard/WizardProgress'
import WizardWelcome   from './wizard/WizardWelcome'
import WizardCapital   from './wizard/WizardCapital'
import WizardCobrador  from './wizard/WizardCobrador'
import WizardCliente   from './wizard/WizardCliente'
import WizardPrestamo  from './wizard/WizardPrestamo'
import WizardFeatures  from './wizard/WizardFeatures'
import WizardExito     from './wizard/WizardExito'
import WizardAyuda     from './wizard/WizardAyuda'

/*
  Onboarding v2 — persistent, no demo mode.

  Step 0: Welcome + solo/equipo choice
  Step 1: Capital (registrar capital inicial)
  Step 2: Cobrador + Ruta (equipo only — solo skips to 3)
  Step 3: Cliente
  Step 4: Prestamo
  Step 5: Features
  Step 6: Exito

  Every step completion persists to server via POST /api/onboarding/progreso.
  The wizard survives navigation, refresh, and browser close.
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
  const [step,           setStep]           = useState(initialStep)
  const [flujo,          setFlujo]          = useState(initialFlujo) // 'solo' | 'equipo'
  const [currentPlan,    setCurrentPlan]    = useState(plan)
  const [clienteCreado,  setClienteCreado]  = useState(null)
  const [prestamoCreado, setPrestamoCreado] = useState(null)
  const [showBounce,     setShowBounce]     = useState(false)

  const bounce = (cb) => {
    setShowBounce(true)
    setTimeout(() => { setShowBounce(false); cb() }, 700)
  }

  // Step mapping based on flujo
  const getStepNumbers = useCallback(() => {
    if (flujo === 'equipo') {
      return { capital: 1, cobrador: 2, cliente: 3, prestamo: 4, features: 5, exito: 6, actionSteps: 5 }
    }
    // solo: skip cobrador
    return { capital: 1, cliente: 2, prestamo: 3, features: 4, exito: 5, actionSteps: 4 }
  }, [flujo])

  // Progress bar info (only for action steps: capital through features)
  const getProgressInfo = () => {
    if (!flujo || step === 0) return null
    const steps = getStepNumbers()
    const exitoStep = steps.exito
    if (step >= exitoStep) return null

    // Map current step to progress position
    const firstAction = steps.capital
    const lastAction = steps.features
    const current = step - firstAction + 1
    const total = lastAction - firstAction + 1
    if (current < 1) return null
    return { current, total }
  }

  // Step 0: Welcome — solo/equipo choice
  const handleWelcomeDone = useCallback((tipo, nuevoPlan) => {
    const f = tipo
    setFlujo(f)
    if (nuevoPlan) setCurrentPlan(nuevoPlan)
    persistStep(1, f)
    setStep(1)
  }, [])

  // Step 1: Capital done
  const handleCapitalDone = useCallback(() => {
    const steps = flujo === 'equipo'
      ? { next: 2 }
      : { next: 2 }
    persistStep(steps.next, flujo)
    setStep(steps.next)
  }, [flujo])

  // Step 2 (equipo): Cobrador + Ruta done
  const handleCobradorDone = useCallback(() => {
    persistStep(3, flujo)
    bounce(() => setStep(3))
  }, [flujo])

  const handleCobradorSkip = useCallback(() => {
    persistStep(3, flujo)
    setStep(3)
  }, [flujo])

  // Cliente done
  const handleClienteDone = useCallback((cliente) => {
    setClienteCreado(cliente)
    const steps = getStepNumbers()
    persistStep(steps.prestamo, flujo)
    bounce(() => setStep(steps.prestamo))
  }, [flujo, getStepNumbers])

  const handleClienteSkip = useCallback(() => {
    const steps = getStepNumbers()
    persistStep(steps.features, flujo)
    setStep(steps.features)
  }, [flujo, getStepNumbers])

  // Prestamo done
  const handlePrestamoDone = useCallback((prestamo) => {
    setPrestamoCreado(prestamo)
    const steps = getStepNumbers()
    persistStep(steps.features, flujo)
    bounce(() => setStep(steps.features))
  }, [flujo, getStepNumbers])

  const handlePrestamoSkip = useCallback(() => {
    const steps = getStepNumbers()
    persistStep(steps.features, flujo)
    setStep(steps.features)
  }, [flujo, getStepNumbers])

  // Features done
  const handleFeaturesDone = useCallback(() => {
    const steps = getStepNumbers()
    persistStep(steps.exito, flujo)
    setStep(steps.exito)
  }, [flujo, getStepNumbers])

  // Exito: finish — this is the ONLY place that sets step=99
  const handleFinish = useCallback(() => {
    persistStep(99, flujo)
    onComplete?.()
  }, [flujo, onComplete])

  // Back navigation
  const handleBack = useCallback(() => {
    if (step <= 0) return
    if (step === 1) {
      setStep(0)
      setFlujo(null)
      persistStep(0, null)
      return
    }
    const steps = getStepNumbers()
    let prev = step - 1
    if (flujo === 'solo' && step === steps.cliente) prev = 1
    if (step === steps.exito) prev = steps.features
    // Si vuelve a features y no hay cliente, saltar prestamo directo a cliente
    if (step === steps.features && !clienteCreado) prev = steps.cliente
    // Si vuelve a prestamo y no hay cliente, ir a cliente
    if (step === steps.prestamo && !clienteCreado) prev = steps.cliente
    setStep(prev)
  }, [step, flujo, getStepNumbers, clienteCreado])

  const steps = getStepNumbers()
  const progressInfo = getProgressInfo()

  // Si llega al paso de préstamo sin cliente (omitió cliente), salta a features
  useEffect(() => {
    if (flujo && step === steps.prestamo && !clienteCreado) {
      handlePrestamoSkip()
    }
  }, [step, flujo, steps.prestamo, clienteCreado, handlePrestamoSkip])

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

  // Back button component (visible on all steps except welcome)
  const BackButton = step >= 1 ? (
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

      {/* Step 0: Welcome + solo/equipo */}
      {step === 0 && (
        <WizardWelcome
          nombre={nombre}
          plan={currentPlan}
          onSelect={handleWelcomeDone}
          onMinimize={onMinimize}
        />
      )}

      {/* Step 1: Capital */}
      {step === 1 && flujo && (
        <WizardCapital
          onComplete={handleCapitalDone}
        />
      )}

      {/* Step 2: Cobrador (equipo only) */}
      {step === 2 && flujo === 'equipo' && (
        <WizardCobrador
          onComplete={handleCobradorDone}
          onSkip={handleCobradorSkip}
        />
      )}

      {/* Cliente */}
      {flujo && step === (flujo === 'equipo' ? 3 : 2) && (
        <WizardCliente
          onComplete={handleClienteDone}
          onSkip={handleClienteSkip}
        />
      )}

      {/* Prestamo */}
      {flujo && step === steps.prestamo && clienteCreado && (
        <WizardPrestamo
          cliente={clienteCreado}
          onComplete={handlePrestamoDone}
          onSkip={handlePrestamoSkip}
        />
      )}

      {/* Features */}
      {flujo && step === steps.features && (
        <WizardFeatures
          onNext={handleFeaturesDone}
        />
      )}

      {/* Exito */}
      {flujo && step === steps.exito && (
        <WizardExito
          cliente={clienteCreado}
          prestamo={prestamoCreado}
          flujo={flujo}
          onFinish={handleFinish}
        />
      )}

      {step < (steps?.exito ?? 99) && <WizardAyuda />}
    </div>
  )
}
