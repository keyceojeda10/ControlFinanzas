import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const pagina = readFileSync(join(process.cwd(), 'app', '(dashboard)', 'cobros-hoy', 'page.jsx'), 'utf8')
const api = readFileSync(join(process.cwd(), 'app', 'api', 'cobros-hoy', 'route.js'), 'utf8')
const sinComentarios = (s) => s
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
const codigo = sinComentarios(pagina)

/* Reportado: «los botones de WhatsApp y de Mapa no corresponden a nada de eso.
   El WhatsApp no manda ni siquiera a las plantillas, y el mapa ni siquiera
   manda a la direccion... mandan a otras opciones dentro del sistema
   completamente diferentes». */

describe('el endpoint devuelve lo que los botones necesitan', () => {
  it('manda telefono, latitud y longitud', () => {
    // La causa de fondo: los tres se pedian al `select` y NO se devolvian, asi
    // que los dos botones caian SIEMPRE en su caso de fallo. Medido: el 99% de
    // los 5.768 clientes tiene telefono, o sea que fallaba para todos.
    const bloque = api.match(/clientesAgregados\.push\(\{[\s\S]*?\n {6}\}\)/)[0]
    for (const campo of ['telefono', 'latitud', 'longitud']) {
      expect(bloque, `el endpoint no devuelve ${campo}`).toMatch(new RegExp(`${campo}: c\.${campo}`))
    }
  })

  it('y los sigue pidiendo al select', () => {
    for (const campo of ['telefono', 'latitud', 'longitud']) {
      expect(api).toMatch(new RegExp(`${campo}: true`))
    }
  })
})

describe('WhatsApp abre las PLANTILLAS', () => {
  it('monta la hoja, no un wa.me pelado', () => {
    // Antes abria el chat VACIO: el cobrador tenia que escribir el mensaje a
    // mano delante de alguien que le debe plata.
    expect(pagina).toContain("import HojaWhatsApp from '@/components/whatsapp/HojaWhatsApp'")
    expect(codigo).toContain('<HojaWhatsApp')
    const h = codigo.match(/onWhatsApp=\{\(fila\) => \{[\s\S]{0,400}?\}\}/)[0]
    expect(h).toContain('setWaCliente')
    expect(h, 'sigue abriendo wa.me directo').not.toMatch(/wa\.me/)
  })

  it('le pasa el prestamo con MAS saldo', () => {
    // Es el que decide que mensaje toca —cuanto debe y cuantos dias lleva de
    // atraso—. Con varios activos, escribir sobre el mas pequeño diria lo que
    // no es.
    const m = codigo.match(/<HojaWhatsApp[\s\S]*?\/>/)[0]
    expect(m).toMatch(/sort\(\(a, b\) => \(b\.saldoPendiente \?\? 0\) - \(a\.saldoPendiente \?\? 0\)\)/)
  })

  it('la firma del negocio sale de `useAuth`, no de un campo inventado', () => {
    // `user.organizacionNombre` NO existe: lo escribi y habria dejado el
    // mensaje sin firma. Los reales son `orgNombre` y `ocultarSaldoWA`.
    expect(codigo).toMatch(/const \{ user, orgNombre, ocultarSaldoWA, organizationId/)
    expect(codigo).not.toContain('organizacionNombre')
    const auth = readFileSync(join(process.cwd(), 'hooks', 'useAuth.js'), 'utf8')
    expect(auth).toMatch(/orgNombre:/)
    expect(auth).toMatch(/ocultarSaldoWA:/)
  })

  it('respeta la preferencia de no mandar el saldo', () => {
    const m = codigo.match(/<HojaWhatsApp[\s\S]*?\/>/)[0]
    expect(m).toContain('ocultarSaldo={ocultarSaldoWA}')
  })
})

// La ventana del recorte subio de 900 a 3000: el manejador crecio con la rama
// de «sin fila» —el boton redondo, que arma la ruta del dia— y a 900 caracteres
// ya no llegaba a la parte por cliente. Lo que se comprueba no cambio.
describe('el mapa lleva al cliente, no a otra pantalla', () => {
  it('abre Google Maps con sus coordenadas o su direccion', () => {
    const h = codigo.match(/onMapa=\{\(fila\) => \{[\s\S]{0,3000}?\n {8}\}\}/)[0]
    expect(h).toContain('google.com/maps/dir')
    expect(h).toMatch(/c\?\.latitud && c\?\.longitud/)
    expect(h).toMatch(/c\?\.direccion/)
  })

  it('SIN direccion no manda a /rutas', () => {
    // Caia en la lista de rutas, que no tiene nada que ver con el boton: se
    // pulsaba «Mapa» y aparecia otra pantalla sin explicacion. Son el 24% de
    // los clientes.
    const h = codigo.match(/onMapa=\{\(fila\) => \{[\s\S]{0,3000}?\n {8}\}\}/)[0]
    expect(h, 'sigue redirigiendo a /rutas').not.toMatch(/window\.location\.href = '\/rutas'/)
  })

  it('dice lo que pasa y ofrece arreglarlo', () => {
    const h = codigo.match(/onMapa=\{\(fila\) => \{[\s\S]{0,3000}?\n {8}\}\}/)[0]
    expect(h).toMatch(/confirm\(/)
    expect(h).toMatch(/no tiene dirección ni ubicación/)
    expect(h).toMatch(/\/clientes\/\$\{c\.id\}/)
  })
})
