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
import CobrarHoy from '@/components/pantallas/CobrarHoy'
import ListaClientes from '@/components/pantallas/ListaClientes'
import ListaRutas from '@/components/pantallas/ListaRutas'
import FichaPrestamo from '@/components/pantallas/FichaPrestamo'
import PantallaMas from '@/components/pantallas/PantallaMas'
import MenuCrear from '@/components/pantallas/MenuCrear'
import Lucas from '@/components/pantallas/Lucas'
import { CajaDia, CierreCobradores } from '@/components/pantallas/Caja'
import ListaPrestamos from '@/components/pantallas/ListaPrestamos'
import TablaAmortizacion, { CompararCalendarios } from '@/components/pantallas/TablaAmortizacion'
import { Recargo, ModificarPlazo, Descuento, MoverAPerdidos, CerrarAnticipado } from '@/components/pantallas/Gestion'
import FichaCliente from '@/components/pantallas/FichaCliente'
import RegistrarCobro from '@/components/pantallas/RegistrarCobro'
import Simulador from '@/components/pantallas/Simulador'
import FichaRuta from '@/components/pantallas/FichaRuta'
import { CrearPrestamoMonto, CrearPrestamoCondiciones } from '@/components/pantallas/CrearPrestamo'
import { ListaSocios, RepartirGanancia, CuentaSocio } from '@/components/pantallas/Socios'
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
const PREGUNTAS_LUCAS = [
  { icono: 'pregunta', texto: '¿Cuánto estoy ganando de verdad?' },
  { icono: 'gente',    texto: '¿Quién me debe más?' },
  { icono: 'plata',    texto: '¿Me alcanza para prestar más?' },
]
const ACCIONES_LUCAS = [
  { icono: 'whatsapp', texto: 'Recordarles a los 13 en mora' },
  { icono: 'reporte',  texto: 'Armarme el reporte del mes' },
]

const MARCO = {
  width: 390, height: 844, position: 'relative', overflow: 'hidden',
  background: 'var(--cf-surface)', border: '1px solid var(--cf-border)', borderRadius: 18,
}

function HojaDemo({ id, titulo, subtitulo, children }) {
  return (
    <div id={id} style={{ ...MARCO, height: 'auto', minHeight: 560, background: 'var(--cf-scrim)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div style={{ borderRadius: '22px 22px 0 0', background: 'var(--cf-surface)', padding: '10px 16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'center', flex: 'none' }}>
          <span style={{ width: 38, height: 4, borderRadius: 999, background: 'var(--cf-fill-2)' }} />
        </div>
        <span style={{ flex: 'none' }}>
          <span style={{ display: 'block', fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)' }}>{titulo}</span>
          <span className="cf-num" style={{ display: 'block', fontSize: 12, color: 'var(--cf-ink-3)', marginTop: 3 }}>{subtitulo}</span>
        </span>
        {children}
      </div>
    </div>
  )
}

function IconoWhatsApp() {
  return (
    <button type="button" aria-label="Escribirle por WhatsApp" style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 38, height: 38, borderRadius: 11, flex: 'none',
      background: 'none', border: 0, cursor: 'pointer', color: 'var(--cf-ink-2)',
    }}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.4 8.4 0 01-12.6 7.3L3 20.5l1.8-5.2A8.4 8.4 0 1121 11.5z" />
      </svg>
    </button>
  )
}

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
  const [paso] = useState(3)
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
        Cobrar hoy · pantalla completa
      </h2>
      <div id="cobrar-hoy" style={{
        width: 390, height: 844, position: 'relative', overflow: 'hidden',
        background: 'var(--cf-surface)', border: '1px solid var(--cf-border)', borderRadius: 18,
      }}>
        <CabeceraMovil variante={CABECERA.NAVEGACION} iniciales="CC" conectado hayAvisos />
        <div style={{ height: 'calc(100% - 56px)', overflowY: 'auto' }}>
          <CobrarHoy
            recaudado="$79.000" falta="$602.867" porcentaje={12}
            totalCobrados="$79.000"
            cobrados={[
              { nombre: 'Julián Vélez', iniciales: 'JV', contexto: 'Ruta norte', monto: '$8.000', porcentaje: 97 },
            ]}
            pendientes={[
              { nombre: 'Steven Olmos', iniciales: 'SO', estado: 'mora', etiquetaEstado: 'En mora',
                diasAtraso: 36, contexto: 'Bolivariana · Cl 8 # 31-05', etiquetaMonto: 'Cuota de hoy', monto: '$14.500', porcentaje: 18 },
              { nombre: 'Carlitos Chaparro', iniciales: 'CC', estado: 'atraso', etiquetaEstado: 'Atraso leve',
                diasAtraso: 4, contexto: 'Ruta sur · Cra 9 # 12-40', etiquetaMonto: 'Cuota de hoy', monto: '$32.000', porcentaje: 61 },
              { nombre: 'Elieser Ramos', iniciales: 'ER', estado: 'aldia', etiquetaEstado: 'Al día',
                contexto: 'Ruta norte · Cl 22 # 5-11', etiquetaMonto: 'Cuota de hoy', monto: '$20.000', porcentaje: 80 },
            ]}
          />
          <div style={{ height: 96 }} />
        </div>
        <PastillaDemo activo="/dashboard" />
      </div>

      <h2 style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)', margin: '34px 0 10px' }}>
        Lista de clientes · con filtros y truncado honesto
      </h2>
      <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
        <div id="lista-clientes" style={{
          width: 390, height: 844, position: 'relative', overflow: 'hidden',
          background: 'var(--cf-surface)', border: '1px solid var(--cf-border)', borderRadius: 18,
        }}>
          <CabeceraMovil variante={CABECERA.NAVEGACION} iniciales="CC" conectado hayAvisos />
          <div style={{ height: 'calc(100% - 56px)', overflowY: 'auto' }}>
            <ListaClientes
              filtros={[
                { id: 'todos', nombre: 'Todos', conteo: 31 },
                { id: 'mora',  nombre: 'En mora', conteo: 13 },
                { id: 'd30',   nombre: '+30d', conteo: 13 },
                { id: 'sinruta', nombre: 'Sin ruta', conteo: 1 },
              ]}
              filtroActivo="todos"
              total={31}
              montoFaltante="$4.826.336"
              clientes={[
                { nombre: 'Steven Olmos', iniciales: 'SO', estado: 'mora', etiquetaEstado: 'En mora',
                  diasAtraso: 36, contexto: 'Bolivariana · Cl 8 # 31-05', monto: '$130.500', porcentaje: 18 },
                { nombre: 'Carlitos Chaparro', iniciales: 'CC', estado: 'atraso', etiquetaEstado: 'Atraso leve',
                  diasAtraso: 4, contexto: 'Ruta sur · Cra 9 # 12-40', monto: '$226.000', porcentaje: 61 },
                { nombre: 'María Fernanda Restrepo Vélez', iniciales: 'MR', estado: 'aldia', etiquetaEstado: 'Al día',
                  contexto: 'Centro · Cra 12 # 4-18', monto: '$811.334', porcentaje: 72 },
              ]}
            />
            <div style={{ height: 96 }} />
          </div>
          <PastillaDemo activo="/clientes" />
        </div>

        <div id="busqueda-vacia" style={{
          width: 390, height: 844, position: 'relative', overflow: 'hidden',
          background: 'var(--cf-surface)', border: '1px solid var(--cf-border)', borderRadius: 18,
        }}>
          <CabeceraMovil variante={CABECERA.NAVEGACION} iniciales="CC" conectado hayAvisos />
          <div style={{ height: 'calc(100% - 56px)', overflowY: 'auto' }}>
            <ListaClientes busqueda="Martha" clientes={[]} filtros={[]} />
          </div>
          <PastillaDemo activo="/clientes" />
        </div>
      </div>

      <h2 style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)', margin: '34px 0 10px' }}>
        Rutas · solo lo de hoy
      </h2>
      <div id="lista-rutas" style={{
        width: 390, height: 844, position: 'relative', overflow: 'hidden',
        background: 'var(--cf-surface)', border: '1px solid var(--cf-border)', borderRadius: 18,
      }}>
        <CabeceraMovil variante={CABECERA.NAVEGACION} iniciales="CC" conectado hayAvisos />
        <div style={{ height: 'calc(100% - 56px)', overflowY: 'auto' }}>
          <ListaRutas
            rutas={[
              { nombre: 'Ruta norte', cobrador: 'Davi', clientes: 12, recaudado: '$90.000', esperado: '$151.700', porcentaje: 59 },
              { nombre: 'Ruta sur', cobrador: 'Jhoan', clientes: 9, recaudado: '$52.000', esperado: '$483.667', porcentaje: 11 },
              { nombre: 'Ruta de pepito', cobrador: null, clientes: 1, recaudado: '$0', esperado: '$24.000', porcentaje: 0 },
              { nombre: 'Ruta goty 1', cobrador: 'Camilo', clientes: 4, recaudado: '$0', esperado: '$0', porcentaje: 0, inactiva: true },
            ]}
            sinRuta={{ cantidad: 3, monto: '$1.240.000' }}
          />
          <div style={{ height: 96 }} />
        </div>
        <PastillaDemo activo="/rutas" />
      </div>

      <h2 style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)', margin: '34px 0 4px' }}>
        Ficha de préstamo · los 4 modos sin tabla
      </h2>
      <p style={{ fontSize: 13, color: 'var(--cf-ink-2)', margin: '0 0 12px', maxWidth: '72ch', lineHeight: 1.5 }}>
        Estas cuatro fichas cubren el <strong>93,7%</strong> de la cartera. La ficha con tabla de
        amortización, que el paquete original presenta como <em>la</em> ficha, cubre el 6,2% y es
        la variante. En ninguna de estas cuatro se reparte el interés por pago: ese dato no existe.
      </p>
      <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>

        {/* ── fijo · 54,7% ── */}
        <div id="ficha-fijo" style={MARCO}>
          <CabeceraMovil
            variante={CABECERA.DETALLE}
            titulo="Steven Olmos"
            subtitulo="$20.000 diarios · 36 días de atraso"
            acciones={<IconoWhatsApp />}
          />
          <div style={{ height: 'calc(100% - 56px)' }}>
            <FichaPrestamo
              modo="fijo"
              faltaPagar="$469.500" pagado="$130.500" totalAPagar="$600.000" porcentaje={22}
              cuota="$20.000" enMora="$80.000" cuotasFaltantes="24 cuotas"
              prestado="$500.000" ganancia="$100.000" plazoTexto="30 cuotas diarias"
              totalPagos={7} montoOculto="$50.500"
              pagos={[
                { fecha: 'Hoy · 9:14 a. m.', medio: 'Efectivo', saldo: '$469.500', monto: '$20.000' },
                { fecha: 'Ayer', medio: 'Nequi', saldo: '$489.500', monto: '$20.000' },
                { fecha: '24 jul', medio: 'Efectivo', saldo: '$509.500', monto: '$40.000' },
              ]}
            />
          </div>
        </div>

        {/* ── unico · 18,6% ── */}
        <div id="ficha-unico" style={MARCO}>
          <CabeceraMovil
            variante={CABECERA.DETALLE}
            titulo="Marta Lucía Ríos"
            subtitulo="Pago único · sin cuotas"
            acciones={<IconoWhatsApp />}
          />
          <div style={{ height: 'calc(100% - 56px)' }}>
            <FichaPrestamo
              modo="unico"
              faltaPagar="$1.200.000"
              fechaVencimiento="15 de agosto" diasParaVencer="faltan 18 días"
              prestado="$1.000.000" totalAPagar="$1.200.000" ganancia="$200.000"
              pagos={[]}
              notaHistorial="Es normal: en este tipo de préstamo se paga al final. Si te abona antes, se registra y baja lo que falta."
            />
          </div>
        </div>

        {/* ── manual · 10,6% ── */}
        <div id="ficha-manual" style={MARCO}>
          <CabeceraMovil
            variante={CABECERA.DETALLE}
            titulo="Jhoan Sebastián Cruz"
            subtitulo="$50.000 semanales · al día"
            acciones={<IconoWhatsApp />}
          />
          <div style={{ height: 'calc(100% - 56px)' }}>
            <FichaPrestamo
              modo="manual"
              faltaPagar="$350.000" pagado="$400.000" totalAPagar="$750.000" porcentaje={53}
              cuota="$50.000" enMora="$0" cuotasFaltantes="7 semanas"
              prestado="$600.000" ganancia="$150.000" plazoTexto="15 semanas"
              cuotaQuePusiste="$50.000"
              totalPagos={8} montoOculto="$300.000"
              pagos={[
                { fecha: '26 jul', medio: 'Nequi', saldo: '$350.000', monto: '$50.000' },
                { fecha: '19 jul', medio: 'Efectivo', saldo: '$400.000', monto: '$50.000' },
              ]}
            />
          </div>
        </div>

        {/* ── proporcional · 9,8% ── */}
        <div id="ficha-proporcional" style={MARCO}>
          <CabeceraMovil
            variante={CABECERA.DETALLE}
            titulo="Carlitos Chaparro"
            subtitulo="$17.334 diarios · 4 días de atraso"
            acciones={<IconoWhatsApp />}
          />
          <div style={{ height: 'calc(100% - 56px)' }}>
            <FichaPrestamo
              modo="proporcional"
              faltaPagar="$553.000" pagado="$226.000" totalAPagar="$779.000" porcentaje={29}
              cuota="$17.334" enMora="$69.336" cuotasFaltantes="32 cuotas"
              prestado="$680.000" ganancia="$99.000" plazoTexto="45 cuotas diarias"
              tasaTexto={{ tasa: '20% al mes', explicacion: 'repartido sobre 45 días, que es un mes y medio' }}
              totalPagos={13} montoOculto="$173.998"
              pagos={[
                { fecha: '24 jul', medio: 'Efectivo', saldo: '$553.000', monto: '$17.334' },
                { fecha: '23 jul', medio: 'Efectivo', saldo: '$570.334', monto: '$34.668' },
              ]}
            />
          </div>
        </div>
      </div>

      <h2 style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)', margin: '34px 0 4px' }}>
        El quinto destino y el menú del +
      </h2>
      <p style={{ fontSize: 13, color: 'var(--cf-ink-2)', margin: '0 0 12px', maxWidth: '72ch', lineHeight: 1.5 }}>
        Las dos son <strong>solo móvil</strong>. En escritorio la barra lateral ya lista todo, y
        la acción de crear vive en el botón dorado de cada pantalla.
      </p>
      <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>

        <div id="pantalla-mas" style={MARCO}>
          <CabeceraMovil variante={CABECERA.NAVEGACION} iniciales="CC" conectado hayAvisos />
          <div style={{ height: 'calc(100% - 56px)', overflowY: 'auto' }}>
            <PantallaMas
              plataLista="$2.520.280"
              rendimiento="rinde 7,8% al mes"
              gastosMes="solo $10.000 este mes"
              cobradoresSinRegistrar="8 sin registrar nada"
              perdidos="1 préstamo · $1.2M"
              socios={{ cantidad: 0 }}
              usuarios={3}
            />
            <div style={{ height: 96 }} />
          </div>
          <PastillaDemo activo="/mas" />
        </div>

        <div id="menu-crear" style={MARCO}>
          <MenuCrear
            fecha="martes 28" hora="7:14 a. m."
            cobrosPendientes="te faltan 5 cobros de hoy"
            plataLista="tienes $2.520.280 para prestar"
            cobrosCorto="5 pendientes"
            plataCorto="$2,5M libres"
            cajaEstado="sin cerrar"
            diasPlan="vence en 5 días"
          />
        </div>
      </div>

      <h2 style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)', margin: '34px 0 4px' }}>
        Lucas · contesta con los componentes de la app
      </h2>
      <p style={{ fontSize: 13, color: 'var(--cf-ink-2)', margin: '0 0 12px', maxWidth: '72ch', lineHeight: 1.5 }}>
        Un chatbot que escribe «tu ROI mensual es del 7,8%» obliga a creerle. Uno que muestra el
        <strong> mismo bloque negro</strong> de la pantalla donde ese dato vive deja ver de dónde sale,
        y «Ver la pantalla» lleva ahí. Lucas no reemplaza la app: la navega.
      </p>
      <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>

        <div id="lucas-vacio" style={{ ...MARCO, background: 'var(--cf-scrim)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ height: '78%', borderRadius: '22px 22px 0 0', overflow: 'hidden', background: 'var(--cf-surface)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 2px', flex: 'none' }}>
              <span style={{ width: 38, height: 4, borderRadius: 999, background: 'var(--cf-fill-2)' }} />
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <Lucas preguntas={PREGUNTAS_LUCAS} acciones={ACCIONES_LUCAS} />
            </div>
          </div>
        </div>

        <div id="lucas-respuesta" style={{ ...MARCO, background: 'var(--cf-scrim)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ height: '92%', borderRadius: '22px 22px 0 0', overflow: 'hidden', background: 'var(--cf-surface)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 2px', flex: 'none' }}>
              <span style={{ width: 38, height: 4, borderRadius: 999, background: 'var(--cf-fill-2)' }} />
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <Lucas respuesta={{
                pregunta: '¿Cuánto estoy ganando realmente?',
                frase: 'Este mes te queda $2.161.331 limpio, después de gastos.',
                bloque: {
                  etiqueta: 'Lo que rinde tu capital',
                  cifra: '7,8%',
                  unidad: 'al mes',
                  tono: 'favor',
                  nota: 'Por cada $100 en la calle, ganas $8 neto.',
                  columnas: [
                    { etiqueta: 'Recaudado',   valor: '$8,8M' },
                    { etiqueta: 'Gastos',      valor: '$10.000' },
                    { etiqueta: 'En la calle', valor: '$27,6M' },
                  ],
                },
                chips: [{ texto: 'Ver la pantalla' }, { texto: 'Bajar en PDF', pdf: true }],
                siguientes: ['¿Qué ruta me rinde menos?', '¿En qué se me fue la plata este mes?'],
              }} />
            </div>
          </div>
        </div>
      </div>

      <h2 style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)', margin: '34px 0 4px' }}>
        Lucas en 1440 · al lado, no encima
      </h2>
      <p style={{ fontSize: 13, color: 'var(--cf-ink-2)', margin: '0 0 12px', maxWidth: '72ch', lineHeight: 1.5 }}>
        El dueño quiere preguntar algo <strong>mientras</strong> mira sus números. Taparle el panel
        para contestarle le quita el contexto que le da sentido a la respuesta.
      </p>
      <div id="lucas-escritorio" style={{
        width: 1180, height: 620, overflow: 'hidden', display: 'flex', gap: 18,
        background: 'var(--cf-surface)', border: '1px solid var(--cf-border)',
        borderRadius: 18, padding: 18,
      }}>
        <div style={{ width: 230, flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)', borderRadius: 16 }} />
        <div style={{ flex: 1, minWidth: 0, background: 'var(--cf-card)', border: '1px solid var(--cf-border)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--cf-ink-4)' }}>Panel · patrimonio y atención</span>
        </div>
        <Lucas escritorio preguntas={PREGUNTAS_LUCAS} acciones={ACCIONES_LUCAS} />
      </div>

      <h2 style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)', margin: '34px 0 4px' }}>
        Caja · la cuenta se lee como un extracto
      </h2>
      <p style={{ fontSize: 13, color: 'var(--cf-ink-2)', margin: '0 0 12px', maxWidth: '72ch', lineHeight: 1.5 }}>
        Antes: la fórmula del saldo en <strong>cinco mosaicos de colores</strong> y debajo nueve
        tarjetas idénticas con una carita triste, una por cobrador sin pagos. Unos 1.800px de vacío
        con emojis en la pantalla donde el dueño cuadra su plata.
      </p>
      <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>

        <div id="caja-dia" style={MARCO}>
          <CabeceraMovil variante={CABECERA.NAVEGACION} iniciales="CC" conectado hayAvisos />
          <div style={{ height: 'calc(100% - 56px)' }}>
            <CajaDia
              rangos={[
                { id: 'hoy', nombre: 'Hoy' }, { id: 'ayer', nombre: 'Ayer' },
                { id: '7d', nombre: '7 días' }, { id: '30d', nombre: '30 días' },
                { id: 'rango', nombre: 'Rango' },
              ]}
              rangoActivo="hoy"
              baseInicial="$1.800.000"
              cobrado="$412.000"
              prestado="$200.000"
              gastos="$35.000"
              ajustes="$0"
              saldo="$1.977.000"
              totalMovimientos={14}
              movimientos={[
                { concepto: 'Cobro · Steven Olmos', detalle: '14:12 · Pepito · Ruta 2', monto: '$27.500', entra: true },
                { concepto: 'Préstamo nuevo · Carlos P.', detalle: '11:40 · Carlos · Ruta #1', monto: '$200.000' },
              ]}
            />
          </div>
          <PastillaDemo activo="/caja" />
        </div>

        <div id="cierre-cobradores" style={MARCO}>
          <CabeceraMovil variante={CABECERA.DETALLE} titulo="Cierre de cobradores" subtitulo="martes 28 de julio" />
          <div style={{ height: 'calc(100% - 56px)' }}>
            <CierreCobradores
              faltaEntregar="$188.000" sinEntregar={3} deCuantos={9}
              pendientes={[
                { iniciales: 'PE', nombre: 'Pepito', detalle: 'Ruta 2 · 4 cobros · terminó 18:38', monto: '$61.500' },
                { iniciales: 'CA', nombre: 'Carmen Calanche', detalle: 'Ruta norte · 6 cobros · en ruta', monto: '$118.300' },
                { iniciales: 'AP', nombre: 'Andrés Pérez', detalle: 'Ruta sur · 1 cobro · en ruta', monto: '$8.200' },
              ]}
              totalEntregado="$224.000"
              yaEntregaron={[
                { iniciales: 'CA', nombre: 'Carlos Andrés', monto: '$96.000' },
                { iniciales: 'CP', nombre: 'Carlos Pérez', monto: '$128.000' },
              ]}
              sinCobros={4}
            />
          </div>
        </div>
      </div>

      <h2 style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)', margin: '34px 0 4px' }}>
        Préstamos · misma tarjeta, orden por atraso
      </h2>
      <p style={{ fontSize: 13, color: 'var(--cf-ink-2)', margin: '0 0 12px', maxWidth: '72ch', lineHeight: 1.5 }}>
        Sin tarjeta nueva: un préstamo en lista usa la <strong>misma tarjeta que un cliente</strong>.
        Lo único propio es el orden, y el de por defecto es <strong>por atraso</strong> — alfabético
        es el orden de un archivador.
      </p>
      <div id="lista-prestamos" style={MARCO}>
        <CabeceraMovil variante={CABECERA.NAVEGACION} iniciales="CC" conectado hayAvisos />
        <div style={{ height: 'calc(100% - 56px)', overflowY: 'auto' }}>
          <ListaPrestamos
            filtros={[
              { id: 'activos', nombre: 'Activos', conteo: 47 },
              { id: 'mora', nombre: 'En mora', conteo: 13 },
              { id: 'hoy', nombre: 'Cobran hoy', conteo: 8 },
              { id: 'terminados', nombre: 'Terminados', conteo: 22 },
            ]}
            filtroActivo="activos"
            orden="atraso"
            total={47}
            montoFaltante="$18.412.900"
            prestamos={[
              { nombre: 'Steven Olmos', iniciales: 'SO', estado: 'mora', etiquetaEstado: 'En mora',
                diasAtraso: 36, contexto: '$20.000 diarios · Ruta 2', monto: '$469.500', porcentaje: 22 },
              { nombre: 'Carlitos Chaparro', iniciales: 'CC', estado: 'atraso', etiquetaEstado: 'Atraso leve',
                diasAtraso: 4, contexto: '$17.334 diarios · Ruta #1', monto: '$553.000', porcentaje: 29 },
              { nombre: 'Marta Lucía Ríos', iniciales: 'MR', estado: 'aldia', etiquetaEstado: 'Al día',
                contexto: 'Pago único · Ruta centro', monto: '$1.200.000',
                sinProgreso: true, nota: 'vence en 18 días' },
              { nombre: 'Jhoan Sebastián Cruz', iniciales: 'JC', estado: 'aldia', etiquetaEstado: 'Al día',
                contexto: '$50.000 semanales · Ruta norte', monto: '$350.000', porcentaje: 53 },
            ]}
          />
          <div style={{ height: 96 }} />
        </div>
        <PastillaDemo activo="/prestamos" />
      </div>

      <h2 style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)', margin: '34px 0 4px' }}>
        Tabla de amortización · la variante del 6,2%
      </h2>
      <p style={{ fontSize: 13, color: 'var(--cf-ink-2)', margin: '0 0 12px', maxWidth: '72ch', lineHeight: 1.5 }}>
        Cada cuota es una <strong>barra partida</strong>: negro el capital que vuelve, dorado la
        ganancia. En decreciente dinámico la parte dorada se encoge mes a mes y eso se ve sin leer
        un número. Solo 4 de los 8 modos llegan aquí.
      </p>
      <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>

        <div id="tabla-amortizacion" style={MARCO}>
          <CabeceraMovil variante={CABECERA.DETALLE} titulo="Tabla del préstamo"
            subtitulo="Carlos Prueba 1 · $1.000.000 · 20% · 6 meses" />
          <div style={{ height: 'calc(100% - 56px)' }}>
            <TablaAmortizacion
              modo="Decreciente dinámico"
              capital="$1.000.000" capitalNum={1000000}
              ganancia="$699.999"  gananciaNum={699999}
              totalCuotas={6} total="$1.699.999" montoOculto="$433.331"
              cuotas={[
                { cuando: 'Mes 1 · 21 de agosto', cuota: '$366.667', siguiente: true,
                  capital: '$166.667', capitalNum: 166667, ganancia: '$200.000', gananciaNum: 200000 },
                { cuando: 'Mes 2 · 21 de septiembre', cuota: '$333.334',
                  capital: '$166.667', capitalNum: 166667, ganancia: '$166.667', gananciaNum: 166667 },
                { cuando: 'Mes 3 · 21 de octubre', cuota: '$300.000',
                  capital: '$166.667', capitalNum: 166667, ganancia: '$133.333', gananciaNum: 133333 },
                { cuando: 'Mes 4 · 21 de noviembre', cuota: '$266.667',
                  capital: '$166.667', capitalNum: 166667, ganancia: '$100.000', gananciaNum: 100000 },
              ]}
            />
          </div>
        </div>

        <div id="comparar-calendarios" style={{ ...MARCO, background: 'var(--cf-scrim)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ borderRadius: '22px 22px 0 0', background: 'var(--cf-surface)', padding: '10px 16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'center', flex: 'none' }}>
              <span style={{ width: 38, height: 4, borderRadius: 999, background: 'var(--cf-fill-2)' }} />
            </div>
            <span style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)', flex: 'none' }}>
              Comparar calendarios
            </span>
            <CompararCalendarios
              resumen="$1.000.000 al 20% · 6 meses"
              actual="dinamico"
              opciones={[
                { id: 'dinamico', nombre: 'Decreciente dinámico', total: '$1.699.999',
                  capitalNum: 1000000, gananciaNum: 699999,
                  explicacion: 'La cuota baja cada mes: de $366.667 a $199.998. Ganancia $699.999.' },
                { id: 'fija', nombre: 'Cuota fija', total: '$2.200.000',
                  capitalNum: 1000000, gananciaNum: 1200000,
                  explicacion: 'El más usado. Misma cuota siempre: $366.667 los 6 meses. Ganancia $1.200.000.' },
                { id: 'saldo', nombre: 'Sobre lo que falta', total: '$1.612.000',
                  capitalNum: 1000000, gananciaNum: 612000,
                  explicacion: 'Como los bancos: el interés se calcula sobre lo que aún debe. Si abona de más, paga menos.' },
                { id: 'solo', nombre: 'Solo interés', total: '$2.200.000',
                  capitalNum: 1000000, gananciaNum: 1200000,
                  explicacion: 'Paga $200.000 de interés cada mes y el millón completo al final. Ojo: el capital no baja.' },
              ]}
            />
          </div>
        </div>
      </div>

      <h2 style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)', margin: '34px 0 4px' }}>
        Gestión · cinco decisiones que cambian la plata
      </h2>
      <p style={{ fontSize: 13, color: 'var(--cf-ink-2)', margin: '0 0 12px', maxWidth: '72ch', lineHeight: 1.5 }}>
        Mismo patrón en los cinco —qué cambia arriba, el control en medio, <strong>antes → después</strong>
        abajo— y el botón siempre dice la acción con su cifra. Cada uno enseña una consecuencia que
        hoy no se ve antes de confirmar.
      </p>
      <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>

        <HojaDemo id="ges-recargo" titulo="Recargo por mora" subtitulo="Steven Olmos · lleva 36 días de atraso">
          <Recargo monto="15.000" atajoActivo="$15.000" cuando="proxima"
            cuotaAntes="$14.500" cuotaDespues="$29.500" saldoTotal="$145.500" />
        </HojaDemo>

        <HojaDemo id="ges-plazo" titulo="Modificar el plazo" subtitulo="Le quedan 8 cuotas de 30 · vence el 6 de agosto">
          <ModificarPlazo cuotas={14} cuotasAntes={8}
            cuotaAntes="$16.312" cuotaDespues="$9.322"
            terminaAntes="6 ago" terminaDespues="14 ago" totalRecibir="$130.500" />
        </HojaDemo>

        <HojaDemo id="ges-descuento" titulo="Perdonarle una parte" subtitulo="Carlos Chaparro · 36 días de atraso · cumple 41%">
          <Descuento monto="48.000" atajoActivo="Todo el atraso" origen="ganancia"
            debeAntes="$320.000" debeDespues="$272.000"
            gananciaQueda="$52.000 de $100.000" capitalVuelve="tus $500.000" />
        </HojaDemo>

        <HojaDemo id="ges-perdidos" titulo="Mover a perdidos" subtitulo="Julián Vélez · 35 días sin pagar · cumple 18%">
          <MoverAPerdidos monto="$184.733" diasSinEscribir={22} diasSinVisitar={12}
            carteraAntes="$38.4M" carteraDespues="$38.2M" perdidaDelMes="$184.733" />
        </HojaDemo>

        <HojaDemo id="ges-cerrar" titulo="Quiere pagar todo hoy" subtitulo="Andrés Cortés · le faltan 3 de 12 cuotas">
          <CerrarAnticipado cuotasFaltan={3} cuotasTotal={12} opcion="capital"
            soloCapital="$980.000" todoPactado="$1.180.000"
            vuelveHoy="$980.000" gananciaSacrificada="$200.000" />
        </HojaDemo>
      </div>

      <h2 style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)', margin: '34px 0 4px' }}>
        Ficha de cliente y cobro en la calle
      </h2>
      <p style={{ fontSize: 13, color: 'var(--cf-ink-2)', margin: '0 0 12px', maxWidth: '72ch', lineHeight: 1.5 }}>
        Las dos <strong>sin pastilla</strong>, por motivos distintos: a la ficha se llegó desde una
        lista y su salida es volver; en el cobro, salirse a medias pierde el cobro. Los 76px que
        libera la ficha se los queda el gráfico de comportamiento.
      </p>
      <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>

        <div id="ficha-cliente" style={MARCO}>
          <CabeceraMovil
            variante={CABECERA.DETALLE}
            titulo="Steven Olmos"
            subtitulo="2 préstamos · debe $291.000"
            acciones={<IconoWhatsApp />}
          />
          <div style={{ height: 'calc(100% - 56px)' }}>
            <FichaCliente
              debeTotal="$291.000" pagado="$504.000" totalAPagar="$795.000" porcentaje={63}
              prestamos={[
                { titulo: 'Préstamo del 4 de julio', diasAtraso: 36, estado: 'mora',
                  monto: '$130.500', cuota: 'cuota 22 de 30' },
                { titulo: 'Préstamo del 20 de julio', diasAtraso: 8, estado: 'atraso',
                  monto: '$160.500', cuota: 'cuota 6 de 30' },
              ]}
              meses={[
                { etiqueta: 'A', cumplio: 100, estado: 'bien' },
                { etiqueta: 'S', cumplio: 92,  estado: 'tarde' },
                { etiqueta: 'O', cumplio: 100, estado: 'bien' },
                { etiqueta: 'N', cumplio: 88,  estado: 'tarde' },
                { etiqueta: 'D', cumplio: 100, estado: 'bien' },
                { etiqueta: 'E', cumplio: 95,  estado: 'tarde' },
                { etiqueta: 'F', cumplio: 100, estado: 'bien' },
                { etiqueta: 'M', cumplio: 90,  estado: 'tarde' },
                { etiqueta: 'A', cumplio: 100, estado: 'bien' },
                { etiqueta: 'M', cumplio: 61,  estado: 'mal' },
                { etiqueta: 'J', cumplio: 44,  estado: 'mal' },
                { etiqueta: 'J', cumplio: 22,  estado: 'mal' },
              ]}
              lectura="Pagaba tarde pero cerraba el mes. Desde mayo viene fallando."
            />
          </div>
        </div>

        <div id="registrar-cobro" style={MARCO}>
          <CabeceraMovil variante={CABECERA.TAREA} titulo="Cobro 3 de 11" paso={3} total={11} />
          <div style={{ height: 'calc(100% - 56px)' }}>
            <RegistrarCobro
              nombre="Steven Olmos" iniciales="SO"
              contexto="Cl 8 # 31-05 · 36 días de atraso"
              monto="27.500" tipo="Solo un abono" medio="Efectivo"
              debeAntes="$130.500" debeDespues="$103.000"
            />
          </div>
        </div>
      </div>

      <h2 style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)', margin: '34px 0 4px' }}>
        Simulador y ficha de ruta
      </h2>
      <p style={{ fontSize: 13, color: 'var(--cf-ink-2)', margin: '0 0 12px', maxWidth: '72ch', lineHeight: 1.5 }}>
        El simulador tenía la respuesta <strong>al final del scroll</strong> y terminaba en un
        callejón: calculaba, pero no dejaba crear el préstamo. Y una ruta no es un recorrido: es
        <strong> plata puesta en un barrio</strong>.
      </p>
      <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>

        <div id="simulador" style={MARCO}>
          <CabeceraMovil variante={CABECERA.DETALLE} titulo="Simulador" subtitulo="para mostrarle a tu cliente" />
          <div style={{ height: 'calc(100% - 56px)' }}>
            <Simulador
              cuota="$20.000" cada="cada día" veces={30} hasta="27 ago"
              tuPlata="$500.000" tuPlataNum={500000} ganas="$100.000" ganasNum={100000}
              monto="500.000" interes="20" cobros="30" unidadCobros="días"
              frecuencia="Diario" modo="Cuota fija"
            />
          </div>
        </div>

        <div id="ficha-ruta" style={MARCO}>
          <CabeceraMovil variante={CABECERA.DETALLE} titulo="Capital de Ruta 2" subtitulo="Pepito · 9 clientes" />
          <div style={{ height: 'calc(100% - 56px)' }}>
            <FichaRuta
              puesto="$11.600.000" prestado="$8,4M" porGanar="$3,2M" rinde="38%"
              entro="$2.840.000" salioAPrestar="$3.100.000" crecio="+$260.000"
              nombreRuta="Ruta 2"
              comparacion={[
                { nombre: 'Ruta sur', porcentaje: 94 },
                { nombre: 'Ruta 2', porcentaje: 71 },
                { nombre: 'Ruta #1', porcentaje: 54 },
              ]}
              lectura="Esta ruta te rinde el 38% y paga sola lo que le metes. Si tienes plata quieta, es donde conviene ponerla."
              totalPrestamos={9}
            />
          </div>
        </div>
      </div>

      <h2 style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)', margin: '34px 0 4px' }}>
        Crear préstamo · los dos pasos del teléfono
      </h2>
      <p style={{ fontSize: 13, color: 'var(--cf-ink-2)', margin: '0 0 12px', maxWidth: '72ch', lineHeight: 1.5 }}>
        Una sola barra de progreso en todo el wizard: la espina de la cabecera. Y la línea que hoy
        no existe: <strong>con cuánto te quedas en caja después de prestar</strong>.
      </p>
      <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>

        <div id="crear-monto" style={MARCO}>
          <CabeceraMovil variante={CABECERA.TAREA} titulo="Nuevo préstamo" paso={1} total={3} />
          <div style={{ height: 'calc(100% - 56px)' }}>
            <CrearPrestamoMonto
              cliente="Deisy Ramírez" iniciales="DR"
              contextoCliente="CC 43987112 · al día · 1 préstamo pagado"
              monto="800.000"
              atajos={['$500k', '$800k', '$1M']} atajoActivo="$800k"
              quedaEnCaja="$3,2M"
            />
          </div>
        </div>

        <div id="crear-condiciones" style={MARCO}>
          <CabeceraMovil variante={CABECERA.TAREA} titulo="Nuevo préstamo" paso={2} total={3} />
          <div style={{ height: 'calc(100% - 56px)' }}>
            <CrearPrestamoCondiciones
              /* Numeros sacados de calcularPrestamo(), no del mockup: el
                 handoff dibuja $180.000 / $640.000 / $1.440.000, que este
                 sistema no produce con 20% semanal a 8 cuotas. Lo real es
                 $140.000 / $320.000 / $1.120.000. */
              cuotaEtiqueta="Cuota semanal" cuota="$140.000" ganancia="$320.000"
              capital="$800.000" totalARecibir="$1.120.000"
              capitalNum={800000} gananciaNum={320000}
              frecuencia="Semanal"
              interes="20" cuotas="8" unidadCuotas="semanas"
              notaInteres="tu valor de siempre"
              modoActivo="fija"
              modos={[
                { id: 'fija', nombre: 'Cuota fija', insignia: 'el más usado', nota: 'Paga lo mismo cada semana' },
                { id: 'saldo', nombre: 'Sobre lo que falta', nota: 'Como los bancos' },
                { id: 'solo', nombre: 'Solo interés', nota: 'El capital al final' },
              ]}
              primerCobro="martes 4 de agosto" enCuantos="en 7 días"
              ruta="Ruta 2 · Pepito"
            />
          </div>
        </div>

        <div id="crear-monto-alerta" style={MARCO}>
          <CabeceraMovil variante={CABECERA.TAREA} titulo="Nuevo préstamo" paso={1} total={3} />
          <div style={{ height: 'calc(100% - 56px)' }}>
            <CrearPrestamoMonto
              cliente="Deisy Ramírez" iniciales="DR"
              contextoCliente="CC 43987112 · al día · 1 préstamo pagado"
              monto="3.900.000"
              atajos={['$500k', '$800k', '$1M']}
              alerta={<>Te quedarías con <strong>$100.000</strong> en caja. Los cobros de mañana entran, pero hoy no te queda para otro préstamo.</>}
            />
          </div>
        </div>
      </div>

      <h2 style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)', margin: '34px 0 4px' }}>
        Socios · un solo modelo de reparto
      </h2>
      <p style={{ fontSize: 13, color: 'var(--cf-ink-2)', margin: '0 0 12px', maxWidth: '72ch', lineHeight: 1.5 }}>
        Había <strong>dos modelos conviviendo</strong> —por préstamo asignado y por porcentaje— y
        la app mostraba los dos a la vez. Un socio que ve 66,7% en pantalla cree que le toca eso.
        Se elige el porcentaje; el <code>socioId</code> del préstamo pasa a decir <em>dónde está su
        plata</em>, no quién gana.
      </p>
      <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>

        <div id="socios-lista" style={MARCO}>
          <CabeceraMovil
            variante={CABECERA.DETALLE}
            titulo="Socios"
            subtitulo="2 activos · reparten por lo que pusieron"
          />
          <div style={{ height: 'calc(100% - 56px)', overflowY: 'auto' }}>
            <ListaSocios
              pusieron="$12.000.000"
              sinRepartir="$1.240.000" desdeCuando="30 de junio"
              socios={[
                { nombre: 'Carlos Andrés', iniciales: 'CA', puso: '$8.000.000', pusoNum: 8000000,
                  porcentaje: '66,7%', leHasDado: '$1.200.000', leDebes: '$780.000' },
                { nombre: 'Marta Ruiz', iniciales: 'MR', puso: '$4.000.000', pusoNum: 4000000,
                  porcentaje: '33,3%', leHasDado: '$300.000', leDebes: '$600.000' },
              ]}
            />
            <div style={{ height: 96 }} />
          </div>
          <PastillaDemo activo="/mas" />
        </div>

        <HojaDemo id="socios-repartir" titulo="Repartir la ganancia" subtitulo="del 30 de junio al 28 de julio">
          <RepartirGanancia
            desde="30 jun" hasta="28 jul"
            aRepartir="$1.240.000"
            deDondeSale="De $8.838.907 que entró, quitando el capital que volvió y $10.000 de gastos."
            detalle={[
              { nombre: 'Carlos Andrés', iniciales: 'CA', porcentaje: '66,7%', puso: '$8.000.000', monto: '$826.667' },
              { nombre: 'Marta Ruiz', iniciales: 'MR', porcentaje: '33,3%', puso: '$4.000.000', monto: '$413.333' },
            ]}
            suman="$1.240.000"
            lesDebesAntes="$1.380.000" lesDebesDespues="$2.620.000"
          />
        </HojaDemo>

        <div id="socios-cuenta" style={MARCO}>
          <CabeceraMovil
            variante={CABECERA.DETALLE}
            titulo="Carlos Andrés"
            subtitulo="socio desde marzo · 66,7%"
          />
          <div style={{ height: 'calc(100% - 56px)' }}>
            <CuentaSocio
              leDebes="$780.000" puso="$8.000.000" haGanado="$1.980.000" leHasDado="$1.200.000"
              prestamos={18} montoEnCalle="$7,2M" montoEnMora="$420.000"
              movimientos={[
                { tipo: 'reparto', concepto: 'Reparto de junio', detalle: '30 jun · 66,7% de $1.410.000', monto: '+$940.000' },
                { tipo: 'pago', concepto: 'Le pagaste', detalle: '12 jun · efectivo', monto: '−$1.200.000' },
                { tipo: 'aporte', concepto: 'Puso plata', detalle: '4 mar · primer aporte', monto: '$8.000.000' },
              ]}
            />
          </div>
        </div>
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
        {[1, 3, 6].map(p => (
          <div key={p}>
            <div style={{ fontSize: 11, color: 'var(--cf-ink-3)', marginBottom: 6 }}>paso {p} de 6</div>
            <EspinaProgreso paso={p} total={6} />
          </div>
        ))}
      </div>
    </div>
  )
}
