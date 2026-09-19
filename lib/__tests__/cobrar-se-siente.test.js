// «Que cobrar dé ganas» (19 sep 2026). El dueño aprobó, tras diez versiones de
// prototipo, el deslizador donde el monto se arma dígito a dígito y el
// comprobante donde el total del día gira y los billetes caen en la billetera.
//
// Vitest corre sin DOM: el gesto y la animación se miran con playwright en el
// espejo (`.auditoria/_celebrar-cobro.mjs`). Aquí se anclan en CÓDIGO las reglas
// que, rotas, mentirían sobre la plata o volverían a trabar la gama baja.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { haciaDelante } from '@/lib/celebrar'

const leer = (f) => readFileSync(path.join(process.cwd(), f), 'utf8')
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const DESLIZAR = sinComentarios(leer('components/cf/DeslizarParaConfirmar.jsx'))
const LLEVAS = sinComentarios(leer('components/cf/LlevasHoy.jsx'))
const RECIBO = sinComentarios(leer('components/pantallas/Recibo.jsx'))
const PAGO = sinComentarios(leer('components/prestamos/RegistrarPago.jsx'))
const RUTA = sinComentarios(leer('app/(dashboard)/rutas/[id]/page.jsx'))
const TOKENS = leer('app/tokens-2026.css')

describe('el deslizador', () => {
  it('no anima `width`: todo por transform', () => {
    // El relleno animaba `width`, que recalcula la página en cada cuadro del dedo.
    expect(DESLIZAR).not.toMatch(/style\.width\s*=/)
    expect(DESLIZAR).toMatch(/refRelleno\.current\.style\.transform = `translateX\(/)
  })

  it('es la pastilla sólida aprobada, con sus tokens en los dos temas', () => {
    expect(DESLIZAR).toMatch(/background: 'var\(--cf-pista-fondo\)'/)
    for (const t of ['--cf-pista-fondo', '--cf-pista-texto', '--cf-pista-cifra', '--cf-pista-listo']) {
      expect(TOKENS.split(t + ':').length - 1, `${t} tiene que existir en claro y en oscuro`).toBe(2)
    }
  })

  it('el monto se arma sobre rodillos y cada dígito se fija por su marca', () => {
    expect(DESLIZAR).toMatch(/construirRodillos\(refOdo\.current, cifra\)/)
    expect(DESLIZAR).toMatch(/const marca = desde \+ \(fin - desde\) \* \(k \+ 1\) \/ rodillos\.length/)
  })

  it('todas las superficies que mueven plata le pasan el monto', () => {
    const conCifra = [
      'components/pantallas/AtajosCobro.jsx',
      'components/pantallas/RegistrarCobro.jsx',
      'components/pantallas/Gestion.jsx',
      'components/prestamos/RegistrarPago.jsx',
      'app/(dashboard)/prestamos/[id]/page.jsx',
      'app/(dashboard)/prestamos/moratorio/page.jsx',
    ]
    for (const f of conCifra) expect(sinComentarios(leer(f)), f).toMatch(/cifra=\{/)
    // Los pies la dejan pasar hasta el deslizador.
    expect(sinComentarios(leer('components/pantallas/RegistrarCobro.jsx'))).toMatch(/<DeslizarParaConfirmar\s+texto=\{textoConfirmar\}\s+cifra=\{cifra\}/)
    expect(sinComentarios(leer('components/pantallas/Gestion.jsx'))).toMatch(/<DeslizarParaConfirmar\s+texto=\{textoAceptar\}\s+cifra=\{cifra\}/)
  })
})

describe('el comprobante', () => {
  it('con los números del día, la barra se vuelve la billetera', () => {
    expect(RECIBO).toMatch(/<LlevasHoy progreso=\{dia\} origenRef=\{refMonto\}/)
    // Sin números ni forma de pedirlos, la barra de siempre.
    expect(RECIBO).toMatch(/\{progresoDia && !conNumeros && !cargarProgresoDia && \(/)
  })

  it('⚠ «Llevas hoy» va ANTES del comprobante, donde se ve', () => {
    /* Iba debajo del troquelado y en el teléfono quedaba fuera de la pantalla:
       los billetes caían en una billetera que nadie veía (el dueño, 19 sep). */
    expect(RECIBO.indexOf('<LlevasHoy')).toBeGreaterThan(-1)
    expect(RECIBO.indexOf('<LlevasHoy')).toBeLessThan(RECIBO.indexOf('>Recibió<'))
  })

  it('y sale en TODO cobro, no solo en la ruta', () => {
    // Fuera de un recorrido la cifra se pide al resumen del inicio.
    expect(PAGO).toMatch(/cargarProgresoDia=\{\(!\(rutaNav\?\.esperadoHoy > 0\) && !off/)
    expect(PAGO).toMatch(/await cargarDiaCobrado\(pagoGuardado\.montoPagado\)/)
  })

  it('los billetes solo vuelan si la plata entró al fajo', () => {
    /* Una transferencia a la cuenta del negocio no está en el bolsillo del
       cobrador: dibujarle billetes entrando sería mentir sobre la plata. */
    expect(LLEVAS).toMatch(/if \(efectivo && origen\) \{/)
    for (const src of [PAGO, RUTA]) {
      expect(src).toMatch(/from '@\/lib\/dinero\/cuentas'/)
      expect(src).toMatch(/entraAlFajo\(/)
      // Con las cuentas que el negocio marcó como del cobrador, no con un conjunto vacío.
      expect(src).toMatch(/metodosPago\.filter\(\(x\) => x\.esDelCobrador\)/)
    }
  })

  it('una transferencia no se queda sin animación: llega al teléfono', () => {
    /* «si tomaste la iniciativa de que no salgan billetes, tenías que hacer algo
       diferente… cambiar la billetera por el teléfono» (el dueño, 19 sep). */
    expect(LLEVAS).toMatch(/\{efectivo\s*\? <canvas ref=\{refBilletera\}[\s\S]*?: <Telefono /)
    expect(LLEVAS).toMatch(/lanzarNotificacion\(refVuelo\.current,/)
    expect(LLEVAS).toMatch(/sonidoNotificacion\(\)/)
  })

  it('el botón del sonido va arriba a la derecha, no en medio de «Llevas hoy»', () => {
    expect(RECIBO).not.toMatch(/<LlevasHoy[^>]*extra=/)
    expect(RECIBO).toMatch(/position: 'absolute', top: 12, right: -8/)
  })

  it('en la ruta, «lo que llevaba» es la foto de ANTES de recargar', () => {
    /* El recibo sale antes del `fetchRuta()`: la foto se toma ahí, y lo que
       lleva es esa foto más lo que entró. Con el estado recargado el total
       giraría de $X a $X. */
    const i = RUTA.indexOf('llevabaHoy: Math.round(ruta?.recaudadoHoy ?? 0)')
    const j = RUTA.indexOf('await fetchRuta()', i)
    expect(i).toBeGreaterThan(-1)
    expect(j).toBeGreaterThan(i)
    expect(RUTA).toMatch(/ahora: reciboCobro\.llevabaHoy \+ reciboCobro\.monto/)
  })

  it('el cobro por QR tampoco cierra la hoja al guardar', () => {
    // Igual que las listas: al guardar la hoja enseña el recibo.
    const qr = sinComentarios(leer('components/qr/QrCobroModal.jsx'))
    const exito = qr.slice(qr.indexOf('const handlePagoSuccess'), qr.indexOf('const handleClose'))
    expect(exito).not.toMatch(/setPagoOpen\(false\)/)
    expect(exito).not.toMatch(/setPrestamoSel\(null\)/)
  })

  it('el sonido se apaga donde suena', () => {
    expect(RECIBO).toMatch(/onClick=\{\(\) => \{ const v = !conSonido; setConSonido\(v\); guardarSonido\(v\) \}\}/)
  })
})

describe('los rodillos avanzan siempre hacia delante', () => {
  it('buscan la celda del dígito por delante de donde están', () => {
    expect(haciaDelante({ pos: 15 }, 3)).toBe(23)   // de un 5 a un 3: da la vuelta
    expect(haciaDelante({ pos: 12 }, 7)).toBe(17)   // de un 2 a un 7: sigue
    expect(haciaDelante({ pos: 17 }, 7)).toBe(17)   // ya está
    expect(haciaDelante({ pos: 28 }, 9)).toBe(29)   // nunca se sale de la columna
  })
})
