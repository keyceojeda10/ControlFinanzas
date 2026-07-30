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
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useCountry } from '@/hooks/useCountry'
import { formatMoney } from '@/lib/i18n'
import { ListaSocios } from '@/components/pantallas/SociosReparto'
import { PilaEsqueletos } from '@/components/cf/primitivos2'
import { EstadoVacio } from '@/components/cf/primitivos'
import { loQuePusieron, cuentaDelSocio, cabeceraSocios } from '@/lib/adaptadores/socios'

export default function SociosPage() {
  const { esOwner, loading: authLoading } = useAuth()
  const { country } = useCountry()
  const router = useRouter()
  const [socios, setSocios] = useState([])
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
    } catch {
      setError('No se pudieron cargar los socios.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

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

  return (
    <div style={{ height: '100%', minHeight: 0 }}>
      <ListaSocios
        cabecera={cabeceraSocios(socios)}
        puesto={puesto}
        sociosTitulo="Cada socio"
        socios={paraAdaptador.map((s) => cuentaDelSocio(
          { ...s, porcentaje: porId[s.id]?.porcentaje },
          fmt,
        ))}
        onSocio={(s) => router.push(`/socios/${s.id}`)}
        onNuevo={() => router.push('/socios/nuevo')}
      />
    </div>
  )
}

const BOTON = {
  height: 46, padding: '0 20px', borderRadius: 14, border: 'none', cursor: 'pointer',
  background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
  font: 'inherit', fontSize: 15, fontWeight: 700,
}
