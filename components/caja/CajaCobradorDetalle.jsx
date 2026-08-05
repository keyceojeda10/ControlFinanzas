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

/* Un renglón de la cuenta: rótulo a la izquierda, cifra a la derecha, y su
   explicación opcional debajo. Sin signo: el signo lo dice el grupo —«Entra» o
   «Sale»—, que es justo lo que el dueño pedía poder ver de un vistazo en vez de
   ir leyendo un «+» o un «−» por renglón. */
function Renglon({ rotulo, monto, detalle, onExplicar }) {
  return (
    <div className="py-1">
      <button
        type="button"
        onClick={onExplicar}
        disabled={!onExplicar}
        className="flex items-baseline justify-between gap-3 w-full text-left"
        style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: onExplicar ? 'pointer' : 'default' }}
      >
        <span className="text-[13.5px]" style={{ color: 'var(--cf-ink-2)' }}>
          {rotulo}
          {onExplicar && <span aria-hidden className="ml-1 text-[11px]" style={{ color: 'var(--cf-ink-4)' }}>?</span>}
        </span>
        <span className="cf-fig text-[15px]" style={{ color: 'var(--cf-ink)' }}>{formatMoney(monto)}</span>
      </button>
      {detalle && (
        <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>{detalle}</p>
      )}
    </div>
  )
}

export default function CajaCobradorDetalle({ data, onExplicar }) {
  const r = data?.resumen || {}
  // ⚠ RESPALDO PARA LA RESPUESTA VIEJA DEL CACHE. `cuentaRuta` es nuevo: un
  // teléfono que todavía sirva la respuesta guardada de antes no lo trae, y sin
  // esto la tarjeta entera saldría en CEROS — peor que la pantalla vieja, y
  // justo en la pantalla del dinero. Se reconstruye de lo que sí venía.
  const cr = data?.cuentaRuta ?? (() => {
    const lineas = data?.cuenta || []
    const dea = (id) => lineas.find((l) => l.id === id)?.monto ?? 0
    const apertura = dea('apertura')
    const efectivo = dea('recaudoEfectivo')
    const digital = data?.cobradoTotalHoy?.digital ?? 0
    const prestado = dea('desembolsos')
    const gastos = dea('gastos')
    return {
      apertura, cobradoEfectivo: efectivo, cobradoDigital: digital,
      cobradoTotal: efectivo + digital, prestado, gastos,
      // La respuesta vieja no separaba lo prestado: se asume todo efectivo,
      // que es lo que hacía antes y lo que es cierto en el 99% de los casos.
      prestadoEfectivo: prestado, prestadoDigital: 0,
      quedaEnLaRuta: Math.round(apertura + efectivo + digital - prestado - gastos),
      quedaEnEfectivo: data?.cuentaSuma ?? 0,
    }
  })()
  // ⚠ LOS DOS SUBTOTALES SALEN DEL API, no se rearman aquí.
  //
  // `entraTotal` se calculaba a mano sumando el cobro TOTAL —con Nequi— mientras
  // `salioTotal` venía del API sin él: los dos bloques hablaban de plata
  // distinta y la resta visible no daba el resultado de abajo. Ahora la
  // transferencia entra y sale en la misma cuenta, así que los dos subtotales
  // vienen de la misma fuente y la resta cuadra con el dedo.
  //
  // El respaldo mantiene el comportamiento viejo para una respuesta en caché,
  // igual que hace `cr` unas líneas más arriba.
  const salioTotal = data?.cuentaSalio ?? Math.round((cr.prestado ?? 0) + (cr.gastos ?? 0))
  const entraTotal = data?.cuentaEntro ?? Math.round((cr.apertura ?? 0) + (cr.cobradoTotal ?? 0))
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
      {/* ── LA CUENTA DEL DÍA, AGRUPADA ─────────────────────────────────────
          Rehecha con la estructura que dictó el dueño, con la calculadora en la
          mano y tres videos:

            «hay que agrupar bien todas las sumas, agrupar bien todas las
             restas, y visiblemente ver de dónde sale los números positivos y
             los negativos… lo que pasa es que como quedó en TRES CUADROS
             DIFERENTES, ahí fue donde estamos un poco enredados»

          Su cuenta, dictada en el video, da EXACTA con nuestras cifras:
            352.000 + 428.000 − 40.000 − 485.215 = 254.785

          Antes esto eran cifras sueltas —«Cobró en efectivo» aquí, el total
          cobrado en otra tarjeta, lo prestado en una tercera— y había que
          sumarlas de cabeza para comprobar nada. Ahora: lo que ENTRA con su
          desglose y su subtotal, lo que SALE con el suyo, y la resta.

          ⚠ Y DA LAS DOS RESPUESTAS, que es lo que faltaba. Su fórmula usa el
          cobro TOTAL y termina en el capital de la ruta ($254.785); la cuenta
          del efectivo usa solo los billetes y termina en lo que entrega al
          cerrar ($96.785). La diferencia son los $158.000 que entraron a la
          cuenta. Ninguna está mal: son dos preguntas, y antes solo se veía una
          con la otra suelta en otro cuadro. */}
      <div className="rounded-[16px] p-4" style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--cf-ink-3)' }}>
          La cuenta del día
        </p>

        {/* ENTRA */}
        <div className="rounded-[12px] px-3 py-2.5" style={{ background: 'var(--cf-fill)' }}>
          <p className="text-[10.5px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--cf-green-dark)' }}>
            Entra
          </p>
          <Renglon
            rotulo="Con lo que salió"
            monto={cr.apertura ?? 0}
            onExplicar={onExplicar ? () => onExplicar('apertura') : undefined}
          />
          <Renglon
            rotulo="Cobró en efectivo"
            monto={cr.cobradoEfectivo ?? 0}
            onExplicar={onExplicar ? () => onExplicar('recaudoEfectivo') : undefined}
          />
          {/* ⚠ DOS RENGLONES, NO UN TOTAL CON LETRA CHICA DEBAJO. El dueño lo
              pidió así: «diferenciar cobros en efectivo, cobros en
              transferencia». Como nota al pie hay que leerla; como renglón se
              ve de un vistazo y se puede seguir con el dedo, que es justo lo
              que él hacía con la calculadora. */}
          {(cr.cobradoDigital ?? 0) > 0 && (
            <Renglon rotulo="Cobró por transferencia" monto={cr.cobradoDigital} />
          )}
          <div className="flex items-baseline justify-between gap-3 mt-2 pt-2" style={{ borderTop: '1px solid var(--cf-hairline)' }}>
            <span className="text-[13px] font-bold" style={{ color: 'var(--cf-ink)' }}>Total que entra</span>
            {/* ⚠ NO es `cuentaEntro` del adaptador: ese suma solo el EFECTIVO,
                porque alimenta la resta de los billetes. Aquí arriba se enseña
                el cobro TOTAL —con Nequi—, así que el subtotal tiene que ser el
                de estas dos líneas o no cuadraría con lo que se ve. */}
            <span className="cf-fig text-[17px] font-bold" style={{ color: 'var(--cf-green-dark)' }}>
              {formatMoney(entraTotal)}
            </span>
          </div>
        </div>

        {/* SALE */}
        <div className="rounded-[12px] px-3 py-2.5 mt-2" style={{ background: 'var(--cf-fill)' }}>
          <p className="text-[10.5px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--cf-red-dark)' }}>
            Sale
          </p>
          <Renglon
            rotulo="Prestó en efectivo"
            monto={cr.prestadoEfectivo ?? cr.prestado ?? 0}
            onExplicar={onExplicar ? () => onExplicar('desembolsos') : undefined}
          />
          {/* ⚠ LO PRESTADO POR TRANSFERENCIA NO SALE DEL FAJO. Sumarlo al
              efectivo le pedía al cobrador un billete que nunca puso — el mismo
              error del lado del cobro, al revés. En este negocio hay 6 casos. */}
          {(cr.prestadoDigital ?? 0) > 0 && (
            <Renglon rotulo="Prestó por transferencia" monto={cr.prestadoDigital} />
          )}
          {(cr.gastos ?? 0) > 0 && (
            <Renglon
              rotulo="Gastó"
              monto={cr.gastos}
              onExplicar={onExplicar ? () => onExplicar('gastos') : undefined}
            />
          )}
          {/* ⚠ EL CONTRAPESO DE LA TRANSFERENCIA. Arriba entra —el dueño lo
              pidió como renglón— y aquí sale, porque esa plata nunca estuvo en
              el bolsillo del cobrador: llega directa a la cuenta de la oficina.
              Sin esta línea la resta que él sigue con el dedo daba $179.000 de
              más y no coincidía con la cifra de abajo. */}
          {(cr.cobradoDigital ?? 0) > 0 && (
            <Renglon rotulo="Entró a la cuenta de la oficina" monto={cr.cobradoDigital} />
          )}
          <div className="flex items-baseline justify-between gap-3 mt-2 pt-2" style={{ borderTop: '1px solid var(--cf-hairline)' }}>
            <span className="text-[13px] font-bold" style={{ color: 'var(--cf-ink)' }}>Total que sale</span>
            <span className="cf-fig text-[17px] font-bold" style={{ color: 'var(--cf-red-dark)' }}>
              {formatMoney(salioTotal)}
            </span>
          </div>
        </div>

        {/* ── EL RESULTADO: LO QUE TIENE QUE ENTREGAR ─────────────────────
            ⚠ ESTE ES EL DATO QUE SE PERSIGUE. Toda la pantalla existe para
            responder una pregunta: cuánta plata pone el cobrador sobre la mesa
            esta noche. Es lo que el administrador va a contar.

            La primera versión lo puso DEBAJO, en 16px y gris, con «Le queda en
            la ruta» arriba en grande y en verde. Y esa de arriba NO SE ENTREGA:
            incluye lo que entró por transferencia, que ya está en el banco. O
            sea que la cifra grande era la que no se cuenta y la chica la que
            sí. Al revés de lo que hace falta.

            Ahora manda la de entregar; el capital de la ruta queda debajo como
            contexto, que es su papel. */}
        <div className="mt-3 pt-3" style={{ borderTop: '2px solid var(--cf-border-strong)' }}>
          <div className="flex items-baseline justify-between gap-3">
            {/* ⚠ EN NEGATIVO NO ENTREGA: LE DEBEN A ÉL. Pasa de verdad —la
                ruta #8 cerró en −$69.833 porque prestó más efectivo del que
                llevaba— y «Tiene que entregar −$69.833» no se entiende. Se
                cambia el rótulo y se enseña la cifra en positivo. */}
            <span className="text-[15px] font-bold" style={{ color: 'var(--cf-ink)' }}>
              {(cr.quedaEnEfectivo ?? 0) >= 0 ? 'Tiene que entregar' : 'Hay que reponerle'}
            </span>
            <span className="cf-fig text-[26px] font-bold" style={{
              color: (cr.quedaEnEfectivo ?? 0) >= 0 ? 'var(--cf-green-dark)' : 'var(--cf-red-dark)',
            }}>
              {formatMoney(Math.abs(cr.quedaEnEfectivo ?? 0))}
            </span>
          </div>
          <p className="text-[11.5px] mt-1 leading-snug" style={{ color: 'var(--cf-ink-3)' }}>
            {(cr.quedaEnEfectivo ?? 0) < 0
              ? 'Prestó más efectivo del que llevaba: puso plata suya y hay que devolvérsela.'
              : (cr.cobradoDigital ?? 0) > 0
                ? `Solo billetes. Los ${formatMoney(cr.cobradoDigital)} que entraron por transferencia ya están en la cuenta.`
                : 'El efectivo que lleva encima al cerrar el día.'}
          </p>

          {/* El capital de la ruta: la otra pregunta, la que cierra la resta de
              arriba. Va debajo porque no se entrega — es lo que la ruta tiene
              puesto, contando lo que está en el banco. */}
          {(cr.cobradoDigital ?? 0) > 0 && (
            <>
              <div className="flex items-baseline justify-between gap-3 mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--cf-hairline)' }}>
                <span className="text-[13px] font-semibold" style={{ color: 'var(--cf-ink-2)' }}>
                  Le queda en la ruta
                </span>
                <span className="cf-fig text-[16px] font-bold" style={{
                  color: (cr.quedaEnLaRuta ?? 0) >= 0 ? 'var(--cf-ink)' : 'var(--cf-red-dark)',
                }}>
                  {formatMoney(cr.quedaEnLaRuta ?? 0)}
                </span>
              </div>
              {/* ⚠ ESTE PIE DESCRIBÍA OTRA RESTA.
                  Decía «entraTotal − salioTotal», y esos dos subtotales son
                  ahora la cuenta de los BILLETES: su resta da lo que hay que
                  entregar, no lo que queda en la ruta. Se explicaba con una
                  cuenta que da otra cifra distinta de la que está encima.
                  Ahora dice de dónde sale de verdad: lo entregado más lo que
                  se fue al banco, que es justo lo que la diferencia. */}
              <p className="text-[11.5px] mt-1 leading-snug" style={{ color: 'var(--cf-ink-3)' }}>
                {(cr.cobradoDigital ?? 0) > 0
                  ? <>Lo de entregar más los {formatMoney(cr.cobradoDigital)} que entraron a la cuenta. Esa parte no la trae en billetes.</>
                  : <>{formatMoney(entraTotal)} − {formatMoney(salioTotal)}.</>}
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── AQUÍ ESTABA «DEBERÍA TENER EN LA MANO», Y SE FUE ──────────────
          Enseñaba `dineroEnMano`, que es el capital de la ruta: LA MISMA CIFRA
          que ahora cierra la cuenta de arriba como «Le queda en la ruta»
          ($254.785 en la #5, $494.167 en la #8 — comprobado contra la base).
          Repetirla en su propia tarjeta era el tercero de los «tres cuadros
          diferentes» que el dueño señaló como la causa del enredo: el mismo
          número dos veces, con dos nombres, sin decir que era el mismo.
          Ahora sale una vez, al final de la resta que la produce. */}

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

          {/* ⚠ LA DIFERENCIA TIENE DOS CAUSAS Y ANTES SE EXPLICABA UNA SOLA.
              Este texto decía que TODA la diferencia era «saldo que los clientes
              ya debían». Pero desde que la cifra de arriba cuenta solo el
              efectivo, parte puede ser un préstamo desembolsado POR
              TRANSFERENCIA — que tampoco salió de su mano, pero por otro motivo
              completamente distinto. Meterlas en la misma frase deja al
              prestamista buscando una plata que no falta. */}
          {pd.valorTotal !== pd.efectivoTotal && (
            <p className="text-[10px] mt-2 leading-snug" style={{ color: 'var(--cf-ink-3)' }}>
              {pd.transferenciaTotal > 0 && (
                <>
                  De lo prestado hoy, {formatMoney(pd.transferenciaTotal)} salió{' '}
                  <strong>por transferencia</strong>: no pasó por su fajo.{' '}
                </>
              )}
              {pd.valorTotal - pd.efectivoTotal - (pd.transferenciaTotal || 0) > 0 && (
                <>
                  Otros {formatMoney(pd.valorTotal - pd.efectivoTotal - (pd.transferenciaTotal || 0))} son saldo
                  que los clientes ya debían y quedó dentro de la cartulina nueva.{' '}
                </>
              )}
              La tarjeta <strong>Prestado</strong> de arriba muestra{' '}
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
