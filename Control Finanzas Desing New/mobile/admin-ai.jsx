// Mobile ADMIN — IA y análisis
const iS = window.aS || {
  bg: '#0a0a0a', surface: '#141414', surface2: '#1a1a1a', border: '#1f1f1f',
  text: '#fafafa', text2: '#a1a1a1', text3: '#6b6b6b',
  accent: '#d4ff3a', danger: '#f87171', success: '#4ade80', warning: '#fbbf24', info:'#60a5fa',
  font: "'Geist', system-ui, sans-serif",
  fontMono: "'Geist Mono', monospace",
  fontSerif: "'Instrument Serif', serif",
};
const iI = window.Icons;
const iM = window.MOCK;

const IScreen = ({ children, style }) => (
  <div style={{background: iS.bg, color: iS.text, minHeight:'100%', fontFamily: iS.font, fontSize:14, letterSpacing:'-0.005em', paddingTop:54, ...style}}>{children}</div>
);
const ITop = ({ title, sub, left, right }) => (
  <div style={{padding:'8px 20px 14px', display:'flex', alignItems:'center', gap:12, position:'sticky', top:54, background:iS.bg, zIndex:5}}>
    {left}
    <div style={{flex:1, minWidth:0}}>
      {title && <div style={{fontFamily:iS.fontSerif, fontSize:28, lineHeight:1.05, letterSpacing:'-0.015em'}}>{title}</div>}
      {sub && <div style={{fontSize:12, color:iS.text3, marginTop:3}}>{sub}</div>}
    </div>
    {right}
  </div>
);
const IIco = ({ children, accent }) => (
  <button style={{width:38, height:38, borderRadius:10, border:'1px solid '+iS.border, background: accent?iS.accent:iS.surface, color: accent?'#000':iS.text2, display:'grid', placeItems:'center'}}>{children}</button>
);

// ===== 9. IA INSIGHTS — Feed de inteligencia =====
const AdminAIInsights = () => (
  <IScreen>
    <ITop title={<>Centro de <span style={{color: iS.accent, fontStyle:'italic'}}>inteligencia</span></>} sub="14 insights nuevos · actualizado hace 12 min" right={<IIco><iI.Filter size={16}/></IIco>}/>
    <div style={{padding:'0 18px 110px'}}>
      {/* Highlight insight */}
      <div style={{background:'linear-gradient(135deg, rgba(212,255,58,0.15), '+iS.surface+')', border:'1px solid rgba(212,255,58,0.3)', borderRadius:20, padding:'20px 22px', marginBottom: 14, position:'relative', overflow:'hidden'}}>
        <div style={{position:'absolute', top:-40, right:-40, width:160, height:160, borderRadius:'50%', background:'radial-gradient(circle, rgba(212,255,58,0.15), transparent 70%)'}}></div>
        <div style={{display:'flex', gap:6, alignItems:'center', marginBottom:8}}>
          <iI.Sparkles size={14} stroke={iS.accent}/>
          <span style={{fontFamily: iS.fontMono, fontSize:10, color: iS.accent, letterSpacing:'0.08em'}}>INSIGHT DEL DÍA</span>
        </div>
        <div style={{fontFamily: iS.fontSerif, fontSize:30, lineHeight:1.15, letterSpacing:'-0.015em'}}>
          Tu cartera podría crecer <span style={{color: iS.accent, fontStyle:'italic'}}>$84M</span> este mes si activas a tus <span style={{color: iS.accent, fontStyle:'italic'}}>23 graduados</span>.
        </div>
        <div style={{fontSize:13, color: iS.text3, marginTop:10, lineHeight:1.5}}>
          23 clientes terminaron su préstamo y no tomaron uno nuevo. Tienen score promedio 786 — la IA puede armar campaña automática de pre-aprobación.
        </div>
        <div style={{display:'flex', gap:8, marginTop:14}}>
          <button style={{padding:'9px 14px', borderRadius:10, background: iS.accent, color:'#000', border:'none', fontSize:13, fontWeight:500}}>Ver lista</button>
          <button style={{padding:'9px 14px', borderRadius:10, background: iS.surface2, border:'1px solid '+iS.border, color: iS.text, fontSize:13}}>Crear campaña</button>
        </div>
      </div>

      {/* Categories */}
      <div style={{display:'flex', gap:8, marginBottom:14, overflowX:'auto', paddingBottom:4}}>
        {[
          { l:'Todos', n:14, sel:true },
          { l:'Oportunidades', n:5 },
          { l:'Alertas', n:3 },
          { l:'Optimización', n:4 },
          { l:'Riesgo', n:2 },
        ].map(c => (
          <div key={c.l} style={{
            padding:'6px 12px', borderRadius:999, whiteSpace:'nowrap',
            background: c.sel?'rgba(212,255,58,0.1)':iS.surface,
            border:'1px solid '+(c.sel?iS.accent:iS.border),
            color: c.sel?iS.accent:iS.text2,
            fontSize:12, display:'flex', gap:6, alignItems:'center'
          }}>
            <span>{c.l}</span>
            <span style={{fontFamily: iS.fontMono, fontSize:10, color: c.sel?iS.accent:iS.text3}}>{c.n}</span>
          </div>
        ))}
      </div>

      {/* Insights list */}
      {[
        { tag:'ALERTA', tc: iS.danger, t:'Mora concentrada en Centro', d:'4 clientes acumulan 60+ días. Juan Salazar debe priorizar esta semana.', act:'Asignar gestión' },
        { tag:'OPORTUNIDAD', tc: iS.accent, t:'Carlos Mendoza listo para más', d:'Cliente premium · 92% puntual · capacidad sobrada para $15M adicionales.', act:'Pre-aprobar' },
        { tag:'OPTIMIZACIÓN', tc: iS.info, t:'Rutas Norte y Centro desbalanceadas', d:'Reasignar 14 clientes mejora efectividad 8% y ahorra 22% en combustible.', act:'Ver propuesta' },
        { tag:'PATRÓN', tc:'#a78bfa', t:'Lunes son más rentables', d:'Recaudo de lunes es 28% mayor que viernes. Considera mover desembolsos.', act:'Ajustar política' },
        { tag:'RIESGO', tc: iS.warning, t:'Score de Diana Castaño bajando', d:'Pasó de 712 a 612 en 2 meses. Próxima cuota probablemente caerá en mora.', act:'Llamada preventiva' },
        { tag:'OPORTUNIDAD', tc: iS.accent, t:'Mercancía: lavadoras 2x rotación', d:'Las lavadoras se venden el doble que neveras. Aumentar inventario.', act:'Hacer pedido' },
      ].map((ins,i) => (
        <div key={i} style={{background: iS.surface, border:'1px solid '+iS.border, borderRadius:14, padding:'14px 16px', marginBottom:10, display:'flex', gap:12, alignItems:'flex-start'}}>
          <div style={{width:6, alignSelf:'stretch', background: ins.tc, borderRadius:3, flexShrink:0}}></div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
              <span style={{fontFamily: iS.fontMono, fontSize:10, color: ins.tc, letterSpacing:'0.08em'}}>{ins.tag}</span>
              <iI.More size={14} stroke={iS.text3}/>
            </div>
            <div style={{fontSize:14, marginTop:4, lineHeight:1.3}}>{ins.t}</div>
            <div style={{fontSize:12, color: iS.text3, marginTop:4, lineHeight:1.45}}>{ins.d}</div>
            <button style={{marginTop:10, padding:'5px 10px', borderRadius:6, background: iS.surface2, border:'1px solid '+iS.border, color: iS.text2, fontSize:11.5}}>{ins.act} →</button>
          </div>
        </div>
      ))}
    </div>
  </IScreen>
);

// ===== 10. IA ASISTENTE — Chat =====
const AdminAIChat = () => {
  const chips = ['¿Cuál es mi recaudo hoy?', 'Top 5 clientes en mora', 'Proyección de junio', 'Quién me debe más', 'Generar reporte semanal'];
  const messages = [
    { who:'user', t:'¿Quién está en mora más alta?' },
    { who:'ai', t:'Esta es la mora más crítica:', table:[
      ['Jorge Hincapié', '67d', '$ 1.84M'],
      ['Lina Cifuentes', '88d', '$ 3.20M'],
      ['Esperanza Gil', '41d', '$ 5.46M'],
    ]},
    { who:'ai', t:'Lina es la más urgente — la IA recomienda iniciar proceso jurídico esta semana.' },
    { who:'user', t:'Genérame un mensaje de WhatsApp para Esperanza' },
    { who:'ai', t:'Listo. Tono firme pero respetuoso:', message:'Hola Esperanza, soy Diana de Préstamos Andina. Tu cuota de $540.000 lleva 41 días vencida. Si pagas esta semana, podemos evitar reportar a centrales. ¿Cuándo podrías ponerte al día?' },
  ];

  return (
    <IScreen>
      <ITop
        left={<IIco><iI.Chevron size={16} style={{transform:'rotate(180deg)'}}/></IIco>}
        title={<>Asistente <span style={{color: iS.accent, fontStyle:'italic'}}>Cartera</span></>}
        sub="IA con acceso a tus datos · respuesta instantánea"
      />
      <div style={{padding:'8px 18px 120px', display:'flex', flexDirection:'column', gap:12}}>
        {messages.map((m,i) => (
          m.who === 'user' ? (
            <div key={i} style={{alignSelf:'flex-end', maxWidth:'80%', background: iS.surface2, border:'1px solid '+iS.border, borderRadius:'18px 18px 4px 18px', padding:'10px 14px', fontSize:13.5}}>{m.t}</div>
          ) : (
            <div key={i} style={{alignSelf:'flex-start', maxWidth:'92%', display:'flex', gap:10}}>
              <div style={{width:30, height:30, borderRadius:10, background: iS.accent, color:'#000', display:'grid', placeItems:'center', flexShrink:0}}>
                <iI.Sparkles size={14}/>
              </div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{background: iS.surface, border:'1px solid '+iS.border, borderRadius:'18px 18px 18px 4px', padding:'12px 14px'}}>
                  <div style={{fontSize:13.5, lineHeight:1.45}}>{m.t}</div>
                  {m.table && (
                    <div style={{marginTop:10, background: iS.bg, borderRadius:8, padding:'4px 10px'}}>
                      {m.table.map((row,j,arr) => (
                        <div key={j} style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom: j<arr.length-1?'1px solid '+iS.border:'none', fontSize:12.5}}>
                          <span>{row[0]}</span>
                          <span style={{display:'flex', gap:14, alignItems:'baseline'}}>
                            <span style={{color: iS.danger, fontFamily: iS.fontMono, fontSize:11}}>{row[1]}</span>
                            <span style={{fontFamily: iS.fontMono}}>{row[2]}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {m.message && (
                    <div style={{marginTop:10, padding:'10px 12px', background: iS.bg, borderRadius:8, border:'1px dashed '+iS.border, fontSize:12.5, color: iS.text2, fontStyle:'italic'}}>
                      "{m.message}"
                    </div>
                  )}
                </div>
                {m.message && (
                  <div style={{display:'flex', gap:6, marginTop:8}}>
                    <button style={{padding:'5px 10px', borderRadius:6, background: iS.accent, color:'#000', border:'none', fontSize:11, fontWeight:500}}>Enviar a Esperanza</button>
                    <button style={{padding:'5px 10px', borderRadius:6, background: iS.surface, border:'1px solid '+iS.border, color: iS.text2, fontSize:11}}>Editar</button>
                    <button style={{padding:'5px 10px', borderRadius:6, background: iS.surface, border:'1px solid '+iS.border, color: iS.text2, fontSize:11}}>Otro tono</button>
                  </div>
                )}
              </div>
            </div>
          )
        ))}
      </div>

      {/* Input */}
      <div style={{position:'absolute', bottom:0, left:0, right:0, padding:'10px 14px 30px', background:'rgba(10,10,10,0.95)', backdropFilter:'blur(12px)', borderTop:'1px solid '+iS.border}}>
        <div style={{display:'flex', gap:8, marginBottom:10, overflowX:'auto', paddingBottom:2}}>
          {chips.map(c => (
            <div key={c} style={{padding:'5px 10px', borderRadius:999, background: iS.surface, border:'1px solid '+iS.border, color: iS.text2, fontSize:11.5, whiteSpace:'nowrap'}}>{c}</div>
          ))}
        </div>
        <div style={{display:'flex', gap:8, alignItems:'center', background: iS.surface, border:'1px solid '+iS.border, borderRadius:14, padding:'8px 10px 8px 14px'}}>
          <input placeholder="Pregúntale a la IA sobre tu negocio…" style={{flex:1, background:'none', border:'none', outline:'none', color: iS.text, fontSize:13, fontFamily: iS.font}}/>
          <button style={{width:34, height:34, borderRadius:10, background: iS.accent, color:'#000', border:'none', display:'grid', placeItems:'center'}}>
            <iI.ArrowUp size={16}/>
          </button>
        </div>
      </div>
    </IScreen>
  );
};

// ===== 11. REPORTES MOBILE =====
const AdminReports = () => (
  <IScreen>
    <ITop title="Reportes" sub="Mayo 2026 · análisis ejecutivo" right={<IIco><iI.Download size={16}/></IIco>}/>
    <div style={{padding:'0 18px 110px'}}>
      {/* Hero — P&L del mes */}
      <div style={{background: iS.surface, border:'1px solid '+iS.border, borderRadius:18, padding:18, marginBottom:14}}>
        <div style={{fontFamily: iS.fontMono, fontSize:10, color: iS.text3, letterSpacing:'0.08em'}}>UTILIDAD NETA · MAYO</div>
        <div style={{fontFamily: iS.fontSerif, fontSize:46, lineHeight:1, marginTop:6, color: iS.accent, letterSpacing:'-0.02em'}}>
          <span style={{fontFamily: iS.fontMono, fontSize:14, color: iS.text3, verticalAlign:8}}>$</span>62<span style={{color: iS.text3, fontSize:24}}>.420.000</span>
        </div>
        <div style={{display:'flex', gap:6, alignItems:'center', marginTop:6}}>
          <span style={{color: iS.success, fontSize:13, fontFamily: iS.fontMono}}>↑ +18.4%</span>
          <span style={{color: iS.text3, fontSize:12}}>vs abril · margen 22%</span>
        </div>
        <div style={{height:1, background: iS.border, margin:'16px 0'}}></div>
        <div style={{display:'flex', justifyContent:'space-between', fontSize:12}}>
          <div><div style={{color: iS.text3}}>Ingresos</div><div style={{fontFamily: iS.fontMono, marginTop:3}}>$ 284M</div></div>
          <div><div style={{color: iS.text3}}>Gastos</div><div style={{fontFamily: iS.fontMono, marginTop:3, color: iS.danger}}>− $ 28M</div></div>
          <div><div style={{color: iS.text3}}>Provisiones</div><div style={{fontFamily: iS.fontMono, marginTop:3, color: iS.danger}}>− $ 11M</div></div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex', gap:0, borderBottom:'1px solid '+iS.border, marginBottom:14}}>
        {['Cartera','Mora','Rentabilidad','Cohortes'].map((t,i) => (
          <div key={t} style={{padding:'8px 12px 10px', fontSize:13, color: i===0?iS.text:iS.text3, borderBottom: i===0?'1px solid '+iS.accent:'1px solid transparent', marginBottom:'-1px'}}>{t}</div>
        ))}
      </div>

      {/* Cartera evolution */}
      <div style={{background: iS.surface, border:'1px solid '+iS.border, borderRadius:14, padding:16, marginBottom:14}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10}}>
          <div>
            <div style={{fontFamily: iS.fontMono, fontSize:10, color: iS.text3, letterSpacing:'0.08em'}}>CARTERA ACTIVA</div>
            <div style={{fontFamily: iS.fontSerif, fontSize:24, marginTop:4}}>$ 1.842M</div>
          </div>
          <span style={{color: iS.success, fontSize:12, fontFamily: iS.fontMono}}>+24% YTD</span>
        </div>
        <svg width="100%" height="100" viewBox="0 0 320 100" preserveAspectRatio="none">
          {[20,40,60,80].map(y => <line key={y} x1="0" x2="320" y1={y} y2={y} stroke={iS.border} strokeWidth="0.5" strokeDasharray="2 3"/>)}
          <path d="M0 75 L 30 70 L 60 68 L 90 62 L 120 55 L 150 48 L 180 42 L 210 35 L 240 28 L 270 22 L 320 18"
                stroke={iS.accent} strokeWidth="2" fill="none"/>
          <circle cx="320" cy="18" r="3.5" fill={iS.accent}/>
        </svg>
        <div style={{display:'flex', justifyContent:'space-between', marginTop:8, fontSize:10, color: iS.text3, fontFamily: iS.fontMono}}>
          <span>jun</span><span>ago</span><span>oct</span><span>dic</span><span>feb</span><span>may</span>
        </div>
      </div>

      {/* KPI grid */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14}}>
        {[
          { l:'NUEVOS CLIENTES', v:'42', s:'+12 vs abril', c: iS.success },
          { l:'PRÉSTAMOS DESEMB.', v:'58', s:'$ 218M', c: iS.text },
          { l:'TASA DE MORA', v:'5.8%', s:'+0.6 pts', c: iS.warning },
          { l:'RECUPERACIÓN', v:'74%', s:'de mora total', c: iS.accent },
        ].map(k => (
          <div key={k.l} style={{background: iS.surface, border:'1px solid '+iS.border, borderRadius:12, padding:14}}>
            <div style={{fontFamily: iS.fontMono, fontSize:9.5, color: iS.text3, letterSpacing:'0.06em'}}>{k.l}</div>
            <div style={{fontFamily: iS.fontSerif, fontSize:22, marginTop:6, color: k.c}}>{k.v}</div>
            <div style={{fontSize:11, color: iS.text3, marginTop:2}}>{k.s}</div>
          </div>
        ))}
      </div>

      {/* Aging */}
      <div style={{fontSize:11, color: iS.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontFamily: iS.fontMono}}>AGING DE CARTERA</div>
      <div style={{background: iS.surface, border:'1px solid '+iS.border, borderRadius:14, padding:14, marginBottom:14}}>
        <div style={{display:'flex', gap:6, alignItems:'flex-end', height:80}}>
          {[
            { l:'Al día', v:62, c: iS.accent },
            { l:'1-15', v:18, c:'#a3e635' },
            { l:'16-30', v:10, c: iS.warning },
            { l:'31-60', v:6, c:'#fb923c' },
            { l:'61-90', v:3, c: iS.danger },
            { l:'90+', v:1, c:'#dc2626' },
          ].map(b => (
            <div key={b.l} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4}}>
              <div style={{fontFamily: iS.fontMono, fontSize:10, color: iS.text2}}>{b.v}%</div>
              <div style={{width:'100%', height: b.v*1.1, background: b.c, borderRadius:'2px 2px 0 0', minHeight:3}}></div>
              <div style={{fontSize:9.5, color: iS.text3, fontFamily: iS.fontMono}}>{b.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* IA resumen */}
      <div style={{background:'rgba(212,255,58,0.05)', border:'1px solid rgba(212,255,58,0.2)', borderRadius:14, padding:'14px 16px', display:'flex', gap:12}}>
        <iI.Sparkles size={16} stroke={iS.accent}/>
        <div style={{fontSize:12.5, color: iS.text2}}>
          <strong style={{color: iS.text}}>Mes positivo.</strong> Cartera creció 8% y la mora se mantuvo bajo 6%. Para junio, proyecto utilidad de <strong style={{color: iS.accent}}>$74M</strong> si mantienes ritmo.
        </div>
      </div>
    </div>
  </IScreen>
);

// ===== 12. CASHFLOW MOBILE =====
const AdminCashflowMob = () => (
  <IScreen>
    <ITop title={<>Flujo <span style={{color: iS.accent, fontStyle:'italic'}}>proyectado</span></>} sub="Próximos 14 días · 442 cuotas"/>
    <div style={{padding:'0 18px 110px'}}>
      {/* Net hero */}
      <div style={{background: iS.surface, border:'1px solid '+iS.border, borderRadius:18, padding:18, marginBottom: 14}}>
        <div style={{fontFamily: iS.fontMono, fontSize:10, color: iS.text3, letterSpacing:'0.08em'}}>FLUJO NETO 14 DÍAS</div>
        <div style={{fontFamily: iS.fontSerif, fontSize:46, lineHeight:1, marginTop:6, color: iS.accent, letterSpacing:'-0.02em'}}>
          + $ 381M
        </div>
        <div style={{display:'flex', gap:14, marginTop:14}}>
          <div>
            <div style={{fontSize:11, color: iS.text3}}>Entradas</div>
            <div style={{fontFamily: iS.fontMono, fontSize:13, marginTop:2, color: iS.success}}>+ $ 521M</div>
          </div>
          <div>
            <div style={{fontSize:11, color: iS.text3}}>Salidas</div>
            <div style={{fontFamily: iS.fontMono, fontSize:13, marginTop:2, color: iS.danger}}>− $ 140M</div>
          </div>
          <div style={{marginLeft:'auto', textAlign:'right'}}>
            <div style={{fontSize:11, color: iS.text3}}>Confianza</div>
            <div style={{fontFamily: iS.fontMono, fontSize:13, marginTop:2}}>87%</div>
          </div>
        </div>
      </div>

      {/* Bar chart */}
      <div style={{background: iS.surface, border:'1px solid '+iS.border, borderRadius:14, padding:18, marginBottom:14}}>
        <div style={{display:'flex', justifyContent:'space-between', marginBottom:14, fontSize:11.5}}>
          <div style={{display:'flex', gap:14}}>
            <span><span style={{display:'inline-block', width:8, height:8, background: iS.accent, marginRight:5, borderRadius:1}}></span>In</span>
            <span><span style={{display:'inline-block', width:8, height:8, background:'#3a3a3a', marginRight:5, borderRadius:1}}></span>Out</span>
          </div>
          <span style={{color: iS.text3, fontFamily: iS.fontMono, fontSize:11}}>26 may → 08 jun</span>
        </div>
        <div style={{display:'flex', gap:3, alignItems:'flex-end', height:130}}>
          {iM.CASHFLOW_14D.map((d,i) => (
            <div key={i} style={{flex:1, display:'flex', flexDirection:'column', gap:3, alignItems:'center'}}>
              <div style={{width:'100%', display:'flex', gap:1, height:108, alignItems:'flex-end'}}>
                <div style={{flex:1, height: d.inflow * 1.6, background: iS.accent, borderRadius:1, minHeight:1}}></div>
                <div style={{flex:1, height: d.outflow * 1.6, background:'#3a3a3a', borderRadius:1, minHeight:1}}></div>
              </div>
              <div style={{fontSize:9, color: iS.text3, fontFamily: iS.fontMono}}>{d.date}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Escenarios */}
      <div style={{fontSize:11, color: iS.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontFamily: iS.fontMono}}>ESCENARIOS</div>
      <div style={{background: iS.surface, border:'1px solid '+iS.border, borderRadius:14, padding:'4px 16px', marginBottom: 14}}>
        {[
          { n:'Base · actual', sub:'Tasa recaudo 96.1%', net:'+ $381M', sel:true, c: iS.accent },
          { n:'Pesimista', sub:'Si cae a 88%', net:'+ $298M', c: iS.warning },
          { n:'Optimista', sub:'Cobro proactivo Centro', net:'+ $424M', c: iS.success },
        ].map((s,i,a) => (
          <div key={s.n} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', borderBottom: i<a.length-1?'1px solid '+iS.border:'none'}}>
            <div style={{display:'flex', gap:10, alignItems:'center'}}>
              <span style={{width:10, height:10, borderRadius:'50%', background: s.sel?s.c:iS.surface2, border:'1px solid '+(s.sel?s.c:iS.border)}}></span>
              <div>
                <div style={{fontSize:13.5}}>{s.n}</div>
                <div style={{fontSize:11, color: iS.text3, marginTop:2}}>{s.sub}</div>
              </div>
            </div>
            <span style={{fontFamily: iS.fontMono, fontSize:13, color: s.c}}>{s.net}</span>
          </div>
        ))}
      </div>

      {/* IA optimization */}
      <div style={{background:'rgba(212,255,58,0.05)', border:'1px solid rgba(212,255,58,0.2)', borderRadius:14, padding:'14px 16px', display:'flex', gap:12}}>
        <iI.Sparkles size={16} stroke={iS.accent}/>
        <div style={{flex:1, fontSize:12.5, color: iS.text2}}>
          <strong style={{color: iS.text}}>Vie 30 pico:</strong> $51M entrarán. Considera no programar desembolsos grandes ese día — la caja estará al tope.
        </div>
      </div>
    </div>
  </IScreen>
);

window.ADM3 = { AdminAIInsights, AdminAIChat, AdminReports, AdminCashflowMob };
