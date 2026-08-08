import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── DOS COSAS DE CONFIGURACIÓN ──────────────────────────────────────────────
//
// 1 · «los inputs salen pegados al texto que los acompaña. Si dice nombre, sale
//      nombre y el input enseguida pegado»
// 2 · «el ícono avatar que uno selecciona no se está reflejando en la cabecera,
//      siguen saliendo las iniciales»

const RAIZ = process.cwd()

describe('la etiqueta va ENCIMA del campo, no a su lado', () => {
  const src = readFileSync(resolve(RAIZ, 'app/(dashboard)/configuracion/page.jsx'), 'utf8')

  it('las 9 etiquetas son de bloque', () => {
    /* `<label>` es un elemento EN LÍNEA. El contenedor usaba `space-y-1.5`, que
       separa hijos de bloque, y el input lleva `w-full max-w-[560px]` — o sea
       que el input SÍ es bloque y la etiqueta no, así que en escritorio se
       quedaba a su izquierda. En móvil no se notaba porque el input ocupa todo
       el ancho disponible.

       Medido en el navegador a 1440px, antes: etiqueta y campo en la misma
       línea. Después: etiqueta en y=251 y campo en y=273, misma x.

       El `Input` canónico del sistema no necesita `block` porque su contenedor
       es `flex flex-col` (`components/ui/Input.jsx:40`), que fuerza a cada hijo
       a su renglón. Esta pantalla no lo usa. */
    const conBloque = (src.match(/<label className="block text-xs font-medium/g) ?? []).length
    expect(conBloque, 'alguna etiqueta perdió el `block`').toBe(9)
    expect(src, 'quedó una etiqueta en línea')
      .not.toMatch(/<label className="text-xs font-medium text-\[var\(--cf-ink-3\)\]"/)
  })
})

describe('el avatar elegido sale donde tiene que salir', () => {
  it('baja desde el layout SERVIDOR, como el nombre', () => {
    /* Por el mismo motivo que el nombre: leerlo solo de `useSession()` haría que
       el servidor pintara las iniciales y el cliente el dibujo, con parpadeo en
       cada carga. Ese comentario ya estaba en `Armazon.jsx` para el nombre; al
       avatar se le olvidó el mismo tratamiento. */
    const layout = readFileSync(resolve(RAIZ, 'app/(dashboard)/layout.jsx'), 'utf8')
    expect(layout).toMatch(/const avatarId = session\?\.user\?\.avatarId \?\? null/)
    expect(layout).toMatch(/<Armazon [^>]*avatarId=\{avatarId\}/)
    expect(layout, 'la barra lateral no lo recibe').toMatch(/iniciales=\{iniciales\(nombre\)\}\s*\n\s*avatarId=\{avatarId\}/)
  })

  it('el armazón lo reparte a los tres sitios', () => {
    const src = readFileSync(resolve(RAIZ, 'components/armazon/Armazon.jsx'), 'utf8')
    expect(src).toMatch(/avatarId: avatarServidor = null/)
    // ⚠ `??` y no `||`: `null` puede ser a propósito —el usuario le dio a
    // «Quitar»— y con `||` se recuperaría el de la sesión vieja, justo el que
    // acaba de borrar.
    expect(src).toMatch(/const avatarId = avatarServidor \?\? session\?\.user\?\.avatarId \?\? null/)
    expect((src.match(/avatarId=\{avatarId\}/g) ?? []).length,
      'falta pasarlo a la cabecera móvil o a la hoja de cuenta').toBe(2)
  })

  it('y los tres saben pintarlo', () => {
    for (const f of ['components/armazon/CabeceraMovil.jsx',
                     'components/armazon/BarraLateral.jsx',
                     'components/armazon/HojaCuenta.jsx']) {
      const src = readFileSync(resolve(RAIZ, f), 'utf8')
      expect(src, `${f} no importa la lista de avatares`)
        .toMatch(/import \{ getAvatarById \} from '@\/lib\/avatars'/)
      expect(src, `${f} no pinta el dibujo`).toMatch(/dangerouslySetInnerHTML/)
    }
  })

  it('sin avatar —o con uno que ya no existe— vuelven las iniciales', () => {
    /* No es un caso hipotético: en el espejo había un usuario con
       `avatarId: 'chart'`, que NO está en la lista. `getAvatarById` devuelve
       null y se cae a las iniciales, que es lo correcto. Me costó un rato
       entender por qué el móvil no lo pintaba: el id estaba, el avatar no. */
    const src = readFileSync(resolve(RAIZ, 'components/armazon/CabeceraMovil.jsx'), 'utf8')
    expect(src).toMatch(/const dibujo = avatarId \? getAvatarById\(avatarId\) : null/)
    expect(src).toMatch(/\{dibujo \? \(/)
    // La barra y la hoja comprueban las DOS cosas en la misma condición.
    for (const f of ['components/armazon/BarraLateral.jsx', 'components/armazon/HojaCuenta.jsx']) {
      expect(readFileSync(resolve(RAIZ, f), 'utf8'), `${f} no cae a iniciales`)
        .toMatch(/avatarId && getAvatarById\(avatarId\) \?/)
    }
  })
})

// ── EL JUEGO DE AVATARES, REHECHO (8 ago 2026) ──────────────────────────────
//
// «Se ven muy feos… los de ahora están horribles.» Al medirlo había tres cosas
// distintas, y una de ellas no era estética.
describe('los avatares', () => {
  it('⚠ ninguno imita un personaje con dueño', async () => {
    /* El juego anterior traía Iron Man, Capitán, Spider-Man, Wolverine, Pantera
       Negra, Thor, Hulk, Deadpool, Thanos, Venom, Mike Wazowski, Stitch, Pooh,
       Grogu, Baymax, Olaf, Jack y Elsa: 18 de 56, de Marvel, Disney y
       Lucasfilm. En un producto que cobra suscripción eso no es un detalle de
       gusto. */
    const { AVATARS } = await import('@/lib/avatars')
    const prohibidos = /iron ?man|capit[áa]n am|spider|wolverine|pantera negra|thor|hulk|deadpool|thanos|venom|wazowski|stitch|pooh|grogu|baymax|olaf|elsa|mickey|yoda/i
    const culpables = AVATARS.filter((a) => prohibidos.test(a.nombre) || prohibidos.test(a.id))
    expect(culpables.map((a) => a.nombre)).toEqual([])
  })

  it('⚠ nadie pierde el avatar que ya eligió', async () => {
    /* Medido en producción ANTES de tocar nada: 27 usuarios tenían avatar
       elegido y **23 ya lo tenían roto** — sus ids son de un juego todavía más
       viejo (`lightning`, `crown`, `bars`, `eagle`, `gem`, `bull`…), así que
       `getAvatarById` devolvía null y les salían las iniciales sin avisar.

       Cambiar el juego sin mapa habría dejado a los 27 igual. Estos catorce son
       los ids que hay AHORA MISMO en la base de producción. */
    const { getAvatarById } = await import('@/lib/avatars')
    const enUso = ['cool', 'lightning', 'bars', 'crown', 'chart', 'coin', 'venom',
      'diamond', 'pyramid', 'star', 'eagle', 'eye', 'gem', 'bull']
    const sinResolver = enUso.filter((id) => !getAvatarById(id))
    expect(sinResolver, 'ids de usuarios reales que quedarían sin dibujo').toEqual([])
  })

  it('y ningún atajo apunta a un avatar que no existe', async () => {
    // Me pasó escribiendo la tabla: mapeé tres ids a `f-rayos`, que no existe.
    const { IDS_HEREDADOS, AVATARS } = await import('@/lib/avatars')
    const rotos = Object.entries(IDS_HEREDADOS).filter(([, nuevo]) => !AVATARS.some((a) => a.id === nuevo))
    expect(rotos).toEqual([])
  })

  it('⚠ nada más fino de 4, porque a 32px desaparece', async () => {
    /* El juego viejo tenía telarañas de 0,8 y brillos de radio 1. Se pinta a
       **32px** en la cabecera: 120/32 = 3,75, así que un trazo de 0,8 mide 0,2
       píxeles. Por eso Spider-Man, Deadpool y Venom eran el mismo círculo rojo. */
    const { AVATARS } = await import('@/lib/avatars')
    const finos = []
    for (const a of AVATARS) {
      for (const m of a.svg.matchAll(/stroke-width="([\d.]+)"/g)) {
        if (Number(m[1]) < 4) finos.push(`${a.id}: ${m[1]}`)
      }
      for (const m of a.svg.matchAll(/\br="([\d.]+)"/g)) {
        if (Number(m[1]) < 3) finos.push(`${a.id}: r=${m[1]}`)
      }
    }
    expect(finos).toEqual([])
  })

  it('⚠ ningún sombrero le tapa los ojos a nadie', async () => {
    /* El casco, el gorro de cocinero y el ala del sombrero bajaban hasta 52-55,
       y los ojos empiezan en 49,4 (cy 54, radio 4,6). Resultado: caras sin ojos.

       ⚠ NO LO DELATÓ LA HOJA DE PRUEBA — a 32 y 64px un ojo tapado a medias se
       lee como un ojo. Salió al abrir el selector de verdad, donde se ven
       grandes. Los medidores propios también tienen puntos ciegos. */
    const { AVATARS } = await import('@/lib/avatars')
    const OJO = 49.4
    const tapados = []
    for (const a of AVATARS) {
      if (!a.svg.includes('cy="54" r="4.6"')) continue   // solo las caras
      for (const m of a.svg.matchAll(/<(rect|ellipse)[^>]*?(?:y|cy)="([\d.]+)"[^>]*?(?:height|ry)="([\d.]+)"/g)) {
        const fin = Number(m[2]) + Number(m[3])
        if (Number(m[2]) < 45 && fin > OJO) tapados.push(`${a.id}: ${m[1]} llega a ${fin}`)
      }
    }
    expect(tapados).toEqual([])
  })

  it('dos avatares del mismo grupo no comparten fondo', async () => {
    /* A 32px el fondo es medio dibujo. Si dos vecinos lo comparten, se leen
       como el mismo. */
    const { AVATARS, AVATAR_CATEGORIES } = await import('@/lib/avatars')
    const choques = []
    for (const cat of AVATAR_CATEGORIES) {
      const vistos = new Map()
      for (const a of AVATARS.filter((x) => x.categoria === cat.id)) {
        const bg = a.svg.match(/<circle cx="60" cy="60" r="60" fill="([^"]+)"/)?.[1]
        if (bg && vistos.has(bg)) choques.push(`${cat.nombre}: ${vistos.get(bg)} y ${a.id}`)
        else if (bg) vistos.set(bg, a.id)
      }
    }
    expect(choques).toEqual([])
  })
})
