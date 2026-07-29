'use client'

// components/pantallas/Lucas.jsx — turno 43 · 02/03/04, adenda 07 §5-§7.
//
// LA DECISIÓN DE FONDO DEL PAQUETE:
//
//   Lucas contesta con los COMPONENTES DE LA APP, no con párrafos.
//
// Una frase corta arriba, y debajo el MISMO bloque negro que ya existe en la
// pantalla donde ese dato vive. Un chatbot que escribe "tu ROI mensual es del
// 7,8%" obliga a creerle; uno que muestra el bloque real deja ver de dónde sale.
// Y "Ver la pantalla" lleva al sitio donde el dato vive: Lucas no reemplaza la
// app, la navega.
//
// Si la respuesta es una lista, devuelve las MISMAS tarjetas con riel de estado
// de la lista de clientes. Se leen igual, se tocan igual.
//
// EN ESCRITORIO NO ES UNA HOJA QUE TAPA: es una columna de 396px AL LADO. El
// dueño quiere preguntar algo MIENTRAS mira sus números; taparle el panel para
// contestarle le quita el contexto que le da sentido a la respuesta.

import { useState } from 'react'
import { BloqueOscuro, TiraCifras } from '@/components/cf/primitivos'
import TarjetaCliente from '@/components/cf/TarjetaCliente'

const CHISPA = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3A2900"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
    <path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
  </svg>
)

function BotonIcono({ etiqueta, children, onClick }) {
  return (
    <button type="button" aria-label={etiqueta} onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 36, minWidth: 36, height: 36, borderRadius: 11, flex: 'none',
      background: 'none', border: 0, cursor: 'pointer', color: 'var(--cf-ink-3)',
    }}>{children}</button>
  )
}

function Cabecera({ onEditar, onCerrar }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 11, flex: 'none',
      padding: '12px 12px 12px 16px', borderBottom: '1px solid var(--cf-hairline)',
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 38, minWidth: 38, height: 38, borderRadius: 12, flex: 'none',
        background: 'var(--cf-gold)', border: '2px solid var(--cf-gold-light)',
      }}>{CHISPA}</span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: 'block', fontFamily: 'var(--font-space-grotesk), system-ui',
          fontSize: 18, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)', lineHeight: 1.15,
        }}>Lucas</span>
        <span style={{ display: 'block', fontSize: 11, color: 'var(--cf-ink-3)', marginTop: 1 }}>
          sabe todo de tu negocio
        </span>
      </span>

      <BotonIcono etiqueta="Empezar de nuevo" onClick={onEditar}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
        </svg>
      </BotonIcono>
      <BotonIcono etiqueta="Cerrar" onClick={onCerrar}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </BotonIcono>
    </div>
  )
}

/* ── Vacío (turno 43·03) ────────────────────────────────────────────────
   DOS GRUPOS, no uno. La app promete "pídeme que haga algo" y luego solo
   ofrece preguntas, así que el usuario nunca descubre que Lucas ACTÚA.

   Tres preguntas, no cinco: cinco pastillas grises iguales se leen como un
   formulario. Y cada una con su icono, para que no parezcan campos de texto.

   ⚠️ NO va aquí el contador "200 de 200". Doscientos de qué. Un contador de
   cuota en la primera pantalla dice "esto se te va a acabar" antes de que el
   dueño vea para qué sirve. Vive en Plan y pagos, y solo asoma aquí cuando
   queda poco. */
function FilaSugerencia({ icono, texto, whatsapp, destacada, primera, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12, width: '100%', flex: 'none',
      minHeight: 54, padding: '0 15px', cursor: 'pointer', textAlign: 'left',
      background: 'none', border: 0, borderTop: primera ? 0 : '1px solid var(--cf-hairline)',
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 30, minWidth: 30, height: 30, borderRadius: 9, flex: 'none',
        background: whatsapp  ? 'rgba(37,211,102,.13)'
                  : destacada ? 'var(--cf-gold-tint)'
                  : 'var(--cf-fill)',
        color: whatsapp  ? 'var(--cf-whatsapp)'
             : destacada ? 'var(--cf-gold-dark)'
             : 'var(--cf-ink-3)',
      }}>{icono}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)', lineHeight: 1.3 }}>
        {texto}
      </span>
    </button>
  )
}

const ICO = {
  pregunta: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.2 9a3 3 0 015.7 1c0 2-3 3-3 3" /><path d="M12 17h.01" /><circle cx="12" cy="12" r="9" /></svg>,
  gente:    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2" /><path d="M3 20a6 6 0 0112 0M17 5.4a3.2 3.2 0 010 5.4M21 20a5.4 5.4 0 00-2.6-4.6" /></svg>,
  plata:    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="6" width="19" height="13" rx="2.5" /><path d="M2.5 10.5h19" /></svg>,
  whatsapp: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 01-12.6 7.3L3 20.5l1.8-5.2A8.4 8.4 0 1121 11.5z" /></svg>,
  reporte:  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>,
}

function Rotulo({ children }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase',
      color: 'var(--cf-ink-3)', padding: '0 3px', flex: 'none',
    }}>{children}</span>
  )
}

function Grupo({ children }) {
  return (
    <div style={{
      background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
      borderRadius: 'var(--cf-r-card)', overflow: 'hidden', flex: 'none',
    }}>{children}</div>
  )
}

function Vacio({ preguntas = [], acciones = [], onElegir }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '14px 14px 6px' }}>
      <Rotulo>Lo que más te preguntas</Rotulo>
      <Grupo>
        {preguntas.map((p, i) => (
          <FilaSugerencia key={p.texto} icono={ICO[p.icono] ?? ICO.pregunta} texto={p.texto}
            destacada={i === 0} primera={i === 0} onClick={() => onElegir?.(p.texto)} />
        ))}
      </Grupo>

      <span style={{ height: 4, flex: 'none' }} />
      <Rotulo>Cosas que puedo hacer por ti</Rotulo>
      <Grupo>
        {/* La cifra real ("los 13 en mora") es lo que enseña la capacidad. Sin
            ella es una promesa; con ella es una tarea a medio hacer. */}
        {acciones.map((a, i) => (
          <FilaSugerencia key={a.texto} icono={ICO[a.icono] ?? ICO.reporte} texto={a.texto}
            whatsapp={a.icono === 'whatsapp'} destacada={i === 0} primera={i === 0}
            onClick={() => onElegir?.(a.texto)} />
        ))}
      </Grupo>
    </div>
  )
}

/* ── Contestando (turno 43·02) ─────────────────────────────────────────── */

function Burbuja({ children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', flex: 'none' }}>
      <span style={{
        maxWidth: '82%', padding: '10px 14px',
        background: '#15161A', color: '#F3F3F6',
        borderRadius: '16px 16px 4px 16px',
        fontSize: 14, lineHeight: 1.4,
      }}>{children}</span>
    </div>
  )
}

function Chip({ children, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, flex: 'none',
      height: 38, padding: '0 15px', borderRadius: 999, cursor: 'pointer',
      background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
      fontSize: 13, fontWeight: 600, color: 'var(--cf-ink)',
    }}>{children}</button>
  )
}

function Respuesta({ pregunta, frase, bloque, clientes, chips = [], siguientes = [], onElegir, onChip }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13, padding: '14px 14px 6px' }}>
      <Burbuja>{pregunta}</Burbuja>

      {/* Una frase, plana. El párrafo no es la respuesta: es la entrada a ella. */}
      <span style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--cf-ink)', flex: 'none' }}>
        {frase}
      </span>

      {/* El MISMO bloque negro de la pantalla donde ese dato vive. */}
      {bloque && (
        <BloqueOscuro etiqueta={bloque.etiqueta} cifra={bloque.cifra} unidad={bloque.unidad} tono={bloque.tono}>
          {bloque.nota && (
            <span style={{ fontSize: 12.5, color: '#A3A8B2', lineHeight: 1.4, marginTop: -2 }}>
              {bloque.nota}
            </span>
          )}
          {bloque.columnas && (
            <>
              <span style={{ height: 1, background: 'rgba(255,255,255,.09)' }} />
              <TiraCifras columnas={bloque.columnas} sobreOscuro />
            </>
          )}
        </BloqueOscuro>
      )}

      {/* Si la respuesta es una lista, son las MISMAS tarjetas de la lista de
          clientes. Inventar una tarjeta "de chat" obligaría a aprenderla. */}
      {clientes?.map((c, i) => <TarjetaCliente key={i} {...c} />)}

      {chips.length > 0 && (
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', flex: 'none' }}>
          {chips.map((c) => (
            <Chip key={c.texto} onClick={() => onChip?.(c)}>
              {c.pdf && (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v12M7.5 10.5L12 15l4.5-4.5M4 20h16" />
                </svg>
              )}
              {c.texto}
            </Chip>
          ))}
        </div>
      )}

      {/* Las DOS preguntas que siguen a ESA, no las cinco del principio. Quien
          pregunta por su ganancia va a querer saber qué ruta le rinde menos. */}
      {siguientes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 'none', paddingTop: 2 }}>
          {siguientes.map((s) => (
            <button key={s} type="button" onClick={() => onElegir?.(s)} style={{
              display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
              maxWidth: '100%', padding: '9px 13px', borderRadius: 13, cursor: 'pointer',
              background: 'var(--cf-fill)', border: 0, textAlign: 'left',
              fontSize: 13, color: 'var(--cf-ink-2)', lineHeight: 1.35,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-4)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Compositor ────────────────────────────────────────────────────────── */

function Compositor({ escritorio, onEnviar }) {
  const [texto, setTexto] = useState('')
  const listo = texto.trim().length > 0

  return (
    <div style={{ flex: 'none', borderTop: '1px solid var(--cf-hairline)', background: 'var(--cf-card)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9, padding: '11px 12px 8px' }}>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Pregúntale lo que sea"
          style={{
            flex: 1, minWidth: 0, height: 44, padding: '0 15px',
            borderRadius: 999, background: 'var(--cf-fill)',
            border: '1px solid var(--cf-border)',
            fontSize: 16,   // menos de 16 y iOS hace zoom al enfocar
            color: 'var(--cf-ink)', outline: 'none',
          }}
        />
        {/* Un botón dorado sin nada que enviar es una promesa vacía, y rompe la
            regla de un solo dorado por pantalla. Arranca apagado. */}
        <button type="button" aria-label="Enviar" disabled={!listo}
          onClick={() => { onEnviar?.(texto); setTexto('') }}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 44, minWidth: 44, height: 44, borderRadius: 999, flex: 'none',
            cursor: listo ? 'pointer' : 'default',
            background: listo ? 'var(--cf-gold)' : 'var(--cf-fill-2)',
            border: listo ? 0 : '1px solid var(--cf-border)',
            color: listo ? 'var(--cf-gold-ink)' : 'var(--cf-ink-4)',
          }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      {/* "Puede cometer errores" no tranquiliza a nadie que va a decidir sobre
          plata. La segunda frase es la que importa: de dónde salen los números. */}
      <span style={{
        display: 'block', padding: '0 16px 11px', fontSize: 10.5,
        color: 'var(--cf-ink-4)', textAlign: 'center', lineHeight: 1.4,
      }}>
        {escritorio ? 'Los números salen de tu app.' : 'Lucas se puede equivocar. Los números salen de tu app.'}
      </span>
    </div>
  )
}

export default function Lucas({
  escritorio = false,
  respuesta,                       // si viene, se muestra en vez del vacío
  preguntas = [], acciones = [],
  onElegir, onChip, onEnviar, onEditar, onCerrar,
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
      background: 'var(--cf-surface)',
      ...(escritorio ? {
        width: 396, flex: 'none',
        background: 'var(--cf-card)',
        border: '1px solid var(--cf-border)',
        borderRadius: 20,
        boxShadow: 'var(--cf-sh-card)',
      } : null),
    }}>
      <Cabecera onEditar={onEditar} onCerrar={onCerrar} />

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {respuesta
          ? <Respuesta {...respuesta} onElegir={onElegir} onChip={onChip} />
          : <Vacio preguntas={preguntas} acciones={acciones} onElegir={onElegir} />}
      </div>

      <Compositor escritorio={escritorio} onEnviar={onEnviar} />
    </div>
  )
}
