'use client'

/* «ESTE COBRO SE VA A GUARDAR SIN UBICACIÓN» — 22 sep 2026.
 *
 * La ubicación del cobro es dato de auditoría: es lo que le permite al dueño ver
 * dónde se cobró. Medido en producción ese día, sobre 14 días de cobros: llega en
 * el 70 % (87 % entre cobradores), pero no repartido — hay SEIS cobradores que no
 * mandan ninguna, ningún día, y uno que venía al 100 % y se quedó en cero de un
 * día para otro. No es el sistema: es el permiso de su teléfono. Y nadie se lo
 * decía, ni a ellos ni al dueño (que lo ve en su caja, «N sin ubicación»).
 *
 * Por eso el aviso va DENTRO de la hoja de cobro y no en una franja arriba: se
 * lee justo donde importa, no interrumpe, y se va solo en cuanto el teléfono
 * conteste. No pide permiso por su cuenta —eso ya lo hace `calentarCoords` al
 * abrir la hoja—; ofrece volver a intentarlo, que es lo que arregla el caso de
 * «la tenía apagada y ya la prendí».
 */
import { useCallback, useEffect, useState } from 'react'
import { estadoUbicacion, calentarCoords } from '@/lib/geo'
import { Aviso } from '@/components/cf/primitivos'

/* Solo se avisa de lo que el cobrador puede ARREGLAR. Un navegador sin
   geolocalización o un permiso que aún no se ha pedido no son su problema. */
const TEXTOS = {
  'sin-permiso': 'Este cobro se guardará sin ubicación: el teléfono tiene bloqueado el permiso para esta página. Se activa en los ajustes del navegador, en Ubicación.',
  apagada: 'Este cobro se guardará sin ubicación: el teléfono no la está dando. Suele ser la ubicación apagada o estar bajo techo.',
}

export default function AvisoUbicacion({ activo = true }) {
  const [estado, setEstado] = useState(null)
  const [probando, setProbando] = useState(false)

  const mirar = useCallback(() => {
    let vivo = true
    estadoUbicacion().then((e) => { if (vivo) setEstado(e) }).catch(() => {})
    return () => { vivo = false }
  }, [])

  useEffect(() => {
    if (!activo) return undefined
    const parar = mirar()
    /* Se vuelve a mirar mientras la hoja está abierta: `calentarCoords` puede
       contestar unos segundos después y entonces el aviso sobra. */
    const t = setInterval(mirar, 2500)
    return () => { parar(); clearInterval(t) }
  }, [activo, mirar])

  const texto = TEXTOS[estado]
  if (!activo || !texto) return null

  return (
    <Aviso tono="ambar" style={{ alignItems: 'center' }}>
      {texto}
      {' '}
      <button
        type="button"
        onClick={() => { setProbando(true); calentarCoords(); setTimeout(() => { setProbando(false); mirar() }, 1500) }}
        style={{
          background: 'none', border: 'none', padding: 0, font: 'inherit',
          color: 'var(--cf-gold-text)', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer',
        }}
      >
        {probando ? 'Probando…' : 'Probar de nuevo'}
      </button>
    </Aviso>
  )
}
