'use client'

/* Los videos del profe para toda la app: qué ve esta persona, cuáles ya vio, la
 * ayuda de la pantalla abierta y el reproductor, uno solo, montado aquí.
 *
 * ══ UNA PASTILLA POR PANTALLA (Adenda 6, 19 oct 2026) ══════════════════════
 * Detrás de la pastilla de la cabecera está `ayuda`: el video de la pantalla
 * («Empieza aquí») y los de sus funciones («Lo que puedes hacer aquí»). Con uno
 * solo, la pastilla lo abre directo; con varios, abre la hoja de ayuda. Los
 * botones de minuto de los menús y los enlaces de los formularios son ATAJOS al
 * mismo video, no videos aparte.
 *
 * ⚠ VA DENTRO DE `AccionesProvider`. El botón de la tarea («Registrar mi
 * capital inicial», «Empezar recorrido») ejecuta la acción que la pantalla
 * abierta ya registró para el buscador; si esa pantalla no está, navega a la
 * suya (`TAREAS`, lib/tutoriales/profe.js).
 *
 * «Visto», los interruptores y los avisos viven en el servidor (/api/tutoriales),
 * por persona. Lo de `localStorage` es solo para pintar el primer cuadro sin que
 * nada cambie de color al llegar la respuesta. */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAcciones, ejecutarAccion } from '@/components/acciones/AccionesProvider'
import { videosPara, videoPorId, ayudaDeLaPantalla, PRIMERA_VEZ, volverDe, VIDEO_INSTALAR } from '@/lib/tutoriales/profe'
import { isStandalone } from '@/components/layout/InstallButton'
import { salirDeHojaHacia } from '@/components/cf/HojaInferior'
import ReproductorProfe from './ReproductorProfe'
import HojaAyudaProfe from './HojaAyudaProfe'
import NovedadProfe from './NovedadProfe'

const Contexto = createContext(null)
// Por usuario: en un teléfono con «Cuentas guardadas» una cuenta no hereda lo de otra.
const GUARDADO = (usuario) => `cf:profe:${usuario}`

// `habilitado` lo dice el servidor (`profeHabilitado`): mientras no conteste, nada.
const INICIAL = {
  cargado: false, habilitado: false, vistos: [], guardados: [], descartados: [],
  botonVisible: true, paraCobradores: true, mostrarAvisos: true, primeraVez: {},
}
const PERSISTE = ['habilitado', 'vistos', 'guardados', 'descartados', 'botonVisible', 'paraCobradores', 'mostrarAvisos', 'primeraVez']

function leerGuardado(usuario) {
  try {
    const d = JSON.parse(localStorage.getItem(GUARDADO(usuario)) || 'null')
    return d && Array.isArray(d.vistos) ? { ...INICIAL, ...d, cargado: false } : INICIAL
  } catch { return INICIAL }
}

const enviar = (cuerpo) => fetch('/api/tutoriales', {
  method: 'POST',
  keepalive: true,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(cuerpo),
}).catch(() => {})

export default function ProfeProvider({ rol, usuario, children }) {
  const rolConVideos = Boolean(rol) && rol !== 'superadmin'
  const [estado, setEstado] = useState(INICIAL)
  const [abierto, setAbierto] = useState(null)
  const [ayudaAbierta, setAyudaAbierta] = useState(false)
  // La pestaña de la pantalla abierta (la Caja tiene un video por pestaña).
  const [pestana, setPestana] = useState(null)
  const acciones = useAcciones()
  const router = useRouter()
  const pathname = usePathname() || '/'

  const activo = rolConVideos && estado.habilitado

  useEffect(() => {
    // Sin videos para este rol (superadmin): se sabe ya, no hay que esperar.
    if (!rolConVideos) { setEstado({ ...INICIAL, cargado: true }); return undefined }
    setEstado(leerGuardado(usuario))
    let vivo = true
    // Sin respuesta (sin señal), queda lo guardado y se da por cargado: si no,
    // /tutoriales se quedaría en blanco esperando.
    const sinRespuesta = () => { if (vivo) setEstado((e) => ({ ...e, cargado: true })) }
    fetch('/api/tutoriales', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!vivo) return
        if (d && Array.isArray(d.vistos)) setEstado({ ...INICIAL, ...d, cargado: true })
        else sinRespuesta()
      })
      .catch(sinRespuesta)
    return () => { vivo = false }
  }, [rolConVideos, usuario])

  useEffect(() => {
    if (!estado.cargado) return
    try {
      localStorage.setItem(GUARDADO(usuario), JSON.stringify(Object.fromEntries(PERSISTE.map((k) => [k, estado[k]]))))
    } catch {}
  }, [estado, usuario])

  // Al cambiar de pantalla, la hoja de ayuda de la anterior no sigue abierta.
  useEffect(() => { setAyudaAbierta(false) }, [pathname])

  const visibles = useMemo(
    () => (activo ? videosPara({ rol, paraCobradores: estado.paraCobradores }) : []),
    [activo, rol, estado.paraCobradores],
  )
  const vistos = useMemo(() => new Set(estado.vistos), [estado.vistos])
  const guardados = useMemo(() => new Set(estado.guardados), [estado.guardados])
  // Con la app ya instalada no se ofrece el video de instalarla: «enseñarle a
  // instalar a quien ya la instaló confunde» (la misma regla que `FilaInstalar`).
  const [instalada, setInstalada] = useState(false)
  useEffect(() => {
    setInstalada(isStandalone())
    const alInstalar = () => setInstalada(true)
    window.addEventListener('cf:instalada', alInstalar)
    return () => window.removeEventListener('cf:instalada', alInstalar)
  }, [])
  const ayuda = useMemo(
    () => ayudaDeLaPantalla(pathname, pestana, instalada ? visibles.filter((v) => v.id !== VIDEO_INSTALAR) : visibles, { rol }),
    [pathname, pestana, visibles, rol, instalada],
  )

  /** Abre un video. `via`: de dónde se tocó (pastilla, ayuda, minuto, enlace, aviso). */
  const abrir = useCallback((id, { desde = 0, via = null } = {}) => {
    if (!videoPorId(id)) return
    setAyudaAbierta(false)
    setAbierto({ id, desde, via })
  }, [])

  /** La pastilla: con un video lo abre; con varios, la hoja de ayuda. */
  const abrirAyuda = useCallback(() => {
    if (ayuda.todos.length === 1) abrir(ayuda.todos[0].id, { via: 'pastilla' })
    else if (ayuda.todos.length > 1) setAyudaAbierta(true)
  }, [ayuda, abrir])

  const marcar = useCallback((lista, tipo, id) => {
    setEstado((e) => (e[lista].includes(id) ? e : { ...e, [lista]: [...e[lista], id] }))
    enviar({ tipo, id })
  }, [])
  const marcarVisto = useCallback((id) => marcar('vistos', 'visto', id), [marcar])
  const marcarGuardado = useCallback((id) => marcar('guardados', 'guardado', id), [marcar])
  /** «Ya sé cómo» en una tarjeta de primera vez: no vuelve más. */
  const descartarAviso = useCallback((id) => marcar('descartados', 'avisoNo', id), [marcar])
  /** «Volver a mostrar los avisos». */
  const volverAMostrarAvisos = useCallback(() => {
    setEstado((e) => ({ ...e, descartados: [] }))
    enviar({ tipo: 'avisosReset' })
  }, [])

  /** Los interruptores de Ayuda. El de los cobradores solo lo cambia el dueño. */
  const cambiarPreferencia = useCallback((tipo, valor) => {
    const campo = { prefCobradores: 'paraCobradores', prefAvisos: 'mostrarAvisos' }[tipo] ?? 'botonVisible'
    setEstado((e) => ({ ...e, [campo]: valor }))
    enviar({ tipo, valor })
  }, [])

  /** «Ocultar todos los tutoriales», desde la ayuda del Inicio (Carlos, 20 oct
   *  2026): apaga lo que está a la vista —pastillas, enlaces, minutos— y los
   *  avisos de primera vez. No borra nada: la biblioteca sigue en Tutoriales,
   *  con los dos interruptores para volver a prenderlos. */
  const ocultarTodo = useCallback(() => {
    cambiarPreferencia('prefBoton', false)
    cambiarPreferencia('prefAvisos', false)
  }, [cambiarPreferencia])

  /** ¿Sale la tarjeta de primera vez? Solo si de verdad es la primera, si no la
   *  cerró con «Ya sé cómo», si no vio ya el video y con los avisos prendidos. */
  const avisoDe = useCallback((nombre) => {
    const a = PRIMERA_VEZ[nombre]
    if (!a || !activo || !estado.mostrarAvisos || !estado.primeraVez?.[a.clave]) return null
    const video = visibles.find((v) => v.id === a.video)
    if (!video || vistos.has(video.id) || estado.descartados.includes(video.id)) return null
    return { ...a, video }
  }, [activo, estado.mostrarAvisos, estado.primeraVez, estado.descartados, visibles, vistos])

  const hacerTarea = useCallback((video, tarea) => {
    enviar({ tipo: 'tarea', id: video.id, origen: pathname })
    const accion = tarea.accion ? acciones.find((a) => a.id === tarea.accion && a.disponible !== false) : null
    // Después de cerrar la hoja: una acción que abre otra hoja no debe nacer debajo.
    if (accion) setTimeout(() => ejecutarAccion(accion), 120)
    else if (tarea.evento) setTimeout(() => window.dispatchEvent(new Event(tarea.evento)), 120)
    // ⚠ No `router.push`: al cerrarse la hoja su `history.back()` aborta la
    // navegación (ver `salirDeHojaHacia`, components/cf/HojaInferior.jsx).
    else if (pathname !== tarea.href) salirDeHojaHacia(router, tarea.href)
  }, [acciones, pathname, router])

  const valor = useMemo(() => ({
    activo, cargado: estado.cargado, visibles, vistos, guardados, ayuda,
    botonVisible: estado.botonVisible, paraCobradores: estado.paraCobradores,
    mostrarAvisos: estado.mostrarAvisos, descartados: estado.descartados,
    abrir, abrirAyuda, marcarGuardado, cambiarPreferencia, descartarAviso, volverAMostrarAvisos, avisoDe, setPestana,
  }), [activo, estado.cargado, visibles, vistos, guardados, ayuda, estado.botonVisible, estado.paraCobradores,
    estado.mostrarAvisos, estado.descartados, abrir, abrirAyuda, marcarGuardado, cambiarPreferencia, descartarAviso,
    volverAMostrarAvisos, avisoDe])

  const video = abierto ? videoPorId(abierto.id) : null

  return (
    <Contexto.Provider value={valor}>
      {children}
      <NovedadProfe profe={valor} primeraVez={estado.primeraVez} videoAbierto={Boolean(abierto)} />
      {ayudaAbierta && ayuda.todos.length > 1 && (
        <HojaAyudaProfe
          ayuda={ayuda}
          vistos={vistos}
          onAbrir={(id) => abrir(id, { via: 'ayuda' })}
          onBiblioteca={() => { setAyudaAbierta(false); salirDeHojaHacia(router, '/tutoriales') }}
          onCerrar={() => setAyudaAbierta(false)}
          // Solo en el Inicio, donde lo pidió Carlos.
          onOcultarTodo={pathname === '/dashboard' ? ocultarTodo : undefined}
        />
      )}
      {video && (
        <ReproductorProfe
          key={`${video.id}:${abierto.desde}`}
          video={video}
          desde={abierto.desde}
          volver={volverDe(pathname)}
          onCerrar={() => setAbierto(null)}
          onApuntar={(tipo, extra) => enviar({ tipo, id: video.id, origen: pathname, via: abierto.via, ...extra })}
          onVisto={() => marcarVisto(video.id)}
          onTarea={(tarea) => hacerTarea(video, tarea)}
        />
      )}
    </Contexto.Provider>
  )
}

/** El contexto, o null fuera del proveedor (nada del profe se pinta). */
export function useProfe() {
  return useContext(Contexto)
}

/** La pantalla dice en qué pestaña está, para que la pastilla abra su video. */
export function usePestanaProfe(nombre) {
  const fijar = useContext(Contexto)?.setPestana
  useEffect(() => {
    if (!fijar) return undefined
    fijar(nombre ?? null)
    return () => fijar(null)
  }, [fijar, nombre])
}
