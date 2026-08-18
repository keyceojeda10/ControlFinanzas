'use client'

// app/(dashboard)/socios/page.jsx — T45-01 la lista de socios.
//
// ══ MONTADO, NO REESCRITO ══════════════════════════════════════════════════
//
// Los componentes (`ListaSocios`, `LoQuePusieron`, `GananciaSinRepartir`,
// `TarjetaSocio`) y su adaptador estaban construidos y probados desde el bloque
// de socios, y esta ruta seguía pintando la versión vieja. Aquí solo se conecta:
// se traen los datos del API, se pasan por el adaptador, y se pinta.
//
// ══ LO QUE EL API DA Y LO QUE NO ═══════════════════════════════════════════
//
// `/api/socios` devuelve por socio: totalAportes, capitalAportado, totalRetiros,
// utilidadesAsignadas, capitalEnCalle e interesesCobrados.
//
// LO PUESTO es capitalAportado menos retiros — NO totalAportes. `totalAportes`
// incluye las utilidades reinvertidas, y meterlas subiría el porcentaje del socio
// al que ya se le debe más, que es justo al revés de lo que tiene que pasar.
//
// LO REPARTIDO no existe: falta el tipo de movimiento «reparto» en el esquema
// (ver PENDIENTE-BACKEND en lib/adaptadores/socios.js). Por eso «Le debes» llega
// `undefined` y la columna no se pinta. Un «$0» ahí se leería como «no le debo
// nada», y lo cierto es que todavía no se ha repartido nunca.

import { useState, useEffect, useCallback } from 'react'
import { useCabecera } from '@/components/armazon/Armazon'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useCountry } from '@/hooks/useCountry'
import { formatMoney } from '@/lib/i18n'
import { ListaSocios } from '@/components/pantallas/SociosReparto'
import { PilaEsqueletos } from '@/components/cf/primitivos2'
import { EstadoVacio } from '@/components/cf/primitivos'
import { loQuePusieron, cuentaDelSocio, cabeceraSocios, tuParte } from '@/lib/adaptadores/socios'
import { RegistrarAcciones } from '@/components/acciones/AccionesProvider'
import QueNecesitas from '@/components/acciones/QueNecesitas'

export default function SociosPage() {
  const { esOwner, loading: authLoading } = useAuth()
  const { country } = useCountry()
  const router = useRouter()
  const [socios, setSocios] = useState([])
  // El capital en calle NO viene de /api/socios: esa ruta devuelve un array
  // pelado y otras dos pantallas lo consumen asi (`d.map`), de modo que
  // cambiarle la forma las rompe en silencio. Se pide aparte.
  const [enCalle, setEnCalle] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const fmt = useCallback((v) => formatMoney(v, country), [country])

  const cargar = useCallback(async () => {
    try {
      setCargando(true)
      setError('')
      const res = await fetch('/api/socios', { cache: 'no-store' })
      if (!res.ok) throw new Error('no')
      setSocios(await res.json())
      // Si esto falla la pantalla sigue: «Tu parte» desaparece, que es mejor que
      // enseñar una resta con un lado inventado.
      fetch('/api/capital/resumen', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setEnCalle(d?.cartera?.capitalEnCalle ?? null))
        .catch(() => {})
    } catch {
      setError('No se pudieron cargar los socios.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  /* La cabecera del sistema: ver el mismo aviso en `gastos/page.jsx`.
     ⚠ VA ANTES DEL RETURN: es un hook. */
  useCabecera({
    titulo: 'Socios',
    subtitulo: socios.length === 0
      ? 'ninguno todavía'
      : `${socios.length} socio${socios.length === 1 ? '' : 's'}`,
  })

  if (authLoading || cargando) return <PilaEsqueletos cuantos={3} alto={116} />

  if (!esOwner) {
    return (
      <p style={{ padding: 16, textAlign: 'center', color: 'var(--cf-ink-3)', fontSize: 14 }}>
        No tienes acceso a esta sección.
      </p>
    )
  }

  if (error) {
    return (
      <EstadoVacio
        titulo="No se pudieron cargar los socios"
        explicacion="Puede ser la conexión. Vuelve a intentarlo."
        accion={<button type="button" onClick={cargar} style={BOTON}>Reintentar</button>}
      />
    )
  }

  if (socios.length === 0) {
    return (
      <EstadoVacio
        titulo="Todavía no hay socios"
        explicacion="Un socio es alguien que pone capital en el negocio. Cuando lo registres, aquí verás cuánto puso cada uno y qué le corresponde."
        accion={
          <button type="button" onClick={() => router.push('/socios/nuevo')} style={BOTON}>
            Registrar el primero
          </button>
        }
      />
    )
  }

  // `puesto` = capital que puso de su bolsillo, sin utilidades reinvertidas.
  //
  // Ordenados por lo puesto, de mayor a menor: es el orden en que se lee la barra
  // de arriba, y el que responde «¿de quién es la mayor parte de este negocio?»
  // sin comparar porcentajes uno a uno. Por fecha de alta no dice nada.
  const paraAdaptador = socios.map((s) => ({
    ...s,
    puesto: Math.max(0, (s.capitalAportado ?? s.totalAportes ?? 0) - (s.totalRetiros ?? 0)),
    pagado: s.totalRetiros ?? 0,
    // `repartido` se deja fuera a propósito: el tipo de movimiento no existe.
  })).sort((a, b) => b.puesto - a.puesto)

  const puesto = loQuePusieron(paraAdaptador, fmt)
  const porId = Object.fromEntries(puesto.socios.map((s) => [s.id, s]))

  /* ══ LO QUE SE PUEDE HACER CON LOS SOCIOS ================================
   *
   * Módulo pequeño y de vocabulario propio: quien tiene socios dice «aporte» y
   * «retiro», pero también «metió plata», «le devolví» y «cuánto le debo». La
   * decisión de julio dejó UN solo modelo —reparto por % del capital—, así que
   * aquí no hay que ofrecer nada del reparto por préstamo. */
  const accionesSocios = [
    { id: 'soc-nuevo', label: 'Agregar un socio', pista: 'Quién más pone plata',
      sinonimos: ['nuevo socio', 'agregar socio', 'crear socio', 'meter un socio',
        'alguien mas puso plata'],
      ejecutar: () => router.push('/socios/nuevo') },
  ]

  return (
    /* Sin `height: 100%`: el propio componente lleva escrito que acotarlo al
       alto de la ventana es lo que obligaba a la caja de dentro a deslizarse
       por su cuenta. Crece con su contenido. */
    <div>
      <ListaSocios
        cabecera={cabeceraSocios(socios)}
        puesto={puesto}
        tuParte={enCalle === null ? null : tuParte(
          // `puesto.total` es el TEXTO ya formateado («$14.000.000»); el número
          // vive en `numeros.total`. Restar el texto daba NaN → 0, y entonces
          // «Tu parte» no se pintaba: un fallo que se ve como una decisión.
          { capitalEnCalle: enCalle, puestoPorSocios: puesto.numeros.total },
          fmt,
        )}
        sociosTitulo="Cada socio"
        socios={paraAdaptador.map((s) => cuentaDelSocio(
          { ...s, porcentaje: porId[s.id]?.porcentaje },
          fmt,
        ))}
        onSocio={(s) => router.push(`/socios/${s.id}`)}
        onNuevo={() => router.push('/socios/nuevo')}
        /* ⚠ ENTRE LAS CIFRAS Y LA LISTA, no al final.
           Decía aquí que iba debajo «porque el listado es corto y una caja por
           delante empuja lo que se viene a mirar». Lo que se viene a mirar es
           el bloque oscuro con lo que pusieron, y ese sigue primero: lo que se
           empuja es la lista.
           Con un socio la pantalla mide media ventana y la caja quedaba colgada
           al fondo con 170px de nada debajo — «sale prácticamente abajo del
           todo», 18 de agosto. */
        antesDeLaLista={
          <div style={{ padding: '2px 0 0' }}>
            <RegistrarAcciones clave="socios" acciones={accionesSocios} />
            <QueNecesitas ejemplos={['agregar un socio']} />
          </div>
        }
      />
    </div>
  )
}

const BOTON = {
  height: 46, padding: '0 20px', borderRadius: 14, border: 'none', cursor: 'pointer',
  background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
  font: 'inherit', fontSize: 15, fontWeight: 700,
}
