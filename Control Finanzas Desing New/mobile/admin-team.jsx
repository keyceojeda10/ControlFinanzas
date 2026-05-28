// Mobile ADMIN — Equipo: cobradores, crear, asignación de rutas con IA
const tS = window.aS || {
  bg: '#0a0a0a', surface: '#141414', surface2: '#1a1a1a', border: '#1f1f1f',
  text: '#fafafa', text2: '#a1a1a1', text3: '#6b6b6b',
  accent: '#d4ff3a', danger: '#f87171', success: '#4ade80', warning: '#fbbf24', info:'#60a5fa',
  font: "'Geist', system-ui, sans-serif",
  fontMono: "'Geist Mono', monospace",
  fontSerif: "'Instrument Serif', serif",
};
const tI = window.Icons;
const tM = window.MOCK;

const TScreen = ({ children, style }) => (
  <div style={{background: tS.bg, color: tS.text, minHeight:'100%', fontFamily: tS.font, fontSize: 14, letterSpacing:'-0.005em', paddingTop: 54, ...style}}>{children}</div>
);
const TTop = ({ title, sub, left, right }) => (
  <div style={{padding:'8px 20px 14px', display:'flex', alignItems:'center', gap:12, position:'sticky', top:54, background:tS.bg, zIndex:5}}>
    {left}
    <div style={{flex:1, minWidth:0}}>
      {title && <div style={{fontFamily:tS.fontSerif, fontSize:28, lineHeight:1.05, letterSpacing:'-0.015em'}}>{title}</div>}
      {sub && <div style={{fontSize:12, color:tS.text3, marginTop:3}}>{sub}</div>}
    </div>
    {right}
  </div>
);
const TIco = ({ children, accent }) => (
  <button style={{width:38, height:38, borderRadius:10, border:'1px solid '+tS.border, background: accent?tS.accent:tS.surface, color: accent?'#000':tS.text2, display:'grid', placeItems:'center'}}>{children}</button>
);

// ===== 5. EQUIPO — Lista cobradores =====
const AdminTeam = () => (
  <TScreen>
    <TTop
      title="Equipo"
      sub="4 cobradores · 1.247 clientes asignados"
      right={<TIco accent><tI.Plus size={16}/></TIco>}
    />
    <div style={{padding:'0 18px 110px'}}>
      {/* Summary card */}
      <div style={{background: tS.surface, border:'1px solid '+tS.border, borderRadius:18, padding:18, marginBottom: 14}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
          <div>
            <div style={{fontFamily: tS.fontMono, fontSize:10, color: tS.text3, letterSpacing:'0.08em'}}>RECAUDADO ESTE MES</div>
            <div style={{fontFamily: tS.fontSerif, fontSize:36, lineHeight:1, marginTop:6}}>
              <span style={{fontFamily: tS.fontMono, fontSize:13, color: tS.text3, verticalAlign:8}}>$</span>321<span style={{color: tS.text3}}>M</span>
            </div>
          </div>
          <span style={{padding:'4px 10px', borderRadius:999, background:'rgba(74,222,128,0.15)', border:'1px solid rgba(74,222,128,0.3)', color: tS.success, fontSize:11, fontFamily: tS.fontMono}}>● +12%</span>
        </div>
        <div style={{display:'flex', gap:8, marginTop:14}}>
          {tM.COBRADORES.map(c => (
            <div key={c.n} style={{flex: c.recaudo, background: c.color, height:6, borderRadius:1}}></div>
          ))}
        </div>
      </div>

      {/* Cobradores list */}
      {tM.COBRADORES.map((c,i) => (
        <div key={c.n} style={{background: tS.surface, border:'1px solid '+tS.border, borderRadius:16, padding:16, marginBottom:10}}>
          <div style={{display:'flex', gap:12, alignItems:'center', marginBottom: 14}}>
            <div style={{width:44, height:44, borderRadius:'50%', background: c.color, color:'#000', display:'grid', placeItems:'center', fontFamily: tS.fontMono, fontSize:14, fontWeight:600, position:'relative'}}>
              {c.n.split(' ').map(s=>s[0]).slice(0,2).join('')}
              <span style={{position:'absolute', bottom:-1, right:-1, width:12, height:12, borderRadius:'50%', background: tS.success, border:'2px solid '+tS.bg}}></span>
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:14}}>{c.n}</div>
              <div style={{fontSize:11.5, color: tS.text3}}>Ruta {c.zone} · {Math.floor(c.recaudo / 1500000)} clientes</div>
            </div>
            <button style={{width:34, height:34, borderRadius:10, background: tS.surface2, border:'1px solid '+tS.border, color: tS.text2, display:'grid', placeItems:'center'}}><tI.More size={14}/></button>
          </div>

          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom: 12}}>
            <div>
              <div style={{fontSize:10, color: tS.text3, fontFamily: tS.fontMono, letterSpacing:'0.06em'}}>RECAUDO MES</div>
              <div style={{fontFamily: tS.fontMono, fontSize:13, marginTop:2}}>$ {Math.round(c.recaudo/1000000)}M</div>
            </div>
            <div>
              <div style={{fontSize:10, color: tS.text3, fontFamily: tS.fontMono, letterSpacing:'0.06em'}}>EFECTIVIDAD</div>
              <div style={{fontFamily: tS.fontMono, fontSize:13, marginTop:2, color: c.color}}>{c.ef}%</div>
            </div>
            <div>
              <div style={{fontSize:10, color: tS.text3, fontFamily: tS.fontMono, letterSpacing:'0.06em'}}>COMISIÓN</div>
              <div style={{fontFamily: tS.fontMono, fontSize:13, marginTop:2}}>$ {Math.round(c.recaudo*0.035/1000)}k</div>
            </div>
          </div>

          {/* Mini barchart */}
          <div style={{display:'flex', alignItems:'flex-end', gap:2, height: 28, marginBottom:10}}>
            {[40,55,42,68,72,80,78,85,82,c.ef].map((h,j) => (
              <div key={j} style={{flex:1, height: h*0.32, background: j===9?c.color:tS.surface2, borderRadius:1}}></div>
            ))}
          </div>

          <div style={{display:'flex', gap:8}}>
            <button style={{flex:1, padding:'8px', borderRadius:8, background: tS.surface2, border:'1px solid '+tS.border, color: tS.text, fontSize:12}}>Ver perfil</button>
            <button style={{flex:1, padding:'8px', borderRadius:8, background: tS.surface2, border:'1px solid '+tS.border, color: tS.text, fontSize:12}}>Ver ruta hoy</button>
          </div>
        </div>
      ))}
    </div>
  </TScreen>
);

// ===== 6. CREAR COBRADOR =====
const AdminCreateCobrador = () => (
  <TScreen>
    <TTop
      left={<TIco><tI.Chevron size={16} style={{transform:'rotate(180deg)'}}/></TIco>}
      title="Nuevo cobrador"
      sub="Paso 2 de 3 · datos básicos"
    />
    <div style={{padding:'0 20px 110px'}}>
      {/* Progress */}
      <div style={{display:'flex', gap:6, marginBottom:18}}>
        <div style={{flex:1, height:3, background: tS.accent, borderRadius:2}}></div>
        <div style={{flex:1, height:3, background: tS.accent, borderRadius:2}}></div>
        <div style={{flex:1, height:3, background: tS.surface2, borderRadius:2}}></div>
      </div>

      {/* Foto */}
      <div style={{display:'flex', flexDirection:'column', alignItems:'center', marginBottom: 22}}>
        <div style={{width:88, height:88, borderRadius:'50%', background:'linear-gradient(135deg, '+tS.surface+', '+tS.surface2+')', border:'2px dashed '+tS.border, display:'grid', placeItems:'center', position:'relative'}}>
          <tI.Plus size={22} stroke={tS.text3}/>
        </div>
        <button style={{marginTop:10, padding:'6px 14px', borderRadius:8, background:'transparent', border:'1px solid '+tS.border, color: tS.text2, fontSize:12}}>Subir foto</button>
      </div>

      {/* Form fields */}
      {[
        { l:'Nombre completo', v:'Juan Camilo Restrepo', mono:false },
        { l:'Cédula', v:'71.882.119', mono:true },
        { l:'Celular', v:'+57 318 442 8811', mono:true },
        { l:'Correo', v:'juancamilo@prestamos-andina.co', mono:true },
        { l:'Fecha de ingreso', v:'24 mayo 2026', mono:false },
      ].map(f => (
        <div key={f.l} style={{marginBottom:12}}>
          <label style={{fontSize:11, color: tS.text3, textTransform:'uppercase', letterSpacing:'0.08em', fontFamily: tS.fontMono}}>{f.l}</label>
          <div style={{marginTop:6, padding:'12px 14px', background: tS.surface, border:'1px solid '+tS.border, borderRadius:10, fontFamily: f.mono?tS.fontMono:tS.font, fontSize:14}}>{f.v}</div>
        </div>
      ))}

      {/* Ruta asignada */}
      <label style={{fontSize:11, color: tS.text3, textTransform:'uppercase', letterSpacing:'0.08em', fontFamily: tS.fontMono, marginTop: 8}}>RUTA / ZONA ASIGNADA</label>
      <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8, marginTop:6}}>
        {['Norte','Centro','Sur','Occ.','Aburrá','Nueva'].map((z,i) => (
          <div key={z} style={{
            padding:'10px 6px', borderRadius:10, textAlign:'center', fontSize:13,
            background: i===5?'rgba(212,255,58,0.1)':tS.surface,
            border:'1px solid '+(i===5?tS.accent:tS.border),
            color: i===5?tS.accent:tS.text2,
          }}>{z}</div>
        ))}
      </div>

      {/* Comisión */}
      <label style={{fontSize:11, color: tS.text3, textTransform:'uppercase', letterSpacing:'0.08em', fontFamily: tS.fontMono, marginTop: 18, display:'block'}}>ESQUEMA DE COMISIÓN</label>
      <div style={{background: tS.surface, border:'1px solid '+tS.border, borderRadius:12, padding:'14px 16px', marginTop:6}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10}}>
          <span style={{fontSize:13, color: tS.text2}}>% sobre recaudo</span>
          <span style={{fontFamily: tS.fontSerif, fontSize:24, color: tS.accent}}>3.5%</span>
        </div>
        <input type="range" min="2" max="6" defaultValue="3.5" step="0.1" style={{width:'100%', accentColor: tS.accent}}/>
        <div style={{display:'flex', justifyContent:'space-between', marginTop:6, fontSize:10, color: tS.text3, fontFamily: tS.fontMono}}>
          <span>2.0%</span><span>6.0%</span>
        </div>
      </div>

      {/* IA suggestion */}
      <div style={{background:'rgba(212,255,58,0.05)', border:'1px solid rgba(212,255,58,0.2)', borderRadius:12, padding:'12px 14px', marginTop:14, display:'flex', gap:10}}>
        <tI.Sparkles size={14} stroke={tS.accent}/>
        <div style={{flex:1, fontSize:12.5, color: tS.text2}}>
          La IA sugiere asignarle <strong style={{color: tS.text}}>22 clientes de bajo riesgo</strong> en la zona seleccionada para empezar.
        </div>
      </div>

      <button style={{width:'100%', padding:'14px', borderRadius:12, background: tS.accent, color:'#000', border:'none', fontSize:14, fontWeight:600, marginTop:22}}>
        Continuar →
      </button>
    </div>
  </TScreen>
);

// ===== 7. ASIGNAR RUTAS (con IA) =====
const AdminAssignRoutes = () => (
  <TScreen>
    <TTop title={<>Asignar <span style={{color: tS.accent, fontStyle:'italic'}}>rutas</span></>} sub="IA · 1.247 clientes en 4 zonas"/>
    <div style={{padding:'0 18px 110px'}}>
      {/* Sugerencia IA hero */}
      <div style={{background:'linear-gradient(135deg, rgba(212,255,58,0.1), '+tS.surface+')', border:'1px solid rgba(212,255,58,0.3)', borderRadius:18, padding:18, marginBottom: 14}}>
        <div style={{display:'flex', gap:12, alignItems:'flex-start'}}>
          <div style={{width:36, height:36, borderRadius:10, background: tS.accent, color:'#000', display:'grid', placeItems:'center', flexShrink:0}}>
            <tI.Sparkles size={18}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontFamily: tS.fontMono, fontSize:10, color: tS.accent, letterSpacing:'0.08em'}}>OPTIMIZACIÓN IA</div>
            <div style={{fontFamily: tS.fontSerif, fontSize:22, marginTop:2, lineHeight:1.2, letterSpacing:'-0.01em'}}>
              Redistribuye <span style={{color: tS.accent, fontStyle:'italic'}}>4 zonas</span> y aumenta efectividad <span style={{color: tS.accent, fontStyle:'italic'}}>+8%</span>
            </div>
            <div style={{fontSize:12, color: tS.text3, marginTop:6, lineHeight:1.5}}>
              Detecté que la ruta Centro tiene 38% más visitas que Norte. Reasignar 14 clientes mejoraría el recaudo en <strong style={{color: tS.text}}>~$11.2M/mes</strong>.
            </div>
          </div>
        </div>
        <div style={{display:'flex', gap:8, marginTop:14}}>
          <button style={{flex:1, padding:'10px', borderRadius:10, background: tS.accent, color:'#000', border:'none', fontSize:13, fontWeight:500}}>Aplicar sugerencia</button>
          <button style={{padding:'10px 14px', borderRadius:10, background: tS.surface, border:'1px solid '+tS.border, color: tS.text2, fontSize:13}}>Ver mapa</button>
        </div>
      </div>

      {/* Map preview with proposed changes */}
      <div style={{background: tS.surface, border:'1px solid '+tS.border, borderRadius:14, overflow:'hidden', marginBottom:14}}>
        <div style={{height: 180, position:'relative', background: tS.bg, overflow:'hidden'}}>
          <svg width="100%" height="100%" viewBox="0 0 400 180" preserveAspectRatio="xMidYMid slice">
            <defs>
              <pattern id="amg" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke={tS.border} strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="400" height="180" fill="url(#amg)"/>
            <path d="M0 80 Q150 70 250 90 T400 100" stroke="#2a2a2a" strokeWidth="14" fill="none" opacity="0.4"/>
            <path d="M0 140 Q200 130 400 150" stroke="#2a2a2a" strokeWidth="12" fill="none" opacity="0.4"/>
            <path d="M120 0 L 130 180" stroke="#2a2a2a" strokeWidth="14" fill="none" opacity="0.4"/>
            <path d="M270 0 L 280 180" stroke="#2a2a2a" strokeWidth="12" fill="none" opacity="0.4"/>

            {/* Zone overlays */}
            <ellipse cx="80" cy="50" rx="80" ry="40" fill={tS.accent} opacity="0.12"/>
            <ellipse cx="200" cy="60" rx="70" ry="35" fill="#4ade80" opacity="0.12"/>
            <ellipse cx="330" cy="100" rx="70" ry="40" fill="#fbbf24" opacity="0.12"/>
            <ellipse cx="120" cy="140" rx="100" ry="40" fill="#60a5fa" opacity="0.12"/>

            {/* Stops density */}
            {Array.from({length: 32}).map((_,i) => {
              const x = 30 + (i*12) % 360 + Math.sin(i)*15;
              const y = 30 + Math.cos(i*1.3)*40 + (i%4)*30;
              const colors = [tS.accent, '#4ade80', '#fbbf24', '#60a5fa'];
              return <circle key={i} cx={x} cy={y} r="3" fill={colors[i%4]} opacity="0.8"/>;
            })}
          </svg>
          <div style={{position:'absolute', top:10, left:10, padding:'4px 8px', background:'rgba(10,10,10,0.7)', backdropFilter:'blur(8px)', borderRadius:6, fontSize:10, fontFamily: tS.fontMono, color: tS.text2}}>4 ZONAS · 1.247 PARADAS</div>
        </div>
      </div>

      {/* Zonas */}
      <div style={{fontSize:11, color: tS.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontFamily: tS.fontMono}}>BALANCE DE ZONAS</div>
      <div style={{background: tS.surface, border:'1px solid '+tS.border, borderRadius:14, padding:14, marginBottom:14}}>
        {[
          { z:'Norte', cob:'D. Ortiz', cur:382, sug:368, color: tS.accent },
          { z:'Centro', cob:'J. Salazar', cur:412, sug:387, color:'#4ade80', changes:'−25 clientes' },
          { z:'Sur', cob:'M. Tovar', cur:298, sug:312, color:'#fbbf24', changes:'+14 clientes' },
          { z:'Occidente', cob:'L. Vélez', cur:155, sug:180, color:'#60a5fa', changes:'+25 clientes' },
        ].map((r,i,a) => (
          <div key={r.z} style={{padding:'10px 0', borderBottom: i<a.length-1?'1px solid '+tS.border:'none'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
              <div style={{display:'flex', gap:8, alignItems:'center'}}>
                <span style={{width:8, height:8, borderRadius:'50%', background: r.color}}></span>
                <span style={{fontSize:13}}>{r.z}</span>
                <span style={{fontSize:11, color: tS.text3}}>· {r.cob}</span>
              </div>
              <div style={{display:'flex', gap:10, alignItems:'baseline'}}>
                <span style={{fontFamily: tS.fontMono, fontSize:12, color: tS.text3, textDecoration:'line-through'}}>{r.cur}</span>
                <span style={{fontFamily: tS.fontMono, fontSize:14, color: r.color}}>{r.sug}</span>
              </div>
            </div>
            {r.changes && <div style={{fontSize:11, color: tS.text3, marginTop:4, marginLeft:16, fontFamily: tS.fontMono}}>{r.changes}</div>}
          </div>
        ))}
      </div>

      {/* IA impact prediction */}
      <div style={{fontSize:11, color: tS.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontFamily: tS.fontMono}}>IMPACTO PROYECTADO</div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
        {[
          { l:'EFECTIVIDAD', cur:'92%', sug:'+8%', c: tS.success },
          { l:'KM RECORRIDOS', cur:'180/día', sug:'−22%', c: tS.success },
          { l:'CARGA CLIENTES', cur:'σ 26%', sug:'σ 9%', c: tS.success },
          { l:'RECAUDO PROY', cur:'$321M', sug:'+$11.2M', c: tS.accent },
        ].map(k => (
          <div key={k.l} style={{background: tS.surface, border:'1px solid '+tS.border, borderRadius:12, padding:'12px 14px'}}>
            <div style={{fontFamily: tS.fontMono, fontSize:10, color: tS.text3, letterSpacing:'0.06em'}}>{k.l}</div>
            <div style={{fontFamily: tS.fontMono, fontSize:13, marginTop:6, color: tS.text2}}>{k.cur}</div>
            <div style={{fontSize:12, color: k.c, marginTop:2, fontFamily: tS.fontMono}}>↗ {k.sug}</div>
          </div>
        ))}
      </div>
    </div>
  </TScreen>
);

// ===== 8. APROBACIONES DE PRÉSTAMOS =====
const AdminApprovals = () => (
  <TScreen>
    <TTop title={<>Aprobaciones <span style={{color: tS.accent, fontStyle:'italic'}}>pendientes</span></>} sub="5 solicitudes · IA pre-evaluó todas"/>
    <div style={{padding:'0 18px 110px'}}>
      {/* IA summary */}
      <div style={{background:'rgba(212,255,58,0.05)', border:'1px solid rgba(212,255,58,0.2)', borderRadius:14, padding:'14px 16px', marginBottom: 14, display:'flex', gap:12, alignItems:'flex-start'}}>
        <tI.Sparkles size={16} stroke={tS.accent}/>
        <div style={{flex:1, fontSize:12.5, color: tS.text2}}>
          IA recomienda <strong style={{color: tS.success}}>aprobar 3</strong>, revisar 1 y <strong style={{color: tS.danger}}>rechazar 1</strong>. Tap para ver razón.
        </div>
      </div>

      {[
        { c:'Marisol Ramírez', sc:824, m:5000000, p:24, tipo:'Renovación', verdict:'approve', razon:'Cliente recurrente, 96% puntual, score Excelente. Bajo riesgo.', cobr:'Diego O.' },
        { c:'Pedro Hincapié', sc:712, m:3500000, p:18, tipo:'Nuevo', verdict:'approve', razon:'Buen ingreso, sin reportes negativos. Capacidad 28%.', cobr:'Diego O.' },
        { c:'Lucía Vargas', sc:680, m:8000000, p:24, tipo:'Nuevo', verdict:'review', razon:'Capacidad de pago en límite (34%). Pedir comprobante adicional.', cobr:'Mauricio T.' },
        { c:'Iván Cárdenas', sc:758, m:4000000, p:18, tipo:'Renovación', verdict:'approve', razon:'Préstamo previo al día. Cliente leal desde 2024.', cobr:'Diego O.' },
        { c:'Mauricio Pinto', sc:548, m:2000000, p:12, tipo:'Refinanciación', verdict:'reject', razon:'Mora actual 15d en préstamo activo. Score bajo. Alto riesgo.', cobr:'Mauricio T.' },
      ].map((a,i) => {
        const vMap = {
          approve: { c: tS.success, l:'IA: Aprobar', bg:'rgba(74,222,128,0.08)' },
          review:  { c: tS.warning, l:'IA: Revisar', bg:'rgba(251,191,36,0.08)' },
          reject:  { c: tS.danger,  l:'IA: Rechazar', bg:'rgba(248,113,113,0.08)' },
        };
        const v = vMap[a.verdict];
        return (
          <div key={i} style={{background: tS.surface, border:'1px solid '+tS.border, borderRadius:16, padding:16, marginBottom:10}}>
            <div style={{display:'flex', gap:12, alignItems:'center', marginBottom:12}}>
              <div style={{width:42, height:42, borderRadius:'50%', background: tS.surface2, border:'1px solid '+tS.border, display:'grid', placeItems:'center', fontFamily: tS.fontMono, fontSize:12, color: tS.text2}}>{a.c.split(' ').map(s=>s[0]).slice(0,2).join('')}</div>
              <div style={{flex:1}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
                  <span style={{fontSize:14}}>{a.c}</span>
                  <span style={{fontFamily: tS.fontMono, fontSize:13, color: a.sc>=750?tS.success:a.sc>=650?tS.warning:tS.danger}}>{a.sc}</span>
                </div>
                <div style={{fontSize:11.5, color: tS.text3, marginTop:2}}>{a.tipo} · sugerido por {a.cobr}</div>
              </div>
            </div>

            <div style={{display:'flex', gap:12, padding:'10px 0', borderTop:'1px solid '+tS.border, borderBottom:'1px solid '+tS.border, marginBottom:12}}>
              <div style={{flex:1}}>
                <div style={{fontSize:10, color: tS.text3, fontFamily: tS.fontMono, letterSpacing:'0.06em'}}>MONTO</div>
                <div style={{fontFamily: tS.fontSerif, fontSize:20, marginTop:2}}>$ {tM.fmt(a.m)}</div>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:10, color: tS.text3, fontFamily: tS.fontMono, letterSpacing:'0.06em'}}>PLAZO</div>
                <div style={{fontFamily: tS.fontSerif, fontSize:20, marginTop:2}}>{a.p}<span style={{color: tS.text3, fontSize:13}}> cuotas</span></div>
              </div>
            </div>

            <div style={{background: v.bg, border:'1px solid '+v.c+'40', borderRadius:10, padding:'10px 12px', marginBottom: 12}}>
              <div style={{display:'flex', gap:6, alignItems:'center', marginBottom:4}}>
                <tI.Sparkles size={11} stroke={v.c}/>
                <span style={{fontSize:10.5, fontFamily: tS.fontMono, color: v.c, letterSpacing:'0.08em'}}>{v.l}</span>
              </div>
              <div style={{fontSize:12, color: tS.text2, lineHeight:1.45}}>{a.razon}</div>
            </div>

            <div style={{display:'flex', gap:6}}>
              <button style={{flex:1, padding:'9px', borderRadius:10, background: tS.surface2, border:'1px solid '+tS.border, color: tS.danger, fontSize:12}}>Rechazar</button>
              <button style={{flex:1, padding:'9px', borderRadius:10, background: tS.surface2, border:'1px solid '+tS.border, color: tS.text2, fontSize:12}}>Detalle</button>
              <button style={{flex:1.4, padding:'9px', borderRadius:10, background: v.verdict==='reject'?tS.surface2:tS.accent, color: v.verdict==='reject'?tS.text:'#000', border:'none', fontSize:12, fontWeight:500}}>Aprobar</button>
            </div>
          </div>
        );
      })}
    </div>
  </TScreen>
);

window.ADM2 = { AdminTeam, AdminCreateCobrador, AdminAssignRoutes, AdminApprovals };
