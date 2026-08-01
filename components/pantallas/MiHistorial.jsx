'use client'

// components/pantallas/MiHistorial.jsx — T36-02 historial completo del cliente.
//
// ══ LA CIFRA GRANDE ES LO QUE YA PAGÓ, NO LO QUE DEBE ══════════════════════
//
// Es su portal. El cliente entra a comprobar que sus pagos están registrados, no
// a que le recuerden cuánto falta —eso ya lo sabe—. Abrir con la deuda es
// innecesariamente hostil en la única pantalla del sistema escrita para alguien
// QUE NO CONFÍA DEL TODO en quien se la muestra.
//
// Va en `PortalCliente` conceptualmente, pero en archivo aparte: aquel ya tiene
// 549 líneas con tres pantallas dentro.
//
// ══ CADA LÍNEA SE TIENE QUE PODER COMPARAR CON LA DEL COBRADOR ═════════════
//
// Medio de pago y saldo que quedó, en el mismo orden que la ficha del prestamista
// (turno 11). Si el cliente pone su pantalla al lado de la del cobrador, las dos
// tienen que decir lo mismo en el mismo sitio. Ese es el trabajo de esta
// pantalla: que la discusión se acabe mirando, no discutiendo.
//
// Los literales oscuros van en crudo. Esta pantalla es oscura SIEMPRE,
// independientemente del tema de la app: dentro no manda el tema, manda que el
// fondo es negro.

export function MiHistorial({
  titulo = 'Todo lo que he pagado', subtitulo,
  pagado, falta, porcentaje = 0, resumen,
  pagos = [], totalPagos, ocultos = 0,
  prestamista,
  onVolver, onDescargar, onRecibo, onVerTodos,
}) {
  return (
    <div style={{
      height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column',
      background: '#15161A', color: '#F3F3F6',
    }}>
      <div style={{ flex: 'none', padding: '6px 22px 13px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {onVolver && (
          <button type="button" onClick={onVolver} aria-label="Volver" style={{
            background: 'none', border: 0, padding: 0, cursor: 'pointer', flex: 'none', display: 'inline-flex',
          }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#A3A8B2"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#F3F3F6' }}>{titulo}</span>
          {subtitulo && (
            <span className="cf-num" style={{ fontSize: 11, color: '#8A8E98' }}>{subtitulo}</span>
          )}
        </div>
        {onDescargar && (
          <button type="button" onClick={onDescargar} aria-label="Descargar" style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 38, height: 38, minWidth: 38, flex: 'none', borderRadius: 12,
            background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)',
            cursor: 'pointer', padding: 0,
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#F3F3F6"
              strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4v11M8 12l4 4 4-4M5 20h14" />
            </svg>
          </button>
        )}
      </div>

      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 22px 22px',
        display: 'flex', flexDirection: 'column', gap: 11,
      }}>
        <div style={{
          flex: 'none', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 20, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 13,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
                textTransform: 'uppercase', color: '#8A8E98',
              }}>Ya has pagado</span>
              {/* En verde y a 30px. Lo que falta va al lado, mas pequeno y en
                  blanco: existe, pero no es lo primero que se lee. */}
              <span className="cf-fig" style={{ fontSize: 30, letterSpacing: '-.035em', color: '#2FBE6A' }}>
                {pagado}
              </span>
            </div>
            {falta && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flex: 'none' }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
                  textTransform: 'uppercase', color: '#8A8E98',
                }}>Te falta</span>
                <span className="cf-fig" style={{ fontSize: 19, letterSpacing: '-.025em', color: '#F3F3F6' }}>
                  {falta}
                </span>
              </div>
            )}
          </div>

          <div style={{
            display: 'flex', height: 11, borderRadius: 999, overflow: 'hidden',
            background: 'rgba(255,255,255,.12)', flex: 'none',
          }}>
            <span style={{
              width: `${Math.max(0, Math.min(100, porcentaje))}%`,
              background: '#2FBE6A', flex: 'none',
            }} />
          </div>

          {resumen && (
            <span className="cf-num" style={{ fontSize: 13, color: '#A3A8B2' }}>{resumen}</span>
          )}
        </div>

        <div style={{
          flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, padding: '0 2px',
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
            textTransform: 'uppercase', color: '#8A8E98',
          }}>Cada pago que has hecho</span>
          {totalPagos && (
            <span className="cf-num" style={{ fontSize: 11, color: '#8A8E98', flex: 'none' }}>{totalPagos}</span>
          )}
        </div>

        <div style={{
          flex: 1, minHeight: 0, background: 'rgba(255,255,255,.04)',
          border: '1px solid rgba(255,255,255,.09)', borderRadius: 18,
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          {pagos.map((p, i) => (
            <div key={p.id ?? i} style={{
              flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,.07)',
            }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#F3F3F6' }}>{p.fecha}</span>
                {/* Medio de pago y saldo que quedo, en el mismo orden que en la
                    ficha del prestamista: las dos se tienen que poder comparar. */}
                {p.detalle && (
                  <span className="cf-num" style={{ fontSize: 11, color: '#8A8E98' }}>{p.detalle}</span>
                )}
              </div>
              <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
                <span className="cf-fig" style={{ fontSize: 15, color: '#2FBE6A' }}>{p.monto}</span>
                {/* El recibo COMO VISTA existe hoy: es la fila del pago abierta.
                    Lo que no existe es el numero impreso — ver `Recibo.jsx`. */}
                {onRecibo && (
                  <button type="button" onClick={() => onRecibo(p)} style={{
                    background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit',
                    fontSize: 10, fontWeight: 700, color: '#F5B824', letterSpacing: '.04em',
                  }}>RECIBO</button>
                )}
              </div>
            </div>
          ))}

          <div style={{ flex: 1, minHeight: 0 }} />

          {ocultos > 0 && onVerTodos && (
            <button type="button" onClick={onVerTodos} style={{
              flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '12px 16px', background: 'none', cursor: 'pointer', font: 'inherit',
              border: 0, borderTopWidth: 1, borderTopStyle: 'solid',
              borderTopColor: 'rgba(255,255,255,.07)',
              fontSize: 13, fontWeight: 600, color: '#F5B824',
            }}>Ver los otros {ocultos} pagos</button>
          )}
        </div>

        {/* Como reclamar. Con el recibo en la mano y A LA PERSONA: no hay
            formulario ni soporte al que escribir, y prometer uno seria peor. */}
        <div style={{
          flex: 'none', display: 'flex', gap: 10, alignItems: 'flex-start',
          padding: '14px 16px', borderRadius: 16,
          background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A8E98"
            strokeWidth="2" strokeLinecap="round" style={{ flex: 'none', marginTop: 1 }}>
            <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
          </svg>
          <span style={{ fontSize: 12, lineHeight: 1.45, color: '#A3A8B2' }}>
            Si algún pago no aparece o el monto no cuadra, muéstrale tu recibo
            {prestamista ? ` a ${prestamista}` : ' a quien te cobra'}. Cada pago tiene el suyo.
          </span>
        </div>
      </div>
    </div>
  )
}
