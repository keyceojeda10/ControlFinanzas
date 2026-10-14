import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { VIDEO_BIENVENIDA, EVENTOS_VIDEO, hitosNuevos, debeAbrirseSola } from '@/lib/video-bienvenida'

const leer = (f) => readFileSync(f, 'utf8')

describe('la clase de 2 minutos: reglas', () => {
  it('se abre sola solo al dueño, en el primer paso y si nunca la abrió', () => {
    expect(debeAbrirseSola({ rol: 'owner', paso: 0, visto: false })).toBe(true)
    expect(debeAbrirseSola({ rol: 'owner', paso: 0, visto: true })).toBe(false)
    expect(debeAbrirseSola({ rol: 'cobrador', paso: 0, visto: false })).toBe(false)
    expect(debeAbrirseSola({ rol: 'owner', paso: 1, visto: false })).toBe(false)
    // Si el servidor no contestó, no sale: nunca bloquea.
    expect(debeAbrirseSola({ rol: 'owner', paso: 0, visto: undefined })).toBe(false)
  })
  it('los hitos se apuntan una vez y el 100 solo al terminar', () => {
    const vistos = new Set()
    expect(hitosNuevos(40, 120, vistos)).toEqual([25])
    vistos.add(25)
    expect(hitosNuevos(95, 120, vistos)).toEqual([50, 75])
    vistos.add(50); vistos.add(75)
    expect(hitosNuevos(119.9, 120, vistos)).toEqual([])
    expect(hitosNuevos(120, 120, vistos, { termino: true })).toEqual([100])
    expect(hitosNuevos(10, 0, new Set())).toEqual([])
  })
  it('los nombres de eventos son los que pidió el dueño', () => {
    expect(EVENTOS_VIDEO.abierto).toBe('video_bienvenida_abierto')
    expect(EVENTOS_VIDEO.sonido).toBe('video_bienvenida_sonido')
    expect(EVENTOS_VIDEO.cerrado).toBe('video_bienvenida_cerrado')
    expect(EVENTOS_VIDEO.hito(75)).toBe('video_bienvenida_75')
  })
  it('el video y la portada se sirven desde nuestro dominio', () => {
    expect(existsSync(`public${VIDEO_BIENVENIDA.src}`)).toBe(true)
    expect(existsSync(`public${VIDEO_BIENVENIDA.poster}`)).toBe(true)
    expect(VIDEO_BIENVENIDA.segundoCapital).toBe(24)
  })
})

describe('la clase de 2 minutos: dónde está', () => {
  const v = leer('components/cf/VideoBienvenida.jsx')
  it('sin YouTube ni emojis; intenta con sonido y cae a silencio', () => {
    expect(v).not.toMatch(/youtube\.com|youtu\.be|<iframe/i)
    expect(v.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/\p{Extended_Pictographic}/u)
    expect(v).toMatch(/v\.muted = false\n\s+v\.play\(\)/)
    expect(v).toMatch(/v\.muted = true\n\s+setSilencio\(true\)/)
    expect(v).toMatch(/>\s*\{parado \? 'Ver la clase con sonido' : 'Toca para oír al profe'\}/)
  })
  it('«Cerrar» siempre a la vista, y abierta sola no deja pantalla quieta', () => {
    expect(v).toMatch(/<\/svg>\n\s+Cerrar\n\s+<\/button>/)
    expect(v).toMatch(/onError=\{\(\) => \{ if \(solo\) cerrar\(\); else setFallo\(true\) \}\}/)
    expect(v).toMatch(/if \(!arranco\.current\) cerrar\(\)/)
  })
  it('el asistente la abre antes del primer paso, preguntando al servidor', () => {
    const w = leer('components/onboarding/OnboardingWizard.jsx')
    expect(w).toMatch(/fetch\('\/api\/video-bienvenida'\)/)
    expect(w).toMatch(/<VideoBienvenida origen="primera_entrada" solo/)
    expect(leer('components/onboarding/wizard/WizardWelcome.jsx')).toMatch(/>\s*Ver la clase de 2 minutos\s*<\/EnlaceVideoBienvenida>/)
  })
  it('el servidor dice si ya la vio, por persona', () => {
    const r = leer('app/api/video-bienvenida/route.js')
    expect(r).toMatch(/userId: u\.id, evento: EVENTOS_VIDEO\.abierto/)
  })
  it('los avisos de caja en negativo la abren en la lección del capital', () => {
    // El aviso de la página Caja vive en la vista del COBRADOR: el video es del dueño y no va ahí.
    expect(leer('components/pantallas/Panel.jsx')).toMatch(/accion=\{cajaNegativa && videoCaja \? \(/)
    expect(leer('app/(dashboard)/dashboard/page.jsx')).toMatch(/videoCaja=\{esOwner\}/)
  })
  it('está en Tutoriales, solo para el dueño', () => {
    expect(leer('components/TutorialesList.jsx')).toMatch(/\{esOwner && !search\.trim\(\) && \(!activeCategory \|\| activeCategory === 'inicio'\) && \(/)
  })
  it('el service worker no toca los videos (el iPhone pide por trozos)', () => {
    expect(leer('public/sw.js')).toMatch(/if \(url\.pathname\.startsWith\('\/videos\/'\) \|\| request\.headers\.has\('range'\)\) return/)
  })
})
