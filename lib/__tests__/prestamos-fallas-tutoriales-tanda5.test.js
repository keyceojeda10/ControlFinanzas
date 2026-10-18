/* Préstamos, puntos 58 a 69 del agente de los videos (DETALLES-PRESTAMOS.md,
 * vistos en pantalla el 17 oct 2026): lo que es de pantalla. Lo que cambia cómo
 * se cuenta (62b, 63) y la etiqueta guardada del #61 esperan al dueño.
 * Ancladas en el código, y con cifras donde hay cuenta. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { adaptarDespuesDelPago } from '@/lib/adaptadores/pago'
import { losDias, adaptarDiaDeCobro, baseDeAplazar, cuandosDeAplazar } from '@/lib/adaptadores/gestion'

const leer = (f) => readFileSync(f, 'utf8')
const hoja = leer('components/prestamos/RegistrarPago.jsx')
const ficha = leer('app/(dashboard)/prestamos/[id]/page.jsx')

describe('#58 · «Va atrasado» lo dice la mora, no el reloj', () => {
  it('la tarjeta usa los días de atraso del servidor', () => {
    const vistas = leer('components/prestamos/PrestamoDetalleViews.jsx')
    expect(vistas).toMatch(/const atrasado = diasMora != null \? diasMora > 0 : animPago < animTiempo - 5/)
    expect(vistas).toMatch(/const adelantado = !atrasado && animPago > animTiempo \+ 5/)
    expect(ficha).toMatch(/prestamosCompletadosCliente=\{statsCliente\?\.completados\}\n\s+diasMora=\{diasMora \?\? null\}/)
  })
})

describe('#59 · el día de cobro con tildes', () => {
  it('Mié y Sáb', () => {
    const crear = leer('app/(dashboard)/prestamos/nuevo/page.jsx')
    expect(crear).toMatch(/\{ v: '3', l: 'Mié' \}/)
    expect(crear).toMatch(/\{ v: '6', l: 'Sáb' \}/)
  })
})

describe('#61 · ponerse al día no es pagar «de más»', () => {
  it('la hoja compara contra lo que debe HOY', () => {
    expect(hoja).toMatch(/const debeHoy = Math\.max\(refCuota \?\? 0, Math\.round\(montoAlDia \|\| 0\)\)/)
    expect(hoja).toMatch(/const pagaLoAtrasado = comoVa\?\.clase === 'extra' && debeHoy > \(refCuota \?\? 0\) && montoNum <= debeHoy/)
    expect(hoja).toMatch(/`Paga lo atrasado: con \$\{formatMoney\(montoNum\)\} queda al día\.`/)
    expect(hoja).toMatch(/notaDePagoDeMas\(prestamo\?\.modoInteres, debeHoy, montoNum - debeHoy,/)
  })
  it('el formulario viejo, igual', () => {
    expect(hoja).toMatch(/const cuotaRefExcedente = Math\.max\(Math\.round\(cuotaDiaria \?\? 0\), Math\.round\(montoAlDia \|\| 0\)\)/)
  })
})

describe('#64 · la vista previa del abono a capital resta el interés que perdona', () => {
  it('465.600 − 100.000 − 15.333 = 350.267, como el recibo', () => {
    const { filas } = adaptarDespuesDelPago({ saldoPendiente: 465600, cuotaDiaria: 19400 }, { monto: 100000, tipo: 'capital', deudaQueSeVa: 15333 })
    const saldo = filas.find((f) => f.clave === 'saldo')
    expect(saldo.valor).toMatch(/350\.267/)
  })
  it('sin ahorro, como antes', () => {
    const { filas } = adaptarDespuesDelPago({ saldoPendiente: 465600, cuotaDiaria: 19400 }, { monto: 100000, tipo: 'capital' })
    expect(filas.find((f) => f.clave === 'saldo').valor).toMatch(/365\.600/)
  })
  it('la hoja le pasa el ahorro solo sin tabla', () => {
    expect(hoja).toMatch(/deudaQueSeVa: tipo === 'capital' && !conTablaAbono && montoNum > 0/)
  })
})

describe('#65 · «queda para mañana», no «para el Mañana»', () => {
  it('la frase se arma aparte', () => {
    expect(hoja).toMatch(/queda para \$\{paraCuando\(formatFechaCobroRelativa\(fechaAplazada\)\)\}\. No cambia de monto\./)
    expect(hoja).toMatch(/if \(cuando === 'Mañana'\) return 'mañana'/)
  })
})

describe('#66 · «los sábados» y sin fila vacía', () => {
  it('plural de sábado y domingo; de lunes a viernes igual', () => {
    expect(losDias('sábado')).toBe('sábados')
    expect(losDias('domingo')).toBe('domingos')
    expect(losDias('martes')).toBe('martes')
    expect(losDias('miércoles')).toBe('miércoles')
  })
  it('el resumen y el botón lo usan', () => {
    const r = adaptarDiaDeCobro({ diaCobroSemana: 6 }, 0, null, null)
    expect(r.cobraAntes).toBe('sábados')
    expect(r.cobraDespues).toBe('domingos')
    expect(r.nota).toMatch(/^Hoy le cobras los sábados\./)
    expect(leer('components/prestamos/EditarDiaCobro.jsx')).toMatch(/`Guardar los \$\{losDias\(nombreElegido\)\}`/)
    expect(leer('components/pantallas/Gestion.jsx')).toMatch(/resumen=\{proximoCobro \? \[\{ etiqueta: 'Próximo cobro', valor: proximoCobro, texto: true \}\] : \[\]\}/)
  })
})

describe('#67 · aplazar cuenta desde el próximo cobro', () => {
  const hoy = new Date(2026, 9, 17, 15, 0) // sáb 17 oct, 3 p. m.
  it('si el cobro está por venir, se cuenta desde él', () => {
    const { base, desdeElCobro } = baseDeAplazar('2026-10-24T05:00:00.000Z', hoy)
    expect(desdeElCobro).toBe(true)
    expect(base.getDate()).toBe(24)
    const [uno, tres] = cuandosDeAplazar(base, { desdeElCobro })
    expect(uno.etiqueta).toBe('Un día después')
    expect(uno.fecha.getDate()).toBe(25)
    expect(tres.etiqueta).toBe('3 días después')
    expect(tres.fecha.getDate()).toBe(27)
  })
  it('si es hoy o ya pasó (atrasado), desde hoy como siempre', () => {
    expect(baseDeAplazar('2026-10-17T05:00:00.000Z', hoy).desdeElCobro).toBe(false)
    expect(baseDeAplazar('2026-10-10T05:00:00.000Z', hoy).desdeElCobro).toBe(false)
    expect(baseDeAplazar(null, hoy).desdeElCobro).toBe(false)
    expect(cuandosDeAplazar(baseDeAplazar(null, hoy).base)[0].etiqueta).toBe('Mañana')
  })
  it('la hoja lo usa y no deja escoger antes', () => {
    const aplazar = leer('components/prestamos/EditarProximoCobro.jsx')
    expect(aplazar).toMatch(/const \{ base, desdeElCobro \} = baseDeAplazar\(prestamo\?\.proximoCobro\)/)
    expect(aplazar).toMatch(/min=\{aISO\(new Date\(desdeAplazar\.getTime\(\) \+ 86400000\)\)\}/)
  })
})

describe('#68 · el aviso de eliminar dice «anúlalo»', () => {
  it('el botón se llama «Anular el préstamo»', () => {
    expect(ficha).toMatch(/no lo elimines: anúlalo\./)
    expect(ficha).not.toMatch(/no lo elimines: cancélalo\./)
  })
})

describe('#69 · el motivo de cerrar anticipado no grita al abrir', () => {
  it('el aviso sale al tocar el campo; el botón sigue pidiéndolo', () => {
    expect(ficha).toMatch(/liqMotivoTocado && !liqNota\.trim\(\) && liqMonto > 0 \? 'Escribe el motivo: queda en el historial\.'/)
    expect(ficha).toMatch(/onBlur=\{\(\) => setLiqMotivoTocado\(true\)\}/)
    expect(ficha).toMatch(/deshabilitado=\{liqMonto < 0 \|\| bajoElPiso \|\| !liqNota\.trim\(\)\}/)
    expect(ficha).toMatch(/Motivo \(obligatorio: queda en el historial\)/)
  })
})
