'use client'

// components/pantallas/PortalCliente.jsx — T04-06 acceso · T04-07 su préstamo ·
// T36-01 recuperar la clave.
//
// ══ LA ÚNICA CARA PÚBLICA DEL PRODUCTO ══════════════════════════════════════
//
// «Es la pantalla que más gente ve del producto y la única cara pública», dice el
// pie de T04-06. Un prestamista tiene treinta clientes y cada uno entra aquí; la
// app la ve una persona, esto lo ve el barrio.
//
// Tres cosas que no son de diseño:
//
//   · LO PAGADO ES EL LOGRO. La barra va en verde y mide lo saldado, no lo que
//     falta. Es el mismo número que el dueño ve como «cobrado», leído desde el
//     otro lado. Con la barra midiendo la deuda, quien ha pagado el 70% vería una
//     barra casi vacía por un logro casi completo.
//
//   · SOLO SUS DATOS, y se dice en la puerta: «el deudor desconfía por defecto».
//
//   · «AQUÍ NO SE PAGA NI SE PIDE PLATA», en la pantalla de recuperar. Es defensa
//     contra la estafa: si alguien clona la página para pedir pagos, la original
//     ya dijo que nunca los pide.
//
// ══ EL PIN ═════════════════════════════════════════════════════════════════
//
// Cuatro casillas de 62px porque «se marca con el pulgar, no con precisión». Van
// visibles, como la lámina: es el propio teléfono del cliente y sin ver los
// dígitos no se puede corregir el que falló.
//
// Lo que sí se evita es que el navegador lo GUARDE (`autoComplete="off"`): un PIN
// de cuatro cifras que abre la deuda de una persona no tiene por qué quedarse en
// el gestor de contraseñas de un teléfono que se presta y se pierde. Y el acierto
// lo decide el backend — compararlo aquí sería regalarlo a quien mire el código.

import { PROMESA_DE_PRIVACIDAD, soloDigitos } from '@/lib/adaptadores/portal'

const VERDE_WA = '#25D366'

function Rotulo({ children }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
      textTransform: 'uppercase', color: 'var(--cf-ink-3)',
    }}>{children}</span>
  )
}

/* ── EL LOGO, NO UN SIGNO DE PESOS ──
   Era un circulo dorado con un «$» de texto dentro. Esta es la primera pantalla
   que ve alguien que NO es cliente nuestro: no eligio la app, no la instalo y
   le acaba de llegar un enlace de su prestamista pidiendole el documento. Un
   simbolo de moneda generico —el que usa cualquier pagina de prestamos rapidos—
   es justo lo que no ayuda a que se fie del enlace.
   `/logo-icon.svg` es el mismo archivo que ya usa la pantalla de registro. */
function Moneda({ tamano = 52 }) {
  return (
    <span aria-hidden style={{ display: 'inline-flex', flex: 'none' }}>
      <img src="/logo-icon.svg" alt="" width={tamano} height={tamano} />
    </span>
  )
}

function IconoWhatsApp({ tamano = 17, color = VERDE_WA }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
      <path d="M20 12a8 8 0 01-11.6 7.1L4 20l.9-4.3A8 8 0 1120 12z" />
    </svg>
  )
}

/* ══ T04-06 · Acceso ═══════════════════════════════════════════════════════
   «CONSULTA TU PRÉSTAMO» y debajo con qué: «tu cédula y el PIN que te dio quien te
   prestó. No necesitas descargar nada». Esa última frase quita el miedo a la app
   que hay que instalar, que es lo que hace abandonar a quien entra desde un enlace
   de WhatsApp con el teléfono lleno. */
export function PortalAcceso({
  titulo = 'Consulta tu préstamo',
  ayuda = 'Con tu cédula y el PIN que te dio quien te prestó. No necesitas descargar nada.',
  // El rotulo es prop porque `/api/portal/auth` acepta CEDULA O TELEFONO, y a
  // quien le llega el enlace puede no saber con cual lo registraron. Un campo que
  // dice «Cédula» y acepta el telefono deja fuera a quien no tiene la cedula a
  // mano — que en la calle es la mitad.
  rotuloCedula = 'Cédula',
  cedula, onCedula,
  pin = [], onPin,
  privacidad = PROMESA_DE_PRIVACIDAD,
  error,
  onEntrar, entrando,
  onPedirPin,
}) {
  const puesto = pin.filter((d) => d !== null && d !== undefined && d !== '').length

  return (
    <div style={{
      height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column',
      color: 'var(--cf-ink)',
    }}>
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: '34px 24px 0',
        display: 'flex', flexDirection: 'column', gap: 26,
      }}>
        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Moneda />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <span style={{
              fontFamily: 'var(--font-space-grotesk), system-ui',
              fontSize: 27, fontWeight: 600, lineHeight: 1.12, letterSpacing: '-.025em',
              color: 'var(--cf-ink)',
            }}>{titulo}</span>
            <span style={{ fontSize: 15, lineHeight: 1.45, color: 'var(--cf-ink-2)' }}>{ayuda}</span>
          </div>
        </div>

        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Rotulo>{rotuloCedula}</Rotulo>
            <div style={{
              display: 'flex', alignItems: 'center', height: 56, padding: '0 18px',
              borderRadius: 14, background: 'var(--cf-card)',
              border: '1.5px solid var(--cf-gold)', boxShadow: '0 0 0 3px var(--cf-gold-focus)',
            }}>
              {/* `inputMode=numeric` y no `type=number`: las cédulas se escriben con
                  puntos en unos países y sin ellos en otros, y `type=number`
                  rechaza el separador que no coincide con el locale del teléfono. */}
              <input
                value={cedula ?? ''}
                onChange={(e) => onCedula?.(e.target.value)}
                type="text" inputMode="numeric" autoComplete="off"
                aria-label={`Tu ${String(rotuloCedula).toLowerCase()}`}
                className="cf-num"
                style={{
                  flex: 1, minWidth: 0, border: 0, background: 'none', padding: 0,
                  outline: 'none', font: 'inherit',
                  fontFamily: 'var(--font-space-grotesk), system-ui',
                  fontSize: 19, fontWeight: 500, color: 'var(--cf-ink)',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Rotulo>PIN de 4 dígitos</Rotulo>
            {/* Un solo campo detrás de cuatro casillas: teclear, borrar y pegar
                funcionan como en cualquier campo, y el dibujo sigue siendo el de
                cuatro huecos grandes. Cuatro inputs sincronizados a mano es donde
                se rompe el borrado. */}
            <label style={{ position: 'relative', display: 'flex', gap: 10 }}>
              <input
                value={pin.join('')}
                onChange={(e) => onPin?.(soloDigitos(e.target.value))}
                type="text" inputMode="numeric" autoComplete="off"
                maxLength={4}
                aria-label="Tu PIN de 4 dígitos"
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  opacity: 0, border: 0, padding: 0, margin: 0, cursor: 'pointer',
                }}
              />
              {[0, 1, 2, 3].map((i) => {
                const activa = i === puesto
                return (
                  <span key={i} aria-hidden style={{
                    flex: 1, minWidth: 0, height: 62, borderRadius: 14,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--cf-card)',
                    // La casilla que toca va con el borde más marcado: sin nada
                    // que la señale, cuatro huecos iguales no dicen dónde cae el
                    // siguiente dígito. No lleva anillo dorado porque el dorado de
                    // esta pantalla es «Entrar».
                    border: activa
                      ? '1.5px solid var(--cf-chevron)'
                      : '1px solid var(--cf-border-strong)',
                  }}>
                    <span className="cf-fig" style={{
                      fontFamily: 'var(--font-space-grotesk), system-ui',
                      fontSize: 26, fontWeight: 600, color: 'var(--cf-ink)',
                    }}>{pin[i] ?? ''}</span>
                  </span>
                )
              })}
            </label>
          </div>
        </div>

        {/* QUÉ SE PUEDE VER Y QUÉ NO, en la puerta. El deudor desconfía por
            defecto, y con razón: le están pidiendo la cédula. */}
        {privacidad && (
          <div style={{
            flex: 'none', display: 'flex', gap: 10, alignItems: 'flex-start',
            padding: '14px 16px', borderRadius: 14,
            background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-3)"
              strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
              style={{ flex: 'none', marginTop: 1 }}>
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8.5 11V8a3.5 3.5 0 017 0v3" />
            </svg>
            <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-2)' }}>
              {privacidad}
            </span>
          </div>
        )}

        {/* El error no dice si falló la cédula o el PIN: decirlo confirmaría que
            esa cédula existe, y eso es lo que no puede saberse desde fuera. */}
        {error && (
          <span role="alert" style={{ fontSize: 13, color: 'var(--cf-red-dark)', flex: 'none' }}>
            {error}
          </span>
        )}
      </div>

      <div style={{
        flex: 'none', padding: '14px 24px 26px', display: 'flex', flexDirection: 'column', gap: 11,
      }}>
        <button type="button" onClick={onEntrar} disabled={entrando} style={{
          height: 52, border: 'none', borderRadius: 14,
          background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', font: 'inherit',
          fontSize: 16, fontWeight: 700,
          cursor: entrando ? 'progress' : 'pointer', opacity: entrando ? 0.6 : 1,
        }}>{entrando ? 'Entrando…' : 'Entrar'}</button>

        <span style={{
          fontSize: 13, textAlign: 'center', color: 'var(--cf-ink-3)', lineHeight: 1.45,
        }}>
          ¿No tienes PIN?{' '}
          <button type="button" onClick={onPedirPin} style={{
            border: 0, background: 'none', padding: 0, cursor: 'pointer', font: 'inherit',
            fontSize: 13, fontWeight: 600, color: 'var(--cf-gold-dark)',
          }}>Pídelo por WhatsApp</button>{' '}
          a quien te prestó.
        </span>
      </div>
    </div>
  )
}

/* ══ T04-07 · Su préstamo ══════════════════════════════════════════════════
   TRES PREGUNTAS Y NADA MÁS: cuánto falta, cuándo es la próxima y qué he pagado.
   Ni el interés, ni la tasa, ni cuánto gana quien prestó — nada de eso contesta
   una pregunta que el cliente se esté haciendo delante de la pantalla. */
export function PortalPrestamo({
  cliente, cedula, onSalir,
  deuda, proxima, onAvisar,
  pagosTitulo = 'Tus pagos', pagosCuenta, pagos = [], onTodos,
  prestamista, onEscribir,
}) {
  return (
    <div style={{
      height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column',
      color: 'var(--cf-ink)',
    }}>
      <div style={{
        flex: 'none', padding: '6px 20px 14px', display: 'flex', alignItems: 'center', gap: 11,
      }}>
        {/* `letra` y `radio` se fueron con el «$»: el logo es un SVG, no una
            letra dentro de un círculo. Dejarlos aquí haría creer que la
            cabecera se pinta distinta que la portada, y no. */}
        <Moneda tamano={30} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-.01em' }}>{cliente}</span>
          {cedula && (
            <span className="cf-num" style={{ fontSize: 11, color: 'var(--cf-ink-3)' }}>{cedula}</span>
          )}
        </div>
        {onSalir && (
          <button type="button" onClick={onSalir} style={{
            border: 0, background: 'none', padding: 0, cursor: 'pointer', flex: 'none',
            font: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--cf-ink-3)',
          }}>Salir</button>
        )}
      </div>

      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 20px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {deuda && (
          <div style={{
            flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
            borderRadius: 'var(--cf-r-card)', padding: 20,
            display: 'flex', flexDirection: 'column', gap: 15,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <Rotulo>{deuda.etiqueta}</Rotulo>
                <span className="cf-fig" style={{
                  fontFamily: 'var(--font-space-grotesk), system-ui',
                  fontSize: 36, fontWeight: 600, letterSpacing: '-.035em', lineHeight: 1,
                  color: 'var(--cf-ink)',
                }}>{deuda.falta}</span>
              </div>
              {deuda.mora && (
                <span className="cf-num" style={{
                  display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px',
                  borderRadius: 11, flex: 'none',
                  background: 'var(--cf-red-pill-bg)', border: '1px solid var(--cf-red-pill-border)',
                  fontSize: 11, fontWeight: 700, color: 'var(--cf-red-dark)',
                }}>{deuda.mora}</span>
              )}
            </div>

            {/* VERDE Y MIDE LO PAGADO. Para el deudor lo saldado es el logro. */}
            <div style={{
              height: 8, borderRadius: 999, background: 'var(--cf-fill)', overflow: 'hidden',
              flex: 'none', display: 'flex',
            }}>
              <span style={{
                width: `${Math.max(0, Math.min(100, deuda.progreso ?? 0))}%`, height: 8,
                borderRadius: 999, background: 'var(--cf-green)', flex: 'none',
              }} />
            </div>

            {deuda.resumen && (
              <span className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink-2)' }}>
                Ya pagaste <strong>{deuda.resumen.pagado}</strong> de {deuda.resumen.total}
                {deuda.resumen.cuotas ? ` · ${deuda.resumen.cuotas}` : ''}
              </span>
            )}
          </div>
        )}

        {proxima && (
          <div style={{
            flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
            borderRadius: 'var(--cf-r-card)', padding: 20,
            display: 'flex', flexDirection: 'column', gap: 15,
          }}>
            <Rotulo>{proxima.etiqueta}</Rotulo>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="cf-fig" style={{
                  fontFamily: 'var(--font-space-grotesk), system-ui',
                  fontSize: 26, fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1,
                  color: 'var(--cf-ink)',
                }}>{proxima.monto}</span>
                <span style={{ fontSize: 13, color: 'var(--cf-ink-2)' }}>{proxima.cuando}</span>
              </div>

              {/* «AVISAR» abre el WhatsApp con el mensaje escrito; envía el
                  cliente. Hoy esto se hace igual pero tecleándolo, y NO registra
                  el pago: eso lo hace quien cobra. */}
              {onAvisar && (
                <button type="button" onClick={onAvisar} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, height: 44,
                  padding: '0 15px', borderRadius: 14, flex: 'none', border: 0,
                  background: VERDE_WA, cursor: 'pointer', font: 'inherit',
                }}>
                  <IconoWhatsApp tamano={18} color="#FFFFFF" />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF' }}>Avisar</span>
                </button>
              )}
            </div>
          </div>
        )}

        {pagos.length > 0 && (
          <div style={{
            flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
            borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '17px 20px 13px', gap: 12,
            }}>
              <Rotulo>{pagosTitulo}</Rotulo>
              {pagosCuenta && (
                <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)', flex: 'none' }}>
                  {pagosCuenta}
                </span>
              )}
            </div>
            {pagos.map((p) => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 20px', borderTop: '1px solid var(--cf-hairline)',
              }}>
                <span aria-hidden style={{
                  width: 7, height: 7, borderRadius: 999, flex: 'none',
                  background: p.color === 'oro' ? 'var(--cf-gold)' : 'var(--cf-green)',
                }} />
                <span className="cf-num" style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600 }}>
                  {p.fecha}
                </span>
                <span className="cf-fig" style={{
                  fontFamily: 'var(--font-space-grotesk), system-ui',
                  fontSize: 14, fontWeight: 600, flex: 'none',
                }}>{p.monto}</span>
              </div>
            ))}
            {onTodos && (
              <button type="button" onClick={onTodos} style={{
                width: '100%', padding: '13px 20px', border: 0, background: 'none',
                borderTop: '1px solid var(--cf-hairline)', cursor: 'pointer',
                font: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--cf-gold-dark)',
              }}>Ver todos mis pagos</button>
            )}
          </div>
        )}
      </div>

      {/* QUIÉN LE PRESTÓ, con nombre y salida por WhatsApp. El cliente no conoce
          la app: conoce a la persona. */}
      {prestamista && (
        <div style={{ flex: 'none', padding: '14px 20px 22px' }}>
          <span style={{
            display: 'block', fontSize: 12, textAlign: 'center',
            color: 'var(--cf-ink-3)', lineHeight: 1.45,
          }}>
            Le prestó <strong style={{ color: 'var(--cf-ink)' }}>{prestamista}</strong>
            {onEscribir && (
              <>
                {' · '}
                <button type="button" onClick={onEscribir} style={{
                  border: 0, background: 'none', padding: 0, cursor: 'pointer', font: 'inherit',
                  fontSize: 12, fontWeight: 600, color: 'var(--cf-gold-dark)',
                }}>escribirle por WhatsApp</button>
              </>
            )}
          </span>
        </div>
      )}
    </div>
  )
}

/* ══ T36-01 · Recuperar la clave ═══════════════════════════════════════════
   LA RESPUESTA ES IDÉNTICA EXISTA EL NÚMERO O NO. Si dijera «ese número no está
   registrado», cualquiera podría probar teléfonos hasta averiguar quién le debe a
   quién — que en este negocio pone en riesgo al deudor, no al negocio.

   El componente ni siquiera recibe si el número existe: no puede filtrarlo aunque
   alguien lo intente más adelante.

   Y la última línea es defensa contra la estafa: «aquí no se paga ni se pide
   plata». Si mañana alguien clona esta página para cobrar, la original ya lo dijo. */
export function PortalRecuperar({
  negocio, subtitulo = 'consulta de tu préstamo', onAtras,
  titulo, ayuda, nota,
  prefijo = '+57', numero, onNumero,
  accion = 'Mandarme la clave', onMandar, mandando,
  humana, onEscribir,
  seguridad,
  enviado,
}) {
  return (
    <div style={{
      height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column',
      color: 'var(--cf-ink)', padding: '14px 24px 24px', gap: 18,
    }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
        {onAtras && (
          <button type="button" onClick={onAtras} aria-label="Atrás" style={{
            border: 0, background: 'none', padding: 0, cursor: 'pointer', flex: 'none',
            display: 'inline-flex', alignItems: 'center',
          }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-3)"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)' }}>{negocio}</span>
          <span style={{ fontSize: 11, color: 'var(--cf-ink-3)' }}>{subtitulo}</span>
        </div>
      </div>

      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 11, paddingTop: 8 }}>
        <span style={{
          fontFamily: 'var(--font-space-grotesk), system-ui',
          fontSize: 29, fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1.15,
          color: 'var(--cf-ink)',
        }}>{titulo}</span>
        <span style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--cf-ink-2)' }}>{ayuda}</span>
      </div>

      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
        <Rotulo>Tu número de teléfono</Rotulo>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 11, height: 64, padding: '0 18px',
          borderRadius: 16, background: 'var(--cf-fill)',
          border: '1.5px solid var(--cf-gold)', boxShadow: '0 0 0 3px var(--cf-gold-focus)',
        }}>
          <span className="cf-num" style={{
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 16, fontWeight: 600, color: 'var(--cf-ink-3)', flex: 'none',
          }}>{prefijo}</span>
          <span aria-hidden style={{
            width: 1, height: 26, background: 'var(--cf-border-strong)', flex: 'none',
          }} />
          <input
            value={numero ?? ''}
            onChange={(e) => onNumero?.(e.target.value)}
            type="tel" inputMode="tel" autoComplete="tel"
            aria-label="Tu número de teléfono"
            className="cf-fig"
            style={{
              flex: 1, minWidth: 0, border: 0, background: 'none', padding: 0,
              outline: 'none', font: 'inherit',
              fontFamily: 'var(--font-space-grotesk), system-ui',
              fontSize: 23, fontWeight: 600, color: 'var(--cf-ink)',
            }}
          />
        </div>
      </div>

      {/* LA MISMA FRASE PASE LO QUE PASE. El condicional «si está registrado» es lo
          que impide averiguar quién es cliente de quién probando teléfonos. */}
      {(nota || enviado) && (
        <div style={{
          flex: 'none', display: 'flex', gap: 11, alignItems: 'flex-start',
          padding: '15px 17px', borderRadius: 16,
          background: 'var(--cf-card-alt)', border: '1px solid var(--cf-border)',
        }}>
          <IconoWhatsApp />
          <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--cf-ink-2)' }}>{nota}</span>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0 }} />

      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button type="button" onClick={onMandar} disabled={mandando} style={{
          width: '100%', height: 56, border: 'none', borderRadius: 16,
          background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', font: 'inherit',
          fontSize: 17, fontWeight: 700,
          cursor: mandando ? 'progress' : 'pointer', opacity: mandando ? 0.6 : 1,
        }}>{mandando ? 'Mandando…' : accion}</button>

        {/* LA SALIDA HUMANA, con su nombre. El cliente no conoce «Control
            Finanzas»: conoce a quien le prestó. */}
        {humana && onEscribir && (
          <button type="button" onClick={onEscribir} style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            width: '100%', height: 52, borderRadius: 16, cursor: 'pointer',
            background: 'var(--cf-fill)', border: '1px solid var(--cf-border-strong)',
            font: 'inherit', fontSize: 15, fontWeight: 600, color: 'var(--cf-ink)',
          }}>
            <IconoWhatsApp />
            {humana}
          </button>
        )}

        {seguridad && (
          <span style={{
            fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-3)',
            textAlign: 'center', paddingTop: 2,
          }}>{seguridad}</span>
        )}
      </div>
    </div>
  )
}
