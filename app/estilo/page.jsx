'use client'

// app/estilo/page.jsx — Galería del sistema de diseño 2026.
//
// No es una pantalla de producto: es el banco de pruebas. Cada pieza que se
// construye para el rediseño aparece acá aislada, para poder compararla contra
// el mockup sin tener que navegar la app con datos reales.
//
// Vive fuera de (dashboard) a propósito: sin sesión, sin layout, sin datos.

import { useState } from 'react'
import CabeceraMovil, { EspinaProgreso } from '@/components/armazon/CabeceraMovil'
import { CABECERA, resolverArmazon, DESTINOS } from '@/lib/armazon'
import BarraLateral from '@/components/armazon/BarraLateral'
import TarjetaCliente from '@/components/cf/TarjetaCliente'
import HojaCuenta from '@/components/armazon/HojaCuenta'
import HojaInferior from '@/components/cf/HojaInferior'
import Panel from '@/components/pantallas/Panel'
import {
  Tarjeta, BloqueOscuro, TiraCifras, AntesDespues, Pastilla,
  BotonPrimario, BotonSecundario, BotonDestructivo, BotonTexto, BarraAccion,
  Campo, EtiquetaCampo, AyudaCampo, BarraProgreso, Chip, Aviso, EstadoVacio,
} from '@/components/cf/primitivos'

const RUTAS_MUESTRA = [
  '/dashboard', '/cobros-hoy', '/clientes', '/prestamos', '/rutas', '/caja',
  '/clientes/abc', '/prestamos/abc', '/rutas/r1',
  '/prestamos/nuevo', '/clientes/nuevo', '/migrador',
  '/capital', '/gastos', '/configuracion',
  '/firma/x', '/portal', '/registro',
]

function Marco({ titulo, nota, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>{titulo}</div>
        {nota && <div style={{ fontSize: 12, color: 'var(--cf-ink-3)', marginTop: 2, maxWidth: 330 }}>{nota}</div>}
      </div>
      <div style={{
        width: 390, height: 300, position: 'relative', overflow: 'hidden',
        background: 'var(--cf-surface)',
        border: '1px solid var(--cf-border)', borderRadius: 18,
      }}>{children}</div>
    </div>
  )
}

// Contenido de relleno para ver cómo pasa por debajo de la pastilla.
function Relleno({ n = 4 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 20px 0' }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          borderRadius: 18, height: 74, flex: 'none',
          display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px 0 19px', position: 'relative',
        }}>
          <span style={{ position: 'absolute', left: 0, top: 14, bottom: 14, width: 4, borderRadius: 999, background: i === 0 ? 'var(--cf-red)' : i === 1 ? 'var(--cf-gold)' : 'var(--cf-green)' }} />
          <span style={{ width: 40, height: 40, borderRadius: 999, background: 'var(--cf-fill)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: 'var(--cf-ink-2)', flex: 'none' }}>SO</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 16, fontWeight: 700, letterSpacing: '-.015em', color: 'var(--cf-ink)' }}>Steven Olmos</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--cf-ink-3)' }}>Bolivariana · Cl 8 # 31-05</span>
          </span>
          <span className="cf-fig" style={{ fontSize: 17, color: 'var(--cf-ink)', letterSpacing: '-.02em' }}>$130.500</span>
        </div>
      ))}
    </div>
  )
}

// Réplica estática de la pastilla (el componente real usa usePathname).
function PastillaDemo({ activo = '/dashboard' }) {
  const ICON = {
    '/dashboard': <><path d="M4 11.5L12 4l8 7.5" /><path d="M6 10.5V20h12v-9.5" /></>,
    '/clientes': <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19.5c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8" /><path d="M16 5.5a3 3 0 010 5.6M17.5 19.5c0-2.2-.8-3.6-2-4.5" /></>,
    '/prestamos': <><rect x="3" y="6" width="18" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.6" /><path d="M6.5 12h.01M17.5 12h.01" /></>,
    '/rutas': <><path d="M9 4.5L3.5 6.8v12.7L9 17.2l6 2.3 5.5-2.3V4.5L15 6.8 9 4.5z" /><path d="M9 4.5v12.7M15 6.8v12.7" /></>,
    '/mas': <><rect x="4" y="4" width="6.5" height="6.5" rx="1.8" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8" /></>,
  }
  return (
    <div style={{ position: 'absolute', left: 16, right: 16, bottom: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, height: 62, borderRadius: 999, background: 'var(--cf-card)', border: '1px solid var(--cf-border)', boxShadow: 'var(--cf-sh-nav)', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 6px' }}>
        {DESTINOS.map(d => {
          const a = d.href === activo
          return (
            <span key={d.href} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: 999, background: a ? 'var(--cf-gold-tint)' : 'transparent' }}>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={a ? 'var(--cf-gold-dark)' : 'var(--cf-ink-3)'} strokeWidth={a ? 2.1 : 1.9} strokeLinecap="round" strokeLinejoin="round">{ICON[d.href]}</svg>
            </span>
          )
        })}
      </div>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none', width: 62, height: 62, borderRadius: 999, background: 'var(--cf-ink)', boxShadow: 'var(--cf-sh-plus)' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--cf-gold-light)" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </span>
    </div>
  )
}

export default function Estilo() {
  const [paso] = useState(2)
  const [hoja, setHoja] = useState(null)
  const [tema, setTema] = useState('light')
  return (
    <div style={{ background: 'var(--cf-surface)', minHeight: '100vh', padding: 30, fontFamily: 'var(--font-manrope), system-ui' }}>
      <h1 style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 26, fontWeight: 600, letterSpacing: '-.025em', color: 'var(--cf-ink)', margin: '0 0 4px' }}>
        Armazón 2026
      </h1>
      <p style={{ fontSize: 13, color: 'var(--cf-ink-3)', margin: '0 0 26px', maxWidth: 620 }}>
        Cabecera de 56px en sus tres variantes, y la pastilla flotante de 62px a 18px del borde.
        El armazón aparece cuando el usuario navega y se retira cuando hace una sola cosa.
      </p>

      <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
        <Marco titulo="Navegación · armazón completo" nota="Las 6 pantallas de navegación. El contenido pasa POR DEBAJO de la pastilla a propósito.">
          <CabeceraMovil variante={CABECERA.NAVEGACION} iniciales="CC" conectado hayAvisos />
          <Relleno n={3} />
          <PastillaDemo activo="/dashboard" />
        </Marco>

        <Marco titulo="Detalle · solo cabecera" nota="Ficha de cliente. A la derecha las acciones de ESE objeto, no las de la app. Sin pastilla: su salida es volver.">
          <CabeceraMovil
            variante={CABECERA.DETALLE}
            titulo="Steven Olmos"
            subtitulo="2 préstamos · debe $291.000"
            acciones={
              <>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--cf-whatsapp)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20l1.3-3.9A8 8 0 1112 20a8 8 0 01-4.1-1.1L4 20z" /></svg>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--cf-ink-2)"><circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" /></svg>
                </span>
              </>
            }
          />
          <Relleno n={3} />
        </Marco>

        <Marco titulo="Tarea · cerrar y progreso" nota="Registrar un cobro. Cerrar arriba a la izquierda, lejos del pulgar: salirse a medias pierde datos.">
          <CabeceraMovil variante={CABECERA.TAREA} titulo="Cobro 3 de 11" paso={paso} total={11} />
          <Relleno n={3} />
        </Marco>
      </div>

      <h2 style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)', margin: '34px 0 10px' }}>
        La regla, aplicada
      </h2>
      <div style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)', borderRadius: 18, overflow: 'hidden', maxWidth: 780 }}>
        <div style={{ display: 'flex', height: 40, alignItems: 'center', padding: '0 20px', background: 'var(--cf-fill)', fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
          <span style={{ flex: 1 }}>Ruta</span>
          <span style={{ width: 108 }}>Cabecera</span>
          <span style={{ width: 76 }}>Pastilla</span>
          <span style={{ flex: 1.5 }}>Por qué</span>
        </div>
        {RUTAS_MUESTRA.map((r) => {
          const a = resolverArmazon(r)
          return (
            <div key={r} style={{ display: 'flex', minHeight: 42, alignItems: 'center', padding: '7px 20px', borderTop: '1px solid var(--cf-hairline)', fontSize: 12 }}>
              <code style={{ flex: 1, color: 'var(--cf-ink)', fontSize: 11.5 }}>{r}</code>
              <span style={{ width: 108, color: 'var(--cf-ink-2)', fontWeight: 600 }}>{a.cabecera}</span>
              <span style={{ width: 76 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', borderRadius: 11,
                  fontSize: 10, fontWeight: 700,
                  background: a.pastilla ? 'var(--cf-green-pill-bg)' : 'var(--cf-fill)',
                  border: `1px solid ${a.pastilla ? 'var(--cf-green-pill-border)' : 'var(--cf-border)'}`,
                  color: a.pastilla ? 'var(--cf-green-dark)' : 'var(--cf-ink-3)',
                }}>{a.pastilla ? 'sí' : 'no'}</span>
              </span>
              <span style={{ flex: 1.5, color: 'var(--cf-ink-3)', fontSize: 11.5, lineHeight: 1.35 }}>{a.motivo}</span>
            </div>
          )
        })}
      </div>

      <h2 style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)', margin: '34px 0 10px' }}>
        Componentes base
      </h2>
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ width: 350, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <BloqueOscuro etiqueta="Patrimonio" cifra="$27.616.416">
            <TiraCifras sobreOscuro columnas={[
              { etiqueta: 'En caja', valor: '$2.5M' },
              { etiqueta: 'Por cobrar', valor: '$25.1M', tono: 'oro' },
              { etiqueta: 'En mora', valor: '13', tono: 'contra' },
            ]} />
          </BloqueOscuro>

          <AntesDespues
            concepto="Próxima cuota" antes="$14.500" despues="$29.500" tono="empeora"
            resumen={{ etiqueta: 'Recargo aplicado', valor: '$15.000' }} />

          <TarjetaCliente
            nombre="Steven Olmos" iniciales="SO" estado="mora" etiquetaEstado="En mora"
            diasAtraso={36} contexto="Bolivariana · Cl 8 # 31-05"
            monto="$130.500" porcentaje={18} />

          <TarjetaCliente
            nombre="María Fernanda Restrepo Vélez" iniciales="MR" estado="aldia" etiquetaEstado="Al día"
            contexto="Centro · Cra 12 # 4-18" monto="$811.334" porcentaje={72} />
        </div>

        <div style={{ width: 350, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Tarjeta>
            <EtiquetaCampo>Cuánto le vas a prestar</EtiquetaCampo>
            <Campo defaultValue="$500.000" foco />
            <AyudaCampo>Con 20% al mes, la cuota diaria le queda en $20.000.</AyudaCampo>
          </Tarjeta>

          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <Chip activo>Todos</Chip>
            <Chip conteo={13}>+30d</Chip>
            <Chip conteo={5}>Sin ruta</Chip>
            <Pastilla tono="mora" numerica>36d</Pastilla>
            <Pastilla tono="atraso">Atraso leve</Pastilla>
            <Pastilla tono="aldia">Al día</Pastilla>
          </div>

          <Aviso tono="ambar">Si se vence sigues cobrando y registrando pagos normal. Lo que se bloquea es crear préstamos nuevos.</Aviso>
          <Aviso tono="rojo">Lo contado no cuadra con lo registrado: faltan $12.000.</Aviso>

          <BotonPrimario>Aplicar $15.000</BotonPrimario>
          <BarraAccion style={{ borderRadius: 14, border: '1px solid var(--cf-border)' }}>
            <BotonPrimario style={{ flex: 2 }}>Cobrar y pasar al siguiente</BotonPrimario>
            <BotonSecundario style={{ flex: 1 }} cancelar>Cancelar</BotonSecundario>
          </BarraAccion>
          <BotonDestructivo>Mover a perdidos</BotonDestructivo>
          <BotonTexto>Ver los 7 cobros de hoy</BotonTexto>
        </div>

        <div style={{ width: 350 }}>
          <Tarjeta plana>
            <EstadoVacio
              titulo="Todavía no tienes clientes"
              explicacion="Pasa tu cuaderno con una foto y en cinco minutos tienes la cartera adentro."
              accion={<BotonPrimario>Pasar mi cuaderno</BotonPrimario>}
              secundaria={<BotonTexto>Crear uno a mano</BotonTexto>} />
          </Tarjeta>
        </div>
      </div>

      <h2 style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)', margin: '34px 0 10px' }}>
        Panel del dueño · pantalla completa
      </h2>
      <div id="panel-completo" style={{
        width: 390, height: 844, position: 'relative', overflow: 'hidden',
        background: 'var(--cf-surface)', border: '1px solid var(--cf-border)', borderRadius: 18,
      }}>
        <CabeceraMovil variante={CABECERA.NAVEGACION} iniciales="CC" conectado hayAvisos />
        <div style={{ height: 'calc(100% - 56px)', overflowY: 'auto' }}>
          <Panel
            saludo="Buenos días" nombre="Carlos" fecha="martes 28 de julio"
            patrimonio="$27.616.416" enCaja="$2.5M" porCobrar="$25.1M" clientesEnMora={13}
            hoy={{ clientes: 5, esperado: '$79.000', recaudado: null, porcentaje: 0 }}
            atencion={[
              { tono: 'mora',   texto: '13 con más de 30 días de mora', accion: 'Ver' },
              { tono: 'atraso', texto: '41 sin pagos hace 7 días',      accion: 'Ver' },
              { tono: 'atraso', texto: '1 cliente sin ruta asignada',   accion: 'Asignar' },
            ]}
          />
          <div style={{ height: 96 }} />
        </div>
        <PastillaDemo activo="/dashboard" />
      </div>

      <h2 style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)', margin: '34px 0 10px' }}>
        Hojas
      </h2>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', maxWidth: 700 }}>
        <BotonSecundario style={{ width: 'auto', padding: '0 18px' }} onClick={() => setHoja('cuenta')}>Abrir hoja de cuenta</BotonSecundario>
        <BotonSecundario style={{ width: 'auto', padding: '0 18px' }} onClick={() => setHoja('movil')}>Hoja inferior (móvil)</BotonSecundario>
        <BotonSecundario style={{ width: 'auto', padding: '0 18px' }} onClick={() => setHoja('escritorio')}>Modal centrado (escritorio)</BotonSecundario>
      </div>

      <HojaCuenta
        abierta={hoja === 'cuenta'} onCerrar={() => setHoja(null)}
        nombre="Carlos Castro" negocio="Prestamos Castro" rol="dueño" iniciales="CC"
        conectado tema={tema} onCambiarTema={setTema} diasRestantesPlan={5} />

      <HojaInferior
        abierta={hoja === 'movil'} onCerrar={() => setHoja(null)}
        titulo="Aplicar recargo" subtitulo="Steven Olmos · debe $130.500"
        accion={<><BotonPrimario style={{ flex: 2 }}>Aplicar $15.000</BotonPrimario><BotonSecundario style={{ flex: 1 }} cancelar onClick={() => setHoja(null)}>Cancelar</BotonSecundario></>}>
        <AntesDespues concepto="Próxima cuota" antes="$14.500" despues="$29.500" tono="empeora"
          resumen={{ etiqueta: 'Recargo aplicado', valor: '$15.000' }} />
        <Aviso tono="ambar">El recargo sube la deuda pero no cambia el plazo ni la cuota pactada.</Aviso>
      </HojaInferior>

      <HojaInferior
        escritorio abierta={hoja === 'escritorio'} onCerrar={() => setHoja(null)}
        titulo="Meter plata al negocio" subtitulo="Se suma a lo que tienes para prestar"
        accion={<><BotonPrimario style={{ flex: 2 }}>Meter $3.000.000</BotonPrimario><BotonSecundario style={{ flex: 1 }} cancelar onClick={() => setHoja(null)}>Cancelar</BotonSecundario></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <EtiquetaCampo>Cuánto vas a meter</EtiquetaCampo>
          <Campo defaultValue="$3.000.000" foco />
        </div>
        <AntesDespues etiqueta="Antes → después" concepto="Lista para prestar" antes="$2.520.280" despues="$5.520.280" tono="mejora" />
      </HojaInferior>

      <h2 style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)', margin: '34px 0 10px' }}>
        Barra lateral · escritorio
      </h2>
      <div style={{ height: 620, width: 250, border: '1px solid var(--cf-border)', borderRadius: 18, overflow: 'hidden' }}>
        <BarraLateral nombre="Carlos Castro" rol="dueño" iniciales="CC" conectado hayAvisos tema="light" />
      </div>

      <h2 style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)', margin: '34px 0 10px' }}>
        Espina de progreso
      </h2>
      <div style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)', borderRadius: 18, padding: 20, maxWidth: 390, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[0, 2, 5].map(p => (
          <div key={p}>
            <div style={{ fontSize: 11, color: 'var(--cf-ink-3)', marginBottom: 6 }}>paso {p + 1} de 6</div>
            <EspinaProgreso paso={p} total={6} />
          </div>
        ))}
      </div>
    </div>
  )
}
