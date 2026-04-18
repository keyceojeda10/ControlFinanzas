'use client'

import { useState, useEffect, useCallback } from 'react'
import WizardProgress from './wizard/WizardProgress'
import WizardWelcome from './wizard/WizardWelcome'
import WizardCliente from './wizard/WizardCliente'
import WizardPrestamo from './wizard/WizardPrestamo'
import WizardExito from './wizard/WizardExito'

export default function OnboardingWizard({ nombre, onComplete, onDismiss, initialStep = 0 }) {
  const [step, setStep] = useState(initialStep)
  const [clienteCreado, setClienteCreado] = useState(null)
  const [prestamoCreado, setPrestamoCreado] = useState(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [direction, setDirection] = useState('forward')

  const goTo = useCallback((nextStep) => {
    setDirection(nextStep > step ? 'forward' : 'back')
    setStep(nextStep)
  }, [step])

  // Step 1 complete: show check animation, then advance
  const handleClienteComplete = useCallback((cliente) => {
    setClienteCreado(cliente)
    setShowSuccess(true)
    setTimeout(() => {
      setShowSuccess(false)
      goTo(2)
    }, 800)
  }, [goTo])

  // Step 2 complete: show check animation, then advance
  const handlePrestamoComplete = useCallback((prestamo) => {
    setPrestamoCreado(prestamo)
    setShowSuccess(true)
    setTimeout(() => {
      setShowSuccess(false)
      goTo(3)
    }, 800)
  }, [goTo])

  // Finish: dismiss wizard
  const handleFinish = useCallback(() => {
    onComplete?.()
  }, [onComplete])

  // Add another: reset to step 1
  const handleAddAnother = useCallback(() => {
    setClienteCreado(null)
    setPrestamoCreado(null)
    goTo(1)
  }, [goTo])

  // Success animation overlay
  if (showSuccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="wizard-success-bounce">
          <div className="w-20 h-20 rounded-full bg-[var(--color-success)] flex items-center justify-center">
            <svg className="w-10 h-10 text-[var(--color-text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto wizard-step-enter">
      {step > 0 && step < 3 && <WizardProgress step={step} totalSteps={3} />}

      {step === 0 && (
        <WizardWelcome
          nombre={nombre}
          onNext={() => goTo(1)}
          onDismiss={onDismiss}
        />
      )}

      {step === 1 && (
        <WizardCliente onComplete={handleClienteComplete} />
      )}

      {step === 2 && clienteCreado && (
        <WizardPrestamo
          cliente={clienteCreado}
          onComplete={handlePrestamoComplete}
        />
      )}

      {step === 3 && (
        <WizardExito
          cliente={clienteCreado}
          prestamo={prestamoCreado}
          onFinish={handleFinish}
          onAddAnother={handleAddAnother}
        />
      )}
    </div>
  )
}
