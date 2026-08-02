'use client'

// components/pantallas/Cobradores.jsx
// T09-02 cobradores · T09-03 crear cobrador · T36-03 cómo me fue hoy.
//
// ══ CINCO CUENTAS QUE NO PUEDEN COBRAR NADA, Y NADIE LO SABE ════════════════
//
// La cuenta tiene 9 cobradores y 5 sin ruta. Una cuenta sin ruta no puede cobrar
// nada, y hoy no avisa: sale en la misma lista, con el mismo aspecto que las que
// trabajan. Aquí se separan en dos grupos —los que cobran arriba con sus cifras,
// los que no abajo colapsados con un solo botón— y el aviso dorado dice cuántas
// son antes de que haga falta contarlas.
//
// La causa está en el flujo: la ruta NO se asigna al crear el cobrador. Vive en
// `Ruta.cobradorId` y se pone al crear o editar la ruta, en otra pantalla. Por eso
// T09-03 mete la elección de ruta en el mismo formulario.

import { useState } from 'react'
import { BarrasVerticales, FilaInterruptor } from '@/components/cf/primitivos2'

const VERDE = '#12A150'

function Iniciales({ texto, tam = 42, borde }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: tam, height: tam, minWidth: tam, minHeight: tam, flex: 'none',
      borderRadius: 999, background: 'var(--cf-fill)',
      border: borde ? `2px solid ${borde}` : '2px solid var(--cf-border-strong)',
      fontSize: tam >= 42 ? 14 : 12, fontWeight: 700, color: 'var(--cf-ink-2)',
    }}>{texto}</span>
  )
}

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--cf-chevron)"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

function Separador({ children, conteo }) {
  return (
    <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 9, padding: '0 2px' }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
        textTransform: 'uppercase', color: 'var(--cf-ink-3)',
      }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: 'var(--cf-border)' }} />
      {conteo != null && (
        <span className="cf-num" style={{ fontSize: 11, fontWeight: 700, color: 'var(--cf-ink-3)', flex: 'none' }}>
          {conteo}
        </span>
      )}
    </div>
  )
}

function Cifra({ rotulo, valor, tono }) {
  const color = tono === 'ok' ? 'var(--cf-green-dark)'
              : tono === 'malo' ? 'var(--cf-red-dark)'
              : tono === 'entrega' ? 'var(--cf-gold-text)'
              : 'var(--cf-ink)'
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
        textTransform: 'uppercase', color: 'var(--cf-ink-3)',
      }}>{rotulo}</span>
      <span className="cf-fig" style={{ fontSize: 15, color }}>{valor}</span>
    </div>
  )
}

/* ══ T09-02 · Cobradores ═══════════════════════════════════════════════════ */
export function Cobradores({
  resumen, aviso, cobrando = [], sinRuta = [],
  visiblesSinRuta = 2,
  onVolver, onAbrir, onAsignar, onCrear, onRanking,
  crearTexto = 'Crear cobrador',
  vacioTitulo = 'Todavía no tienes cobradores',
  vacioNota = 'Un cobrador entra con su propia clave, ve solo su ruta y registra los cobros desde la calle.',
  // La cabecera es de esta pantalla, no de la pagina. `cabecera={false}` queda
  // por si algun sitio la mete dentro de otra que ya tiene titulo — sin eso
  // saldrian DOS «Cobradores» seguidos, que es lo que me paso al montar caja.
  cabecera = true, alto = '100%',
}) {
  // En el banco la pantalla mide 844 y el boton flota al fondo. En una ruta de
  // verdad la pagina crece con el contenido, y un `absolute` sin ancestro
  // posicionado se pega a la ventana o desaparece: ahi va en el flujo.
  const botonFlotante = alto === '100%'
  const [todosSinRuta, setTodosSinRuta] = useState(false)
  const visibles = todosSinRuta ? sinRuta : sinRuta.slice(0, visiblesSinRuta)
  const ocultos = sinRuta.length - visibles.length

  return (
    <div style={{
      height: alto, minHeight: 0, display: 'flex', flexDirection: 'column',
      color: 'var(--cf-ink)',
    }}>
      <div style={{ flex: 'none', padding: cabecera ? '6px 20px 14px' : '0 0 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {cabecera && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {onVolver && (
            <button type="button" onClick={onVolver} aria-label="Volver" style={{
              background: 'none', border: 0, padding: 0, cursor: 'pointer', flex: 'none',
              display: 'inline-flex',
            }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-2)"
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
            <span style={{
              fontFamily: 'var(--font-space-grotesk), system-ui',
              fontSize: 21, fontWeight: 600, letterSpacing: '-.02em',
            }}>Cobradores</span>
            {/* Las dos cifras juntas —cuántas cuentas y cuántas con ruta— son las
                que hacen evidente el hueco. Cualquiera sola no dice nada. */}
            {resumen && (
              <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{resumen}</span>
            )}
          </div>
        </div>
        )}

        {/* El aviso solo existe si hay cuentas sin ruta, y dice qué hacer con
            ellas: asignar o desactivar. Un aviso sin salida es ruido. */}
        {aviso && (
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-start', flex: 'none',
            padding: '14px 16px', borderRadius: 14,
            background: 'var(--cf-gold-tint-2)', border: '1px solid var(--cf-gold-border)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cf-gold-dark)"
              strokeWidth="2" strokeLinecap="round" style={{ flex: 'none', marginTop: 1 }}>
              <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
            </svg>
            <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--cf-gold-text)', flex: 1 }}>
              <strong>{aviso.texto}</strong> {aviso.resto ?? 'no pueden cobrar nada. Asígnales una o desactívalas.'}
            </span>
          </div>
        )}
      </div>

      <div style={{
        flex: alto === 'auto' ? 'none' : 1, minHeight: 0,
        overflowY: alto === 'auto' ? 'visible' : 'auto',
        padding: cabecera ? '0 20px 96px' : 0,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {/* ── SIN NINGUNA CUENTA TODAVIA ──
            El estado vacio vivia FUERA, en la pagina, y el componente entero
            iba detras de `cobradores.length > 0`. Con cero cuentas —que es como
            empieza todo el mundo— no se montaba: ni cabecera, ni «Crear
            cobrador», ni nada. La pantalla se quedaba literalmente sin titulo.

            Aqui dentro, la cabecera y el boton son los mismos tenga cuentas o
            no, que es lo unico que garantiza que no haya dos versiones de la
            pantalla que se puedan desincronizar. */}
        {cobrando.length === 0 && sinRuta.length === 0 && (
          <div style={{
            padding: '34px 8px', textAlign: 'center',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)' }}>
              {vacioTitulo}
            </span>
            <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--cf-ink-3)' }}>
              {vacioNota}
            </span>
          </div>
        )}

        {cobrando.length > 0 && <Separador>Cobrando hoy</Separador>}

        {cobrando.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onAbrir?.(c)}
            style={{
              flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
              borderRadius: 'var(--cf-r-card)', padding: '18px 20px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', gap: 14,
              textAlign: 'left', font: 'inherit', color: 'inherit', width: '100%',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
              {/* El anillo verde es «está cobrando». Es el único uso de color en
                  la tarjeta y no compite con nada. */}
              <Iniciales texto={c.iniciales} borde={VERDE} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.015em' }}>{c.nombre}</span>
                <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-2)' }}>{c.detalle}</span>
              </div>
              <Chevron />
            </div>

            <div style={{
              display: 'flex', gap: 8, paddingTop: 14,
              borderTop: '1px solid var(--cf-hairline)',
            }}>
              <Cifra rotulo="Hoy" valor={c.hoy} />
              <span style={{ width: 1, flex: 'none', background: 'var(--cf-hairline)' }} />
              <Cifra rotulo="Efectividad" valor={c.efectividad} tono={c.tonoEfectividad} />
              <span style={{ width: 1, flex: 'none', background: 'var(--cf-hairline)' }} />
              {/* «Debe entregar» es EFECTIVO, no lo recogido: lo que entró por
                  transferencia ya está en la cuenta. Ver `entregaEnEfectivo`. */}
              <Cifra rotulo="Debe entregar" valor={c.entrega} tono={c.debeAlgo ? 'entrega' : undefined} />
            </div>
          </button>
        ))}

        {sinRuta.length > 0 && <Separador conteo={sinRuta.length}>Sin ruta</Separador>}

        {sinRuta.length > 0 && (
          <div style={{
            flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
            borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
          }}>
            {visibles.map((c, i) => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
                borderTop: i === 0 ? 'none' : '1px solid var(--cf-hairline)',
              }}>
                {/* Anillo dorado: no está mal, está pendiente. El rojo diría que
                    alguien hizo algo mal y no es el caso. */}
                <Iniciales texto={c.iniciales} tam={34} borde="var(--cf-gold)" />
                <span style={{ fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0 }}>{c.nombre}</span>
                <button type="button" onClick={() => onAsignar?.(c)} style={{
                  background: 'none', border: 0, padding: 0, cursor: 'pointer', flex: 'none',
                  font: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--cf-gold-dark)',
                }}>Asignar</button>
              </div>
            ))}
            {ocultos > 0 && (
              <button type="button" onClick={() => setTodosSinRuta(true)} style={{
                width: '100%', padding: '13px 18px', background: 'none', cursor: 'pointer',
                borderTop: '1px solid var(--cf-hairline)', border: 0,
                borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: 'var(--cf-hairline)',
                font: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--cf-ink-3)',
              }}>Ver las otras {ocultos}</button>
            )}
          </div>
        )}
      </div>

      {(onCrear || onRanking) && (
        <div style={botonFlotante
          ? { position: 'absolute', left: 16, right: 16, bottom: 18 }
          : { flex: 'none', padding: '18px 0 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {onCrear && (
            <button type="button" onClick={onCrear} style={{
              width: '100%', height: 56, border: 'none', borderRadius: 999,
              background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', cursor: 'pointer',
              font: 'inherit', fontSize: 16, fontWeight: 700,
              boxShadow: '0 6px 20px rgba(231,164,0,.32)',
            }}>{crearTexto}</button>
          )}
          {/* EL RANKING NO ES UN BOTON DE PAR A PAR CON «CREAR».
              Iban los dos arriba, uno al lado del otro y del mismo tamaño, y
              en 390px no cabian: el titulo se metia por debajo. Ademas compiten
              — crear un cobrador se hace una vez cada varios meses y mirar el
              ranking es de pasada. Aqui el ranking es una linea. */}
          {onRanking && !botonFlotante && (
            <button type="button" onClick={onRanking} style={{
              width: '100%', height: 40, border: 0, background: 'none',
              cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 700,
              // En tinta y no en oro: el dorado de esta pantalla ya lo llevan
              // el aviso, «Asignar» y «Crear cobrador». Un cuarto dorado no
              // destaca — reparte.
              color: 'var(--cf-ink-2)',
            }}>Ver el ranking</button>
          )}
        </div>
      )}
    </div>
  )
}

/* ══ T09-03 · Crear cobrador ═══════════════════════════════════════════════
   TRES DECISIONES, Y UNA CORRECCIÓN A LA LÁMINA.

   1 · LA RUTA SE ELIGE AQUÍ. Hoy no: la ruta vive en `Ruta.cobradorId` y se
       asigna al crear o editar la ruta, en otra pantalla. Por eso existen las
       cinco cuentas sin ruta. Elegirla aquí son dos llamadas —crear el usuario y
       poner `cobradorId` en la ruta—, pero una sola pantalla para quien la usa.

   2 · LA CLAVE LA GENERA LA APP. La lámina dice «no necesitas crearle una
       contraseña», y el API SÍ exige una (`password` requerido, bcrypt). No se
       puede quitar sin tocar la autenticación. Lo que sí se puede —y es lo que
       resuelve el problema real, que el dueño invente «123456» para todos— es
       generarla aquí y mandarla por WhatsApp. La frase de abajo describe eso.

   3 · EL CORREO NO SE PUEDE QUITAR. La lámina no lo dibuja, pero es el usuario
       con el que el cobrador entra: `email` es único global y NextAuth valida
       contra él. Un formulario sin correo no crea nada.

   PERMISOS: la lámina agrupa «recargos y descuentos» en un interruptor. En el
   código son dos permisos distintos y con riesgo muy distinto: el recargo SUBE la
   deuda, el descuento la BAJA. Juntarlos le daría a alguien de confianza para
   poner moras el poder de perdonar saldo. Van separados. */

const PERMISOS_MINIMOS = [
  { clave: 'crearPrestamos', etiqueta: 'Crear préstamos nuevos' },
  { clave: 'gestionarPrestamos', etiqueta: 'Renovar y aplicar recargos' },
  { clave: 'aplicarDescuentos', etiqueta: 'Aplicar descuentos', riesgo: 'Baja el saldo del préstamo' },
  { clave: 'verCapital', etiqueta: 'Ver la cartera completa' },
]

export function CrearCobrador({
  nombre = '', correo = '', whatsapp = '',
  rutas = [], rutaElegida,
  permisos = {}, opcionesPermisos = PERMISOS_MINIMOS,
  onCampo, onRuta, onPermiso, onCrear, creando = false,
  onVolver,
}) {
  return (
    <div style={{
      // Sin `height: 100%`: scrollea el DOCUMENTO. Ver `SociosReparto.jsx`.
      display: 'flex', flexDirection: 'column',
      color: 'var(--cf-ink)',
    }}>
      <div style={{ flex: 'none', padding: '6px 20px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {onVolver && (
          <button type="button" onClick={onVolver} aria-label="Volver" style={{
            background: 'none', border: 0, padding: 0, cursor: 'pointer', flex: 'none', display: 'inline-flex',
          }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-2)"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
        )}
        <span style={{
          flex: 1, fontFamily: 'var(--font-space-grotesk), system-ui',
          fontSize: 21, fontWeight: 600, letterSpacing: '-.02em',
        }}>Nuevo cobrador</span>
      </div>

      <div style={{
        // Sin scroll propio: el hueco de la pastilla lo pone el armazón y solo
        // llega si scrollea el documento. Ver `SociosReparto.jsx`.
        padding: '0 20px 20px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <Entrada rotulo="Nombre" valor={nombre} foco
          onCambiar={(v) => onCampo?.('nombre', v)} placeholder="Andrés Pérez" />

        <Entrada rotulo="Correo" valor={correo} tipo="email"
          onCambiar={(v) => onCampo?.('correo', v)} placeholder="andres@correo.com"
          ayuda="Es el usuario con el que entra." />

        <Entrada rotulo="WhatsApp" valor={whatsapp} numerica
          onCambiar={(v) => onCampo?.('whatsapp', v)} placeholder="320 771 0942"
          icono={<IconoWA />} />

        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
            textTransform: 'uppercase', color: 'var(--cf-ink-3)',
          }}>Ruta que va a cobrar</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {rutas.map((r) => {
              const activa = r.id === rutaElegida
              return (
                <button key={r.id} type="button" onClick={() => onRuta?.(r.id)} style={{
                  display: 'inline-flex', alignItems: 'center', height: 44, padding: '0 15px',
                  borderRadius: 14, cursor: 'pointer', font: 'inherit', fontSize: 14,
                  background: activa ? 'var(--cf-gold-tint)' : 'var(--cf-card)',
                  border: activa ? '1.5px solid var(--cf-gold)' : '1px solid var(--cf-border)',
                  fontWeight: activa ? 700 : 600,
                  color: activa ? 'var(--cf-gold-text)' : 'var(--cf-ink-2)',
                }}>{r.nombre}</button>
              )
            })}
          </div>
          {/* Sin ruta no puede cobrar. Decirlo aquí, mientras se puede arreglar,
              en vez de en la lista tres semanas después. */}
          {!rutaElegida && rutas.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--cf-ink-3)', lineHeight: 1.4 }}>
              Sin ruta no va a poder cobrar nada.
            </span>
          )}
        </div>

        <div style={{
          flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
        }}>
          <div style={{ padding: '15px 18px 11px' }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
              textTransform: 'uppercase', color: 'var(--cf-ink-3)',
            }}>Qué puede hacer</span>
          </div>

          {/* REGISTRAR COBROS NO ES UN INTERRUPTOR. No existe el permiso: cobrar
              es lo que un cobrador ES. Pintarlo como interruptor encendido sería
              prometer que se puede apagar. */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px',
            borderTop: '1px solid var(--cf-hairline)',
          }}>
            <span style={{ fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0 }}>Registrar cobros</span>
            <span style={{
              flex: 'none', fontSize: 11, fontWeight: 700, letterSpacing: '.04em',
              textTransform: 'uppercase', color: 'var(--cf-green-dark)',
            }}>Siempre</span>
          </div>

          {/* El relleno lo pone quien coloca la fila: `FilaInterruptor` es solo
              etiqueta + interruptor, a propósito. Sin esto el texto arranca
              pegado al borde y la perilla se sale por la derecha.

              Y el comentario va ACÁ ARRIBA, no dentro del `map`: ahí el cuerpo
              tiene que ser UNA sola expresión, y un comentario JSX al lado del
              <div> son dos. Eso dejó el archivo sin compilar. */}
          {opcionesPermisos.map((p) => (
            <div key={p.clave} style={{
              padding: '13px 18px', borderTop: '1px solid var(--cf-hairline)',
            }}>
              <FilaInterruptor
                etiqueta={p.etiqueta}
                explicacion={p.riesgo}
                encendido={Boolean(permisos[p.clave])}
                onCambiar={(v) => onPermiso?.(p.clave, v)}
              />
            </div>
          ))}
        </div>

        {/* Lo que pasa DESPUÉS de pulsar el botón. La clave la genera la app: el
            dueño no la inventa y no la reutiliza entre cobradores. */}
        <div style={{
          flex: 'none', display: 'flex', gap: 10, alignItems: 'flex-start',
          padding: '14px 16px', borderRadius: 14,
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
        }}>
          <IconoWA tam={16} />
          <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-2)' }}>
            Le llega un WhatsApp con el enlace y una clave temporal que genera la app.
            No tienes que inventarle una contraseña.
          </span>
        </div>
      </div>

      <div style={{
        flex: 'none', padding: '14px 20px 22px',
        background: 'var(--cf-card)', borderTop: '1px solid var(--cf-border-strong)',
      }}>
        <button type="button" onClick={onCrear} disabled={creando} style={{
          width: '100%', height: 52, border: 'none', borderRadius: 14,
          background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
          cursor: creando ? 'default' : 'pointer', opacity: creando ? .6 : 1,
          font: 'inherit', fontSize: 16, fontWeight: 700,
        }}>{creando ? 'Creando…' : 'Crear y enviar acceso'}</button>
      </div>
    </div>
  )
}

function IconoWA({ tam = 18 }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="#25D366"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', marginTop: 1 }}>
      <path d="M20 12a8 8 0 01-11.6 7.1L4 20l.9-4.3A8 8 0 1120 12z" />
    </svg>
  )
}

function Entrada({ rotulo, valor, onCambiar, placeholder, foco, numerica, tipo = 'text', icono, ayuda }) {
  const [tocado, setTocado] = useState(false)
  const encendido = foco && !tocado
  return (
    <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
        textTransform: 'uppercase', color: 'var(--cf-ink-3)',
      }}>{rotulo}</span>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, height: 56, padding: '0 16px',
        borderRadius: 14, background: 'var(--cf-card)',
        border: encendido ? '1.5px solid var(--cf-gold)' : '1px solid var(--cf-border-strong)',
        boxShadow: encendido ? '0 0 0 3px var(--cf-gold-focus)' : 'none',
      }}>
        <input
          type={tipo}
          inputMode={numerica ? 'tel' : undefined}
          value={valor}
          placeholder={placeholder}
          onFocus={() => setTocado(true)}
          onChange={(e) => onCambiar?.(e.target.value)}
          className={numerica ? 'cf-num' : undefined}
          style={{
            flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent',
            font: 'inherit', fontSize: 17, fontWeight: numerica ? 500 : 600, color: 'var(--cf-ink)',
            fontFamily: numerica ? 'var(--font-space-grotesk), system-ui' : 'inherit',
          }}
        />
        {icono}
      </div>
      {ayuda && <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{ayuda}</span>}
    </div>
  )
}

/* ══ T36-03 · Cómo me fue hoy (cobrador) ═══════════════════════════════════
   LA PANTALLA QUE HACE QUE VALGA LA PENA REGISTRAR.

   Los 8 cobradores de la cuenta marcan $0 recogido en 26 días. Si registrar solo
   sirve para que el jefe vigile, nadie registra. Esta pantalla le devuelve algo a
   cambio: su porcentaje, su mejor día de la semana, y sobre todo CUÁNTO TIENE QUE
   ENTREGAR EN EFECTIVO —separando lo que entró por transferencia—, que es la
   cuenta que hoy hace de memoria y por la que se pelea al final del día.

   Y los que faltaron llevan EL MOTIVO. «No pagó» es una acusación; «no estaba en
   la casa» es un dato, y mañana arrancan de primeros. El pendiente no se pierde,
   se reprograma. */
export function MiDia({
  cobrador, ruta, fecha, iniciales,
  recogido, deEsperado, porcentaje, barra = 0, clientes,
  entrega, entregaDetalle, onEntregar,
  semana, fraseSemana,
  faltaron = [], faltaronTotal, notaFaltaron = 'Mañana arrancan de primeros en tu recorrido.',
}) {
  return (
    <div style={{
      // Sin `height: 100%`: scrollea el DOCUMENTO. Ver `SociosReparto.jsx`.
      display: 'flex', flexDirection: 'column',
      color: 'var(--cf-ink)',
    }}>
      <div style={{ flex: 'none', padding: '6px 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 38, height: 38, minWidth: 38, flex: 'none', borderRadius: 999,
          background: 'var(--cf-card)', border: '2px solid var(--cf-gold)',
          fontSize: 13, fontWeight: 700, color: 'var(--cf-ink-2)',
        }}>{iniciales}</span>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 19, fontWeight: 600, letterSpacing: '-.02em',
          }}>Cómo me fue hoy</span>
          <span className="cf-num" style={{ fontSize: 11, color: 'var(--cf-ink-3)' }}>
            {[cobrador, ruta, fecha].filter(Boolean).join(' · ')}
          </span>
        </div>
      </div>

      <div style={{
        // Sin scroll propio: el hueco de la pastilla lo pone el armazón y solo
        // llega si scrollea el documento. Ver `SociosReparto.jsx`.
        padding: '0 20px 20px',
        display: 'flex', flexDirection: 'column', gap: 11,
      }}>
        {/* El bloque oscuro es SU cifra, no la del negocio: lo que él recogió.
            Los literales van en crudo porque este bloque es oscuro siempre,
            independientemente del tema de la app. */}
        <div style={{
          flex: 'none', background: '#15161A', borderRadius: 20, padding: '19px 21px',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
            textTransform: 'uppercase', color: '#A3A8B2',
          }}>Recogiste hoy</span>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <span className="cf-fig" style={{ fontSize: 36, letterSpacing: '-.035em', color: '#F3F3F6' }}>
              {recogido}
            </span>
            {(deEsperado || porcentaje) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end', flex: 'none' }}>
                {deEsperado && <span style={{ fontSize: 11, color: '#8A8E98' }}>{deEsperado}</span>}
                {porcentaje && (
                  <span className="cf-fig" style={{ fontSize: 17, color: '#2FBE6A' }}>{porcentaje}</span>
                )}
              </div>
            )}
          </div>

          <div style={{
            display: 'flex', height: 11, borderRadius: 999, overflow: 'hidden',
            background: 'rgba(255,255,255,.12)', flex: 'none',
          }}>
            <span style={{
              width: `${Math.max(0, Math.min(100, barra))}%`, background: '#2FBE6A', flex: 'none',
            }} />
          </div>

          {clientes && (
            <span className="cf-num" style={{ fontSize: 13, color: '#A3A8B2' }}>{clientes}</span>
          )}
        </div>

        {/* LA CIFRA POR LA QUE SE PELEA. Es el único dorado de la pantalla. */}
        <div style={{
          flex: 'none', background: 'var(--cf-card)', border: '1.5px solid var(--cf-gold)',
          borderRadius: 'var(--cf-r-card)', padding: '17px 19px',
          display: 'flex', alignItems: 'center', gap: 14,
          boxShadow: '0 0 0 3px var(--cf-gold-focus)',
        }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
              textTransform: 'uppercase', color: 'var(--cf-ink-3)',
            }}>Le tienes que entregar</span>
            <span className="cf-fig" style={{ fontSize: 25, letterSpacing: '-.03em' }}>{entrega}</span>
            {/* Por qué no entrega todo lo que recogió. Sin esta línea la cifra
                parece un descuadre. */}
            {entregaDetalle && (
              <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-2)' }}>{entregaDetalle}</span>
            )}
          </div>
          {onEntregar && (
            <button type="button" onClick={onEntregar} style={{
              display: 'inline-flex', alignItems: 'center', height: 42, padding: '0 15px',
              borderRadius: 13, border: 0, cursor: 'pointer', flex: 'none',
              background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
              font: 'inherit', fontSize: 14, fontWeight: 700,
            }}>Entregar</button>
          )}
        </div>

        {semana?.length > 0 && (
          <div style={{
            flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
            borderRadius: 'var(--cf-r-card)', padding: '16px 19px',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
              textTransform: 'uppercase', color: 'var(--cf-ink-3)',
            }}>Tu semana</span>
            <BarrasVerticales barras={semana} alto={62} hueco={7} />
            {fraseSemana && (
              <span className="cf-num" style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-2)' }}>
                {fraseSemana}
              </span>
            )}
          </div>
        )}

        {faltaron.length > 0 && (
          <div style={{
            flex: 1, minHeight: 0, background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
            borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, padding: '15px 19px 11px',
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
                textTransform: 'uppercase', color: 'var(--cf-ink-3)',
              }}>{faltaron.length === 1 ? 'El que faltó' : `Los ${faltaron.length} que faltaron`}</span>
              {faltaronTotal && (
                <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)', flex: 'none' }}>
                  {faltaronTotal}
                </span>
              )}
            </div>

            {faltaron.map((f) => (
              <div key={f.id} style={{
                flex: 'none', display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 19px', borderTop: '1px solid var(--cf-hairline)',
              }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, minWidth: 32, flex: 'none', borderRadius: 999,
                  background: 'var(--cf-fill)', fontSize: 12, fontWeight: 700, color: 'var(--cf-ink-2)',
                }}>{f.iniciales}</span>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{f.nombre}</span>
                  {/* EL MOTIVO. «No pagó» acusa; «no estaba en la casa» informa. */}
                  {f.motivo && (
                    <span style={{ fontSize: 11, color: 'var(--cf-ink-3)' }}>{f.motivo}</span>
                  )}
                </div>
                <span className="cf-fig" style={{ fontSize: 14, flex: 'none' }}>{f.monto}</span>
              </div>
            ))}

            {notaFaltaron && (
              <div style={{
                flex: 1, minHeight: 0, display: 'flex', alignItems: 'center',
                padding: '13px 19px', borderTop: '1px solid var(--cf-hairline)',
              }}>
                <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-2)' }}>{notaFaltaron}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
