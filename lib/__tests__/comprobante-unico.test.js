import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── UN SOLO COMPROBANTE DE «PAGO REGISTRADO» ────────────────────────────────
//
// El dueño:
//   «el modal de pago registrado es diferente en varios lugares… desde las rutas
//    sale el nuevo, y desde el préstamo con el botón grande de registrar pago
//    sale otro que es el antiguo… necesito consistencia y no tener dos modales
//    de pago registrado»
//
// Tenía razón, y había un tercer camino que no mencionó: el cobro por QR, que
// monta el mismo `RegistrarPago` y salía igual de viejo.
//
// La causa: la migración a las pantallas del rediseño se hizo para la CAPTURA
// del pago (`RegistrarCobro`, `AbonoPorDias`, `Gestion`) y se quedó a medias —
// la pantalla de ÉXITO nunca se cambió, y encima no era un componente sino JSX
// escrito a mano dentro de `RegistrarPago.jsx`. Es el mismo desajuste que ya se
// corrigió con Recargo/Descuento: «se pulsaba una fila del menú rediseñado y
// encima aparecía la pantalla vieja».

const RAIZ = process.cwd()
const registrar = readFileSync(resolve(RAIZ, 'components/prestamos/RegistrarPago.jsx'), 'utf8')
const ruta = readFileSync(resolve(RAIZ, 'app/(dashboard)/rutas/[id]/page.jsx'), 'utf8')
const qr = readFileSync(resolve(RAIZ, 'components/qr/QrCobroModal.jsx'), 'utf8')
const recibo = readFileSync(resolve(RAIZ, 'components/pantallas/Recibo.jsx'), 'utf8')

describe('los tres caminos sacan el mismo comprobante', () => {
  it('la ficha del préstamo monta `pantallas/Recibo`', () => {
    expect(registrar).toMatch(/import \{ Recibo \} from '@\/components\/pantallas\/Recibo'/)
    expect(registrar).toMatch(/<Recibo\b/)
  })

  it('el cobro desde la ruta también, como ya hacía', () => {
    expect(ruta).toMatch(/import \{ Recibo \}\s+from '@\/components\/pantallas\/Recibo'/)
  })

  it('y el cobro por QR lo hereda: usa el mismo RegistrarPago', () => {
    // No necesita cambio propio, pero si alguien le pusiera un comprobante
    // aparte volveríamos a tener dos.
    expect(qr).toMatch(/import RegistrarPago from '@\/components\/prestamos\/RegistrarPago'/)
    expect(qr, 'el QR se montó su propio comprobante').not.toMatch(/Pago registrado/)
  })

  it('ya no queda el comprobante escrito a mano', () => {
    /* Se reconoce por su título calculado con el ternario de cinco ramas dentro
       de un `<Modal title=…>`. Si vuelve, vuelven los dos comprobantes. */
    expect(registrar, 'volvió el comprobante viejo')
      .not.toMatch(/title=\{\s*\n?\s*tipo === 'recargo' \? 'Recargo aplicado'/)
    // Y el `Modal` genérico ya no envuelve la vista de éxito: el `Recibo` trae
    // su propia cabecera y su botonera, así que el modal le pondría un título
    // encima del suyo y un pie debajo del suyo.
    expect(registrar).toMatch(/return createPortal\(/)
  })
})

describe('no se perdió nada del comprobante viejo', () => {
  /* ⚠ ESTE ES EL BLOQUE QUE IMPORTA. Un rediseño que se lleva funciones por
     delante ya pasó una vez: reemplazar `MoneyInput` por un input propio se
     llevó el modo abreviado, el interruptor seguía encendido sin hacer nada y
     el cobrador creyó que «se le desactivó solo».

     Las cuatro cosas que la pantalla vieja hacía y la nueva no. */

  it('1 · el título dice QUÉ se registró, no siempre «Pago»', () => {
    // Llamar «Pago registrado» a un recargo sería mentir en el papel que el
    // cliente se guarda.
    expect(recibo).toMatch(/titulo = 'Pago registrado'/)
    expect(registrar).toMatch(/tipo === 'recargo' \? 'Recargo aplicado'/)
    expect(registrar).toMatch(/tipo === 'capital' \? 'Abono a capital'/)
    expect(registrar).toMatch(/tipo === 'intereses' \? 'Pago de interés'/)
  })

  it('2 · el pago guardado sin señal se distingue del que ya subió', () => {
    /* El más importante de los cuatro: con el visto verde, el cobrador cree que
       su cobro ya está en el servidor. Reloj ámbar y el texto que lo explica. */
    expect(recibo).toMatch(/offline = false/)
    expect(recibo).toMatch(/guardado en el teléfono · sube solo al recuperar señal/)
    expect(registrar).toMatch(/offline=\{off\}/)
  })

  it('3 · por dónde entró el dinero', () => {
    // Desde que la caja se discrimina por medio de pago, es la línea que ata el
    // recibo con el cuadre.
    expect(recibo).toMatch(/\{medioPago && <Fila etiqueta="Pagó con" valor=\{medioPago\} \/>\}/)
    expect(registrar).toMatch(/Transferencia · \$\{pagoGuardado\.plataforma\}/)
    // En un recargo o un descuento no hay medio: no entró ni salió dinero.
    expect(registrar).toMatch(/!\['recargo', 'descuento'\]\.includes\(tipo\) && pagoGuardado\.metodoPago/)
  })

  it('4 · la foto de evidencia', () => {
    expect(recibo).toMatch(/Adjuntar foto de evidencia/)
    expect(recibo).toMatch(/Foto guardada/)
    expect(registrar).toMatch(/evidencia=\{\(pagoGuardado\?\.id && !off\)/)
    // Sin `id` en el servidor no hay dónde colgarla.
    expect(registrar).toMatch(/subirFotoEvidencia/)
  })

  it('y sigue el dorado único: seguir la ruta', () => {
    /* El aviso de sin señal usa `--cf-gold-tint` («aviso ámbar» según el propio
       fichero de tokens), NO `--cf-gold`. Mi primera versión gastó el dorado
       fuerte y lo cazó `entrada-datos-cotejo`: dos dorados y ninguno destaca. */
    expect((recibo.match(/var\(--cf-gold\)/g) ?? []).length).toBe(1)
    expect(recibo).toMatch(/background: offline \? 'var\(--cf-gold-tint\)'/)
  })
})

describe('«Guardar imagen» e «Imprimir» hacen algo', () => {
  const acciones = readFileSync(resolve(RAIZ, 'lib/recibo-acciones.js'), 'utf8')

  it('las dos acciones viven en un solo sitio', () => {
    /* Estaban pegadas al aspecto dentro de `<BotonImprimirRecibo>` y
       `<BotonCompartirRecibo>`, con la lógica en funciones PRIVADAS del
       fichero. Es exactamente como se coló el fallo de «arreglé el recibo de
       WhatsApp y la imagen se quedó con el error»: cuando algo se ve por varios
       caminos, la lógica va donde todos la alcancen. */
    expect(acciones).toMatch(/export function imprimirRecibo/)
    expect(acciones).toMatch(/export function guardarReciboImagen/)
    const imp = readFileSync(resolve(RAIZ, 'components/ui/BotonImprimirRecibo.jsx'), 'utf8')
    const com = readFileSync(resolve(RAIZ, 'components/ui/BotonCompartirRecibo.jsx'), 'utf8')
    expect(imp).toMatch(/export function generarHTMLRecibo/)
    expect(com).toMatch(/export function dibujarRecibo/)
  })

  it('⚠ y la RUTA los conecta: sus dos botones no hacían nada', () => {
    /* Esto no lo reportó nadie y llevaba ahí desde que se montó la pantalla: el
       `Recibo` de la ruta se montaba SIN `onGuardarImagen` ni `onImprimir`, y
       los botones se pintan igual con o sin función detrás. Apareció al
       unificarlo con la ficha del préstamo, que sí los tenía. */
    expect(ruta, 'la ruta volvió a quedarse sin la acción de guardar')
      .toMatch(/onGuardarImagen=\{\(\) => \{/)
    expect(ruta, 'la ruta volvió a quedarse sin la acción de imprimir')
      .toMatch(/onImprimir=\{\(\) => \{/)
    expect(ruta).toMatch(/guardarReciboImagen\(\{/)
    expect(ruta).toMatch(/imprimirRecibo\(\{/)
  })

  it('y en la ficha llaman a la acción, no a un paso intermedio', () => {
    // El checklist de «qué campos salen en el impreso» sigue existiendo, pero es
    // configuración del cliente: no tiene por qué interponerse cada vez que
    // alguien quiere el papel.
    expect(registrar).toMatch(/onGuardarImagen=\{\(\) => guardarReciboImagen\(\{/)
    expect(registrar).toMatch(/onImprimir=\{\(\) => imprimirRecibo\(\{/)
  })
})
