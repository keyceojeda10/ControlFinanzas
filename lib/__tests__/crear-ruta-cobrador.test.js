import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// T24-01 «Crear ruta» pide elegir QUIEN LA RECORRE al crearla. El endpoint
// aceptaba `cobradorId` desde siempre (app/api/rutas/route.js:208) y el
// formulario no lo ofrecia: la ruta nacia huerfana y habia que entrar a su
// ficha a asignarla. Dos pasos para algo que se decide al crearla.
const pagina = readFileSync(resolve(process.cwd(), 'app/(dashboard)/rutas/page.jsx'), 'utf8')
const api = readFileSync(resolve(process.cwd(), 'app/api/rutas/route.js'), 'utf8')

describe('crear ruta con su cobrador', () => {
  it('el formulario ofrece elegirlo', () => {
    expect(pagina).toContain('Quién la recorre')
    expect(pagina).toMatch(/setCobradorNuevo/)
  })

  it('y lo manda al endpoint', () => {
    expect(pagina).toMatch(/\.\.\.\(cobradorNuevo && \{ cobradorId: cobradorNuevo \}\)/)
  })

  it('el endpoint ya lo aceptaba: no se toco', () => {
    // Lo unico que faltaba era ofrecerlo. Si esto cambia, el selector deja de
    // servir para nada sin que nada avise.
    expect(api).toMatch(/const \{ nombre, cobradorId/)
    expect(api).toMatch(/cobradorId: cobradorId \|\| null/)
  })

  it('sin cobrador sigue siendo valido', () => {
    // Una ruta sin cobrador es un estado real —la lista lo pinta como tal— y
    // obligar a elegir uno al crearla bloquearia el caso de «la creo ahora y
    // ya vere quien la lleva».
    expect(pagina).toContain('Sin cobrador por ahora')
  })

  it('los cobradores se cargan al ABRIR la hoja, no al montar la pagina', () => {
    // La lista de rutas la abre todo el mundo; el formulario, casi nadie.
    // Pedir los cobradores al entrar seria una peticion de mas en la pantalla
    // que mas se abre.
    expect(pagina).toMatch(/if \(!showForm \|\| cobradoresLista\.length\) return/)
  })
})
