'use client'

import { useState, useCallback } from 'react'
import WizardProgress   from './wizard/WizardProgress'
import WizardWelcome    from './wizard/WizardWelcome'
import WizardCapital    from './wizard/WizardCapital'
import WizardCartulina  from './wizard/WizardCartulina'
import TraerCartera from '@/components/pantallas/TraerCartera'
import WizardMetodoCarga from './wizard/WizardMetodoCarga'
import WizardExcel from './wizard/WizardExcel'
import WizardPlan from './wizard/WizardPlan'
import { DIAS_PRUEBA } from '@/lib/planes'
import WizardExito      from './wizard/WizardExito'
import WizardAyuda      from './wizard/WizardAyuda'

/*
  Onboarding v4

  Step 0: Welcome + solo/equipo
  Step 1: Capital inicial (cuánto dinero disponible para prestar)
  Step 2: Importar cartulina (foto → IA → cliente+préstamo automático)
  Step 3: Éxito

  Capital se agrega porque sin él el dashboard arranca en negativo
  desde el primer préstamo. Skipeable, pero con advertencia clara.
*/

/** «hasta el 27 de agosto»: la fecha concreta, no «en N días». */
function finDePrueba() {
  const d = new Date()
  d.setDate(d.getDate() + DIAS_PRUEBA)
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
}

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
  const [step,          setStep]          = useState(initialStep > 3 ? 0 : initialStep)
  const [flujo,         setFlujo]         = useState(initialFlujo)
  const [currentPlan,   setCurrentPlan]   = useState(plan)
  const [importResult,  setImportResult]  = useState(null)
  const [capitalDone,   setCapitalDone]   = useState(false)
  const [capitalMonto,  setCapitalMonto]  = useState(0)
  const [showBounce,    setShowBounce]    = useState(false)

  // El método de carga es un SUB-ESTADO del paso 2, no un paso nuevo. Meter un
  // paso corre la numeración y deja a medias a quien tenga progreso guardado
  // («step: 2» pasaría a significar otra pantalla de la que dejó).
  const [metodo, setMetodo] = useState(null)
  // El plan va ANTES de cargar la cartera y no es un paso propio: no se elige
  // nada en él, así que no merece un punto en la espina.
  const [vioPlan, setVioPlan] = useState(false)

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

  // Step 1: Capital
  const handleCapitalDone = useCallback(({ monto, skipped }) => {
    setCapitalDone(!skipped)
    setCapitalMonto(monto || 0)
    persistStep(2, flujo)
    bounce(() => setStep(2))
  }, [flujo])

  // Step 2: Cartulina importada
  const handleCartullinaDone = useCallback((result) => {
    setImportResult(result)
    persistStep(3, flujo)
    bounce(() => setStep(3))
  }, [flujo])

  // Step 2: Cartulina saltada
  const handleCartulinaSkip = useCallback(() => {
    persistStep(3, flujo)
    setStep(3)
  }, [flujo])

  // Step 3: Finish
  // Paso 50 = "ya vio el wizard" — apaga el wizard pero ENCIENDE la lista de
  // misiones. Antes esto marcaba 99 (onboarding terminado para siempre), asi
  // que quien salia del wizard sin haber creado nada quedaba sin ninguna guia.
  // El 99 real lo pone la API sola cuando ya hay cliente + prestamo + pago.
  const handleFinish = useCallback(() => {
    persistStep(50, flujo)
    onComplete?.()
  }, [flujo, onComplete])

  // Back
  const handleBack = useCallback(() => {
    if (step === 1) {
      setStep(0)
      setFlujo(null)
      persistStep(0, null)
    } else if (step === 2) {
      setStep(1)
      persistStep(1, flujo)
    }
  }, [step, flujo])

  // Progress: steps 1 y 2 muestran circles (capital + cartulina). Welcome y Éxito no.
  // «Paso 3 de 4» en el diseño: perfil, capital, cartera y listo. Antes decía
  // «de 2» porque solo contaba capital y cartulina, así que el asistente
  // prometía terminar dos pantallas antes de terminar.
  const progressInfo = step <= 2 ? { current: step + 1, total: 4 } : null

  if (showBounce) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div style={{ animation: 'wizardBounce 0.6s ease' }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(245,197,24,0.15)' }}>
            <svg className="w-10 h-10" fill="none" stroke="var(--cf-gold)" viewBox="0 0 24 24">
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

  // En el paso 2 «Volver» deshace primero la elección de método; si no, salta
  // al capital y se pierde la pantalla que se acaba de contestar.
  const volver = () => {
    if (step === 2 && metodo)  { setMetodo(null);  return }
    if (step === 2 && vioPlan) { setVioPlan(false); return }
    handleBack()
  }

  const BackButton = (step === 1 || step === 2) ? (
    <button
      onClick={volver}
      className="flex items-center gap-1 text-[12px] mb-4 transition-colors cursor-pointer"
      style={{ color: 'var(--cf-ink-3)' }}>
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
        <WizardCapital
          onComplete={handleCapitalDone}
          alreadyDone={capitalDone}
          savedMonto={capitalMonto}
        />
      )}

      {/* «El cambio de fondo del turno»: aquí ya no se elige plan, se informa.
          Va justo antes de cargar la cartera porque su acción ES cargarla. */}
      {step === 2 && flujo && !vioPlan && (
        <WizardPlan
          perfil={flujo}
          hasta={finDePrueba()}
          onCargar={() => setVioPlan(true)}
          onPagar={() => { window.location.href = '/configuracion/plan' }}
        />
      )}

      {/* «Hoy el migrador pregunta manual o foto EN CADA CLIENTE. Aquí se
          decide una vez.» Por eso va antes de la cartulina, no dentro. */}
      {/* ── T22-00 · LA MISMA PANTALLA QUE AL ATERRIZAR ──
          `WizardMetodoCarga` hacia ESTA MISMA PREGUNTA —foto, Excel o de cero—
          asi que se preguntaba dos veces: una aqui dentro y otra al salir del
          asistente con la cartera en cero. Ahora es la misma pantalla en los dos
          sitios, con las mismas palabras y el mismo orden.

          Y aqui gana algo que dentro del asistente no habia: la columna derecha.
          «Cuando termines vas a ver» enseña el panel que va a tener, y «lo que
          ya hiciste» dice que capital y plan ya estan — que es cierto, porque
          para llegar a este paso hay que haberlos pasado.

          Foto y Excel SE QUEDAN DENTRO del asistente: quien sale de un flujo de
          tres minutos para aterrizar en otra pantalla no vuelve. Solo «empezar
          de cero» sale, porque ahi el trabajo es crear el primer prestamo. */}
      {step === 2 && flujo && vioPlan && !metodo && (
        <TraerCartera
          nombre={nombre}
          onFoto={() => setMetodo('foto')}
          onExcel={() => setMetodo('excel')}
          onCero={() => {
            persistStep(2, flujo)
            window.location.href = '/clientes/nuevo'
          }}
          pasos={[
            { texto: 'Crear tu cuenta', hecho: true },
            // Ciertos: para estar en el paso 2 hay que haber pasado por los dos.
            { texto: 'Cuánto vas a prestar', hecho: true },
            { texto: 'Traer tu cartera', actual: true },
            { texto: 'Salir a cobrar' },
          ]}
        />
      )}

      {step === 2 && flujo && vioPlan && metodo === 'excel' && (
        <WizardExcel
          onComplete={handleCartullinaDone}
          onSkip={handleCartulinaSkip}
        />
      )}

      {step === 2 && flujo && vioPlan && metodo === 'foto' && (
        <WizardCartulina
          onComplete={handleCartullinaDone}
          onSkip={handleCartulinaSkip}
        />
      )}

      {step === 3 && flujo && (
        <WizardExito
          clientes={importResult?.clientesCreados ?? 0}
          prestamos={importResult?.prestamosCreados ?? 0}
          cartera={importResult?.cartera ?? 0}
          cobrosHoy={importResult?.cobrosHoy ?? 0}
          faltantes={importResult?.faltantes ?? []}
          onVerCobros={() => { window.location.href = '/cobros-hoy' }}
          onFinish={handleFinish}
        />
      )}

      {step < 3 && <WizardAyuda />}
    </div>
  )
}
