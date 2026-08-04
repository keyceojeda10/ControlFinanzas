import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { resolverArmazon, CABECERA } from '@/lib/armazon'

// Cuatro fallos de Lucas en el telefono, reportados con capturas:
//   1. la barra de escribir TAPADA por la pastilla
//   2. el contenido muy angosto
//   3. un hueco enorme debajo del campo
//   4. el dashboard se desplaza hacia abajo con CADA respuesta
const pagina = readFileSync(resolve(process.cwd(), 'app/(dashboard)/asistente/page.jsx'), 'utf8')
const chat = readFileSync(resolve(process.cwd(), 'components/asistente/AsistenteChat.jsx'), 'utf8')

describe('Lucas en el teléfono', () => {
  it('el chat es TAREA: sin pastilla que tape la barra de escribir', () => {
    // Mismo patrón que «editar cliente»: una pantalla con su barra fija abajo
    // no puede llevar la pastilla encima.
    const a = resolverArmazon('/asistente')
    expect(a.pastilla, 'la pastilla tapa el campo de escribir').toBe(false)
    expect(a.cabecera).toBe(CABECERA.TAREA)
  })

  it('una sola altura, y en `dvh` para que el teclado no tape el campo', () => {
    // Había DOS: `min-h-screen` fuera y `h-[calc(100vh-80px)]` dentro. Ese 80
    // era a ojo y dejaba un hueco enorme bajo el campo.
    // Sin los comentarios: el porqué del cambio menciona el `100vh` viejo, y
    // buscarlo en el archivo entero se caza a sí mismo. Es el tipo de prueba
    // que da un rojo falso y bloquea un despliegue por nada.
    const codigo = pagina.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(codigo).not.toMatch(/h-\[calc\(100vh-80px\)\]/)
    expect(codigo).toMatch(/100dvh/)
    // `vh` en móvil no encoge con el teclado abierto: el campo se iría debajo.
    expect(codigo).not.toMatch(/calc\(100vh/)
  })

  it('usa el token de cabecera que EXISTE', () => {
    // Un nombre de variable CSS mal escrito no falla en ningún sitio: el
    // navegador cae al valor de respaldo y parece que funciona.
    const tokens = readFileSync(resolve(process.cwd(), 'app/tokens-2026.css'), 'utf8')
    const usada = /var\((--cf-h-[a-z-]+)/.exec(pagina)?.[1]
    expect(usada, 'no se encontró ninguna variable de alto').toBeTruthy()
    expect(tokens, `«${usada}» no existe en tokens-2026.css`).toContain(`${usada}:`)
  })

  it('el ancho no deja las burbujas angostas', () => {
    // La pantalla es SOLO la conversación: no hay nada al costado que justifique
    // 42rem con el resto en blanco.
    expect(pagina).toMatch(/max-w-3xl/)
    expect(pagina).not.toMatch(/max-w-2xl/)
  })

  it('al responder NO se mueve la página, solo el chat', () => {
    // `scrollIntoView` a secas desplaza todos los ancestros que scrolleen. El
    // dueño: «cuando Lucas contesta, todo el dashboard se desplaza hacia abajo».
    expect(chat).toMatch(/scrollIntoView\(\{ behavior: 'smooth', block: 'nearest' \}\)/)
    expect(chat, 'sin `block` se arrastra la página entera')
      .not.toMatch(/scrollIntoView\(\{ behavior: 'smooth' \}\)/)
  })
})
