'use client'

import { useState, useEffect } from 'react'
import { useCabecera } from '@/components/armazon/Armazon'
import MedioDePagoGuardado from '@/components/pagos/MedioDePagoGuardado'
import HojaSuscripcion     from '@/components/pagos/HojaSuscripcion'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth }             from '@/hooks/useAuth'
import { SkeletonCard }        from '@/components/ui/Skeleton'
import { PLANES_CONFIG, getPrecioPlan } from '@/lib/planes'
import { formatMoney, getPaymentGateway } from '@/lib/i18n'

/* ══ LO QUE OFRECE CADA PLAN SE DERIVA, NO SE ESCRIBE ════════════════════════
 *
 * Reportado por el dueño el 19 ago 2026: «aquí en cambiar plan aún dice que el
 * plan inicial es hasta 150 clientes cuando lo bajamos a 100».
 *
 * Y este archivo YA importaba `PLANES_CONFIG` —está arriba, línea 8— pero la
 * lista de abajo estaba escrita a mano. Así que el tope se cambió en la fuente
 * de verdad y la pantalla que se lo enseña al cliente ANTES DE COBRARLE siguió
 * prometiendo 150.
 *
 * `lib/planes.js` lo dice en su primera línea: «TODOS los archivos deben
 * importar de aquí en vez de hardcodear límites». Ya había pasado con «hasta 20
 * clientes» y con «30 días de prueba»; esta es la tercera.
 *
 * Solo se escriben a mano las frases que NO son un número del plan —«Control de
 * cartera», «Cierre de caja»—, porque esas no viven en la configuración. */
const EXTRA_POR_PLAN = {
  starter:      ['Dashboard básico'],
  basic:        ['Control de cartera'],
  growth:       ['Cierre de caja'],
  standard:     ['Reportes avanzados'],
  professional: ['Reportes + exportación'],
}

const cuantos = (n, uno, varios) => `${n.toLocaleString('es-CO')} ${n === 1 ? uno : varios}`

const planesBase = ['starter', 'basic', 'growth', 'standard', 'professional'].map((key) => {
  const c = PLANES_CONFIG[key]
  return {
    key,
    nombre: c.nombre,
    ...(key === 'growth' ? { badge: 'Popular' } : {}),
    features: [
      cuantos(c.maxUsuarios, 'usuario', 'usuarios'),
      `Hasta ${c.maxClientes.toLocaleString('es-CO')} clientes`,
      cuantos(c.maxRutas, 'ruta', 'rutas'),
      ...(c.aiMensajesDia > 0 ? [`Lucas IA (${c.aiMensajesDia}/día)`] : []),
      ...(EXTRA_POR_PLAN[key] ?? []),
    ],
  }
})

const planTestBase = { key: 'test', nombre: 'Test', features: ['Solo testing interno', 'NO usar en produccion'] }

const WHATSAPP_SOPORTE = '573011993001'
const whatsappLink = (msg) => `https://wa.me/${WHATSAPP_SOPORTE}?text=${encodeURIComponent(msg)}`

const Spinner = () => (
  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
)

// ── Usage bar ──────────────────────────────────────────────
function UsageBar({ label, usado, limite }) {
  if (!limite || limite <= 0) return null
  const pct = Math.min((usado / limite) * 100, 100)
  const high = pct >= 80

  return (
    <div
      className="flex items-center justify-between gap-4 px-4 py-3"
      style={{ borderBottom: '1px solid var(--cf-border)' }}
    >
      <span className="text-[13px]" style={{ color: 'var(--cf-ink-2)' }}>{label}</span>
      <div className="flex items-center gap-3 flex-1 max-w-[200px]">
        <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: 'var(--cf-fill)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: high ? 'var(--cf-gold-dark)' : 'var(--cf-gold)',
            }}
          />
        </div>
        <span className="text-[12px] font-mono-display font-medium tabular whitespace-nowrap" style={{ color: high ? 'var(--cf-gold-dark)' : 'var(--cf-ink)' }}>
          {usado.toLocaleString('es-CO')}
          <span style={{ color: 'var(--cf-ink-3)' }}> / {limite.toLocaleString('es-CO')}</span>
        </span>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────
export default function PlanPage() {
  useCabecera({ titulo: 'Mi plan' })

  const router = useRouter()
  const searchParams = useSearchParams()
  const { session, loading: authLoading } = useAuth()
  const wompiRetorno = searchParams.get('wompi') === 'retorno'
  /* De vuelta del widget de Wompi: `guardado`, `error` o `no-autorizado`. */
  const medioRetorno = searchParams.get('medio')

  const country = session?.user?.country ?? 'co'
  const esSuperadmin = session?.user?.rol === 'superadmin'
  const planes = planesBase.map(p => ({ ...p, precio: getPrecioPlan(p.key, country) }))
  const planTest = { ...planTestBase, precio: getPrecioPlan('test', country) }

  const [estado,       setEstado]       = useState(null)
  const [uso,          setUso]          = useState(null)
  const [loadEstado,   setLoadEstado]   = useState(true)
  /* ⚠ SUSCRIPCIÓN POR DEFECTO, Y NO ES UN CAPRICHO DE DISEÑO.
   *
   * Medido el 1 sep 2026: de los que pagaron en julio volvió a pagar en agosto
   * el 64 %, y 25 de los 59 negocios que han pagado alguna vez pagaron UNA sola
   * vez. El problema no es que no quieran pagar: es que cada mes hay que
   * acordarse, entrar y volver a pagar. Lo que la mayoría debería elegir tiene
   * que venir elegido.
   *
   * El pago único no desaparece — quien lo quiera lo cambia de un toque. */
  const [modoPago,     setModoPago]     = useState('suscripcion')
  const [periodo,      setPeriodo]      = useState('mensual')
  const [suscribiendo, setSuscribiendo] = useState(null)

  /* ⚠ LA SUSCRIPCIÓN ES MENSUAL, PUNTO. El cobro recurrente repite cada mes; si
     se permitiera trimestral o anual, un cobro anual activaría UN MES, porque
     la referencia que lee el webhook diría «mensual». Es un fallo de dinero, y
     el trimestral y el anual ya se cobran por adelantado, así que no tienen la
     fuga que esto viene a tapar. */
  const gateway = getPaymentGateway(country)
  /* Solo Wompi guarda medio de pago. Donde se cobra por MercadoPago o a mano
     por WhatsApp no hay suscripción que ofrecer, así que ni se enseña. */
  const esSuscripcion = gateway === 'wompi' && modoPago === 'suscripcion'
  const periodoEfectivo = esSuscripcion ? 'mensual' : periodo
  const [descuentoOrg, setDescuentoOrg] = useState(0)
  const [pagando,      setPagando]      = useState(null)
  const [errorPago,    setErrorPago]    = useState(null)

  useEffect(() => {
    if (authLoading) return
    Promise.all([
      fetch('/api/pagos/estado').then(r => r.ok ? r.json() : null),
      fetch('/api/plan/uso').then(r => r.ok ? r.json() : null),
    ]).then(([est, u]) => {
      if (est) { setEstado(est); setDescuentoOrg(est.descuento ?? 0) }
      if (u) setUso(u)
    }).catch(() => {}).finally(() => setLoadEstado(false))
  }, [authLoading])

  const planActual = uso?.plan ?? estado?.plan ?? session?.user?.plan ?? 'starter'
  const tieneRecurrente = estado?.tieneRecurrenteActiva
  const subCancelada = !!estado?.canceladaAt && estado?.tipo === 'recurrente'
  const infoPlan = [...planes, planTest].find(p => p.key === planActual) || planes[0]
  const orgNombre = session?.user?.nombreOrganizacion || session?.user?.name || ''

  // Next plan up for upgrade CTA
  const planIndex = planes.findIndex(p => p.key === planActual)
  const nextPlan = planIndex >= 0 && planIndex < planes.length - 1 ? planes[planIndex + 1] : null

  const formatFecha = (f) => f ? new Date(f).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }) : ''

  // ── Calculo de precios (conservado) ──
  const calcularPrecio = (precioBase) => {
    const meses = periodoEfectivo === 'anual' ? 12 : periodoEfectivo === 'trimestral' ? 3 : 1
    const mesesCobrados = periodoEfectivo === 'anual' ? 10 : meses
    const descuentoPeriodo = periodoEfectivo === 'anual' ? 17 : periodoEfectivo === 'trimestral' ? 10 : 0
    const descuentoFinal = Math.max(descuentoOrg, descuentoPeriodo)
    const total = precioBase * meses
    const conDescuento = periodoEfectivo === 'anual'
      ? precioBase * mesesCobrados
      : Math.round(total * (1 - descuentoFinal / 100))
    const ahorro = total - conDescuento
    return { total, conDescuento, descuentoFinal, meses, ahorro }
  }

  // ── Activar/renovar plan via WhatsApp (MercadoPago desactivado temporalmente) ──
  const activarPlanWA = (planKey) => {
    const info = [...planes, planTest].find(p => p.key === planKey)
    if (!info) return
    const { conDescuento, meses } = calcularPrecio(info.precio)
    const periodoLabel = periodoEfectivo === 'anual' ? 'anual' : periodoEfectivo === 'trimestral' ? 'trimestral' : 'mensual'
    const orgRef = orgNombre ? ` para mi cuenta "${orgNombre}"` : ''
    const msg = `Hola, quiero activar el plan ${info.nombre} (${periodoLabel})${orgRef}. Valor: ${formatMoney(conDescuento)}${meses > 1 ? ` por ${meses} meses` : '/mes'}.`
    window.open(whatsappLink(msg), '_blank', 'noopener,noreferrer')
  }

  const cancelarPlanWA = () => {
    const orgRef = orgNombre ? ` de mi cuenta "${orgNombre}"` : ''
    const msg = `Hola, quiero cancelar la suscripcion${orgRef}.`
    window.open(whatsappLink(msg), '_blank', 'noopener,noreferrer')
  }

  const activarPlanOnline = async (planKey) => {
    setPagando(planKey)
    setErrorPago(null)
    try {
      if (gateway === 'wompi') {
        const res = await fetch('/api/pagos/wompi/crear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: planKey, periodo: periodoEfectivo }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error creando pago')

        const form = document.createElement('form')
        form.method = 'GET'
        form.action = data.checkoutUrl
        const fields = {
          'public-key': data.publicKey,
          currency: data.moneda,
          'amount-in-cents': String(data.montoCentavos),
          reference: data.referencia,
          'signature:integrity': data.firma,
          'redirect-url': data.redirectUrl,
        }
        for (const [name, value] of Object.entries(fields)) {
          const input = document.createElement('input')
          input.type = 'hidden'
          input.name = name
          input.value = value
          form.appendChild(input)
        }
        document.body.appendChild(form)
        form.submit()
        return
      }

      if (gateway === 'mercadopago') {
        const res = await fetch('/api/pagos/crear-preferencia', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: planKey, periodo: periodoEfectivo }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error creando pago')
        window.location.href = data.initPoint
        return
      }

      activarPlanWA(planKey)
    } catch (err) {
      setErrorPago(err.message)
    } finally {
      setPagando(null)
    }
  }

  // ── Loading state ──
  if (authLoading || loadEstado) {
    return (
      <div className="max-w-lg mx-auto space-y-4 pt-6">
        <SkeletonCard /><SkeletonCard />
      </div>
    )
  }

  const esTrial = estado?.estado !== 'activa' || (!tieneRecurrente && !estado?.mercadopagoId)

  return (
    <div className="max-w-lg mx-auto pb-12 space-y-5">

      {/* Titulo y subtitulo, en la cabecera del armazon: salian otra vez justo
          debajo de ella. El «plan» en cursiva dorada se pierde, y esta bien —
          era el UNICO dorado de la pantalla compitiendo con los precios, que
          son lo que de verdad hay que mirar aqui. */}

      {/* ── Banner trial ── */}
      {estado?.enTrial && (
        <div
          className="rounded-[20px] cf-card-shadow px-5 py-4 flex items-start gap-3"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--cf-gold) 12%, transparent) 0%, color-mix(in srgb, var(--cf-gold) 4%, transparent) 100%)',
            border: '1px solid color-mix(in srgb, var(--cf-gold) 25%, transparent)',
          }}
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'color-mix(in srgb, var(--cf-gold) 15%, transparent)' }}>
            <svg className="w-4 h-4" style={{ color: 'var(--cf-gold)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--cf-ink)' }}>
              Prueba gratuita · {estado.diasTrial} {estado.diasTrial === 1 ? 'dia' : 'dias'} restantes
            </p>
            <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: 'var(--cf-ink-3)' }}>
              Tienes acceso completo al plan Empresarial. Al terminar la prueba, tu cuenta pasara al plan {PLANES_CONFIG[estado.planAlTerminar]?.nombre || 'Inicial'}.
            </p>
          </div>
        </div>
      )}

      {/* ── Retorno Wompi ── */}
      {/* ── DE VUELTA DEL WIDGET ─────────────────────────────────────────
          Guardar el medio de pago NO cobra nada: el cobro llega cuando venza el
          plan. Decirlo aquí evita las dos preguntas que si no llegan a soporte:
          «¿ya me cobraron?» y «¿entonces cuándo?». */}
      {medioRetorno && (() => {
        /* Los tres finales posibles dicen cosas MUY distintas —«no te cobramos
           nada», «te estamos cobrando» y «quedó guardado pero el cobro se
           cayó»— y confundirlos genera exactamente las llamadas que este aviso
           viene a evitar. */
        const AVISOS = {
          'guardado': {
            bien: true,
            titulo: 'Medio de pago guardado',
            texto: 'No te cobramos nada ahora. El cobro sale solo el día que venza tu plan, y lo quitas cuando quieras.',
          },
          'cobrando': {
            bien: true,
            titulo: 'Suscripción activada',
            texto: 'Estamos cobrando tu primer mes. En cuanto el banco lo confirme, el plan queda activo; si no se refleja, recarga la página.',
          },
          'guardado-sin-cobro': {
            bien: false,
            titulo: 'Guardamos el medio, pero el primer cobro no pasó',
            texto: 'Tu tarjeta o tu Nequi quedaron guardados. El cobro lo rechazó el banco.',
          },
          'no-autorizado': {
            bien: false,
            titulo: 'Solo el dueño de la cuenta puede hacer esto',
            texto: 'Pídele al dueño que guarde el medio de pago desde su usuario.',
          },
        }
        const a = AVISOS[medioRetorno] ?? {
          bien: false,
          titulo: 'No se pudo guardar el medio de pago',
          texto: 'Vuelve a intentarlo, o escríbenos por WhatsApp y lo dejamos listo.',
        }
        const tono = a.bien ? 'var(--cf-green-dark)' : 'var(--cf-red-dark)'
        const detalle = searchParams.get('detalle')
        return (
          <div className="rounded-[16px] px-4 py-3 flex items-start gap-3" style={{
            background: `color-mix(in srgb, ${tono} 10%, transparent)`,
            border: `1px solid color-mix(in srgb, ${tono} 25%, transparent)`,
          }}>
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke={tono} strokeWidth={2} viewBox="0 0 24 24">
              {a.bien
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 3h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />}
            </svg>
            <div>
              <p className="text-[14px] font-semibold" style={{ color: 'var(--cf-ink)' }}>{a.titulo}</p>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>
                {a.texto}{detalle ? ` (${detalle})` : ''}
              </p>
            </div>
          </div>
        )
      })()}

      {wompiRetorno && (
        <div
          className="rounded-[20px] cf-card-shadow px-5 py-4 flex items-start gap-3"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--cf-green-dark) 12%, transparent) 0%, color-mix(in srgb, var(--cf-green-dark) 4%, transparent) 100%)',
            border: '1px solid color-mix(in srgb, var(--cf-green-dark) 25%, transparent)',
          }}
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'color-mix(in srgb, var(--cf-green-dark) 15%, transparent)' }}>
            <svg className="w-4 h-4" style={{ color: 'var(--cf-green-dark)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--cf-ink)' }}>
              Pago procesado
            </p>
            <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: 'var(--cf-ink-3)' }}>
              Tu pago se está verificando. El plan se activará automáticamente en unos segundos. Si no se refleja, recarga la página.
            </p>
          </div>
        </div>
      )}

      {/* ── Plan Actual card ── */}
      <div
        className="rounded-[20px] cf-card-shadow p-5 relative overflow-hidden"
        style={{
          background: 'var(--cf-card)',
          border: '1px solid var(--cf-border)',
        }}
      >
        {/* Decorative gradient blob */}
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full" style={{
          background: 'radial-gradient(circle, color-mix(in srgb, var(--cf-gold) 8%, transparent) 0%, transparent 70%)',
          transform: 'translate(30%, -30%)',
        }} />

        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-3 font-mono-display" style={{ color: 'var(--cf-gold)' }}>
          Plan actual
        </p>
        <h2 className="text-[32px] font-normal leading-none mb-1 serif" style={{ color: 'var(--cf-ink)' }}>
          {infoPlan.nombre}
        </h2>
        {(() => {
          const cfg = PLANES_CONFIG[planActual] || PLANES_CONFIG.starter
          const limClientes = uso?.clientes?.limite ?? cfg.maxClientes
          const limUsuarios = uso?.usuarios?.limite ?? cfg.maxUsuarios
          return (
            <p className="text-[13px] mb-4" style={{ color: 'var(--cf-ink-3)' }}>
              Hasta {limClientes.toLocaleString('es-CO')} clientes · {limUsuarios} {limUsuarios === 1 ? 'usuario' : 'usuarios'}
            </p>
          )
        })()}

        <div className="flex items-baseline gap-1">
          <span className="text-[32px] font-bold leading-none font-mono-display" style={{ color: 'var(--cf-ink)' }}>
            {formatMoney(infoPlan.precio)}
          </span>
          <span className="text-[12px] font-mono-display" style={{ color: 'var(--cf-ink-3)' }}>/mes</span>
        </div>
      </div>

      {/* ── Vencimiento con barra de progreso ── */}
      {(() => {
        const dias = estado?.diasRestantes ?? 0
        const fechaVenc = estado?.fechaVencimiento || estado?.proximoCobroAt
        const totalDias = 30 // ciclo mensual
        const diasTranscurridos = Math.max(0, totalDias - dias)
        const pctUsado = Math.min((diasTranscurridos / totalDias) * 100, 100)
        const urgente = dias <= 5
        const barColor = urgente ? 'var(--cf-gold-dark)' : 'var(--cf-gold)'

        return (
          <div
            className="rounded-[20px] cf-card-shadow p-5"
            style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] font-mono-display" style={{ color: 'var(--cf-ink-3)' }}>
                {esTrial ? 'Prueba gratuita' : subCancelada ? 'Acceso hasta' : 'Vencimiento'}
              </p>
              {tieneRecurrente && !subCancelada && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{
                  background: 'var(--cf-fill)',
                  border: '1px solid var(--cf-border)',
                  color: 'var(--cf-ink-3)',
                }}>Renovación automática</span>
              )}
            </div>


            <p className="text-[14px] font-medium mb-1" style={{ color: 'var(--cf-ink)' }}>
              {subCancelada
                ? `Cancelada · acceso hasta el ${formatFecha(fechaVenc)}`
                : fechaVenc
                ? `Tu plan ${esTrial ? 'vence' : 'se renueva'} el ${formatFecha(fechaVenc)}`
                : 'Sin fecha de vencimiento'}
            </p>

            {/* Progress bar */}
            <div className="h-[6px] rounded-full overflow-hidden mt-3 mb-2" style={{ background: 'var(--cf-fill)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${100 - pctUsado}%`, background: barColor }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[12px] font-mono-display font-semibold" style={{ color: urgente ? 'var(--cf-gold-dark)' : 'var(--cf-ink)' }}>
                {dias} días restantes
              </span>
              <span className="text-[11px] font-mono-display" style={{ color: 'var(--cf-ink-3)' }}>
                de {totalDias} días
              </span>
            </div>
          </div>
        )
      })()}

      {/* ══ PAGAR ════════════════════════════════════════════════════════
          ⚠ VA ARRIBA, ANTES DEL USO Y SIN NADA QUE DESPLEGAR.
          «El pago es lo primordial, lo que más se tiene que ver, que la gente
          no batalle para pagar el plan» — el dueño, 1 sep 2026. Estaba debajo
          del uso y detrás de un «Cambiar de plan» que había que abrir: para
          pagar tocaba deslizar y adivinar.

          ⚠ Y NO DICE «PAGO ÚNICO». «Esa opción parece como si solamente pagara
          una vez y no tuviera que pagar más nada» — el mismo día. Los dos
          rótulos dicen QUIÉN paga: se cobra solo, o pagas tú. */}
      <div className="rounded-[20px] cf-card-shadow p-4 space-y-3" style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] font-mono-display" style={{ color: 'var(--cf-ink-3)' }}>
          Pagar mi plan
        </p>

        {gateway === 'wompi' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'suscripcion', label: 'Se cobra solo', pie: 'No vuelves a entrar' },
                { key: 'unico',       label: 'Pago yo',       pie: 'Cada vez que venza' },
              ].map(m => {
                const activo = modoPago === m.key
                return (
                  <button
                    key={m.key}
                    onClick={() => setModoPago(m.key)}
                    className="rounded-[12px] px-3 py-2.5 text-left transition-all active:scale-[0.98]"
                    style={activo
                      ? { background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', border: '1px solid var(--cf-gold)' }
                      : { background: 'var(--cf-surface)', color: 'var(--cf-ink-2)', border: '1px solid var(--cf-border)' }}
                  >
                    <span className="block text-[13px] font-semibold">{m.label}</span>
                    <span className="block text-[11px]" style={{ opacity: 0.75 }}>{m.pie}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--cf-ink-3)' }}>
              {esSuscripcion
                ? 'Cada mes se cobra solo a tu tarjeta o a tu Nequi, sin que hagas nada. Lo quitas cuando quieras.'
                : 'El plan se sigue venciendo cada mes. Cada vez que se venza tienes que entrar aquí y pagarlo a mano.'}
            </p>
          </>
        )}

        {/* ⚠ EL PERÍODO VIVE EN LA MISMA TARJETA QUE EL BOTÓN. Estaba abajo,
            entre los planes, y decidía el precio del botón de arriba: se veía
            cambiar la cifra por algo que no se veía.

            Fuera del bloque de Wompi a propósito: en los países de MercadoPago
            y en los de cobro a mano no hay suscripción, pero el trimestral y el
            anual sí existen. */}
        {!esSuscripcion && (
          <div className="flex justify-center">
            <div className="inline-flex rounded-[12px] p-1 overflow-x-auto" style={{ background: 'var(--cf-surface)', border: '1px solid var(--cf-border)' }}>
              {[
                { key: 'mensual', label: 'Mensual' },
                { key: 'trimestral', label: 'Trimestral', badge: '-10%' },
                { key: 'anual', label: 'Anual', badge: '2 gratis' },
              ].map(p => (
                <button
                  key={p.key}
                  onClick={() => setPeriodo(p.key)}
                  className="px-3 py-2 rounded-[8px] text-[12px] font-semibold transition-all flex items-center gap-1 whitespace-nowrap"
                  style={periodo === p.key
                    ? { background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)' }
                    : { color: 'var(--cf-ink-3)' }
                  }
                >
                  {p.label}
                  {p.badge && (
                    <span className="text-[11px] font-bold px-1 py-0.5 rounded-full font-mono-display" style={{
                      background: periodo === p.key ? 'rgba(0,0,0,0.15)' : 'var(--cf-green-dark)',
                      color: periodo === p.key ? 'var(--cf-gold-ink)' : '#fff',
                    }}>{p.badge}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {(() => {
          /* El precio va EN el botón: el que paga tiene que ver cuánto sin
             buscarlo en otra tarjeta. */
          const { conDescuento } = calcularPrecio(infoPlan.precio)
          return (
            <button
              onClick={() => esSuscripcion
                ? setSuscribiendo(planActual)
                : gateway === 'manual' ? activarPlanWA(planActual) : activarPlanOnline(planActual)}
              disabled={pagando === planActual}
              className="w-full h-12 rounded-[12px] text-[14px] font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)' }}
            >
              {pagando === planActual ? (
                <Spinner />
              ) : gateway === 'manual' ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              )}
              {esSuscripcion ? 'Suscribirme' : 'Pagar mi plan'}
              <span className="font-normal font-mono-display" style={{ opacity: 0.8 }}>
                · {formatMoney(conDescuento)}{esSuscripcion ? '/mes' : ''}
              </span>
            </button>
          )
        })()}

        {/* Con qué se cobra solo. Solo sale si hay medio guardado: entonces es
            un dato del pago, no un cartel. */}
        <MedioDePagoGuardado />
      </div>

      {/* ── LOS PLANES, SIEMPRE A LA VISTA ────────────────────────────────
          Estaban detrás de un «Cambiar de plan» que había que pulsar. Quien
          quiere subir de plan es justo quien más quiere pagar: esconderle la
          lista es cobrarle menos. */}
      {(
        <div className="space-y-5 pt-2">
          <div className="text-center">
            <h2 className="text-[20px] font-semibold" style={{ color: 'var(--cf-ink)' }}>
              Cambiar de plan
            </h2>
            <p className="text-[12px] mt-1" style={{ color: 'var(--cf-ink-3)' }}>
              El cambio aplica de una vez.
            </p>
          </div>

          {esSuperadmin && (
            <p className="text-[10px] text-center" style={{ color: 'var(--cf-ink-3)' }}>
              Modo superadmin — plan test disponible
            </p>
          )}

          {/* Plan cards */}
          <div className="space-y-3">
            {(esSuperadmin ? [planTest, ...planes] : planes).map((p) => {
              const esActual = p.key === planActual
              const esTest = p.key === 'test'
              const esRecurrActiva = tieneRecurrente && esActual && !subCancelada
              const { conDescuento, descuentoFinal, meses, ahorro } = calcularPrecio(p.precio)
              const tieneDesc = descuentoFinal > 0

              return (
                <div
                  key={p.key}
                  className="rounded-[12px] p-4 transition-all"
                  style={{
                    background: esActual ? 'color-mix(in srgb, var(--cf-gold) 4%, transparent)' : 'var(--cf-card)',
                    border: esActual
                      ? '1.5px solid color-mix(in srgb, var(--cf-gold) 40%, transparent)'
                      : esTest
                      ? '1px dashed var(--cf-border-strong)'
                      : '1px solid var(--cf-border)',
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold" style={{ color: esActual ? 'var(--cf-gold)' : 'var(--cf-ink)' }}>
                        {p.nombre}
                      </span>
                      {p.badge && (
                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)' }}>
                          {p.badge}
                        </span>
                      )}
                      {esRecurrActiva && (
                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--cf-green-dark)', color: '#fff' }}>
                          Activo
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      {tieneDesc ? (
                        <div>
                          <span className="text-[10px] line-through font-mono-display" style={{ color: 'var(--cf-ink-3)' }}>
                            {formatMoney(p.precio * meses)}
                          </span>
                          <span className="text-[14px] font-bold font-mono-display ml-1" style={{ color: 'var(--cf-ink)' }}>
                            {formatMoney(conDescuento)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[14px] font-bold font-mono-display" style={{ color: 'var(--cf-ink)' }}>
                          {formatMoney(conDescuento)}
                          <span className="text-[10px] font-normal" style={{ color: 'var(--cf-ink-3)' }}>
                            /{meses === 12 ? 'ano' : meses === 3 ? 'trim.' : 'mes'}
                          </span>
                        </span>
                      )}
                      {ahorro > 0 && (
                        <p className="text-[11px] font-mono-display" style={{ color: 'var(--cf-green-dark)' }}>
                          Ahorras {formatMoney(ahorro)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-3">
                    {p.features.map((f, i) => (
                      <span key={i} className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>
                        {f}
                      </span>
                    ))}
                  </div>

                  {esRecurrActiva ? (
                    <div className="h-9 rounded-[12px] flex items-center justify-center text-[12px] font-semibold" style={{
                      background: 'var(--cf-fill)', color: 'var(--cf-green-dark)',
                    }}>
                      Plan actual
                    </div>
                  ) : esActual && periodoEfectivo === 'mensual' && !subCancelada ? (
                    <div className="h-9 rounded-[12px] flex items-center justify-center text-[12px] font-semibold" style={{
                      background: 'var(--cf-fill)', color: 'var(--cf-ink-3)',
                    }}>
                      Plan actual
                    </div>
                  ) : gateway === 'manual' ? (
                    <button
                      onClick={() => activarPlanWA(p.key)}
                      className="w-full h-9 rounded-[12px] text-[12px] font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                      style={{ background: '#25D366', color: '#fff' }}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      {subCancelada && esActual ? 'Renovar' : 'Activar por WhatsApp'}
                    </button>
                  ) : (
                    <button
                      onClick={() => esSuscripcion ? setSuscribiendo(p.key) : activarPlanOnline(p.key)}
                      disabled={pagando === p.key}
                      className="w-full h-9 rounded-[12px] text-[12px] font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-60"
                      style={{ background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)' }}
                    >
                      {pagando === p.key ? (
                        <Spinner />
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      )}
                      {/* El rótulo dice lo que va a pasar. «Pagar» a secas no
                          distingue un cobro que se repite de uno que no, y esa
                          confusión se paga en devoluciones. */}
                      {esSuscripcion ? 'Suscribirme'
                        : subCancelada && esActual ? 'Renovar plan'
                        : meses === 12 ? 'Pagar el año'
                        : meses === 3 ? 'Pagar el trimestre'
                        : 'Pagar un mes'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

        </div>
      )}

      {errorPago && (
        <div className="rounded-[12px] px-4 py-3 text-[12px] font-medium" style={{
          background: 'color-mix(in srgb, var(--cf-red-dark) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--cf-red-dark) 30%, transparent)',
          color: 'var(--cf-red-dark)',
        }}>
          {errorPago}
        </div>
      )}

      {/* ── Uso actual ── */}
      {(() => {
        const cfg = PLANES_CONFIG[planActual] || PLANES_CONFIG.starter
        const u = uso || {
          clientes:      { usado: 0, limite: cfg.maxClientes },
          usuarios:      { usado: 0, limite: cfg.maxUsuarios },
          rutas:         { usado: 0, limite: cfg.maxRutas },
          lucasMensajes: { usado: 0, limite: cfg.aiMensajesDia },
        }
        return (
          <div className="rounded-[20px] cf-card-shadow overflow-hidden" style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] px-4 pt-4 pb-2 font-mono-display" style={{ color: 'var(--cf-ink-3)' }}>
              Uso actual
            </p>
            <UsageBar label="Clientes"   usado={u.clientes.usado}      limite={u.clientes.limite} />
            <UsageBar label="Usuarios"   usado={u.usuarios.usado}      limite={u.usuarios.limite} />
            <UsageBar label="Rutas"      usado={u.rutas.usado}         limite={u.rutas.limite} />
            {u.lucasMensajes.limite > 0 && (
              <UsageBar label="Lucas IA (hoy)" usado={u.lucasMensajes.usado} limite={u.lucasMensajes.limite} />
            )}
          </div>
        )
      })()}

      {tieneRecurrente && !subCancelada && (
        <button
          onClick={cancelarPlanWA}
          className="w-full h-10 rounded-[12px] text-[12px] font-medium flex items-center justify-center gap-1 transition-colors"
          style={{ color: 'var(--cf-red-dark)' }}
        >
          Cancelar suscripción
        </button>
      )}

      {/* ── Support ── */}
      <div className="rounded-[20px] cf-card-shadow p-4 flex items-center gap-3" style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
        <div className="flex-1">
          <p className="text-[12px] font-semibold" style={{ color: 'var(--cf-ink)' }}>Necesitas ayuda?</p>
          <p className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>Te ayudamos por WhatsApp con pagos y planes.</p>
        </div>
        <a
          href={whatsappLink('Hola, necesito ayuda con el pago de mi plan en Control Finanzas.')}
          target="_blank" rel="noopener noreferrer"
          className="shrink-0 h-9 px-3 rounded-[12px] flex items-center gap-1.5 text-[12px] font-semibold transition-all"
          style={{ background: '#25D366', color: '#fff' }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Soporte
        </a>
      </div>

      {suscribiendo && (() => {
        const info = [...planes, planTest].find(x => x.key === suscribiendo)
        if (!info) return null
        return (
          <HojaSuscripcion
            plan={suscribiendo}
            nombre={info.nombre}
            /* ⚠ CON EL DESCUENTO DE LA ORGANIZACIÓN YA APLICADO. El primer
               cobro lo calcula el servidor con ese mismo descuento; enseñar
               aquí el precio de lista sería prometer un número y cobrar otro,
               que es de donde salen las llamadas a soporte. */
            precioMensual={Math.round(info.precio * (1 - descuentoOrg / 100))}
            onCerrar={() => setSuscribiendo(null)}
            onPagoUnico={() => { setModoPago('unico'); setSuscribiendo(null) }}
          />
        )
      })()}
    </div>
  )
}
