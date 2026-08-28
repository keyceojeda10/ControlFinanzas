'use client'

import { useAuth } from '@/hooks/useAuth'
import { useState } from 'react'
import { useCountry } from '@/hooks/useCountry'

export default function WizardCapital({ onComplete, alreadyDone, savedMonto = 0 }) {
  const { formatMoney, currencySymbol } = useCountry()
  const [monto, setMonto] = useState(savedMonto > 0 ? String(savedMonto) : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  /* ⚠ EL MODO ABREVIADO, que aquí faltaba.
   *
   * Siete negocios lo tienen encendido: ahí «500» son $500.000. Este campo era
   * un `<input>` propio y no lo aplicaba, así que quien arranca con el modo
   * puesto teclea 500 y registra QUINIENTOS PESOS de capital inicial — la
   * primera cifra de su negocio, y la que decide si la caja cuadra desde el
   * primer día.
   *
   * Se lee de `useAuth` y NO de una prop, por lo mismo que en `AtajosCobro`: si
   * dependiera de que quien monta la pantalla se acuerde de pasarla, se
   * perdería en la siguiente. */
  const { modoAbreviado } = useAuth()
  const tecleado = Number(monto.replace(/\D/g, '')) || 0
  const montoNum = modoAbreviado ? tecleado * 1000 : tecleado

  const handleChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '')
    setMonto(raw)
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (montoNum <= 0) {
      setError('Ingresa un monto mayor a 0')
      return
    }

    // Si ya se registró capital antes (volvió atrás), solo avanzar
    if (alreadyDone) {
      onComplete({ monto: montoNum })
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/capital', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'capital_inicial',
          monto: montoNum,
          descripcion: 'Capital inicial registrado en el onboarding',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al registrar el capital')
        return
      }
      onComplete({ monto: montoNum })
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    onComplete({ monto: 0, skipped: true })
  }

  // Los atajos del diseño. SUMAN sobre lo que ya hay, no reemplazan: quien
  // teclea 2 millones y toca +1M espera 3, no 1.
  const ATAJOS = [500000, 1000000, 5000000]
  /* Los atajos suman en la escala que se ve: con el modo puesto, «+100.000»
     debe subir el campo en 100, no en 100.000. */
  const sumar = (n) => { setMonto(String(tecleado + (modoAbreviado ? n / 1000 : n))); setError('') }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto flex flex-col" style={{ gap: 20 }}>
      <div>
        <h2 style={{
          fontFamily: 'var(--font-space-grotesk), system-ui',
          fontSize: 22, fontWeight: 600, letterSpacing: '-.02em',
          color: 'var(--cf-ink)', margin: 0, lineHeight: 1.2,
        }}>
          ¿Con cuánto dinero arrancas?
        </h2>
        <p style={{ fontSize: 13.5, color: 'var(--cf-ink-2)', marginTop: 6, lineHeight: 1.45 }}>
          El efectivo que tienes disponible para prestar hoy.
        </p>
      </div>

      {/* «EL MONTO ES LA PANTALLA»: 40px tabular. No es un campo más de un
          formulario — es la única cifra que se pide aquí, y de ella depende que
          la caja no arranque en negativo. */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <span style={{
          fontSize: 10.5, fontWeight: 700, letterSpacing: '.09em',
          textTransform: 'uppercase', color: 'var(--cf-ink-3)',
        }}>
          Capital inicial · COP
        </span>
        <span style={{
          display: 'flex', alignItems: 'center', gap: 6,
          borderBottom: '2px solid ' + (error ? 'var(--cf-red)' : 'var(--cf-border-strong)'),
          paddingBottom: 6,
        }}>
          <span className="cf-fig" style={{ fontSize: 30, fontWeight: 600, color: 'var(--cf-ink-3)' }}>
            {currencySymbol || '$'}
          </span>
          <input
            // type=text + inputMode, no type=number: <input type=number> rechaza
            // el separador que no coincide con el idioma del teléfono, y el
            // campo se queda vacío sin decir por qué.
            type="text"
            inputMode="numeric"
            autoFocus
            value={tecleado ? tecleado.toLocaleString('es-CO') : ''}
            onChange={handleChange}
            placeholder="0"
            style={{
              flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'none',
              fontFamily: 'var(--font-space-grotesk), system-ui',
              fontVariantNumeric: 'tabular-nums',
              fontSize: 40, fontWeight: 600, letterSpacing: '-.02em',
              color: 'var(--cf-ink)', padding: 0,
            }}
          />
          {modoAbreviado && (
            <span className="cf-fig" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cf-gold)', flex: 'none' }}>
              x1.000
            </span>
          )}
        </span>
      </label>
      {/* Igual que `MoneyInput`: la conversión se VE antes de guardar. Una cifra
          multiplicada por mil a espaldas de quien la escribe es la que aparece
          semanas después como un descuadre que nadie sabe explicar. */}
      {modoAbreviado && tecleado > 0 && (
        <p className="cf-fig" style={{ fontSize: 12, fontWeight: 700, color: 'var(--cf-gold)', marginTop: 6 }}>
          = {montoNum.toLocaleString('es-CO')}
        </p>
      )}

      {/* Atajos de 44px: se tocan con el pulgar en la calle. El diseño lo dice
          explícito —«no chips de 26px»— porque el tamaño ES la diferencia entre
          que se usen y que no. */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {ATAJOS.map((n) => (
          <button key={n} type="button" onClick={() => sumar(n)} style={{
            height: 44, padding: '0 16px', borderRadius: 999, cursor: 'pointer',
            background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
            fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)',
          }}>
            +{n >= 1000000 ? (n / 1000000) + 'M' : (n / 1000) + 'k'}
          </button>
        ))}
        {montoNum > 0 && (
          <button type="button" onClick={() => { setMonto(''); setError('') }} style={{
            height: 44, padding: '0 16px', borderRadius: 999, cursor: 'pointer',
            background: 'none', border: '1px solid var(--cf-border)',
            fontSize: 14, fontWeight: 600, color: 'var(--cf-ink-3)',
          }}>
            Borrar
          </button>
        )}
      </div>

      {error && (
        <p style={{ fontSize: 12.5, color: 'var(--cf-red-darker)', margin: 0 }}>{error}</p>
      )}

      {/* La consecuencia, dicha ANTES de que pase. No es una advertencia
          genérica: dice qué va a salir mal y dónde se arregla.

          ⚠ ANTES DECÍA «si lo dejas en cero… puedes corregirlo después», y eso
          se lee como que Continuar acepta el cero. No lo acepta: responde
          «Ingresa un monto mayor a 0». La salida existe y está justo debajo
          —«Lo registro después»—, pero esta frase mandaba al control que no
          era. Recorriendo el asistente a 412px, las dos salidas SÍ se ven en
          los tres tamaños de teléfono: el problema era solo dónde apuntaba. */}
      <p style={{ fontSize: 12.5, color: 'var(--cf-ink-3)', margin: 0, lineHeight: 1.5 }}>
        Si no lo sabes ahora, toca «Lo registro después». Dejarlo en cero aquí
        no te deja seguir: el sistema necesita una cifra o saber que la darás luego.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        <button type="submit" disabled={loading} style={{
          width: '100%', height: 'var(--cf-h-btn)', border: 0,
          borderRadius: 'var(--cf-r-control)', cursor: loading ? 'default' : 'pointer',
          background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
          fontSize: 15, fontWeight: 700, opacity: loading ? 0.6 : 1,
        }}>
          {loading ? 'Guardando…' : 'Continuar'}
        </button>
        {/* ── SALTARSE ESTO TIENE UNA CONSECUENCIA, Y HAY QUE DECIRLA ──────
            De 253 negocios en producción, **107 tienen el capital en negativo**
            y **98 de ellos nunca registraron su capital inicial**: empezaron a
            prestar desde aquí, la bolsa arrancó en cero y cada préstamo la fue
            bajando. Meses después ven un número rojo enorme y lo único que
            pueden pensar es que el sistema les perdió la plata.
            (No hay ningún fallo de cuentas: los 253 cuadran al peso.)

            El botón se queda —obligar a inventar una cifra sería peor—, pero
            debajo se dice qué va a pasar. Un «lo registro después» a secas no
            deja ver que el saldo va a salir en negativo hasta que lo registre. */}
        <button type="button" onClick={handleSkip} style={{
          background: 'none', border: 0, cursor: 'pointer',
          fontSize: 13, color: 'var(--cf-ink-3)', textDecoration: 'underline', textUnderlineOffset: 3,
        }}>
          Lo registro después
        </button>
        <p style={{
          margin: 0, fontSize: 11.5, lineHeight: 1.45, textAlign: 'center',
          color: 'var(--cf-ink-3)', maxWidth: 380,
        }}>
          Si lo dejas para después, tu caja va a salir <strong>en negativo</strong> hasta
          que lo registres: el sistema no sabe con cuánto empezaste y cada préstamo
          resta. Lo puedes poner luego en <strong>Capital</strong>.
        </p>
      </div>
    </form>
  )
}
