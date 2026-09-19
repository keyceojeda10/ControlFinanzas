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
import LineaCifra from '@/components/cf/LineaCifra'

/* ⚠ UNA CIFRA POR RENGLÓN, NO COLUMNAS NI FILAS PARTIDAS.
   §14 dibuja una tira de hasta cuatro columnas y avisa: «con más, no se leen».
   Con TRES tampoco, si las cifras son de nueve dígitos: en el teléfono, contra
   el negocio real, salía «$201.582.321$245.497.198», pegadas. Luego fueron
   filas «rótulo a la izquierda, cifra a la derecha», y el 19 sep pasaron a
   `LineaCifra`: el rótulo arriba, la cifra grande debajo y, en el pie, de dónde
   sale. El criterio es el mismo de la caja: que se pueda comprobar a mano. */
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

        {/* ⚠ ERAN TRES FILAS «rótulo a la izquierda, cifra a la derecha» y una
            frase debajo que repetía las tres cifras. El dueño, 19 sep: «se
            describen muchos valores, pero en algunos no se entiende muy bien».
            Ahora es el patrón de «préstamo entregado», que sí se entendió: una
            cifra por renglón, grande, con su nombre encima y debajo de dónde
            sale. La tercera es la RESTA de las dos primeras y lo dice; por eso
            sobra la frase. Las tres siguen abriendo su explicación. */}
        <LineaCifra rotulo={puesto.rotulos.miPlata} cifra={fmt(puesto.miPlata)}
          pie="Lo que prestaste y todavía no ha vuelto"
          onTocar={abrir(puesto.ids.miPlata)} />
        <LineaCifra rotulo={puesto.rotulos.conIntereses} cifra={fmt(puesto.conIntereses)}
          pie="Lo que recibes si todos terminan de pagar"
          onTocar={abrir(puesto.ids.conIntereses)}
          style={{ paddingTop: 12, borderTop: '1px solid var(--cf-hairline)' }} />
        <LineaCifra rotulo={puesto.rotulos.porGanar} cifra={fmt(puesto.porGanar)} tam={26} tono="favor"
          pie={`${fmt(puesto.conIntereses)} − ${fmt(puesto.miPlata)}: tu ganancia cuando terminen`}
          onTocar={abrir(puesto.ids.porGanar)}
          style={{ paddingTop: 12, borderTop: '1px solid var(--cf-hairline)' }} />
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

        {/* El orden sigue siendo el de la RESTA —lo que entró, lo que salió, y
            la ganancia abajo como resultado—, para que se pueda comprobar a
            mano. Los gastos van en el chip del interés, con su signo: son lo
            que separa una cifra de la otra. */}
        <LineaCifra rotulo={ganando.rotulos.interes} cifra={fmt(ganando.interes)}
          onTocar={abrir(ganando.ids.interes)} />
        <LineaCifra rotulo={ganando.rotulos.gastos}
          cifra={ganando.gastos > 0 ? `− ${fmt(ganando.gastos)}` : fmt(0)}
          tono={ganando.gastos > 0 ? 'contra' : 'neutro'}
          onTocar={abrir(ganando.ids.gastos)}
          style={{ paddingTop: 12, borderTop: '1px solid var(--cf-hairline)' }} />
        <LineaCifra rotulo={ganando.rotulos.ganancia} cifra={fmt(ganando.ganancia)} tam={26}
          tono={ganando.ganancia < 0 ? 'contra' : 'favor'}
          pie={`Interés cobrado − gastos · por cada ${fmt(1000000)} en la calle ganas ${fmt(Math.round(ganando.pct * 10000))} al mes`}
          onTocar={abrir(ganando.ids.ganancia)}
          style={{ paddingTop: 12, borderTop: '1px solid var(--cf-hairline)' }} />
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
