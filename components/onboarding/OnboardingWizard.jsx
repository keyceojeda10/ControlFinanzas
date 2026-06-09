'use client'

import { useState, useCallback } from 'react'
import WizardProgress  from './wizard/WizardProgress'
import WizardWelcome   from './wizard/WizardWelcome'
import WizardCliente   from './wizard/WizardCliente'
import WizardPrestamo  from './wizard/WizardPrestamo'
import WizardFeatures  from './wizard/WizardFeatures'
import WizardExito     from './wizard/WizardExito'

/*
  Flujo:
  0 → Welcome (elige demo o real)
  1 → Cliente  (crear)
  2 → Préstamo (crear)
  3 → Features (qué más puede hacer el sistema)
  4 → Éxito    (cleanup demo + próximos pasos)
*/

export default function OnboardingWizard({ nombre, onComplete, onDismiss, initialStep = 0 }) {
  const [step,          setStep]          = useState(initialStep)
  const [modoDemo,      setModoDemo]      = useState(null)
  const [clienteCreado, setClienteCreado] = useState(null)
  const [prestamoCreado,setPrestamoCreado]= useState(null)
  const [showBounce,    setShowBounce]    = useState(false)

  const goTo = useCallback((nextStep) => setStep(nextStep), [])

  const bounce = (cb) => {
    setShowBounce(true)
    setTimeout(() => { setShowBounce(false); cb() }, 700)
  }

  // Step 0: user picks demo or real
  const handleWelcomeDone = useCallback((demo) => {
    setModoDemo(demo)
    goTo(1)
  }, [goTo])

  // Step 1 → 2
  const handleClienteDone = useCallback((cliente) => {
    setClienteCreado(cliente)
    bounce(() => goTo(2))
  }, [goTo])

  // Step 2 → 3
  const handlePrestamoDone = useCallback((prestamo) => {
    setPrestamoCreado(prestamo)
    bounce(() => goTo(3))
  }, [goTo])

  // Step 3 → 4
  const handleFeaturesDone = useCallback(() => goTo(4), [goTo])

  // Step 4: finish
  const handleFinish = useCallback(() => onComplete?.(), [onComplete])

  // Check animation between steps
  if (showBounce) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div style={{ animation: 'wizardBounce 0.6s ease' }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: modoDemo ? 'rgba(167,139,250,0.15)' : 'rgba(245,197,24,0.15)' }}>
            <svg className="w-10 h-10" fill="none" stroke={modoDemo ? '#a78bfa' : '#f5c518'} viewBox="0 0 24 24">
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

  return (
    <div className="max-w-lg mx-auto wizard-step-enter">
      {/* Progress bar — steps 1-3 */}
      {step >= 1 && step <= 3 && (
        <WizardProgress step={step} totalSteps={3} />
      )}

      {step === 0 && (
        <WizardWelcome
          nombre={nombre}
          onNext={handleWelcomeDone}
          onDismiss={onDismiss}
        />
      )}

      {step === 1 && (
        <WizardCliente
          onComplete={handleClienteDone}
          modoDemo={!!modoDemo}
        />
      )}

      {step === 2 && clienteCreado && (
        <WizardPrestamo
          cliente={clienteCreado}
          onComplete={handlePrestamoDone}
          modoDemo={!!modoDemo}
        />
      )}

      {step === 3 && (
        <WizardFeatures
          modoDemo={!!modoDemo}
          onNext={handleFeaturesDone}
        />
      )}

      {step === 4 && (
        <WizardExito
          cliente={clienteCreado}
          prestamo={prestamoCreado}
          modoDemo={!!modoDemo}
          onFinish={handleFinish}
        />
      )}
    </div>
  )
}
