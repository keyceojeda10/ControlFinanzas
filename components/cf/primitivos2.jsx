'use client'

// components/cf/primitivos2.jsx — las piezas de 03-COMPONENTES.md que faltaban.
//
// `primitivos.jsx` cubría 12 de las 17. Al cotejar la receta pieza por pieza
// faltaban estas ocho, y no son de adorno: el campo de monto es el corazón de
// crear un préstamo, la tabla es todo el escritorio, y los gráficos son las
// analíticas enteras.
//
// Van en un segundo archivo y no al final del primero por una razón práctica:
// primitivos.jsx ya son 385 líneas y es el archivo que más se abre de todo el
// rediseño. Un archivo de 900 líneas se lee peor que dos de 450.
//
// REGLAS QUE ATRAVIESAN ESTE ARCHIVO, las mismas del primero:
//
//  · Toda barra lleva `flex: none`. Una barra como único hijo encogible de un
//    contenedor de altura fija absorbe el déficit y colapsa a 0px.
//  · Todo número lleva cifras tabulares (clase .cf-num o .cf-fig).
//  · El único encogible permitido dentro de un contenedor de altura fija es un
//    <div> espaciador vacío.
//  · NINGUNA librería de gráficos. Todos los gráficos son divs.

import { useId } from 'react'

/* ══ 6 · Campo de monto (héroe) ══
   El campo más importante de la app: es donde se escribe cuánto se presta y
   cuánto se cobra.

   EL SÍMBOLO VA EN UN SPAN APARTE Y MÁS PEQUEÑO que la cifra. Lo dice la receta
   y tiene motivo: con el `$` del mismo tamaño, en un monto de siete dígitos el
   símbolo compite con el primer dígito y el número se lee mal de un vistazo.

   Lleva el patrón de foco dorado SIEMPRE, no solo al enfocar: en las láminas
   este campo está siempre marcado porque es el único sitio donde hay que
   escribir. Es la única señal de selección del sistema (§6). */
export function CampoMonto({
  valor = '', onCambiar, simbolo = '$', alto = 76, placeholder = '0',
  foco = true, ayuda, style, ...props
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      height: alto, padding: '0 20px',
      background: 'var(--cf-card)',
      borderRadius: 'var(--cf-r-card-sm)',
      border: foco ? '1.5px solid var(--cf-gold)' : '1px solid rgba(20,20,28,.10)',
      boxShadow: foco ? '0 0 0 3px var(--cf-gold-focus)' : 'none',
      flex: 'none',
      ...style,
    }}>
      <span className="cf-fig" aria-hidden style={{
        // ⚠ 25 A PROPÓSITO, y no es una infracción de escala: este es el
        // SÍMBOLO del campo, no un monto. La receta pide que vaya más pequeño
        // que la cifra (que va a 38). Un barrido de 25→26 lo subió y rompió esa
        // relación; la prueba de `componentes-receta` lo cazó.
        fontSize: 25, color: 'var(--cf-ink-3)', flex: 'none',
      }}>{simbolo}</span>
      <input
        {...props}
        value={valor}
        onChange={onCambiar}
        // Sin `onCambiar` esto es un campo de solo lectura, y hay que DECIRLO:
        // React avisa «you provided a value prop without an onChange handler» y
        // el campo queda muerto sin que se note. Pasa de verdad — hay pantallas
        // que enseñan un monto ya calculado con la forma del campo héroe.
        readOnly={!onCambiar}
        placeholder={placeholder}
        // NO `type="number"`: en el móvil rechaza el separador que no coincide
        // con el locale del teléfono, y en Colombia eso deja al usuario sin
        // poder escribir el punto de los miles.
        type="text"
        inputMode="decimal"
        className="cf-fig cf-campo"
        style={{
          flex: 1, minWidth: 0, width: '100%',
          background: 'none', border: 0, outline: 'none', padding: 0,
          fontSize: 38, letterSpacing: '-.035em', color: 'var(--cf-ink)',
        }}
      />
      {ayuda}
    </div>
  )
}

/* ══ 7 · Grupo segmentado ══
   Elegir UNA de 2 a 4. La activa es NEGRA, no dorada: el dorado es para la
   plata, y esto es una preferencia, no un monto. */
export function GrupoSegmentado({ opciones = [], valor, onElegir, alto = 48, style }) {
  return (
    <div role="radiogroup" style={{ display: 'flex', gap: 7, flex: 'none', ...style }}>
      {opciones.map((o) => {
        const activa = o.id === valor
        return (
          <button key={o.id} type="button" role="radio" aria-checked={activa}
            onClick={() => onElegir?.(o.id)}
            style={{
              // `flex: 1` con `minWidth: 0` — sin el minWidth, una opción con
              // texto largo ensancha su columna y el reparto deja de ser igual.
              flex: 1, minWidth: 0,
              height: alto, borderRadius: 'var(--cf-r-control)',
              background: activa ? 'var(--cf-ink)' : 'var(--cf-card)',
              border: activa ? '1px solid var(--cf-ink)' : '1px solid var(--cf-border)',
              color: activa ? 'var(--cf-surface)' : 'var(--cf-ink-2)',
              fontSize: 13, fontWeight: activa ? 700 : 600,
              fontFamily: 'var(--font-manrope), system-ui',
              cursor: 'pointer', padding: '0 10px',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
            {o.nombre}
          </button>
        )
      })}
    </div>
  )
}

/* ══ 7 · Tarjeta de opción ══
   Elegir una de 2 a 4, pero CON EXPLICACIÓN. Se usa cuando la diferencia entre
   las opciones no cabe en una palabra: los modos de interés, los métodos de
   carga, los planes.

   Seleccionada = borde de 1.5px dorado + anillo. Es el mismo par que el foco de
   un campo, y a propósito: el sistema tiene UNA sola señal de selección. */
export function TarjetaOpcion({
  nombre, explicacion, pastilla, seleccionada = false, onElegir, radio = false, children, style,
}) {
  return (
    <button type="button" role="radio" aria-checked={seleccionada} onClick={onElegir}
      style={{
        flex: 1, minWidth: 0, textAlign: 'left',
        padding: radio ? '14px 15px' : '15px 16px',
        borderRadius: 'var(--cf-r-card-sm)',
        background: 'var(--cf-card)',
        border: seleccionada ? '1.5px solid var(--cf-gold)' : '1px solid var(--cf-border)',
        boxShadow: seleccionada ? '0 0 0 3px var(--cf-gold-focus)' : 'none',
        cursor: 'pointer', fontFamily: 'var(--font-manrope), system-ui',
        display: 'flex', alignItems: radio ? 'center' : 'flex-start', gap: 12,
        flexBasis: 0,
        ...style,
      }}>
      {radio && <Radio marcado={seleccionada} />}
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)',
          }}>{nombre}</span>
          {pastilla}
        </span>
        {explicacion && (
          <span style={{ fontSize: 12, color: 'var(--cf-ink-3)', lineHeight: 1.45 }}>
            {explicacion}
          </span>
        )}
        {children}
      </span>
    </button>
  )
}

/** El círculo de 20px de la tarjeta de opción. Marcado = dorado relleno con
    check de 12px en #3A2900; sin marcar = contorno de 1.5px. */
export function Radio({ marcado = false }) {
  return (
    <span aria-hidden style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 20, height: 20, minWidth: 20, aspectRatio: '1', borderRadius: 999, flex: 'none',
      background: marcado ? 'var(--cf-gold)' : 'transparent',
      border: marcado ? 'none' : '1.5px solid rgba(20,20,28,.18)',
    }}>
      {marcado && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="var(--cf-gold-ink)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      )}
    </span>
  )
}

/* ══ 8 · Interruptor ══
   Siempre en una fila con su etiqueta y su explicación a la izquierda, y él a
   la derecha con `flex: none`. Un interruptor suelto no dice qué apaga. */
export function Interruptor({ encendido = false, onCambiar, etiqueta, disabled = false }) {
  return (
    <button type="button" role="switch" aria-checked={encendido} aria-label={etiqueta}
      disabled={disabled}
      onClick={() => onCambiar?.(!encendido)}
      style={{
        position: 'relative', flex: 'none',
        width: 46, height: 28, minWidth: 46, borderRadius: 999,
        background: encendido ? 'var(--cf-gold)' : 'var(--cf-fill-2)',
        border: encendido ? 'none' : '1px solid rgba(20,20,28,.09)',
        padding: 0, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? .5 : 1,
        transition: 'background .16s',
      }}>
      <span aria-hidden style={{
        position: 'absolute', top: 3,
        // `left` y `right` según el estado, como dice la receta, en vez de
        // calcular un `transform`: así la perilla queda a 3px del borde en los
        // dos extremos aunque el borde de 1px solo exista cuando está apagado.
        ...(encendido ? { right: 3 } : { left: 3 }),
        width: 22, height: 22, borderRadius: 999,
        background: '#FFF', boxShadow: '0 1px 3px rgba(20,20,28,.24)',
        transition: 'left .16s, right .16s',
      }} />
    </button>
  )
}

/** La fila completa: etiqueta, explicación e interruptor. Es como se usa
    siempre, así que se ofrece hecha para que nadie la vuelva a montar mal. */
export function FilaInterruptor({ etiqueta, explicacion, encendido, onCambiar, disabled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 'none' }}>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)' }}>{etiqueta}</span>
        {explicacion && (
          <span style={{ fontSize: 12, color: 'var(--cf-ink-3)', lineHeight: 1.45 }}>{explicacion}</span>
        )}
      </span>
      <Interruptor encendido={encendido} onCambiar={onCambiar} etiqueta={etiqueta} disabled={disabled} />
    </div>
  )
}

/* ══ 9 · Barra partida ══
   Dos o tres tramos que suman el total, SIN hueco entre ellos. Se usa cuando la
   pregunta no es «cuánto va» sino «de qué está hecho»: capital contra interés,
   lo cobrado contra lo que falta.

   SIEMPRE con su leyenda debajo. Una barra partida sin leyenda son dos colores
   sin nombre, y el usuario tiene que adivinar cuál es cuál. */
export function BarraPartida({ tramos = [], alto = 12, sobreOscuro = false, leyenda = true, style }) {
  const total = tramos.reduce((s, t) => s + (Number(t.valor) || 0), 0)
  const colores = sobreOscuro ? ['#F3F3F6', '#F5B824', '#8A8E98'] : ['var(--cf-ink)', 'var(--cf-gold)', 'var(--cf-ink-4)']
  const conColor = tramos.map((t, i) => ({ ...t, color: t.color ?? colores[i % colores.length] }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 'none', ...style }}>
      <div style={{
        display: 'flex', height: alto, borderRadius: 999, overflow: 'hidden',
        background: sobreOscuro ? 'rgba(255,255,255,.10)' : 'var(--cf-fill)',
        flex: 'none',
      }}>
        {conColor.map((t, i) => (
          <span key={i} style={{
            width: total > 0 ? `${(t.valor / total) * 100}%` : '0%',
            background: t.color,
            flex: 'none',
          }} />
        ))}
      </div>
      {leyenda && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
          {conColor.map((t, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span aria-hidden style={{
                width: 9, height: 9, borderRadius: 3, background: t.color, flex: 'none',
              }} />
              <span style={{ fontSize: 11.5, color: sobreOscuro ? '#A3A8B2' : 'var(--cf-ink-3)' }}>
                {t.etiqueta}
              </span>
              {t.texto != null && (
                <span className="cf-num" style={{
                  fontSize: 11.5, fontWeight: 700,
                  color: sobreOscuro ? '#F3F3F6' : 'var(--cf-ink)',
                }}>{t.texto}</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ══ 12 · Tabla (escritorio) ══
   Los montos van a la DERECHA con cifras tabulares; el texto a la izquierda.
   La columna de nombre es `flex:1` y las de cifras llevan ancho fijo con
   `flex:none`. Nunca todas flex — si lo son, las cifras bailan al cambiar de
   página y dejan de poder compararse de un vistazo.

   `columnas`: [{ clave, titulo, ancho?, cifra?, barra? }]
     sin `ancho` → flex:1 (la columna de nombre)
     `cifra: true` → alineada a la derecha con .cf-num

   `pie`: el truncado dicho HONESTAMENTE. Ver la nota de `PieTabla`. */
export function Tabla({ columnas = [], filas = [], total, subtotales, pie, alto, style }) {
  const idt = useId()
  const celda = (col) => (col.ancho
    ? { width: col.ancho, minWidth: col.ancho, flex: 'none' }
    : { flex: 1, minWidth: 0 })

  return (
    <div style={{
      background: 'var(--cf-card)',
      border: '1px solid var(--cf-border)',
      borderRadius: 'var(--cf-r-card)',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      ...(alto ? { height: alto } : null),
      ...style,
    }}>
      {/* Cabecera */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        height: 42, padding: '0 24px', flex: 'none',
        background: 'var(--cf-fill)',
        borderTop: '1px solid var(--cf-border)',
        borderBottom: '1px solid var(--cf-border)',
      }}>
        {columnas.map((c) => (
          <span key={c.clave} style={{
            ...celda(c),
            fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase',
            color: 'var(--cf-ink-3)',
            textAlign: c.cifra ? 'right' : 'left',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{c.titulo}</span>
        ))}
      </div>

      {/* Filas. Si vienen agrupadas, cada grupo abre con su subtotal. */}
      {(subtotales ?? [{ filas }]).map((grupo, g) => (
        <div key={g} style={{ display: 'flex', flexDirection: 'column', flex: 'none' }}>
          {grupo.titulo && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
              height: 36, padding: '0 24px', flex: 'none',
              // `--cf-card-alt` YA ES #F9F9F6, el subtotal de la receta. Me habia
              // inventado un `--cf-fill-suave` con fallback: un token nuevo que
              // duplica uno que existe es peor que no tener ninguno.
              background: 'var(--cf-card-alt)',
              borderBottom: '1px solid var(--cf-hairline)',
            }}>
              <span style={{
                fontSize: 11.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase',
                color: 'var(--cf-ink-2)',
              }}>{grupo.titulo}</span>
              {grupo.valor != null && (
                <span className="cf-num" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--cf-ink-2)' }}>
                  {grupo.valor}
                </span>
              )}
            </div>
          )}
          {(grupo.filas ?? []).map((f, i) => (
            <div key={f.id ?? `${idt}-${g}-${i}`}
              onClick={f.onClick}
              style={{
                display: 'flex',
                // Con una celda que baja de renglón, `center` deja las cifras
                // flotando a media altura del nombre: se alinean arriba.
                alignItems: columnas.some((c) => c.envuelve) ? 'flex-start' : 'center',
                gap: 14,
                // `flex: none` — la receta lo marca explícito: «nunca flex:1».
                // Con altura fija en la tabla, unas filas flexibles se reparten
                // el sobrante y todas dejan de medir lo mismo.
                minHeight: 48, flex: 'none', padding: '0 24px',
                borderBottom: '1px solid var(--cf-hairline)',
                // Igual: `--cf-gold-tint-2` es #FDF9EE, «fila de tabla destacada».
                background: f.seleccionada ? 'var(--cf-gold-tint-2)' : 'transparent',
                cursor: f.onClick ? 'pointer' : 'default',
              }}>
              {columnas.map((c) => (
                <span key={c.clave} className={c.cifra ? 'cf-num' : undefined} style={{
                  ...celda(c),
                  fontSize: 13.5,
                  fontWeight: c.fuerte ? 700 : 500,
                  color: c.tono === 'favor' ? 'var(--cf-green-dark)'
                       : c.tono === 'contra' ? 'var(--cf-red-dark)'
                       : 'var(--cf-ink)',
                  textAlign: c.cifra ? 'right' : 'left',
                  // Cuando la celda mezcla barra y número, la receta pide 18px
                  // de separación para que el número no toque la barra.
                  ...(c.barra ? { paddingLeft: 18 } : null),
                  /* ⚠ `envuelve` ES LA EXCEPCIÓN DE LA REGLA DE IDENTIDAD.
                     Lo que identifica a una persona —su nombre, su dirección,
                     su cédula— NUNCA lleva puntos suspensivos: baja de renglón.
                     En la tabla de la cartera salían «Carlos Arte…» y «Carlos
                     chap…», y con varios Carlos eso es no saber de quién se
                     habla. La regla está escrita en el proyecto; aquí faltaba
                     la forma de cumplirla.
                     Va como opción, no por defecto: las columnas de cifras
                     siguen sin envolverse, que es lo que mantiene la fila de
                     una sola línea donde no hace falta. */
                  ...(c.envuelve
                    ? { whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.3, paddingTop: 8, paddingBottom: 8 }
                    : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }),
                }}>{f[c.clave]}</span>
              ))}
            </div>
          ))}
        </div>
      ))}

      {/* El ÚNICO encogible permitido dentro de una tabla de altura fija. */}
      <div style={{ flex: 1, minHeight: 0 }} />

      {total && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          height: 58, padding: '0 24px', flex: 'none',
          background: 'var(--cf-fill)',
        }}>
          {columnas.map((c) => (
            <span key={c.clave} className={c.cifra ? 'cf-num' : undefined} style={{
              ...celda(c),
              fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)',
              textAlign: c.cifra ? 'right' : 'left',
            }}>{total[c.clave]}</span>
          ))}
        </div>
      )}

      {pie}
    </div>
  )
}

/** Pie de tabla con el truncado dicho HONESTAMENTE.
 *
 *  «Ves 10 de los 17 · faltan 7 por $4.826.336».
 *
 *  No es cortesía: si el usuario suma la columna que está viendo, tiene que
 *  poder llegar al total. Un «ver más» pelado deja creyendo que lo que hay en
 *  pantalla ES todo, y con plata eso es una conclusión equivocada. */
export function PieTabla({ visibles, deTotal, faltanMonto, onVerTodos }) {
  const faltan = Math.max(0, (deTotal ?? 0) - (visibles ?? 0))
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
      padding: '12px 24px', flex: 'none',
      borderTop: '1px solid var(--cf-border)',
      background: 'var(--cf-card)',
    }}>
      <span className="cf-num" style={{ fontSize: 12.5, color: 'var(--cf-ink-3)' }}>
        Ves {visibles} de los {deTotal}
        {faltan > 0 && ` · faltan ${faltan}`}
        {faltan > 0 && faltanMonto ? ` por ${faltanMonto}` : ''}
      </span>
      {faltan > 0 && onVerTodos && (
        <button type="button" onClick={onVerTodos} style={{
          background: 'none', border: 0, padding: 0, cursor: 'pointer',
          fontSize: 13, fontWeight: 700, color: 'var(--cf-gold-dark)',
          fontFamily: 'var(--font-manrope), system-ui',
        }}>Ver todos</button>
      )}
    </div>
  )
}

/* ══ 15 · Gráficos ══
   NINGUNA LIBRERÍA. Todos son divs.

   La trampa de estos tres es la misma y la receta la marca en negrita: las
   barras en % necesitan un contenedor de ALTURA RESUELTA. Si el contenedor es
   `flex:1` dentro de una columna saturada, colapsa a 0 y el gráfico desaparece
   sin dejar rastro — no hay error, simplemente no está. Por eso `alto` es un
   número en px y no un porcentaje. */
export function BarrasVerticales({ barras = [], alto = 120, hueco = 6, etiquetas = true, style }) {
  const tope = Math.max(1, ...barras.map((b) => Number(b.valor) || 0))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 'none', ...style }}>
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: hueco,
        height: alto, flex: 'none',   /* altura FIJA, nunca flex:1 */
      }}>
        {barras.map((b, i) => (
          <span key={i} style={{
            flex: 1, minWidth: 0,
            height: `${Math.max(2, ((Number(b.valor) || 0) / tope) * 100)}%`,
            borderRadius: '4px 4px 0 0',
            background: b.tono === 'ok' ? 'var(--cf-green)'
                      : b.tono === 'inactiva' ? 'var(--cf-fill-2)'
                      : 'var(--cf-gold)',
          }} />
        ))}
      </div>
      {etiquetas && (
        <div style={{ display: 'flex', gap: hueco }}>
          {barras.map((b, i) => (
            <span key={i} style={{
              flex: 1, minWidth: 0, textAlign: 'center',
              fontSize: 10, color: 'var(--cf-ink-3)',
              whiteSpace: 'nowrap', overflow: 'hidden',
            }}>{b.etiqueta}</span>
          ))}
        </div>
      )}
    </div>
  )
}

/** Los 12 meses de comportamiento de un cliente.
 *
 *  LA FRASE NO ES OPCIONAL. La receta lo dice: «el texto y el gráfico tienen
 *  que contar la misma historia». Doce barras de colores le dicen al dueño que
 *  hay un patrón, pero no cuál; la frase es la que le dice qué hacer. */
export function BarrasComportamiento({ meses = [], frase, alto = 44, style }) {
  const color = (r) => r === 'bien' ? 'var(--cf-green)'
                     : r === 'tarde' ? 'var(--cf-gold)'
                     : r === 'no' ? 'var(--cf-red)'
                     : 'var(--cf-fill-2)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 'none', ...style }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: alto, flex: 'none' }}>
        {meses.map((m, i) => (
          <span key={i} title={m.nombre} style={{
            flex: 1, minWidth: 0,
            height: m.resultado ? '100%' : '38%',
            borderRadius: '3px 3px 0 0',
            background: color(m.resultado),
          }} />
        ))}
      </div>
      {frase && (
        <span style={{ fontSize: 12.5, color: 'var(--cf-ink-2)', lineHeight: 1.45 }}>{frase}</span>
      )}
    </div>
  )
}

/** Ranking: nombre a la izquierda con ellipsis, pista, cifra a la derecha con
    ancho FIJO para que la columna de cifras quede alineada entre filas. */
export function BarrasHorizontales({ filas = [], anchoPista = 68, anchoCifra = 88, style }) {
  const tope = Math.max(1, ...filas.map((f) => Number(f.valor) || 0))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 'none', ...style }}>
      {filas.map((f, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
          <span style={{
            flex: 1, minWidth: 0, fontSize: 13, color: 'var(--cf-ink)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{f.nombre}</span>
          <span style={{
            width: anchoPista, minWidth: anchoPista, flex: 'none',
            height: 7, borderRadius: 999, background: 'var(--cf-fill)', overflow: 'hidden',
          }}>
            <span style={{
              display: 'block', height: '100%', borderRadius: 999,
              width: `${((Number(f.valor) || 0) / tope) * 100}%`,
              background: f.tono === 'ok' ? 'var(--cf-green)' : f.tono === 'mal' ? 'var(--cf-red)' : 'var(--cf-gold)',
            }} />
          </span>
          <span className="cf-num" style={{
            width: anchoCifra, minWidth: anchoCifra, flex: 'none', textAlign: 'right',
            fontSize: 13, fontWeight: 700, color: 'var(--cf-ink)',
          }}>{f.texto}</span>
        </div>
      ))}
    </div>
  )
}

/* ══ 17 · Esqueleto de carga ══
   Bloques con la FORMA EXACTA de lo que va a llegar, desvaneciéndose hacia
   abajo. NUNCA un spinner dentro del contenido.

   El motivo del desvanecido: sin él, el esqueleto parece contenido de verdad
   que no acaba de cargar. Con él se lee como «esto viene en camino». */
export function Esqueleto({ alto = 96, radio = 'var(--cf-r-card)', style }) {
  return (
    <div aria-hidden style={{
      height: alto, borderRadius: radio, background: 'var(--cf-fill)',
      flex: 'none', ...style,
    }} />
  )
}

/** La pila de esqueletos de una lista de tarjetas.
 *
 *  CADA UNO ES UNA TARJETA BLANCA con bloques grises DENTRO, no una losa gris.
 *  La receta lo dice literal: «bloques […] en #F3F3EF sobre #FFF», y además es
 *  lo que hace que funcione. Yo había puesto losas de #F3F3EF directamente sobre
 *  la superficie, que es #F4F4F1: casi el mismo color, así que no se veían —y de
 *  paso se perdía lo único que importa de un esqueleto, que es tener la FORMA de
 *  lo que viene. Un rectángulo liso no anticipa nada.
 *
 *  Las tres barras de dentro imitan la tarjeta de lista (§3): el nombre, el
 *  rótulo con el monto, y la barra de progreso. */
export function PilaEsqueletos({ cuantos = 3, alto = 104, hueco = 12 }) {
  return (
    <div aria-hidden aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: hueco }}>
      {Array.from({ length: cuantos }, (_, i) => (
        <div key={i} style={{
          height: alto, flex: 'none',
          padding: '15px 16px 15px 19px',
          borderRadius: 'var(--cf-r-card)',
          background: 'var(--cf-card)',
          border: '1px solid var(--cf-border)',
          display: 'flex', alignItems: 'center', gap: 13,
          // El desvanecido hacia abajo: sin él, el esqueleto parece contenido de
          // verdad que no acaba de cargar.
          opacity: 1 - i * (0.62 / Math.max(1, cuantos)),
        }}>
          <Esqueleto alto={40} radio={999} style={{ width: 40, minWidth: 40 }} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <Esqueleto alto={13} radio={7} style={{ width: '58%' }} />
            <Esqueleto alto={19} radio={7} style={{ width: '38%' }} />
            <Esqueleto alto={5} radio={999} />
          </div>
        </div>
      ))}
    </div>
  )
}
