'use client'

import { useState, useCallback } from 'react'
import WizardProgress   from './wizard/WizardProgress'
import WizardWelcome    from './wizard/WizardWelcome'
import WizardCapital    from './wizard/WizardCapital'
import LoteFotos       from '@/components/migrador/LoteFotos'
import TraerCartera from '@/components/pantallas/TraerCartera'
import { ListoParaCobrar } from '@/components/pantallas/Onboarding'
import { formatMoney } from '@/lib/i18n'
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

/* ⚠ LO QUE `onboardingStep` NO PUEDE CONTAR.
 *
 * En la base se ve en qué paso quedó cada uno, y eso ya dijo lo importante: de
 * los 29 que entraron con la campaña nueva, 17 no pasaron de «traer tu
 * cartera» —nueve ahí y ocho saltándola— y solo uno terminó el arranque.
 *
 * Pero el paso 2 son TRES pantallas seguidas —planes, elegir método, y la foto
 * o el Excel— y en la base son el mismo número. Así no se sabe si se van en la
 * pantalla de planes, ante las tres opciones, o intentando la foto.
 *
 * Se apunta SOLO eso: las bifurcaciones que el número no distingue. Nada
 * decorativo —cada evento contesta una pregunta que hoy no tiene respuesta y
 * que decide qué se rehace—. */
const marcar = (evento, extra) => {
  fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ evento, pagina: '/onboarding', metadata: extra }),
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
    marcar('onb_cartera_saltada', { flujo, metodo })
    persistStep(3, flujo)
    setStep(3)
  }, [flujo, metodo])

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
          onCargar={() => { marcar('onb_plan_seguir', { flujo }); setVioPlan(true) }}
          onPagar={() => {
            // Se van del asistente a pagar. Si muchos salen por aquí y no
            // vuelven, la pantalla de planes está puesta demasiado pronto.
            marcar('onb_plan_pagar', { flujo })
            window.location.href = '/configuracion/plan'
          }}
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
          onFoto={() => { marcar('onb_metodo', { metodo: 'foto', flujo }); setMetodo('foto') }}
          onExcel={() => { marcar('onb_metodo', { metodo: 'excel', flujo }); setMetodo('excel') }}
          onCero={() => {
            /* ⚠ PASO 50, NO 2. Quien elige empezar de cero SE VA del asistente
             * a crear su primer cliente: no se quedó atascado, avanzó por otra
             * puerta. Guardando 2 quedaba marcado como detenido para siempre,
             * y al volver aterrizaba otra vez en la pantalla de planes.
             *
             * Medido el 28 ago 2026: de las 88 organizaciones «detenidas en el
             * paso 2», 19 tienen entre 1 y 5 clientes cargados — son éstas. El
             * 60% de quienes eligen método eligen éste, así que el número que
             * mide si el arranque funciona venía inflado por su propia gente.
             *
             * 50 es «ya vio el asistente»: lo apaga y enciende la lista de
             * misiones, que es exactamente lo que necesita quien se va a cargar
             * su cartera a mano. */
            marcar('onb_metodo', { metodo: 'cero', flujo })
            persistStep(50, flujo)
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

      {/* ── ⚠ LA TARJETA PROMETÍA UN LECTOR Y LLEVABA AL OTRO ─────────────
          Hay DOS lectores de fotos y hacen cosas distintas:

            leer-cartulina        UN cliente, hasta 5 fotos que se FUSIONAN
            leer-cartulinas-lote  30 fotos, hasta 30 clientes

          La tarjeta dice «si tienes 40 préstamos en una libreta, unos 20
          minutos» —y colgaba del primero, que no puede devolver más de uno—.
          Cuarenta préstamos por ahí son cuarenta vueltas, no veinte minutos.

          Medido en producción el 15 ago 2026, esto explica la contradicción
          entre las dos cifras del proyecto: el 97% carga de a poco PORQUE la
          vía en ráfaga nunca estuvo en el arranque —vive en /migrador, al que
          llegan 104 de 483—. Y quien logra cargar rápido paga el 51%, el
          segmento que mejor convierte de todos.

          ⚠ NO se cambia el orden de la pantalla anterior: «escribe tu primer
          cliente» sigue primera y dorada. De los 104 que abren el migrador
          solo 29 (28%) consiguen cargar; poner ese paso de primeras sería
          mudar el muro, no quitarlo. Lo que se arregla es que quien ELIGE la
          foto reciba el lector que cumple lo que la tarjeta le prometió. */}
      {step === 2 && flujo && vioPlan && metodo === 'foto' && (
        <LoteFotos
          onSalir={handleCartulinaSkip}
          /* `quedanFilas` es «algunas no se guardaron y siguen en pantalla»:
             ahí NO se avanza, o el usuario pierde las filas con su motivo y
             tendría que volver a fotografiarlas. */
          onListo={({ creados, quedanFilas }) => {
            if (quedanFilas) return
            handleCartullinaDone({
              clientesCreados: creados?.length ?? 0,
              prestamosCreados: creados?.length ?? 0,
              fallos: [],
            })
          }}
        />
      )}

      {/* ⚠ LA SALIDA QUE TRAÍA EL LECTOR VIEJO Y EL DE TANDA NO TIENE.
          `WizardCartulina` remataba con dos escapes: «Tengo un Excel o CSV» y
          «quiero registrar manualmente». El de tanda solo trae el segundo
          —«Prefiero escribirlos a mano», y solo mientras no haya subido nada—.
          Sin esto, quien entra por la foto y se acuerda de que tiene el Excel
          se queda sin puerta, que es cómo un rediseño pierde funciones sin que
          nadie lo note. Va al paso de Excel del propio asistente, no a
          /carga-masiva: salir del arranque es de donde no se vuelve. */}
      {step === 2 && flujo && vioPlan && metodo === 'foto' && (
        <button
          type="button"
          onClick={() => { marcar('onb_metodo', { metodo: 'excel', flujo, desde: 'foto' }); setMetodo('excel') }}
          style={{
            alignSelf: 'center', marginTop: 14, background: 'none', border: 'none',
            padding: '8px 4px', cursor: 'pointer', font: 'inherit',
            fontSize: 13, color: 'var(--cf-ink-2)', textDecoration: 'underline',
          }}
        >Tengo un Excel o CSV</button>
      )}

      {/* ── T22-00 · EL CIERRE DEL ARCO ──
          La pantalla de la cartera vacia prometia «cuando termines vas a ver»
          con las cifras en gris y a cero. Esta es la misma promesa CUMPLIDA: la
          cartera en oro sobre carbon, que es la cifra que convence, y debajo lo
          que de verdad se cargo.

          Y el paso siguiente es EL COBRO, no «finalizar». Quien acaba de subir
          su cartera a las diez de la noche no sale a cobrar hoy, pero quien la
          sube a las siete de la manana si — y el boton tiene que llevarlo ahi,
          no a un panel que todavia no sabe leer. */}
      {step === 3 && flujo && (() => {
        const clientes  = importResult?.clientesCreados  ?? 0
        const prestamos = importResult?.prestamosCreados ?? 0
        const cobrosHoy = importResult?.cobrosHoy ?? 0
        const faltantes = importResult?.faltantes ?? []
        return (
          <ListoParaCobrar
            // Va dentro del panel, no a pantalla completa: sin la barra blanca.
            embebido
            titulo="Ya tienes tu cartera adentro"
            subtitulo={prestamos > 0
              ? `${prestamos} ${prestamos === 1 ? 'préstamo' : 'préstamos'} de ${clientes} ${clientes === 1 ? 'cliente' : 'clientes'}`
              : null}
            cartera={importResult?.cartera ? formatMoney(Math.round(importResult.cartera)) : null}
            cifras={[
              { etiqueta: 'Clientes', valor: String(clientes) },
              { etiqueta: 'Préstamos', valor: String(prestamos) },
              // «A cobrar hoy» solo si de verdad toca alguno: un «0 de 0» al
              // final de la carga se lee como que algo salio mal.
              ...(cobrosHoy > 0 ? [{ etiqueta: 'A cobrar hoy', valor: String(cobrosHoy) }] : []),
            ]}
            // LO QUE FALTA, «CUANDO PUEDAS». No es una lista de errores: es lo
            // que la lectura no pudo sacar y se puede completar despues. Sin ese
            // «cuando puedas», una cartera cargada al 95% se siente fallida.
            falta={faltantes}
            faltaNota={faltantes.length > 0
              ? 'La app funciona igual sin esto. Lo puedes completar cuando lo tengas a mano.'
              : null}
            cobrosHoy={cobrosHoy}
            onVerCobros={() => { window.location.href = '/cobros-hoy' }}
            onPanel={handleFinish}
          />
        )
      })()}

      {step < 3 && <WizardAyuda />}
    </div>
  )
}
