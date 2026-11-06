// components/tarjeta/TarjetaCliente.jsx — LA CARTULINA, EN EL CELULAR DEL CLIENTE.
//
// Se pinta en el servidor, sin sesión ni hooks de la app. Tres preguntas: cuánto me
// falta, cuándo me toca y qué he pagado. Va a nombre de quien presta: el software
// sale solo al pie, diciendo lo que es.

import { formatMoney, formatFechaCorta, formatFechaCalendario } from '@/lib/i18n'
import AvisarPago from '@/components/tarjeta/AvisarPago'

/** Los que se ven de entrada; el resto, tras «Ver todos». */
const PAGOS_A_LA_VISTA = 10

const CAJA = {
  background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
  borderRadius: 'var(--cf-r-card)',
}
const ROTULO = {
  fontSize: 11, fontWeight: 800, letterSpacing: '.07em',
  textTransform: 'uppercase', color: 'var(--cf-ink-3)',
}
const CIFRA = { fontFamily: 'var(--font-space-grotesk), system-ui', fontWeight: 600 }

function FilaPago({ p, country, timezone }) {
  const detalle = [p.medio, p.recibio ? `recibió ${p.recibio}` : null].filter(Boolean).join(' · ')
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      padding: '12px 20px', borderTop: '1px solid var(--cf-hairline)',
    }}>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="cf-num" style={{ fontSize: 14, fontWeight: 600 }}>
          {formatFechaCorta(p.fecha, country, timezone)}
        </span>
        <span style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--cf-ink-3)' }}>
          {[p.signo ? p.titulo : null, detalle].filter(Boolean).join(' · ')}
        </span>
      </div>
      <span className="cf-fig" style={{ ...CIFRA, fontSize: 15, letterSpacing: '-.02em', flex: 'none' }}>
        {p.signo}{formatMoney(p.monto, country)}
      </span>
    </div>
  )
}

function Credito({ p, country, timezone, ocultarSaldo }) {
  const aLaVista = p.pagos.slice(0, PAGOS_A_LA_VISTA)
  const resto = p.pagos.slice(PAGOS_A_LA_VISTA)

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {p.referencia && <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{p.referencia}</h2>}

      <div style={{ ...CAJA, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {p.pagado ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={ROTULO}>Tu crédito</span>
            <span style={{ fontSize: 19, fontWeight: 700, color: 'var(--cf-green-dark, var(--cf-green))' }}>Pagado</span>
          </div>
        ) : !ocultarSaldo && (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={ROTULO}>Te falta pagar</span>
                <span data-tarjeta="saldo" className="cf-fig" style={{ ...CIFRA, fontSize: 34, letterSpacing: '-.035em', lineHeight: 1 }}>
                  {formatMoney(p.saldo, country)}
                </span>
              </div>
              {p.diasMora > 0 && (
                <span className="cf-num" style={{
                  display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px', borderRadius: 11,
                  background: 'var(--cf-red-pill-bg)', border: '1px solid var(--cf-red-pill-border)',
                  fontSize: 11, fontWeight: 700, color: 'var(--cf-red-dark)',
                }}>{p.diasMora === 1 ? '1 día de atraso' : `${p.diasMora} días de atraso`}</span>
              )}
            </div>
            {/* VERDE Y MIDE LO PAGADO: para el deudor lo saldado es el logro. */}
            <div style={{ height: 8, borderRadius: 999, background: 'var(--cf-fill)', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.max(0, Math.min(100, p.porcentaje ?? 0))}%`, height: 8,
                borderRadius: 999, background: 'var(--cf-green)',
              }} />
            </div>
          </>
        )}
        <span className="cf-num" style={{ fontSize: 14, color: 'var(--cf-ink-2)' }}>
          Ya pagaste <strong data-tarjeta="pagado" style={{ color: 'var(--cf-ink)' }}>{formatMoney(p.yaPagado, country)}</strong>
        </span>
      </div>

      {p.proxima && (
        <div style={{ ...CAJA, padding: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={ROTULO}>Tu próxima cuota</span>
          {p.proxima.monto > 0 && (
            <span data-tarjeta="cuota" className="cf-fig" style={{ ...CIFRA, fontSize: 26, letterSpacing: '-.03em', lineHeight: 1 }}>
              {formatMoney(p.proxima.monto, country)}
            </span>
          )}
          {p.proxima.fecha && (
            <span className="cf-num" style={{ fontSize: 14, color: 'var(--cf-ink-2)' }}>
              {formatFechaCalendario(p.proxima.fecha, country)}
            </span>
          )}
        </div>
      )}

      <div style={{ ...CAJA, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px 12px' }}>
          <span style={ROTULO}>Tus pagos</span>
          <span className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>{p.pagos.length}</span>
        </div>
        {p.pagos.length === 0 && (
          <p style={{ margin: 0, padding: '12px 20px 16px', borderTop: '1px solid var(--cf-hairline)', fontSize: 14, color: 'var(--cf-ink-2)' }}>
            Todavía no hay pagos registrados.
          </p>
        )}
        {aLaVista.map((x) => <FilaPago key={x.id} p={x} country={country} timezone={timezone} />)}
        {resto.length > 0 && (
          <details>
            <summary style={{
              padding: '14px 20px', borderTop: '1px solid var(--cf-hairline)', cursor: 'pointer',
              fontSize: 14, fontWeight: 700, color: 'var(--cf-gold-dark)',
            }}>Ver todos mis pagos</summary>
            {resto.map((x) => <FilaPago key={x.id} p={x} country={country} timezone={timezone} />)}
          </details>
        )}
      </div>
    </section>
  )
}

export default function TarjetaCliente({ tarjeta, token }) {
  const { negocio, nombre, country, timezone, ocultarSaldo, prestamos, ejemplo } = tarjeta
  const hayVivo = prestamos.some((p) => !p.pagado)

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--cf-surface)', color: 'var(--cf-ink)' }}>
      <div style={{
        maxWidth: 480, margin: '0 auto', padding: '20px 16px 28px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {ejemplo && (
          <p style={{
            margin: 0, padding: '10px 14px', borderRadius: 'var(--cf-r-control)',
            background: 'var(--cf-gold-tint)', color: 'var(--cf-ink)', fontSize: 13, lineHeight: 1.4,
          }}>Ejemplo con datos inventados. Así verían su tarjeta tus clientes.</p>
        )}

        <header style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span data-tarjeta="negocio" style={{ fontSize: 16, fontWeight: 700, overflowWrap: 'anywhere' }}>{negocio}</span>
          {nombre && <span style={{ fontSize: 14, color: 'var(--cf-ink-2)' }}>Hola, {nombre}</span>}
        </header>

        {prestamos.length === 0 && (
          <p style={{ ...CAJA, margin: 0, padding: 20, fontSize: 14, color: 'var(--cf-ink-2)' }}>
            No tienes créditos activos en este momento.
          </p>
        )}
        {prestamos.map((p) => (
          <Credito key={p.id} p={p} country={country} timezone={timezone} ocultarSaldo={ocultarSaldo} />
        ))}

        {hayVivo && <AvisarPago token={token} negocio={negocio} />}

        <footer style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4, textAlign: 'center' }}>
          {/* Defensa contra la estafa: si alguien clona esto para pedir plata, la
              original ya dijo que nunca la pide. */}
          <span style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--cf-ink-2)' }}>
            Aquí no se paga ni se pide plata.
          </span>
          <span style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--cf-ink-3)' }}>
            Software de gestión: Control Finanzas · no presta dinero ni realiza cobros
          </span>
        </footer>
      </div>
    </main>
  )
}
