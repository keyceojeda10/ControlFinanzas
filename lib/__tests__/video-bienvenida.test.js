import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { VIDEO_BIENVENIDA, EVENTOS_VIDEO, EVENTOS_LECCION, LECCIONES, leccionDelPaso, hitosNuevos, debeAbrirseSola } from '@/lib/video-bienvenida'

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
  })
  it('las cinco lecciones existen, una por pantalla del asistente', () => {
    expect(LECCIONES.map((l) => l.n)).toEqual([1, 2, 3, 4, 5])
    for (const l of LECCIONES) {
      expect(existsSync(`public${l.src}`)).toBe(true)
      expect(existsSync(`public${l.poster}`)).toBe(true)
    }
    expect(leccionDelPaso({ step: 0, vioPlan: false }).titulo).toBe('¿Quién cobra?')
    expect(leccionDelPaso({ step: 1, vioPlan: false }).titulo).toBe('Tu capital')
    expect(leccionDelPaso({ step: 2, vioPlan: false }).titulo).toBe('El plan: $0')
    expect(leccionDelPaso({ step: 2, vioPlan: true }).titulo).toBe('Trae tu cartera')
    expect(leccionDelPaso({ step: 3, vioPlan: true }).titulo).toBe('Cobra todos los días')
    expect(leccionDelPaso({ step: 50, vioPlan: true })).toBe(null)
  })
  it('las lecciones se miden aparte (no marcan «ya vio la clase»)', () => {
    expect(EVENTOS_LECCION.abierto).toBe('video_leccion_abierto')
    expect(EVENTOS_LECCION.abierto).not.toBe(EVENTOS_VIDEO.abierto)
  })
  it('los cortes están escritos en el guion, dentro de los silencios', () => {
    const g = readFileSync('scripts/video/cortar-lecciones.sh', 'utf8')
    expect(g).toMatch(/^cortar 1 {2}11\.02 {2}24\.07$/m)
    expect(g).toMatch(/^cortar 2 {2}24\.54 {2}50\.50$/m)
    expect(g).toMatch(/^cortar 5 103\.73 117\.50$/m)
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
  })
  it('cada pantalla del asistente lleva el aviso de SU lección, que no se abre solo', () => {
    const w = leer('components/onboarding/OnboardingWizard.jsx')
    expect(w).toMatch(/const leccionActual = leccionDelPaso\(\{ step, vioPlan \}\)/)
    expect(w).toMatch(/<AvisoLeccion leccion=\{leccionActual\} origen=\{`asistente_paso_\$\{step\}`\} completa=\{step === 0\} \/>/)
    expect(v).toMatch(/¿Cómo era\? Lección \{leccion\.n\} · \{leccion\.segundos\} s/)
  })
  it('el servidor dice si ya la vio, por persona', () => {
    const r = leer('app/api/video-bienvenida/route.js')
    expect(r).toMatch(/userId: u\.id, evento: EVENTOS_VIDEO\.abierto/)
  })
  it('los avisos de caja en negativo la abren en la lección del capital', () => {
    // El aviso de la página Caja vive en la vista del COBRADOR: el video es del dueño y no va ahí.
    expect(leer('components/pantallas/Panel.jsx')).toMatch(/accion=\{cajaNegativa && videoCaja \? \(/)
    expect(leer('components/pantallas/Panel.jsx')).toMatch(/<EnlaceVideoBienvenida leccion=\{leccion\(2\)\} origen="panel_caja"/)
    expect(leer('app/(dashboard)/dashboard/page.jsx')).toMatch(/videoCaja=\{esOwner\}/)
  })
  it('está en Tutoriales, solo para el dueño', () => {
    expect(leer('components/TutorialesList.jsx')).toMatch(/\{esOwner && !search\.trim\(\) && \(!activeCategory \|\| activeCategory === 'inicio'\) && \(/)
  })
  it('el service worker no toca los videos (el iPhone pide por trozos)', () => {
    expect(leer('public/sw.js')).toMatch(/if \(url\.pathname\.startsWith\('\/videos\/'\) \|\| request\.headers\.has\('range'\)\) return/)
  })
})

describe('el asistente no atrapa', () => {
  const w = readFileSync('components/onboarding/OnboardingWizard.jsx', 'utf8')
  it('desde el paso 2 hay «Explorar la app primero», que apaga el asistente (paso 50) y lo apunta', () => {
    expect(w).toMatch(/\{\(step === 1 \|\| step === 2\) && \(/)
    expect(w).toMatch(/\{saliendo \? 'Abriendo la app…' : 'Explorar la app primero'\}/)
    expect(w).toMatch(/marcar\('onb_explorar'/)
    expect(w).toMatch(/body: JSON\.stringify\(\{ action: 'progress', step: 50, flujo \}\),\n\s+\}\)\.catch\(\(\) => \{\}\)\n\s+onComplete\?\.\(\)/)
  })
})

describe('la guía: plan y vuelta', () => {
  const w = readFileSync('components/onboarding/OnboardingWizard.jsx', 'utf8')
  it('«Tengo cobradores» guarda al contestar un plan con cobradores (solo sube)', () => {
    expect(w).toMatch(/const sinCobradores = \(PLANES_CONFIG\[currentPlan\]\?\.maxUsuarios \?\? 1\) <= 1\n\s+if \(tipo === 'equipo' && sinCobradores\) \{\n\s+const plan = escaleraPara\('equipo'\)\[0\]/)
    expect(w).toMatch(/fetch\('\/api\/onboarding\/cambiar-plan'/)
  })
  it('la pantalla del plan marca el que la cuenta tiene', () => {
    expect(readFileSync('components/onboarding/wizard/WizardPlan.jsx', 'utf8')).toMatch(/useState\(tramos\.some\(\(t\) => t\.id === actual\)/)
    expect(w).toMatch(/actual=\{currentPlan\}/)
  })
  it('desde el Inicio sin clientes se vuelve a la guía', () => {
    expect(readFileSync('components/pantallas/TraerCartera.jsx', 'utf8')).toMatch(/\{onAsistente && \(/)
    const d = readFileSync('app/(dashboard)/dashboard/page.jsx', 'utf8')
    expect(d).toMatch(/if \(onboarding\.showWizard\) \{ onboarding\.unminimize\(\); return \}/)
    expect(d).toMatch(/body: JSON\.stringify\(\{ action: 'progress', step: 0 \}\)/)
  })
})
