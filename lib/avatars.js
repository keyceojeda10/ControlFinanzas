// lib/avatars.js — Los avatares del perfil.
//
// ══ ⚠ REHECHOS ENTEROS EL 8 DE AGOSTO DE 2026 ═════════════════════════════
//
// «Se ven muy feos… los de ahora están horribles.» Y al medirlos había tres
// problemas distintos, no uno:
//
//  1. ⚠ NO SE LEEN AL TAMAÑO EN QUE SE USAN. Estaban dibujados a 120px con
//     detalles de menos de 1 unidad de grosor —telarañas de 0,8, brillos de 1—
//     y se pintan a **32px** en la cabecera. A 32, Spider-Man, Deadpool y Venom
//     eran el MISMO círculo rojo, y Baymax un círculo blanco vacío.
//
//  2. NO HABÍA SISTEMA. Cada uno traía su paleta, su nivel de detalle y su
//     encuadre: unos cara completa, otros máscara, otros cuerpo entero. Puestos
//     en fila no parecían un juego, parecían un montón.
//
//  3. ⚠ ERAN DE OTRO. Iron Man, Capitán, Spider-Man, Wolverine, Pantera Negra,
//     Thor, Hulk, Deadpool, Thanos, Venom, Mike Wazowski, Stitch, Pooh, Grogu,
//     Baymax, Olaf, Jack y Elsa — 18 de 56 — son personajes de Marvel, Disney y
//     Lucasfilm. En un producto que cobra suscripción eso no es un detalle.
//
// ── LA REGLA DE ESTE JUEGO ─────────────────────────────────────────────────
//
// **Se diseña para 32px y se comprueba a 32px.** De ahí sale todo lo demás:
//
//  · La SILUETA carga el reconocimiento, no la cara. A 32px un ojo de radio 3
//    mide menos de un píxel: no existe. Lo que sí se ve es el contorno del pelo,
//    la forma del sombrero, el hueco entre los hombros.
//  · CONTRASTE fuerte entre el fondo y la figura, siempre. Nada de figura clara
//    sobre fondo claro — así desaparecía Baymax.
//  · Nada más fino de 4 unidades (≈1px a 32). Los trazos finos se van.
//  · Un fondo plano por avatar, y que dos vecinos del mismo grupo NO compartan
//    fondo: si el color es lo único que se ve, el color tiene que distinguir.
//
// ── CÓMO ESTÁ CONSTRUIDO ───────────────────────────────────────────────────
//
// `persona()` arma las 14 caras a partir de las mismas piezas (cabeza, hombros,
// pelo, accesorio). No es por ahorrar: es la única forma de que catorce dibujos
// parezcan de la misma mano. Los que no son caras van a mano, pero sobre la
// misma retícula de 120 y con la misma paleta.
//
// Se comprueba con `node .auditoria/_avatares-prueba.mjs`, que los pinta a 32 y
// a 72 en una hoja. Mirar SIEMPRE la fila de 32 primero.

/* ── LA PALETA ──────────────────────────────────────────────────────────────
   Fondos saturados y oscuros para que cualquier figura clara recorte encima.
   No se usa el dorado de la app a propósito: ahí significa «acción», y un
   avatar dorado se lee como un botón. */
const F = {
  indigo: '#3D4EAD', azul: '#2B6CB0', cielo: '#2C8CBB', teal: '#20808D',
  verde: '#2F855A', oliva: '#5A7D2A', mostaza: '#B7791F', naranja: '#C05621',
  ladrillo: '#B4462F', rojo: '#A33B3B', vino: '#8B3A5A', morado: '#6B46C1',
  ciruela: '#7B3F8C', pizarra: '#4A5568', carbon: '#2D3748', cafe: '#6B4423',
}

/* Tonos de piel: son SIETE y se reparten a propósito. La gente que usa esto no
   se parece toda entre sí. */
const P = ['#F2D3B8', '#E5B590', '#D19A6E', '#B57A4D', '#8D5A34', '#6A4023', '#4A2C18']

const PELO = { negro: '#1F2430', castano: '#4A2F1B', cafe: '#6B4423', rubio: '#D9A441', gris: '#B8BCC4', rojizo: '#A0522D' }

/**
 * Una cara, con las mismas piezas para todas.
 *
 * ⚠ La cabeza va GRANDE y baja (r 34, cy 66) y los hombros entran por abajo:
 * a 32px lo que se reconoce es ese contorno. Una cabeza pequeña centrada deja
 * demasiado fondo y todas se ven iguales.
 *
 * `pelo` es la pieza que más distingue: es la silueta que sobrevive al tamaño.
 */
function persona({ bg, piel, pelo, encima = '', ropa }) {
  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
<circle cx="60" cy="60" r="60" fill="${bg}"/>
<path d="M14,120 Q14,86 60,86 Q106,86 106,120 Z" fill="${ropa}"/>
<circle cx="60" cy="56" r="27" fill="${piel}"/>
${pelo}
<circle cx="50" cy="54" r="4.6" fill="#1F2430"/>
<circle cx="70" cy="54" r="4.6" fill="#1F2430"/>
<path d="M52,68 Q60,74 68,68" fill="none" stroke="#1F2430" stroke-width="5" stroke-linecap="round"/>
${encima}
</svg>`
}

/* ── ⚠ EL PELO ES LO QUE DISTINGUE, Y TIENE QUE SALIRSE DE LA CABEZA ────────
 *
 * Mi primera versión ponía el pelo DENTRO del círculo de la cabeza. A 64px se
 * veían catorce personas distintas; a 32px —el tamaño real— se veían catorce
 * veces lo mismo: un aro de color con una mancha de piel dentro. Justo el
 * defecto que este trabajo venía a arreglar, movido de sitio.
 *
 * Lo que cambia a 32px no son los rasgos, es el CONTORNO. Así que cada pieza
 * de pelo o sombrero tiene que morder el borde del avatar y cambiar su forma:
 * el afro más ancho que la cabeza, la visera saliendo por un lado, el ala del
 * sombrero cruzando de lado a lado, las trenzas colgando por fuera.
 */
const corto = (c) => `<path d="M29,54 Q29,20 60,20 Q91,20 91,54 Q91,34 60,34 Q29,34 29,54 Z" fill="${c}"/>`
const largo = (c) => `<path d="M24,56 Q24,18 60,18 Q96,18 96,56 L96,102 L80,102 L80,48 Q72,38 60,38 Q48,38 40,48 L40,102 L24,102 Z" fill="${c}"/>`
const rizado = (c) => `<circle cx="60" cy="36" r="34" fill="${c}"/><circle cx="30" cy="52" r="17" fill="${c}"/><circle cx="90" cy="52" r="17" fill="${c}"/><circle cx="60" cy="50" r="25" fill="none"/><path d="M33,54 Q33,32 60,32 Q87,32 87,54 Q87,40 60,40 Q33,40 33,54 Z" fill="${c}"/>`
const mono = (c) => `<circle cx="60" cy="14" r="16" fill="${c}"/>${corto(c)}`
const calvo = () => ''
const trenza = (c) => `${corto(c)}<path d="M34,42 Q22,60 26,104 L42,104 Q38,64 46,46 Z" fill="${c}"/><path d="M86,42 Q98,60 94,104 L78,104 Q82,64 74,46 Z" fill="${c}"/>`

// Accesorios: mismo criterio — silueta, y grande.
const gorra = (c) => `<path d="M27,44 Q27,14 60,14 Q93,14 93,44 Z" fill="${c}"/><path d="M27,44 L2,52 L4,36 L27,36 Z" fill="${c}"/>`
const sombrero = (c) => `<path d="M31,44 Q31,12 60,12 Q89,12 89,44 Z" fill="${c}"/><ellipse cx="60" cy="46" rx="56" ry="10" fill="${c}"/>`
const gafas = () => `<circle cx="49" cy="54" r="13" fill="none" stroke="#1F2430" stroke-width="5"/><circle cx="71" cy="54" r="13" fill="none" stroke="#1F2430" stroke-width="5"/><path d="M62,54 L58,54" stroke="#1F2430" stroke-width="5"/>`
const barba = (p) => `<path d="M31,54 Q31,100 60,100 Q89,100 89,54 Q89,82 60,82 Q31,82 31,54 Z" fill="${p}"/>`
/* La cola del pañuelo va PEGADA y hacia abajo. Saliendo en punta hacia fuera
   parecía un fallo de dibujo, no una tela. */
const panuelo = (c) => `<path d="M27,54 Q27,14 60,14 Q93,14 93,54 Q93,30 60,30 Q27,30 27,54 Z" fill="${c}"/><path d="M88,48 Q104,58 98,76 L84,66 Z" fill="${c}"/>`
const casco = (c) => `<path d="M28,48 Q28,12 60,12 Q92,12 92,48 Z" fill="${c}"/><rect x="12" y="44" width="96" height="11" rx="5.5" fill="${c}"/>`
const toque = (c) => `<path d="M30,44 Q30,6 60,6 Q90,6 90,44 Z" fill="${c}"/><rect x="28" y="40" width="64" height="12" rx="6" fill="${c}"/>`

/** Un símbolo grande y macizo sobre fondo plano. Nada por debajo de 4 de grosor. */
const simbolo = (bg, cuerpo) =>
  `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="${bg}"/>${cuerpo}</svg>`

export const AVATAR_CATEGORIES = [
  { id: 'gente', nombre: 'Personas' },
  { id: 'oficios', nombre: 'Oficios' },
  { id: 'animales', nombre: 'Animales' },
  { id: 'dinero', nombre: 'Dinero y negocio' },
  { id: 'naturaleza', nombre: 'Naturaleza' },
  { id: 'comida', nombre: 'Comida' },
  { id: 'formas', nombre: 'Formas' },
]

export const AVATARS = [
  // ═══ PERSONAS (14) ════════════════════════════════════════════════════════
  // Siete tonos de piel y siete siluetas de pelo, combinados para que no haya
  // dos iguales ni a 32px ni a 72.
  { id: 'p-corto-negro', nombre: 'Pelo corto', categoria: 'gente',
    svg: persona({ bg: F.indigo, piel: P[0], pelo: corto(PELO.negro), ropa: '#2C3A86' }) },
  { id: 'p-largo-castano', nombre: 'Pelo largo', categoria: 'gente',
    svg: persona({ bg: F.teal, piel: P[1], pelo: largo(PELO.castano), ropa: '#186670' }) },
  { id: 'p-rizado', nombre: 'Rizado', categoria: 'gente',
    svg: persona({ bg: F.mostaza, piel: P[4], pelo: rizado(PELO.negro), ropa: '#8F5F14' }) },
  { id: 'p-mono', nombre: 'Moño', categoria: 'gente',
    svg: persona({ bg: F.vino, piel: P[2], pelo: mono(PELO.negro), ropa: '#6E2C47' }) },
  { id: 'p-trenzas', nombre: 'Trenzas', categoria: 'gente',
    svg: persona({ bg: F.verde, piel: P[5], pelo: trenza(PELO.negro), ropa: '#236345' }) },
  { id: 'p-gafas', nombre: 'Con gafas', categoria: 'gente',
    svg: persona({ bg: F.azul, piel: P[1], pelo: corto(PELO.castano), encima: gafas(), ropa: '#21548A' }) },
  { id: 'p-barba', nombre: 'Con barba', categoria: 'gente',
    svg: persona({ bg: F.ladrillo, piel: P[2], pelo: corto(PELO.negro), encima: barba(PELO.negro), ropa: '#8E3625' }) },
  { id: 'p-canas', nombre: 'Canas', categoria: 'gente',
    svg: persona({ bg: F.pizarra, piel: P[0], pelo: corto(PELO.gris), encima: barba(PELO.gris), ropa: '#38414F' }) },
  { id: 'p-panuelo', nombre: 'Con pañuelo', categoria: 'gente',
    svg: persona({ bg: F.morado, piel: P[3], pelo: calvo(), encima: panuelo('#E8B4C8'), ropa: '#553399' }) },
  /* Naranja y no azul: el azul se lo quedó «Sin pelo», que lo necesita más —su
     piel es la más oscura y ahí es donde hace falta la diferencia de tono. Aquí
     el contraste lo pone la gorra negra, no el fondo. */
  { id: 'p-gorra', nombre: 'Con gorra', categoria: 'gente',
    svg: persona({ bg: F.naranja, piel: P[3], pelo: calvo(), encima: gorra('#1F2430'), ropa: '#9A4519' }) },
  { id: 'p-sombrero', nombre: 'Con sombrero', categoria: 'gente',
    svg: persona({ bg: F.oliva, piel: P[4], pelo: calvo(), encima: sombrero('#E8D9B0'), ropa: '#485F22' }) },
  { id: 'p-rubio', nombre: 'Rubio', categoria: 'gente',
    svg: persona({ bg: F.ciruela, piel: P[0], pelo: largo(PELO.rubio), ropa: '#63326F' }) },
  { id: 'p-rojizo', nombre: 'Pelirrojo', categoria: 'gente',
    svg: persona({ bg: F.carbon, piel: P[1], pelo: rizado(PELO.rojizo), ropa: '#1F2836' }) },
  /* ⚠ La piel más oscura pide el fondo con MÁS diferencia de tono, no el más
     parecido. Estaba en naranja: marrón sobre marrón, y a 32px era una mancha.
     El azul claro la recorta. */
  { id: 'p-calvo', nombre: 'Sin pelo', categoria: 'gente',
    svg: persona({ bg: F.cielo, piel: P[6], pelo: calvo(), ropa: '#1F6E96' }) },

  // ═══ OFICIOS (8) ══════════════════════════════════════════════════════════
  // El mundo de quien usa esto: el cobrador de la moto, la del granero, el del
  // taller. Aquí es donde el juego deja de parecer genérico.
  { id: 'o-cobrador', nombre: 'Cobrador', categoria: 'oficios',
    svg: persona({ bg: F.carbon, piel: P[2], pelo: calvo(), encima: casco('#D64545'), ropa: '#C05621' }) },
  /* El delantal iba DOS veces —como `ropa` y otra vez encima— así que tapaba
     media figura de blanco. Ahora es una sola pieza con su peto. */
  { id: 'o-tendero', nombre: 'Tendero', categoria: 'oficios',
    svg: persona({ bg: F.mostaza, piel: P[1], pelo: corto(PELO.negro), encima: `<path d="M46,88 L74,88 L74,104 L46,104 Z" fill="#F2EFE6"/>`, ropa: '#3A6EA5' }) },
  { id: 'o-campo', nombre: 'Del campo', categoria: 'oficios',
    svg: persona({ bg: F.verde, piel: P[4], pelo: calvo(), encima: sombrero('#E8D9B0'), ropa: '#2C6B4A' }) },
  { id: 'o-taller', nombre: 'Mecánico', categoria: 'oficios',
    svg: persona({ bg: F.pizarra, piel: P[3], pelo: calvo(), encima: gorra('#2B6CB0'), ropa: '#2B6CB0' }) },
  { id: 'o-costura', nombre: 'Costurera', categoria: 'oficios',
    svg: persona({ bg: F.teal, piel: P[2], pelo: mono(PELO.castano), ropa: '#E8B4C8' }) },
  { id: 'o-obra', nombre: 'Constructor', categoria: 'oficios',
    svg: persona({ bg: F.cielo, piel: P[5], pelo: calvo(), encima: casco('#E8A33D'), ropa: '#D97706' }) },
  /* Pelo negro + barba negra + ropa negra dejaban la cara flotando en un
     borrón. La barba pasa a castaño y la ropa a claro: la silueta se lee. */
  { id: 'o-barberia', nombre: 'Barbero', categoria: 'oficios',
    svg: persona({ bg: F.ciruela, piel: P[1], pelo: corto(PELO.negro), encima: barba(PELO.castano), ropa: '#E8DCEF' }) },
  { id: 'o-panaderia', nombre: 'Panadero', categoria: 'oficios',
    svg: persona({ bg: F.cafe, piel: P[0], pelo: calvo(), encima: toque('#F5F2E8'), ropa: '#D9CBB8' }) },

  // ═══ ANIMALES (10) ════════════════════════════════════════════════════════
  // Orejas y hocico: a 32px eso es lo único que separa un gato de un oso.
  { id: 'a-gato', nombre: 'Gato', categoria: 'animales',
    svg: simbolo(F.mostaza, `<path d="M30,50 L26,20 L48,34 Z" fill="#F0A94A"/><path d="M90,50 L94,20 L72,34 Z" fill="#F0A94A"/><circle cx="60" cy="64" r="34" fill="#F0A94A"/><circle cx="48" cy="58" r="5" fill="#1F2430"/><circle cx="72" cy="58" r="5" fill="#1F2430"/><path d="M54,74 L66,74 L60,82 Z" fill="#1F2430"/><path d="M22,68 L42,72 M22,80 L42,78 M98,68 L78,72 M98,80 L78,78" stroke="#1F2430" stroke-width="4" stroke-linecap="round"/>`) },
  { id: 'a-perro', nombre: 'Perro', categoria: 'animales',
    svg: simbolo(F.cafe, `<path d="M22,40 Q14,78 34,84 L40,50 Z" fill="#C89060"/><path d="M98,40 Q106,78 86,84 L80,50 Z" fill="#C89060"/><circle cx="60" cy="62" r="34" fill="#E0B080"/><circle cx="48" cy="56" r="5" fill="#1F2430"/><circle cx="72" cy="56" r="5" fill="#1F2430"/><ellipse cx="60" cy="76" rx="10" ry="8" fill="#1F2430"/>`) },
  { id: 'a-oso', nombre: 'Oso', categoria: 'animales',
    svg: simbolo(F.pizarra, `<circle cx="30" cy="34" r="16" fill="#8A6248"/><circle cx="90" cy="34" r="16" fill="#8A6248"/><circle cx="60" cy="64" r="36" fill="#A57A5A"/><circle cx="48" cy="58" r="5" fill="#1F2430"/><circle cx="72" cy="58" r="5" fill="#1F2430"/><ellipse cx="60" cy="78" rx="16" ry="12" fill="#E0C4A8"/><ellipse cx="60" cy="74" rx="7" ry="5" fill="#1F2430"/>`) },
  { id: 'a-zorro', nombre: 'Zorro', categoria: 'animales',
    svg: simbolo(F.carbon, `<path d="M24,44 L20,12 L48,30 Z" fill="#D9722F"/><path d="M96,44 L100,12 L72,30 Z" fill="#D9722F"/><path d="M60,30 Q94,38 88,66 Q80,98 60,100 Q40,98 32,66 Q26,38 60,30 Z" fill="#E8843A"/><path d="M60,66 Q84,70 78,84 Q70,98 60,100 Q50,98 42,84 Q36,70 60,66 Z" fill="#F5EDE4"/><circle cx="46" cy="60" r="5" fill="#1F2430"/><circle cx="74" cy="60" r="5" fill="#1F2430"/><ellipse cx="60" cy="80" rx="8" ry="6" fill="#1F2430"/>`) },
  { id: 'a-conejo', nombre: 'Conejo', categoria: 'animales',
    svg: simbolo(F.morado, `<ellipse cx="44" cy="26" rx="11" ry="26" fill="#F0EAF5"/><ellipse cx="76" cy="26" rx="11" ry="26" fill="#F0EAF5"/><ellipse cx="44" cy="28" rx="5" ry="17" fill="#E0A8C0"/><ellipse cx="76" cy="28" rx="5" ry="17" fill="#E0A8C0"/><circle cx="60" cy="70" r="32" fill="#F5F0F8"/><circle cx="49" cy="66" r="5" fill="#1F2430"/><circle cx="71" cy="66" r="5" fill="#1F2430"/><path d="M54,82 L66,82 L60,88 Z" fill="#E0A8C0"/>`) },
  { id: 'a-panda', nombre: 'Panda', categoria: 'animales',
    svg: simbolo(F.teal, `<circle cx="28" cy="34" r="16" fill="#1F2430"/><circle cx="92" cy="34" r="16" fill="#1F2430"/><circle cx="60" cy="64" r="36" fill="#F7F5F2"/><ellipse cx="46" cy="58" rx="12" ry="14" fill="#1F2430"/><ellipse cx="74" cy="58" rx="12" ry="14" fill="#1F2430"/><circle cx="46" cy="58" r="5" fill="#F7F5F2"/><circle cx="74" cy="58" r="5" fill="#F7F5F2"/><ellipse cx="60" cy="80" rx="9" ry="7" fill="#1F2430"/>`) },
  { id: 'a-leon', nombre: 'León', categoria: 'animales',
    svg: simbolo(F.ladrillo, `<circle cx="60" cy="60" r="44" fill="#B5651D"/><circle cx="60" cy="62" r="30" fill="#E8A33D"/><circle cx="49" cy="56" r="5" fill="#1F2430"/><circle cx="71" cy="56" r="5" fill="#1F2430"/><path d="M52,72 L68,72 L60,80 Z" fill="#1F2430"/><path d="M36,76 Q48,84 60,80 Q72,84 84,76" fill="none" stroke="#8B4513" stroke-width="4" stroke-linecap="round"/>`) },
  { id: 'a-buho', nombre: 'Búho', categoria: 'animales',
    svg: simbolo(F.indigo, `<path d="M26,40 L34,16 L48,32 Z" fill="#7A6A52"/><path d="M94,40 L86,16 L72,32 Z" fill="#7A6A52"/><ellipse cx="60" cy="66" rx="36" ry="38" fill="#9A8768"/><circle cx="46" cy="58" r="14" fill="#F5F0E4"/><circle cx="74" cy="58" r="14" fill="#F5F0E4"/><circle cx="46" cy="58" r="7" fill="#1F2430"/><circle cx="74" cy="58" r="7" fill="#1F2430"/><path d="M54,76 L66,76 L60,88 Z" fill="#D9A441"/>`) },
  { id: 'a-pinguino', nombre: 'Pingüino', categoria: 'animales',
    svg: simbolo(F.cielo, `<ellipse cx="60" cy="64" rx="36" ry="40" fill="#1F2430"/><ellipse cx="60" cy="74" rx="24" ry="30" fill="#F7F5F2"/><circle cx="49" cy="52" r="5" fill="#F7F5F2"/><circle cx="71" cy="52" r="5" fill="#F7F5F2"/><path d="M52,64 L68,64 L60,74 Z" fill="#E8A33D"/>`) },
  { id: 'a-rana', nombre: 'Rana', categoria: 'animales',
    svg: simbolo(F.oliva, `<circle cx="38" cy="34" r="15" fill="#6BA83A"/><circle cx="82" cy="34" r="15" fill="#6BA83A"/><circle cx="38" cy="34" r="7" fill="#1F2430"/><circle cx="82" cy="34" r="7" fill="#1F2430"/><ellipse cx="60" cy="72" rx="38" ry="32" fill="#7CB342"/><path d="M38,76 Q60,92 82,76" fill="none" stroke="#1F2430" stroke-width="5" stroke-linecap="round"/>`) },

  // ═══ DINERO Y NEGOCIO (8) ═════════════════════════════════════════════════
  // La sección que faltaba, y la que más pega con lo que hace esta gente.
  { id: 'd-billete', nombre: 'Billete', categoria: 'dinero',
    svg: simbolo(F.verde, `<rect x="18" y="38" width="84" height="46" rx="7" fill="#F2F7F0"/><circle cx="60" cy="61" r="14" fill="#4C9A5E"/><path d="M60,52 L60,70 M55,56 Q65,56 65,61 Q65,66 55,66" fill="none" stroke="#F2F7F0" stroke-width="4" stroke-linecap="round"/><circle cx="30" cy="50" r="4" fill="#9CC3A5"/><circle cx="90" cy="72" r="4" fill="#9CC3A5"/>`) },
  { id: 'd-moneda', nombre: 'Moneda', categoria: 'dinero',
    svg: simbolo(F.carbon, `<circle cx="60" cy="60" r="40" fill="#E8B33D"/><circle cx="60" cy="60" r="31" fill="#F2CC66"/><path d="M60,42 L60,78 M52,49 Q70,49 70,58 Q70,66 52,66 Q52,74 70,74" fill="none" stroke="#A87A16" stroke-width="6" stroke-linecap="round"/>`) },
  { id: 'd-alcancia', nombre: 'Alcancía', categoria: 'dinero',
    svg: simbolo(F.vino, `<ellipse cx="58" cy="66" rx="38" ry="29" fill="#F0A8C0"/><path d="M88,52 L104,44 L98,62 Z" fill="#F0A8C0"/><rect x="46" y="34" width="24" height="7" rx="3" fill="#D97FA0"/><circle cx="42" cy="62" r="5" fill="#1F2430"/><ellipse cx="90" cy="70" rx="8" ry="6" fill="#D97FA0"/><rect x="30" y="90" width="10" height="12" rx="3" fill="#D97FA0"/><rect x="72" y="90" width="10" height="12" rx="3" fill="#D97FA0"/>`) },
  { id: 'd-caja', nombre: 'Caja fuerte', categoria: 'dinero',
    svg: simbolo(F.pizarra, `<rect x="20" y="24" width="80" height="72" rx="9" fill="#8A94A6"/><rect x="30" y="34" width="60" height="52" rx="6" fill="#5A6478"/><circle cx="60" cy="60" r="15" fill="#D9DEE6"/><circle cx="60" cy="60" r="6" fill="#5A6478"/><path d="M60,45 L60,38 M60,82 L60,75 M45,60 L38,60 M82,60 L75,60" stroke="#D9DEE6" stroke-width="5" stroke-linecap="round"/>`) },
  { id: 'd-grafica', nombre: 'Crecimiento', categoria: 'dinero',
    svg: simbolo(F.teal, `<rect x="22" y="66" width="18" height="32" rx="4" fill="#9EDCD4"/><rect x="51" y="48" width="18" height="50" rx="4" fill="#C4EDE7"/><rect x="80" y="28" width="18" height="70" rx="4" fill="#F0FBF9"/><path d="M26,44 L62,26 L98,14" fill="none" stroke="#F5D76E" stroke-width="6" stroke-linecap="round"/>`) },
  { id: 'd-maletin', nombre: 'Maletín', categoria: 'dinero',
    svg: simbolo(F.cafe, `<path d="M44,32 L44,24 Q44,18 50,18 L70,18 Q76,18 76,24 L76,32" fill="none" stroke="#D9B48F" stroke-width="6"/><rect x="16" y="34" width="88" height="60" rx="9" fill="#C89060"/><rect x="16" y="56" width="88" height="10" fill="#8A6248"/><rect x="52" y="52" width="16" height="18" rx="4" fill="#E8D0B8"/>`) },
  { id: 'd-recibo', nombre: 'Recibo', categoria: 'dinero',
    svg: simbolo(F.azul, `<path d="M26,16 L94,16 L94,96 L82,88 L70,96 L58,88 L46,96 L34,88 L26,96 Z" fill="#F5F7FA"/><path d="M40,40 L80,40 M40,56 L80,56 M40,72 L66,72" stroke="#7A93B5" stroke-width="6" stroke-linecap="round"/>`) },
  { id: 'd-cuaderno', nombre: 'Cuaderno', categoria: 'dinero',
    svg: simbolo(F.ladrillo, `<rect x="26" y="18" width="72" height="86" rx="8" fill="#F0EDE4"/><rect x="26" y="18" width="14" height="86" rx="7" fill="#D64545"/><path d="M52,42 L86,42 M52,60 L86,60 M52,78 L72,78" stroke="#A8A296" stroke-width="6" stroke-linecap="round"/>`) },

  // ═══ NATURALEZA (6) ═══════════════════════════════════════════════════════
  { id: 'n-sol', nombre: 'Sol', categoria: 'naturaleza',
    svg: simbolo(F.azul, `<circle cx="60" cy="60" r="26" fill="#F5C242"/><path d="M60,16 L60,4 M60,116 L60,104 M16,60 L4,60 M116,60 L104,60 M29,29 L20,20 M100,100 L91,91 M91,29 L100,20 M20,100 L29,91" stroke="#F5C242" stroke-width="7" stroke-linecap="round"/>`) },
  { id: 'n-luna', nombre: 'Luna', categoria: 'naturaleza',
    svg: simbolo(F.indigo, `<path d="M76,20 Q44,26 44,60 Q44,94 76,100 Q40,104 30,68 Q22,30 76,20 Z" fill="#F0EDD8"/><circle cx="86" cy="38" r="4" fill="#F0EDD8"/><circle cx="94" cy="62" r="3" fill="#F0EDD8"/>`) },
  { id: 'n-arbol', nombre: 'Árbol', categoria: 'naturaleza',
    svg: simbolo(F.cielo, `<rect x="53" y="66" width="14" height="38" rx="4" fill="#7A5230"/><circle cx="60" cy="46" r="30" fill="#3E9B5F"/><circle cx="38" cy="60" r="19" fill="#4CAF6E"/><circle cx="82" cy="60" r="19" fill="#4CAF6E"/>`) },
  { id: 'n-montana', nombre: 'Montaña', categoria: 'naturaleza',
    svg: simbolo(F.teal, `<path d="M4,96 L44,34 L70,74 L86,52 L116,96 Z" fill="#5A6478"/><path d="M44,34 L58,56 L30,56 Z" fill="#F0F4F8"/><path d="M86,52 L96,68 L76,68 Z" fill="#F0F4F8"/>`) },
  { id: 'n-flor', nombre: 'Flor', categoria: 'naturaleza',
    svg: simbolo(F.morado, `<circle cx="60" cy="30" r="17" fill="#F5B8CE"/><circle cx="90" cy="60" r="17" fill="#F5B8CE"/><circle cx="60" cy="90" r="17" fill="#F5B8CE"/><circle cx="30" cy="60" r="17" fill="#F5B8CE"/><circle cx="60" cy="60" r="16" fill="#F5C242"/>`) },
  { id: 'n-cactus', nombre: 'Cactus', categoria: 'naturaleza',
    svg: simbolo(F.mostaza, `<rect x="48" y="26" width="24" height="72" rx="12" fill="#3E9B5F"/><path d="M48,54 L30,54 Q22,54 22,64 L22,74" fill="none" stroke="#3E9B5F" stroke-width="14" stroke-linecap="round"/><path d="M72,44 L90,44 Q98,44 98,54 L98,66" fill="none" stroke="#3E9B5F" stroke-width="14" stroke-linecap="round"/>`) },

  // ═══ COMIDA (6) ═══════════════════════════════════════════════════════════
  { id: 'c-cafe', nombre: 'Café', categoria: 'comida',
    svg: simbolo(F.cafe, `<path d="M26,44 L88,44 L84,90 Q82,100 70,100 L44,100 Q32,100 30,90 Z" fill="#F0EDE4"/><path d="M88,54 Q106,54 106,68 Q106,82 88,82" fill="none" stroke="#F0EDE4" stroke-width="8"/><path d="M32,58 L84,58 L81,86 Q80,92 72,92 L44,92 Q36,92 35,86 Z" fill="#5A3A22"/>`) },
  { id: 'c-pan', nombre: 'Pan', categoria: 'comida',
    svg: simbolo(F.oliva, `<ellipse cx="60" cy="62" rx="42" ry="28" fill="#D9A441"/><ellipse cx="60" cy="56" rx="42" ry="24" fill="#E8BC63"/><path d="M34,50 L44,42 M56,48 L66,40 M78,50 L88,42" stroke="#B5822A" stroke-width="5" stroke-linecap="round"/>`) },
  { id: 'c-fruta', nombre: 'Fruta', categoria: 'comida',
    svg: simbolo(F.ladrillo, `<circle cx="60" cy="66" r="34" fill="#E8524A"/><path d="M60,32 Q56,18 44,14" fill="none" stroke="#5A7D2A" stroke-width="6" stroke-linecap="round"/><path d="M62,30 Q78,18 92,26 Q80,40 62,32 Z" fill="#5A9B34"/><ellipse cx="48" cy="54" rx="8" ry="11" fill="#F0908A" opacity=".6"/>`) },
  { id: 'c-helado', nombre: 'Helado', categoria: 'comida',
    svg: simbolo(F.cielo, `<path d="M42,58 L78,58 L60,104 Z" fill="#D9A441"/><circle cx="46" cy="48" r="18" fill="#F5B8CE"/><circle cx="74" cy="48" r="18" fill="#F0EDD8"/><circle cx="60" cy="34" r="18" fill="#9AD9C4"/>`) },
  { id: 'c-arepa', nombre: 'Arepa', categoria: 'comida',
    svg: simbolo(F.mostaza, `<circle cx="60" cy="60" r="38" fill="#F0DCA8"/><circle cx="60" cy="60" r="30" fill="#F5E8C4"/><path d="M40,48 Q60,42 80,48" fill="none" stroke="#D9BE7A" stroke-width="5" stroke-linecap="round"/><path d="M38,72 Q60,78 82,72" fill="none" stroke="#D9BE7A" stroke-width="5" stroke-linecap="round"/>`) },
  { id: 'c-pizza', nombre: 'Pizza', categoria: 'comida',
    svg: simbolo(F.rojo, `<path d="M60,14 L104,96 L16,96 Z" fill="#F0DCA8"/><path d="M60,30 L94,92 L26,92 Z" fill="#E8A33D"/><circle cx="60" cy="56" r="7" fill="#C0392B"/><circle cx="44" cy="78" r="7" fill="#C0392B"/><circle cx="76" cy="78" r="7" fill="#C0392B"/>`) },

  // ═══ FORMAS (8) ═══════════════════════════════════════════════════════════
  // Las que nunca fallan a ningún tamaño, y las más sobrias para quien no
  // quiere una carita en su perfil de trabajo.
  { id: 'f-anillos', nombre: 'Anillos', categoria: 'formas',
    svg: simbolo(F.indigo, `<circle cx="60" cy="60" r="38" fill="none" stroke="#8FA0E8" stroke-width="9"/><circle cx="60" cy="60" r="19" fill="#F0EDD8"/>`) },
  { id: 'f-diagonal', nombre: 'Diagonal', categoria: 'formas',
    svg: simbolo(F.teal, `<path d="M0,120 L120,0 L120,44 L44,120 Z" fill="#9AD9C4"/>`) },
  { id: 'f-cuartos', nombre: 'Cuartos', categoria: 'formas',
    svg: simbolo(F.vino, `<path d="M60,0 A60,60 0 0,1 120,60 L60,60 Z" fill="#F0A8C0"/><path d="M60,120 A60,60 0 0,1 0,60 L60,60 Z" fill="#F0EDD8"/>`) },
  { id: 'f-ondas', nombre: 'Ondas', categoria: 'formas',
    svg: simbolo(F.azul, `<path d="M0,72 Q30,50 60,72 Q90,94 120,72 L120,120 L0,120 Z" fill="#7FB5E0"/><path d="M0,92 Q30,70 60,92 Q90,114 120,92 L120,120 L0,120 Z" fill="#D8ECF8"/>`) },
  { id: 'f-rombo', nombre: 'Rombo', categoria: 'formas',
    svg: simbolo(F.carbon, `<path d="M60,18 L102,60 L60,102 L18,60 Z" fill="#E8B33D"/><path d="M60,40 L80,60 L60,80 L40,60 Z" fill="#2D3748"/>`) },
  { id: 'f-rayas', nombre: 'Rayas', categoria: 'formas',
    svg: simbolo(F.oliva, `<path d="M12,120 L52,0 L74,0 L34,120 Z" fill="#C9DE9A"/><path d="M66,120 L106,0 L120,0 L120,20 L88,120 Z" fill="#EDF5DC"/>`) },
  { id: 'f-sol-abstracto', nombre: 'Rayos', categoria: 'formas',
    svg: simbolo(F.naranja, `<circle cx="60" cy="60" r="22" fill="#F5E0C4"/><path d="M60,4 L72,30 L60,26 L48,30 Z M60,116 L48,90 L60,94 L72,90 Z M4,60 L30,48 L26,60 L30,72 Z M116,60 L90,72 L94,60 L90,48 Z" fill="#F5C242"/>`) },
  { id: 'f-cuadros', nombre: 'Cuadros', categoria: 'formas',
    svg: simbolo(F.ciruela, `<rect x="14" y="14" width="42" height="42" rx="8" fill="#E0BFE8"/><rect x="64" y="64" width="42" height="42" rx="8" fill="#E0BFE8"/><rect x="64" y="14" width="42" height="42" rx="8" fill="#F5EDF8"/><rect x="14" y="64" width="42" height="42" rx="8" fill="#F5EDF8"/>`) },
]

/* ══ ⚠ NADIE PIERDE SU AVATAR AL CAMBIAR EL JUEGO ══════════════════════════
 *
 * Medido en producción antes de tocar nada: **27 usuarios tienen avatar
 * elegido, y 23 de ellos ya lo tenían roto.** Sus ids —`lightning`, `crown`,
 * `bars`, `eagle`, `gem`, `bull`…— son de un juego ANTERIOR al que acabo de
 * reemplazar. `getAvatarById` devolvía `null` y les salían las iniciales, sin
 * decir nada. Cambiar el juego otra vez sin mapa habría dejado a los 27 así.
 *
 * Esta tabla traduce los ids viejos —los dos juegos— al más parecido de ahora.
 * No se borra cuando ya «no haga falta»: mientras alguien tenga uno guardado en
 * la base, hace falta.
 */
const HEREDADOS = {
  // ── Juego 1 (símbolos), el que dejó a 23 personas con las iniciales ──
  lightning: 'f-sol-abstracto', bars: 'd-grafica', chart: 'd-grafica', crown: 'd-moneda',
  coin: 'd-moneda', diamond: 'f-rombo', gem: 'f-rombo', pyramid: 'n-montana',
  star: 'f-sol-abstracto', eagle: 'a-buho', eye: 'f-anillos', bull: 'a-leon',

  // ── Juego 2 (personajes con dueño + caritas) ──
  ironman: 'f-rombo', capitan: 'f-anillos', spiderman: 'f-sol-abstracto', wolverine: 'a-leon',
  pantera: 'a-gato', thor: 'f-sol-abstracto', hulk: 'a-rana', deadpool: 'f-rombo',
  thanos: 'f-cuartos', venom: 'f-rombo',
  mike: 'a-rana', stitch: 'a-conejo', osito: 'a-oso', grogu: 'a-buho',
  baymax: 'f-anillos', olaf: 'n-montana', jack: 'f-cuartos', elsa: 'p-rubio',
  feliz: 'p-corto-negro', cool: 'p-gafas', amor: 'p-largo-castano',
  risa: 'p-rizado', guino: 'p-gorra', dormido: 'n-luna',
  paleta: 'c-helado', hotdog: 'c-pan', helado: 'c-helado', galleta: 'c-pan',
  pizza: 'c-pizza', palomitas: 'c-pan', dona: 'c-arepa', hamburguesa: 'c-pizza',
  taco: 'c-arepa', sushi: 'c-fruta',
  gato: 'a-gato', panda: 'a-panda', zorro: 'a-zorro', leon: 'a-leon',
  conejo: 'a-conejo', koala: 'a-oso', pinguino: 'a-pinguino', dinosaurio: 'a-rana',
  sol: 'n-sol', hongo: 'n-arbol', flor: 'n-flor', nube: 'n-luna',
  cactus: 'n-cactus', aguacate: 'c-fruta',
  unicornio: 'a-conejo', mono: 'a-perro', alien: 'f-anillos', ninja: 'p-panuelo',
  astronauta: 'f-anillos', pirata: 'p-panuelo', fantasma: 'f-cuartos', estrella: 'f-sol-abstracto',
}

export function getAvatarById(id) {
  if (!id) return null
  const directo = AVATARS.find((a) => a.id === id)
  if (directo) return directo
  const heredado = HEREDADOS[id]
  return heredado ? AVATARS.find((a) => a.id === heredado) ?? null : null
}

/** Los ids que ya no existen pero se siguen resolviendo. Lo usa la prueba. */
export const IDS_HEREDADOS = HEREDADOS
