'use client'

/* Los videos del profe para toda la app: qué ve esta persona, cuáles ya vio y
 * el reproductor, uno solo, montado aquí.
 *
 * ⚠ VA DENTRO DE `AccionesProvider`. El botón de la tarea («Registrar mi
 * capital inicial», «Empezar recorrido») ejecuta la acción que la pantalla
 * abierta ya registró para el buscador; si esa pantalla no está, navega a la
 * suya (`TAREAS`, lib/tutoriales/profe.js). Fuera del proveedor de acciones no
 * vería ninguna.
 *
 * «Visto» y los interruptores viven en el servidor (/api/tutoriales), por
 * persona. Lo de `localStorage` es solo para pintar el primer cuadro sin que
 * los íconos cambien de color al llegar la respuesta. */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAcciones, ejecutarAccion } from '@/components/acciones/AccionesProvider'
import { videosPara, videoPorId } from '@/lib/tutoriales/profe'
import { salirDeHojaHacia } from '@/components/cf/HojaInferior'
import ReproductorProfe from './ReproductorProfe'

const Contexto = createContext(null)
// Por usuario: en un teléfono con «Cuentas guardadas» una cuenta no hereda lo de otra.
const GUARDADO = (usuario) => `cf:profe:${usuario}`

// `habilitado` lo dice el servidor (`profeHabilitado`): mientras no conteste, nada.
const INICIAL = { cargado: false, habilitado: false, vistos: [], guardados: [], botonVisible: true, paraCobradores: true }

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
  const acciones = useAcciones()
  const router = useRouter()
  const pathname = usePathname()

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
      const { habilitado, vistos, guardados, botonVisible, paraCobradores } = estado
      localStorage.setItem(GUARDADO(usuario), JSON.stringify({ habilitado, vistos, guardados, botonVisible, paraCobradores }))
    } catch {}
  }, [estado, usuario])

  const visibles = useMemo(
    () => (activo ? videosPara({ rol, paraCobradores: estado.paraCobradores }) : []),
    [activo, rol, estado.paraCobradores],
  )
  const vistos = useMemo(() => new Set(estado.vistos), [estado.vistos])
  const guardados = useMemo(() => new Set(estado.guardados), [estado.guardados])

  /** Abre un video. `via`: de dónde se tocó (D1, E2, ayuda), para medir. */
  const abrir = useCallback((id, { desde = 0, via = null } = {}) => {
    if (!videoPorId(id)) return
    setAbierto({ id, desde, via })
  }, [])

  const marcar = useCallback((lista, tipo, id) => {
    setEstado((e) => (e[lista].includes(id) ? e : { ...e, [lista]: [...e[lista], id] }))
    enviar({ tipo, id })
  }, [])
  const marcarVisto = useCallback((id) => marcar('vistos', 'visto', id), [marcar])
  const marcarGuardado = useCallback((id) => marcar('guardados', 'guardado', id), [marcar])

  /** Los dos interruptores de Ayuda. El de los cobradores solo lo cambia el dueño. */
  const cambiarPreferencia = useCallback((tipo, valor) => {
    const campo = tipo === 'prefCobradores' ? 'paraCobradores' : 'botonVisible'
    setEstado((e) => ({ ...e, [campo]: valor }))
    enviar({ tipo, valor })
  }, [])

  const hacerTarea = useCallback((video, tarea) => {
    enviar({ tipo: 'tarea', id: video.id, origen: pathname })
    const accion = tarea.accion ? acciones.find((a) => a.id === tarea.accion && a.disponible !== false) : null
    // Después de cerrar la hoja: una acción que abre otra hoja no debe nacer debajo.
    if (accion) setTimeout(() => ejecutarAccion(accion), 120)
    // ⚠ No `router.push`: al cerrarse la hoja su `history.back()` aborta la
    // navegación (ver `salirDeHojaHacia`, components/cf/HojaInferior.jsx).
    else if (pathname !== tarea.href) salirDeHojaHacia(router, tarea.href)
  }, [acciones, pathname, router])

  const valor = useMemo(() => ({
    activo, cargado: estado.cargado, visibles, vistos, guardados,
    botonVisible: estado.botonVisible, paraCobradores: estado.paraCobradores,
    abrir, marcarGuardado, cambiarPreferencia,
  }), [activo, estado.cargado, visibles, vistos, guardados, estado.botonVisible, estado.paraCobradores, abrir, marcarGuardado, cambiarPreferencia])

  const video = abierto ? videoPorId(abierto.id) : null

  return (
    <Contexto.Provider value={valor}>
      {children}
      {video && (
        <ReproductorProfe
          key={`${video.id}:${abierto.desde}`}
          video={video}
          desde={abierto.desde}
          onCerrar={() => setAbierto(null)}
          onApuntar={(tipo, extra) => enviar({ tipo, id: video.id, origen: pathname, via: abierto.via, ...extra })}
          onVisto={() => marcarVisto(video.id)}
          onTarea={(tarea) => hacerTarea(video, tarea)}
        />
      )}
    </Contexto.Provider>
  )
}

/** El contexto, o null fuera del proveedor (los botones no se pintan). */
export function useProfe() {
  return useContext(Contexto)
}
