'use client'

// components/onboarding/wizard/WizardExito.jsx — «03 · Listo».
//
// El último paso. Su trabajo no es felicitar: es ENSEÑAR QUE LA PLATA YA ESTÁ
// DENTRO. «Ya tienes tu negocio en la app · 18 clientes y 31 préstamos, sacados
// de tu cuaderno», y la cifra de la cartera en grande, porque esa es la prueba
// de que el rato invertido sirvió para algo.
//
// «Lo que falta, cuando puedas» NO es una lista de errores. Es lo que se puede
// completar sin prisa, dicho con la frase que quita la urgencia: «Nada de esto
// te frena. Puedes cobrar hoy mismo y completarlo cuando pases por su casa.»
// Sin ella, quien acaba de importar 68 clientes con 44 teléfonos incompletos
// cree que tiene 44 problemas antes de haber cobrado el primer peso.
//
// La acción dorada es VER LOS COBROS DE HOY, no «ir al panel»: el onboarding no
// termina cuando los datos están, termina cuando la persona cobra.

import { useCountry } from '@/hooks/useCountry'

function Cifra({ etiqueta, valor }) {
  return (
    <span style={{ flex: 1, minWidth: 0 }}>
      <span className="cf-fig" style={{
        display: 'block', fontSize: 21, fontWeight: 700, color: 'var(--cf-ink)', lineHeight: 1.1,
      }}>
        {valor}
      </span>
      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--cf-ink-3)', marginTop: 3 }}>
        {etiqueta}
      </span>
    </span>
  )
}

export default function WizardExito({
  clientes = 0, prestamos = 0, cartera = 0, cobrosHoy = 0,
  faltantes = [],            // [{ texto: '6 clientes sin teléfono' }]
  onVerCobros, onFinish,
}) {
  const { formatMoney } = useCountry()
  const hayCartera = clientes > 0

  return (
    <div className="max-w-lg mx-auto flex flex-col" style={{ gap: 20 }}>
      <div>
        <h2 style={{
          fontFamily: 'var(--font-space-grotesk), system-ui',
          fontSize: 23, fontWeight: 600, letterSpacing: '-.02em',
          color: 'var(--cf-ink)', margin: 0, lineHeight: 1.2,
        }}>
          {hayCartera ? 'Ya tienes tu negocio en la app' : 'Tu cuenta está lista'}
        </h2>
        <p style={{ fontSize: 13.5, color: 'var(--cf-ink-2)', marginTop: 6, lineHeight: 1.45 }}>
          {hayCartera
            ? `${clientes} cliente${clientes === 1 ? '' : 's'} y ${prestamos} préstamo${prestamos === 1 ? '' : 's'}, sacados de tu cuaderno.`
            : 'Cuando cargues tus clientes, aquí verás quién te debe y cuánto.'}
        </p>
      </div>

      {hayCartera && (
        <div style={{
          padding: '18px 19px', borderRadius: 'var(--cf-r-card)',
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
        }}>
          <span style={{
            display: 'block', fontSize: 10.5, fontWeight: 700, letterSpacing: '.09em',
            textTransform: 'uppercase', color: 'var(--cf-ink-3)',
          }}>
            Tu cartera quedó en
          </span>
          <span className="cf-fig" style={{
            display: 'block', fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 34, fontWeight: 600, letterSpacing: '-.02em',
            color: 'var(--cf-ink)', marginTop: 4, lineHeight: 1.1,
          }}>
            {formatMoney(cartera)}
          </span>

          <div style={{
            display: 'flex', gap: 12, marginTop: 16, paddingTop: 15,
            borderTop: '1px solid var(--cf-divider)',
          }}>
            <Cifra etiqueta="Clientes" valor={clientes} />
            <Cifra etiqueta="Préstamos" valor={prestamos} />
            <Cifra etiqueta="Cobras hoy" valor={cobrosHoy} />
          </div>
        </div>
      )}

      {faltantes.length > 0 && (
        <div>
          <span style={{
            display: 'block', fontSize: 10.5, fontWeight: 700, letterSpacing: '.09em',
            textTransform: 'uppercase', color: 'var(--cf-ink-3)', marginBottom: 8,
          }}>
            Lo que falta, cuando puedas
          </span>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {faltantes.map((f, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--cf-ink-2)' }}>
                <span aria-hidden style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--cf-ink-4)', flex: 'none' }} />
                {f.texto ?? f}
              </li>
            ))}
          </ul>
          {/* La frase que quita la urgencia. Es la diferencia entre «tengo 44
              problemas» y «tengo 44 recados para cuando pase por allí». */}
          <p style={{ fontSize: 12.5, color: 'var(--cf-ink-3)', margin: '10px 0 0', lineHeight: 1.5 }}>
            Nada de esto te frena. Puedes cobrar hoy mismo y completarlo cuando
            pases por su casa.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        <button type="button" onClick={cobrosHoy > 0 ? onVerCobros : onFinish} style={{
          width: '100%', height: 'var(--cf-h-btn)', border: 0,
          borderRadius: 'var(--cf-r-control)', cursor: 'pointer',
          background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
          fontSize: 15, fontWeight: 700,
        }}>
          {cobrosHoy > 0 ? `Ver los ${cobrosHoy} cobros de hoy` : 'Ir al panel'}
        </button>
        {cobrosHoy > 0 && (
          <button type="button" onClick={onFinish} style={{
            background: 'none', border: 0, cursor: 'pointer',
            fontSize: 13, color: 'var(--cf-ink-3)', textDecoration: 'underline', textUnderlineOffset: 3,
          }}>
            Ir al panel
          </button>
        )}
      </div>
    </div>
  )
}
