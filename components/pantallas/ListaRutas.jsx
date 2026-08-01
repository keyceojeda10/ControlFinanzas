'use client'

// components/pantallas/ListaRutas.jsx — Lámina T27-01, «lista de rutas · solo hoy».
//
// DOS CIFRAS GRANDES EN VEZ DE CINCO CHICAS. El pie de la lámina:
//
//   «Dos cifras grandes en vez de cinco chicas: recaudado y falta. "Falta"
//    sustituye a "de $145.000 esperados" porque es la resta que el cobrador
//    hacía de cabeza. El porcentaje pasa a la barra —que ya lo dice— y libera un
//    hueco. Prestado y Con intereses desaparecen de aquí. Las rutas sin
//    actividad se colapsan a una fila: no tienen nada de hoy que contar.»
//
// De ahí las tres cosas que cambian respecto a lo que yo tenía:
//
//  1 · FALTA en vez de «de $X esperados». No es un cambio de palabras: la resta
//      ya está hecha. Antes el cobrador leía «$34.500 de $128.500» y calculaba
//      $94.000 de cabeza, cada vez, para saber cuánto le queda por levantar.
//  2 · FUERA EL PORCENTAJE en texto. La barra ya lo dice, y el hueco que libera
//      es el que necesita la segunda cifra.
//  3 · TRES TIPOS DE FILA, no uno. Una ruta que hoy no tiene cobros no necesita
//      dos cifras en cero y una barra vacía: se colapsa a una línea. Y una ruta
//      sin cobrador no es una fila más — es un agujero, y va con borde
//      discontinuo y su «Asignar».

import { BotonPrimario, EstadoVacio, Aviso } from '@/components/cf/primitivos'

const COLOR_PASTILLA = {
  mora:   { bg: 'var(--cf-red-pill-bg)', bd: 'var(--cf-red-pill-border)', fg: 'var(--cf-red-dark)' },
  atraso: { bg: 'var(--cf-gold-bg)',     bd: 'var(--cf-gold-border)',     fg: 'var(--cf-gold-text-2)' },
}

/* El color del riel responde «¿a esta ruta hay que llamarla?». Sin nada que
   cobrar hoy va VERDE y no gris: no está fallando, simplemente hoy no le toca —
   pintarla de alarma dice «esta ruta va mal» cuando lo cierto es «no tenía
   cobros». */
function colorRiel({ inactiva, porcentaje = 0 }) {
  if (inactiva) return 'var(--cf-green)'
  if (porcentaje >= 70) return 'var(--cf-green)'
  if (porcentaje >= 30) return 'var(--cf-gold)'
  return 'var(--cf-red)'
}

/* ══ 1 · La ruta con cobros hoy ══ */
function RutaActiva({ nombre, subtitulo, pastilla, recaudado, falta, porcentaje = 0, onAbrir }) {
  const p = pastilla ? COLOR_PASTILLA[pastilla.tono] : null
  return (
    <div onClick={onAbrir} role="button" tabIndex={0} style={{
      position: 'relative', cursor: 'pointer', flex: 'none',
      background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
      borderRadius: 'var(--cf-r-card)', padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 13, overflow: 'hidden',
    }}>
      <span aria-hidden style={{
        position: 'absolute', left: 0, top: 15, bottom: 15, width: 4, borderRadius: 999,
        background: colorRiel({ porcentaje }),
      }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{
            fontSize: 17, fontWeight: 700, letterSpacing: '-.015em', color: 'var(--cf-ink)',
            minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{nombre}</span>
          {/* La pastilla va PEGADA al nombre, no al otro extremo: es parte de
              cómo se llama esta ruta hoy. */}
          {p && (
            <span className="cf-num" style={{
              display: 'inline-flex', alignItems: 'center', flex: 'none',
              height: 20, padding: '0 8px', borderRadius: 'var(--cf-r-pill)',
              background: p.bg, border: `1px solid ${p.bd}`, color: p.fg,
              fontSize: 11, fontWeight: 700,
            }}>{pastilla.texto}</span>
          )}
        </div>
        {subtitulo && (
          <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{subtitulo}</span>
        )}
      </div>

      {/* LAS DOS CIFRAS. La de la izquierda es lo que ya entró —lo que el
          cobrador lleva juntando— y va grande; la de la derecha es lo que queda,
          más pequeña y en gris porque es una consecuencia, no un logro. */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase',
            color: 'var(--cf-ink-3)',
          }}>Recaudado hoy</span>
          <span className="cf-fig" style={{ fontSize: 26, letterSpacing: '-.03em', color: 'var(--cf-ink)' }}>
            {recaudado}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end', flex: 'none' }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase',
            color: 'var(--cf-ink-3)',
          }}>Falta</span>
          <span className="cf-fig" style={{ fontSize: 17, color: 'var(--cf-ink-2)' }}>{falta}</span>
        </div>
      </div>

      {/* 7px, y el mínimo de 2% para que el 0% se vea: una barra de ancho cero
          desaparece y la ruta parece que no existe, cuando lo que pasa es que no
          ha cobrado nada — que es justo lo que hay que ver. */}
      <div style={{ height: 7, borderRadius: 999, background: 'var(--cf-fill)', overflow: 'hidden', flex: 'none' }}>
        <span style={{
          display: 'block', height: 7, borderRadius: 999,
          width: `${Math.max(2, Math.min(100, porcentaje))}%`,
          background: colorRiel({ porcentaje }),
        }} />
      </div>
    </div>
  )
}

/* ══ 2 · La ruta sin cobros hoy, colapsada ══
   Una línea. No tiene nada de hoy que contar, y dos cifras en cero con una barra
   vacía ocupan 140px para decir «nada». El nombre va en gris: sigue estando,
   pero no compite con las que sí hay que recorrer. */
function RutaTranquila({ nombre, subtitulo, onAbrir }) {
  return (
    <div onClick={onAbrir} role="button" tabIndex={0} style={{
      position: 'relative', cursor: 'pointer', flex: 'none',
      background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
      borderRadius: 'var(--cf-r-card)', padding: '16px 18px',
      display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden',
    }}>
      <span aria-hidden style={{
        position: 'absolute', left: 0, top: 15, bottom: 15, width: 4, borderRadius: 999,
        background: 'var(--cf-green)',
      }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{
          fontSize: 16, fontWeight: 700, letterSpacing: '-.015em', color: 'var(--cf-ink-3)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{nombre}</span>
        {subtitulo && (
          <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{subtitulo}</span>
        )}
      </div>
    </div>
  )
}

/* ══ 3 · La ruta sin cobrador ══
   BORDE DISCONTINUO. Es un agujero, no una fila: esos clientes existen, deben,
   y sus cobros no salen en la pantalla de nadie. El discontinuo dice «esto está
   sin terminar» sin gastar una alarma roja, que sería exagerar — no hay plata
   perdida, hay trabajo sin asignar. */
/* ── UNA RUTA SIN COBRADOR SIGUE SIENDO UNA RUTA ──
   Esta tarjeta no se podia abrir: solo tenia el boton «Asignar». Y una ruta sin
   cobrador tiene igualmente sus clientes, su cartera y su capital — de hecho es
   la que MAS hay que mirar, porque nadie la esta cobrando. El usuario le dio y
   no le dejo entrar.

   La tarjeta abre; «Asignar» sigue haciendo lo suyo y NO deja que el clic suba
   a la tarjeta, o pulsarlo abriria la ruta en vez de asignar. */
function RutaSinCobrador({ nombre, clientes = 0, onAsignar, onAbrir }) {
  return (
    <div onClick={onAbrir} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir?.() } }}
      style={{
      flex: 'none', cursor: onAbrir ? 'pointer' : 'default',
      background: 'var(--cf-card)', border: '1px dashed rgba(20,20,28,.16)',
      borderRadius: 'var(--cf-r-card)', padding: '16px 18px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{
          fontSize: 16, fontWeight: 700, letterSpacing: '-.015em', color: 'var(--cf-ink-3)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{nombre}</span>
        <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>
          {clientes} cliente{clientes === 1 ? '' : 's'} · sin cobrador
        </span>
      </div>
      <button type="button" onClick={(e) => { e.stopPropagation(); onAsignar?.() }} style={{
        background: 'none', border: 0, padding: 0, cursor: 'pointer', flex: 'none',
        fontSize: 12, fontWeight: 700, color: 'var(--cf-gold-dark)',
        fontFamily: 'var(--font-manrope), system-ui',
      }}>Asignar</button>
    </div>
  )
}

export default function ListaRutas({
  rutas = [],
  // «4 rutas · $34.500 de $207.500 hoy»
  resumen,
  sinRuta,
  onAbrir,
  onAsignar,
  onSalirACobrar,
  // Los controles de la pantalla (el modo «Trabajo / Ordenar» y el «+»), en la
  // MISMA fila del título. En la página iban en un bloque ENCIMA del título, así
  // que lo primero que se veía al abrir Rutas no era «Rutas» sino un conmutador
  // de modo. La lámina pone una sola fila de controles, ahí.
  acciones,
  sinMargen = false,
}) {
  if (rutas.length === 0 && !sinRuta?.cantidad) {
    return (
      <div style={{ padding: '8px var(--cf-pad-screen) 0' }}>
        <EstadoVacio
          titulo="Todavía no tienes rutas"
          explicacion="Una ruta agrupa clientes por zona. El cobrador ve su recorrido del día en orden."
          accion={<BotonPrimario>Crear la primera ruta</BotonPrimario>}
        />
      </div>
    )
  }

  // El ORDEN no es alfabético: primero las que hoy hay que recorrer, después las
  // tranquilas, y al final los agujeros. Alfabético es el orden de un
  // archivador; este es el orden en que hay que actuar.
  const conCobrador = rutas.filter((r) => r.cobrador)
  const activas = conCobrador.filter((r) => !r.inactiva)
  const tranquilas = conCobrador.filter((r) => r.inactiva)
  const huerfanas = rutas.filter((r) => !r.cobrador)
  const hayQueCobrar = activas.length > 0

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 11,
      padding: sinMargen ? '8px 0 0' : '8px var(--cf-pad-screen) 0',
      // El hueco de abajo es para que la pastilla no tape la última tarjeta: el
      // contenido pasa POR DEBAJO de ella a propósito (regla §B del armazón).
      paddingBottom: 96,
    }}>
      {/* El encabezado: «Rutas» con el botón de alcance, y debajo el resumen del
          día. El botón dice «Hoy» porque esta pantalla es SOLO de hoy — el
          acumulado de cada ruta vive en su detalle. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, flex: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{
            flex: 1, minWidth: 0, margin: 0,
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 21, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)',
          }}>Rutas</h1>
          <span style={{
            display: 'inline-flex', alignItems: 'center', flex: 'none',
            height: 34, padding: '0 13px', borderRadius: 'var(--cf-r-pill)',
            background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
            fontSize: 12, fontWeight: 700, color: 'var(--cf-ink-2)',
          }}>Hoy</span>
          {acciones}
        </div>
        {resumen && (
          <span className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>{resumen}</span>
        )}
      </div>

      {activas.map((r) => <RutaActiva key={r.id} {...r} onAbrir={() => onAbrir?.(r)} />)}
      {tranquilas.map((r) => <RutaTranquila key={r.id} {...r} onAbrir={() => onAbrir?.(r)} />)}
      {huerfanas.map((r) => (
        <RutaSinCobrador key={r.id} {...r}
          onAsignar={() => onAsignar?.(r)} onAbrir={() => onAbrir?.(r)} />
      ))}

      {/* Los clientes SIN NINGUNA RUTA. Es otro agujero, distinto del de arriba:
          allí la ruta existe y le falta cobrador; acá el cliente no está en
          ninguna ruta, así que no aparece en el recorrido de nadie. */}
      {sinRuta?.cantidad > 0 && (
        <RutaSinCobrador
          nombre="Sin ruta"
          clientes={sinRuta.cantidad}
          onAsignar={() => onAsignar?.(null)}
        />
      )}

      {/* Lo que la pantalla NO muestra, dicho. Sin esta línea, un dueño que
          busca «cuánto tengo puesto en la Ruta 2» la recorre entera y concluye
          que la app no lo dice. */}
      <Aviso tono="neutro">La cartera y el capital de cada ruta están adentro, en su detalle.</Aviso>

      {/* «Salir a cobrar» va AL FINAL DEL CONTENIDO, no anclada abajo.
          
          La lámina la dibuja anclada, pero la dibuja en una pantalla SIN
          pastilla de navegación — y acá la pastilla sí va: «Rutas» es uno de sus
          cinco destinos, así que quitarla dejaría la barra sin barra justo en la
          pantalla a la que se llega tocándola. La regla §4 del armazón lo dice al
          revés: la acción ocupa ese hueco «cuando la pastilla no está».
          
          Anclada con la misma z que la pastilla, quedaba DETRÁS de ella: solo se
          veía un trozo dorado asomando por el borde. Al final del contenido se
          ve entera y no compite con nada. */}
      {hayQueCobrar && onSalirACobrar && (
        <div style={{ paddingTop: 2, flex: 'none' }}>
          <BotonPrimario onClick={onSalirACobrar}>Salir a cobrar</BotonPrimario>
        </div>
      )}
    </div>
  )
}
