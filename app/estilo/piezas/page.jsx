'use client'

// app/estilo/piezas/page.jsx — banco de las ocho piezas que faltaban.
//
// Separado de /estilo porque ese archivo ya son 1.218 líneas. Acá van solo las
// de primitivos2.jsx, para poder mirarlas sin ruido: la receta de
// 03-COMPONENTES.md dice los valores, pero no dice si se ven bien juntas.

import { useState } from 'react'
import {
  CampoMonto, GrupoSegmentado, TarjetaOpcion, Interruptor, FilaInterruptor,
  BarraPartida, Tabla, PieTabla,
  BarrasVerticales, BarrasComportamiento, BarrasHorizontales,
  Esqueleto, PilaEsqueletos,
} from '@/components/cf/primitivos2'
import { Tarjeta, EtiquetaCampo, AyudaCampo, Pastilla, BloqueOscuro } from '@/components/cf/primitivos'

const H2 = {
  fontFamily: 'var(--font-space-grotesk), system-ui',
  fontSize: 17, fontWeight: 600, letterSpacing: '-.015em',
  color: 'var(--cf-ink)', margin: '0 0 12px',
}
const SECCION = { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 34 }

export default function Piezas() {
  const [monto, setMonto] = useState('850.000')
  const [frecuencia, setFrecuencia] = useState('diario')
  const [modo, setModo] = useState('fijo')
  const [recordar, setRecordar] = useState(true)
  const [wa, setWa] = useState(false)

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--cf-surface)',
      padding: '28px 20px 80px', maxWidth: 980, margin: '0 auto',
      fontFamily: 'var(--font-manrope), system-ui', color: 'var(--cf-ink)',
    }}>
      <h1 style={{
        fontFamily: 'var(--font-space-grotesk), system-ui',
        fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', margin: '0 0 6px',
      }}>Las ocho que faltaban</h1>
      <p style={{ fontSize: 13.5, color: 'var(--cf-ink-3)', margin: '0 0 32px', lineHeight: 1.5 }}>
        03-COMPONENTES.md §6, §7, §8, §9, §12, §15 y §17. Lo que ya estaba vive en{' '}
        <a href="/estilo" style={{ color: 'var(--cf-gold-dark)', fontWeight: 700 }}>/estilo</a>.
      </p>

      {/* ── §6 · Campo de monto ── */}
      <section style={SECCION}>
        <h2 style={H2}>§6 · Campo de monto (héroe)</h2>
        <EtiquetaCampo>Cuánto le vas a prestar</EtiquetaCampo>
        <CampoMonto valor={monto} onCambiar={(e) => setMonto(e.target.value)} />
        <AyudaCampo>Con el 20% mensual, te devuelve $1.020.000 en 20 cuotas de $51.000.</AyudaCampo>
        <div style={{ height: 8 }} />
        <EtiquetaCampo>Sin foco, para comparar</EtiquetaCampo>
        <CampoMonto valor="" foco={false} />
      </section>

      {/* ── §7 · Grupo segmentado ── */}
      <section style={SECCION}>
        <h2 style={H2}>§7 · Grupo segmentado</h2>
        <EtiquetaCampo>Cada cuánto le cobras</EtiquetaCampo>
        <GrupoSegmentado
          valor={frecuencia}
          onElegir={setFrecuencia}
          opciones={[
            { id: 'diario', nombre: 'Diario' },
            { id: 'semanal', nombre: 'Semanal' },
            { id: 'quincenal', nombre: 'Quincenal' },
            { id: 'mensual', nombre: 'Mensual' },
          ]}
        />
      </section>

      {/* ── §7 · Tarjeta de opción ── */}
      <section style={SECCION}>
        <h2 style={H2}>§7 · Tarjeta de opción</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <TarjetaOpcion
            nombre="Cuota fija"
            explicacion="La misma cuota todos los días hasta saldar. Es lo que usa el 55% de los negocios."
            pastilla={<Pastilla tono="aldia">Recomendado</Pastilla>}
            seleccionada={modo === 'fijo'}
            onElegir={() => setModo('fijo')}
          />
          <TarjetaOpcion
            nombre="Sobre saldo"
            explicacion="El interés se calcula sobre lo que queda debiendo. La cuota baja con el tiempo."
            seleccionada={modo === 'saldo'}
            onElegir={() => setModo('saldo')}
          />
        </div>
        <div style={{ height: 6 }} />
        <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>Con radio de 20px:</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <TarjetaOpcion radio nombre="Escribirlos yo" seleccionada={modo === 'yo'} onElegir={() => setModo('yo')} />
          <TarjetaOpcion radio nombre="Foto de la cartulina" seleccionada={modo === 'foto'} onElegir={() => setModo('foto')} />
        </div>
      </section>

      {/* ── §8 · Interruptor ── */}
      <section style={SECCION}>
        <h2 style={H2}>§8 · Interruptor</h2>
        <Tarjeta>
          <FilaInterruptor
            etiqueta="Recordarle el día antes"
            explicacion="Le llega un WhatsApp a las 6 de la tarde del día anterior al cobro."
            encendido={recordar} onCambiar={setRecordar}
          />
          <span style={{ height: 1, background: 'var(--cf-hairline)' }} />
          <FilaInterruptor
            etiqueta="Avisarle cuando se atrase"
            explicacion="Solo a partir del tercer día, para no quemar la confianza."
            encendido={wa} onCambiar={setWa}
          />
        </Tarjeta>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', paddingTop: 4 }}>
          <Interruptor encendido={false} etiqueta="apagado" />
          <Interruptor encendido etiqueta="encendido" />
          <Interruptor encendido disabled etiqueta="deshabilitado" />
        </div>
      </section>

      {/* ── §9 · Barra partida ── */}
      <section style={SECCION}>
        <h2 style={H2}>§9 · Barra partida</h2>
        <Tarjeta>
          <BarraPartida
            alto={9}
            tramos={[
              { etiqueta: 'Capital', valor: 850000, texto: '$850.000' },
              { etiqueta: 'Interés', valor: 170000, texto: '$170.000' },
            ]}
          />
        </Tarjeta>
        <BloqueOscuro etiqueta="De qué está hecha tu cartera" cifra="$25.096.136">
          <BarraPartida
            sobreOscuro alto={13}
            tramos={[
              { etiqueta: 'Capital prestado', valor: 20900000, texto: '$20.9M' },
              { etiqueta: 'Interés por cobrar', valor: 4196136, texto: '$4.2M' },
            ]}
          />
        </BloqueOscuro>
      </section>

      {/* ── §12 · Tabla ── */}
      <section style={SECCION}>
        <h2 style={H2}>§12 · Tabla (escritorio)</h2>
        <Tabla
          columnas={[
            { clave: 'cliente', titulo: 'Cliente' },
            { clave: 'ruta', titulo: 'Ruta', ancho: 130 },
            { clave: 'cuota', titulo: 'Cuota', ancho: 110, cifra: true },
            { clave: 'deuda', titulo: 'Deuda', ancho: 120, cifra: true, fuerte: true },
            { clave: 'atraso', titulo: 'Atraso', ancho: 80, cifra: true, tono: 'contra' },
          ]}
          filas={[
            { id: 1, cliente: 'Ana Milena Guzmán', ruta: 'Ruta sur', cuota: '$33.500', deuda: '$670.000', atraso: '35d' },
            { id: 2, cliente: 'Carlitos Chaparro', ruta: 'Bolivariana', cuota: '$27.700', deuda: '$553.658', atraso: '20d' },
            { id: 3, cliente: 'Jhoan Sebastián Cruz', ruta: 'Ruta sur', cuota: '$17.500', deuda: '$350.000', atraso: '21d', seleccionada: true },
          ]}
          total={{ cliente: 'Total', cuota: '$78.700', deuda: '$1.573.658' }}
          pie={<PieTabla visibles={3} deTotal={17} faltanMonto="$4.826.336" onVerTodos={() => {}} />}
        />
      </section>

      {/* ── §15 · Gráficos ── */}
      <section style={SECCION}>
        <h2 style={H2}>§15 · Gráficos (sin librería, todo divs)</h2>
        <Tarjeta>
          <EtiquetaCampo>Recaudado por día</EtiquetaCampo>
          <BarrasVerticales
            alto={116}
            barras={[
              { etiqueta: 'lun', valor: 79000 }, { etiqueta: 'mar', valor: 124000 },
              { etiqueta: 'mié', valor: 61000 }, { etiqueta: 'jue', valor: 143000, tono: 'ok' },
              { etiqueta: 'vie', valor: 98000 }, { etiqueta: 'sáb', valor: 32000 },
              { etiqueta: 'dom', valor: 0, tono: 'inactiva' },
            ]}
          />
        </Tarjeta>
        <Tarjeta>
          <EtiquetaCampo>Cómo ha pagado este cliente</EtiquetaCampo>
          <BarrasComportamiento
            frase="Pagaba tarde pero cerraba el mes. Desde mayo viene fallando."
            meses={[
              { nombre: 'ago', resultado: 'bien' }, { nombre: 'sep', resultado: 'bien' },
              { nombre: 'oct', resultado: 'tarde' }, { nombre: 'nov', resultado: 'bien' },
              { nombre: 'dic', resultado: 'tarde' }, { nombre: 'ene', resultado: 'bien' },
              { nombre: 'feb', resultado: 'tarde' }, { nombre: 'mar', resultado: 'bien' },
              { nombre: 'abr', resultado: 'tarde' }, { nombre: 'may', resultado: 'no' },
              { nombre: 'jun', resultado: 'no' }, { nombre: 'jul', resultado: 'no' },
            ]}
          />
        </Tarjeta>
        <Tarjeta>
          <EtiquetaCampo>Qué ruta recauda más</EtiquetaCampo>
          <BarrasHorizontales
            filas={[
              { nombre: 'Bolivariana', valor: 1240000, texto: '$1.240.000', tono: 'ok' },
              { nombre: 'Ruta sur', valor: 860000, texto: '$860.000' },
              { nombre: 'Centro', valor: 310000, texto: '$310.000', tono: 'mal' },
            ]}
          />
        </Tarjeta>
      </section>

      {/* ── §17 · Esqueleto ── */}
      <section style={SECCION}>
        <h2 style={H2}>§17 · Esqueleto de carga</h2>
        <PilaEsqueletos cuantos={3} />
        <div style={{ height: 6 }} />
        <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>
          Bloques sueltos, dentro de una tarjeta blanca — que es el único sitio donde
          se ven: sobre la superficie hueso, el gris del esqueleto es casi el mismo color.
        </span>
        <Tarjeta>
          <div style={{ display: 'flex', gap: 10 }}>
            <Esqueleto alto={56} style={{ flex: 1 }} radio="var(--cf-r-control)" />
            <Esqueleto alto={56} style={{ width: 90 }} radio="var(--cf-r-control)" />
          </div>
        </Tarjeta>
      </section>
    </div>
  )
}
