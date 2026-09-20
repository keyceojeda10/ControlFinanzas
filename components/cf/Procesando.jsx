'use client'
// components/cf/Procesando.jsx — LA PANTALLA DE «ESTOY EN ESO».
//
// El dueño, 20 sep 2026: «cuando se hace un pago el sistema a veces se cuelga,
// no muestra ninguna pantalla… y de repente se abre, boom, la del pago
// registrado. Queda uno como que ¿qué está pasando aquí? No se sabe si se hizo».
// Mandó dos referencias —Nubank y Tada— y dijo cuál le gustó y por qué: los
// ESTADOS que se van apilando (el anterior sube y se apaga) y una ilustración
// animada que sube mientras tanto.
//
// Esta pantalla NO arregla la lentitud: la cuenta. La lentitud se arregla en su
// causa (ver `lib/geo.js`: el cobro esperaba al GPS hasta 4,5 s antes de salir).
// Lo que queda —el viaje al servidor— no se puede quitar, y esto es lo que se ve
// mientras dura: aparece EN EL ACTO tras el gesto, dice qué está pasando, y se
// quita sola en cuanto el servidor contesta.
//
// ── LO QUE NO HACE ──────────────────────────────────────────────────────────
//   · No inventa espera. Los estados avanzan con el reloj, pero en cuanto la
//     operación termina la pantalla se va; solo se queda un mínimo (MINIMO_MS)
//     para no ser un parpadeo, que es peor que no enseñar nada.
//   · No dice «¡Listo!». El comprobante que viene detrás ya lo celebra —el visto,
//     los rodillos, la billetera—; dos celebraciones seguidas son una demora.
//   · No decide nada de plata. Solo pinta.
//
// Carbón literal (#15161A) y no un token: como `BloqueOscuro`, es oscura en los
// dos temas. El dorado es el del bloque (#F5B824), no `--cf-gold`.

import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BLOQUE } from '@/components/cf/bloqueOscuro'
import { GUIONES, PASO_MS, crearConPantalla } from '@/lib/procesando'

export { GUIONES, MINIMO_MS, PASO_MS } from '@/lib/procesando'

const TINTA_DIBUJO = '#0E0F12'

/* ── LAS ILUSTRACIONES ────────────────────────────────────────────────────────
   Trazo oscuro y relleno plano, como un dibujo y no como un icono. Los billetes
   son los de `lib/billetes.js` (tres colores genéricos, ningún billete real) y la
   cartulina es la de «Cliente creado»: lo que se ve mientras se espera es lo
   mismo que se va a ver al terminar. */
function Fajo() {
  // Solo el billete de ARRIBA lleva emblema: los de debajo asoman por el canto y
  // un emblema a medias se leía como una mota suelta bajo la faja.
  const billete = (dx, dy, fondo, tinta, emblema = false) => (
    <g transform={`translate(${dx} ${dy})`}>
      <rect x="-62" y="-34" width="124" height="68" rx="5" fill={fondo} stroke={TINTA_DIBUJO} strokeWidth="2.2" />
      <rect x="-54" y="-26" width="108" height="52" rx="2.5" fill="none" stroke={tinta} strokeWidth="1.4" />
      {emblema && (
        <g transform="translate(20 0)">
          <circle cx="0" cy="0" r="15" fill="none" stroke={tinta} strokeWidth="1.6" />
          <path d="M4.6 -4.4c-1.6-2.6-8.6-2.4-8.6 1.6s8.6 2.4 8.6 6.4-7 4.4-9 1.6M0 -9.5v19" fill="none" stroke={tinta} strokeWidth="1.7" strokeLinecap="round" />
        </g>
      )}
    </g>
  )
  return (
    <g>
      {billete(10, 12, '#CCDAEB', '#5F7FA6')}
      {billete(5, 6, '#EFD3C6', '#A8705A')}
      {billete(0, 0, '#D4E6C4', '#5E8A4E', true)}
      {/* La faja de papel que lo amarra: a un lado, para que se vea el billete. */}
      <rect x="-46" y="-38" width="26" height="88" rx="2" fill="#F3EBD8" stroke={TINTA_DIBUJO} strokeWidth="2.2" />
      <path d="M-46 -20h26M-46 30h26" stroke="#C9BD9E" strokeWidth="1.3" />
    </g>
  )
}

function Cartulina() {
  return (
    <g>
      <rect x="-58" y="-40" width="116" height="80" rx="6" fill="#FBF6E9" stroke={TINTA_DIBUJO} strokeWidth="2.2" />
      <path d="M-58 -22h116" stroke="#D9A54A" strokeWidth="1.6" />
      {[-8, 6, 20].map((y, i) => (
        <path
          key={y} d={`M-44 ${y}h${i === 2 ? 52 : 88}`} className="cf-proc-renglon"
          style={{ animationDelay: `${i * 0.42}s` }}
          stroke="#3A3D45" strokeWidth="2.6" strokeLinecap="round" fill="none"
        />
      ))}
      <circle cx="-44" cy="-31" r="3" fill="#D9A54A" />
    </g>
  )
}

function MonedaDibujo() {
  return (
    <g>
      <ellipse cx="4" cy="5" rx="46" ry="46" fill="#B9860B" stroke={TINTA_DIBUJO} strokeWidth="2.2" />
      <circle cx="0" cy="0" r="46" fill={BLOQUE.oro} stroke={TINTA_DIBUJO} strokeWidth="2.2" />
      <circle cx="0" cy="0" r="34" fill="none" stroke="#B9860B" strokeWidth="2" />
      <path d="M9 -13c-3.6-5.4-19-5-19 3.6s19 5 19 14-15.6 9.4-20 3.2M-1 -24v48" fill="none" stroke={TINTA_DIBUJO} strokeWidth="4" strokeLinecap="round" />
    </g>
  )
}

function TelefonoDibujo() {
  return (
    <g>
      <rect x="-36" y="-62" width="72" height="124" rx="13" fill="#2A2C33" stroke={TINTA_DIBUJO} strokeWidth="2.2" />
      <rect x="-29" y="-53" width="58" height="106" rx="7" fill="#F3F3F6" />
      <rect x="-9" y="-58" width="18" height="3.4" rx="1.7" fill={TINTA_DIBUJO} />
      {/* El aviso que entra: es lo que de verdad ve quien recibe una transferencia. */}
      <g className="cf-proc-aviso">
        <rect x="-24" y="-40" width="48" height="24" rx="6" fill={BLOQUE.oro} stroke={TINTA_DIBUJO} strokeWidth="1.8" />
        <path d="M-17 -31h20M-17 -24h32" stroke={TINTA_DIBUJO} strokeWidth="2.4" strokeLinecap="round" />
      </g>
      <path d="M-20 0h40M-20 12h28M-20 24h34" stroke="#C9CCD3" strokeWidth="2.6" strokeLinecap="round" />
    </g>
  )
}

const DIBUJOS = { fajo: Fajo, cartulina: Cartulina, moneda: MonedaDibujo, telefono: TelefonoDibujo }

/* La estela sobre la que sube. Bolas que respiran a destiempo: eso es lo que la
   hace parecer humo y no una mancha. Del dorado al hueso, de abajo arriba. */
const ESTELA = [
  { cx: 236, cy: 300, r: 58, d: 0 },
  { cx: 176, cy: 262, r: 50, d: 0.5 },
  { cx: 226, cy: 214, r: 42, d: 1.1 },
  { cx: 150, cy: 196, r: 40, d: 0.3 },
  { cx: 112, cy: 232, r: 30, d: 0.8 },
  { cx: 196, cy: 160, r: 30, d: 1.4 },
  // Relleno: sin ella, entre tres bolas asomaba una cuña del contorno.
  { cx: 188, cy: 212, r: 36, d: 0.6 },
]

function Escena({ ilustracion }) {
  const Dibujo = DIBUJOS[ilustracion] ?? MonedaDibujo
  return (
    <svg viewBox="0 0 300 340" width="100%" height="100%" aria-hidden="true" className="cf-proc-escena" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="cf-proc-estela" gradientUnits="userSpaceOnUse" x1="120" y1="130" x2="250" y2="350">
          <stop offset="0" stopColor="#E9E4D8" />
          <stop offset="0.55" stopColor="#F2D48A" />
          <stop offset="1" stopColor={BLOQUE.oro} />
        </linearGradient>
      </defs>
      {/* El contorno primero y el relleno encima: así la estela es UNA forma con
          borde por fuera, no seis círculos con su raya cada uno. */}
      <g>
        {ESTELA.map((b) => (
          <circle key={`c${b.cx}`} cx={b.cx} cy={b.cy} r={b.r + 2.2} fill={TINTA_DIBUJO} className="cf-proc-bola" style={{ animationDelay: `${b.d}s`, transformOrigin: `${b.cx}px ${b.cy}px` }} />
        ))}
        {ESTELA.map((b) => (
          <circle key={`r${b.cx}`} cx={b.cx} cy={b.cy} r={b.r} fill="url(#cf-proc-estela)" className="cf-proc-bola" style={{ animationDelay: `${b.d}s`, transformOrigin: `${b.cx}px ${b.cy}px` }} />
        ))}
      </g>
      {[[36, 196, 7, 0], [266, 96, 5, 0.9], [92, 306, 9, 1.6]].map(([cx, cy, r, d]) => (
        <circle key={cx} cx={cx} cy={cy} r={r} fill="#E9E4D8" stroke={TINTA_DIBUJO} strokeWidth="2" className="cf-proc-mota" style={{ animationDelay: `${d}s` }} />
      ))}
      <g transform="translate(132 132)">
        <g className="cf-proc-flota">
          <g transform="rotate(-28) scale(1.42)"><Dibujo /></g>
        </g>
      </g>
    </svg>
  )
}

const CSS = `
@keyframes cf-proc-entra { from { opacity: 0 } to { opacity: 1 } }
@keyframes cf-proc-sube { from { transform: translate3d(34px, 64px, 0); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes cf-proc-flota { from { transform: translate3d(0, 5px, 0) rotate(-1.6deg) } to { transform: translate3d(3px, -7px, 0) rotate(1.8deg) } }
@keyframes cf-proc-bola { from { transform: scale(1) } to { transform: scale(1.07) } }
@keyframes cf-proc-mota { from { transform: translate3d(0, 0, 0) } to { transform: translate3d(-5px, 16px, 0) } }
@keyframes cf-proc-renglon { 0% { stroke-dashoffset: 90 } 45%, 100% { stroke-dashoffset: 0 } }
@keyframes cf-proc-aviso { 0%, 12% { transform: translate3d(0, -16px, 0); opacity: 0 } 30%, 82% { transform: none; opacity: 1 } 100% { transform: none; opacity: 0 } }
@keyframes cf-proc-paso { from { transform: translate3d(0, 18px, 0); opacity: 0 } to { transform: none; opacity: 1 } }
.cf-proc { animation: cf-proc-entra .16s ease-out both; }
.cf-proc[data-saliendo="1"] { opacity: 0; transition: opacity .18s ease-in; }
.cf-proc-escena { animation: cf-proc-sube .7s cubic-bezier(.16,1,.3,1) both; }
.cf-proc-flota { animation: cf-proc-flota 2.6s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: center; }
.cf-proc-bola { animation: cf-proc-bola 2.2s ease-in-out infinite alternate; }
.cf-proc-mota { animation: cf-proc-mota 3s ease-in-out infinite alternate; }
.cf-proc-renglon { stroke-dasharray: 90; animation: cf-proc-renglon 2.4s cubic-bezier(.4,0,.2,1) infinite; }
.cf-proc-aviso { animation: cf-proc-aviso 2.4s cubic-bezier(.16,1,.3,1) infinite; }
.cf-proc-paso { animation: cf-proc-paso .42s cubic-bezier(.16,1,.3,1) both; transition: color .35s ease; }
.cf-proc-barra { transition: width 1.1s cubic-bezier(.16,1,.3,1); }
@media (prefers-reduced-motion: reduce) {
  .cf-proc-escena, .cf-proc-flota, .cf-proc-bola, .cf-proc-mota, .cf-proc-paso, .cf-proc-aviso { animation: none; }
  .cf-proc-renglon { animation: none; stroke-dasharray: none; }
  .cf-proc-barra { transition: none; }
}
`

/**
 * La pantalla. Se monta con la operación y se desmonta con ella: quien la usa
 * no lleva la cuenta de los pasos, solo dice qué operación es.
 *
 * @param guion     clave de GUIONES ('cobro', 'prestamo', 'cliente'…)
 * @param saliendo  true mientras se desvanece (lo pone `useProcesando`)
 */
export function Procesando({ guion = 'guardando', saliendo = false }) {
  const { pasos, ilustracion } = GUIONES[guion] ?? GUIONES.guardando
  const [paso, setPaso] = useState(0)

  useEffect(() => {
    if (paso >= pasos.length - 1) return undefined
    const t = setTimeout(() => setPaso((p) => p + 1), PASO_MS)
    return () => clearTimeout(t)
  }, [paso, pasos.length])

  // La barra nunca llega al final por su cuenta: el final lo pone el servidor.
  const avance = saliendo ? 100 : Math.round(((paso + 1) / (pasos.length + 1)) * 100)

  return (
    <div
      className="cf-proc" data-saliendo={saliendo ? '1' : '0'}
      role="status" aria-live="polite" aria-busy="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 10010,
        background: BLOQUE.fondo, color: BLOQUE.tinta,
        display: 'flex', flexDirection: 'column',
        padding: 'max(24px, env(safe-area-inset-top)) 28px max(36px, env(safe-area-inset-bottom))',
        touchAction: 'none', overscrollBehavior: 'contain',
      }}
    >
      <style>{CSS}</style>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 'min(100%, 380px)', height: 'min(100%, 430px)' }}>
          <Escena ilustracion={ilustracion} />
        </div>
      </div>

      {/* LOS ESTADOS, APILADOS. El de ahora abajo y en tinta; los de antes
          suben y se apagan. Se enseñan como mucho los dos anteriores. */}
      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 520 }}>
        {pasos.slice(0, paso + 1).map((texto, i) => {
          const distancia = paso - i
          if (distancia > 2) return null
          return (
            <span
              key={texto} className="cf-proc-paso cf-fig"
              aria-hidden={distancia > 0}
              style={{
                fontSize: distancia === 0 ? 30 : 22, fontWeight: 700, lineHeight: 1.08,
                letterSpacing: '-.03em', textWrap: 'balance',
                color: distancia === 0 ? BLOQUE.tinta : distancia === 1 ? 'rgba(243,243,246,.30)' : 'rgba(243,243,246,.14)',
              }}
            >{texto}{distancia === 0 ? '…' : ''}</span>
          )
        })}
        <span style={{ marginTop: 16, height: 3, borderRadius: 999, background: BLOQUE.pista, overflow: 'hidden', display: 'block' }}>
          <span className="cf-proc-barra" style={{ display: 'block', height: 3, borderRadius: 999, width: `${avance}%`, background: BLOQUE.oro }} />
        </span>
      </div>
    </div>
  )
}

/* ── SE MONTA SOLA, SOBRE EL BODY ─────────────────────────────────────────────
   No cuelga del árbol de quien la llama. La ficha del préstamo tiene TRES
   salidas distintas según lo que se esté registrando (hoja, hoja con fragmento,
   modal): pedirle a cada una que pinte `{procesando}` es la receta para que una
   se quede sin ella y nadie lo note. Así basta con llamar a `conPantalla`. */
let raiz = null
function pintar(estado) {
  if (typeof document === 'undefined') return
  if (!raiz) {
    const caja = document.createElement('div')
    caja.setAttribute('data-cf-procesando', '')
    document.body.appendChild(caja)
    raiz = createRoot(caja)
  }
  raiz.render(estado ? <Procesando key={estado.id} guion={estado.guion} saliendo={estado.saliendo} /> : null)
}

/**
 * Envuelve una operación con la pantalla.
 *
 *   const res = await conPantalla('cobro', () => fetch(…))
 *
 * Los tiempos y la promesa viven en `lib/procesando.js` (puro, con pruebas).
 */
export const conPantalla = crearConPantalla(pintar)

/** La misma función, con forma de hook para quien ya la usaba así. `procesando`
 *  es siempre null: la pantalla se monta sola (ver `pintar`). */
export function useProcesando() {
  return { procesando: null, conPantalla }
}
