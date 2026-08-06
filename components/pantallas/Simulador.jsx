'use client'

// components/pantallas/Simulador.jsx — turno 29.
//
// TRES CAMBIOS SOBRE LA PANTALLA ACTUAL, y ninguno es de estilo:
//
//  1. LA RESPUESTA SUBE AL TOPE y se recalcula al escribir. Hoy vive debajo de
//     todo, en un recuadro punteado que dice "escribe el monto para ver la
//     simulación": se configura a ciegas y luego hay que bajar.
//  2. LOS CINCO MODOS SE COLAPSAN a una fila con el recomendado y un "cambiar".
//     La lista completa está bien escrita, pero como hoja que se abre solo si
//     hace falta — así el simulador cabe sin scroll.
//  3. EL RESULTADO ESTÁ REDACTADO PARA DECIRLO EN VOZ ALTA: "le cobras $20.000
//     cada día, 30 veces, hasta el 27 de agosto". No "cuota: 20.000".
//
// ── Y EL CAMBIO QUE NO ES DE FORMA ──
//
// El simulador de hoy es un CALLEJÓN SIN SALIDA: dice "sin registrar nada" como
// si fuera una virtud, y cuando el cliente acepta hay que volver a teclear los
// mismos cuatro datos en crear préstamo.
//
// La acción dorada de aquí es CREAR ESTE PRÉSTAMO, con todo prellenado.
// Probablemente el atajo más usado del sistema, y no existe: nadie simula por
// deporte — simula porque tiene un cliente enfrente.

import { BarraAccion, BotonPrimario, BotonSecundario, Tarjeta, EtiquetaCampo, Chip, Pastilla } from '@/components/cf/primitivos'

function CampoConSufijo({ etiqueta, prefijo, sufijo, valor, onCambio, marcador, enFila = false }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0,
      // En columna, flex:1 hace crecer el campo en ALTO y abre un hueco (error
      // de maquetacion #2 del handoff). Solo se reparte ancho cuando va en fila.
      flex: enFila ? 1 : 'none',
    }}>
      <EtiquetaCampo>{etiqueta}</EtiquetaCampo>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 6, flex: 'none',
        height: 'var(--cf-h-field)', padding: '0 14px', borderRadius: 'var(--cf-r-control)',
        background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
      }}>
        {prefijo && <span className="cf-fig" style={{ fontSize: 16, color: 'var(--cf-ink-3)', flex: 'none' }}>{prefijo}</span>}
        {/* ── CON MANEJADOR ES UN CAMPO DE VERDAD; SIN ÉL, UNA MAQUETA ──
            Iba con `defaultValue` y sin `onChange`: se podía teclear y el padre
            no se enteraba nunca. Por eso esta pantalla no se podía montar sin
            romper la calculadora — enseñaba una cuota que no correspondía a lo
            escrito. Con `onCambio` pasa a ser controlado; sin él se comporta
            igual que antes, que es lo que necesita el banco de pruebas. */}
        <input
          {...(onCambio
            ? { value: valor ?? '', onChange: (e) => onCambio(e.target.value) }
            : { defaultValue: valor })}
          placeholder={marcador}
          // Nunca type="number": rechaza el separador decimal que no coincide
          // con el locale del teléfono.
          type="text" inputMode="decimal"
          style={{
            flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'none',
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontVariantNumeric: 'tabular-nums lining-nums',
            fontSize: 17, fontWeight: 600, color: 'var(--cf-ink)',
          }}
        />
        {sufijo && <span style={{ fontSize: 13, color: 'var(--cf-ink-3)', flex: 'none' }}>{sufijo}</span>}
      </label>
    </div>
  )
}

export default function Simulador({
  cuota, cada, veces, hasta,
  tuPlata, tuPlataNum, ganas, ganasNum,
  monto = '500.000', interes = '20', cobros = '30', unidadCobros = 'días',
  onMonto, onInteres, onCobros,
  montoMarcador = 'Ej: 500.000',
  frecuencia = 'Diario', frecuencias = ['Diario', 'Semanal', 'Quincenal', 'Mensual'],
  modo = 'Cuota fija', recomendado = true,
  onFrecuencia, onCambiarModo, onCrear, onMandar, onTabla,
  sinDatos,
  // El relleno lateral lo pone el armazon. Sin esto eran 40px por lado en la
  // ruta real — lo cazo la prueba del margen doble el mismo dia que lo monte.
  sinMargen = false,
}) {
  const total = (tuPlataNum ?? 0) + (ganasNum ?? 0)
  const pctCapital = total > 0 ? (tuPlataNum / total) * 100 : 0

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: sinMargen ? 'auto' : '100%',
    }}>
      <div style={{
        flex: sinMargen ? 'none' : 1, minHeight: 0,
        overflowY: sinMargen ? 'visible' : 'auto',
        display: 'flex', flexDirection: 'column', gap: 'var(--cf-gap-cards)',
        padding: sinMargen ? '8px 0 16px' : '8px var(--cf-pad-screen) 16px',
      }}>

        {/* ── LA RESPUESTA, ARRIBA ── */}
        <div style={{
          background: '#15161A', borderRadius: 'var(--cf-r-hero)', padding: '17px 21px 19px',
          display: 'flex', flexDirection: 'column', gap: 13, flex: 'none',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: '#2FBE6A', flex: 'none' }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#8A8E98' }}>
              Se recalcula al escribir
            </span>
          </span>

          {/* SIN MONTO NO HAY RESPUESTA QUE DAR.
              Con el bloque en blanco se leía «Le cobras · veces · hasta el»,
              tres palabras sueltas sobre negro. Aquí dice qué falta. */}
          {sinDatos ? (
            <span style={{ fontSize: 15, lineHeight: 1.5, color: '#A3A8B2', padding: '10px 0 4px' }}>
              {sinDatos}
            </span>
          ) : (
          <>
          {/* Redactado para leerlo en voz alta con el cliente delante. */}
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: '#A3A8B2', flex: 'none' }}>Le cobras {cada}</span>
            <span className="cf-fig" style={{ fontSize: 34, letterSpacing: '-.035em', color: '#F3F3F6', flex: 'none' }}>
              {cuota}
            </span>
          </span>
          <span className="cf-num" style={{ fontSize: 13, color: '#A3A8B2', marginTop: -6 }}>
            {veces} veces · hasta el {hasta}
          </span>

          {/* La partición capital/ganancia, la misma del resto del sistema. */}
          <span style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', flex: 'none', marginTop: 2 }}>
            <span style={{ width: `${pctCapital}%`, background: '#4A4E57', flex: 'none' }} />
            <span style={{ flex: 1, background: 'var(--cf-gold)' }} />
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: '#4A4E57', flex: 'none' }} />
              <span style={{ fontSize: 11.5, color: '#8A8E98' }}>Tu plata</span>
              <span className="cf-num" style={{ fontSize: 12.5, fontWeight: 700, color: '#F3F3F6' }}>{tuPlata}</span>
            </span>
            <span style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--cf-gold)', flex: 'none' }} />
              <span style={{ fontSize: 11.5, color: '#8A8E98' }}>Ganas</span>
              <span className="cf-num" style={{ fontSize: 12.5, fontWeight: 700, color: '#F3F3F6' }}>{ganas}</span>
            </span>
          </div>
          </>
          )}
        </div>

        {/* ── Los datos ── */}
        <CampoConSufijo etiqueta="Cuánto le vas a prestar" prefijo="$" valor={monto}
          onCambio={onMonto} marcador={montoMarcador} />

        <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
          <CampoConSufijo enFila etiqueta="Interés" sufijo="%" valor={interes} onCambio={onInteres} />
          <CampoConSufijo enFila etiqueta="Cuántos cobros" sufijo={unidadCobros} valor={cobros} onCambio={onCobros} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 'none' }}>
          <EtiquetaCampo>Cada cuánto le cobras</EtiquetaCampo>
          <div style={{ display: 'flex', gap: 'var(--cf-gap-chips)', flexWrap: 'wrap' }}>
            {frecuencias.map((f) => (
              <Chip key={f} activo={f === frecuencia} onClick={() => onFrecuencia?.(f)}>{f}</Chip>
            ))}
          </div>
        </div>

        {/* Los cinco modos colapsados a una fila. La lista completa está bien
            escrita, pero abrirla siempre gasta la pantalla en la decisión que
            menos gente cambia. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 'none' }}>
          <EtiquetaCampo>Modo de interés</EtiquetaCampo>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flex: 'none',
            minHeight: 52, padding: '0 14px', borderRadius: 'var(--cf-r-control)',
            background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          }}>
            <span style={{
              flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{modo}</span>
            {recomendado && (
              <Pastilla tono="aldia" style={{ height: 20, fontSize: 11, flex: 'none' }}>recomendado</Pastilla>
            )}
            <button type="button" onClick={onCambiarModo} style={{
              background: 'none', border: 0, cursor: 'pointer', flex: 'none',
              fontSize: 12.5, fontWeight: 700, color: 'var(--cf-gold-dark)',
            }}>Cambiar</button>
          </div>
        </div>

        <Tarjeta style={{ background: 'var(--cf-card-alt)' }}>
          <span style={{ fontSize: 12.5, color: 'var(--cf-ink-2)', lineHeight: 1.45 }}>
            Esto no registra nada. Es para decirle la cuota al cliente antes de comprometerte.
          </span>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <Chip onClick={onMandar}>Mandársela por WhatsApp</Chip>
            <Chip onClick={onTabla}>Ver la tabla</Chip>
          </div>
        </Tarjeta>
      </div>

      {/* El atajo que no existía. Nadie simula por deporte: simula porque tiene
          un cliente enfrente, y hoy al aceptar hay que teclear otra vez los
          mismos cuatro datos. */}
      <BarraAccion>
        <BotonPrimario onClick={onCrear}>Crear este préstamo</BotonPrimario>
      </BarraAccion>
    </div>
  )
}
