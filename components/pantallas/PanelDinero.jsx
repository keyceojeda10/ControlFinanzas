'use client'

// components/pantallas/PanelDinero.jsx — «¿cuánta plata tengo puesta y cuánto
// estoy ganando?», las dos preguntas que el panel no contestaba.
//
// ── POR QUE EXISTE ────────────────────────────────────────────────────────
//
// El panel tenía 47 cifras de dinero y un control llamado «Ver más métricas»:
// la propia app admitiendo que no sabía cuáles importan. El dueño listó seis
// preguntas que el panel tiene que contestar. `Panel` ya contesta tres —cuánto
// llevo hoy, cuánto puedo prestar, cómo van mis rutas—; estas son las que no
// tenían sitio.
//
// **La diferencia entre «con intereses» y «sin intereses» ES la ganancia
// esperada.** Eso convierte dos cifras sueltas en una frase con sentido: tienes
// $X puestos y vas a recibir $Y. Y cierra la tarea F5, que llevaba meses
// pendiente por no tener dónde ir.
//
// ── LA SUPERFICIE ES LA DEL PAQUETE, NO UNA PROPIA ────────────────────────
//
// `Tarjeta` de `components/cf/primitivos` — fondo plano, borde de 1px, radio 18,
// SIN sombra. Es `03-COMPONENTES.md · 1`. Las tarjetas anteriores llevaban un
// degradado teñido con el color de cada cifra y una sombra, y eso es lo que las
// hacía verse de la versión anterior aunque los tokens fueran los nuevos.
//
// El color va en la CIFRA, nunca en la superficie.
//
// ── Y LA TIRA DE CIFRAS ES §14 ────────────────────────────────────────────
//
//   etiqueta 10px/700, .06–.07em, uppercase, --cf-ink-3
//   valor    14–18px/600, tabular-nums
//   máximo CUATRO columnas en móvil; con más, no se leen.
//
// Presentacional a propósito: todo entra por props, desde `adaptarPanelDinero`.

import { Tarjeta } from '@/components/cf/primitivos'

/* Una columna de la tira. `titulo` es el rótulo del diccionario, así que puede
   ser de cualquier largo: por eso el rótulo reserva dos líneas y las cifras
   quedan alineadas entre sí pase lo que pase. */
/* ⚠ FILAS, NO COLUMNAS.
   §14 dibuja una tira de hasta cuatro columnas y avisa: «con más, no se leen».
   Con TRES tampoco, si las cifras son de nueve dígitos. Probado en el teléfono
   contra el negocio real: salía «$201.582.321$245.497.198», pegadas, sin un
   pixel de aire. La tira sirve para «12 cuotas · 62% · $48.000», no para
   cientos de millones.

   Fila con rótulo a la izquierda y cifra a la derecha, y la que es RESULTADO
   abajo y más grande. Es el patrón de la cuenta del día de la caja por ruta,
   donde el criterio era que se pudiera sumar a mano. */
function Fila({ titulo, valor, tono = 'neutro', fuerte = false, onTocar, primera = false }) {
  const color = tono === 'favor' ? 'var(--cf-green-dark)'
    : tono === 'contra' ? 'var(--cf-red-dark)'
    : 'var(--cf-ink)'

  const caja = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    width: '100%', minHeight: 40, textAlign: 'left',
    borderTop: primera ? 'none' : '1px solid var(--cf-hairline)',
    paddingTop: primera ? 0 : 10,
  }

  const cuerpo = (
    <>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--cf-ink-2)', minWidth: 0 }}>{titulo}</span>
      <span className="cf-fig" style={{
        fontSize: fuerte ? 19 : 16, fontWeight: fuerte ? 700 : 600, color, flex: 'none',
      }}>{valor}</span>
    </>
  )

  if (!onTocar) return <div style={caja}>{cuerpo}</div>
  return (
    <button type="button" onClick={onTocar}
      style={{ ...caja, background: 'none', borderLeft: 0, borderRight: 0, borderBottom: 0, cursor: 'pointer', paddingLeft: 0, paddingRight: 0 }}
    >{cuerpo}</button>
  )
}

export default function PanelDinero({ datos, nota, fmt, onExplicar }) {
  if (!datos) return null
  const { puesto, ganando } = datos
  const abrir = (id) => (onExplicar ? () => onExplicar(id) : undefined)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── ¿CUÁNTA PLATA TENGO PUESTA? ─────────────────────────────────
          Tres columnas y no cuatro: la tercera es la RESTA de las dos
          primeras, y ponerla al lado es lo que hace que se lea como una
          frase en vez de como tres datos sueltos. */}
      <Tarjeta>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase',
          color: 'var(--cf-ink-3)',
        }}>Tu plata puesta</span>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Fila primera titulo={puesto.rotulos.miPlata} valor={fmt(puesto.miPlata)} onTocar={abrir(puesto.ids.miPlata)} />
          <Fila titulo={puesto.rotulos.conIntereses} valor={fmt(puesto.conIntereses)} onTocar={abrir(puesto.ids.conIntereses)} />
          <Fila titulo={puesto.rotulos.porGanar} valor={fmt(puesto.porGanar)} tono="favor" fuerte onTocar={abrir(puesto.ids.porGanar)} />
        </div>

        {/* La frase que une las tres. Sin ella son tres cifras; con ella es una
            respuesta. */}
        <p style={{ fontSize: 12, color: 'var(--cf-ink-2)', margin: 0 }}>
          Tienes {fmt(puesto.miPlata)} tuyos en la calle. Si todos terminan de
          pagar recibes {fmt(puesto.conIntereses)}, así que ganas{' '}
          <strong style={{ color: 'var(--cf-green-dark)' }}>{fmt(puesto.porGanar)}</strong>.
        </p>
      </Tarjeta>

      {/* ── ¿CUÁNTO ESTOY GANANDO? ──────────────────────────────────────
          Ganancia = INTERÉS cobrado − gastos. Nunca «recaudado − gastos»: la
          mayor parte de lo que entra es capital propio volviendo, y recuperar
          tu plata no es ganar. Con esa fórmula la cifra salía cinco veces
          inflada. */}
      <Tarjeta>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase',
          color: 'var(--cf-ink-3)',
        }}>Este mes</span>

        {/* El orden es el de la RESTA, no el de la importancia: primero lo que
            entró, luego lo que salió, y la ganancia abajo como resultado. Así se
            puede comprobar a mano, que es el mismo criterio de la cuenta del día
            de la caja. */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Fila primera titulo={ganando.rotulos.interes} valor={fmt(ganando.interes)} onTocar={abrir(ganando.ids.interes)} />
          <Fila
            titulo={ganando.rotulos.gastos}
            valor={ganando.gastos > 0 ? `− ${fmt(ganando.gastos)}` : fmt(0)}
            tono={ganando.gastos > 0 ? 'contra' : 'neutro'}
            onTocar={abrir(ganando.ids.gastos)}
          />
          <Fila
            titulo={ganando.rotulos.ganancia}
            valor={fmt(ganando.ganancia)}
            tono={ganando.ganancia < 0 ? 'contra' : 'favor'}
            fuerte
            onTocar={abrir(ganando.ids.ganancia)}
          />
        </div>

        <p style={{ fontSize: 12, color: 'var(--cf-ink-2)', margin: 0 }}>
          Por cada {fmt(1000000)} que tienes en la calle ganas{' '}
          <strong style={{ color: 'var(--cf-ink)' }}>{fmt(Math.round(ganando.pct * 10000))}</strong> al mes.
        </p>
      </Tarjeta>

      {/* ── LO QUE ESTO SIGNIFICA ───────────────────────────────────────
          Determinista, sobre las cifras de arriba. Nunca un modelo sobre
          cifras crudas: ese fallo ya estuvo vivo —el consejo medía contra el
          techo de la cartera mientras el hero medía contra la meta, y la
          pantalla decía 48% mientras el consejo decía 9%. */}
      {nota && (
        <Tarjeta style={{ background: 'var(--cf-fill)', flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-3)"
               strokeWidth="2" strokeLinecap="round" style={{ flex: 'none', marginTop: 1 }} aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8h.01M11 12h1v4h1" />
          </svg>
          <p style={{ fontSize: 13, color: 'var(--cf-ink-2)', margin: 0, lineHeight: 1.45 }}>{nota}</p>
        </Tarjeta>
      )}
    </div>
  )
}
