'use client'

// app/estilo/onboarding/page.jsx — los 3 pasos del asistente, uno al lado del
// otro, para poder mirarlos sin tener una cuenta recién creada.
//
// EXISTE POR UN AGUJERO DE MI ARNÉS: el asistente solo aparece con la cuenta
// sin onboarding, y scripts/sesion-dev.mjs fuerza onboardingCompletado: true
// para poder auditar el resto del sistema. Sin esta página, estas tres
// pantallas se escriben a ciegas.

import WizardWelcome from '@/components/onboarding/wizard/WizardWelcome'
import WizardCapital from '@/components/onboarding/wizard/WizardCapital'
import WizardMetodoCarga from '@/components/onboarding/wizard/WizardMetodoCarga'
import WizardProgress from '@/components/onboarding/wizard/WizardProgress'
import WizardExito from '@/components/onboarding/wizard/WizardExito'

function Paso({ n, titulo, children }) {
  return (
    <div style={{ width: 390, flex: 'none' }}>
      <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
        color: 'var(--cf-ink-3)', margin: '0 0 10px' }}>
        {titulo}
      </p>
      <div style={{ background: 'var(--cf-surface)', border: '1px solid var(--cf-border)',
        borderRadius: 20, padding: 20, minHeight: 620 }}>
        <WizardProgress step={n} totalSteps={4} />
        <div style={{ marginTop: 18 }}>{children}</div>
      </div>
    </div>
  )
}

export default function PreviaOnboarding() {
  return (
    <div style={{ background: 'var(--cf-fill)', minHeight: '100vh', padding: 26,
      fontFamily: 'var(--font-manrope), system-ui' }}>
      <h1 style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 24, fontWeight: 600,
        letterSpacing: '-.025em', color: 'var(--cf-ink)', margin: '0 0 4px' }}>
        Onboarding · los 4 pasos
      </h1>
      <p style={{ fontSize: 13, color: 'var(--cf-ink-3)', margin: '0 0 24px' }}>
        Las cifras de «Listo» son las que saldrian del Excel real de 68 creditos.
      </p>

      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Paso n={1} titulo="01 · Perfil">
          <WizardWelcome nombre="Carlos Andrés Ojeda" onSelect={() => {}} onMinimize={() => {}} />
        </Paso>
        <Paso n={2} titulo="02 · Capital">
          <WizardCapital onComplete={() => {}} alreadyDone savedMonto={3000000} />
        </Paso>
        <Paso n={3} titulo="03 · Método de carga">
          <WizardMetodoCarga onElegir={() => {}} onSaltar={() => {}} />
        </Paso>
        <Paso n={4} titulo="03 · Listo">
          <WizardExito
            clientes={68}
            prestamos={68}
            cartera={128000000}
            cobrosHoy={7}
            faltantes={[
              { texto: 'El archivo no trae la cédula' },
              { texto: '44 sin el teléfono' },
            ]}
            onVerCobros={() => {}}
            onFinish={() => {}}
          />
        </Paso>
      </div>
    </div>
  )
}
