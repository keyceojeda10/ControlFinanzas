'use client'
// components/caja/CajaCobradorDetalle.jsx
// Cuerpo reutilizable de la caja detallada de un cobrador: resumen del día,
// desglose por ruta y línea de movimientos (cobros + préstamos + gastos).
// Recibe `data` ya cargada del endpoint GET /api/caja/cobrador/[id].
// Se usa en la pantalla dedicada /caja/cobrador/[id] y en la pestaña "Caja por ruta".

import { formatMoney } from '@/lib/i18n'
import { Card } from '@/components/ui/Card'
import DesgloseMetodoPago from '@/components/caja/DesgloseMetodoPago'

const fmtHora = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Bogota' })
}

const MOV_CONFIG = {
  cobro:    { label: 'Cobro',    color: 'var(--cf-green-dark)', signo: '+' },
  prestamo: { label: 'Préstamo', color: 'var(--cf-gold-dark)', signo: '-' },
  gasto:    { label: 'Gasto',    color: 'var(--cf-red-dark)',  signo: '-' },
}

const GASTO_ESTADO_COLORS = {
  pendiente: 'var(--cf-gold-dark)',
  aprobado:  'var(--cf-green-dark)',
  rechazado: 'var(--cf-red-dark)',
}

export default function CajaCobradorDetalle({ data, onExplicar }) {
  const r = data?.resumen || {}
  const movimientos = data?.movimientos || []
  const porRuta = data?.porRuta || []
  const gastos = data?.gastos || []
  const g = data?.gestion || null
  const desgloseMetodo = data?.desgloseMetodoPago || []
  const pd = data?.prestadoDetalle || null
  const rutasNegativas = (data?.porRuta || []).filter(
    (r) => r.rutaId && r.capitalHabilitado && (r.saldoCapital ?? 0) < 0
  )

  const esCapitalEfectivo = r.capitalEsEfectivo

  // ── EL CERO ES UN DATO, NO LA FALTA DE UN DATO ─────────────────────────
  //
  // Aquí había un filtro que sacaba de la lista todo lo que estuviera en cero y
  // lo juntaba en una línea gris al pie: «Hoy no hubo préstamos nuevos,
  // renovaciones, clientes nuevos...». Lo escribí yo, razonando que cinco
  // recuadros diciendo «no pasó nada» son ruido.
  //
  // Estaba equivocado, y lo reportó el cliente con más cobradores de la
  // plataforma EN VIDEO: «al actualizarse la caja yo pierdo la información que
  // tenía: los cuadritos donde me mostraba cantidad de clientes activos, los
  // clientes que renovaba, los clientes nuevos. Eso ya no me aparece y necesito
  // que me aparezca».
  //
  // Las dos cosas que no vi:
  //
  //  1. Optimicé para el día lleno y rompí el día VACÍO. Él abre la caja a las
  //     8 de la mañana, cuando todo está en cero por definición — y justo ahí mi
  //     diseño hacía desaparecer la sección entera. No se lee como «limpio», se
  //     lee como que la pantalla perdió sus datos.
  //
  //  2. «0 clientes nuevos» SIGNIFICA algo: hoy no entró nadie. No es lo mismo
  //     que no saberlo. Esconderlo no le ahorra ruido, le quita la respuesta.
  //
  // Así que se pintan TODAS, siempre, en el mismo orden. Lo que está en cero va
  // apagado (tinta clara) en vez de desaparecer: se ve que el dato existe y que
  // hoy vale cero. Lo bueno del rediseño se queda: cantidad Y valor juntos.
  const hizoTodo = data?.hizo || []
  const enCero = (h) => !((h.cantidad ?? 0) > 0 || (h.monto ?? 0) > 0)

  return (
    <div className="space-y-4">
      {/* ── LA CUENTA DEL DÍA ─────────────────────────────────────────────
          Antes esto eran seis cajitas de colores con un número cada una:
          «Inicio del día», «Capital en ruta», «Cobrado», «Prestado»,
          «Gastos», «Seguros». La cuenta que las relacionaba SÍ existía —726 +
          406 = 1.132— pero el usuario tenía que descubrir solo que se
          relacionaban. Y encima el hero decía «Dinero en mano» sobre un número
          que era idéntico a «Capital en ruta», o sea un saldo acumulado, con
          $245.000 dentro que habían entrado por transferencia y que nadie
          lleva encima.

          Ahora es una resta, de arriba abajo, con la respuesta al final. Cada
          renglón se toca y dice de dónde sale. */}
      <div className="rounded-[16px] p-4" style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--cf-ink-3)' }}>
          La cuenta del día
        </p>

        {/* ── LO QUE COBRÓ HOY, ENTERO ────────────────────────────────────
            ⚠ ESTE NÚMERO NO ESTABA EN LA PANTALLA, y es el que el cobrador
            tiene en la cabeza cuando llama por teléfono.

            La resta de abajo solo cuenta EFECTIVO, y hace bien: es lo que hay
            que entregar. Pero el que cobró $908.000 —$626.000 por Nequi— veía
            «Cobró en efectivo $282.000» y ninguna cifra parecida a la suya.
            El dueño: «no hay ningún valor que sea de ochocientos y pico mil de
            pesos, por eso se enreda un montón».

            Va ARRIBA y separado de la resta, no dentro: si entrara en la
            cuenta, el sistema le pediría un fajo de billetes que nunca tuvo.
            Solo se pinta cuando hubo algo digital — en una ruta 100% efectivo
            el total y el efectivo son el mismo número y la línea sobraría. */}
        {(data?.cobradoTotalHoy?.digital ?? 0) > 0 && (
          <div
            className="rounded-[12px] px-3 py-2.5 mb-3"
            style={{ background: 'var(--cf-fill)', border: '1px solid var(--cf-border)' }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold" style={{ color: 'var(--cf-ink)' }}>
                Cobró hoy
              </span>
              <span className="cf-fig text-[19px] font-bold" style={{ color: 'var(--cf-ink)' }}>
                {formatMoney(data.cobradoTotalHoy.total)}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-[12px]" style={{ color: 'var(--cf-ink-3)' }}>
              <span>
                En efectivo{' '}
                <strong className="cf-fig" style={{ color: 'var(--cf-green-dark)' }}>
                  {formatMoney(data.cobradoTotalHoy.efectivo)}
                </strong>
              </span>
              <span>
                A la cuenta{' '}
                <strong className="cf-fig" style={{ color: 'var(--cf-ink-2)' }}>
                  {formatMoney(data.cobradoTotalHoy.digital)}
                </strong>
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {(data?.cuenta || []).map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={onExplicar ? () => onExplicar(l.id) : undefined}
              className="flex items-baseline justify-between gap-3 w-full text-left"
              style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: onExplicar ? 'pointer' : 'default' }}
            >
              <span className="text-sm" style={{ color: 'var(--cf-ink-2)' }}>
                {l.rotulo}
                {onExplicar && <span aria-hidden className="ml-1 text-[11px]" style={{ color: 'var(--cf-ink-4)' }}>?</span>}
              </span>
              <span className="cf-fig text-[15px]" style={{
                color: l.signo === 1 ? 'var(--cf-green-dark)' : l.signo === -1 ? 'var(--cf-red-dark)' : 'var(--cf-ink-3)',
              }}>
                {l.signo === 1 ? '+ ' : l.signo === -1 ? '− ' : ''}{formatMoney(l.monto)}
              </span>
            </button>
          ))}
        </div>

        {/* ⚠ EL RESULTADO DE ESTA CUENTA ES LA SUMA DE ESTAS LÍNEAS. PUNTO.
            La primera versión ponía aquí `dineroEnMano`, que con
            `capitalEsEfectivo` es la BOLSA ENTERA de la ruta — otra pregunta.
            En pantalla se leía «726.000 + 161.000 = 1.132.000», que no da. Es
            exactamente el pecado de la banda vieja: la respuesta de otra
            pregunta puesta al final de esta cuenta. */}
        <div className="flex items-baseline justify-between gap-3 mt-3 pt-3" style={{ borderTop: '1px solid var(--cf-hairline)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--cf-ink)' }}>
            Le queda del día
          </span>
          <span className="cf-fig text-[22px] font-bold" style={{
            color: (data?.cuentaSuma ?? 0) >= 0 ? 'var(--cf-green-dark)' : 'var(--cf-red-dark)',
          }}>
            {formatMoney(data?.cuentaSuma ?? 0)}
          </span>
        </div>

        <p className="text-[12px] mt-2 leading-snug" style={{ color: 'var(--cf-ink-3)' }}>
          {/* Antes decía «lo que entró por transferencia ya está en la cuenta»
              sin decir CUÁNTO, que es justo lo que hacía falta saber. Ahora la
              cifra está arriba, así que aquí se dice de dónde a dónde va. */}
          {(data?.cobradoTotalHoy?.digital ?? 0) > 0
            ? `Solo efectivo. Los ${formatMoney(data.cobradoTotalHoy.digital)} que entraron a la cuenta no se entregan.`
            : 'Solo efectivo. Lo que entró por transferencia ya está en la cuenta.'}
        </p>
      </div>

      {/* ── LA OTRA PREGUNTA, EN SU PROPIO SITIO ──────────────────────────
          Con `capitalEsEfectivo` el negocio entiende que el cobrador carga
          TODA la bolsa de su ruta, no solo lo que movió hoy. Es una pregunta
          distinta y por eso es una tarjeta distinta: mezclarla con la cuenta
          del día es lo que hacía que los números no dieran. */}
      {esCapitalEfectivo && (
        <div className="rounded-[16px] p-4" style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold" style={{ color: 'var(--cf-ink)' }}>
              Debería tener en la mano
            </span>
            <span className="cf-fig text-[22px] font-bold" style={{
              color: (r.dineroEnMano ?? 0) >= 0 ? 'var(--cf-green-dark)' : 'var(--cf-red-dark)',
            }}>
              {formatMoney(r.dineroEnMano ?? 0)}
            </span>
          </div>
          <p className="text-[12px] mt-2 leading-snug" style={{ color: 'var(--cf-ink-3)' }}>
            Toda la bolsa de sus rutas, no solo lo de hoy: {formatMoney(r.capitalRutasTotal ?? 0)} de capital
            {(r.gastosPendientesMonto ?? 0) > 0 ? `, menos ${formatMoney(r.gastosPendientesMonto)} de gastos sin aprobar` : ''}.
          </p>
        </div>
      )}

      {/* Resumen completo de lo prestado en el dia.
          Reemplaza a la vieja caja "Renovaciones de hoy", que solo aparecia si habia
          renovaciones con saldo absorbido: los prestamos nuevos no salian en ningun
          resumen y el dueño concluia que no se estaban contando. Ahora se listan las
          dos clases y el total cuadra con la tarjeta "Prestado". */}
      {pd && (pd.nuevos.cantidad > 0 || pd.renovaciones.cantidad > 0) && (
        <div
          className="rounded-[12px] p-3"
          style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: 'var(--cf-ink-3)' }}>
            Lo que prestó hoy
          </p>

          <div className="space-y-1.5">
            {pd.nuevos.cantidad > 0 && (
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px]" style={{ color: 'var(--cf-ink-2)' }}>
                  {pd.nuevos.cantidad} préstamo{pd.nuevos.cantidad === 1 ? '' : 's'} nuevo{pd.nuevos.cantidad === 1 ? '' : 's'}
                </span>
                <span className="text-[13px] font-bold font-mono-display" style={{ color: 'var(--cf-ink)' }}>
                  {formatMoney(pd.nuevos.valor)}
                </span>
              </div>
            )}

            {pd.renovaciones.cantidad > 0 && (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px]" style={{ color: 'var(--cf-ink-2)' }}>
                    {pd.renovaciones.cantidad} renovaci{pd.renovaciones.cantidad === 1 ? 'ón' : 'ones'}
                  </span>
                  <span className="text-[13px] font-bold font-mono-display" style={{ color: 'var(--cf-ink)' }}>
                    {formatMoney(pd.renovaciones.valor)}
                  </span>
                </div>
                {pd.renovaciones.absorbido > 0 && (
                  <div className="flex items-baseline justify-between gap-2 pl-3">
                    <span className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>
                      de eso, saldo que ya le debían
                    </span>
                    <span className="text-[11px] font-mono-display" style={{ color: 'var(--cf-ink-2)' }}>
                      {formatMoney(pd.renovaciones.absorbido)}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mt-2.5 pt-2.5 space-y-1.5" style={{ borderTop: '1px solid var(--cf-border)' }}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px] font-semibold" style={{ color: 'var(--cf-ink)' }}>Total prestado</span>
              <span className="text-[15px] font-bold font-mono-display" style={{ color: 'var(--cf-gold-dark)' }}>
                {formatMoney(pd.valorTotal)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>Efectivo que salió de su mano</span>
              <span className="text-[12px] font-mono-display" style={{ color: 'var(--cf-ink-2)' }}>
                {formatMoney(pd.efectivoTotal)}
              </span>
            </div>
          </div>

          {pd.valorTotal !== pd.efectivoTotal && (
            <p className="text-[10px] mt-2 leading-snug" style={{ color: 'var(--cf-ink-3)' }}>
              La diferencia de {formatMoney(pd.valorTotal - pd.efectivoTotal)} es saldo que los clientes ya debían y
              quedó dentro de la cartulina nueva: no salió efectivo por esa parte.
              {' '}La tarjeta <strong>Prestado</strong> de arriba muestra{' '}
              {pd.tarjetaMuestra === 'valor' ? 'el total prestado' : 'solo el efectivo'}.
            </p>
          )}
        </div>
      )}

      {/* Desglose por método de pago */}
      <DesgloseMetodoPago items={desgloseMetodo} />

      {/* Alerta gastos pendientes */}
      {(r.gastosPendientesCantidad || 0) > 0 && (
        <div
          className="flex items-start gap-2.5 p-3 rounded-[12px] border"
          style={{
            background: 'color-mix(in srgb, var(--cf-gold-dark) 8%, var(--cf-card))',
            borderColor: 'color-mix(in srgb, var(--cf-gold-dark) 25%, var(--cf-border))',
          }}
        >
          <svg className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--cf-gold-dark)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div>
            <p className="text-[12px] font-semibold" style={{ color: 'var(--cf-gold-dark)' }}>
              {r.gastosPendientesCantidad} gasto{r.gastosPendientesCantidad > 1 ? 's' : ''} pendiente{r.gastosPendientesCantidad > 1 ? 's' : ''} por aprobar ({formatMoney(r.gastosPendientesMonto)})
            </p>
            {esCapitalEfectivo && (
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>
                El capital en ruta no refleja este gasto hasta que se apruebe
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── LO QUE HIZO HOY ───────────────────────────────────────────────
          Una fila por cosa, con su cantidad Y su valor —«3 renovaciones ·
          $800.000»—, que es lo que la versión vieja no tenía: un «RENOVACIONES
          10» pelado no dice cuánta plata movió, y «$2.400.000» sin el número de
          renovaciones tampoco dice nada.

          Y se pintan TODAS, también las que están en cero (ver arriba). */}
      {hizoTodo.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-[var(--cf-ink)] mb-3">Lo que hizo hoy</h2>

          {/* ── LA CARTERA, ARRIBA Y SIEMPRE ─────────────────────────────
              «Clientes activos» es lo PRIMERO que nombró el cliente en el
              video, y yo lo tenía escondido dentro de la frase de apoyo
              («0 de 145 clientes le pagaron»). No es actividad del día: es el
              tamaño de su cartera, y no puede depender de que hoy haya habido
              movimiento. Por eso va aquí, en cifra grande, con los cobros del
              día al lado — que es la pareja que se lee junta: «cuántos de los
              míos me pagaron hoy». */}
          <div className="flex gap-3 mb-3">
            {[
              { rot: 'Cobros hoy', val: g?.clientesCobrados ?? 0 },
              { rot: 'Clientes activos', val: g?.clientesActivos ?? 0 },
            ].map((k) => (
              <div key={k.rot} className="flex-1 min-w-0 rounded-[12px] px-3 py-2.5"
                style={{ background: 'var(--cf-fill)' }}>
                <span className="block text-[10px] font-bold uppercase tracking-[.07em]"
                  style={{ color: 'var(--cf-ink-3)' }}>{k.rot}</span>
                <span className="cf-fig block text-[20px] font-semibold mt-0.5"
                  style={{ color: k.val > 0 ? 'var(--cf-ink)' : 'var(--cf-ink-3)' }}>{k.val}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col">
            {hizoTodo.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={onExplicar ? () => onExplicar(h.id) : undefined}
                className="flex items-baseline justify-between gap-3 w-full text-left py-2"
                style={{
                  background: 'none', border: 'none', borderBottom: '1px solid var(--cf-hairline)',
                  padding: '8px 0', font: 'inherit', cursor: onExplicar ? 'pointer' : 'default',
                }}
              >
                <span className="min-w-0 flex-1">
                  {/* En cero va en tinta clara: el dato SE VE —y su cero también—
                      pero no compite con lo que sí movió plata hoy. */}
                  <span className="block text-sm" style={{ color: enCero(h) ? 'var(--cf-ink-3)' : 'var(--cf-ink)' }}>
                    {h.cantidad != null && (
                      <span className="cf-fig font-semibold mr-1.5">{h.cantidad}</span>
                    )}
                    {h.cantidad === 1 && h.uno ? h.uno : h.rotulo}
                    {onExplicar && <span aria-hidden className="ml-1 text-[11px]" style={{ color: 'var(--cf-ink-4)' }}>?</span>}
                  </span>
                  {/* El formato de moneda es del PAÍS y vive aquí, no en la
                      API. Componer el texto allí soltó un «369000» pelado en
                      pantalla — un número sin formato hace que toda la cifra
                      parezca poco fiable. */}
                  {h.absorbido > 0 && (
                    <span className="block text-[12px] mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>
                      {formatMoney(h.absorbido)} eran saldo que ya le debían
                    </span>
                  )}
                </span>
                {/* `monto: null` es «esto no se mide en plata» (clientes nuevos
                    se cuentan, no se suman), y ahí la derecha va vacía a
                    propósito. Un monto que SÍ existe pero vale cero se pinta
                    «$0»: dejarlo en blanco haría dudar de si se calculó. */}
                {h.monto != null && (
                  <span className="cf-fig text-sm flex-none" style={{ color: enCero(h) ? 'var(--cf-ink-3)' : 'var(--cf-ink)' }}>
                    {formatMoney(h.monto)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Capital y movimiento por ruta */}
      {porRuta.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-[var(--cf-ink)] mb-3">Por ruta</h2>

          {/* ── CAPITAL DE RUTA EN NEGATIVO: FALTA UN DATO, NO FALTA PLATA ──
              Este aviso decía «salió X más de lo que entró», en rojo. Suena a
              que se perdió dinero, y comprobado contra producción NO es eso:

               · Los 253 negocios cuadran al peso con la fórmula del código.
               · De los 107 con saldo negativo, **106 se explican enteros por la
                 cartera viva**: lo que «falta» es menos de lo que está prestado.
               · 98 de 107 nunca registraron su capital inicial.

              La bolsa arranca en cero porque nadie declaró con cuánto empezó, y
              cada préstamo la baja. El diagnóstico y el arreglo que ya traía
              este aviso eran CORRECTOS —inyectar el capital de la ruta—; lo que
              estaba mal era el tono y la frase de arriba, que acusaba.

              En ámbar, no en rojo: es un dato que falta, no una pérdida. */}
          {rutasNegativas.length > 0 && (
            <div
              className="rounded-[12px] p-3 mb-3"
              style={{
                background: 'var(--cf-gold-tint)',
                border: '1px solid var(--cf-gold-border)',
              }}
            >
              <p className="text-[12px] font-semibold mb-1" style={{ color: 'var(--cf-gold-dark)' }}>
                {rutasNegativas.length === 1
                  ? `A la ruta ${rutasNegativas[0].nombre} le falta registrar su capital`
                  : `A ${rutasNegativas.length} rutas les falta registrar su capital`}
              </p>
              <p className="text-[11px] leading-snug" style={{ color: 'var(--cf-ink-2)' }}>
                {rutasNegativas.length === 1 ? 'Aparece' : 'Aparecen'} con{' '}
                <strong style={{ color: 'var(--cf-ink)' }}>
                  {formatMoney(Math.abs(rutasNegativas.reduce((a, r) => a + (r.saldoCapital || 0), 0)))}
                </strong>{' '}
                en negativo porque se empezó a prestar antes de decir con cuánta plata
                contaba{rutasNegativas.length === 1 ? '' : 'n'}: la bolsa arranca en cero y cada
                préstamo la baja. <strong style={{ color: 'var(--cf-ink)' }}>La plata no se perdió</strong>,
                está en la calle.
              </p>
              <p className="text-[11px] leading-snug mt-1.5" style={{ color: 'var(--cf-ink-3)' }}>
                Regístrela en <strong>Capital → Inyectar a la ruta</strong> y el saldo queda al día.
              </p>
            </div>
          )}
          <div className="space-y-2">
            {porRuta.map((ruta) => (
              <div key={ruta.rutaId || 'otros'} className="rounded-[12px] bg-[var(--cf-card)] border border-[var(--cf-border)] p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-semibold text-[var(--cf-ink)]">{ruta.nombre}</span>
                  {ruta.rutaId && (
                    <span className="text-[11px] text-[var(--cf-ink-3)]">
                      Disponible:{' '}
                      {/* En rojo si quedo negativo: antes salia del mismo color que
                          cualquier otra cifra y un "-$85.865.000" pasaba inadvertido. */}
                      <span
                        className="font-semibold font-mono-display"
                        style={{ color: (ruta.saldoCapital ?? 0) < 0 ? 'var(--cf-red-dark)' : 'var(--cf-ink)' }}
                      >
                        {formatMoney(ruta.saldoCapital)}
                      </span>
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] text-[var(--cf-ink-3)] uppercase tracking-wide">Prestado</p>
                    <p className="text-sm font-semibold font-mono-display text-[var(--cf-gold-dark)]">{ruta.prestadoDia > 0 ? '-' : ''}{formatMoney(ruta.prestadoDia)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--cf-ink-3)] uppercase tracking-wide">Cobrado</p>
                    <p className="text-sm font-semibold font-mono-display text-[var(--cf-green-dark)]">{formatMoney(ruta.cobradoDia)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--cf-ink-3)] uppercase tracking-wide">Seguros</p>
                    <p className="text-sm font-semibold font-mono-display text-[var(--cf-ink-2)]">{formatMoney(ruta.segurosDia)}</p>
                  </div>
                </div>
                {/* ── DE LO COBRADO, CUÁNTO ES EFECTIVO ────────────────────
                    Al cerrar el día el cobrador solo entrega el EFECTIVO: lo
                    digital ya está en la cuenta. Sin partirlo se le pide un fajo
                    que incluye plata que nunca tocó. Solo se pinta si hubo algo
                    digital — en una ruta 100% efectivo la línea sobra. */}
                {ruta.rutaId && (ruta.cobradoDigital ?? 0) > 0 && (
                  <div className="mt-2 flex items-center gap-3 text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>
                    <span>
                      Efectivo{' '}
                      <strong className="font-mono-display" style={{ color: 'var(--cf-ink-2)' }}>
                        {formatMoney(ruta.cobradoEfectivo ?? 0)}
                      </strong>
                    </span>
                    <span>
                      Digital{' '}
                      <strong className="font-mono-display" style={{ color: 'var(--cf-ink-2)' }}>
                        {formatMoney(ruta.cobradoDigital ?? 0)}
                      </strong>
                    </span>
                  </div>
                )}

                {/* Los recargos NO suman al cobrado: suben la deuda del cliente
                    y nadie entrega un billete. Por eso van aparte y sin «+». */}
                {ruta.rutaId && (ruta.recargosDia ?? 0) > 0 && (
                  <div className="mt-1.5 flex items-center justify-between text-[11px]">
                    <span style={{ color: 'var(--cf-ink-3)' }}>
                      {ruta.recargosCantidad} recargo{ruta.recargosCantidad === 1 ? '' : 's'}
                      {' '}<span style={{ color: 'var(--cf-ink-4)' }}>(no es plata que entró)</span>
                    </span>
                    <span className="font-mono-display" style={{ color: 'var(--cf-ink-2)' }}>
                      {formatMoney(ruta.recargosDia)}
                    </span>
                  </div>
                )}

                {ruta.rutaId && (() => {
                  const flujoRuta = ruta.cobradoDia + ruta.segurosDia - ruta.prestadoDia
                  return (
                    <div className="mt-2 pt-2 border-t border-[var(--cf-border)] flex items-center justify-between">
                      <span className="text-[10px] text-[var(--cf-ink-3)] uppercase tracking-wide">Flujo del día</span>
                      <span className="text-sm font-bold font-mono-display" style={{ color: flujoRuta >= 0 ? 'var(--cf-green-dark)' : 'var(--cf-red-dark)' }}>
                        {formatMoney(flujoRuta)}
                      </span>
                    </div>
                  )
                })()}

                {/* ── INICIO DEL DÍA → LO QUE QUEDA ────────────────────────
                    La cuenta que se puede seguir con un lápiz: con lo que
                    amaneció la ruta, más lo que entró, menos lo que salió.
                    Solo con capital propio: sin él la sub-bolsa no significa
                    nada porque la plata vive en la bolsa global del negocio. */}
                {ruta.rutaId && ruta.capitalHabilitado && typeof ruta.saldoApertura === 'number' && (
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span style={{ color: 'var(--cf-ink-3)' }}>Empezó el día con</span>
                    <span className="font-mono-display" style={{ color: 'var(--cf-ink-2)' }}>
                      {formatMoney(ruta.saldoApertura)}
                    </span>
                  </div>
                )}

                {/* ── LA GESTIÓN DE ESTA RUTA ──────────────────────────────
                    Los cuadros que el cobrador del video echaba de menos, pero
                    de SU ruta y no sumados con las demás: con tres rutas, «2
                    clientes nuevos» no dice en cuál entraron.
                    Se pintan todos, también en cero: un cero informa —hoy no
                    entró nadie— y esconderlo deja la tarjeta muda por la
                    mañana. Ver `feedback_el_cero_es_un_dato`. */}
                {ruta.rutaId && ruta.gestion && (
                  <div className="mt-2 pt-2 border-t border-[var(--cf-border)] grid grid-cols-4 gap-2">
                    {[
                      { rot: 'Cobrados', val: ruta.gestion.clientesCobrados },
                      { rot: 'Activos', val: ruta.gestion.clientesActivos },
                      { rot: 'Nuevos', val: ruta.gestion.clientesNuevos },
                      { rot: 'Renovó', val: ruta.gestion.renovaciones },
                    ].map((k) => (
                      <div key={k.rot}>
                        <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>{k.rot}</p>
                        <p className="text-sm font-semibold font-mono-display"
                          style={{ color: k.val > 0 ? 'var(--cf-ink)' : 'var(--cf-ink-3)' }}>{k.val ?? 0}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Acumulado colocado en la ruta. Lo de arriba (prestado/cobrado)
                    es el DIA; esto es el stock. Sin este dato, "Disponible: $X"
                    se leia como si fuera todo el dinero de la ruta. */}
                {ruta.rutaId && typeof ruta.capitalEnCalle === 'number' && (
                  <div className="mt-2 pt-2 border-t border-[var(--cf-border)] grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-[var(--cf-ink-3)] uppercase tracking-wide">En la calle</p>
                      <p className="text-sm font-semibold font-mono-display text-[var(--cf-ink)]">{formatMoney(ruta.capitalEnCalle)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-[var(--cf-ink-3)] uppercase tracking-wide">Con intereses</p>
                      <p className="text-sm font-semibold font-mono-display text-[var(--cf-ink)]">{formatMoney(ruta.conIntereses)}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Gastos del día */}
      {gastos.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-[var(--cf-ink)] mb-3">Gastos del día</h2>
          <div className="space-y-1.5">
            {gastos.map((g, i) => {
              const color = GASTO_ESTADO_COLORS[g.estado] || 'var(--cf-gold-dark)'
              return (
                <div key={i} className="flex items-center justify-between gap-2 py-2 border-b border-[var(--cf-border)] last:border-0">
                  <div className="min-w-0">
                    <p className="text-xs text-[var(--cf-ink)] truncate">{g.description}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-semibold" style={{ color }}>{g.estado}</span>
                      <span className="text-[10px] text-[var(--cf-ink-3)]">{fmtHora(g.fecha)}</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold font-mono-display shrink-0 text-[var(--cf-red-dark)]">-{formatMoney(g.monto)}</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Movimientos del día */}
      <Card>
        <h2 className="text-sm font-semibold text-[var(--cf-ink)] mb-3">Movimientos del día</h2>
        {movimientos.length === 0 ? (
          <p className="text-sm text-[var(--cf-ink-3)]">Sin movimientos registrados este día.</p>
        ) : (
          <div className="space-y-1.5">
            {movimientos.map((m, i) => {
              const cfg = MOV_CONFIG[m.tipo] || MOV_CONFIG.cobro
              return (
                <div key={i} className="flex items-center justify-between gap-2 py-2 border-b border-[var(--cf-border)] last:border-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                      {m.esClavo && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-[var(--cf-red-dark)]/15 text-[var(--cf-red-dark)]">CLAVO</span>}
                      <span className="text-[11px] text-[var(--cf-ink-3)]">{fmtHora(m.fecha)}</span>
                    </div>
                    <p className="text-xs text-[var(--cf-ink)] truncate">
                      {m.tipo === 'gasto' ? (m.concepto || 'Gasto menor') : (m.cliente || 'Cliente')}
                      {m.rutaNombre ? <span className="text-[var(--cf-ink-3)]"> · {m.rutaNombre}</span> : null}
                    </p>
                  </div>
                  <span className="text-sm font-semibold font-mono-display shrink-0" style={{ color: cfg.color }}>
                    {cfg.signo}{formatMoney(m.monto)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
