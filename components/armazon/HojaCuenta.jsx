'use client'

// components/armazon/HojaCuenta.jsx — Se abre desde el avatar de la cabecera.
// docs/design_handoff/02-ARMAZON.md sección C.
//
// AQUÍ VIVE EL CAMBIO DE TEMA, y es una decisión, no un descuido:
//
//   Un usuario cambia de tema una o dos veces en su vida. Poner ese control
//   permanente en los 390px más caros de la app es gastar el mejor sitio en el
//   botón menos usado. En escritorio sí va visible, porque en la barra lateral
//   no le quita sitio a nada.
//
// Las tres opciones se eligen viendo una VISTA PREVIA DIBUJADA de cómo queda la
// app, nunca un desplegable con nombres: "Oscuro" no le dice nada a nadie hasta
// que lo ve.

import HojaInferior from '@/components/cf/HojaInferior'
import { getAvatarById } from '@/lib/avatars'
import { Tarjeta, Pastilla, BotonDestructivo } from '@/components/cf/primitivos'

/* Miniatura de 34px que imita la pantalla. Es lo que hace elegible el tema. */
function VistaPrevia({ modo }) {
  const auto = modo === 'system'
  const oscuro = modo === 'dark'
  const fondo = oscuro ? '#15161A' : '#F4F4F1'
  const tarjeta = oscuro ? '#1E1F24' : '#FFFFFF'
  const linea = oscuro ? 'rgba(255,255,255,.22)' : 'rgba(20,20,28,.18)'
  return (
    <span aria-hidden style={{
      position: 'relative', display: 'block', height: 34, borderRadius: 7,
      overflow: 'hidden', border: '1px solid var(--cf-border)', background: fondo,
    }}>
      {auto && (
        <span style={{ position: 'absolute', inset: 0, width: '50%', background: '#15161A' }} />
      )}
      <span style={{ position: 'absolute', left: 5, right: 5, top: 5, height: 7, borderRadius: 2, background: tarjeta }} />
      <span style={{ position: 'absolute', left: 5, right: 14, top: 15, height: 3, borderRadius: 2, background: linea }} />
      <span style={{ position: 'absolute', left: 5, right: 20, top: 22, height: 3, borderRadius: 2, background: linea }} />
      <span style={{ position: 'absolute', right: 5, bottom: 5, width: 8, height: 8, borderRadius: 999, background: '#E7A400' }} />
    </span>
  )
}

function OpcionTema({ modo, nombre, activo, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={activo}
      style={{
        flex: 1, minWidth: 0, padding: 8, cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 7,
        background: 'var(--cf-card)',
        borderRadius: 'var(--cf-r-control)',
        /* El par borde+anillo dorado es la ÚNICA señal de selección del sistema. */
        border: activo ? '1.5px solid var(--cf-gold)' : '1px solid var(--cf-border)',
        boxShadow: activo ? '0 0 0 3px var(--cf-gold-focus)' : 'none',
      }}>
      <VistaPrevia modo={modo} />
      <span style={{ fontSize: 12, fontWeight: activo ? 700 : 600, color: activo ? 'var(--cf-ink)' : 'var(--cf-ink-2)' }}>
        {nombre}
      </span>
    </button>
  )
}

function FilaAcceso({ nombre, pastilla, onClick, primera }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        height: 54, padding: '0 19px', cursor: 'pointer',
        background: 'none', border: 0,
        borderTop: primera ? 'none' : '1px solid var(--cf-hairline)',
      }}>
      <span style={{ flex: 1, textAlign: 'left', fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)' }}>{nombre}</span>
      {pastilla}
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--cf-chevron)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  )
}

export default function HojaCuenta({
  abierta, onCerrar,
  nombre = '', negocio = '', rol = '', iniciales = '', avatarId = null,
  conectado = true, guardadoHace = 'hace un momento',
  tema = 'light', onCambiarTema,
  diasRestantesPlan = null,
  onConfiguracion, onPlan, onSoporte, onCerrarSesion,
}) {
  return (
    <HojaInferior abierta={abierta} onCerrar={onCerrar} titulo="Tu cuenta"
      accion={<BotonDestructivo onClick={onCerrarSesion} style={{ width: '100%' }}>Cerrar sesión</BotonDestructivo>}>

      {/* 1 · Identidad */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '2px 0 6px' }}>
        <span style={{ position: 'relative', flex: 'none' }}>
          {/* El avatar elegido, si lo hay. Es la hoja a la que lleva la pastilla
              de la cabecera: si allí sale el dibujo y aquí las iniciales, parece
              que se abrió la cuenta de otro. */}
          {avatarId && getAvatarById(avatarId) ? (
            <span aria-hidden style={{
              display: 'inline-block', overflow: 'hidden',
              width: 52, height: 52, borderRadius: 999,
            }} dangerouslySetInnerHTML={{ __html: getAvatarById(avatarId).svg }} />
          ) : (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 52, height: 52, aspectRatio: '1', borderRadius: 999,
              background: 'var(--cf-blue)', fontSize: 19, fontWeight: 700, color: '#FFF',
            }}>{iniciales}</span>
          )}
          <span style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 14, height: 14, borderRadius: 999,
            background: conectado ? 'var(--cf-green)' : 'var(--cf-ink-4)',
            border: '2.5px solid var(--cf-surface)',
          }} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'block', fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{nombre}</span>
          <span style={{ display: 'block', fontSize: 13, color: 'var(--cf-ink-3)', marginTop: 2 }}>
            {negocio}{rol ? ` · ${rol}` : ''}
          </span>
        </span>
      </div>

      {/* 2 · Cómo se ve la app */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
          Cómo se ve la app
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <OpcionTema modo="light"  nombre="Claro"      activo={tema === 'light'}  onClick={() => onCambiarTema?.('light')} />
          <OpcionTema modo="dark"   nombre="Oscuro"     activo={tema === 'dark'}   onClick={() => onCambiarTema?.('dark')} />
          <OpcionTema modo="system" nombre="Automático" activo={tema === 'system'} onClick={() => onCambiarTema?.('system')} />
        </div>
        <span style={{ fontSize: 12, color: 'var(--cf-ink-3)', lineHeight: 1.45 }}>
          Automático usa el oscuro cuando tu teléfono lo tenga puesto.
        </span>
      </div>

      {/* 3 · Accesos */}
      <Tarjeta plana>
        <FilaAcceso primera nombre="Configuración" onClick={onConfiguracion} />
        <FilaAcceso
          nombre="Plan y pagos"
          onClick={onPlan}
          pastilla={diasRestantesPlan != null && (
            <Pastilla tono={diasRestantesPlan <= 7 ? 'atraso' : 'neutro'} numerica>
              {diasRestantesPlan}d
            </Pastilla>
          )}
        />
        <FilaAcceso nombre="Soporte" onClick={onSoporte} />
      </Tarjeta>

      {/* 4 · Estado de conexión */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 2px 4px' }}>
        <Pastilla tono={conectado ? 'aldia' : 'neutro'}>
          <span style={{
            width: 6, height: 6, borderRadius: 999, marginRight: 6,
            background: conectado ? 'var(--cf-green)' : 'var(--cf-ink-4)',
          }} />
          {conectado ? 'Conectado' : 'Sin conexión'}
        </Pastilla>
        <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>
          Todo guardado {guardadoHace}
        </span>
      </div>
    </HojaInferior>
  )
}
