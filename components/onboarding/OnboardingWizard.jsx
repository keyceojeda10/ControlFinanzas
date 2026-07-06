'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import WizardProgress  from './wizard/WizardProgress'
import WizardWelcome   from './wizard/WizardWelcome'
import WizardCapital   from './wizard/WizardCapital'
import WizardPerfil    from './wizard/WizardPerfil'
import WizardCobrador  from './wizard/WizardCobrador'
import WizardCliente   from './wizard/WizardCliente'
import WizardPrestamo  from './wizard/WizardPrestamo'
import WizardFeatures  from './wizard/WizardFeatures'
import WizardExito     from './wizard/WizardExito'

/*
  Dual flow orchestrator:

  SOLO flow (maxUsuarios=1):
  0 → Welcome (elige demo o real)
  1 → Capital (registrar capital inicial)
  2 → Perfil  (solo vs equipo — elige solo)
  3 → Cliente (crear)
  4 → Prestamo (crear)
  5 → Features
  6 → Exito

  EQUIPO flow (maxUsuarios>1):
  0 → Welcome
  1 → Capital
  2 → Perfil  (elige equipo)
  3 → Cobrador (crear cobrador + ruta)
  4 → Cliente
  5 → Prestamo
  6 → Features
  7 → Exito
*/

export default function OnboardingWizard({ nombre, onComplete, onDismiss, initialStep = 0, plan = 'basic' }) {
  const router = useRouter()
  const [step,           setStep]           = useState(initialStep)
  const [modoDemo,       setModoDemo]       = useState(null)
  const [flujo,          setFlujo]          = useState(null) // 'solo' | 'equipo'
  const [currentPlan,    setCurrentPlan]    = useState(plan)
  const [capitalData,    setCapitalData]    = useState(null)
  const [cobradorData,   setCobradorData]   = useState(null)
  const [clienteCreado,  setClienteCreado]  = useState(null)
  const [prestamoCreado, setPrestamoCreado] = useState(null)
  const [showBounce,     setShowBounce]     = useState(false)

  const goTo = useCallback((nextStep) => setStep(nextStep), [])

  const bounce = (cb) => {
    setShowBounce(true)
    setTimeout(() => { setShowBounce(false); cb() }, 700)
  }

  // Step helpers based on flow
  const getStepConfig = () => {
    if (flujo === 'equipo') {
      return { clienteStep: 4, prestamoStep: 5, featuresStep: 6, exitoStep: 7, totalSteps: 5 }
    }
    return { clienteStep: 3, prestamoStep: 4, featuresStep: 5, exitoStep: 6, totalSteps: 4 }
  }

  // Progress bar: shows for action steps (after perfil, before exito)
  const getProgressInfo = () => {
    const config = getStepConfig()
    if (flujo === 'equipo') {
      // Steps 3-6 map to progress 1-4 of 5
      if (step === 3) return { current: 1, total: config.totalSteps }
      if (step === 4) return { current: 2, total: config.totalSteps }
      if (step === 5) return { current: 3, total: config.totalSteps }
      if (step === 6) return { current: 4, total: config.totalSteps }
    } else {
      // Steps 3-5 map to progress 1-3 of 4
      if (step === 3) return { current: 1, total: config.totalSteps }
      if (step === 4) return { current: 2, total: config.totalSteps }
      if (step === 5) return { current: 3, total: config.totalSteps }
    }
    return null
  }

  // Step 0: Welcome — pick demo or real
  const handleWelcomeDone = useCallback((demo) => {
    setModoDemo(demo)
    goTo(1)
  }, [goTo])

  // Step 1: Capital
  const handleCapitalDone = useCallback((data) => {
    setCapitalData(data)
    goTo(2)
  }, [goTo])

  // Step 2: Perfil — solo vs equipo
  const handlePerfilDone = useCallback((tipo, nuevoPlan) => {
    setFlujo(tipo)
    if (nuevoPlan) setCurrentPlan(nuevoPlan)
    goTo(3)
  }, [goTo])

  // Step 3 (equipo): Cobrador + Ruta done → go to cliente
  const handleCobradorDone = useCallback((data) => {
    setCobradorData(data)
    bounce(() => goTo(4))
  }, [goTo])

  // Cliente done → go to prestamo
  const handleClienteDone = useCallback((cliente) => {
    setClienteCreado(cliente)
    const config = getStepConfig()
    bounce(() => goTo(config.prestamoStep))
  }, [goTo, flujo])

  // Prestamo done → go to features
  const handlePrestamoDone = useCallback((prestamo) => {
    setPrestamoCreado(prestamo)
    const config = getStepConfig()
    bounce(() => goTo(config.featuresStep))
  }, [goTo, flujo])

  // Features done → go to exito
  const handleFeaturesDone = useCallback(() => {
    const config = getStepConfig()
    goTo(config.exitoStep)
  }, [goTo, flujo])

  // Exito: finish
  const handleFinish = useCallback(() => onComplete?.(), [onComplete])

  const config = getStepConfig()
  const progressInfo = getProgressInfo()

  // Bounce animation between steps
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
      {/* Progress bar — action steps only */}
      {progressInfo && (
        <WizardProgress step={progressInfo.current} totalSteps={progressInfo.total} />
      )}

      {/* Step 0: Welcome */}
      {step === 0 && (
        <WizardWelcome
          nombre={nombre}
          onNext={handleWelcomeDone}
          onDismiss={onDismiss}
          onNavigate={(href) => { onDismiss?.(); router.push(href) }}
        />
      )}

      {/* Step 1: Capital */}
      {step === 1 && (
        <WizardCapital
          onComplete={handleCapitalDone}
          modoDemo={!!modoDemo}
        />
      )}

      {/* Step 2: Perfil (solo vs equipo) */}
      {step === 2 && (
        <WizardPerfil
          plan={currentPlan}
          onSelect={handlePerfilDone}
        />
      )}

      {/* Step 3: Cobrador (equipo only) OR Cliente (solo) */}
      {step === 3 && flujo === 'equipo' && (
        <WizardCobrador
          onComplete={handleCobradorDone}
          modoDemo={!!modoDemo}
        />
      )}

      {step === config.clienteStep && flujo && (
        <WizardCliente
          onComplete={handleClienteDone}
          modoDemo={!!modoDemo}
        />
      )}

      {step === config.prestamoStep && clienteCreado && (
        <WizardPrestamo
          cliente={clienteCreado}
          onComplete={handlePrestamoDone}
          modoDemo={!!modoDemo}
        />
      )}

      {step === config.featuresStep && (
        <WizardFeatures
          modoDemo={!!modoDemo}
          onNext={handleFeaturesDone}
        />
      )}

      {step === config.exitoStep && (
        <WizardExito
          cliente={clienteCreado}
          prestamo={prestamoCreado}
          modoDemo={!!modoDemo}
          flujo={flujo}
          onFinish={handleFinish}
        />
      )}
    </div>
  )
}
