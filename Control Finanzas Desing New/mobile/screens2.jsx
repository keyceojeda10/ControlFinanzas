// Mobile screens — adicionales del cobrador + admin móvil
const mS = {
  bg: '#0a0a0a', surface: '#141414', surface2: '#1a1a1a',
  border: '#1f1f1f', text: '#fafafa', text2: '#a1a1a1', text3: '#6b6b6b',
  accent: '#d4ff3a', danger: '#f87171', success: '#4ade80', warning: '#fbbf24', info:'#60a5fa',
  font: "'Geist', system-ui, sans-serif",
  fontMono: "'Geist Mono', monospace",
  fontSerif: "'Instrument Serif', serif",
};

const M2 = window.MOCK;
const MI2 = window.Icons;

// Re-use MTopBar / MIconBtn pattern from screens.jsx (defined here for isolation)
const M2TopBar = ({ title, left, right, sub }) => (
  <div style={{padding:'8px 18px 14px', display:'flex', alignItems:'center', gap:12, position:'sticky', top:54, background:mS.bg, zIndex:5}}>
    {left}
    <div style={{flex:1, minWidth:0}}>
      {title && <div style={{fontFamily:mS.fontSerif, fontSize:26, lineHeight:1, letterSpacing:'-0.015em'}}>{title}</div>}
      {sub && <div style={{fontSize:12, color:mS.text3, marginTop:3}}>{sub}</div>}
    </div>
    {right}
  </div>
);

const M2IconBtn = ({ children, accent }) => (
  <button style={{width:38, height:38, borderRadius:10, border:'1px solid '+mS.border, background: accent?mS.accent:mS.surface, color: accent?'#000':mS.text2, display:'grid', placeItems:'center', cursor:'pointer'}}>{children}</button>
);

const M2Screen = ({ children, style }) => (
  <div style={{background: mS.bg, color: mS.text, minHeight:'100%', fontFamily: mS.font, fontSize: 14, letterSpacing:'-0.005em', paddingTop: 54, ...style}}>{children}</div>
);

// =================== Perfil del cliente (mobile) ===================
const MobClientProfile = () => (
  <M2Screen>
    <M2TopBar
      left={<M2IconBtn><MI2.Chevron size={16} style={{transform:'rotate(180deg)'}}/></M2IconBtn>}
      right={<M2IconBtn><MI2.More size={16}/></M2IconBtn>}
    />
    <div style={{padding:'0 20px 100px'}}>
      <div style={{textAlign:'center', marginBottom: 18}}>
        <div style={{width:84, height:84, borderRadius:'50%', background:'linear-gradient(135deg, #60a5fa, #a78bfa)', display:'grid', placeItems:'center', fontFamily: mS.fontMono, fontSize:24, color:'#000', fontWeight:600, margin:'0 auto 14px'}}>MR</div>
        <div style={{fontFamily: mS.fontSerif, fontSize:32, lineHeight:1, letterSpacing:'-0.015em'}}>Marisol Ramírez</div>
        <div style={{fontSize:13, color: mS.text3, marginTop:6}}>CC 43.118.927 · cliente desde feb 2024</div>
        <div style={{display:'flex', gap:8, justifyContent:'center', marginTop:12}}>
          <span style={{padding:'3px 10px', borderRadius:999, background:'rgba(74,222,128,0.15)', border:'1px solid rgba(74,222,128,0.3)', color: mS.success, fontSize:11, fontFamily: mS.fontMono}}>● Al día</span>
          <span style={{padding:'3px 10px', borderRadius:999, background: mS.surface, border:'1px solid '+mS.border, color: mS.text2, fontSize:11, fontFamily: mS.fontMono}}>★ 96% puntual</span>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8, marginBottom: 22}}>
        {[
          { i: <MI2.Phone size={16}/>, l:'Llamar' },
          { i: <MI2.Tx size={16}/>, l:'WhatsApp' },
          { i: <MI2.Pin size={16}/>, l:'Mapa' },
          { i: <MI2.More size={16}/>, l:'Más' },
        ].map(a => (
          <button key={a.l} style={{display:'flex', flexDirection:'column', alignItems:'center', gap:6, padding:'12px 4px', background: mS.surface, border:'1px solid '+mS.border, borderRadius:12, color: mS.text2, cursor:'pointer'}}>
            {a.i}
            <span style={{fontSize:11}}>{a.l}</span>
          </button>
        ))}
      </div>

      {/* Score card */}
      <div style={{background: mS.surface, border:'1px solid '+mS.border, borderRadius:16, padding:18, marginBottom: 14}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <div style={{fontFamily: mS.fontMono, fontSize:10, color: mS.text3, letterSpacing:'0.08em'}}>SCORE DE CRÉDITO</div>
            <div style={{fontFamily: mS.fontSerif, fontSize:42, lineHeight:1, color: mS.success, marginTop:4}}>824</div>
            <div style={{fontSize:11, color: mS.text3, marginTop:2}}>Excelente · / 900</div>
          </div>
          <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8}}>
            <div style={{display:'flex', alignItems:'flex-end', gap:2, height: 36}}>
              {[40,45,48,52,55,58,62,68,72,78,82,84].map((h,i) => (
                <div key={i} style={{width:4, height: h*0.4, background: i>9?mS.success:mS.surface2, borderRadius:1}}></div>
              ))}
            </div>
            <span style={{fontSize:11, color: mS.success, fontFamily: mS.fontMono}}>+18 vs ene</span>
          </div>
        </div>
      </div>

      {/* Préstamos activos */}
      <div style={{fontSize:11, color: mS.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontFamily: mS.fontMono, marginTop: 8}}>PRÉSTAMO ACTIVO</div>
      <div style={{background: mS.surface, border:'1px solid '+mS.border, borderRadius:16, padding:18, marginBottom:14}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
          <div>
            <div style={{fontFamily: mS.fontMono, fontSize:11, color: mS.text3}}>PR-1209 · INVENTARIO</div>
            <div style={{fontFamily: mS.fontSerif, fontSize:26, marginTop:4}}><span style={{fontFamily: mS.fontMono, fontSize:11, color: mS.text3}}>$</span> 13.600.000</div>
          </div>
          <span style={{padding:'3px 8px', borderRadius:999, background:'rgba(212,255,58,0.1)', border:'1px solid rgba(212,255,58,0.3)', color: mS.accent, fontSize:11, fontFamily: mS.fontMono}}>7/24</span>
        </div>
        <div style={{height:5, background: mS.surface2, borderRadius:2, marginTop:14, overflow:'hidden'}}>
          <div style={{height:'100%', width:'29%', background: mS.accent}}></div>
        </div>
        <div style={{display:'flex', justifyContent:'space-between', marginTop:14, fontSize:11.5}}>
          <div><div style={{color: mS.text3}}>Cuota</div><div className="mono" style={{fontFamily: mS.fontMono, marginTop:2}}>$ 850.000</div></div>
          <div><div style={{color: mS.text3}}>Próxima</div><div style={{fontFamily: mS.fontMono, marginTop:2}}>06 jun</div></div>
          <div><div style={{color: mS.text3}}>Tasa</div><div style={{fontFamily: mS.fontMono, marginTop:2}}>18.4%</div></div>
        </div>
      </div>

      {/* Contactos rápidos */}
      <div style={{fontSize:11, color: mS.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontFamily: mS.fontMono, marginTop: 18}}>CONTACTOS Y REFERENCIAS</div>
      <div style={{background: mS.surface, border:'1px solid '+mS.border, borderRadius:16, overflow:'hidden'}}>
        {[
          { n:'Andrés Ramírez', r:'Esposo (codeudor)', t:'+57 310 442 1188' },
          { n:'María Eugenia Botero', r:'Hermana', t:'+57 314 882 4411' },
          { n:'Jaime Ramírez', r:'Hermano', t:'+57 313 992 1144' },
        ].map((c,i,arr) => (
          <div key={c.n} style={{padding:'14px 16px', borderBottom: i<arr.length-1?'1px solid '+mS.border:'none', display:'flex', gap:12, alignItems:'center'}}>
            <div style={{width:36, height:36, borderRadius:'50%', background: mS.surface2, border:'1px solid '+mS.border, display:'grid', placeItems:'center', fontFamily: mS.fontMono, fontSize:11, color: mS.text2}}>{c.n.split(' ').map(s=>s[0]).slice(0,2).join('')}</div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:13.5}}>{c.n}</div>
              <div style={{fontSize:11.5, color: mS.text3}}>{c.r}</div>
            </div>
            <button style={{width:32, height:32, borderRadius:8, border:'1px solid '+mS.border, background: mS.surface2, color: mS.text2, display:'grid', placeItems:'center'}}><MI2.Phone size={14}/></button>
          </div>
        ))}
      </div>

      {/* Direcciones */}
      <div style={{fontSize:11, color: mS.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontFamily: mS.fontMono, marginTop: 18}}>DIRECCIONES</div>
      <div style={{background: mS.surface, border:'1px solid '+mS.border, borderRadius:16, padding:'14px 16px'}}>
        <div style={{display:'flex', gap:10, alignItems:'flex-start'}}>
          <div style={{width:30, height:30, borderRadius:8, background:'rgba(212,255,58,0.12)', color: mS.accent, display:'grid', placeItems:'center', flexShrink:0}}><MI2.Pin size={14}/></div>
          <div>
            <div style={{fontSize:13.5}}>Residencia · Belén</div>
            <div style={{fontSize:11.5, color: mS.text3, marginTop:2}}>Cra 43 #18-22, Medellín</div>
          </div>
        </div>
        <div style={{height:1, background: mS.border, margin:'12px 0'}}></div>
        <div style={{display:'flex', gap:10, alignItems:'flex-start'}}>
          <div style={{width:30, height:30, borderRadius:8, background: mS.surface2, color: mS.text2, display:'grid', placeItems:'center', flexShrink:0}}><MI2.Pin size={14}/></div>
          <div>
            <div style={{fontSize:13.5}}>Negocio · El Castillo</div>
            <div style={{fontSize:11.5, color: mS.text3, marginTop:2}}>Cl 30 #65-12, Medellín</div>
          </div>
        </div>
      </div>
    </div>
  </M2Screen>
);

// =================== Mapa fullscreen con navegación turn-by-turn ===================
const MobMapNav = () => (
  <div style={{background: mS.bg, height:'100%', position:'relative', fontFamily: mS.font, color: mS.text}}>
    {/* Map */}
    <svg width="100%" height="100%" style={{position:'absolute', inset:0}} viewBox="0 0 400 844" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="mfn-grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#1a1a1a" strokeWidth="0.6"/>
        </pattern>
      </defs>
      <rect width="400" height="844" fill="#0e0e0e"/>
      <rect width="400" height="844" fill="url(#mfn-grid)"/>

      {/* Streets */}
      <path d="M-50 200 Q150 180 250 220 T450 280" stroke="#2a2a2a" strokeWidth="36" fill="none" opacity="0.5"/>
      <path d="M-50 480 Q200 460 400 500 T500 520" stroke="#2a2a2a" strokeWidth="28" fill="none" opacity="0.5"/>
      <path d="M-50 700 Q200 680 450 720" stroke="#2a2a2a" strokeWidth="22" fill="none" opacity="0.5"/>
      <path d="M120 -50 Q130 400 100 844" stroke="#2a2a2a" strokeWidth="30" fill="none" opacity="0.5"/>
      <path d="M280 -50 Q290 400 320 844" stroke="#2a2a2a" strokeWidth="24" fill="none" opacity="0.5"/>

      {/* Route path */}
      <path d="M 200 700 Q 220 580 200 480 L 130 360 Q 130 280 200 220" stroke={mS.accent} strokeWidth="4" fill="none" strokeLinecap="round"/>
      <path d="M 200 700 Q 220 580 200 480 L 130 360 Q 130 280 200 220" stroke={mS.bg} strokeWidth="1.5" fill="none" strokeLinecap="round"/>

      {/* Origin (current location) */}
      <circle cx="200" cy="700" r="20" fill={mS.info} opacity="0.2"/>
      <circle cx="200" cy="700" r="9" fill={mS.bg} stroke={mS.info} strokeWidth="2.5"/>
      <circle cx="200" cy="700" r="3" fill={mS.info}/>

      {/* Next stop */}
      <g>
        <circle cx="200" cy="220" r="22" fill={mS.accent} opacity="0.18"/>
        <circle cx="200" cy="220" r="14" fill={mS.bg} stroke={mS.accent} strokeWidth="2.5"/>
        <text x="200" y="225" fontSize="12" fill={mS.accent} textAnchor="middle" fontFamily={mS.fontMono} fontWeight="600">4</text>
      </g>

      {/* Other stops */}
      {[[60,150,'done',1],[340,150,'done',2],[80,540,'done',3],[340,400,'pending',5],[120,820,'pending',6]].map(([x,y,st,n],i) => {
        const c = st==='done'?mS.success:mS.text3;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="9" fill={mS.bg} stroke={c} strokeWidth="1.5"/>
            <text x={x} y={y+3} fontSize="9" fill={c} textAnchor="middle" fontFamily={mS.fontMono}>{n}</text>
          </g>
        );
      })}
    </svg>

    {/* Top instruction card */}
    <div style={{position:'absolute', top:54, left:14, right:14, padding:18, background:'rgba(20,20,20,0.92)', backdropFilter:'blur(20px)', borderRadius:18, border:'1px solid '+mS.border}}>
      <div style={{display:'flex', gap:14, alignItems:'center'}}>
        <div style={{width:54, height:54, borderRadius:14, background: mS.accent, display:'grid', placeItems:'center', color:'#000', flexShrink:0}}>
          <MI2.ArrowUp size={28} strokeWidth={2.5}/>
        </div>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontFamily: mS.fontSerif, fontSize:30, lineHeight:1}}>800 m</div>
          <div style={{fontSize:13, color: mS.text2, marginTop:4}}>Continúa por <strong style={{color: mS.text}}>Cra 43</strong></div>
        </div>
      </div>
      <div style={{height:1, background: mS.border, margin:'14px 0'}}></div>
      <div style={{display:'flex', gap:10, alignItems:'center', fontSize:12, color: mS.text3}}>
        <span style={{width:6, height:6, borderRadius:'50%', background: mS.text3}}></span>
        <span>Luego: Gira a la derecha en Cl 18</span>
      </div>
    </div>

    {/* Bottom destination card */}
    <div style={{position:'absolute', bottom:30, left:14, right:14}}>
      <div style={{padding:16, background:'rgba(20,20,20,0.92)', backdropFilter:'blur(20px)', borderRadius:18, border:'1px solid '+mS.border, marginBottom:10}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
          <div>
            <div style={{fontFamily: mS.fontMono, fontSize:10, color: mS.text3, letterSpacing:'0.08em'}}>PARADA 04 / 08</div>
            <div style={{fontFamily: mS.fontSerif, fontSize:22, marginTop:2}}>Marisol Ramírez</div>
            <div style={{fontSize:12, color: mS.text3}}>Cra 43 #18-22, Belén</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontFamily: mS.fontMono, fontSize:10, color: mS.text3}}>LLEGADA</div>
            <div style={{fontFamily: mS.fontSerif, fontSize:22, marginTop:2}}>4 min</div>
          </div>
        </div>
      </div>
      <div style={{display:'flex', gap:8}}>
        <button style={{width:50, height:50, borderRadius:14, background: mS.surface, border:'1px solid '+mS.border, color: mS.danger, display:'grid', placeItems:'center'}}>
          <MI2.X size={20}/>
        </button>
        <button style={{flex:1, height:50, borderRadius:14, background: mS.accent, color:'#000', border:'none', fontSize:15, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:8}}>
          <MI2.Pin size={16}/> Llegué — Cobrar
        </button>
      </div>
    </div>

    {/* Top recenter button */}
    <button style={{position:'absolute', top: 200, right: 14, width:44, height:44, borderRadius:12, background:'rgba(20,20,20,0.9)', backdropFilter:'blur(12px)', border:'1px solid '+mS.border, color: mS.accent, display:'grid', placeItems:'center'}}>
      <MI2.Pin size={18}/>
    </button>
  </div>
);

// =================== Cobro en efectivo con calculadora + foto ===================
const MobCashCollect = () => (
  <M2Screen>
    <M2TopBar
      left={<M2IconBtn><MI2.Chevron size={16} style={{transform:'rotate(180deg)'}}/></M2IconBtn>}
      title="Cobro en efectivo"
      sub="Marisol Ramírez · cuota $850.000"
    />
    <div style={{padding:'0 20px 100px'}}>
      {/* Amount display */}
      <div style={{background: mS.surface, border:'1px solid '+mS.border, borderRadius:18, padding:'22px 20px', marginBottom: 14}}>
        <div style={{fontFamily: mS.fontMono, fontSize:10, color: mS.text3, letterSpacing:'0.08em'}}>RECIBIDO</div>
        <div style={{fontFamily: mS.fontSerif, fontSize:54, lineHeight:1, marginTop:4, letterSpacing:'-0.02em'}}>
          <span style={{fontFamily: mS.fontMono, fontSize:16, color: mS.text3, verticalAlign:14}}>$</span> 1.000.000
        </div>
        <div style={{height:1, background: mS.border, margin:'18px 0'}}></div>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
          <div>
            <div style={{fontFamily: mS.fontMono, fontSize:10, color: mS.text3, letterSpacing:'0.08em'}}>CAMBIO A DEVOLVER</div>
            <div style={{fontFamily: mS.fontSerif, fontSize:32, color: mS.accent, marginTop:2}}><span style={{fontFamily: mS.fontMono, fontSize:12, color: mS.text3}}>$</span> 150.000</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontFamily: mS.fontMono, fontSize:10, color: mS.text3}}>CUOTA</div>
            <div style={{fontFamily: mS.fontMono, fontSize:14, marginTop:2}}>$ 850.000</div>
          </div>
        </div>
      </div>

      {/* Bill breakdown */}
      <div style={{fontSize:11, color: mS.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontFamily: mS.fontMono}}>DESGLOSE DE BILLETES</div>
      <div style={{background: mS.surface, border:'1px solid '+mS.border, borderRadius:14, padding:'10px 14px', marginBottom:14}}>
        {[
          { v:100000, c:8, t:800000 },
          { v:50000, c:4, t:200000 },
        ].map((b,i,arr) => (
          <div key={b.v} style={{display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom: i<arr.length-1?'1px solid '+mS.border:'none'}}>
            <div style={{display:'flex', gap:8, alignItems:'center'}}>
              <div style={{padding:'2px 6px', borderRadius:4, background: mS.surface2, fontFamily: mS.fontMono, fontSize:11}}>${b.v/1000}k</div>
              <span style={{fontSize:13}}>× {b.c}</span>
            </div>
            <span style={{fontFamily: mS.fontMono, fontSize:13}}>$ {b.t.toLocaleString('es-CO')}</span>
          </div>
        ))}
      </div>

      {/* Cambio breakdown */}
      <div style={{fontSize:11, color: mS.accent, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontFamily: mS.fontMono}}>CAMBIO SUGERIDO</div>
      <div style={{background:'rgba(212,255,58,0.06)', border:'1px solid rgba(212,255,58,0.2)', borderRadius:14, padding:'12px 14px', marginBottom:18, display:'flex', gap:8, flexWrap:'wrap'}}>
        {[
          { v:'$100k', c:1 }, { v:'$50k', c:1 },
        ].map(b => (
          <div key={b.v} style={{padding:'4px 10px', borderRadius:6, background: mS.surface, border:'1px solid '+mS.border, fontFamily: mS.fontMono, fontSize:12}}>
            {b.c} × {b.v}
          </div>
        ))}
      </div>

      {/* Voucher photo */}
      <div style={{fontSize:11, color: mS.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontFamily: mS.fontMono}}>EVIDENCIA</div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom: 20}}>
        <div style={{aspectRatio:'1/1', borderRadius:14, background:'linear-gradient(135deg, #1a1a1a, #0a0a0a)', border:'1px solid '+mS.border, display:'grid', placeItems:'center', color: mS.text3, position:'relative', overflow:'hidden'}}>
          <div style={{position:'absolute', inset:0, background:`repeating-linear-gradient(135deg, ${mS.surface2} 0 8px, ${mS.surface} 8px 16px)`, opacity:0.3}}></div>
          <div style={{position:'relative', textAlign:'center'}}>
            <div style={{fontFamily: mS.fontMono, fontSize:10}}>FOTO RECIBO</div>
            <div style={{marginTop:6, fontFamily: mS.fontSerif, color: mS.success, fontSize:22}}>✓</div>
          </div>
        </div>
        <div style={{aspectRatio:'1/1', borderRadius:14, background: mS.surface, border:'1px dashed '+mS.border, display:'grid', placeItems:'center', color: mS.text3, cursor:'pointer'}}>
          <div style={{textAlign:'center'}}>
            <MI2.Plus size={20}/>
            <div style={{fontFamily: mS.fontMono, fontSize:10, marginTop:6}}>FOTO BILLETES</div>
          </div>
        </div>
      </div>

      <button style={{width:'100%', padding:'16px', borderRadius:14, background: mS.accent, color:'#000', border:'none', fontSize:15, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:8}}>
        <MI2.Check size={18}/> Confirmar y dar cambio
      </button>
    </div>
  </M2Screen>
);

// =================== Reagendar visita ===================
const MobReschedule = () => (
  <div style={{background:'rgba(0,0,0,0.6)', backdropFilter:'blur(6px)', minHeight:'100%', position:'relative', paddingTop: 280, fontFamily: mS.font, color: mS.text}}>
    {/* Background simulated route screen blur */}
    <div style={{position:'absolute', inset:0, opacity:0.3, padding: '54px 18px'}}>
      <div style={{fontFamily: mS.fontSerif, fontSize:26}}>Mi ruta</div>
    </div>

    {/* Modal */}
    <div style={{background: mS.surface, borderTopLeftRadius: 26, borderTopRightRadius:26, padding:'14px 20px 30px', position:'absolute', bottom:0, left:0, right:0, minHeight: 560}}>
      <div style={{width:36, height:4, background: mS.border, borderRadius:2, margin:'0 auto 18px'}}></div>

      <div style={{fontFamily: mS.fontSerif, fontSize:30, lineHeight:1.1, letterSpacing:'-0.015em'}}>Reagendar <span style={{color: mS.accent, fontStyle:'italic'}}>visita</span></div>
      <div style={{color: mS.text3, fontSize:13, marginTop:4, marginBottom:22}}>Marisol Ramírez · cuota PR-1209</div>

      <div style={{fontSize:11, color: mS.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontFamily: mS.fontMono}}>MOTIVO</div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom: 22}}>
        {[
          { l:'No estaba en casa', sel:true },
          { l:'Pidió aplazar' },
          { l:'Negocio cerrado' },
          { l:'Promesa de pago' },
          { l:'Cliente enfermo' },
          { l:'Otro' },
        ].map((m,i) => (
          <div key={m.l} style={{
            padding:'10px 12px', borderRadius:10,
            background: m.sel?'rgba(212,255,58,0.1)':mS.surface2,
            border:'1px solid '+(m.sel?mS.accent:mS.border),
            color: m.sel?mS.accent:mS.text2, textAlign:'center', fontSize:13,
          }}>{m.l}</div>
        ))}
      </div>

      <div style={{fontSize:11, color: mS.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontFamily: mS.fontMono}}>NUEVA FECHA</div>
      <div style={{display:'flex', gap:8, marginBottom: 16}}>
        {[
          { d:'Hoy', t:'18:00', sel:false },
          { d:'Mañana', t:'09:00', sel:true },
          { d:'Lun 26', t:'09:00' },
          { d:'Mar 27', t:'09:00' },
        ].map(d => (
          <div key={d.d+d.t} style={{
            flex:1, padding:'10px 4px', borderRadius:10,
            background: d.sel?'rgba(212,255,58,0.1)':mS.surface2,
            border:'1px solid '+(d.sel?mS.accent:mS.border),
            textAlign:'center'
          }}>
            <div style={{fontSize:13, color: d.sel?mS.accent:mS.text}}>{d.d}</div>
            <div style={{fontSize:11, color: mS.text3, marginTop:2, fontFamily: mS.fontMono}}>{d.t}</div>
          </div>
        ))}
      </div>

      <div style={{fontSize:11, color: mS.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontFamily: mS.fontMono}}>NOTA (OPCIONAL)</div>
      <textarea placeholder="Detalle para tu jefe o próxima visita…" style={{width:'100%', minHeight: 70, background: mS.surface2, border:'1px solid '+mS.border, borderRadius:12, padding:12, color: mS.text, fontFamily: mS.font, fontSize:13, resize:'none'}}></textarea>

      <div style={{display:'flex', gap:10, marginTop: 18}}>
        <button style={{flex:1, padding:'14px', borderRadius:12, background: mS.surface2, border:'1px solid '+mS.border, color: mS.text, fontSize:14}}>Cancelar</button>
        <button style={{flex:2, padding:'14px', borderRadius:12, background: mS.accent, color:'#000', border:'none', fontSize:14, fontWeight:600}}>Reagendar visita</button>
      </div>
    </div>
  </div>
);

// =================== Notificaciones ===================
const MobNotifications = () => {
  const groups = [
    { d:'Hoy', items: [
      { i: <MI2.Check size={14}/>, c: mS.success, t:'Pago confirmado', sub:'Marisol Ramírez · $850.000 · Nequi', when:'14:32', unread:true },
      { i: <MI2.Sparkles size={14}/>, c: mS.accent, t:'Insight IA', sub:'Diana Castaño suele pagar después de las 11am', when:'12:00' },
      { i: <MI2.Bell size={14}/>, c: mS.warning, t:'Recordatorio', sub:'5 paradas pendientes en tu ruta', when:'09:00' },
    ]},
    { d:'Ayer', items: [
      { i: <MI2.X size={14}/>, c: mS.danger, t:'Cobro fallido', sub:'Esperanza Gil · sin fondos', when:'18:04' },
      { i: <MI2.User size={14}/>, c: mS.info, t:'Mensaje del jefe', sub:'Diana Mejía: ¡Excelente cierre de mes!', when:'17:30' },
      { i: <MI2.Check size={14}/>, c: mS.success, t:'Ruta actualizada', sub:'Se agregaron 2 visitas nuevas para mañana', when:'14:12' },
    ]},
    { d:'Esta semana', items: [
      { i: <MI2.Receipt size={14}/>, c: mS.text2, t:'Comisión depositada', sub:'$ 1.420.000 a tu cuenta Bancolombia', when:'lun 19' },
      { i: <MI2.Sparkles size={14}/>, c: mS.accent, t:'Cliente premium', sub:'Carlos Mendoza solicitó nuevo préstamo', when:'dom 18' },
    ]},
  ];
  return (
    <M2Screen>
      <M2TopBar
        title="Notificaciones"
        sub="3 sin leer"
        right={<M2IconBtn><MI2.Check size={16}/></M2IconBtn>}
      />
      <div style={{padding:'0 18px 100px'}}>
        {groups.map((g,gi) => (
          <div key={g.d} style={{marginBottom: 14}}>
            <div style={{fontSize:11, color: mS.text3, textTransform:'uppercase', letterSpacing:'0.08em', margin:'14px 0 8px', fontFamily: mS.fontMono}}>{g.d}</div>
            <div style={{background: mS.surface, border:'1px solid '+mS.border, borderRadius:14, overflow:'hidden'}}>
              {g.items.map((n,i,arr) => (
                <div key={i} style={{padding:'14px 14px', display:'flex', gap:12, borderBottom: i<arr.length-1?'1px solid '+mS.border:'none', background: n.unread?'rgba(212,255,58,0.04)':'transparent'}}>
                  <div style={{width:32, height:32, borderRadius:8, background:`${n.c}1a`, color: n.c, display:'grid', placeItems:'center', flexShrink:0}}>
                    {n.i}
                  </div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
                      <span style={{fontSize:13.5}}>{n.t}</span>
                      <span style={{fontSize:11, color: mS.text3, fontFamily: mS.fontMono}}>{n.when}</span>
                    </div>
                    <div style={{fontSize:12, color: mS.text3, marginTop:3}}>{n.sub}</div>
                  </div>
                  {n.unread && <div style={{width:6, height:6, borderRadius:'50%', background: mS.accent, marginTop:13}}></div>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </M2Screen>
  );
};

// =================== Cierre de día ===================
const MobEndOfDay = () => (
  <M2Screen>
    <M2TopBar title={<>Cierre del <span style={{color: mS.accent, fontStyle:'italic'}}>día</span></>} sub="Diego Ortiz · sábado 23 mayo"/>
    <div style={{padding:'0 20px 100px'}}>
      {/* Hero summary */}
      <div style={{background: mS.surface, border:'1px solid '+mS.border, borderRadius:18, padding:22, marginBottom: 14, textAlign:'center'}}>
        <div style={{fontFamily: mS.fontMono, fontSize:10, color: mS.accent, letterSpacing:'0.08em'}}>RECAUDO HOY</div>
        <div style={{fontFamily: mS.fontSerif, fontSize:60, lineHeight:1, marginTop:6, letterSpacing:'-0.02em'}}>
          <span style={{fontFamily: mS.fontMono, fontSize:18, color: mS.text3, verticalAlign:18}}>$</span>4.8<span style={{color: mS.text3}}>M</span>
        </div>
        <div style={{fontSize:13, color: mS.text2, marginTop:8}}>de $5.9M meta · <span style={{color: mS.accent}}>+ $410k vs ayer</span></div>
        <div style={{display:'flex', gap:6, justifyContent:'center', marginTop:14}}>
          <div style={{width: 50, height:4, background: mS.accent, borderRadius:2}}></div>
          <div style={{width: 50, height:4, background: mS.accent, borderRadius:2}}></div>
          <div style={{width: 50, height:4, background: mS.accent, borderRadius:2}}></div>
          <div style={{width: 50, height:4, background: mS.surface2, borderRadius:2}}></div>
          <div style={{width: 50, height:4, background: mS.surface2, borderRadius:2}}></div>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom: 14}}>
        {[
          { l:'COBROS', v:'6', s:'+1 vs ayer', c: mS.text },
          { l:'EFECTIVO', v:'$2.4M', s:'a entregar', c: mS.accent },
          { l:'REAGENDADAS', v:'2', s:'lun y mar', c: mS.warning },
          { l:'NO ENCONTRADOS', v:'0', s:'¡100% efectividad!', c: mS.success },
        ].map(s => (
          <div key={s.l} style={{background: mS.surface, border:'1px solid '+mS.border, borderRadius:14, padding:14}}>
            <div style={{fontFamily: mS.fontMono, fontSize:10, color: mS.text3, letterSpacing:'0.08em'}}>{s.l}</div>
            <div style={{fontFamily: mS.fontSerif, fontSize:26, marginTop:4, color: s.c}}>{s.v}</div>
            <div style={{fontSize:11, color: mS.text3, marginTop:2}}>{s.s}</div>
          </div>
        ))}
      </div>

      {/* Efectivo a entregar */}
      <div style={{fontSize:11, color: mS.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontFamily: mS.fontMono, marginTop: 14}}>EFECTIVO A ENTREGAR</div>
      <div style={{background: mS.surface, border:'1px solid '+mS.border, borderRadius:14, padding:'14px 16px', marginBottom: 14}}>
        {[
          { v:'$100k', c:18, t:1800000 },
          { v:'$50k', c:8, t:400000 },
          { v:'$20k', c:10, t:200000 },
        ].map((b,i,a) => (
          <div key={b.v} style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom: i<a.length-1?'1px solid '+mS.border:'none'}}>
            <div style={{display:'flex', gap:8}}>
              <span style={{padding:'1px 6px', borderRadius:4, background: mS.surface2, fontFamily: mS.fontMono, fontSize:11}}>{b.v}</span>
              <span style={{fontSize:13}}>× {b.c}</span>
            </div>
            <span style={{fontFamily: mS.fontMono, fontSize:13}}>$ {b.t.toLocaleString('es-CO')}</span>
          </div>
        ))}
        <div style={{display:'flex', justifyContent:'space-between', paddingTop:10, marginTop:8, borderTop:'1px solid '+mS.border, alignItems:'baseline'}}>
          <span style={{fontSize:13, color: mS.text3}}>Total efectivo</span>
          <span style={{fontFamily: mS.fontSerif, fontSize:24}}>$ 2.400.000</span>
        </div>
      </div>

      {/* Comisión calculada */}
      <div style={{background:'rgba(212,255,58,0.06)', border:'1px solid rgba(212,255,58,0.2)', borderRadius:14, padding:'14px 16px', marginBottom: 20}}>
        <div style={{display:'flex', justifyContent:'space-between'}}>
          <div>
            <div style={{fontFamily: mS.fontMono, fontSize:10, color: mS.accent, letterSpacing:'0.08em'}}>TU COMISIÓN HOY</div>
            <div style={{fontSize:11, color: mS.text3, marginTop:2}}>3.5% sobre recaudo</div>
          </div>
          <div style={{fontFamily: mS.fontSerif, fontSize:30, color: mS.accent}}>$ 168.000</div>
        </div>
      </div>

      <button style={{width:'100%', padding:'16px', borderRadius:14, background: mS.accent, color:'#000', border:'none', fontSize:15, fontWeight:600}}>
        Cerrar día y entregar efectivo
      </button>
      <button style={{width:'100%', padding:'14px', borderRadius:14, background: 'transparent', color: mS.text3, border:'none', fontSize:13, marginTop:4}}>
        Necesito ajustar algo
      </button>
    </div>
  </M2Screen>
);

// =================== Pagos SaaS del prestamista (admin móvil) ===================
const MobBilling = () => (
  <M2Screen>
    <M2TopBar
      left={<M2IconBtn><MI2.Chevron size={16} style={{transform:'rotate(180deg)'}}/></M2IconBtn>}
      title={<>Mi <span style={{color: mS.accent, fontStyle:'italic'}}>plan</span></>}
      sub="Préstamos Andina · Pro"
    />
    <div style={{padding:'0 20px 100px'}}>
      {/* Current plan card */}
      <div style={{background:'linear-gradient(135deg, #1a1a1a, #0a0a0a)', border:'1px solid '+mS.border, borderRadius:18, padding:'20px 22px', marginBottom: 14, position:'relative', overflow:'hidden'}}>
        <div style={{position:'absolute', top:-30, right:-30, width:140, height:140, borderRadius:'50%', background:`radial-gradient(circle, rgba(212,255,58,0.12), transparent 70%)`}}></div>
        <div style={{fontFamily: mS.fontMono, fontSize:10, color: mS.accent, letterSpacing:'0.08em'}}>PLAN ACTUAL</div>
        <div style={{fontFamily: mS.fontSerif, fontSize:42, lineHeight:1, marginTop:6}}>Pro</div>
        <div style={{fontSize:13, color: mS.text3, marginTop:6}}>Hasta 2.000 clientes · 10 cobradores</div>
        <div style={{display:'flex', alignItems:'baseline', gap:6, marginTop:14}}>
          <span style={{fontFamily: mS.fontMono, fontSize:14, color: mS.text3}}>$</span>
          <span style={{fontFamily: mS.fontSerif, fontSize:34}}>590.000</span>
          <span style={{fontSize:11, color: mS.text3, fontFamily: mS.fontMono, marginLeft:4}}>/MES + IVA</span>
        </div>
      </div>

      {/* Next billing */}
      <div style={{background: mS.surface, border:'1px solid '+mS.border, borderRadius:14, padding:16, marginBottom: 14}}>
        <div style={{display:'flex', justifyContent:'space-between'}}>
          <div>
            <div style={{fontFamily: mS.fontMono, fontSize:10, color: mS.text3, letterSpacing:'0.08em'}}>PRÓXIMO COBRO</div>
            <div style={{fontFamily: mS.fontSerif, fontSize:24, marginTop:2}}>$ 702.100</div>
            <div style={{fontSize:11.5, color: mS.text3, marginTop:2}}>12 de junio · IVA incluido</div>
          </div>
          <div style={{display:'flex', alignItems:'center'}}>
            <div style={{width:46, height:32, borderRadius:5, background:'linear-gradient(135deg, #1a1a1a, #333)', display:'grid', placeItems:'center', fontFamily: mS.fontMono, fontSize:9, color: mS.text2}}>VISA</div>
          </div>
        </div>
      </div>

      {/* Usage gauges */}
      <div style={{fontSize:11, color: mS.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontFamily: mS.fontMono, marginTop: 14}}>USO ACTUAL</div>
      <div style={{background: mS.surface, border:'1px solid '+mS.border, borderRadius:14, padding:'4px 16px', marginBottom: 14}}>
        {[
          { l:'Clientes', u:'1.247', t:'2.000', pct:62 },
          { l:'Cobradores', u:'4', t:'10', pct:40 },
          { l:'Almacenamiento', u:'4.2 GB', t:'25 GB', pct:17 },
          { l:'SMS / WhatsApp', u:'1.840', t:'5.000', pct:37 },
        ].map((u,i,a) => (
          <div key={u.l} style={{padding:'12px 0', borderBottom: i<a.length-1?'1px solid '+mS.border:'none'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:6}}>
              <span style={{fontSize:13, color: mS.text2}}>{u.l}</span>
              <span style={{fontFamily: mS.fontMono, fontSize:12}}>{u.u} <span style={{color: mS.text3}}>/ {u.t}</span></span>
            </div>
            <div style={{height:3, background: mS.surface2, borderRadius:2, overflow:'hidden'}}>
              <div style={{height:'100%', width: u.pct+'%', background: u.pct>85?mS.danger:u.pct>60?mS.warning:mS.accent}}></div>
            </div>
          </div>
        ))}
      </div>

      <button style={{width:'100%', padding:'14px', borderRadius:14, background: mS.accent, color:'#000', border:'none', fontSize:14, fontWeight:600, marginBottom: 8}}>
        Mejorar a Enterprise
      </button>
      <button style={{width:'100%', padding:'12px', borderRadius:14, background: mS.surface, border:'1px solid '+mS.border, color: mS.text, fontSize:13}}>
        Ver facturas anteriores
      </button>
    </div>
  </M2Screen>
);

window.MOB2 = { MobClientProfile, MobMapNav, MobCashCollect, MobReschedule, MobNotifications, MobEndOfDay, MobBilling };
