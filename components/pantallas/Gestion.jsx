'use client'

// components/pantallas/Gestion.jsx — turnos 13 y 19.
//
// Los modales que cambian la plata. Todos siguen el MISMO patrón:
//
//     qué cambia arriba · el control en medio · antes → después abajo
//
// Y todos terminan en un botón que dice la acción CON SU CIFRA. "Aplicar" no
// es una decisión; "Aplicar $15.000" sí.
//
// Cada uno tiene además una consecuencia que hoy NO SE VE antes de confirmar, y
// esa es la razón de que exista la pantalla. Están marcadas una por una abajo.
//
// ── LA REGLA DEL COLOR EN "ANTES → DESPUÉS" ──
//
// El color del "después" dice QUÉ LE PASA A TU PLATA. No a la del cliente, y no
// si la decisión es buena idea.
//
//   perdidos    → rojo.    Tu cartera baja de verdad.
//   descuento   → NEUTRO.  Que el cliente deba menos no es una mejora para ti:
//                          acabas de regalar $48.000. Pintarlo verde es decir
//                          "esto está bien" justo cuando tu plata bajó.
//   recargo     → NEUTRO.  Tu plata sube, así que rojo tampoco. Y si la jugada
//                          es mala idea, eso se DICE con una frase, que es algo
//                          que un color no sabe hacer.
//   plazo       → NEUTRO.  No cambia lo que recibes. La línea verde es
//                          "lo que vas a recibir: igual", que sí es el hecho.
//
// El verde y el rojo quedan para las líneas de consecuencia, donde el
// significado es inequívoco.

import { AntesDespues, Aviso, BotonPrimario, BotonSecundario, BotonDestructivo, Campo, EtiquetaCampo, AyudaCampo, Chip } from '@/components/cf/primitivos'

/* Grupo de opciones excluyentes. Los chips van en fila; si no caben, envuelven
   — nunca se recortan, porque una opción a medias no se puede elegir. */
function Opciones({ opciones = [], activo, onElegir }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--cf-gap-chips)', flexWrap: 'wrap', flex: 'none' }}>
      {opciones.map((o) => (
        <Chip key={o.id ?? o} activo={(o.id ?? o) === activo} onClick={() => onElegir?.(o.id ?? o)}>
          {o.nombre ?? o}
        </Chip>
      ))}
    </div>
  )
}

/* Dos opciones grandes, cada una con su consecuencia escrita debajo. Se usa
   cuando la elección NO es de forma sino de plata: ahí un chip pelado esconde
   justo lo que hay que comparar. */
function Bifurcacion({ opciones = [], activo, onElegir }) {
  return (
    <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
      {opciones.map((o) => {
        const sel = o.id === activo
        return (
          <button key={o.id} type="button" onClick={() => onElegir?.(o.id)} style={{
            flex: 1, minWidth: 0, cursor: 'pointer', textAlign: 'left',
            display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 13px 13px',
            background: sel ? 'var(--cf-gold-tint)' : 'var(--cf-card)',
            border: `1px solid ${sel ? 'var(--cf-gold-border)' : 'var(--cf-border)'}`,
            borderRadius: 'var(--cf-r-card-sm)',
          }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--cf-ink)', lineHeight: 1.25 }}>
              {o.nombre}
            </span>
            <span style={{
              fontSize: 11.5, lineHeight: 1.35,
              color: o.tono === 'contra' ? 'var(--cf-red-dark)' : 'var(--cf-ink-3)',
              fontWeight: o.tono === 'contra' ? 600 : 400,
            }}>{o.nota}</span>
            {o.valor && (
              <span className="cf-fig" style={{ fontSize: 15, color: 'var(--cf-ink)', marginTop: 2 }}>
                {o.valor}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* Contador con ±. Sustituye a "días extra" + selector de fecha, que se
   contradecían entre sí. */
function Contador({ valor, unidad, antes, onMenos, onMas }) {
  const boton = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 44, minWidth: 44, height: 44, borderRadius: 999, flex: 'none',
    background: 'var(--cf-fill)', border: '1px solid var(--cf-border)',
    cursor: 'pointer', color: 'var(--cf-ink)',
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 'none' }}>
      <button type="button" aria-label="Menos" onClick={onMenos} style={boton}>
        <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 12h12" /></svg>
      </button>
      <span style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
        <span className="cf-fig" style={{ display: 'block', fontSize: 30, color: 'var(--cf-ink)', lineHeight: 1 }}>
          {valor}
        </span>
        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--cf-ink-3)', marginTop: 4 }}>
          {unidad}{antes != null && <> · antes {antes}</>}
        </span>
      </span>
      <button type="button" aria-label="Más" onClick={onMas} style={boton}>
        <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 6v12M6 12h12" /></svg>
      </button>
    </div>
  )
}

function Cuerpo({ children }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
}

/* ══ Recargo ══════════════════════════════════════════════════════════════
   LO QUE FALTABA: CUÁNDO LO PAGA. Hoy el recargo es un `tipo` dentro del modal
   de cobro y no se decide si cae entero en la próxima cuota o repartido en las
   que quedan. Sin esa decisión el cobrador llega mañana a pedir el doble sin
   saberlo — y el bloque negro lo dice: de $14.500 a $29.500. */
export function Recargo({
  diasAtraso, monto = '15.000', atajos = ['$5.000', '$10.000', '$15.000', 'Otro'], atajoActivo,
  cuando = 'proxima', motivo,
  cuotaAntes, cuotaDespues, saldoTotal,
  onCancelar, onAplicar,
}) {
  return (
    <Cuerpo>
      <Opciones opciones={atajos} activo={atajoActivo} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <EtiquetaCampo>Cuánto le cobras de más</EtiquetaCampo>
        <Campo defaultValue={`$${monto}`} foco inputMode="decimal" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <EtiquetaCampo>¿Cuándo lo cobra?</EtiquetaCampo>
        <Opciones activo={cuando} opciones={[
          { id: 'proxima',   nombre: 'En la próxima cuota' },
          { id: 'repartido', nombre: 'Repartido en las que faltan' },
        ]} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <EtiquetaCampo>Motivo</EtiquetaCampo>
        <Campo defaultValue={motivo} placeholder="Mora de más de un mes" />
        <AyudaCampo>Queda en el historial del préstamo.</AyudaCampo>
      </div>

      <AntesDespues concepto="Próxima cuota" antes={cuotaAntes} despues={cuotaDespues}
        resumen={{ etiqueta: 'Saldo total', valor: saldoTotal }} />

      {/* La objeción que el dueño no se hace solo, y que el propio handoff pone
          en el panel de escritorio. Va escrita: un color no puede argumentar. */}
      <Aviso tono="ambar">
        Un cliente que no puede pagar <strong>{cuotaAntes}</strong> tampoco va a pagar{' '}
        <strong>{cuotaDespues}</strong>. Con este atraso suele funcionar mejor bajarle la cuota.
      </Aviso>

      <BarraDoble cancelar="Cancelar" onCancelar={onCancelar}
        principal={`Aplicar $${monto}`} onPrincipal={onAplicar} />
    </Cuerpo>
  )
}

/* ══ Modificar el plazo ═══════════════════════════════════════════════════
   LA LÍNEA QUE EVITA LA PELEA: "lo que vas a recibir es igual". Estirar el
   plazo no cobra más intereses, reparte el mismo saldo en más cuotas — y sin
   decirlo, el dueño cree que está regalando plata. */
export function ModificarPlazo({
  intencion = 'extender', cuotas = 14, cuotasAntes = 8, unidad = 'cuotas diarias',
  cuotaAntes, cuotaDespues, terminaAntes, terminaDespues, totalRecibir,
  onMenos, onMas, onCancelar, onGuardar,
}) {
  return (
    <Cuerpo>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <EtiquetaCampo>¿Qué quieres cambiar?</EtiquetaCampo>
        <Opciones activo={intencion} opciones={[
          { id: 'extender', nombre: 'Extender plazo' },
          { id: 'fin',      nombre: 'Corregir fin' },
          { id: 'inicio',   nombre: 'Corregir inicio' },
        ]} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <EtiquetaCampo>Cuotas que faltan</EtiquetaCampo>
        <Contador valor={cuotas} unidad={unidad} antes={cuotasAntes} onMenos={onMenos} onMas={onMas} />
      </div>

      <AntesDespues concepto="Cuota diaria" antes={cuotaAntes} despues={cuotaDespues}
        resumen={[
          { etiqueta: 'Termina el', valor: `${terminaAntes} → ${terminaDespues}` },
          { etiqueta: 'Lo que vas a recibir', valor: `igual: ${totalRecibir}`, tono: 'favor' },
        ]} />

      <Aviso tono="neutro">
        Estirar el plazo <strong>no cobra más intereses</strong>: reparte el mismo saldo en más
        cuotas. Sirve para que un cliente apretado no caiga en mora.
      </Aviso>

      <BarraDoble cancelar="Cancelar" onCancelar={onCancelar}
        principal={`Guardar ${cuotas} cuotas`} onPrincipal={onGuardar} />
    </Cuerpo>
  )
}

/* ══ Descuento ════════════════════════════════════════════════════════════
   NO ES EL ESPEJO DEL RECARGO. Perdonar plata necesita una pregunta que cobrar
   de más no tiene: ¿DE DÓNDE SALE? De la ganancia significa que recuperas tu
   capital completo; del capital significa que pierdes. Hoy esa distinción no
   existe, y por eso las cuentas del mes no cuadran. */
export function Descuento({
  monto = '48.000', atajos = ['Todo el atraso', 'Una cuota', 'Otro'], atajoActivo,
  origen = 'ganancia', motivo,
  debeAntes, debeDespues, gananciaQueda, capitalVuelve,
  onCancelar, onPerdonar,
}) {
  return (
    <Cuerpo>
      <Opciones opciones={atajos} activo={atajoActivo} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <EtiquetaCampo>Cuánto le perdonas</EtiquetaCampo>
        <Campo defaultValue={`$${monto}`} foco inputMode="decimal" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <EtiquetaCampo>¿De dónde sale?</EtiquetaCampo>
        {/* Aquí va la bifurcación grande y no dos chips: la diferencia entre las
            dos opciones es si el dueño pierde plata o no. */}
        <Bifurcacion activo={origen} opciones={[
          { id: 'ganancia', nombre: 'De tu ganancia', nota: 'recuperas el capital' },
          { id: 'capital',  nombre: 'Del capital',    nota: 'pierdes plata', tono: 'contra' },
        ]} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <EtiquetaCampo>Por qué</EtiquetaCampo>
        <Campo defaultValue={motivo} placeholder="Acuerdo para que se ponga al día" />
        <AyudaCampo>Queda en el historial del préstamo.</AyudaCampo>
      </div>

      <AntesDespues concepto="Le queda debiendo" antes={debeAntes} despues={debeDespues}
        resumen={[
          { etiqueta: 'Tu ganancia baja a', valor: gananciaQueda },
          { etiqueta: 'Sigues recuperando', valor: capitalVuelve, tono: 'favor' },
        ]} />

      <BarraDoble cancelar="Cancelar" onCancelar={onCancelar}
        principal={`Perdonar $${monto}`} onPrincipal={onPerdonar} />
    </Cuerpo>
  )
}

/* ══ Mover a perdidos ═════════════════════════════════════════════════════
   LA ÚNICA PANTALLA DEL SISTEMA DONDE EL DORADO NO VA EN LA ACCIÓN PRINCIPAL.
   Aquí la destacada es SEGUIR COBRANDO, y dar por perdido queda en rojo de
   contorno. Antes de decidir muestra hace cuánto no se le escribe ni se le
   visita — a veces la respuesta es que nadie fue. */
export function MoverAPerdidos({
  monto, diasSinPagar, cumple,
  diasSinEscribir, diasSinVisitar,
  motivo, motivos = ['Se mudó', 'No contesta', 'Otro'],
  carteraAntes, carteraDespues, perdidaDelMes,
  onAcuerdo, onSeguir, onPerder,
}) {
  return (
    <Cuerpo>
      <Aviso tono="rojo">
        Darlo por perdido saca <strong>{monto}</strong> de tu cartera y los registra como pérdida
        del mes. El cliente queda marcado y no podrás prestarle otra vez sin quitarle la marca.
      </Aviso>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <EtiquetaCampo>Antes de darlo por perdido</EtiquetaCampo>
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 10, flex: 'none',
          padding: '13px 15px', background: 'var(--cf-card)',
          border: '1px solid var(--cf-border)', borderRadius: 'var(--cf-r-card-sm)',
        }}>
          <span className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink-2)', lineHeight: 1.45 }}>
            Le escribiste hace <strong>{diasSinEscribir} días</strong> · lo visitaron hace <strong>{diasSinVisitar}</strong>
          </span>
          <BotonSecundario onClick={onAcuerdo}>Probar primero con un acuerdo de pago</BotonSecundario>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <EtiquetaCampo>Por qué lo das por perdido</EtiquetaCampo>
        {/* Alimenta la estadística de por qué se pierde plata. */}
        <Opciones opciones={motivos} activo={motivo} />
      </div>

      <AntesDespues concepto="Cartera en la calle" antes={carteraAntes} despues={carteraDespues} tono="empeora"
        resumen={{ etiqueta: 'Pérdida del mes', valor: perdidaDelMes, tono: 'contra' }} />

      <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
        <BotonPrimario style={{ flex: 1.4 }} onClick={onSeguir}>Seguir cobrando</BotonPrimario>
        <BotonDestructivo style={{ flex: 1 }} onClick={onPerder}>Dar por perdido</BotonDestructivo>
      </div>
    </Cuerpo>
  )
}

/* ══ Cerrar anticipado ════════════════════════════════════════════════════
   La pregunta es una sola y no la hace la app hoy: ¿le cobras el interés que
   falta? Las tres respuestas cambian el total, así que cada una lleva SU CIFRA
   al lado — elegir sin ver el número es elegir a ciegas. */
export function CerrarAnticipado({
  cuotasFaltan, cuotasTotal, opcion = 'capital',
  soloCapital, todoPactado,
  vuelveHoy, gananciaSacrificada,
  onCancelar, onCerrar,
}) {
  const total = opcion === 'capital' ? soloCapital : todoPactado
  return (
    <Cuerpo>
      <EtiquetaCampo>¿Le cobras el interés que falta?</EtiquetaCampo>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <Bifurcacion activo={opcion} opciones={[
          { id: 'capital', nombre: 'Solo el capital que debe',
            nota: `Le perdonas el interés de las ${cuotasFaltan} que faltan`, valor: soloCapital },
          { id: 'todo', nombre: 'Todo lo pactado',
            nota: `Como si pagara las ${cuotasFaltan} cuotas`, valor: todoPactado },
        ]} />
        <Chip>Un punto medio · tú pones el monto</Chip>
      </div>

      <AntesDespues etiqueta="Lo que pasa hoy" concepto={`Le faltan ${cuotasFaltan} de ${cuotasTotal}`}
        antes={todoPactado} despues={total}
        resumen={[
          { etiqueta: 'Vuelven a tu caja hoy', valor: vuelveHoy, tono: 'favor' },
          { etiqueta: 'Ganancia que no cobras', valor: gananciaSacrificada, tono: opcion === 'capital' ? 'contra' : undefined },
        ]} />

      {/* El argumento a favor que el dueño no hace solo: la plata que vuelve hoy
          puede salir esta misma tarde en otro préstamo. */}
      <Aviso tono="neutro">
        Esos <strong>{vuelveHoy}</strong> vuelven a tu caja hoy y pueden salir esta tarde en otro
        préstamo.
      </Aviso>

      <BarraDoble cancelar="Cancelar" onCancelar={onCancelar}
        principal={`Cerrar por ${total}`} onPrincipal={onCerrar} />
    </Cuerpo>
  )
}

/* La acción SIEMPRE lleva su cifra, y cancelar nunca compite con ella. */
function BarraDoble({ cancelar, principal, onCancelar, onPrincipal }) {
  return (
    <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
      <BotonSecundario style={{ flex: 1 }} cancelar onClick={onCancelar}>{cancelar}</BotonSecundario>
      <BotonPrimario style={{ flex: 2 }} onClick={onPrincipal}>{principal}</BotonPrimario>
    </div>
  )
}
