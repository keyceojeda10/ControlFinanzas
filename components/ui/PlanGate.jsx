'use client'
// components/ui/PlanGate.jsx — la pantalla de «esto es de otro plan».
//
// ══ POR QUÉ ESTÁ AQUÍ Y NO DENTRO DE UNA PÁGINA ═══════════════════════════
//
// Vivía dentro de `app/(dashboard)/reportes/page.jsx`. Al cerrar Analíticas y
// el ranking hacían falta tres, y copiarla tres veces es cómo se acaba con tres
// pantallas que dicen cosas distintas del mismo plan.
//
// ⚠ Y hace falta que exista. Sin ella, un negocio en plan Inicial que abre
// Analíticas recibe un 403 del API y la pantalla dice **«No pudimos cargar tus
// números. Revisa la conexión»**: le echa la culpa a su internet por algo que
// es del plan. Ese `catch` que se traga el motivo real ya nos costó un
// diagnóstico falso en la pantalla de bajar reportes.

const ICONO_BARRAS = (
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
    d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
)

/**
 * @param {string}   titulo    Qué es lo que está detrás del plan.
 * @param {string}   texto     Una línea de para qué sirve. Sin promesas.
 * @param {string[]} incluye   Lo que se lleva quien sube. Máximo cinco.
 */
export default function PlanGate({
  titulo = 'Reportes y análisis',
  texto = 'Mira cómo va tu negocio con los números al día.',
  incluye = [],
}) {
  /* Los colores rotan por la lista en vez de venir en los datos: quien añade
     una línea no tiene que elegir un color, y así no entra un `#hex` suelto
     saltándose los tokens. */
  const COLORES = ['var(--cf-green-dark)', 'var(--cf-gold-dark)', 'var(--cf-ink-2)',
    'var(--cf-ink-2)', 'var(--cf-red-dark)']

  return (
    <div className="max-w-xl mx-auto mt-8">
      <div
        className="rounded-[20px] p-6 text-center cf-card-shadow"
        style={{
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--cf-gold) 8%, var(--cf-card)) 0%, var(--cf-card) 100%)',
          border: '1px solid color-mix(in srgb, var(--cf-gold) 22%, var(--cf-border))',
        }}
      >
        <div
          className="w-14 h-14 rounded-[16px] flex items-center justify-center mx-auto mb-4"
          style={{ background: 'color-mix(in srgb, var(--cf-gold) 15%, transparent)' }}
        >
          <svg className="w-7 h-7" style={{ color: 'var(--cf-gold)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {ICONO_BARRAS}
          </svg>
        </div>

        <p className="text-base font-bold mb-1" style={{ color: 'var(--cf-ink)' }}>{titulo}</p>
        <p className="text-[13px] mb-5" style={{ color: 'var(--cf-ink-3)' }}>{texto}</p>

        {incluye.length > 0 && (
          <div className="inline-flex flex-col gap-2.5 text-left mb-5">
            {incluye.slice(0, 5).map((linea, i) => (
              <div key={linea} className="flex items-center gap-2.5">
                <div
                  className="w-4 h-4 rounded-[6px] flex items-center justify-center shrink-0"
                  style={{ background: `color-mix(in srgb, ${COLORES[i % COLORES.length]} 18%, transparent)` }}
                >
                  <svg className="w-2.5 h-2.5" style={{ color: COLORES[i % COLORES.length] }} fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <span className="text-[12px]" style={{ color: 'var(--cf-ink-2)' }}>{linea}</span>
              </div>
            ))}
          </div>
        )}

        <a
          href="/configuracion/plan"
          className="inline-flex items-center gap-2 text-[13px] font-bold px-5 py-2.5 rounded-[12px] transition-all"
          style={{ background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)' }}
        >
          Ver planes
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </a>
      </div>
    </div>
  )
}
