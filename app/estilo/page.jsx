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
import { CajaDia, CierreCobradores, PieCierreCobradores, TuDinero, PestanasCaja, Cuentas, Cuadre, HistorialCierres, MesEnCaja, BajarInformacion } from '@/components/pantallas/Caja'
import { MiPlata, ComoVaElNegocio, Reportes, LineaCredito } from '@/components/pantallas/Reportes'
import { RegistroWhatsApp, VerificarWhatsApp, EmpiezaSinPagar, ListoParaCobrar } from '@/components/pantallas/Onboarding'
import { ArranquePerfil, ArranqueCapital, ArranqueMetodo, ArranqueCierre } from '@/components/pantallas/Arranque'
import RevisionCarga from '@/components/pantallas/RevisionCarga'
import DetalleRuta from '@/components/pantallas/DetalleRuta'
import { loPuestoAqui, loDeHoy, adaptarRecorrido, siguienteParada, adaptarCabeceraRuta, adaptarParadaActual, partirRecorrido, tiempoFuera } from '@/lib/adaptadores/ruta'
import ModoRuta from '@/components/pantallas/ModoRuta'
import { CrearRuta, OrdenRecorrido } from '@/components/pantallas/RutaEditar'
import RutaCerrada, { RutaEnMapa, TarjetaCierre } from '@/components/pantallas/RutaCierre'
import { ConmutadorVista } from '@/components/pantallas/ModoRuta'
import { PortalAcceso, PortalPrestamo, PortalRecuperar } from '@/components/pantallas/PortalCliente'
// `Socios.jsx` (turno 44) tambien exporta `ListaSocios`. La de T45 es la que
// manda —turno posterior— y se importa con alias hasta que la vieja se retire.
import { ListaSocios as ListaSociosT45, HojaRepartir } from '@/components/pantallas/SociosReparto'
import MenuMas from '@/components/pantallas/MenuMas'
import {
  loQuePusieron, cuentaDelSocio, repartoDe, deDondeSale, loQueQuedaDebiendo,
  cabeceraSocios, NOTA_NO_SACA_PLATA,
} from '@/lib/adaptadores/socios'
import { loQueDebe, proximaCuota, misPagos, respuestaDeRecuperacion } from '@/lib/adaptadores/portal'
import {
  cobradoresParaElegir, clientesParaElegir, avisoDeRobo, tramosDelRecorrido,
  propuestaPorCercania, cierreDelDia, resumenDeCierre, loQuePasoHoy,
  pinesDelMapa, LEYENDA_MAPA, cabeceraMapa,
} from '@/lib/adaptadores/ruta'
import { tramosDePlan, limiteInicial } from '@/lib/adaptadores/planes'
import { DIAS_PRUEBA } from '@/lib/planes'
import {
  IndiceConfiguracion, TuNegocioMovil, ComoPrestasMovil, PlanYPagosMovil,
  AvisosWhatsAppMovil, PortalClienteMovil, SeguridadYDatosMovil, PieGuardar,
} from '@/components/pantallas/config/movil'
import ListaPrestamos from '@/components/pantallas/ListaPrestamos'
import TablaAmortizacion, { CompararModos } from '@/components/pantallas/TablaAmortizacion'
import { PieRegistrarCobro } from '@/components/pantallas/RegistrarCobro'
import { Recargo, ModificarPlazo, Descuento, MoverAPerdidos, CerrarAnticipado, PieGestion, AplazarCobro, DiaDeCobro, CorregirPrestamo, RegistrarGasto } from '@/components/pantallas/Gestion'
import FichaCliente from '@/components/pantallas/FichaCliente'
import RegistrarCobro from '@/components/pantallas/RegistrarCobro'
import Simulador from '@/components/pantallas/Simulador'
import FichaRuta from '@/components/pantallas/FichaRuta'
import { CrearPrestamoMonto, CrearPrestamoCondiciones } from '@/components/pantallas/CrearPrestamo'
import { ListaSocios, RepartirGanancia, CuentaSocio } from '@/components/pantallas/Socios'
import { AntesDeFirmar, Firma, PagareFirmado } from '@/components/pantallas/Pagare'
import SociosEscritorio from '@/components/pantallas/SociosEscritorio'
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

        {/* NO va en `HojaDemo`: ésta es pantalla completa con su barra abajo, no
            una hoja. Se enseña en el marco con su pie propio. */}
        <div id="cierre-cobradores" style={MARCO}>
          <CabeceraMovil variante={CABECERA.DETALLE} titulo="Cierre de cobradores" subtitulo="martes 28 de julio" />
          <div style={{ height: 'calc(100% - 56px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '0 20px 20px' }}>
              <CierreCobradores
                faltaEntregar="$188.000"
                pastillaFaltan="faltan 3 de 9"
                pendientes={[
                  { iniciales: 'PE', nombre: 'Pepito', detalle: 'Ruta 2 · 4 cobros · terminó 18:38', monto: '$61.500' },
                  { iniciales: 'CC', nombre: 'Carmen Calanche', detalle: 'Ruta norte · 6 cobros · en ruta', monto: '$118.300' },
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
            <div style={{ flex: 'none', padding: '14px 20px 22px', background: 'var(--cf-card)', borderTop: '1px solid var(--cf-border)' }}>
              <PieCierreCobradores pendiente={{ nombre: 'Pepito', monto: '$61.500' }} onRecibir={() => {}} />
            </div>
          </div>
        </div>

        <div id="tu-dinero" style={{ ...MARCO, height: 'auto', minHeight: 620 }}>
          <CabeceraMovil variante={CABECERA.DETALLE} titulo="Tu dinero" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 20px 20px' }}>
            <TuDinero
              patrimonio="$27.616.416"
              enCaja="$1.98M" enCalle="$25.6M" enRiesgo="$3.1M"
              gananciaEtiqueta="Ganancia de julio"
              ganancia="$1.842.000"
              tendencia="+18% vs junio"
              meses={[
                { id: 1, etiqueta: 'ene', valor: 42 }, { id: 2, etiqueta: 'feb', valor: 58 },
                { id: 3, etiqueta: 'mar', valor: 50 }, { id: 4, etiqueta: 'abr', valor: 71 },
                { id: 5, etiqueta: 'may', valor: 64 }, { id: 6, etiqueta: 'jun', valor: 86 },
                { id: 7, etiqueta: 'jul', valor: 100 },
              ]}
              interesesCobrados="$1.877.000"
              gastosDelMes="$35.000"
              onAjustar={() => {}}
            />
          </div>
        </div>

        <div id="cuentas" style={{ ...MARCO, height: 'auto', minHeight: 640 }}>
          <CabeceraMovil variante={CABECERA.DETALLE} titulo="Caja" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 20px 20px' }}>
            <PestanasCaja
              pestanas={[
                { id: 'hoy', etiqueta: 'Hoy' },
                { id: 'cuentas', etiqueta: 'Cuentas' },
                { id: 'cuadre', etiqueta: 'Cuadre' },
                { id: 'cierres', etiqueta: 'Cierres' },
              ]}
              activa="cuentas"
            />
            <Cuentas
              total="$4.180.000"
              tramos={[
                { id: 'efectivo', etiqueta: 'Efectivo', corto: '$1.84M', porcentaje: 44, color: '#F5B824' },
                { id: 'nequi', etiqueta: 'Nequi', corto: '$1.59M', porcentaje: 38, color: '#5B8DEF' },
                { id: 'banco', etiqueta: 'Banco', corto: '$750k', porcentaje: 18, color: '#4A4E57' },
              ]}
              cuentas={[
                {
                  id: 'efectivo', nombre: 'Efectivo', inicial: '$', detalle: 'en el bolsillo y la caja fuerte',
                  saldo: '$1.840.000', color: '#E7A400', fondoIcono: 'var(--cf-gold-tint)', colorIcono: 'var(--cf-gold-dark)',
                  movimiento: { entro: '+$62.000', salio: '−$35.000', sinContar: '4 días' },
                },
                { id: 'nequi', nombre: 'Nequi', inicial: 'N', saldo: '$1.590.000', color: '#5B8DEF', fondoIcono: 'rgba(91,141,239,.13)', colorIcono: '#5B8DEF' },
                { id: 'banco', nombre: 'Banco', inicial: 'B', saldo: '$750.000', color: '#4A4E57' },
              ]}
              onMover={() => {}}
            />
          </div>
        </div>

        <div id="cuadre" style={{ ...MARCO, height: 'auto', minHeight: 640 }}>
          <CabeceraMovil variante={CABECERA.DETALLE} titulo="Caja" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13, padding: '0 20px 20px' }}>
            <PestanasCaja
              pestanas={[
                { id: 'hoy', etiqueta: 'Hoy' },
                { id: 'cuentas', etiqueta: 'Cuentas' },
                { id: 'cuadre', etiqueta: 'Cuadre' },
                { id: 'cierres', etiqueta: 'Cierres' },
              ]}
              activa="cuadre"
            />
            <Cuadre
              segunLaApp="$1.840.000"
              contado="1.805.000"
              diferencia={{
                etiqueta: 'Te faltan', monto: '$35.000', proporcion: '2% de la caja', tono: 'falta',
                sospecha: 'Justo lo que costó la gasolina de esta mañana. ¿Se te olvidó registrarla?',
              }}
              causas={[
                { id: 'gasto', titulo: 'Un gasto sin registrar', nota: 'gasolina, comida, transporte', accion: 'Anotar' },
                { id: 'cobro', titulo: 'Un cobro que no se anotó', nota: 'lo cobraste y no entró a la app', accion: 'Buscar' },
                { id: 'conteo', titulo: 'Contaste mal', nota: 'vuelve a contar los billetes', accion: 'Recontar' },
              ]}
            />
          </div>
        </div>

        <div id="cierres" style={{ ...MARCO, height: 'auto', minHeight: 640 }}>
          <CabeceraMovil variante={CABECERA.DETALLE} titulo="Caja" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, padding: '0 20px 20px' }}>
            <PestanasCaja
              pestanas={[
                { id: 'hoy', etiqueta: 'Hoy' },
                { id: 'cuentas', etiqueta: 'Cuentas' },
                { id: 'cuadre', etiqueta: 'Cuadre' },
                { id: 'cierres', etiqueta: 'Cierres' },
              ]}
              activa="cierres"
            />
            <HistorialCierres
              resumen={[
                { etiqueta: 'Julio', valor: '22 cierres' },
                { etiqueta: 'Cuadraron', valor: '18', tono: 'ok' },
                { etiqueta: 'Faltó', valor: '$112.000', tono: 'mal' },
              ]}
              cierres={[
                { id: 1, dia: 'Hoy, martes 28', pastilla: 'faltó', estado: 'falto', detalle: 'Recaudó $145.000 · 9 de 14 cobros', diferencia: '−$35.000', nota: 'sin explicar' },
                { id: 2, dia: 'Lunes 27', pastilla: 'cuadró', estado: 'cuadro', detalle: 'Recaudó $218.000 · 12 de 13 cobros' },
                { id: 3, dia: 'Sábado 25', pastilla: 'sobró', estado: 'sobro', detalle: 'Recaudó $241.000 · 13 de 15 cobros', diferencia: '+$12.000', nota: 'cobro sin anotar' },
              ]}
              hallazgo="Los cuatro descuadres del mes son de la ruta de Carlos. Vale la pena revisar cómo está registrando los gastos."
            />
          </div>
        </div>

        <div id="mes-en-caja" style={{ ...MARCO, height: 'auto', minHeight: 700 }}>
          <CabeceraMovil variante={CABECERA.DETALLE} titulo="El mes en caja" subtitulo="julio de 2026" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, padding: '0 20px 20px' }}>
            <MesEnCaja
              paso="$8.838.907"
              tramosFormas={[
                { id: 'efectivo', porcentaje: 71, color: '#2FBE6A' },
                { id: 'digital', porcentaje: 29, color: '#F5B824' },
              ]}
              formas={[
                { id: 'efectivo', etiqueta: 'Efectivo, contado a mano', valor: '$6.275.624', color: '#2FBE6A' },
                { id: 'digital', etiqueta: 'Nequi y transferencias', valor: '$2.563.283', color: '#F5B824', destacado: true },
              ]}
              diasEtiqueta="Los 28 días de julio"
              dias={[
                { etiqueta: 'Cuadraron', valor: '23', tono: 'ok' },
                { etiqueta: 'Faltó plata', valor: '4', tono: 'mal' },
                { etiqueta: 'Sin contar', valor: '1', tono: 'aviso' },
              ]}
              faltanteEtiqueta="Faltante del mes" faltanteValor="$127.000"
              hallazgoTitulo="Los 4 faltantes son de Ruta 2"
              hallazgoDetalle="Ninguna otra ruta descuadró en julio. Andrés Pérez cerró esos cuatro días."
              gastosTotal="$10.000"
              gastos={[{ id: 1, concepto: 'Almuerzo', veces: '1 vez', monto: '$10.000' }]}
              lecturaGastos={<>Un mes de $8,8M con <strong>$10.000 de gastos</strong> quiere decir que la gasolina, los almuerzos y el transporte no se están registrando: la ganancia se ve más alta de lo que es.</>}
            />
          </div>
        </div>

        <div id="bajar" style={{ ...MARCO, height: 'auto', minHeight: 700 }}>
          <CabeceraMovil variante={CABECERA.DETALLE} titulo="Bajar información" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, padding: '0 20px 20px' }}>
            <BajarInformacion
              informes={[
                {
                  id: 'debe', titulo: 'Quién me debe',
                  nota: 'Todos tus clientes con cuánto deben y cuántos días llevan atrasados.',
                  filtros: [
                    { id: 'ruta', valor: 'Todas las rutas' },
                    { id: 'orden', valor: 'Más atrasado' },
                  ],
                  interruptor: { etiqueta: 'Solo los que están en mora', activo: true },
                  cuenta: <>Van a salir <strong>18 clientes</strong> · $16.2M</>,
                  onBajar: () => {}, onMandar: () => {},
                },
                {
                  id: 'fue', titulo: 'Cómo me fue',
                  nota: 'Cuánto entró, cuánto ganaste y cómo le fue a cada cobrador.',
                  onBajar: () => {}, onMandar: () => {},
                },
              ]}
              crudosTitulo="Tus datos en crudo"
              crudosNota="Excel para el contador o para hacer tus propias cuentas."
              crudos={[
                { id: 'clientes', nombre: 'Clientes', filas: 25, onBajar: () => {} },
                { id: 'prestamos', nombre: 'Préstamos', filas: 31, onBajar: () => {} },
                { id: 'pagos', nombre: 'Pagos', filas: 0, onBajar: () => {} },
              ]}
            />
          </div>
        </div>

        <div id="mi-plata" style={{ ...MARCO, height: 'auto', minHeight: 700 }}>
          <CabeceraMovil variante={CABECERA.DETALLE} titulo="Mi plata" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 20px 20px' }}>
            <MiPlata
              total="$30.170.280"
              tramos={[
                { id: 'lista', porcentaje: 8.4, color: '#2FBE6A' },
                { id: 'calle', porcentaje: 91.6, color: '#F5B824' },
              ]}
              partes={[
                { id: 'lista', etiqueta: 'Lista para prestar', valor: '$2.520.280', color: '#2FBE6A' },
                { id: 'calle', etiqueta: 'En la calle, cobrándose', valor: '$27.650.000', color: '#F5B824', destacado: true },
              ]}
              mes={[
                { etiqueta: 'Prestaste', valor: '$26.5M' },
                { etiqueta: 'Te pagaron', valor: '$8.9M' },
                { etiqueta: 'Gastos', valor: '$10.000' },
                { etiqueta: 'Ganaste', valor: '$2.2M', tono: 'ok' },
              ]}
              explicacion="Prestaste más de lo que te pagaron porque la cartera está creciendo. Eso no es una pérdida: esos $17.6M están en la calle con tu nombre."
              estricto={false}
              onEstricto={() => {}}
              onTodosLosMovimientos={() => {}}
              movimientos={[
                { id: 1, concepto: 'Te pagaron un préstamo', detalle: 'ayer 10:00 p. m. · quedaste en $2.520.280', monto: '+$8.000', signo: '+' },
                { id: 2, concepto: 'Le prestaste a Carlos Prueba 1', detalle: 'ayer 9:14 p. m. · quedaste en $2.512.280', monto: '−$1.000.000', signo: '−' },
              ]}
            />
          </div>
        </div>

        <div id="como-va" style={{ ...MARCO, height: 'auto', minHeight: 760 }}>
          <CabeceraMovil variante={CABECERA.DETALLE} titulo="¿Cómo va el negocio?" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 20px 20px' }}>
            <ComoVaElNegocio
              rendimiento="7,8%"
              porCada={<>Por cada $100 en la calle, ganas <strong style={{ color: '#F3F3F6' }}>$8 neto</strong>.</>}
              cifras={[
                { etiqueta: 'Ganancia', valor: '$2.2M', tono: 'ok' },
                { etiqueta: 'Recaudado', valor: '$8.8M' },
                { etiqueta: 'Capital', valor: '$27.6M' },
              ]}
              proyeccionEtiqueta="Va a cerrar el mes en"
              proyeccionDia="día 28 de 31"
              proyeccion="$9.785.933"
              proyeccionPorcentaje="92% de lo esperado"
              proyeccionFalta={<>Llevas $8.8M · te faltan <strong>$947.026</strong> en 3 días para llegar.</>}
              repartoPeso={[
                { etiqueta: 'ganancia', valor: '25¢', color: '#12A150' },
                { etiqueta: 'tu capital de vuelta', valor: '75¢', color: '#8A8E98' },
              ]}
              rutasTotal="9 rutas"
              rutas={[
                { id: 1, nombre: 'Ruta de pepito', rendimiento: '16,7%' },
                { id: 2, nombre: 'Ruta sur', rendimiento: '16,5%' },
              ]}
              sinRuta={{ texto: 'Sin ruta · 3 préstamos · $4.8M al 1%', onAsignar: () => {} }}
              clavos={{ detalle: '1 préstamo irrecuperable · 4% de tu capital', monto: '$1.2M' }}
            />
          </div>
        </div>

        <div id="reportes" style={{ ...MARCO, height: 'auto', minHeight: 720 }}>
          <CabeceraMovil variante={CABECERA.DETALLE} titulo="Reportes" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 20px 20px' }}>
            <Reportes
              entro="$8.838.907" entroDetalle="78 pagos"
              cifras={[
                { etiqueta: 'Clientes', valor: '25' },
                { etiqueta: 'En mora', valor: '18' },
                { etiqueta: 'Activos', valor: '47' },
                { etiqueta: 'Cartera', valor: '$25.1M' },
              ]}
              hallazgoTitulo="Ningún cobrador registró un peso"
              hallazgoDetalle="En 26 días, los 8 cobradores marcan $0 recogido sobre $45M esperados. Los pagos entran todos con tu nombre: están cobrando y no lo están registrando."
              rutasTotal="9 rutas"
              rutas={[
                { id: 1, nombre: 'Ruta sur', detalle: 'sin cobrador · 6 clientes', cartera: '$4.5M', porDia: '$483.667/día' },
                { id: 2, nombre: 'Ruta goty 1', detalle: 'Carlos 1 · 4 clientes', cartera: '$4.3M', porDia: '$811.334/día' },
                { id: 3, nombre: 'Ruta norte', detalle: 'Carlos Andrés · 6 clientes', cartera: '$3.9M', porDia: '$768.367/día' },
              ]}
              sinPeso={{ titulo: '3 rutas sin un peso', detalle: 'Ruta #1 · Carlos perez · cobrador nueva', onVer: () => {} }}
            />
          </div>
        </div>

        <div id="linea-credito" style={{ ...MARCO, height: 'auto', minHeight: 700 }}>
          <CabeceraMovil variante={CABECERA.DETALLE} titulo="Línea de crédito" subtitulo="Marta Lucía Ríos" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 20px 20px' }}>
            <LineaCredito
              puedePedir="$210.000" cupoTotal="$500.000" estado="Activa"
              usado="$290.000" usadoPorcentaje="58%" tasa="10% mensual"
              corteEn="2 días" corteDetalle="30 de julio · le va a quedar $319.000"
              onVerCorte={() => {}}
              onDarPlata={() => {}} onRecibirPago={() => {}}
              movimientosNota="2 este ciclo"
              movimientos={[
                { id: 1, concepto: 'Le pagó', detalle: '25 jul · $40.000 interés + $110.000 capital', monto: '+$150.000', signo: '+' },
                { id: 2, concepto: 'Le dio plata', detalle: '25 jul · quedó en $400.000 usados', monto: '−$400.000', signo: '−' },
              ]}
              onCongelar={() => {}} onCerrar={() => {}}
            />
          </div>
        </div>

        {/* Las OCHO filas del indice. En el intento anterior me invente «Rutas» y
            me falto «Portal del cliente»: aqui estan las que la lamina dibuja, y el
            tope de clientes NO se escribe a mano —sale de PLANES_CONFIG—. */}
        <div id="cfg-indice" style={{ ...MARCO, height: 'auto', minHeight: 680 }}>
          <CabeceraMovil variante={CABECERA.DETALLE} titulo="Configuración" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 20px 20px' }}>
            <IndiceConfiguracion
              negocio="Prestamos Castro"
              negocioNota="Plan Inicial · 31 de 100 clientes"
              filas={[
                { id: 'negocio', nombre: 'Tu negocio', valor: 'Colombia · COP', onIr: () => {} },
                { id: 'prestas', nombre: 'Cómo prestas', valor: 'Diario · 20%', onIr: () => {} },
                { id: 'plan', nombre: 'Plan y pagos', valor: 'renueva 11 ago', onIr: () => {} },
                { id: 'equipo', nombre: 'Equipo', alerta: '5 sin ruta', onIr: () => {} },
                { id: 'portal', nombre: 'Portal del cliente', valor: '7 activos', onIr: () => {} },
                { id: 'avisos', nombre: 'Avisos por WhatsApp', valor: 'activos', onIr: () => {} },
                { id: 'seguridad', nombre: 'Seguridad', alerta: 'Sin PIN', onIr: () => {} },
                { id: 'datos', nombre: 'Tus datos', onIr: () => {} },
              ]}
              tema="claro"
              temas={[
                { id: 'claro', etiqueta: 'Claro' },
                { id: 'oscuro', etiqueta: 'Oscuro' },
                { id: 'auto', etiqueta: 'Auto' },
              ]}
              onTema={() => {}}
            />
          </div>
        </div>

        <div id="cfg-negocio" style={{ ...MARCO, height: 'auto', minHeight: 660 }}>
          <CabeceraMovil variante={CABECERA.DETALLE} titulo="Tu negocio" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 20px 20px' }}>
            <TuNegocioMovil
              nombre="Prestamos Castro"
              nombreNota="Aparece en los recibos y en el portal de tus clientes."
              whatsapp="+57 310 452 1188" whatsappEstado="Verificado"
              pais="Colombia" moneda="Peso colombiano · $"
              formato="punto"
              formatos={[
                { id: 'punto', etiqueta: '$1.200.000', nota: 'punto de miles', cifra: true },
                { id: 'coma', etiqueta: '$1,200,000', nota: 'coma de miles', cifra: true },
                { id: 'corto', etiqueta: '$1.2M', nota: 'abreviado', cifra: true },
              ]}
              onFormato={() => {}}
              avisoPais="Cambiar el país no convierte los montos ya registrados: solo cambia el símbolo y el formato de aquí en adelante."
            />
            <PieGuardar onGuardar={() => {}} />
          </div>
        </div>

        <div id="cfg-prestas" style={{ ...MARCO, height: 'auto', minHeight: 720 }}>
          <CabeceraMovil variante={CABECERA.DETALLE} titulo="Cómo prestas" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 20px 20px' }}>
            <ComoPrestasMovil
              intro="Con estos valores se llena el formulario de nuevo préstamo. Cambiarlos no toca los préstamos que ya existen."
              frecuencia="diario"
              frecuencias={[
                { id: 'diario', etiqueta: 'Diario' },
                { id: 'semanal', etiqueta: 'Semanal' },
                { id: 'quincenal', etiqueta: 'Quincenal' },
                { id: 'mensual', etiqueta: 'Mensual' },
              ]}
              onFrecuencia={() => {}}
              tasa="20" plazo="30"
              modo={{ valor: 'Decreciente' }}
              diasSinCobro={{ valor: 'Domingos' }}
              recargo={{ valor: 'No aplicar' }}
              ejemploTitulo="Así quedaría un préstamo de $500.000"
              ejemplo={[
                { etiqueta: 'Cuota diaria', valor: '$20.000' },
                { etiqueta: 'Total', valor: '$600.000' },
                { etiqueta: 'Ganancia', valor: '$100.000' },
              ]}
            />
            <PieGuardar onGuardar={() => {}} />
          </div>
        </div>

        <div id="cfg-plan" style={{ ...MARCO, height: 'auto', minHeight: 760 }}>
          <CabeceraMovil variante={CABECERA.DETALLE} titulo="Plan y pagos" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 20px 20px' }}>
            <PlanYPagosMovil
              plan="Inicial" precio="$39.000/mes" renueva="renueva el 11 de agosto" estado="Al día"
              clientes={31} limite={100}
              caben="Te caben 69 clientes más en este plan."
              metodoPago="Nequi · termina en 4471" onCambiarMetodo={() => {}}
              pagos={[
                { id: 1, fecha: '11 de julio', monto: '$39.000' },
                { id: 2, fecha: '11 de junio', monto: '$39.000' },
                { id: 3, fecha: '11 de mayo', monto: '$39.000' },
              ]}
              onDescargarPagos={() => {}}
              subidaTitulo="¿Necesitas más clientes?"
              subidaTexto="El plan Básico llega a 450 por $59.000/mes. Se cobra la diferencia proporcional al día que cambies."
              onVerPlanes={() => {}}
            />
          </div>
        </div>

        <div id="cfg-avisos" style={{ ...MARCO, height: 'auto', minHeight: 720 }}>
          <CabeceraMovil variante={CABECERA.DETALLE} titulo="Avisos por WhatsApp" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 20px 20px' }}>
            <AvisosWhatsAppMovil
              intro="Mensajes automáticos a tus clientes desde tu propio número. Puedes editarlos."
              avisos={[
                { id: 'recordatorio', titulo: 'Recordatorio el día del cobro', nota: '7:00 a. m.', activo: true },
                { id: 'atraso', titulo: 'Aviso de atraso', nota: 'a los 3 días', activo: true },
                { id: 'recibo', titulo: 'Recibo al registrar el pago', nota: 'se envía al confirmar', activo: true },
                { id: 'felicitacion', titulo: 'Felicitación al terminar de pagar', nota: 'buen momento para renovar', activo: false },
              ]}
              onAviso={() => {}}
              previaTitulo="Así le llega el recordatorio"
              mensaje={<>Hola Steven, hoy vence tu cuota de <strong>$14.500</strong>. Puedes pagar en efectivo o por Nequi. — Prestamos Castro</>}
              hora="7:00 a. m."
              onEditar={() => {}}
              avisoSinTelefono="Solo se envían a clientes con teléfono guardado. Hoy 12 de tus 31 clientes no tienen número."
            />
          </div>
        </div>

        <div id="cfg-portal" style={{ ...MARCO, height: 'auto', minHeight: 760 }}>
          <CabeceraMovil variante={CABECERA.DETALLE} titulo="Portal del cliente" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 20px 20px' }}>
            <PortalClienteMovil
              activo
              activoNota="Tus clientes pueden ver su saldo con cédula y PIN"
              onActivo={() => {}}
              puedeVer={[
                { id: 'saldo', titulo: 'Saldo y próxima cuota', activo: true },
                { id: 'historial', titulo: 'Historial de sus pagos', activo: true },
                { id: 'mora', titulo: 'Días de atraso y mora', activo: false },
              ]}
              onPuedeVer={() => {}}
              conAccesoTotal="7 de 31"
              conAcceso={[
                { id: 1, nombre: 'Steven Olmos', pin: '7248' },
                { id: 2, nombre: 'Deisy Ramírez', pin: '1190' },
              ]}
              onReenviar={() => {}}
              onActivarTodos={() => {}}
              avisoPin="El PIN se genera solo y se manda por WhatsApp. El cliente nunca ve datos de otras personas ni tus totales."
            />
          </div>
        </div>

        <div id="cfg-seguridad" style={{ ...MARCO, height: 'auto', minHeight: 780 }}>
          <CabeceraMovil variante={CABECERA.DETALLE} titulo="Seguridad y datos" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 20px 20px' }}>
            <SeguridadYDatosMovil
              tienePin={false}
              pinTitulo="Protege la app con un PIN"
              pinTexto="Si prestas el teléfono o lo pierdes, tu cartera queda expuesta. Son 4 dígitos."
              onCrearPin={() => {}}
              ajustes={[
                { id: 'clave', nombre: 'Cambiar contraseña', onIr: () => {} },
                { id: 'sesiones', nombre: 'Sesiones abiertas', valor: '2 aparatos', onIr: () => {} },
              ]}
              datos={[
                { id: 'excel', nombre: 'Descargar todo en Excel', nota: 'clientes, préstamos y pagos', onIr: () => {} },
                { id: 'copia', nombre: 'Copia de seguridad', nota: 'automática cada noche', estado: 'Al día' },
              ]}
              cerrarTexto="Se borra todo: 31 clientes, 68 préstamos y su historial. No se puede deshacer. Descarga tus datos antes."
              onCerrarCuenta={() => {}}
            />
          </div>
        </div>

        {/* Las cuatro son pantalla completa CON SU PIE: registro y onboarding
            pasan antes de que exista el armazon, asi que cada una es duena de su
            alto y pone su propio relleno. Van directas en el MARCO, sin envolver. */}
        <div id="onb-registro" style={MARCO}>
          <RegistroWhatsApp
            prefijo="+57" numero="310 452 1188" onNumero={() => {}} onPrefijo={() => {}}
            ayuda="Para verificar tu cuenta y enviarles recordatorios de cobro a tus clientes."
            nota="Sin el código de país, solo el número. Nunca te vamos a escribir para venderte nada."
            onAtras={() => {}} onContinuar={() => {}}
          />
        </div>

        <div id="onb-verificar" style={MARCO}>
          <VerificarWhatsApp
            numero="+57 310 452 1188" onCorregir={() => {}} onAtras={() => {}}
            digitos={['4', '9', '2', null, null, null]} enCurso={3}
            segundosParaOtro="0:42" onMandarOtro={() => {}}
            consejo="Casi siempre que no llega es porque el número quedó mal escrito. Revísalo antes de pedir otro código."
          />
        </div>

        {/* ⚠️ LAS CIFRAS SALEN DEL ADAPTADOR, no de la lamina. La lamina T37-02 dice
            «30 dias» y «hasta 20 clientes»: son 14 y 100. Aqui se le pasan
            `DIAS_PRUEBA` y `tramosDePlan`, que leen PLANES_CONFIG. */}
        <div id="onb-plan" style={MARCO}>
          <EmpiezaSinPagar
            progresoTexto="Ya casi · falta cargar tu cartera"
            onAtras={() => {}}
            dias={DIAS_PRUEBA}
            limite={limiteInicial()}
            hasta="13 de agosto"
            incluye="Todo abierto: clientes, préstamos, rutas, cobradores, caja y reportes. Sin tarjeta y sin cobro automático."
            tramos={tramosDePlan('co', (n) => `$${n.toLocaleString('es-CO')}`)}
            sinPrisa="No tienes que elegir ahora. Cuando llegues al límite te avisamos y sigues cobrando igual."
            onCargarCartera={() => {}} onPagarYa={() => {}}
          />
        </div>

        <div id="onb-listo" style={MARCO}>
          <ListoParaCobrar
            titulo="Ya tienes tu negocio" subtitulo="en la app"
            detalle="18 clientes y 31 préstamos, sacados de tu cuaderno."
            cartera="$14.280.000"
            cifras={[
              { etiqueta: 'Clientes', valor: '18' },
              { etiqueta: 'Préstamos', valor: '31' },
              { etiqueta: 'Cobras hoy', valor: '7', verde: true },
            ]}
            falta={[
              { texto: '6 clientes sin teléfono', onIr: () => {} },
              { texto: '3 sin dirección', onIr: () => {} },
            ]}
            faltaNota="Nada de esto te frena. Puedes cobrar hoy mismo y completarlo cuando pases por su casa."
            cobrosHoy={7} onVerCobros={() => {}} onPanel={() => {}}
          />
        </div>

        <div id="arr-perfil" style={MARCO}>
          <ArranquePerfil
            nombre="Carlos"
            verificar={{ onCodigo: () => {}, onCerrar: () => {} }}
            quienCobra="solo" onQuienCobra={() => {}}
            opciones={[
              { id: 'solo', titulo: 'Yo cobro', detalle: 'Manejo mi cartera directamente.' },
              { id: 'equipo', titulo: 'Tengo cobradores', detalle: 'Creo sus cuentas y asigno rutas.' },
            ]}
            nota="Si más adelante contratas, activas el modo equipo desde Más."
            onContinuar={() => {}} onSaltar={() => {}}
          />
        </div>

        <div id="arr-capital" style={MARCO}>
          <ArranqueCapital
            moneda="COP" monto="3.000.000" onMonto={() => {}}
            atajos={[{ etiqueta: '+500k' }, { etiqueta: '+1M' }, { etiqueta: '+5M' }]}
            onAtajo={() => {}} onBorrar={() => {}}
            advertencia="Si lo dejas en cero, tu caja va a quedar en negativo el primer día que prestes. Puedes corregirlo después en Caja."
            onContinuar={() => {}} onDespues={() => {}}
          />
        </div>

        <div id="arr-metodo" style={MARCO}>
          <ArranqueMetodo
            elegido="foto"
            destacado={{
              id: 'foto', titulo: 'Foto de la cartulina',
              detalle: 'Hasta 5 fotos por tanda. Se leen los datos y tú confirmas antes de crear nada.',
              ejemplo: <>foto de la cartulina<br />del negocio</>,
            }}
            opciones={[
              {
                id: 'excel', titulo: 'Un Excel o CSV', detalle: 'Sube el archivo que ya tengas.',
                icono: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 4h14v16H5z" /><path d="M5 9h14M5 14h14M12 4v16" />
                  </svg>
                ),
              },
              {
                id: 'mano', titulo: 'Los escribo yo', detalle: 'Uno por uno, a mano.',
                icono: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 20h4l10-10-4-4L4 16z" /><path d="M14 6l4 4" />
                  </svg>
                ),
              },
            ]}
            onElegir={() => {}} onAccion={() => {}} onVacia={() => {}}
          />
        </div>

        {/* «14 dias gratis» NO se escribe: sale de DIAS_PRUEBA. */}
        <div id="arr-cierre" style={MARCO}>
          <ArranqueCierre
            detalle="7 clientes y 7 préstamos, en menos de tres minutos."
            cifras={[
              { etiqueta: 'En la calle', valor: '$4.865.000' },
              { etiqueta: 'En caja', valor: '$3.000.000' },
            ]}
            misiones={[
              { texto: 'Cargar tus primeros clientes', hecha: true },
              { texto: 'Cobrar tu primer pago', onIr: () => {} },
              { texto: 'Elegir tu plan', pastilla: `${DIAS_PRUEBA} días gratis`, onIr: () => {} },
            ]}
            nota="El plan se elige aquí, después de ver el producto funcionando — no antes."
            onAccion={() => {}}
          />
        </div>

        {/* T01-04. Cada cliente su tarjeta; la que se revisa lleva anillo dorado y
            abre el campo. El campo es CONTROLADO: antes era defaultValue y nadie
            pasaba onCorregir, o sea que escribir la cedula no hacia nada. */}
        <div id="rev-ocr" style={{ ...MARCO, height: 'auto', minHeight: 820, padding: '16px 20px 20px', overflow: 'visible' }}>
          <RevisionCarga
            titulo="Encontré 7 clientes"
            detalle="Revisa los 2 marcados en ámbar. No se crea nada hasta que confirmes."
            total={7}
            cartera="$4.865.000"
            onOtraFoto={() => {}}
            onCorregir={() => {}}
            onCrear={() => {}}
            filas={[
              { nombre: 'Carlos Chaparro', contexto: 'CC 81283812 · quincenal · 20%', monto: '$1.200.000' },
              { nombre: 'Julián Vélez', contexto: 'CC 71920034 · diario · 20%', monto: '$670.000' },
              {
                nombre: 'Steven Olmos', revisar: true, contexto: 'Falta la cédula', monto: '$450.000',
                reparos: [{
                  campo: 'cedula', texto: 'Cédula', valor: '1034',
                  recorte: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='44' height='30'><rect width='44' height='30' fill='%23e9e7e2'/><path d='M-8 30L30-8M0 38L38 0M8 46L46 8' stroke='%23dedcd6' stroke-width='4'/></svg>",
                  dondeIba: 'recorte de la foto donde iba el dato',
                }],
              },
              { nombre: 'Carmen Jiménez', revisar: true, contexto: 'Monto poco legible', monto: '$45.000', montoDudoso: true },
              { nombre: 'Deisy Ramírez', contexto: 'CC 43987112 · semanal · 15%', monto: '$300.000' },
            ]}
          />
        </div>

        {/* T27-02. Los datos son los de la lamina, pero las cifras del bloque
            negro las calcula el adaptador: «por ganar» con la resta ingenua sale
            NEGATIVA en cuanto un cliente abona. */}
        <div id="ruta-detalle" style={MARCO}>
          {(() => {
            const RUTA = {
              nombre: 'Ruta 2',
              cobrador: { nombre: 'Pepito' },
              carteraTotal: 11_600_000,
              capitalPendiente: 8_400_000,
              totalAPagarRuta: 40_000_000,
              esperadoHoy: 128_500,
              recaudadoHoy: 34_500,
              recaudadoEfectivoHoy: 34_500,
              recaudadoDigitalHoy: 0,
              clientesConCobroHoy: 5,
              clientesPagaronHoy: 1,
              clientes: [
                { id: 1, orden: 1, nombre: 'Steven Olmos', diasMora: 36, direccion: 'Cl 8 # 31-05', montoACobrar: 27_500 },
                { id: 2, orden: 2, nombre: 'Pepito Gómez', cobradoHoy: true, horaCobro: '6:52', medio: 'efectivo', montoACobrar: 34_500 },
                { id: 3, orden: 3, nombre: 'Luz Mery Ossa', diasMora: 0, direccion: 'Cra 7 # 51-08', montoACobrar: 18_000 },
              ],
            }
            const fmt = (n) => `$${n.toLocaleString('es-CO')}`
            return (
              <DetalleRuta
                cabecera={adaptarCabeceraRuta(RUTA, '3,4 km')}
                onAtras={() => {}} onMas={() => {}}
                puesto={loPuestoAqui(RUTA, fmt)}
                hoy={loDeHoy(RUTA, fmt)}
                recorrido={adaptarRecorrido(RUTA.clientes, fmt)}
                siguiente={siguienteParada(RUTA.clientes)}
                onParada={() => {}} onSeguir={() => {}}
              />
            )
          })()}
        </div>

        {/* T28-01 «claro — el default» y T28-02 oscuro SON LA MISMA PANTALLA:
            escrita con tokens, el tema la cambia sola. Aqui la misma en los dos. */}
        <div id="modo-ruta-claro" style={MARCO}>
          {(() => {
            const CLIENTES = [
              { id: 1, orden: 1, nombre: 'Steven Olmos', cobradoHoy: true, horaCobro: '15:40', medio: 'efectivo', montoACobrar: 27_500, montoCobrado: 27_500 },
              { id: 2, orden: 2, nombre: 'Pepito Gómez', cobradoHoy: true, horaCobro: '16:20', medio: 'Nequi', montoACobrar: 34_500, montoCobrado: 34_500 },
              { id: 3, orden: 3, nombre: 'Luz Mery Ossa', diasMora: 0, direccion: 'Cra 7 # 51-08', distanciaMetros: 410, saldoPendiente: 126_000, montoACobrar: 18_000, telefono: '3104521188' },
              { id: 4, orden: 4, nombre: 'Nelson Aguirre', diasMora: 9, distanciaMetros: 1_240, montoACobrar: 21_500 },
              { id: 5, orden: 5, nombre: 'Yeison Patiño', diasMora: 31, distanciaMetros: 1_640, montoACobrar: 27_000 },
            ]
            const fmt = (n) => `$${n.toLocaleString('es-CO')}`
            const partes = partirRecorrido(CLIENTES, fmt)
            const RUTA = {
              esperadoHoy: 128_500, recaudadoHoy: 62_000,
              clientesConCobroHoy: 5, clientesPagaronHoy: 2,
            }
            return (
              <ModoRuta
                ruta="Ruta 2"
                posicion={partes.posicion}
                tiempo={tiempoFuera(72)}
                vista="lista" onVista={() => {}}
                onAtras={() => {}}
                hoy={loDeHoy(RUTA, fmt)}
                actual={adaptarParadaActual(partes.actual, fmt)}
                onAvisar={() => {}} onLlegar={() => {}} onCobrar={() => {}}
                faltan={partes.faltan}
                cobradosTitulo={partes.cobradosTitulo}
                cobrados={partes.cobrados}
                cobradosTotal={partes.cobradosTotal}
                onParada={() => {}}
              />
            )
          })()}
        </div>

        {/* T28-01 «claro — el default» y T28-02 oscuro SON LA MISMA PANTALLA:
            escrita con tokens, el tema la cambia sola. Aqui la misma en los dos. */}
        <div id="modo-ruta-oscuro" data-theme="dark" style={MARCO}>
          {(() => {
            const CLIENTES = [
              { id: 1, orden: 1, nombre: 'Steven Olmos', cobradoHoy: true, horaCobro: '15:40', medio: 'efectivo', montoACobrar: 27_500, montoCobrado: 27_500 },
              { id: 2, orden: 2, nombre: 'Pepito Gómez', cobradoHoy: true, horaCobro: '16:20', medio: 'Nequi', montoACobrar: 34_500, montoCobrado: 34_500 },
              { id: 3, orden: 3, nombre: 'Luz Mery Ossa', diasMora: 0, direccion: 'Cra 7 # 51-08', distanciaMetros: 410, saldoPendiente: 126_000, montoACobrar: 18_000, telefono: '3104521188' },
              { id: 4, orden: 4, nombre: 'Nelson Aguirre', diasMora: 9, distanciaMetros: 1_240, montoACobrar: 21_500 },
              { id: 5, orden: 5, nombre: 'Yeison Patiño', diasMora: 31, distanciaMetros: 1_640, montoACobrar: 27_000 },
            ]
            const fmt = (n) => `$${n.toLocaleString('es-CO')}`
            const partes = partirRecorrido(CLIENTES, fmt)
            const RUTA = {
              esperadoHoy: 128_500, recaudadoHoy: 62_000,
              clientesConCobroHoy: 5, clientesPagaronHoy: 2,
            }
            return (
              <ModoRuta
                ruta="Ruta 2"
                posicion={partes.posicion}
                tiempo={tiempoFuera(72)}
                vista="lista" onVista={() => {}}
                onAtras={() => {}}
                hoy={loDeHoy(RUTA, fmt)}
                actual={adaptarParadaActual(partes.actual, fmt)}
                onAvisar={() => {}} onLlegar={() => {}} onCobrar={() => {}}
                faltan={partes.faltan}
                cobradosTitulo={partes.cobradosTitulo}
                cobrados={partes.cobrados}
                cobradosTotal={partes.cobradosTotal}
                onParada={() => {}}
              />
            )
          })()}
        </div>

        <div id="ruta-crear" style={MARCO}>
          {(() => {
            const COBRADORES = [
              { id: 'p', nombre: 'Pepito Perez', rutas: 1 },
              { id: 'c1', nombre: 'Carlos 1', rutas: 0 },
            ]
            const CLIENTES = [
              { id: 1, nombre: 'Steven Olmos', direccion: 'Cl 8 # 31-05', rutaNombre: 'Ruta 2', rutaCobrador: 'Pepito' },
              { id: 2, nombre: 'Carlos Chaparro', direccion: 'Cra 12 # 4-18', rutaNombre: 'Ruta #1', rutaCobrador: 'Carlos' },
              { id: 3, nombre: 'Deisy Ramírez', direccion: 'Cra 45 # 12-30' },
            ]
            const ELEGIDOS = [1, 2, 3]
            const co = cobradoresParaElegir(COBRADORES, { id: 'yo', nombre: 'Carlos Castro' })
            return (
              <CrearRuta
                nombre="Bolivariana" onNombre={() => {}}
                cobradores={co.filas} cobradorNota={co.nota}
                cobrador="c1" onCobrador={() => {}}
                clientes={clientesParaElegir(CLIENTES, ELEGIDOS)} elegidos={ELEGIDOS}
                onCliente={() => {}}
                buscarPlaceholder="Buscar entre tus 31 clientes…" onBuscar={() => {}}
                aviso={avisoDeRobo(CLIENTES, ELEGIDOS)}
                onCrear={() => {}}
              />
            )
          })()}
        </div>

        <div id="ruta-orden" style={MARCO}>
          {(() => {
            const PARADAS = [
              { id: 1, orden: 1, nombre: 'Steven Olmos', direccion: 'Cl 8 # 31-05', diasMora: 36, tramoMetros: 240 },
              { id: 2, orden: 2, nombre: 'Pepito Gómez', direccion: 'Calle 65 # 22-14', tramoMetros: 520 },
              { id: 3, orden: 3, nombre: 'Fantasma 4', direccion: 'Cra 7 # 44-12', tramoMetros: 680 },
              { id: 4, orden: 4, nombre: 'Luz Mery Ossa', direccion: 'Cra 7 # 51-08', tramoMetros: 410 },
              { id: 5, orden: 5, nombre: 'Nelson Aguirre', direccion: 'Cl 52 # 8-40', diasMora: 9, tramoMetros: 1_240 },
            ]
            return (
              <OrdenRecorrido
                detalle="Ruta 2 · 5 paradas · 3,4 km"
                onAtras={() => {}} onMapa={() => {}}
                paradas={tramosDelRecorrido(PARADAS)}
                onReordenar={() => {}}
                propuesta={propuestaPorCercania({ actualMetros: 3400, propuestaMetros: 2600 })}
                onProbar={() => {}}
                sucio onDeshacer={() => {}} onGuardar={() => {}}
              />
            )
          })()}
        </div>

        {/* La cuenta del cierre es la del endpoint de caja —cobrado - prestado -
            gastos—, NO la de la lamina, que pone «61.500 - 200.000» y luego «a
            entregar 61.500». */}
        <div id="ruta-cierre" style={MARCO}>
          {(() => {
            const fmt = (n) => `$${n.toLocaleString('es-CO')}`
            const RUTA = { recaudadoHoy: 61_500, esperadoHoy: 74_500, clientesConCobroHoy: 5, clientesPagaronHoy: 4 }
            return (
              <RutaCerrada
                titulo="Ruta 2" terminado="Recorrido terminado · 18:38"
                onAtras={() => {}} onMas={() => {}}
                resumen={resumenDeCierre(RUTA, fmt)}
                cierre={cierreDelDia({ cobradoEfectivo: 61_500, prestadoEfectivo: 0, gastos: 0 }, fmt)}
                onCerrar={() => {}}
                hoy={loQuePasoHoy([
                  { id: 1, nombre: 'Steven Olmos', hora: '14:12', concepto: 'cuota completa', monto: 27_500 },
                  { id: 2, nombre: 'Fantasma 4', hora: '15:48', concepto: 'abono parcial', monto: 20_000 },
                  { id: 3, nombre: 'Carmen Jiménez', hora: '17:02', tipo: 'no_pago', motivo: 'vuelve mañana', monto: 13_000 },
                ], fmt)}
              />
            )
          })()}
        </div>

        {/* El mismo cierre cuando presto mas de lo que cobro: la casa le debe. */}
        <div id="ruta-cierre-negativo" style={{ ...MARCO, height: 'auto', minHeight: 380, overflow: 'visible', padding: 20 }}>
          <TarjetaCierre
            {...cierreDelDia(
              { cobradoEfectivo: 61_500, prestadoEfectivo: 200_000, gastos: 8_000 },
              (n) => `$${n.toLocaleString('es-CO')}`,
            )}
            onCerrar={() => {}}
          />
        </div>

        <div id="ruta-mapa" style={MARCO}>
          {(() => {
            const fmt = (n) => `$${n.toLocaleString('es-CO')}`
            const CLIENTES = [
              { id: 1, orden: 1, nombre: 'Steven Olmos', diasMora: 36 },
              { id: 2, orden: 2, nombre: 'Pepito Gómez', cobradoHoy: true },
              { id: 3, orden: 3, nombre: 'Luz Mery Ossa', diasMora: 0 },
              { id: 4, orden: 4, nombre: 'Nelson Aguirre', cobradoHoy: true },
              { id: 5, orden: 5, nombre: 'Yeison Patiño', diasMora: 31 },
            ]
            const EN = [[36, 44], [224, 44], [224, 222], [104, 222], [104, 372]]
            const pines = pinesDelMapa(CLIENTES).map((p, i) => ({ ...p, x: EN[i][0], y: EN[i][1] }))
            return (
              <RutaEnMapa
                titulo="Ruta 2 · en mapa"
                detalle={cabeceraMapa({ cobros: 5, metros: 3400, minutos: 80 })}
                onAtras={() => {}}
                conmutador={<ConmutadorVista vista="mapa" onVista={() => {}} />}
                pines={pines} onPin={() => {}}
                tuPunto={{ x: 300, y: 150 }}
                leyenda={LEYENDA_MAPA}
                tarjeta={{
                  orden: 1, color: 'rojo', nombre: 'Steven Olmos', pastilla: '36d',
                  donde: 'Cl 8 # 31-05 · a 240 m de ti', monto: fmt(27_500),
                }}
                onLlegar={() => {}} onCobrar={() => {}}
              >
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'repeating-linear-gradient(0deg,#e8e6e0 0 1px,#eeece6 1px 44px),repeating-linear-gradient(90deg,#e8e6e0 0 1px,#eeece6 1px 44px)',
                }} />
              </RutaEnMapa>
            )
          })()}
        </div>

        <div id="portal-acceso" style={MARCO}>
          <PortalAcceso
            cedula="1.034.887.212" onCedula={() => {}}
            pin={['7', '2', '4']} onPin={() => {}}
            onEntrar={() => {}} onPedirPin={() => {}}
          />
        </div>

        {/* La barra va en VERDE y mide LO PAGADO: para el deudor lo saldado es el
            logro. Es el mismo numero que el dueno ve como «cobrado». */}
        <div id="portal-prestamo" style={MARCO}>
          {(() => {
            const fmt = (n) => `$${n.toLocaleString('es-CO')}`
            return (
              <PortalPrestamo
                cliente="Steven Olmos" cedula="CC 1.034.887.212" onSalir={() => {}}
                deuda={loQueDebe({
                  totalAPagar: 435_000, pagado: 304_500,
                  cuotasPagadas: 22, cuotasTotales: 30, diasMora: 36,
                }, fmt)}
                proxima={proximaCuota({ monto: 14_500, relativo: 'mañana', fecha: 'martes 29 de julio' }, fmt)}
                onAvisar={() => {}}
                pagosCuenta="22 pagos"
                pagos={misPagos([
                  { id: 1, fecha: '19 de julio', monto: 14_500 },
                  { id: 2, fecha: '12 de julio', monto: 8_000, tipo: 'abono' },
                  { id: 3, fecha: '5 de julio', monto: 14_500 },
                ], fmt)}
                onTodos={() => {}}
                prestamista="Carlos Castro" onEscribir={() => {}}
              />
            )
          })()}
        </div>

        {/* T36-01. La respuesta es IDENTICA exista el numero o no: un desconocido
            no puede averiguar quien le debe a quien probando telefonos. */}
        <div id="portal-recuperar" style={MARCO}>
          <PortalRecuperar
            negocio="Prestamos Castro" onAtras={() => {}}
            {...respuestaDeRecuperacion({ prestamista: 'Don Carlos' })}
            numero="300 118 4471" onNumero={() => {}}
            onMandar={() => {}} onEscribir={() => {}}
          />
        </div>

        {/* «Le debes» NO se dibuja: hoy no hay donde registrar un reparto
            (AporteSocio.tipo solo admite aporte|retiro). Ver el PENDIENTE en
            lib/adaptadores/socios.js. */}
        <div id="socios-lista" style={MARCO}>
          {(() => {
            const fmt = (n) => `$${n.toLocaleString('es-CO')}`
            const SOCIOS = [
              { id: 'c', nombre: 'Carlos Andrés', puesto: 8_000_000, pagado: 1_200_000, activo: true },
              { id: 'm', nombre: 'Marta Ruiz', puesto: 4_000_000, pagado: 300_000, activo: true },
            ]
            const puesto = loQuePusieron(SOCIOS, fmt)
            return (
              <ListaSociosT45
                cabecera={cabeceraSocios(SOCIOS)}
                onAtras={() => {}} onNuevo={() => {}}
                puesto={puesto}
                pendiente={{ monto: fmt(1_240_000), desde: 'desde el 30 de junio' }}
                onRepartir={() => {}}
                sociosTitulo={`Los ${SOCIOS.length} socios`}
                socios={SOCIOS.map((x, i) => cuentaDelSocio(
                  { ...x, porcentaje: puesto.socios[i].porcentaje }, fmt,
                ))}
                onSocio={() => {}}
              />
            )
          })()}
        </div>

        {/* El mismo con repartos ya registrados: aqui SI aparece «Le debes». */}
        <div id="socios-lista-deuda" style={MARCO}>
          {(() => {
            const fmt = (n) => `$${n.toLocaleString('es-CO')}`
            const SOCIOS = [
              { id: 'c', nombre: 'Carlos Andrés', puesto: 8_000_000, pagado: 1_200_000, repartido: 1_980_000, activo: true },
              { id: 'm', nombre: 'Marta Ruiz', puesto: 4_000_000, pagado: 300_000, repartido: 900_000, activo: true },
            ]
            const puesto = loQuePusieron(SOCIOS, fmt)
            return (
              <ListaSociosT45
                cabecera={cabeceraSocios(SOCIOS)}
                onAtras={() => {}} onNuevo={() => {}}
                puesto={puesto}
                pendiente={{ monto: fmt(1_240_000), desde: 'desde el 30 de junio' }}
                onRepartir={() => {}}
                sociosTitulo={`Los ${SOCIOS.length} socios`}
                socios={SOCIOS.map((x, i) => cuentaDelSocio(
                  { ...x, porcentaje: puesto.socios[i].porcentaje }, fmt,
                ))}
                onSocio={() => {}}
              />
            )
          })()}
        </div>

        {/* T45-02. La suma CUADRA AL PESO: 826.667 + 413.333 = 1.240.000. */}
        <div id="socios-repartir-t45" style={{ ...MARCO, background: 'var(--cf-scrim)' }}>
          {(() => {
            const fmt = (n) => `$${n.toLocaleString('es-CO')}`
            const SOCIOS = [
              { id: 'c', nombre: 'Carlos Andrés', puesto: 8_000_000 },
              { id: 'm', nombre: 'Marta Ruiz', puesto: 4_000_000 },
            ]
            const puesto = loQuePusieron(SOCIOS, fmt)
            return (
              <HojaRepartir
                periodo="del 30 de junio al 28 de julio"
                onCerrar={() => {}}
                reparto={repartoDe(1_240_000, puesto.socios, fmt)}
                deDonde={deDondeSale({ entro: 8_838_907, gastos: 10_000 }, fmt)}
                antesDespues={loQueQuedaDebiendo({ antes: 1_380_000, reparto: 1_240_000 }, fmt)}
                nota={NOTA_NO_SACA_PLATA}
                onConfirmar={() => {}} onCambiarPeriodo={() => {}}
              />
            )
          })()}
        </div>

        {/* T43-01. Agrupado por lo que le pasa a la plata, y cada opcion con su
            cifra: con la cifra al lado un menu se vuelve un panel. */}
        <div id="menu-mas" style={MARCO}>
          {(() => {
            const T = (d) => (
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.95" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
            )
            const D = (d) => (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
            )
            return (
              <MenuMas
                cuando="martes 28 · 7:14 a. m."
                grupos={[
                  {
                    titulo: 'Entra plata',
                    acciones: [
                      {
                        id: 'pago', titulo: 'Registrar un pago', cifra: 'te faltan 5 cobros de hoy',
                        destacado: true, onClick: () => {},
                        icono: T(<><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></>),
                      },
                      {
                        id: 'qr', titulo: 'Escanear un QR', onClick: () => {},
                        icono: T(<><rect x="4" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" /></>),
                      },
                    ],
                  },
                  {
                    titulo: 'Sale plata',
                    acciones: [
                      {
                        id: 'prestar', titulo: 'Prestarle a alguien', cifra: 'tienes $2.5M para prestar',
                        destacado: true, onClick: () => {},
                        icono: T(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v9M14.4 9.6c-.5-.7-1.4-1.1-2.4-1.1-1.4 0-2.4.8-2.4 1.9 0 1.2 1 1.7 2.4 2 1.4.3 2.4.8 2.4 2 0 1.1-1 1.9-2.4 1.9-1 0-1.9-.4-2.4-1.1" /></>),
                      },
                      {
                        id: 'gasto', titulo: 'Anotar un gasto', onClick: () => {},
                        icono: T(<><path d="M6 4h12v16H6z" /><path d="M9 9h6M9 13h4" /></>),
                      },
                    ],
                  },
                  {
                    titulo: 'Crear',
                    acciones: [
                      {
                        id: 'cliente', titulo: 'Un cliente nuevo', onClick: () => {},
                        icono: T(<><circle cx="11" cy="8.5" r="3.5" /><path d="M4 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" /><path d="M18 7h4M20 5v4" /></>),
                      },
                    ],
                  },
                ]}
                destinos={[
                  { id: 'hoy', titulo: 'Cobrar hoy', cifra: '5 pendientes', onClick: () => {}, icono: D(<><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></>) },
                  { id: 'caja', titulo: 'La caja', cifra: 'sin cerrar', onClick: () => {}, icono: D(<rect x="3" y="7" width="18" height="12" rx="2.5" />) },
                  { id: 'plata', titulo: 'Mi plata', cifra: '$2.5M libres', onClick: () => {}, icono: D(<><path d="M4 20V9l8-5 8 5v11z" /><path d="M10 20v-6h4v6" /></>) },
                  { id: 'plan', titulo: 'Mi plan', cifra: 'vence en 5 días', urgente: true, onClick: () => {}, icono: D(<><rect x="3" y="6" width="18" height="12" rx="2.5" /><path d="M3 10.5h18" /></>) },
                ]}
                lucas={{ ejemplo: '¿cuánto recaudé esta semana?', onClick: () => {} }}
                onCerrar={() => {}}
              />
            )
          })()}
        </div>

        <HojaDemo id="registrar-gasto" titulo="Registrar gasto" subtitulo="Sale de la caja de hoy">
          <RegistrarGasto
            monto="35.000"
            categorias={[
              { id: 'gasolina', etiqueta: 'Gasolina' },
              { id: 'comida', etiqueta: 'Comida' },
              { id: 'transporte', etiqueta: 'Transporte' },
              { id: 'sueldo', etiqueta: 'Sueldo' },
              { id: 'otro', etiqueta: 'Otro' },
            ]}
            categoria="gasolina"
            nota=""
            cajaAntes="$2.012.000"
            cajaDespues="$1.977.000"
          />
          <PieGestion onCancelar={() => {}} onAceptar={() => {}} textoAceptar="Registrar $35.000" />
        </HojaDemo>
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
            <CompararModos
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
          {/* Sin el selector de «¿cuándo lo cobra?»: el backend no lo modela. Ver
              la nota PENDIENTE-BACKEND en Gestion.jsx. La consecuencia de verdad
              —le pides lo mismo durante más tiempo— va en el bloque negro. */}
          <Recargo
            monto="15.000"
            atajos={[
              { id: 'a', etiqueta: '$5.000' },
              { id: 'b', etiqueta: '$10.000' },
              { id: 'c', etiqueta: '$15.000' },
              { id: 'otro', etiqueta: 'Otro' },
            ]}
            atajoActivo="c"
            motivo=""
            saldoAntes="$130.500" saldoDespues="$145.500"
            cuotaIgual="sigue en $14.500" cobrosDeMas="2 cobros más" />
          <PieGestion onCancelar={() => {}} onAceptar={() => {}} textoAceptar="Aplicar $15.000" />
        </HojaDemo>

        <HojaDemo id="ges-plazo" titulo="Modificar el plazo" subtitulo="Le quedan 8 cuotas de 30 · vence el 6 de agosto">
          <ModificarPlazo
            intenciones={[
              { id: 'extender', etiqueta: 'Extender plazo' },
              { id: 'fin', etiqueta: 'Corregir fin' },
              { id: 'inicio', etiqueta: 'Corregir inicio' },
            ]}
            intencion="extender"
            cuotas={14} cuotasAntes={8} unidad="cuotas diarias" minimoCuotas={8}
            cuotaAntes="$16.312" cuotaDespues="$9.322"
            terminaAntes="6 ago" terminaDespues="14 ago" totalIgual="igual: $130.500" />
          <PieGestion onCancelar={() => {}} onAceptar={() => {}} textoAceptar="Guardar 14 cuotas" />
        </HojaDemo>

        <HojaDemo id="ges-descuento" titulo="Perdonarle una parte" subtitulo="Carlos Chaparro · 36 días de atraso · cumple 41%">
          {/* Sin el selector de «¿de dónde sale?»: el backend no lo modela. Lo que
              la lámina quería que se viera son las dos líneas de abajo. */}
          <Descuento
            monto="48.000"
            atajos={[
              { id: 'atraso', etiqueta: 'Todo el atraso' },
              { id: 'cuota', etiqueta: 'Una cuota' },
              { id: 'otro', etiqueta: 'Otro' },
            ]}
            atajoActivo="atraso"
            motivo=""
            debeAntes="$320.000" debeDespues="$272.000"
            gananciaLinea="$52.000 de $100.000" capitalLinea="tus $500.000" />
          <PieGestion onCancelar={() => {}} onAceptar={() => {}} textoAceptar="Perdonar $48.000" />
        </HojaDemo>

        <HojaDemo id="ges-perdidos" titulo="Mover a perdidos" subtitulo="Julián Vélez · 35 días sin pagar · cumple 18%">
          <MoverAPerdidos
            montoEnJuego="$184.733"
            contactoLinea={<>Le escribiste hace <strong>22 días</strong> · lo visitaron hace <strong>12</strong></>}
            onAcuerdo={() => {}}
            motivos={[
              { id: 'mudo', etiqueta: 'Se mudó' },
              { id: 'nocontesta', etiqueta: 'No contesta' },
              { id: 'otro', etiqueta: 'Otro' },
            ]}
            motivo="mudo"
            carteraAntes="$38.4M" carteraDespues="$38.2M"
            perdidaEtiqueta="Pérdida de julio" perdidaValor="$184.733" />
          {/* `peligro`: la accion destacada es NO hacerlo. Es la unica pantalla del
              sistema donde el dorado no va en la accion principal. */}
          <PieGestion peligro textoCancelar="Seguir cobrando" onCancelar={() => {}}
            onAceptar={() => {}} textoAceptar="Dar por perdido" />
        </HojaDemo>

        <HojaDemo id="ges-cerrar" titulo="Quiere pagar todo hoy" subtitulo="Andrés Cortés · le faltan 3 de 12 cuotas">
          <CerrarAnticipado
            opciones={[
              { id: 'capital', etiqueta: 'Solo el capital que debe', nota: 'Le perdonas el interés de las 3 que faltan', valor: '$980.000' },
              { id: 'todo', etiqueta: 'Todo lo pactado', nota: 'Como si pagara las 3 cuotas', valor: '$1.180.000' },
              { id: 'medio', etiqueta: 'Un punto medio', nota: 'Tú pones el monto', valor: 'Elegir', tono: 'enlace' },
            ]}
            opcion="capital"
            recibes="$980.000" dejasDeGanar="$200.000"
            gananciaTotal="$580.000" cuandoVuelve="hoy, no en 3 meses" />
          <PieGestion onCancelar={() => {}} onAceptar={() => {}} textoAceptar="Cerrar por $980.000" />
        </HojaDemo>

        <HojaDemo id="ges-aplazar" titulo="Aplazar el cobro" subtitulo="Steven Olmos · toca hoy · lleva 6 días de atraso">
          <AplazarCobro
            cuandos={[
              { id: 'manana', etiqueta: 'Mañana', nota: 'mié 29' },
              { id: 'tres', etiqueta: 'En 3 días', nota: 'vie 31' },
              { id: 'otra', etiqueta: 'Otra fecha', nota: 'elegir' },
            ]}
            cuando="tres"
            motivos={[
              { id: 'viernes', etiqueta: 'Le pagan el viernes' },
              { id: 'noestaba', etiqueta: 'No estaba' },
              { id: 'enfermo', etiqueta: 'Está enfermo' },
              { id: 'otro', etiqueta: 'Otro' },
            ]}
            motivo="viernes"
            cobrasAntes="hoy, martes 28" cobrasDespues="viernes 31"
            cobrasHoyLinea="$145.000 → $107.000" />
          <PieGestion onCancelar={() => {}} onAceptar={() => {}} textoAceptar="Aplazar al viernes 31" />
        </HojaDemo>

        <HojaDemo id="ges-dia" titulo="Cambiar el día de cobro" subtitulo="Para siempre, no solo esta vez">
          <DiaDeCobro
            dias={[
              { id: 1, etiqueta: 'L' }, { id: 2, etiqueta: 'M' }, { id: 3, etiqueta: 'M' },
              { id: 4, etiqueta: 'J' }, { id: 5, etiqueta: 'V' }, { id: 6, etiqueta: 'S' },
              { id: 0, etiqueta: 'D', apagado: true },
            ]}
            dia={5}
            nota="Hoy le cobras los martes. Domingo está apagado en tu configuración."
            desdes={[
              { id: 'proxima', etiqueta: 'Desde la próxima' },
              { id: 'todas', etiqueta: 'Recalcular todas' },
            ]}
            desde="proxima"
            cobraAntes="martes" cobraDespues="viernes"
            proximoCobro="viernes 31 de julio" />
          <PieGestion onCancelar={() => {}} onAceptar={() => {}} textoAceptar="Guardar los viernes" />
        </HojaDemo>

        {/* T19-05 NO es una hoja: la lamina la dibuja a pantalla completa con su
            cabecera y flecha atras. Una hoja se cierra con un gesto hacia abajo, y
            aqui un gesto de mas deja a medias un cambio que reescribe el historico.
            En el banco se enseña con `HojaDemo` solo para que quepa en la rejilla. */}
        <HojaDemo id="ges-corregir" titulo="Corregir el préstamo" subtitulo="Steven Olmos · préstamo 1">
          <CorregirPrestamo
            aviso={<>Esto es para <strong>arreglar un error de digitación</strong>, no para renegociar. Ya hay 22 pagos registrados: cambiar el monto o el interés recalcula todo hacia atrás.</>}
            peligrosos={[
              { clave: 'monto', etiqueta: 'Monto prestado', valor: '$350.000', consecuencia: 'Recalcula 22 pagos', onTocar: () => {} },
              { clave: 'interes', etiqueta: 'Interés', valor: '20%', consecuencia: 'Recalcula 22 pagos', onTocar: () => {} },
              { clave: 'inicio', etiqueta: 'Fecha de inicio', valor: '4 de julio de 2026', consecuencia: 'Mueve las fechas', texto: true, onTocar: () => {} },
            ]}
            seguros={[
              { clave: 'ruta', etiqueta: 'Ruta', valor: 'Ruta 2 · Pepito', onTocar: () => {} },
              { clave: 'nota', etiqueta: 'Nota interna', tipo: 'nota', valor: 'Trabaja en la plaza, mejor buscarlo antes de las 9.' },
            ]}
          />
          <PieGestion onCancelar={() => {}} onAceptar={() => {}} textoAceptar="Guardar cambios" />
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

        {/* CON `HojaDemo`, NO con `HojaInferior`. La pieza de verdad es
            `position: fixed; inset: 0` —es un modal—, asi que metida en el banco
            tapaba la pagina ENTERA: todos los bloques de abajo quedaban debajo de
            un velo y no se podia cotejar ninguno. Lo vi al capturar el recargo y
            salir la hoja de pago. `HojaDemo` finge el asa, el titulo y el velo sin
            salirse de su marco, que es para lo que existe. */}
        <HojaDemo id="registrar-cobro" titulo="Registrar pago" subtitulo="Steven Olmos · cuota 22 de 30">
          <RegistrarCobro
            monto="27.500"
            atajos={[
              { id: 'cuota', etiqueta: 'Cuota' },
              { id: 'mitad', etiqueta: 'Mitad' },
              { id: 'todo', etiqueta: 'Todo' },
            ]}
            atajoActivo="cuota"
            aplicaciones={[
              { id: 'completo', etiqueta: 'Cuota' },
              { id: 'capital', etiqueta: 'Capital' },
              { id: 'intereses', etiqueta: 'Interés' },
            ]}
            aplicacion="completo"
            medios={[
              { id: 'efectivo', nombre: 'Efectivo', efectivo: true },
              { id: 'c1', nombre: 'Nequi', inicial: 'N', color: '#7A6CF0' },
              { id: 'c2', nombre: 'Daviplata', inicial: 'D', color: '#E5484D' },
              { id: 'c3', nombre: 'Bancolombia', inicial: 'B', color: '#4A4E57' },
            ]}
            medio="efectivo"
            despues={[
              { clave: 'saldo', etiqueta: 'Saldo pendiente', antes: '$130.500', valor: '$103.000' },
              { clave: 'caja', etiqueta: 'Entra a caja como', valor: 'Efectivo · Pepito' },
              { clave: 'proximo', etiqueta: 'Próximo cobro', valor: 'mié 29 de julio' },
            ]}
            onLoRaro={() => {}}
          />
          <PieRegistrarCobro textoConfirmar="Confirmar $27.500" onConfirmar={() => {}} onRecibo={() => {}} />
        </HojaDemo>
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

      <h2 style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)', margin: '34px 0 4px' }}>
        El pagaré · lo que queda cuando el cliente dice que nunca firmó
      </h2>
      <p style={{ fontSize: 13, color: 'var(--cf-ink-2)', margin: '0 0 12px', maxWidth: '72ch', lineHeight: 1.5 }}>
        El único momento del flujo con consecuencia legal, y hoy es una casilla en la ficha. El
        recargo por mora aparece <strong>antes</strong> de firmar: es la única forma de poder
        cobrarlo después sin discusión.
      </p>
      <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>

        <div id="pagare-antes" style={MARCO}>
          <CabeceraMovil
            variante={CABECERA.DETALLE}
            titulo="Antes de entregar la plata"
            subtitulo="Léeselo a Deisy y que confirme"
          />
          <div style={{ height: 'calc(100% - 56px)' }}>
            <AntesDeFirmar
              nombre="Deisy"
              recibe="$800.000" medio="en efectivo"
              devuelve="$1.120.000" cadaCuanto="Cada semana" cuota="$140.000"
              confirmado
              condiciones={[
                { etiqueta: 'Primer cobro', valor: 'martes 4 de agosto' },
                { etiqueta: 'Son', valor: '8 cuotas semanales' },
                { etiqueta: 'Si se atrasa', valor: '$5.000 por semana' },
                { etiqueta: 'Le cobra', valor: 'Pepito · Ruta 2' },
              ]}
            />
          </div>
        </div>

        {/* SIN `numero` NI `verificacion`: hoy no existen en el modelo. El banco
            enseña lo que la app puede enseñar, no lo que promete la lamina. */}
        <div id="pagare-firmado" style={MARCO}>
          <CabeceraMovil variante={CABECERA.NINGUNA} />
          <div style={{ height: '100%' }}>
            <PagareFirmado
              negocio="Prestamos Castro" fecha="28 jul 2026"
              cliente="Deisy Ramírez" cedula="43.987.112"
              recibio="$800.000" devuelve="$1.120.000"
              plazoTexto="8 cuotas semanales de $140.000" empieza="4 de agosto de 2026"
              horaFirma="9:44 a. m." prestamista="Carlos Castro"
              firmaCliente="M10 38 C28 12, 42 46, 60 24 S92 8, 110 32 C124 50, 140 18, 158 30 C170 38, 182 22, 194 34"
              firmaPrestamista="M12 34 C30 18, 46 42, 66 28 S96 14, 116 34 C132 48, 150 20, 168 32 C178 38, 188 28, 196 32"
            />
          </div>
        </div>
      </div>

      <h3 style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 14, fontWeight: 600, color: 'var(--cf-ink-2)', margin: '22px 0 8px' }}>
        La firma · la única pantalla horizontal del sistema
      </h3>
      <div id="pagare-firma" style={{
        width: 844, height: 390, position: 'relative', overflow: 'hidden',
        background: 'var(--cf-surface)', border: '1px solid var(--cf-border)', borderRadius: 18,
      }}>
        <Firma
          nombre="Deisy"
          resumen="Pagaré por $800.000 · 8 cuotas de $140.000"
          fecha="28 de julio de 2026" hora="9:44 a. m."
          hayTrazo
        />
      </div>

      <h2 style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)', margin: '34px 0 4px' }}>
        Socios en 1440 · la tabla que se imprime cuando hay discusión
      </h2>
      <p style={{ fontSize: 13, color: 'var(--cf-ink-2)', margin: '0 0 12px', maxWidth: '72ch', lineHeight: 1.5 }}>
        La acción del encabezado no es «nuevo socio»: es <strong>repartir, con la cifra dentro</strong>.
        Crear socios se hace dos veces en la vida. Y las cinco columnas cuadran en el total —
        $2.880.000 − $1.500.000 = $1.380.000.
      </p>
      <div id="socios-1440" style={{
        width: 1440, height: 800, overflow: 'hidden',
        background: 'var(--cf-surface)', border: '1px solid var(--cf-border)', borderRadius: 18,
      }}>
        <SociosEscritorio
          sinRepartir="$1.240.000" desdeCuando="30 de junio"
          socios={[
            { nombre: 'Carlos Andrés', iniciales: 'CA', puso: '$8.000.000', porcentaje: '66,7%',
              haGanado: '$1.980.000', leHasDado: '$1.200.000', leDebes: '$780.000' },
            { nombre: 'Marta Ruiz', iniciales: 'MR', puso: '$4.000.000', porcentaje: '33,3%',
              haGanado: '$900.000', leHasDado: '$300.000', leDebes: '$600.000' },
          ]}
          totales={{ puso: '$12.000.000', porcentaje: '100%', haGanado: '$2.880.000',
                     leHasDado: '$1.500.000', leDebes: '$1.380.000' }}
          desglose={[
            { nombre: 'Carlos Andrés', porcentaje: '66,7%', monto: '$826.667' },
            { nombre: 'Marta Ruiz', porcentaje: '33,3%', monto: '$413.333' },
          ]}
          tuParte={{ socios: '$12M', total: '$27,6M', pctSocios: 43.5 }}
        />
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
        {/* `conectado` y `tema` ya no son props: la barra saca la conexión de
            useOnline() y el tema del proveedor, porque por prop nadie se los
            pasaba y salían siempre «verde» y «claro». `rol` va en crudo a
            propósito, para ver que se traduce. */}
        <BarraLateral nombre="Carlos Castro" rol="owner" iniciales="CC" hayAvisos />
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
