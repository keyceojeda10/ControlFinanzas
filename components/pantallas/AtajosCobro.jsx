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

// ── REHECHA EL 20 SEP 2026 ───────────────────────────────────────────────────
// El dueño: «el modal de cobro dentro de las rutas es el único que no me está
// gustando… no se ve ordenado, no se ven los datos claros… el botoncito que dice
// atrás da hasta pena… cuando uno coloca otro monto, si quiere saldar el saldo
// completo tocaría colocarlo a mano, ya el sistema diciendo cuánto es».
//
//  · ABRE LISTA PARA DESLIZAR. Eran dos toques —«Cuota» y luego el deslizador—
//    para el caso de nueve de cada diez visitas. Ahora la cuota viene puesta y
//    la pista está a la vista: abrir y deslizar.
//  · EL MONTO SE ELIGE CON PASTILLAS QUE EL SISTEMA YA SABE: la cuota, lo que le
//    falta para ponerse al día y todo lo que debe. «Otro monto» es la cuarta, y
//    solo ella abre el teclado.
//  · LA CIFRA QUE SE VA A COBRAR ES LO QUE MÁS SE VE, en bloque carbón y en
//    dorado, con lo que significa al lado («la cuota de hoy», «salda el
//    préstamo»). Debajo, lo que debe y lo que lleva pagado, que son datos del
//    servidor: aquí no se resta nada para adivinar en cuánto queda.
//  · «ATRÁS» DESAPARECE. Medía 20px de alto: `flex: 1` dentro de una columna lo
//    aplastaba. Ya no hay subpantallas de las que volver, salvo «No pagó».
//  · «NO PAGÓ» SE QUEDA, pero deja de competir con cobrar: es la única forma de
//    dejar constancia de una visita sin plata, y va de enlace bajo la pista.
//  · El ya cobrado hoy sigue sin poder cobrarse de un gesto: no trae monto
//    puesto y hay que elegirlo.

import { useEffect, useState } from 'react'
import { EtiquetaClavo } from '@/components/cf/primitivos'
import DeslizarParaConfirmar from '@/components/cf/DeslizarParaConfirmar'
import { BLOQUE, BORDE_BLOQUE } from '@/components/cf/bloqueOscuro'
import { useTactil } from '@/lib/tactil'
import { formatMoney } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'
import { montoCrudo, montoCrudoConModo, montoParaMostrarConModo } from '@/lib/adaptadores/pago'
import { opcionesDeMonto } from '@/lib/adaptadores/atajos-cobro'

const MOTIVOS = [
  { id: 'no_tenia_dinero',  nombre: 'No tenía' },
  { id: 'no_estaba',        nombre: 'No estaba' },
  { id: 'negocio_cerrado',  nombre: 'Cerrado' },
  { id: 'pidio_plazo',      nombre: 'Pidió plazo' },
]

const ROTULO = {
  fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
  textTransform: 'uppercase', color: 'var(--cf-ink-3)',
}

function Pastilla({ activa, children, onClick, disabled }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} aria-pressed={activa}
      style={{
        height: 40, padding: '0 12px', flex: 'none', cursor: disabled ? 'default' : 'pointer',
        borderRadius: 999, font: 'inherit', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
        display: 'inline-flex', alignItems: 'center', gap: 7,
        background: activa ? 'var(--cf-ink)' : 'var(--cf-card)',
        color: activa ? 'var(--cf-card)' : 'var(--cf-ink-2)',
        border: `1px solid ${activa ? 'var(--cf-ink)' : 'var(--cf-border-strong)'}`,
        opacity: disabled ? 0.45 : 1,
      }}
    >{children}</button>
  )
}

export default function AtajosCobro({
  nombre,
  iniciales,
  // [{ id, cuota, saldoPendiente, diasMora, frecuencia, pagadoHoy, esClavo,
  //    alDia, totalAPagar, totalPagado, montoPagadoHoy }] — los cuatro últimos
  //    son opcionales: quien no los tenga se queda sin esa línea, no con un cero.
  prestamos = [],
  pais,
  // El selector de método real de la app: se le pasa entero para no reimplementar
  // la lista de cuentas de la organización, que es de dónde sale la caja.
  selectorMetodo,
  onCobrarCuota,            // (prestamo) → cobra la cuota exacta
  onOtroMonto,              // (prestamo, monto) → cualquier otra cifra, como abono
  onNoPago,                 // (prestamo, motivo) → deja constancia de la visita
  ocupado = false,
}) {
  const tactil = useTactil()
  // ── EL MODO ABREVIADO, TAMBIÉN AQUÍ ──
  // Con él encendido se escribe en MILES: «40» son $40.000. Se lee de la sesión
  // y no de una prop a propósito: si dependiera de que quien monta la hoja se
  // acuerde de pasarla, volvería a perderse en la siguiente pantalla.
  const { modoAbreviado } = useAuth()

  const activos = prestamos.filter((p) => Number(p.cuota) > 0 || Number(p.saldoPendiente) > 0)
  const debeTotal = activos.reduce((n, p) => n + Number(p.saldoPendiente ?? 0), 0)

  // Sobre cuál se cobra. Por defecto, el primero que hoy no se ha cobrado.
  const porDefecto = (activos.find((p) => !p.pagadoHoy) ?? activos[0])?.id ?? null
  const [elegidoId, setElegidoId] = useState(porDefecto)
  const p = activos.find((x) => x.id === elegidoId) ?? activos.find((x) => x.id === porDefecto) ?? null

  const opciones = p ? opcionesDeMonto(p) : []
  // Qué pastilla está puesta: 'cuota' | 'alDia' | 'todo' | 'otro' | null.
  const [opcion, setOpcion] = useState(null)
  const [monto, setMonto] = useState('')
  const [motivos, setMotivos] = useState(false)

  // Al cambiar de préstamo se vuelve a su primera pastilla (la cuota, salvo que
  // ya se haya cobrado hoy: ése no trae monto puesto y hay que elegirlo).
  const primera = opciones[0]?.id === 'cuota' ? 'cuota' : null
  useEffect(() => { setOpcion(primera); setMonto(''); setMotivos(false) }, [p?.id, primera])

  const saldo = Math.round(Number(p?.saldoPendiente ?? 0))
  const tecleado = Number(montoCrudoConModo(monto, modoAbreviado)) || 0
  const elegida = opciones.find((o) => o.id === opcion) ?? null
  const cuanto = opcion === 'otro' ? tecleado : (elegida?.monto ?? 0)
  const pasaDelSaldo = saldo > 0 && cuanto > saldo
  const significa = opcion === 'otro'
    ? (cuanto > 0 && cuanto === saldo ? 'salda el préstamo' : cuanto > 0 ? 'un abono' : null)
    : elegida?.significa ?? null
  const listo = cuanto > 0 && !pasaDelSaldo && !ocupado

  const cobrar = () => {
    if (!p || !listo) return
    // La cuota exacta va por su camino (se registra como cuota COMPLETA); todo
    // lo demás es un abono por la cifra que sea.
    if (opcion === 'cuota' && cuanto === Math.round(Number(p.cuota))) onCobrarCuota?.(p)
    else onOtroMonto?.(p, cuanto)
  }

  if (activos.length === 0) {
    return <span style={{ fontSize: 13.5, color: 'var(--cf-ink-3)' }}>Este cliente no tiene préstamos activos que cobrar.</span>
  }

  const pagado = Number(p?.totalPagado ?? 0), total = Number(p?.totalAPagar ?? 0)
  const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((pagado / total) * 100))) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── QUIÉN ──
          El nombre entero: es la comprobación de que se le está cobrando a quien
          se cree. Ver la nota larga en `ParadaDeCobro`. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {iniciales && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 44, minWidth: 44, height: 44, borderRadius: 999, flex: 'none',
            background: 'var(--cf-fill)', fontSize: 15, fontWeight: 700, color: 'var(--cf-ink-2)',
          }}>{iniciales}</span>
        )}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{
            fontSize: 17, fontWeight: 700, letterSpacing: '-.015em', lineHeight: 1.2, color: 'var(--cf-ink)',
            minWidth: 0, overflowWrap: 'anywhere',
          }}>{nombre}</span>
          <span className="cf-num" style={{ fontSize: 12.5, color: 'var(--cf-ink-3)' }}>
            {activos.length === 1
              ? `Préstamo ${String(p?.frecuencia ?? '').toLowerCase()}`.trim()
              : `${activos.length} préstamos · debe ${formatMoney(debeTotal, pais)} entre todos`}
          </span>
        </div>
      </div>

      {/* ── SOBRE CUÁL, SI HAY VARIOS ──
          Todos a la vista, como pedía la lámina, pero UNO elegido: dos pistas de
          deslizar abiertas a la vez convierten la hoja en un formulario. */}
      {activos.length > 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={ROTULO}>A cuál préstamo</span>
          {activos.map((x, i) => {
            const suyo = x.id === p?.id
            return (
              <button
                key={x.id} type="button" onClick={() => setElegidoId(x.id)} aria-pressed={suyo}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer',
                  padding: '11px 14px', borderRadius: 'var(--cf-r-control)', font: 'inherit',
                  background: 'var(--cf-card)',
                  border: `1.5px solid ${suyo ? 'var(--cf-ink)' : 'var(--cf-border)'}`,
                }}
              >
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 13.5, fontWeight: 700, color: 'var(--cf-ink)' }}>
                    Préstamo {i + 1}{x.frecuencia ? ` · ${x.frecuencia}` : ''}
                    {x.esClavo && <EtiquetaClavo />}
                  </span>
                  <span className="cf-num" style={{ fontSize: 12, color: Number(x.diasMora) > 0 ? 'var(--cf-red-dark)' : 'var(--cf-ink-3)' }}>
                    {x.pagadoHoy ? 'ya cobrado hoy · ' : Number(x.diasMora) > 0 ? `${x.diasMora}d de atraso · ` : ''}debe {formatMoney(x.saldoPendiente ?? 0, pais)}
                  </span>
                </span>
                <span className="cf-fig" style={{ fontSize: 16, letterSpacing: '-.02em', color: 'var(--cf-ink)', flex: 'none' }}>
                  {formatMoney(x.cuota ?? 0, pais)}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── LO QUE SE VA A COBRAR ──
          La única cifra dorada de la hoja, y cambia con la pastilla. */}
      <div style={{
        background: BLOQUE.fondo, border: BORDE_BLOQUE, borderRadius: 'var(--cf-r-hero)',
        padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, flex: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: BLOQUE.rotulo }}>
            Vas a cobrar
          </span>
          {activos.length === 1 && p?.esClavo && <EtiquetaClavo />}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span className="cf-fig" style={{
            fontSize: 34, letterSpacing: '-.035em', lineHeight: 1, whiteSpace: 'nowrap',
            color: cuanto > 0 && !pasaDelSaldo ? BLOQUE.oro : BLOQUE.apagado,
          }}>{formatMoney(cuanto, pais)}</span>
          {significa && !pasaDelSaldo && (
            <span style={{
              height: 24, padding: '0 10px', borderRadius: 999, display: 'inline-flex', alignItems: 'center',
              fontSize: 12, fontWeight: 700, color: BLOQUE.tinta, background: 'rgba(255,255,255,.10)', marginBottom: 3,
            }}>{significa}</span>
          )}
        </div>

        {/* Lo que debe y lo que lleva: datos del servidor, tal cual. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 12, borderTop: `1px solid ${BLOQUE.linea}` }}>
          <div className="cf-num" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
            <span style={{ color: BLOQUE.rotulo }}>Debe en total</span>
            <span style={{ color: BLOQUE.tinta, fontWeight: 700 }}>{formatMoney(saldo, pais)}</span>
          </div>
          {Number(p?.diasMora) > 0 && (
            <div className="cf-num" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
              <span style={{ color: BLOQUE.rotulo }}>Atraso</span>
              <span style={{ color: BLOQUE.rojo, fontWeight: 700 }}>
                {p.diasMora} {Number(p.diasMora) === 1 ? 'día' : 'días'}{Number(p?.alDia) > 0 ? ` · ${formatMoney(p.alDia, pais)}` : ''}
              </span>
            </div>
          )}
          {p?.pagadoHoy && (
            <div className="cf-num" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
              <span style={{ color: BLOQUE.rotulo }}>Ya le cobraste hoy</span>
              <span style={{ color: BLOQUE.tinta, fontWeight: 700 }}>{Number(p?.montoPagadoHoy) > 0 ? formatMoney(p.montoPagadoHoy, pais) : 'sí'}</span>
            </div>
          )}
          {pct != null && (
            <>
              <span style={{ height: 4, borderRadius: 999, background: BLOQUE.pista, overflow: 'hidden', display: 'block', marginTop: 3 }}>
                <span style={{ display: 'block', height: 4, borderRadius: 999, width: `${pct}%`, background: BLOQUE.barra }} />
              </span>
              <span className="cf-num" style={{ fontSize: 11.5, color: BLOQUE.apagado }}>
                lleva pagado {formatMoney(pagado, pais)} de {formatMoney(total, pais)} · {pct}%
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── CUÁNTO ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <span style={ROTULO}>Cuánto te paga</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {opciones.map((o) => (
            <Pastilla key={o.id} activa={opcion === o.id} disabled={ocupado} onClick={() => { setOpcion(o.id); setMotivos(false) }}>
              {o.nombre}
              <span className="cf-num" style={{ opacity: 0.7, fontWeight: 600 }}>{formatMoney(o.monto, pais)}</span>
            </Pastilla>
          ))}
          <Pastilla activa={opcion === 'otro'} disabled={ocupado} onClick={() => { setOpcion('otro'); setMotivos(false) }}>Otro monto</Pastilla>
        </div>

        {opcion === 'otro' && (
          <>
            {/* `type="text"` con `inputMode="decimal"`, no `type="number"`: este
                último rechaza el separador decimal que no coincide con el idioma
                del teléfono, y en un móvil en inglés no se puede escribir la coma. */}
            <input
              autoFocus
              type="text"
              inputMode="decimal"
              value={monto}
              onChange={(e) => setMonto(montoCrudo(e.target.value))}
              aria-label="Monto que te paga"
              placeholder={modoAbreviado
                ? `Cuota: ${montoParaMostrarConModo(String(Math.round(Number(p?.cuota ?? 0))), true, pais)} (en miles)`
                : `Cuota: ${formatMoney(p?.cuota ?? 0, pais)}`}
              style={{
                height: 50, padding: '0 16px', width: '100%',
                borderRadius: 'var(--cf-r-control)',
                background: 'var(--cf-card)', border: '1.5px solid var(--cf-gold)',
                fontSize: 17, fontWeight: 700, color: 'var(--cf-ink)',
                fontVariantNumeric: 'tabular-nums lining-nums',
              }}
            />
            {pasaDelSaldo && (
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--cf-red-dark)' }}>
                Es más de lo que debe ({formatMoney(saldo, pais)}).
              </p>
            )}
          </>
        )}
      </div>

      {/* ── CON QUÉ ── */}
      {selectorMetodo && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <span style={ROTULO}>Con qué te pagó</span>
          {selectorMetodo}
        </div>
      )}

      {/* ── COBRAR ──
          La pista a la vista desde que abre: un deslizamiento hasta el final no
          ocurre con el teléfono en el bolsillo. Con ratón, un botón. */}
      {motivos ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={ROTULO}>Por qué no pagó</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {MOTIVOS.map((m) => (
              <Pastilla key={m.id} disabled={ocupado} onClick={() => { setMotivos(false); onNoPago?.(p, m.id) }}>{m.nombre}</Pastilla>
            ))}
          </div>
          <button type="button" onClick={() => setMotivos(false)} style={{
            height: 46, borderRadius: 'var(--cf-r-control)', cursor: 'pointer', font: 'inherit',
            background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
            fontSize: 14, fontWeight: 700, color: 'var(--cf-ink-2)',
          }}>Volver a cobrar</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tactil ? (
            <DeslizarParaConfirmar
              texto={listo || ocupado ? `Cobrar ${formatMoney(cuanto, pais)}` : opcion === 'otro' ? 'Escribe el monto' : 'Elige cuánto te paga'}
              cifra={listo ? formatMoney(cuanto, pais) : null}
              confirmando={ocupado}
              deshabilitado={!listo}
              onConfirmar={cobrar}
            />
          ) : (
            <button type="button" disabled={!listo} onClick={cobrar} style={{
              height: 52, borderRadius: 999, border: 0, cursor: listo ? 'pointer' : 'default', font: 'inherit',
              background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', fontSize: 15.5, fontWeight: 700,
              opacity: listo ? 1 : 0.45,
            }}>{listo ? `Cobrar ${formatMoney(cuanto, pais)}` : opcion === 'otro' ? 'Escribe el monto' : 'Elige cuánto te paga'}</button>
          )}
          <button type="button" disabled={ocupado} onClick={() => setMotivos(true)} style={{
            height: 44, background: 'none', border: 0, cursor: 'pointer', font: 'inherit',
            fontSize: 13.5, fontWeight: 700, color: 'var(--cf-red-dark)',
          }}>No pagó hoy</button>
        </div>
      )}
    </div>
  )
}
