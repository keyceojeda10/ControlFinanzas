'use client'

// components/pantallas/AtajosCobro.jsx — T15-02 «Atajos de cobro».
//
// LA LÁMINA SE LLAMA «NUNCA DISEÑADA», Y SU PIE DICE POR QUÉ:
//
//   «La entrada existe en la ficha desde siempre y la pantalla nunca se hizo.
//    Es el gesto que más se repite: cobrar la cuota del día sin entrar al
//    préstamo. Con dos préstamos activos hay que elegir cuál, y ahí está el
//    valor — hoy el cobrador tiene que salir, abrir el otro préstamo y volver.
//    El botón cierra el bucle: cobrar y pasar al siguiente, sin volver a la
//    lista.»
//
// LO QUE CAMBIA RESPECTO AL MODAL DE «COBRO RÁPIDO» QUE SUSTITUYE:
//
//  · ERAN DOS PASOS. Con varios préstamos, primero se elegía uno de una lista y
//    solo entonces aparecía el formulario. Aquí están TODOS a la vez, cada uno
//    con su cuota y sus tres acciones: la elección Y el cobro son el mismo
//    gesto. Es literalmente el bucle que el pie describe.
//  · TRES SALIDAS POR PRÉSTAMO, no una. «Cuota» cobra la del día tal cual —el
//    caso de nueve de cada diez visitas— y no obliga a teclear una cifra que ya
//    se sabe. «Otro monto» es para el abono parcial. Y «No pagó» EXISTE: antes
//    la única forma de cerrar la visita sin cobrar era cerrar el modal, y eso
//    no deja rastro de que se pasó por ahí.
//  · EL MÉTODO DE PAGO SE ELIGE ANTES, arriba, y vale para las tres. Estaba
//    debajo del formulario, así que se rellenaba el monto y luego había que
//    bajar a decir con qué pagó.
//
// NO SE TOCA LO QUE MUEVE PLATA: el cobro sigue pasando por
// `ejecutarPagoRapido`, con su cola offline, su deshacer de 10 segundos y su
// detección de duplicados. Este archivo solo decide QUÉ se pulsa.

import { useState } from 'react'
import { EtiquetaClavo } from '@/components/cf/primitivos'
import { formatMoney } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'
import { montoCrudo, montoCrudoConModo, montoParaMostrarConModo } from '@/lib/adaptadores/pago'

const MOTIVOS = [
  { id: 'no_tenia_dinero',  nombre: 'No tenía' },
  { id: 'no_estaba',        nombre: 'No estaba' },
  { id: 'negocio_cerrado',  nombre: 'Cerrado' },
  { id: 'pidio_plazo',      nombre: 'Pidió plazo' },
]

/** «Préstamo 1 · diario» y, debajo, en qué situación está. */
function Cabecera({ indice, frecuencia, diasMora, saldo, pais, esClavo }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={{
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', rowGap: 4, minWidth: 0,
        fontSize: 13, fontWeight: 700, color: 'var(--cf-ink)',
      }}>
        Préstamo {indice}{frecuencia ? ` · ${frecuencia}` : ''}
        {/* ⚠ CUÁL de ellos está dado por perdido, EN LA HOJA DE COBRO.
            Reportado por el dueño: «ni al darle al botón de cobrar dice cuál de
            los dos préstamos está como perdido». Es donde peor se nota — es la
            pantalla en la que se decide sobre cuál entra la plata. */}
        {esClavo && <EtiquetaClavo />}
      </span>
      <span className="cf-num" style={{ fontSize: 11.5, color: diasMora > 0 ? 'var(--cf-red-dark)' : 'var(--cf-ink-3)' }}>
        {diasMora > 0 ? `${diasMora}d de atraso · ` : ''}debe {formatMoney(saldo ?? 0, pais)}
      </span>
    </div>
  )
}

function Boton({ children, tono = 'neutro', onClick, disabled }) {
  const fondo = tono === 'principal' ? 'var(--cf-green-dark)'
    : tono === 'aviso' ? 'var(--cf-card)' : 'var(--cf-card)'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, minWidth: 0, height: 42, cursor: disabled ? 'default' : 'pointer',
        borderRadius: 'var(--cf-r-control)',
        background: fondo,
        border: tono === 'principal' ? 0 : '1px solid var(--cf-border-strong)',
        color: tono === 'principal' ? '#F3F3F6'
          : tono === 'aviso' ? 'var(--cf-red-dark)' : 'var(--cf-ink-2)',
        fontSize: 13.5, fontWeight: 700, opacity: disabled ? 0.45 : 1,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}
    >
      {children}
    </button>
  )
}

export default function AtajosCobro({
  nombre,
  iniciales,
  prestamos = [],           // [{ id, cuota, saldoPendiente, diasMora, frecuencia, pagadoHoy }]
  pais,
  // El selector de método real de la app: se le pasa entero para no reimplementar
  // la lista de cuentas de la organización, que es de dónde sale la caja.
  selectorMetodo,
  onCobrarCuota,            // (prestamo) → cobra la cuota exacta
  onOtroMonto,              // (prestamo) → abre el teclado para un abono
  onNoPago,                 // (prestamo, motivo) → deja constancia de la visita
  ocupado = false,
}) {
  // Qué préstamo tiene abierto el «No pagó». Solo uno a la vez: dos filas de
  // motivos abiertas convierten la hoja en un formulario.
  const [motivoAbierto, setMotivoAbierto] = useState(null)
  // Y cuál tiene abierto el teclado de «Otro monto», con lo tecleado.
  const [montoAbierto, setMontoAbierto] = useState(null)
  const [monto, setMonto] = useState('')

  // ── EL MODO ABREVIADO, TAMBIÉN AQUÍ ──
  // Con él encendido se escribe en MILES: «40» son $40.000. `MoneyInput` —el
  // campo viejo— lo hace desde siempre, pero el rediseño puso un `<input>`
  // propio en cada hoja nueva y la conversión se perdió EN SILENCIO: el
  // interruptor seguía encendido en Configuración sin hacer nada.
  //
  // Se lee de la sesión y no de una prop a propósito: si dependiera de que
  // quien monta la hoja se acuerde de pasarla, volvería a perderse en la
  // siguiente pantalla.
  const { modoAbreviado } = useAuth()
  // Lo que se TECLEA, en crudo, para no reformatear mientras se escribe.
  const montoReal = Number(montoCrudoConModo(monto, modoAbreviado)) || 0

  const activos = prestamos.filter((p) => Number(p.cuota) > 0 || Number(p.saldoPendiente) > 0)
  const debeTotal = activos.reduce((n, p) => n + Number(p.saldoPendiente ?? 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── QUIÉN, Y CUÁNTO DEBE EN TOTAL ──
          Con dos préstamos, la suma es la cifra que el cobrador negocia en la
          puerta; los desgloses vienen debajo. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {iniciales && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 42, minWidth: 42, height: 42, borderRadius: 999, flex: 'none',
            background: 'var(--cf-fill)', fontSize: 15, fontWeight: 700, color: 'var(--cf-ink-2)',
          }}>{iniciales}</span>
        )}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{
            fontSize: 16, fontWeight: 700, letterSpacing: '-.015em', color: 'var(--cf-ink)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{nombre}</span>
          <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>
            {activos.length} {activos.length === 1 ? 'préstamo' : 'préstamos'} · debe {formatMoney(debeTotal, pais)}
          </span>
        </div>
      </div>

      {/* ── CON QUÉ TE PAGÓ, ARRIBA ──
          Vale para todos los préstamos de abajo. Estaba al final del
          formulario: se tecleaba el monto y luego había que bajar a decir el
          método, con el teclado del móvil tapando media pantalla. */}
      {selectorMetodo && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
            textTransform: 'uppercase', color: 'var(--cf-ink-3)',
          }}>Con qué te pagó</span>
          {selectorMetodo}
        </div>
      )}

      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
        textTransform: 'uppercase', color: 'var(--cf-ink-3)',
      }}>Cobrar sin abrir el préstamo</span>

      {activos.map((p, i) => {
        const cuota = Number(p.cuota ?? 0)
        const abierto = motivoAbierto === p.id
        return (
          <div
            key={p.id}
            style={{
              display: 'flex', flexDirection: 'column', gap: 11, flex: 'none',
              padding: '13px 14px',
              borderRadius: 'var(--cf-r-card)',
              background: 'var(--cf-card)',
              border: '1px solid var(--cf-border)',
              // El ya cobrado hoy se atenúa pero NO se quita: el cobrador tiene
              // que poder ver que ese préstamo ya está hecho, y con dos activos
              // esconderlo dejaría la hoja pareciendo que solo hay uno.
              opacity: p.pagadoHoy ? 0.55 : 1,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Cabecera
                  indice={i + 1}
                  esClavo={p.esClavo}
                  frecuencia={p.frecuencia}
                  diasMora={Number(p.diasMora ?? 0)}
                  saldo={p.saldoPendiente}
                  pais={pais}
                />
              </div>
              <span className="cf-fig" style={{
                fontSize: 20, letterSpacing: '-.025em', lineHeight: 1,
                color: 'var(--cf-ink)', flex: 'none',
              }}>{formatMoney(cuota, pais)}</span>
            </div>

            {abierto ? (
              // ── POR QUÉ NO PAGÓ ──
              // No es un campo libre: cuatro motivos que ya usa el sistema
              // (`VisitaReagendada`). Escribirlo a mano en la calle no se hace,
              // y sin motivo la visita no sirve para nada después.
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {MOTIVOS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setMotivoAbierto(null); onNoPago?.(p, m.id) }}
                    style={{
                      height: 36, padding: '0 13px', cursor: 'pointer',
                      borderRadius: 999, background: 'var(--cf-fill)',
                      border: '1px solid var(--cf-border-strong)',
                      fontSize: 13, fontWeight: 600, color: 'var(--cf-ink-2)',
                    }}
                  >{m.nombre}</button>
                ))}
                <button
                  type="button"
                  onClick={() => setMotivoAbierto(null)}
                  style={{
                    height: 36, padding: '0 13px', cursor: 'pointer',
                    borderRadius: 999, background: 'none', border: 0,
                    fontSize: 13, fontWeight: 700, color: 'var(--cf-ink-3)',
                  }}
                >Atrás</button>
              </div>
            ) : montoAbierto === p.id ? (
              // ── OTRO MONTO, AQUÍ MISMO ──
              // Mandarlo a abrir el préstamo perdería justo lo que la lámina
              // busca: «cobrar la cuota del día SIN ENTRAR al préstamo».
              //
              // `type="text"` con `inputMode="decimal"`, no `type="number"`:
              // este último rechaza el separador decimal que no coincide con el
              // idioma del teléfono, y en un móvil configurado en inglés el
              // cobrador no puede escribir la coma.
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <input
                  autoFocus
                  type="text"
                  inputMode="decimal"
                  value={monto}
                  onChange={(e) => setMonto(montoCrudo(e.target.value))}
                  // Con el modo abreviado la pista tiene que estar EN MILES,
                  // o dice «Cuota: $16.000» sobre un campo donde se teclea 16.
                  placeholder={modoAbreviado
                    ? `Cuota: ${montoParaMostrarConModo(String(Math.round(cuota)), true, pais)} (en miles)`
                    : `Cuota: ${formatMoney(cuota, pais)}`}
                  style={{
                    height: 46, padding: '0 14px', width: '100%',
                    borderRadius: 'var(--cf-r-control)',
                    background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
                    fontSize: 17, fontWeight: 700, color: 'var(--cf-ink)',
                    fontVariantNumeric: 'tabular-nums lining-nums',
                  }}
                />
                {/* En abreviado, «40» se cobra como $40.000 sin que se vea. Eso
                    es plata: la cifra de verdad tiene que estar delante ANTES
                    de pulsar «Cobrar», no descubrirse en el recibo. */}
                {modoAbreviado && montoReal > 0 && (
                  <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--cf-ink-2)' }}>
                    Se cobra <strong style={{ color: 'var(--cf-ink)' }}>{formatMoney(montoReal, pais)}</strong>
                  </p>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <Boton
                    tono="principal"
                    disabled={ocupado || !(montoReal > 0)}
                    onClick={() => {
                      // `montoReal` ya viene multiplicado si el modo abreviado
                      // está encendido. Lo que se cobra son SIEMPRE pesos.
                      const n = montoReal
                      setMontoAbierto(null); setMonto('')
                      if (n > 0) onOtroMonto?.(p, n)
                    }}
                  >Cobrar</Boton>
                  <Boton onClick={() => { setMontoAbierto(null); setMonto('') }}>Atrás</Boton>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                {/* ── EL YA COBRADO NO SE VUELVE A COBRAR DE UN TOQUE ──
                    Estaba solo atenuado, y «Cuota» seguia pulsable: se cobra
                    dos veces el mismo prestamo sin que nada avise. Lo comprobe
                    sin querer —recaudado $32.000 sobre una cuota de $16.000— y
                    en la calle eso es plata de mas cobrada a un cliente.

                    No se OCULTA: el cobrador tiene que ver que ese prestamo ya
                    esta hecho. Y «Otro monto» se queda vivo, porque un segundo
                    abono el mismo dia es legitimo — lo que no puede pasar es de
                    un toque y sin decidirlo. */}
                <Boton
                  tono="principal"
                  disabled={ocupado || !(cuota > 0) || p.pagadoHoy}
                  onClick={() => onCobrarCuota?.(p)}
                >
                  {p.pagadoHoy ? 'Ya cobrado' : 'Cuota'}
                </Boton>
                <Boton disabled={ocupado} onClick={() => { setMonto(''); setMontoAbierto(p.id) }}>Otro monto</Boton>
                <Boton tono="aviso" disabled={ocupado} onClick={() => setMotivoAbierto(p.id)}>No pagó</Boton>
              </div>
            )}
          </div>
        )
      })}

      {activos.length === 0 && (
        <span style={{ fontSize: 13.5, color: 'var(--cf-ink-3)' }}>
          Este cliente no tiene préstamos activos que cobrar.
        </span>
      )}
    </div>
  )
}
