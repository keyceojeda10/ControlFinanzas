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
      /* ⚠ Esta línea exigía `dangerouslySetInnerHTML`, que era CÓMO se pintaba
         entonces. Al pasar los dibujos a archivos, la prueba falló por el
         mecanismo y no por el comportamiento: fijaba la implementación, no el
         resultado. Ahora pide lo que de verdad importa — que el `src` del
         avatar llegue a la pantalla. */
      expect(src, `${f} no pinta el dibujo`).toMatch(/getAvatarById\([^)]*\)\.src|dibujo\.src/)
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

// ── EL JUEGO DE AVATARES ────────────────────────────────────────────────────
//
// Tercer cambio de juego. Los dibujaba yo a mano y el dueño lo zanjó: «quedaron
// mucho peor… ¿será que no podemos descargar avatars en imagen desde algún
// sitio?». Ahora vienen de DiceBear, generados en local con
// `scripts/generar-avatares.mjs`, con licencia CC0 o libre para uso comercial.
describe('los avatares', () => {
  it('⚠ nadie pierde el avatar que ya eligió', async () => {
    /* Medido en producción: 27 usuarios con avatar y **23 ya lo tenían roto**
       antes de tocar nada — sus ids son de un juego de hace dos cambios, así
       que `getAvatarById` devolvía null y salían las iniciales sin avisar.
       Estos catorce son los que hay AHORA MISMO en la base. */
    const { getAvatarById } = await import('@/lib/avatars')
    const enUso = ['cool', 'lightning', 'bars', 'crown', 'chart', 'coin', 'venom',
      'diamond', 'pyramid', 'star', 'eagle', 'eye', 'gem', 'bull']
    expect(enUso.filter((id) => !getAvatarById(id))).toEqual([])
  })

  it('y tampoco los que estuvieron vivos unas horas', async () => {
    // El juego que dibujé yo estuvo en producción un rato: alguien pudo elegirlo.
    const { getAvatarById } = await import('@/lib/avatars')
    for (const id of ['p-corto-negro', 'o-cobrador', 'a-gato', 'd-billete', 'f-rombo']) {
      expect(getAvatarById(id), id).not.toBeNull()
    }
  })

  it('ningún atajo apunta a un avatar que no existe', async () => {
    const { IDS_HEREDADOS, AVATARS } = await import('@/lib/avatars')
    const rotos = Object.entries(IDS_HEREDADOS).filter(([, n]) => !AVATARS.some((a) => a.id === n))
    expect(rotos).toEqual([])
  })

  it('⚠ los dibujos NO viajan dentro del JavaScript', async () => {
    /* Medido: los 96 pesan 550 KB. Incrustados en el módulo se los descarga
       entero cada usuario en cada visita, tenga avatar o no, con la señal que
       tenga. Van como archivos y se pide solo el que hace falta. */
    const { AVATARS } = await import('@/lib/avatars')
    expect(AVATARS.every((a) => typeof a.src === 'string' && a.src.startsWith('/avatars/'))).toBe(true)
    expect(AVATARS.some((a) => 'svg' in a)).toBe(false)
  })

  it('⚠ y ninguna pantalla los incrusta con dangerouslySetInnerHTML', async () => {
    /* DiceBear emite `id="viewboxMask"`, EL MISMO en todos. Metidos varios en
       la misma página, cada `mask="url(#viewboxMask)"` resuelve al PRIMERO del
       documento y los demás se borran: en mi hoja de muestra cinco estilos
       salieron en blanco. En un `<img>` cada SVG es su propio documento. */
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const pantallas = ['components/ui/Avatar.jsx', 'components/armazon/BarraLateral.jsx',
      'components/armazon/CabeceraMovil.jsx', 'components/armazon/HojaCuenta.jsx',
      'app/(dashboard)/configuracion/page.jsx']
    const culpables = pantallas.filter((f) => {
      const src = readFileSync(resolve(process.cwd(), f), 'utf8')
      return /dangerouslySetInnerHTML[^}]*(svg|Avatar)/i.test(src)
    })
    expect(culpables).toEqual([])
  })

  it('cada avatar tiene su archivo en disco', async () => {
    const { AVATARS } = await import('@/lib/avatars')
    const { existsSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const faltan = AVATARS.filter((a) => !existsSync(resolve(process.cwd(), 'public', a.src.slice(1))))
    expect(faltan.map((a) => a.id)).toEqual([])
  })

  it('y la atribución queda escrita donde se pueda encontrar', async () => {
    /* Con CC0 no hace falta, pero avataaars y bottts son «libre para uso
       personal y comercial» de Pablo Stanley: dejar dicho de quién es cuesta un
       archivo de texto. */
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const txt = readFileSync(resolve(process.cwd(), 'public/avatars/LICENCIAS.txt'), 'utf8')
    expect(txt).toMatch(/DiceBear/)
    expect(txt).toMatch(/Pablo Stanley/)
  })
})
