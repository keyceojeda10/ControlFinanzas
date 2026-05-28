// Mobile ADMIN — prestamista / dueño del negocio
// Vista de gestión: caja, gastos, capital, cobradores, rutas, IA, aprobaciones

const aS = {
  bg: '#0a0a0a', surface: '#141414', surface2: '#1a1a1a',
  border: '#1f1f1f', text: '#fafafa', text2: '#a1a1a1', text3: '#6b6b6b',
  accent: '#d4ff3a', danger: '#f87171', success: '#4ade80', warning: '#fbbf24', info:'#60a5fa',
  font: "'Geist', system-ui, sans-serif",
  fontMono: "'Geist Mono', monospace",
  fontSerif: "'Instrument Serif', serif",
};

const aI = window.Icons;
const aM = window.MOCK;

// ===== Shared =====
const AScreen = ({ children, style }) => (
  <div style={{background: aS.bg, color: aS.text, minHeight:'100%', fontFamily: aS.font, fontSize: 14, letterSpacing:'-0.005em', paddingTop: 54, ...style}}>{children}</div>
);

const ATop = ({ title, sub, left, right }) => (
  <div style={{padding:'8px 20px 14px', display:'flex', alignItems:'center', gap:12, position:'sticky', top:54, background:aS.bg, zIndex:5}}>
    {left}
    <div style={{flex:1, minWidth:0}}>
      {title && <div style={{fontFamily:aS.fontSerif, fontSize:28, lineHeight:1.05, letterSpacing:'-0.015em'}}>{title}</div>}
      {sub && <div style={{fontSize:12, color:aS.text3, marginTop:3}}>{sub}</div>}
    </div>
    {right}
  </div>
);

const AIcoBtn = ({ children, accent }) => (
  <button style={{width:38, height:38, borderRadius:10, border:'1px solid '+aS.border, background: accent?aS.accent:aS.surface, color: accent?'#000':aS.text2, display:'grid', placeItems:'center', cursor:'pointer'}}>{children}</button>
);

const ABottomNav = ({ tab }) => {
  const items = [
    { id:'home', label:'Inicio', icon: <aI.Dashboard size={20}/> },
    { id:'caja', label:'Caja', icon: <aI.Bank size={20}/> },
    { id:'team', label:'Equipo', icon: <aI.Route size={20}/> },
    { id:'ai', label:'IA', icon: <aI.Sparkles size={20}/> },
    { id:'more', label:'Más', icon: <aI.More size={20}/> },
  ];
  return (
    <div style={{position:'absolute', bottom:0, left:0, right:0, paddingBottom:30, paddingTop:8, background:'rgba(10,10,10,0.92)', backdropFilter:'blur(20px)', borderTop:'1px solid '+aS.border, display:'flex', justifyContent:'space-around', zIndex:20}}>
      {items.map(it => (
        <button key={it.id} style={{background:'none', border:'none', cursor:'pointer', color: tab===it.id ? aS.accent : aS.text3, display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'6px 10px'}}>
          {it.icon}
          <span style={{fontSize:10, fontFamily: aS.font}}>{it.label}</span>
        </button>
      ))}
    </div>
  );
};

// ===== 1. ADMIN HOME — Pulso del negocio =====
const AdminHome = () => (
  <AScreen>
    <ATop
      title={<>Buen día, <span style={{color: aS.accent, fontStyle:'italic'}}>Diana</span></>}
      sub="Préstamos Andina · sábado 24 mayo"
      right={
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <AIcoBtn><aI.Bell size={16}/></AIcoBtn>
          <div style={{width:38, height:38, borderRadius:'50%', background:'linear-gradient(135deg, #d4ff3a, #4ade80)', display:'grid', placeItems:'center', color:'#000', fontFamily: aS.fontMono, fontSize:12, fontWeight:600}}>DM</div>
        </div>
      }
    />

    <div style={{padding:'0 18px 110px'}}>
      {/* Hero — Patrimonio neto */}
      <div style={{background:'linear-gradient(180deg, '+aS.surface+', '+aS.bg+')', border:'1px solid '+aS.border, borderRadius:18, padding:'18px 20px', marginBottom:14, position:'relative', overflow:'hidden'}}>
        <div style={{position:'absolute', top:-30, right:-30, width:140, height:140, borderRadius:'50%', background:'radial-gradient(circle, rgba(212,255,58,0.1), transparent 70%)'}}></div>
        <div style={{fontFamily: aS.fontMono, fontSize:10, color: aS.text3, letterSpacing:'0.08em'}}>PATRIMONIO TOTAL</div>
        <div style={{fontFamily: aS.fontSerif, fontSize:46, lineHeight:1, marginTop:6, letterSpacing:'-0.02em'}}>
          <span style={{fontFamily: aS.fontMono, fontSize:14, color: aS.text3, verticalAlign:8}}>$</span>2.286<span style={{color: aS.text3, fontSize:24}}>M</span>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:6, marginTop:6}}>
          <span style={{color: aS.success, fontSize:13, fontFamily: aS.fontMono}}>↑ +8.2%</span>
          <span style={{color: aS.text3, fontSize:12}}>vs mes anterior</span>
        </div>

        {/* Composición */}
        <div style={{display:'flex', gap:1, height:6, marginTop:16, borderRadius:3, overflow:'hidden'}}>
          <div style={{flex:62, background: aS.accent}}></div>
          <div style={{flex:18, background: aS.info}}></div>
          <div style={{flex:14, background: aS.warning}}></div>
          <div style={{flex:6, background: aS.danger}}></div>
        </div>
        <div style={{display:'flex', justifyContent:'space-between', marginTop:8, fontSize:11, fontFamily: aS.fontMono}}>
          <span><span style={{color: aS.accent}}>●</span> Cartera 62%</span>
          <span><span style={{color: aS.info}}>●</span> Caja 18%</span>
          <span><span style={{color: aS.warning}}>●</span> Mercancía 14%</span>
        </div>
      </div>

      {/* IA banner */}
      <div style={{background:'rgba(212,255,58,0.05)', border:'1px solid rgba(212,255,58,0.2)', borderRadius:14, padding:'14px 16px', marginBottom: 14, display:'flex', gap:12, alignItems:'flex-start'}}>
        <div style={{width:32, height:32, borderRadius:8, background: aS.accent, color:'#000', display:'grid', placeItems:'center', flexShrink:0}}>
          <aI.Sparkles size={16}/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontFamily: aS.fontMono, fontSize:10, color: aS.accent, letterSpacing:'0.08em'}}>RESUMEN IA</div>
          <div style={{fontSize:13, color: aS.text, marginTop:4, lineHeight:1.4}}>
            Semana sólida. Recaudo <strong>+12%</strong>, mora estable. <strong>3 oportunidades</strong> de pre-aprobación detectadas hoy.
          </div>
          <div style={{display:'flex', gap:8, marginTop:10}}>
            <button style={{padding:'6px 12px', borderRadius:8, background: aS.accent, color:'#000', border:'none', fontSize:12, fontWeight:500}}>Ver detalle</button>
            <button style={{padding:'6px 12px', borderRadius:8, background:'transparent', color: aS.text2, border:'1px solid '+aS.border, fontSize:12}}>Chat con IA</button>
          </div>
        </div>
      </div>

      {/* Métricas clave 2x2 */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom: 14}}>
        {[
          { l:'CARTERA ACTIVA', v:'$1.842M', d:'+4.2%', c: aS.success, ic:'Receipt' },
          { l:'RECAUDO HOY', v:'$38.4M', d:'87% meta', c: aS.accent, ic:'Tx' },
          { l:'EN MORA', v:'$184M', d:'5.8% cartera', c: aS.warning, ic:'Bell' },
          { l:'GASTOS MES', v:'$28.2M', d:'−4% vs ant.', c: aS.success, ic:'Flow' },
        ].map(m => {
          const Ico = aI[m.ic];
          return (
            <div key={m.l} style={{background: aS.surface, border:'1px solid '+aS.border, borderRadius:14, padding:14}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                <div style={{fontFamily: aS.fontMono, fontSize:9.5, color: aS.text3, letterSpacing:'0.08em'}}>{m.l}</div>
                <Ico size={14} stroke={aS.text3}/>
              </div>
              <div style={{fontFamily: aS.fontSerif, fontSize:24, marginTop:6, lineHeight:1}}>{m.v}</div>
              <div style={{fontSize:11, color: m.c, marginTop:4, fontFamily: aS.fontMono}}>{m.d}</div>
            </div>
          );
        })}
      </div>

      {/* Cobradores en campo */}
      <div style={{fontSize:11, color: aS.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontFamily: aS.fontMono, marginTop: 8, display:'flex', justifyContent:'space-between'}}>
        <span>COBRADORES EN CAMPO</span>
        <span style={{color: aS.success}}>● 4 ACTIVOS</span>
      </div>
      <div style={{background: aS.surface, border:'1px solid '+aS.border, borderRadius:14, overflow:'hidden'}}>
        {aM.COBRADORES.map((c,i,a) => (
          <div key={c.n} style={{padding:'12px 14px', display:'flex', gap:12, alignItems:'center', borderBottom: i<a.length-1?'1px solid '+aS.border:'none'}}>
            <div style={{width:34, height:34, borderRadius:'50%', background: c.color, color:'#000', display:'grid', placeItems:'center', fontFamily: aS.fontMono, fontSize:11, fontWeight:600, position:'relative'}}>
              {c.n.split(' ').map(s=>s[0]).slice(0,2).join('')}
              <span style={{position:'absolute', bottom:-1, right:-1, width:10, height:10, borderRadius:'50%', background: aS.success, border:'2px solid '+aS.bg}}></span>
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:13, display:'flex', justifyContent:'space-between'}}>
                <span>{c.n}</span>
                <span style={{fontFamily: aS.fontMono, fontSize:12}}>{(i+3).toString()}/8</span>
              </div>
              <div style={{height:2, background: aS.surface2, borderRadius:1, marginTop:6, overflow:'hidden'}}>
                <div style={{height:'100%', width: (40 + i*15)+'%', background: c.color}}></div>
              </div>
            </div>
            <span style={{fontFamily: aS.fontMono, fontSize:12, color: aS.text2}}>$ {Math.round(c.recaudo/1000000)}M</span>
          </div>
        ))}
      </div>

      {/* Próximos eventos */}
      <div style={{fontSize:11, color: aS.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontFamily: aS.fontMono, marginTop: 18}}>PRÓXIMO</div>
      <div style={{background: aS.surface, border:'1px solid '+aS.border, borderRadius:14, padding:'14px 16px'}}>
        {[
          { d:'Hoy 18:00', t:'Cierre de día', det:'4 cobradores entregan efectivo', c: aS.accent },
          { d:'Lun 26', t:'Pago de nómina', det:'$ 18.2M · 4 cobradores + admin', c: aS.warning },
          { d:'Mar 27', t:'Vencimiento DIAN', det:'IVA bimestral', c: aS.info },
        ].map((e,i,a) => (
          <div key={i} style={{display:'flex', gap:12, padding:'10px 0', borderBottom: i<a.length-1?'1px solid '+aS.border:'none'}}>
            <div style={{width:6, height:6, borderRadius:'50%', background: e.c, marginTop:6, flexShrink:0}}></div>
            <div style={{flex:1}}>
              <div style={{display:'flex', justifyContent:'space-between'}}>
                <span style={{fontSize:13}}>{e.t}</span>
                <span style={{fontFamily: aS.fontMono, fontSize:11, color: aS.text3}}>{e.d}</span>
              </div>
              <div style={{fontSize:11.5, color: aS.text3, marginTop:2}}>{e.det}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </AScreen>
);

// ===== 2. CAJA — Tesorería =====
const AdminCaja = () => (
  <AScreen>
    <ATop title="Caja" sub="$ 412M en disponible"/>
    <div style={{padding:'0 18px 110px'}}>
      {/* Hero — Disponible total */}
      <div style={{background: aS.surface, border:'1px solid '+aS.border, borderRadius:18, padding:'20px 22px', marginBottom: 14}}>
        <div style={{fontFamily: aS.fontMono, fontSize:10, color: aS.text3, letterSpacing:'0.08em'}}>DISPONIBLE TOTAL</div>
        <div style={{fontFamily: aS.fontSerif, fontSize:48, lineHeight:1, marginTop:6, letterSpacing:'-0.02em'}}>
          <span style={{fontFamily: aS.fontMono, fontSize:16, color: aS.text3, verticalAlign:12}}>$</span>412<span style={{color: aS.text3, fontSize:24}}>.840.000</span>
        </div>
        <div style={{display:'flex', gap:8, marginTop:14}}>
          <button style={{flex:1, padding:'10px', borderRadius:10, background: aS.accent, color:'#000', border:'none', fontSize:13, fontWeight:500}}>+ Ingreso</button>
          <button style={{flex:1, padding:'10px', borderRadius:10, background: aS.surface2, border:'1px solid '+aS.border, color: aS.text, fontSize:13}}>− Egreso</button>
          <button style={{flex:1, padding:'10px', borderRadius:10, background: aS.surface2, border:'1px solid '+aS.border, color: aS.text, fontSize:13}}>↔ Mover</button>
        </div>
      </div>

      {/* Cuentas */}
      <div style={{fontSize:11, color: aS.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontFamily: aS.fontMono}}>CUENTAS</div>
      <div style={{display:'flex', flexDirection:'column', gap:10, marginBottom: 18}}>
        {[
          { n:'Bancolombia Empresas', sub:'***4421 · cta corriente', v:'248.420.000', c:'#fff3', logo:'B' },
          { n:'Davivienda Ahorros', sub:'***1198 · ahorros', v:'82.100.000', c:'#fff3', logo:'D' },
          { n:'Nequi · empresa', sub:'recaudo digital', v:'58.420.000', c: aS.accent, logo:'N' },
          { n:'Efectivo en bóveda', sub:'oficina principal', v:'23.900.000', c:aS.warning, logo:'$' },
        ].map(a => (
          <div key={a.n} style={{background: aS.surface, border:'1px solid '+aS.border, borderRadius:14, padding:'14px 16px', display:'flex', gap:12, alignItems:'center'}}>
            <div style={{width:38, height:38, borderRadius:10, background: aS.surface2, border:'1px solid '+aS.border, display:'grid', placeItems:'center', fontFamily: aS.fontSerif, fontSize:18, color: aS.text2, flexShrink:0}}>{a.logo}</div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:13.5}}>{a.n}</div>
              <div style={{fontSize:11.5, color: aS.text3, marginTop:2}}>{a.sub}</div>
            </div>
            <div style={{fontFamily: aS.fontMono, fontSize:14}}>$ {a.v}</div>
          </div>
        ))}
      </div>

      {/* Efectivo en campo */}
      <div style={{fontSize:11, color: aS.warning, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontFamily: aS.fontMono, display:'flex', justifyContent:'space-between'}}>
        <span>EFECTIVO EN CAMPO</span>
        <span>$ 12.4M EN TRÁNSITO</span>
      </div>
      <div style={{background:'rgba(251,191,36,0.05)', border:'1px solid rgba(251,191,36,0.2)', borderRadius:14, overflow:'hidden'}}>
        {aM.COBRADORES.map((c,i,a) => (
          <div key={c.n} style={{padding:'12px 14px', display:'flex', gap:12, alignItems:'center', borderBottom: i<a.length-1?'1px solid '+aS.border:'none'}}>
            <div style={{width:30, height:30, borderRadius:'50%', background: c.color, color:'#000', display:'grid', placeItems:'center', fontFamily: aS.fontMono, fontSize:10, fontWeight:600}}>{c.n.split(' ').map(s=>s[0]).slice(0,2).join('')}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13}}>{c.n}</div>
              <div style={{fontSize:11, color: aS.text3, marginTop:2}}>Cierra a las 18:00</div>
            </div>
            <span style={{fontFamily: aS.fontMono, fontSize:13, color: aS.warning}}>$ {Math.round(c.recaudo/30000) * 1000}</span>
          </div>
        ))}
      </div>

      {/* Movimientos recientes */}
      <div style={{fontSize:11, color: aS.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontFamily: aS.fontMono, marginTop: 18}}>MOVIMIENTOS RECIENTES</div>
      <div style={{background: aS.surface, border:'1px solid '+aS.border, borderRadius:14, overflow:'hidden'}}>
        {[
          { t:'Recaudo Nequi', sub:'12 pagos consolidados', v:'+ $8.4M', c: aS.success, w:'14:30' },
          { t:'Desembolso PR-1247', sub:'Yuliana Pérez', v:'− $5.0M', c: aS.danger, w:'11:55' },
          { t:'Pago arriendo oficina', sub:'mayo 2026', v:'− $4.2M', c: aS.danger, w:'09:00' },
          { t:'Recaudo en efectivo', sub:'Diego Ortiz · entrega', v:'+ $12.8M', c: aS.success, w:'ayer' },
        ].map((m,i,a) => (
          <div key={i} style={{padding:'12px 14px', display:'flex', gap:12, alignItems:'center', borderBottom: i<a.length-1?'1px solid '+aS.border:'none'}}>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:13}}>{m.t}</div>
              <div style={{fontSize:11, color: aS.text3, marginTop:2}}>{m.sub} · {m.w}</div>
            </div>
            <span style={{fontFamily: aS.fontMono, fontSize:13, color: m.c}}>{m.v}</span>
          </div>
        ))}
      </div>
    </div>
  </AScreen>
);

// ===== 3. GASTOS / EGRESOS =====
const AdminGastos = () => (
  <AScreen>
    <ATop
      title="Gastos"
      sub="$28.2M este mes · −4% vs ant."
      right={<AIcoBtn accent><aI.Plus size={16}/></AIcoBtn>}
    />
    <div style={{padding:'0 18px 110px'}}>
      {/* Hero */}
      <div style={{background: aS.surface, border:'1px solid '+aS.border, borderRadius:18, padding:'18px 20px', marginBottom: 14}}>
        <div style={{fontFamily: aS.fontMono, fontSize:10, color: aS.text3, letterSpacing:'0.08em'}}>GASTO ACUMULADO · MAYO</div>
        <div style={{fontFamily: aS.fontSerif, fontSize:42, lineHeight:1, marginTop:6}}>
          <span style={{fontFamily: aS.fontMono, fontSize:13, color: aS.text3, verticalAlign:10}}>$</span>28.234.000
        </div>
        <div style={{display:'flex', justifyContent:'space-between', marginTop:14, alignItems:'baseline'}}>
          <div>
            <div style={{fontSize:11, color: aS.text3}}>Presupuesto del mes</div>
            <div style={{fontFamily: aS.fontMono, fontSize:13, marginTop:2}}>$ 32.000.000</div>
          </div>
          <span style={{padding:'3px 8px', borderRadius:999, background:'rgba(74,222,128,0.15)', border:'1px solid rgba(74,222,128,0.3)', color: aS.success, fontSize:11, fontFamily: aS.fontMono}}>● 88% USADO</span>
        </div>
        <div style={{height:5, background: aS.surface2, borderRadius:2, marginTop:10, overflow:'hidden'}}>
          <div style={{height:'100%', width:'88%', background: aS.success}}></div>
        </div>
      </div>

      {/* Categorías */}
      <div style={{fontSize:11, color: aS.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontFamily: aS.fontMono}}>POR CATEGORÍA</div>
      <div style={{background: aS.surface, border:'1px solid '+aS.border, borderRadius:14, padding:'4px 16px', marginBottom:14}}>
        {[
          { l:'Nómina cobradores', v:14200000, pct:50, c:'#60a5fa' },
          { l:'Arriendo oficina', v:4200000, pct:15, c:'#a78bfa' },
          { l:'Servicios públicos', v:1800000, pct:6, c:'#f472b6' },
          { l:'Combustible', v:2800000, pct:10, c:'#fbbf24' },
          { l:'Comisiones cobranza', v:3400000, pct:12, c: aS.accent },
          { l:'Tecnología (SaaS)', v:780000, pct:3, c:'#34d399' },
          { l:'Otros', v:1054000, pct:4, c: aS.text3 },
        ].map((g,i,a) => (
          <div key={g.l} style={{padding:'10px 0', borderBottom: i<a.length-1?'1px solid '+aS.border:'none'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:6, alignItems:'center'}}>
              <div style={{display:'flex', gap:8, alignItems:'center'}}>
                <span style={{width:8, height:8, borderRadius:'50%', background: g.c}}></span>
                <span style={{fontSize:13}}>{g.l}</span>
              </div>
              <span style={{fontFamily: aS.fontMono, fontSize:13}}>$ {aM.fmt(g.v)}</span>
            </div>
            <div style={{height:3, background: aS.surface2, borderRadius:2, overflow:'hidden'}}>
              <div style={{height:'100%', width: g.pct+'%', background: g.c}}></div>
            </div>
          </div>
        ))}
      </div>

      {/* IA tip */}
      <div style={{background:'rgba(212,255,58,0.05)', border:'1px solid rgba(212,255,58,0.2)', borderRadius:14, padding:'14px 16px', marginBottom: 14, display:'flex', gap:12}}>
        <aI.Sparkles size={16} stroke={aS.accent}/>
        <div style={{flex:1, fontSize:12.5, color: aS.text2}}>
          <strong style={{color: aS.text}}>Combustible subió 32%</strong> este mes. Considera optimizar rutas — la IA puede sugerir 4 reorganizaciones.
        </div>
      </div>

      {/* Recientes */}
      <div style={{fontSize:11, color: aS.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontFamily: aS.fontMono, marginTop: 18}}>RECIENTES</div>
      <div style={{background: aS.surface, border:'1px solid '+aS.border, borderRadius:14, overflow:'hidden'}}>
        {[
          { d:'24 may', cat:'Combustible', sup:'Terpel · Belén', v:240000 },
          { d:'23 may', cat:'Nómina', sup:'Quincena Diego Ortiz', v:1850000 },
          { d:'22 may', cat:'Tecnología', sup:'Cartera SaaS Pro', v:702100 },
          { d:'22 may', cat:'Servicios', sup:'EPM · luz mayo', v:418000 },
          { d:'20 may', cat:'Arriendo', sup:'Of. Belén · mayo', v:4200000 },
        ].map((e,i,a) => (
          <div key={i} style={{padding:'12px 14px', borderBottom: i<a.length-1?'1px solid '+aS.border:'none'}}>
            <div style={{display:'flex', justifyContent:'space-between'}}>
              <span style={{fontSize:13}}>{e.sup}</span>
              <span style={{fontFamily: aS.fontMono, fontSize:13}}>− $ {aM.fmt(e.v)}</span>
            </div>
            <div style={{display:'flex', justifyContent:'space-between', marginTop:2, fontSize:11, color: aS.text3}}>
              <span>{e.cat}</span>
              <span style={{fontFamily: aS.fontMono}}>{e.d}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </AScreen>
);

// ===== 4. CAPITAL — Inversión propia / ROI =====
const AdminCapital = () => (
  <AScreen>
    <ATop title={<>Mi <span style={{color: aS.accent, fontStyle:'italic'}}>capital</span></>} sub="Inversión propia · ROI 23.8%"/>
    <div style={{padding:'0 18px 110px'}}>
      {/* Hero */}
      <div style={{background:'linear-gradient(135deg, '+aS.surface+', '+aS.bg+')', border:'1px solid '+aS.border, borderRadius:18, padding:'20px 22px', marginBottom:14, position:'relative', overflow:'hidden'}}>
        <div style={{position:'absolute', top:-30, right:-30, width:120, height:120, borderRadius:'50%', background:'radial-gradient(circle, rgba(212,255,58,0.1), transparent 70%)'}}></div>
        <div style={{fontFamily: aS.fontMono, fontSize:10, color: aS.text3, letterSpacing:'0.08em'}}>CAPITAL TOTAL INVERTIDO</div>
        <div style={{fontFamily: aS.fontSerif, fontSize:46, lineHeight:1, marginTop:6, letterSpacing:'-0.02em'}}>
          <span style={{fontFamily: aS.fontMono, fontSize:14, color: aS.text3, verticalAlign:10}}>$</span>1.800<span style={{color: aS.text3, fontSize:24}}>.000.000</span>
        </div>
        <div style={{display:'flex', gap:24, marginTop:18}}>
          <div>
            <div style={{fontSize:11, color: aS.text3}}>Valor actual</div>
            <div style={{fontFamily: aS.fontMono, fontSize:14, marginTop:2, color: aS.accent}}>$ 2.228M</div>
          </div>
          <div>
            <div style={{fontSize:11, color: aS.text3}}>Rentabilidad</div>
            <div style={{fontFamily: aS.fontMono, fontSize:14, marginTop:2, color: aS.success}}>+ $ 428M</div>
          </div>
          <div>
            <div style={{fontSize:11, color: aS.text3}}>ROI anual</div>
            <div style={{fontFamily: aS.fontMono, fontSize:14, marginTop:2, color: aS.accent}}>23.8%</div>
          </div>
        </div>
      </div>

      {/* Composición del capital */}
      <div style={{fontSize:11, color: aS.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontFamily: aS.fontMono}}>DÓNDE ESTÁ TU DINERO</div>
      <div style={{background: aS.surface, border:'1px solid '+aS.border, borderRadius:14, padding:18, marginBottom: 14}}>
        {/* Stacked donut substitute */}
        <div style={{display:'flex', flexDirection:'column', gap:14}}>
          {[
            { l:'Cartera activa', v:1842000000, pct:83, c: aS.accent },
            { l:'Caja & bancos', v:412000000, pct:18, c: aS.info },
            { l:'Mercancía en inventario', v:218000000, pct:10, c: aS.warning },
            { l:'Cartera en mora', v:184000000, pct:8, c: aS.danger },
          ].map(s => (
            <div key={s.l}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6}}>
                <div style={{display:'flex', gap:8, alignItems:'baseline'}}>
                  <span style={{width:8, height:8, borderRadius:'50%', background: s.c}}></span>
                  <span style={{fontSize:13}}>{s.l}</span>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontFamily: aS.fontMono, fontSize:13}}>$ {aM.fmt(s.v)}</div>
                </div>
              </div>
              <div style={{height:4, background: aS.surface2, borderRadius:2, overflow:'hidden'}}>
                <div style={{height:'100%', width: s.pct+'%', background: s.c}}></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Curva del capital */}
      <div style={{fontSize:11, color: aS.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontFamily: aS.fontMono}}>CRECIMIENTO · 12M</div>
      <div style={{background: aS.surface, border:'1px solid '+aS.border, borderRadius:14, padding:18, marginBottom:14}}>
        <svg width="100%" height="120" viewBox="0 0 320 120" preserveAspectRatio="none">
          <defs>
            <linearGradient id="capg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={aS.accent} stopOpacity="0.3"/>
              <stop offset="100%" stopColor={aS.accent} stopOpacity="0"/>
            </linearGradient>
          </defs>
          {[20,40,60,80,100].map(y => <line key={y} x1="0" x2="320" y1={y} y2={y} stroke={aS.border} strokeWidth="0.5"/>)}
          <path d="M 0 90 Q 40 85, 60 78 T 120 60 T 180 48 T 240 32 T 320 18 L 320 120 L 0 120 Z" fill="url(#capg)"/>
          <path d="M 0 90 Q 40 85, 60 78 T 120 60 T 180 48 T 240 32 T 320 18" stroke={aS.accent} strokeWidth="2" fill="none"/>
          <circle cx="320" cy="18" r="4" fill={aS.accent}/>
        </svg>
        <div style={{display:'flex', justifyContent:'space-between', marginTop:8, fontSize:10, color: aS.text3, fontFamily: aS.fontMono}}>
          <span>jun '25</span><span>sep</span><span>dic</span><span>mar</span><span>may '26</span>
        </div>
      </div>

      {/* Acciones */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
        <button style={{padding:'14px', borderRadius:12, background: aS.accent, color:'#000', border:'none', fontSize:13, fontWeight:500}}>+ Aportar capital</button>
        <button style={{padding:'14px', borderRadius:12, background: aS.surface, border:'1px solid '+aS.border, color: aS.text, fontSize:13}}>− Retirar utilidades</button>
      </div>

      {/* Historial aportes / retiros */}
      <div style={{fontSize:11, color: aS.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontFamily: aS.fontMono, marginTop: 18}}>MOVIMIENTOS DE CAPITAL</div>
      <div style={{background: aS.surface, border:'1px solid '+aS.border, borderRadius:14, overflow:'hidden'}}>
        {[
          { d:'12 may 2026', t:'Retiro utilidades · abril', v:'− $ 24M', c: aS.danger },
          { d:'02 feb 2026', t:'Aporte adicional', v:'+ $ 200M', c: aS.success },
          { d:'10 nov 2025', t:'Retiro utilidades · oct', v:'− $ 18M', c: aS.danger },
          { d:'15 jun 2025', t:'Capital inicial', v:'+ $ 1.600M', c: aS.success },
        ].map((m,i,a) => (
          <div key={i} style={{padding:'12px 14px', display:'flex', justifyContent:'space-between', borderBottom: i<a.length-1?'1px solid '+aS.border:'none'}}>
            <div>
              <div style={{fontSize:13}}>{m.t}</div>
              <div style={{fontSize:11, color: aS.text3, marginTop:2, fontFamily: aS.fontMono}}>{m.d}</div>
            </div>
            <span style={{fontFamily: aS.fontMono, fontSize:13, color: m.c}}>{m.v}</span>
          </div>
        ))}
      </div>
    </div>
  </AScreen>
);

window.ADM = { AdminHome, AdminCaja, AdminGastos, AdminCapital, ABottomNav };
