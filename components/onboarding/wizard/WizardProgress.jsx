'use client'

const CHECK_ICON = (
  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
  </svg>
)

export default function WizardProgress({ step, totalSteps = 3 }) {
  // step 0 = welcome (no circles), steps 1-3 map to circles 0-2
  const activeIndex = step - 1
  const pct = step === 0 ? 0 : Math.round((step / totalSteps) * 100)

  return (
    <div className="mb-8">
      {/* Progress bar */}
      <div className="h-1 bg-[#2a2a2a] rounded-full overflow-hidden mb-5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#f5c518] to-[#f0b800] transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Step circles */}
      {step > 0 && (
        <div className="flex items-center justify-center gap-0">
          {Array.from({ length: totalSteps }).map((_, i) => {
            const isCompleted = i < activeIndex
            const isActive = i === activeIndex
            return (
              <div key={i} className="flex items-center">
                {/* Circle */}
                <div
                  className={[
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300',
                    isCompleted
                      ? 'bg-[#22c55e] text-white'
                      : isActive
                      ? 'bg-[#f5c518] text-[#111111]'
                      : 'border-2 border-[#3a3a3a] text-[#555555]',
                  ].join(' ')}
                >
                  {isCompleted ? CHECK_ICON : i + 1}
                </div>
                {/* Connector line */}
                {i < totalSteps - 1 && (
                  <div
                    className={[
                      'w-12 h-0.5 transition-all duration-500',
                      i < activeIndex ? 'bg-[#22c55e]' : 'bg-[#2a2a2a]',
                    ].join(' ')}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
