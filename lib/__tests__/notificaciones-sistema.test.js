// EL SISTEMA DE NOTIFICACIONES (19 sep 2026). El dueño: «está bastante
// desaprovechado». Medido: 3.368 avisos de mora en 30 días, 174 leídos (5 %);
// push encendido en 87 de 640 dueños; solo TRES sitios escribían en la campana
// y los once que mandaban push no dejaban rastro.
//
// Aquí se ancla lo que, roto, devolvería el sistema a ese estado.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import path from 'path'
import { GRUPOS, GRUPO_DE, grupoDe, normalizarPrefs, quiere, seGuarda, limpiarPrefs, RESUMEN_HORA_POR_DEFECTO } from '@/lib/avisos-preferencias'
import { relojLocal, textoDelResumen } from '@/lib/resumen-dia'
import { eventoDelPago, textoDelEvento } from '@/lib/avisos-cartera'

const leer = (f) => readFileSync(path.join(process.cwd(), f), 'utf8')
const sinComentarios = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('las preferencias', () => {
  it('sin nada guardado, todo encendido y el resumen a las 19:00', () => {
    const p = normalizarPrefs(null)
    expect(Object.values(p.grupos).every(Boolean)).toBe(true)
    expect(p.resumenHora).toBe(RESUMEN_HORA_POR_DEFECTO)
  })

  it('MariaDB devuelve el JSON como texto: se lee igual', () => {
    expect(quiere('{"grupos":{"mora":false}}', 'mora')).toBe(false)
    expect(quiere('{"grupos":{"mora":false}}', 'cierre_caja')).toBe(true)
    expect(quiere('esto no es json', 'mora')).toBe(true)
  })

  it('apagar el resumen es `null`, que no es lo mismo que no haber elegido', () => {
    expect(quiere({ resumenHora: null }, 'resumen_dia')).toBe(false)
    expect(quiere({}, 'resumen_dia')).toBe(true)
    expect(limpiarPrefs({ resumenHora: null }).resumenHora).toBeNull()
    expect(limpiarPrefs({ resumenHora: 99 }).resumenHora).toBe(RESUMEN_HORA_POR_DEFECTO)
  })

  it('⚠ el aviso del plan no se puede apagar: sin plan no se cobra', () => {
    expect(quiere({ grupos: { cuenta: false } }, 'suscripcion')).toBe(true)
    expect('cuenta' in limpiarPrefs({ grupos: { cuenta: false } }).grupos).toBe(false)
  })

  it('cada tipo cae en un grupo que existe, y lo desconocido no se pierde', () => {
    const ids = new Set([...GRUPOS.map((g) => g.id), 'resumen'])
    for (const [tipo, g] of Object.entries(GRUPO_DE)) expect(ids.has(g), tipo).toBe(true)
    expect(grupoDe('un_tipo_que_no_existe')).toBe('equipo')
  })

  it('cada pago suena pero NO llena la campana: son 17.000 al mes', () => {
    expect(seGuarda('pago')).toBe(false)
    expect(seGuarda('solicitud_prestamo')).toBe(true)
  })
})

describe('una sola puerta', () => {
  it('⚠ nadie manda un push por su cuenta: todo pasa por `notificar()`', () => {
    /* `enviarPush` directo no deja fila: con el teléfono apagado el aviso se
       pierde. La única excepción es el recordatorio de cierre, que necesita el
       resultado del envío para su antirrepetición —y escribe su fila aparte—. */
    const fuera = []
    const recorrer = (dir) => {
      for (const n of readdirSync(dir)) {
        const p = path.join(dir, n)
        if (statSync(p).isDirectory()) { recorrer(p); continue }
        if (!/\.js$/.test(n)) continue
        const rel = path.relative(process.cwd(), p)
        if (rel === 'app/api/cron/cierre-recordatorios/route.js') continue
        if (/\benviarPush(Org)?\(/.test(sinComentarios(readFileSync(p, 'utf8')))) fuera.push(rel)
      }
    }
    recorrer(path.join(process.cwd(), 'app/api'))
    expect(fuera).toEqual([])
  })

  it('`notificar` nunca tumba a quien lo llama', () => {
    const src = sinComentarios(leer('lib/notificar.js'))
    expect(src).toMatch(/export async function notificar\([\s\S]*?\{\s*try \{/)
    expect(src).toMatch(/\} catch \(e\) \{\s*console\.error\('\[notificar\]'/)
  })

  it('respeta lo que cada quien pidió y no avisa a quien hizo la acción', () => {
    const src = sinComentarios(leer('lib/notificar.js'))
    expect(src).toMatch(/usuarios\.filter\(\(u\) => u\.id !== excepto && quiere\(u\.prefsAvisos, tipo\)\)/)
  })
})

describe('lo que espera una decisión', () => {
  const api = sinComentarios(leer('app/api/notificaciones/pendientes/route.js'))
  it('junta las tres colas, y solo para el dueño', () => {
    expect(api).toMatch(/estado: 'pendiente_aprobacion'/)
    expect(api).toMatch(/solicitudReaperturaEn: \{ not: null \}, reabiertoEn: null/)
    expect(api).toMatch(/estado: 'pendiente'/)
    expect(api).toMatch(/if \(session\.user\.rol !== 'owner'\) return Response\.json\(\{ pendientes: \[\] \}\)/)
  })

  it('no escribe nada: aprobar sigue siendo el endpoint de siempre', () => {
    expect(api).not.toMatch(/\.(update|create|delete)(Many)?\(/)
    const fila = sinComentarios(leer('components/armazon/Pendientes.jsx'))
    expect(fila).toMatch(/\/api\/prestamos\/\$\{p\.id\}\/\$\{accion === 'aprobar' \? 'aprobar' : 'rechazar'\}/)
    expect(fila).toMatch(/\/api\/caja\/reabrir\/\$\{accion === 'aprobar' \? 'aprobar' : 'rechazar'\}/)
    expect(fila).toMatch(/\/api\/gastos\/\$\{p\.id\}/)
  })

  it('⚠ mover plata desde una lista pide DOS toques', () => {
    const fila = sinComentarios(leer('components/armazon/Pendientes.jsx'))
    expect(fila).toMatch(/if \(armado !== accion\) \{\s*setArmado\(accion\)/)
    expect(fila).toMatch(/setTimeout\(\(\) => setArmado\(null\), 4000\)/)
  })

  it('cuenta en la campana como un aviso sin leer', () => {
    expect(sinComentarios(leer('components/armazon/PilaAvisos.jsx')))
      .toMatch(/const cuantos = perdedores\.length \+ sinLeer \+ pendientes\.length/)
  })
})

describe('el resumen del día', () => {
  it('cada dueño lo recibe en SU hora local', () => {
    const ahora = new Date('2026-09-20T00:30:00Z')          // 19:30 en Colombia
    expect(relojLocal('co', ahora)).toEqual({ hora: 19, fecha: '2026-09-19' })
  })

  it('dice el día en una frase, y calla lo que fue cero', () => {
    const t = textoDelResumen({ cobrado: 228400, cobros: 14, prestado: 500000, prestamos: 2, gastos: 0, atrasados: 3, sinCerrar: ['Pepito', 'Carlos', 'Ana'] })
    expect(t.titulo).toBe('Hoy entraron $228.400')
    expect(t.mensaje).toBe('14 cobros · 2 préstamos nuevos por $500.000 · 3 clientes se atrasaron · Pepito y Carlos y 1 más no han cerrado la caja.')
    expect(textoDelResumen({ cobrado: 20000, cobros: 1, prestado: 0, prestamos: 0, gastos: 0, atrasados: 0 }).mensaje).toBe('1 cobro.')
  })

  it('no se manda dos veces ni a un negocio que hoy no se movió', () => {
    const cron = sinComentarios(leer('app/api/cron/resumen-diario/route.js'))
    expect(cron).toMatch(/tipo: 'resumen_dia', createdAt: \{ gte: inicio \}/)
    expect(cron).toMatch(/if \(cobros === 0 && nPrestamos === 0\) \{ res\.sinMovimiento\+\+; continue \}/)
    // Las mismas definiciones que la pantalla de inicio.
    expect(cron).toMatch(/tipo: \{ notIn: \['recargo', 'descuento'\] \}/)
  })
})

describe('las buenas noticias de un pago', () => {
  const dia = (n) => new Date(Date.now() - n * 86400000)
  const base = {
    estado: 'activo', modoInteres: 'fijo', frecuencia: 'diario',
    montoPrestado: 100000, totalAPagar: 120000, cuotaDiaria: 12000, diasPlazo: 10,
    fechaInicio: dia(6),
  }
  const pago = (monto, hace) => ({ tipo: 'completo', montoPagado: monto, fechaPago: dia(hace) })

  it('saldar gana a todo lo demás: un solo aviso por pago', () => {
    const antes = { ...base, pagos: [pago(60000, 3)] }
    const despues = { ...base, pagos: [pago(60000, 3), pago(60000, 0)] }
    expect(eventoDelPago({ antes, despues })?.tipo).toBe('prestamo_saldado')
  })

  it('quien debía días y los cubre, se puso al día', () => {
    const antes = { ...base, pagos: [] }
    const despues = { ...base, pagos: [pago(72000, 0)] }
    const e = eventoDelPago({ antes, despues })
    expect(e?.tipo).toBe('cliente_al_dia')
    expect(e.diasAntes).toBeGreaterThan(0)
  })

  it('un pago normal de quien va al día no avisa de nada', () => {
    const alDia = { ...base, fechaInicio: dia(2) }
    const antes = { ...alDia, pagos: [pago(12000, 1)] }
    const despues = { ...alDia, pagos: [pago(12000, 1), pago(12000, 0)] }
    expect(eventoDelPago({ antes, despues })).toBeNull()
  })

  it('el texto lleva el nombre y la plata', () => {
    const plata = (n) => `$${Math.round(n).toLocaleString('es-CO')}`
    const t = textoDelEvento({ tipo: 'cliente_al_dia', diasAntes: 5 }, { cliente: 'Ana', montoPagado: 72000, plata })
    expect(t).toEqual({ titulo: 'Ana se puso al día', mensaje: 'Llevaba 5 días de atraso y pagó $72.000.' })
  })
})

describe('lo que se arregló de paso', () => {
  it('el dueño se entera de un cierre, y el aviso no acusa de un faltante que no mide', () => {
    const caja = sinComentarios(leer('app/api/caja/route.js'))
    expect(caja).toMatch(/tipo: 'cierre_caja'/)
    const i = caja.indexOf("tipo: 'cierre_caja'")
    expect(caja.slice(i, i + 400)).not.toMatch(/diferencia/)
  })

  it('el permiso de avisos se ofrece en la campana, no solo en Configuración', () => {
    expect(sinComentarios(leer('components/armazon/CosasPorResolver.jsx'))).toMatch(/<InvitacionPush \/>/)
  })

  it('los avisos tienen su sección, para todos los roles, y no se llama como el módulo', () => {
    expect(leer('lib/adaptadores/configuracion.js')).toMatch(/\{ id: 'avisos',\s+nombre: 'Qué te avisamos',\s+visible: true \}/)
  })
})
