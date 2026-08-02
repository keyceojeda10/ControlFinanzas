'use client'

// components/pantallas/CrearPrestamo.jsx — turno 4 (móvil) y 16 (1440).
//
// UNA SOLA BARRA DE PROGRESO en todo el wizard: la espina de la cabecera. Sin
// barras anidadas ni "paso 2 de 3" repetido dentro del cuerpo — dos indicadores
// del mismo avance solo pueden contradecirse.
//
// LA LÍNEA QUE NO EXISTE HOY: "te quedan $3,2M disponibles en caja después de
// este préstamo". El dueño está decidiendo cuánto sacar de su propio bolsillo y
// la app nunca se lo dice; lo calcula de cabeza, o no lo calcula.
//
// EN 1440 NO HAY WIZARD. El wizard existe porque en un teléfono no cabe todo;
// en escritorio los tres pasos van a la izquierda y la tabla se recalcula a la
// derecha con cada tecla. Subir el interés de 20 a 25 mueve la cuota, la
// ganancia y las ocho filas MIENTRAS se decide — que es justo lo que el dueño
// hace hoy con una calculadora al lado.

import { Tarjeta, BarraAccion, BotonPrimario, EtiquetaCampo, AyudaCampo, Chip, Pastilla, Aviso } from '@/components/cf/primitivos'

/* ── Paso 1 · cuánto ──────────────────────────────────────────────────────
   El teclado va EN LA PANTALLA y no es el del sistema. En el del teléfono la
   tecla de borrar cambia de sitio según el fabricante, no hay separador de
   miles, y la mitad de la pantalla desaparece sin avisar. Acá el monto siempre
   se ve mientras se teclea, que es el único requisito real. */
const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', '⌫']

function Teclado({ onTecla }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, flex: 'none',
      padding: '10px 12px 14px', background: 'var(--cf-card)', borderTop: '1px solid var(--cf-border)',
    }}>
      {TECLAS.map((t) => (
        <button key={t} type="button" onClick={() => onTecla?.(t)} style={{
          height: 52, borderRadius: 'var(--cf-r-control)', cursor: 'pointer',
          background: t === '⌫' ? 'var(--cf-fill)' : 'var(--cf-card)',
          border: '1px solid var(--cf-border)',
          fontFamily: 'var(--font-space-grotesk), system-ui',
          fontVariantNumeric: 'tabular-nums lining-nums',
          fontSize: t === '⌫' ? 18 : 21, fontWeight: 600, color: 'var(--cf-ink)',
        }}>{t}</button>
      ))}
    </div>
  )
}

export function CrearPrestamoMonto({
  cliente, iniciales, contextoCliente,
  monto, atajos = [], atajoActivo,
  quedaEnCaja, alerta,
  onCambiarCliente, onAtajo, onTecla, onSeguir,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '10px var(--cf-pad-screen) 12px' }}>

        {/* A quién, arriba y cambiable: equivocarse de cliente es el error caro
            de esta pantalla y se descubre al final si no está a la vista. */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 12, flex: 'none',
          padding: '11px 13px', background: 'var(--cf-card)',
          border: '1px solid var(--cf-border)', borderRadius: 'var(--cf-r-card)',
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 38, minWidth: 38, height: 38, aspectRatio: '1', borderRadius: 999,
            flex: 'none', alignSelf: 'flex-start',
            background: 'var(--cf-fill)', fontSize: 13, fontWeight: 700, color: 'var(--cf-ink-2)',
          }}>{iniciales}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              display: 'block', fontSize: 14.5, fontWeight: 700, color: 'var(--cf-ink)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{cliente}</span>
            {/* Tres hechos en una linea: cedula, estado y su historial. El que
                se corta es siempre el ultimo, y es el que dice si conviene
                prestarle. Envuelve. */}
            <span className="cf-num" style={{
              display: 'block', fontSize: 11.5, color: 'var(--cf-ink-3)', marginTop: 2,
              lineHeight: 1.35, minWidth: 0,
            }}>{contextoCliente}</span>
          </span>
          <button type="button" onClick={onCambiarCliente} style={{
            background: 'none', border: 0, cursor: 'pointer', flex: 'none',
            fontSize: 12.5, fontWeight: 700, color: 'var(--cf-gold-dark)',
          }}>Cambiar</button>
        </div>

        <EtiquetaCampo>Cuánto le vas a prestar</EtiquetaCampo>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flex: 'none', padding: '2px 2px 4px' }}>
          <span className="cf-fig" style={{ fontSize: 30, color: 'var(--cf-ink-3)', flex: 'none' }}>$</span>
          <span className="cf-fig" style={{ fontSize: 44, letterSpacing: '-.035em', color: 'var(--cf-ink)', flex: 1, minWidth: 0 }}>
            {monto}
          </span>
        </span>

        <div style={{ display: 'flex', gap: 'var(--cf-gap-chips)', flexWrap: 'wrap', flex: 'none' }}>
          {atajos.map((a) => (
            <Chip key={a} activo={a === atajoActivo} onClick={() => onAtajo?.(a)}>{a}</Chip>
          ))}
        </div>

        {/* ESTA LÍNEA NO EXISTE HOY. Prestar es sacar plata del bolsillo propio,
            y la app nunca dice con cuánto se queda el dueño. */}
        {alerta
          ? <Aviso tono="ambar">{alerta}</Aviso>
          : (
            <span className="cf-num" style={{ fontSize: 12.5, color: 'var(--cf-ink-2)', lineHeight: 1.45, flex: 'none' }}>
              Te quedan <strong>{quedaEnCaja}</strong> disponibles en caja después de este préstamo.
            </span>
          )}

        <span style={{ flex: 1, minHeight: 4 }} />
      </div>

      <Teclado onTecla={onTecla} />

      <BarraAccion>
        <BotonPrimario onClick={onSeguir}>Seguir</BotonPrimario>
      </BarraAccion>
    </div>
  )
}

/* ── Paso 2 · condiciones ─────────────────────────────────────────────────
   El resultado va ARRIBA y se recalcula al escribir, igual que el simulador. */

function Fila({ etiqueta, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 'none' }}>
      <EtiquetaCampo>{etiqueta}</EtiquetaCampo>
      {children}
    </div>
  )
}

function CampoCorto({ valor, sufijo, ayuda }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 0 }}>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 6, flex: 'none',
        height: 'var(--cf-h-field)', padding: '0 14px', borderRadius: 'var(--cf-r-control)',
        background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
      }}>
        <input defaultValue={valor} type="text" inputMode="decimal" style={{
          flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'none',
          fontFamily: 'var(--font-space-grotesk), system-ui',
          fontVariantNumeric: 'tabular-nums lining-nums',
          fontSize: 17, fontWeight: 600, color: 'var(--cf-ink)',
        }} />
        <span style={{ fontSize: 13, color: 'var(--cf-ink-3)', flex: 'none' }}>{sufijo}</span>
      </label>
      {ayuda && <AyudaCampo>{ayuda}</AyudaCampo>}
    </div>
  )
}

function OpcionModo({ nombre, nota, insignia, activo, onElegir }) {
  return (
    <button type="button" onClick={onElegir} style={{
      display: 'flex', alignItems: 'center', gap: 10, width: '100%', flex: 'none',
      minHeight: 56, padding: '10px 14px', cursor: 'pointer', textAlign: 'left',
      background: activo ? 'var(--cf-gold-tint)' : 'var(--cf-card)',
      border: `1px solid ${activo ? 'var(--cf-gold-border)' : 'var(--cf-border)'}`,
      borderRadius: 'var(--cf-r-control)',
    }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{
            fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{nombre}</span>
          {insignia && <Pastilla tono="aldia" style={{ height: 19, fontSize: 9, flex: 'none' }}>{insignia}</Pastilla>}
        </span>
        {/* La nota dice qué le pasa AL CLIENTE, no la fórmula. */}
        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--cf-ink-3)', marginTop: 3 }}>
          {nota}
        </span>
      </span>
    </button>
  )
}

export function CrearPrestamoCondiciones({
  cuotaEtiqueta, cuota, ganancia, capital, totalARecibir,
  capitalNum, gananciaNum,
  frecuencia, frecuencias = ['Diario', 'Semanal', 'Quincenal', 'Mensual'],
  interes, cuotas, unidadCuotas, notaInteres,
  modos = [], modoActivo,
  primerCobro, enCuantos, ruta,
  onFrecuencia, onModo, onCrear,
}) {
  const total = (capitalNum ?? 0) + (gananciaNum ?? 0)
  const pct = total > 0 ? (capitalNum / total) * 100 : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cf-gap-cards)', padding: '8px var(--cf-pad-screen) 16px' }}>

        <div style={{
          background: '#15161A', borderRadius: 'var(--cf-r-hero)', padding: '17px 21px 19px',
          display: 'flex', flexDirection: 'column', gap: 12, flex: 'none',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: '#2FBE6A', flex: 'none' }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#8A8E98' }}>
              Se recalcula al escribir
            </span>
          </span>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 11.5, color: '#8A8E98' }}>{cuotaEtiqueta}</span>
              <span className="cf-fig" style={{ display: 'block', fontSize: 32, letterSpacing: '-.035em', color: '#F3F3F6', marginTop: 3 }}>
                {cuota}
              </span>
            </span>
            <span style={{ flex: 'none', textAlign: 'right' }}>
              <span style={{ display: 'block', fontSize: 11.5, color: '#8A8E98' }}>Ganancia</span>
              <span className="cf-fig" style={{ display: 'block', fontSize: 18, color: '#F5B824', marginTop: 3 }}>
                {ganancia}
              </span>
            </span>
          </div>

          <span style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', flex: 'none' }}>
            <span style={{ width: `${pct}%`, background: '#4A4E57', flex: 'none' }} />
            <span style={{ flex: 1, background: 'var(--cf-gold)' }} />
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="cf-num" style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: '#8A8E98' }}>
              Capital <strong style={{ color: '#F3F3F6' }}>{capital}</strong>
            </span>
            <span className="cf-num" style={{ flex: 'none', fontSize: 11.5, color: '#8A8E98' }}>
              Total a recibir <strong style={{ color: '#F3F3F6' }}>{totalARecibir}</strong>
            </span>
          </div>
        </div>

        <Fila etiqueta="Cada cuánto cobra">
          <div style={{ display: 'flex', gap: 'var(--cf-gap-chips)', flexWrap: 'wrap' }}>
            {frecuencias.map((f) => (
              <Chip key={f} activo={f === frecuencia} onClick={() => onFrecuencia?.(f)}>{f}</Chip>
            ))}
          </div>
        </Fila>

        <div style={{ display: 'flex', gap: 10, flex: 'none', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <EtiquetaCampo>Interés</EtiquetaCampo>
            <CampoCorto valor={interes} sufijo="%" ayuda={notaInteres} />
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <EtiquetaCampo>Cuántas cuotas</EtiquetaCampo>
            <CampoCorto valor={cuotas} sufijo={unidadCuotas} />
          </div>
        </div>

        <Fila etiqueta="Cómo se cobra el interés">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {modos.map((m) => (
              <OpcionModo key={m.id} {...m} activo={m.id === modoActivo} onElegir={() => onModo?.(m.id)} />
            ))}
          </div>
        </Fila>

        <Tarjeta plana>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '10px 16px', flex: 'none' }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--cf-ink-2)' }}>Primer cobro</span>
            <span style={{ flex: 'none', textAlign: 'right' }}>
              <span className="cf-num" style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--cf-ink)' }}>
                {primerCobro}
              </span>
              <span className="cf-num" style={{ display: 'block', fontSize: 11, color: 'var(--cf-ink-3)', marginTop: 1 }}>
                {enCuantos}
              </span>
            </span>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, padding: '10px 16px',
            borderTop: '1px solid var(--cf-hairline)', flex: 'none',
          }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--cf-ink-2)' }}>Ruta</span>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--cf-ink)', flex: 'none' }}>{ruta}</span>
          </div>
        </Tarjeta>
      </div>

      <BarraAccion>
        <BotonPrimario onClick={onCrear}>Revisar y crear</BotonPrimario>
      </BarraAccion>
    </div>
  )
}
