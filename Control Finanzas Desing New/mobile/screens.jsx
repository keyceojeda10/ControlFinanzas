// Mobile screens — cobrador en campo
// Each function renders one full phone screen (inner content, no device chrome)

const M = window.MOCK;
const MI = window.Icons;

// =================== Shared mobile primitives ===================
const mStyles = {
  bg: '#0a0a0a', surface: '#141414', surface2: '#1a1a1a',
  border: '#1f1f1f', text: '#fafafa', text2: '#a1a1a1', text3: '#6b6b6b',
  accent: '#d4ff3a', danger: '#f87171', success: '#4ade80', warning: '#fbbf24',
  font: "'Geist', system-ui, sans-serif",
  fontMono: "'Geist Mono', monospace",
  fontSerif: "'Instrument Serif', serif",
};

const MScreen = ({ children, style }) => (
  <div style={{
    background: mStyles.bg, color: mStyles.text, minHeight:'100%',
    fontFamily: mStyles.font, fontSize: 14, letterSpacing:'-0.005em',
    paddingTop: 54, ...style
  }}>{children}</div>
);

const MTopBar = ({ title, left, right, sub }) => (
  <div style={{
    padding:'8px 18px 14px', display:'flex', alignItems:'center', gap:12,
    position:'sticky', top:54, background:mStyles.bg, zIndex:5
  }}>
    {left}
    <div style={{flex:1, minWidth:0}}>
      {title && <div style={{fontFamily:mStyles.fontSerif, fontSize:26, lineHeight:1, letterSpacing:'-0.015em'}}>{title}</div>}
      {sub && <div style={{fontSize:12, color:mStyles.text3, marginTop:3}}>{sub}</div>}
    </div>
    {right}
  </div>
);

const MIconBtn = ({ children, onClick, accent }) => (
  <button onClick={onClick} style={{
    width:38, height:38, borderRadius:10, border:'1px solid '+mStyles.border,
    background: accent ? mStyles.accent : mStyles.surface, color: accent ? '#000' : mStyles.text2,
    display:'grid', placeItems:'center', cursor:'pointer'
  }}>{children}</button>
);

const MBottomNav = ({ tab, setTab }) => {
  const items = [
    { id:'home', label:'Hoy', icon: <MI.Dashboard size={20}/> },
    { id:'route', label:'Ruta', icon: <MI.Route size={20}/> },
    { id:'tx', label:'Cobros', icon: <MI.Tx size={20}/> },
    { id:'profile', label:'Perfil', icon: <MI.User size={20}/> },
  ];
  return (
    <div style={{
      position:'absolute', bottom:0, left:0, right:0, paddingBottom:30, paddingTop:8,
      background:'rgba(10,10,10,0.92)', backdropFilter:'blur(20px)', borderTop:'1px solid '+mStyles.border,
      display:'flex', justifyContent:'space-around', zIndex:20
    }}>
      {items.map(it => (
        <button key={it.id} onClick={() => setTab && setTab(it.id)}
                style={{
                  background:'none', border:'none', cursor:'pointer',
                  color: tab===it.id ? mStyles.accent : mStyles.text3,
                  display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                  padding:'6px 10px',
                }}>
          {it.icon}
          <span style={{fontSize:10.5, fontFamily: mStyles.font}}>{it.label}</span>
        </button>
      ))}
    </div>
  );
};

const MStatusBadge = ({ status }) => {
  const map = {
    pending: { c: mStyles.accent, l: 'Pendiente' },
    done: { c: mStyles.success, l: 'Cobrado' },
    mora: { c: mStyles.danger, l: 'Mora' },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:'2px 8px', borderRadius:999, fontSize:11, color: s.c,
      background: `${s.c}1a`, border:`1px solid ${s.c}40`, fontFamily: mStyles.fontMono
    }}>
      <span style={{width:5, height:5, borderRadius:'50%', background: s.c}}></span>{s.l}
    </span>
  );
};

// =================== 1. Login ===================
const MobLogin = () => (
  <MScreen style={{padding:'72px 24px 0', minHeight:'100%', background: mStyles.bg}}>
    <div style={{display:'flex', alignItems:'center', gap:10, marginBottom: 80}}>
      <div style={{width:32, height:32, background: mStyles.accent, borderRadius:8, display:'grid', placeItems:'center', fontFamily: mStyles.fontSerif, fontStyle:'italic', color:'#000', fontSize:20}}>c</div>
      <span style={{fontFamily: mStyles.fontSerif, fontSize:26}}>Cartera<span style={{color: mStyles.accent}}>.</span></span>
    </div>

    <div style={{fontFamily: mStyles.fontSerif, fontSize:42, lineHeight:1.05, letterSpacing:'-0.02em'}}>
      Hola, <span style={{color: mStyles.accent, fontStyle:'italic'}}>Diego</span>.
    </div>
    <div style={{color: mStyles.text3, marginTop:8, fontSize:14}}>Tu ruta de hoy ya está lista. Ingresa para empezar.</div>

    <div style={{marginTop: 48}}>
      <label style={{fontSize:11, color: mStyles.text3, textTransform:'uppercase', letterSpacing:'0.08em'}}>PIN de acceso</label>
      <div style={{display:'flex', gap:10, marginTop:10}}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{
            flex:1, height:54, borderRadius:12, background: mStyles.surface,
            border:'1px solid ' + (i<=3?mStyles.accent:mStyles.border),
            display:'grid', placeItems:'center',
            fontFamily: mStyles.fontMono, fontSize:20, color: mStyles.accent
          }}>{i<=3?'•':''}</div>
        ))}
      </div>
    </div>

    {/* Numeric pad */}
    <div style={{marginTop: 40, display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10}}>
      {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((n,i) => (
        <button key={i} style={{
          aspectRatio:'1.6/1', borderRadius:14, background: n===''?'transparent':mStyles.surface,
          border:'none', color: mStyles.text, fontFamily: mStyles.font, fontSize: 22, cursor:'pointer'
        }}>{n}</button>
      ))}
    </div>

    <div style={{marginTop:'auto', position:'absolute', bottom: 48, left:24, right:24, textAlign:'center'}}>
      <a style={{color: mStyles.text3, fontSize:12.5}}>Usar huella digital</a>
    </div>
  </MScreen>
);

// =================== 2. Home / Hoy ===================
const MobHome = ({ setTab }) => (
  <MScreen>
    <MTopBar
      title={<>Hoy, <span style={{color: mStyles.accent, fontStyle:'italic'}}>sábado</span></>}
      sub="23 mayo · Ruta Norte"
      right={
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <MIconBtn><MI.Bell size={16}/></MIconBtn>
          <div style={{width:38, height:38, borderRadius:'50%',
            background:'linear-gradient(135deg, #d4ff3a, #4ade80)',
            display:'grid', placeItems:'center', color:'#000', fontFamily: mStyles.fontMono, fontSize:12, fontWeight:600}}>DO</div>
        </div>
      }
    />

    <div style={{padding:'0 18px 100px'}}>
      {/* Goal card */}
      <div style={{
        background:'linear-gradient(180deg, '+mStyles.surface+', '+mStyles.bg+')',
        border:'1px solid '+mStyles.border, borderRadius:18, padding:'18px 20px', marginBottom:16
      }}>
        <div style={{fontFamily:mStyles.fontMono, fontSize:10, color:mStyles.text3, letterSpacing:'0.08em'}}>META DEL DÍA</div>
        <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', marginTop:6}}>
          <div style={{fontFamily:mStyles.fontSerif, fontSize:46, lineHeight:1, letterSpacing:'-0.02em'}}>
            <span style={{fontFamily:mStyles.fontMono, fontSize:14, color:mStyles.text3, verticalAlign:8}}>$</span>
            5.9<span style={{color:mStyles.text3}}>M</span>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontFamily:mStyles.fontMono, fontSize:16, color: mStyles.accent}}>+ $2.19M</div>
            <div style={{fontSize:11, color: mStyles.text3}}>recaudado</div>
          </div>
        </div>
        <div style={{height: 6, background: mStyles.surface2, borderRadius:3, marginTop:14, overflow:'hidden'}}>
          <div style={{height:'100%', width:'37%', background: mStyles.accent, borderRadius:3}}></div>
        </div>
        <div style={{display:'flex', justifyContent:'space-between', marginTop:8, fontSize:11, color: mStyles.text3, fontFamily: mStyles.fontMono}}>
          <span>37% · 3 de 8 visitas</span>
          <span>faltan 5</span>
        </div>
      </div>

      {/* Next stop */}
      <div style={{fontSize:11, color: mStyles.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, marginTop: 8}}>SIGUIENTE PARADA</div>
      <div onClick={() => setTab && setTab('client')} style={{
        background: mStyles.surface, border:'1px solid '+mStyles.border, borderRadius:18,
        padding:'16px 18px', marginBottom: 16, cursor:'pointer'
      }}>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <div style={{width:46, height:46, borderRadius:'50%', background: mStyles.surface2, border:'1px solid '+mStyles.border, display:'grid', placeItems:'center', fontFamily: mStyles.fontMono, fontSize:14, color: mStyles.text2}}>MR</div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:15}}>Marisol Ramírez</div>
            <div style={{fontSize:12, color: mStyles.text3, marginTop:2}}>Cra 43 #18-22, Belén · a 800m</div>
          </div>
          <MI.Chevron size={18} stroke={mStyles.text3}/>
        </div>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:14, paddingTop:14, borderTop:'1px solid '+mStyles.border}}>
          <div>
            <div style={{fontSize:10, color: mStyles.text3, fontFamily: mStyles.fontMono, letterSpacing:'0.08em'}}>CUOTA 7/24</div>
            <div style={{fontFamily: mStyles.fontSerif, fontSize:24, marginTop:2}}><span style={{fontSize:12, color:mStyles.text3, fontFamily:mStyles.fontMono}}>$</span>850.000</div>
          </div>
          <div style={{display:'flex', gap:8}}>
            <button style={{width:38, height:38, borderRadius:10, background: mStyles.surface2, border:'1px solid '+mStyles.border, color: mStyles.text2, display:'grid', placeItems:'center'}}>
              <MI.Phone size={16}/>
            </button>
            <button style={{padding:'0 16px', height:38, borderRadius:10, background: mStyles.accent, color:'#000', border:'none', fontWeight:500, display:'flex', alignItems:'center', gap:6}}>
              Cobrar <MI.Chevron size={14}/>
            </button>
          </div>
        </div>
      </div>

      {/* Quick stats grid */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10, marginBottom:16}}>
        <div style={{background: mStyles.surface, border:'1px solid '+mStyles.border, borderRadius:14, padding:14}}>
          <div style={{fontSize:10, color: mStyles.text3, textTransform:'uppercase', letterSpacing:'0.08em'}}>VISITAS</div>
          <div style={{fontFamily: mStyles.fontSerif, fontSize:28, marginTop:4}}>5 <span style={{color: mStyles.text3, fontSize:16}}>/ 8</span></div>
        </div>
        <div style={{background: mStyles.surface, border:'1px solid '+mStyles.border, borderRadius:14, padding:14}}>
          <div style={{fontSize:10, color: mStyles.text3, textTransform:'uppercase', letterSpacing:'0.08em'}}>EN MORA</div>
          <div style={{fontFamily: mStyles.fontSerif, fontSize:28, marginTop:4, color: mStyles.danger}}>1</div>
        </div>
        <div style={{background: mStyles.surface, border:'1px solid '+mStyles.border, borderRadius:14, padding:14, gridColumn:'span 2'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div>
              <div style={{fontSize:10, color: mStyles.text3, textTransform:'uppercase', letterSpacing:'0.08em'}}>EFECTIVIDAD MES</div>
              <div style={{fontFamily: mStyles.fontSerif, fontSize:28, marginTop:4}}>96<span style={{color: mStyles.text3, fontSize:18}}>%</span></div>
            </div>
            <div style={{display:'flex', alignItems:'flex-end', gap:2, height:36}}>
              {[14,16,15,18,17,20,19,22,21,24,23,26].map((h,i) => (
                <div key={i} style={{width:5, height: h, background: i===11?mStyles.accent:mStyles.surface2, borderRadius:1}}></div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* AI tip */}
      <div style={{background: mStyles.surface, border:'1px solid '+mStyles.border, borderRadius:14, padding:'14px 16px', display:'flex', gap:12, alignItems:'flex-start'}}>
        <div style={{width:30, height:30, borderRadius:8, background:'rgba(212,255,58,0.12)', display:'grid', placeItems:'center', color: mStyles.accent, flexShrink:0}}>
          <MI.Sparkles size={16}/>
        </div>
        <div>
          <div style={{fontFamily: mStyles.fontMono, fontSize:10, color: mStyles.accent, letterSpacing:'0.08em'}}>TIP IA</div>
          <div style={{fontSize:13, color: mStyles.text, marginTop:3, letterSpacing:'-0.005em'}}>
            Diana Castaño suele pagar en efectivo después de las 11am. Pasa primero por Roberto.
          </div>
        </div>
      </div>
    </div>
  </MScreen>
);

// =================== 3. Ruta ===================
const MobRoute = () => {
  const stops = M.ROUTE_CLIENTS;
  return (
    <MScreen>
      <MTopBar
        title={<>Mi <span style={{color: mStyles.accent, fontStyle:'italic'}}>ruta</span></>}
        sub="8 paradas · 5.9M meta"
        right={<MIconBtn><MI.Filter size={16}/></MIconBtn>}
      />

      {/* Map preview */}
      <div style={{margin:'0 18px 16px', height:160, borderRadius:18, background: mStyles.surface, border:'1px solid '+mStyles.border, position:'relative', overflow:'hidden'}}>
        <svg width="100%" height="100%" viewBox="0 0 400 160" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="gm" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke={mStyles.border} strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="400" height="160" fill={mStyles.surface}/>
          <rect width="400" height="160" fill="url(#gm)"/>
          <path d="M0 60 Q150 50 250 70 T400 80" stroke="#2a2a2a" strokeWidth="12" fill="none"/>
          <path d="M0 120 Q200 100 400 130" stroke="#2a2a2a" strokeWidth="10" fill="none"/>
          <path d="M50 50 80 130 L150 70 L220 110 L290 60 L350 130" stroke={mStyles.accent} strokeWidth="1.5" strokeDasharray="4 3" fill="none" opacity="0.6"/>
          {[[50,50,'done'],[80,130,'done'],[150,70,'mora'],[220,110,'pending'],[290,60,'pending'],[350,130,'pending']].map(([x,y,st],i) => {
            const c = st==='done'?mStyles.success:st==='mora'?mStyles.danger:mStyles.accent;
            return (
              <g key={i}>
                {i===3 && <circle cx={x} cy={y} r="16" fill={c} opacity="0.18"/>}
                <circle cx={x} cy={y} r={i===3?8:6} fill={mStyles.bg} stroke={c} strokeWidth="1.8"/>
                <text x={x} y={y+3} fontSize="9" fill={c} textAnchor="middle" fontFamily={mStyles.fontMono}>{i+1}</text>
              </g>
            );
          })}
        </svg>
        <div style={{position:'absolute', top:12, right:12, padding:'4px 8px', background:'rgba(10,10,10,0.7)', backdropFilter:'blur(12px)', borderRadius:6, fontSize:10, fontFamily: mStyles.fontMono, color: mStyles.text2}}>BELÉN · 23 MAY</div>
      </div>

      {/* Stop list */}
      <div style={{padding:'0 18px 100px'}}>
        {stops.map((s, i) => {
          const isActive = i === 3;
          return (
            <div key={i} style={{
              display:'flex', gap:12, padding:'14px 0',
              borderBottom: i === stops.length-1 ? 'none' : '1px solid '+mStyles.border,
              opacity: s.status === 'done' ? 0.55 : 1
            }}>
              <div style={{width:28, display:'flex', flexDirection:'column', alignItems:'center', gap:6}}>
                <div style={{
                  width:24, height:24, borderRadius:'50%',
                  border:'1.5px solid '+(s.status==='done'?mStyles.success:s.status==='mora'?mStyles.danger:isActive?mStyles.accent:mStyles.border),
                  background: isActive?mStyles.accent:'transparent',
                  display:'grid', placeItems:'center', fontSize:10, fontFamily: mStyles.fontMono,
                  color: isActive?'#000':s.status==='done'?mStyles.success:s.status==='mora'?mStyles.danger:mStyles.text2,
                  fontWeight: isActive?600:400,
                }}>{s.status==='done'?'✓':(i+1)}</div>
                {i < stops.length-1 && <div style={{flex:1, width:1, background: mStyles.border}}></div>}
              </div>
              <div style={{flex:1, minWidth:0, paddingBottom:6}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
                  <span style={{fontSize:14}}>{s.n}</span>
                  <span style={{fontFamily: mStyles.fontMono, fontSize:13}}>$ {M.fmt(s.amt)}</span>
                </div>
                <div style={{fontSize:12, color: mStyles.text3, marginTop:3, display:'flex', justifyContent:'space-between'}}>
                  <span style={{flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.a}</span>
                  <span style={{fontFamily: mStyles.fontMono, marginLeft: 8}}>{s.time}</span>
                </div>
                {isActive && (
                  <div style={{marginTop:10, display:'flex', gap:6}}>
                    <button style={{flex:1, height:34, borderRadius:8, background: mStyles.accent, color:'#000', border:'none', fontSize:13, fontWeight:500}}>Cobrar ahora</button>
                    <button style={{height:34, padding:'0 12px', borderRadius:8, background: mStyles.surface, border:'1px solid '+mStyles.border, color: mStyles.text2, display:'grid', placeItems:'center'}}>
                      <MI.Pin size={14}/>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </MScreen>
  );
};

// =================== 4. Cliente / Cobrar ===================
const MobClient = () => (
  <MScreen>
    <MTopBar
      left={<MIconBtn><MI.Chevron size={16} style={{transform:'rotate(180deg)'}}/></MIconBtn>}
      right={<MIconBtn><MI.More size={16}/></MIconBtn>}
    />

    <div style={{padding:'0 24px 100px'}}>
      <div style={{display:'flex', alignItems:'center', gap:14, marginBottom: 14}}>
        <div style={{width:60, height:60, borderRadius:'50%', background:'linear-gradient(135deg, #60a5fa, #a78bfa)', display:'grid', placeItems:'center', fontFamily: mStyles.fontMono, fontSize:18, color:'#000', fontWeight:600}}>MR</div>
        <div style={{flex:1}}>
          <div style={{fontFamily: mStyles.fontSerif, fontSize:30, lineHeight:1, letterSpacing:'-0.015em'}}>Marisol Ramírez</div>
          <div style={{fontSize:12.5, color: mStyles.text3, marginTop:4}}>Cliente desde feb 2024 · PR-1209</div>
        </div>
      </div>

      <div style={{display:'flex', gap:8, marginBottom: 22}}>
        <MStatusBadge status="pending"/>
        <span style={{display:'inline-flex', alignItems:'center', gap:5, padding:'2px 8px', borderRadius:999, fontSize:11, color: mStyles.text2, background: mStyles.surface, border:'1px solid '+mStyles.border, fontFamily: mStyles.fontMono}}>★ 96% a tiempo</span>
      </div>

      {/* Loan summary card */}
      <div style={{background: mStyles.surface, border:'1px solid '+mStyles.border, borderRadius:18, padding:20, marginBottom:14}}>
        <div style={{display:'flex', justifyContent:'space-between'}}>
          <div>
            <div style={{fontSize:10, color: mStyles.text3, textTransform:'uppercase', letterSpacing:'0.08em', fontFamily: mStyles.fontMono}}>CUOTA DE HOY</div>
            <div style={{fontFamily: mStyles.fontSerif, fontSize:48, lineHeight:1, marginTop:6, letterSpacing:'-0.02em'}}>
              <span style={{fontFamily: mStyles.fontMono, fontSize:14, color: mStyles.text3, verticalAlign:10}}>$</span>
              850.000
            </div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:10, color: mStyles.text3, fontFamily: mStyles.fontMono, letterSpacing:'0.08em'}}>CUOTA</div>
            <div style={{fontFamily: mStyles.fontSerif, fontSize:30, marginTop:4}}>7<span style={{color: mStyles.text3, fontSize:18}}>/24</span></div>
          </div>
        </div>
        <div style={{height:6, background:mStyles.surface2, borderRadius:3, marginTop:18, overflow:'hidden', display:'flex'}}>
          <div style={{width:'25%', height:'100%', background: mStyles.accent}}></div>
          <div style={{width:'4%', height:'100%', background: mStyles.text}}></div>
        </div>
        <div style={{display:'flex', justifyContent:'space-between', marginTop:14, fontSize:12}}>
          <div>
            <div style={{color: mStyles.text3, fontSize:10, letterSpacing:'0.08em', fontFamily: mStyles.fontMono}}>SALDO</div>
            <div style={{fontFamily: mStyles.fontMono, fontSize:14, marginTop:2}}>$ 14.450.000</div>
          </div>
          <div>
            <div style={{color: mStyles.text3, fontSize:10, letterSpacing:'0.08em', fontFamily: mStyles.fontMono}}>TASA EA</div>
            <div style={{fontFamily: mStyles.fontMono, fontSize:14, marginTop:2}}>18.4%</div>
          </div>
          <div>
            <div style={{color: mStyles.text3, fontSize:10, letterSpacing:'0.08em', fontFamily: mStyles.fontMono}}>SIGUIENTE</div>
            <div style={{fontFamily: mStyles.fontMono, fontSize:14, marginTop:2}}>06 jun</div>
          </div>
        </div>
      </div>

      {/* Payment method */}
      <div style={{fontSize:11, color: mStyles.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom: 8, fontFamily: mStyles.fontMono}}>MEDIO DE PAGO</div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 8, marginBottom: 22}}>
        {[
          { l:'Nequi', sel:true },
          { l:'Efectivo' },
          { l:'Daviplata' },
        ].map(m => (
          <div key={m.l} style={{
            padding:'12px 8px', borderRadius:12, background: m.sel?'rgba(212,255,58,0.1)':mStyles.surface,
            border:'1px solid '+(m.sel?mStyles.accent:mStyles.border),
            color: m.sel?mStyles.accent:mStyles.text, textAlign:'center', fontSize:13,
          }}>{m.l}</div>
        ))}
      </div>

      {/* Action */}
      <button style={{
        width:'100%', padding:'16px', borderRadius:14, background: mStyles.accent, color:'#000',
        border:'none', fontSize:15, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:8
      }}>
        <MI.Check size={18}/> Confirmar cobro · $ 850.000
      </button>
      <button style={{
        width:'100%', padding:'14px', borderRadius:14, background:'transparent', color: mStyles.text3,
        border:'none', fontSize:13, marginTop:6
      }}>
        Cobro parcial / Reagendar
      </button>
    </div>
  </MScreen>
);

// =================== 5. Confirmación ===================
const MobConfirm = () => (
  <MScreen style={{paddingTop: 80}}>
    <div style={{padding:'0 24px', textAlign:'center'}}>
      <div style={{width:84, height:84, borderRadius:'50%', background:'rgba(212,255,58,0.12)', display:'grid', placeItems:'center', margin:'0 auto 22px'}}>
        <div style={{width:60, height:60, borderRadius:'50%', background: mStyles.accent, display:'grid', placeItems:'center'}}>
          <MI.Check size={32} stroke="#000" strokeWidth={2}/>
        </div>
      </div>

      <div style={{fontFamily: mStyles.fontSerif, fontSize:38, lineHeight:1.05, letterSpacing:'-0.02em'}}>
        Cobro <span style={{color: mStyles.accent, fontStyle:'italic'}}>confirmado</span>.
      </div>
      <div style={{color: mStyles.text3, fontSize:14, marginTop:8}}>El recibo se envió por WhatsApp a Marisol.</div>

      <div style={{
        background: mStyles.surface, border:'1px solid '+mStyles.border, borderRadius:18,
        padding:20, marginTop: 32, textAlign:'left'
      }}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
          <div style={{fontFamily: mStyles.fontMono, fontSize:11, color: mStyles.text3, letterSpacing:'0.08em'}}>RECIBO TX-04821</div>
          <div style={{fontFamily: mStyles.fontMono, fontSize:11, color: mStyles.text3}}>14:32 · 23 may</div>
        </div>

        <div style={{fontFamily: mStyles.fontSerif, fontSize:42, marginTop:8, letterSpacing:'-0.02em'}}>
          <span style={{fontFamily: mStyles.fontMono, fontSize:14, color: mStyles.text3, verticalAlign:8}}>$</span>
          850.000
        </div>

        <div style={{height:1, background: mStyles.border, margin:'18px 0'}}></div>

        {[
          ['Cliente', 'Marisol Ramírez'],
          ['Préstamo', 'PR-1209 · cuota 7/24'],
          ['Medio', 'Nequi'],
          ['Saldo', '$ 13.600.000'],
        ].map(([k,v]) => (
          <div key={k} style={{display:'flex', justifyContent:'space-between', padding:'7px 0', fontSize:13}}>
            <span style={{color: mStyles.text3}}>{k}</span>
            <span>{v}</span>
          </div>
        ))}
      </div>

      <div style={{display:'flex', gap:10, marginTop: 26}}>
        <button style={{flex:1, padding:'14px', borderRadius:12, background: mStyles.surface, border:'1px solid '+mStyles.border, color: mStyles.text, fontSize:14}}>Compartir</button>
        <button style={{flex:2, padding:'14px', borderRadius:12, background: mStyles.accent, color:'#000', border:'none', fontSize:14, fontWeight:600}}>Siguiente parada →</button>
      </div>
    </div>
  </MScreen>
);

// =================== 6. Cobros (historial) ===================
const MobTransactions = () => {
  const txs = M.TRANSACTIONS.slice(0, 8);
  return (
    <MScreen>
      <MTopBar
        title={<>Mis <span style={{color: mStyles.accent, fontStyle:'italic'}}>cobros</span></>}
        sub="Hoy · $2.190.000 · 3 visitas"
        right={<MIconBtn><MI.Calendar size={16}/></MIconBtn>}
      />

      {/* Today bar */}
      <div style={{padding:'0 18px', marginBottom:18}}>
        <div style={{display:'flex', alignItems:'flex-end', gap:3, height:80, padding:'10px 14px', background: mStyles.surface, border:'1px solid '+mStyles.border, borderRadius:14}}>
          {[2,3,4,3,5,7,8,9,11,14,12,18,22,28,32,26,30,38,42,36,30,28,22,18].map((h,i) => (
            <div key={i} style={{flex:1, height: h*1.6, background: i>=14&&i<=18?mStyles.accent:mStyles.surface2, borderRadius:'1px 1px 0 0', maxWidth:8}}></div>
          ))}
        </div>
        <div style={{display:'flex', justifyContent:'space-between', fontFamily: mStyles.fontMono, fontSize:10, color: mStyles.text3, marginTop:6, padding:'0 14px'}}>
          <span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>24h</span>
        </div>
      </div>

      {/* Tx list */}
      <div style={{padding:'0 18px 100px'}}>
        <div style={{fontSize:11, color: mStyles.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontFamily: mStyles.fontMono}}>SÁBADO · 23 MAY</div>
        {txs.map(tx => {
          const c = tx.status==='success'?mStyles.success:tx.status==='warning'?mStyles.warning:mStyles.danger;
          return (
            <div key={tx.id} style={{display:'flex', gap:12, padding:'12px 0', borderBottom:'1px solid '+mStyles.border}}>
              <div style={{width:34, height:34, borderRadius:10, background: mStyles.surface, border:'1px solid '+mStyles.border, display:'grid', placeItems:'center', color: c, flexShrink:0}}>
                {tx.type === 'in' ? <MI.ArrowDown size={14}/> : <MI.ArrowUp size={14}/>}
              </div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span style={{fontSize:14}}>{tx.client}</span>
                  <span style={{fontFamily: mStyles.fontMono, fontSize:13, color: tx.type==='in'?mStyles.text:mStyles.text3}}>
                    {tx.type==='out'?'−':''}$ {M.fmt(tx.amount)}
                  </span>
                </div>
                <div style={{display:'flex', justifyContent:'space-between', marginTop:3, fontSize:11.5, color: mStyles.text3}}>
                  <span>{tx.concept}</span>
                  <span style={{fontFamily: mStyles.fontMono}}>{tx.date.split('·')[1]?.trim()}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </MScreen>
  );
};

window.MOB = { MobLogin, MobHome, MobRoute, MobClient, MobConfirm, MobTransactions, MBottomNav };
