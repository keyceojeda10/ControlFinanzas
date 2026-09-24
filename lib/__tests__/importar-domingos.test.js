import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('importar con «no cobro los domingos»', () => {
  describe('en lib/importar-cartera.js', () => {
    const cartera = readFileSync(resolve(process.cwd(), 'lib/importar-cartera.js'), 'utf8')

    it('diasSinCobro: [0] viene DESPUÉS de «Excede el límite de tu plan» y crearRuta, ANTES de orgCfg', () => {
      const excedeLimit = cartera.indexOf("Excede el límite de tu plan")
      const crearRutaBlock = cartera.indexOf('rutaFinal = nuevaRuta.id')
      const diasSinCobroSave = cartera.indexOf("diasSinCobro: '[0]'")
      const orgCfgRead = cartera.lastIndexOf("select: { diasSinCobro: true }")

      expect(excedeLimit).toBeGreaterThan(-1)
      expect(crearRutaBlock).toBeGreaterThan(-1)
      expect(diasSinCobroSave).toBeGreaterThan(-1)
      expect(orgCfgRead).toBeGreaterThan(-1)

      expect(diasSinCobroSave).toBeGreaterThan(excedeLimit)
      expect(diasSinCobroSave).toBeGreaterThan(crearRutaBlock)
      expect(diasSinCobroSave).toBeLessThan(orgCfgRead)
    })

    it('retorna domingosGuardados en resultado', () => {
      expect(cartera).toMatch(/domingosGuardados[,\s}]/)
      expect(cartera).toMatch(/domingosGuardados = true/)
    })

    it('acepta noCobrarDomingos como parámetro', () => {
      expect(cartera).toMatch(/noCobrarDomingos = false/)
    })
  })

  describe('en app/api/carga-masiva/importar/route.js', () => {
    const route = readFileSync(resolve(process.cwd(), 'app/api/carga-masiva/importar/route.js'), 'utf8')

    it('pasa noCobrarDomingos === true a importarCartera', () => {
      expect(route).toMatch(/noCobrarDomingos: noCobrarDomingos === true/)
    })

    it('log de editar_configuracion solo si domingosGuardados', () => {
      expect(route).toMatch(/if \(domingosGuardados\) \{/)
      expect(route).toMatch(/accion: 'editar_configuracion'[\s\S]{0,200}Días sin cobro: ninguno → domingo/)
    })

    it('no llama prisma.organization.update en la ruta', () => {
      expect(route).not.toMatch(/prisma\.organization\.update/)
    })

    it('extrae domingosGuardados del resultado', () => {
      expect(route).toMatch(/const \{ [\s\S]*domingosGuardados[\s\S]*\} = r\.resultado/)
    })
  })
})
