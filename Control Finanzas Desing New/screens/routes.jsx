// Rutas de cobro
const { useState: useStateRt } = React;

const RoutesScreen = () => {
  const [selectedCobrador, setSelectedCobrador] = useStateRt(0);
  const [selectedStop, setSelectedStop] = useStateRt(0);
  const stops = MOCK.ROUTE_CLIENTS;
  const cobrador = MOCK.COBRADORES[selectedCobrador];

  // Generate fake but plausible coords for map
  const stopCoords = stops.map((s, i) => ({
    x: 80 + (i * 90) % 480 + Math.sin(i*1.7)*30,
    y: 120 + Math.cos(i*1.3) * 100 + (i % 3) * 60,
  }));

  return (
    <main className="main">
      <Topbar crumb={['Operación', 'Rutas']} actions={
        <>
          <button className="btn"><Icons.Download/>Hojas de ruta</button>
          <button className="btn btn-primary"><Icons.Plus/>Nueva ruta</button>
        </>
      }/>

      <div className="page page-wide" style={{paddingBottom: 28}}>
        <div className="page-head">
          <div>
            <h1 className="page-title">Rutas de cobro</h1>
            <div className="page-sub">Sábado 23 mayo · 4 cobradores en campo · 31 visitas programadas</div>
          </div>
          <div className="right">
            <div className="chip"><Icons.Calendar/>Hoy</div>
            <div className="chip">Todas las zonas <Icons.Chevron size={11}/></div>
          </div>
        </div>

        {/* Cobrador selector strip */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:16}}>
          {MOCK.COBRADORES.map((c, i) => (
            <div key={c.n}
                 onClick={() => setSelectedCobrador(i)}
                 className="card"
                 style={{cursor:'pointer', padding:'14px 16px', borderColor: i===selectedCobrador?'var(--accent)':'var(--border)'}}>
              <div className="row" style={{gap:10, marginBottom:8}}>
                <div className="avatar" style={{background: c.color, color:'#000', width:32, height:32, fontSize:11}}>
                  {c.n.split(' ').map(s=>s[0]).slice(0,2).join('')}
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:13}}>{c.n}</div>
                  <div style={{fontSize:11, color:'var(--text-3)'}}>Ruta {c.zone}</div>
                </div>
                <span style={{width:6, height:6, borderRadius:'50%', background:'var(--success)', boxShadow:'0 0 0 3px rgba(74,222,128,0.15)'}}></span>
              </div>
              <div className="row" style={{justifyContent:'space-between', fontSize:11.5}}>
                <span style={{color:'var(--text-3)'}}>3/8 visitas</span>
                <span className="mono">$ {MOCK.fmt(c.recaudo)}</span>
              </div>
              <div style={{marginTop:6, height:3, background:'var(--surface-2)', borderRadius:2, overflow:'hidden'}}>
                <div style={{height:'100%', width: '37%', background: c.color}}></div>
              </div>
            </div>
          ))}
        </div>

        <div className="route-shell">
          {/* Stop list */}
          <div className="route-list">
            <div style={{padding:'14px 16px', borderBottom:'1px solid var(--border)', position:'sticky', top:0, background:'var(--surface)', zIndex:2}}>
              <div className="row" style={{justifyContent:'space-between'}}>
                <div style={{flex:1, minWidth:0}}>
                  <div className="mono" style={{fontSize:11, color:'var(--text-3)'}}>RUTA · {cobrador.zone.toUpperCase()}</div>
                  <div className="serif" style={{fontSize:22, marginTop:2}}>{cobrador.n}</div>
                </div>
                <button className="icon-btn"><Icons.Phone size={14}/></button>
              </div>
              <div className="row" style={{gap:16, marginTop:10, fontSize:12, color:'var(--text-3)'}}>
                <span><span style={{color:'var(--text)'}}>8</span> paradas</span>
                <span><span style={{color:'var(--success)'}}>3</span> completadas</span>
                <span><span style={{color:'var(--danger)'}}>1</span> mora</span>
                <span style={{marginLeft:'auto'}} className="mono"><span style={{color:'var(--text)'}}>$5.9M</span> meta</span>
              </div>
            </div>

            {stops.map((s, i) => {
              const statusColor = s.status === 'done' ? 'var(--success)' : s.status === 'mora' ? 'var(--danger)' : 'var(--text-2)';
              const isActive = i === selectedStop;
              return (
                <div key={i} className={'route-item ' + (isActive ? 'active' : '')} onClick={() => setSelectedStop(i)}>
                  <div className="route-num">{(i+1).toString().padStart(2,'0')}</div>
                  <div className="route-info">
                    <div className="row" style={{justifyContent:'space-between'}}>
                      <span className="n">{s.n}</span>
                      <span className="route-amt">$ {MOCK.fmt(s.amt)}</span>
                    </div>
                    <div className="a row" style={{justifyContent:'space-between', marginTop:4}}>
                      <span>{s.a}</span>
                      <span className="mono" style={{color: statusColor, fontSize:11}}>
                        {s.status === 'done' ? '✓ ' : s.status === 'mora' ? '! ' : ''}{s.time}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Map pane */}
          <div className="map-pane">
            {/* Stylized map grid */}
            <svg width="100%" height="100%" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" style={{position:'absolute', inset:0}}>
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--border)" strokeWidth="1"/>
                </pattern>
                <pattern id="gridFine" width="8" height="8" patternUnits="userSpaceOnUse">
                  <circle cx="4" cy="4" r="0.5" fill="var(--border)"/>
                </pattern>
              </defs>
              <rect width="800" height="600" fill="var(--bg-elev)"/>
              <rect width="800" height="600" fill="url(#gridFine)"/>
              <rect width="800" height="600" fill="url(#grid)"/>

              {/* "Streets" */}
              <path d="M0 200 Q200 180 400 220 T800 240" stroke="var(--border-strong)" strokeWidth="20" fill="none" opacity="0.4"/>
              <path d="M0 400 Q300 380 500 410 T800 430" stroke="var(--border-strong)" strokeWidth="20" fill="none" opacity="0.4"/>
              <path d="M250 0 L240 600" stroke="var(--border-strong)" strokeWidth="14" fill="none" opacity="0.4"/>
              <path d="M520 0 L530 600" stroke="var(--border-strong)" strokeWidth="14" fill="none" opacity="0.4"/>

              {/* Route line */}
              <path d={`M ${stopCoords.map(c => `${c.x} ${c.y}`).join(' L ')}`}
                    stroke="var(--accent)" strokeWidth="2" fill="none" strokeDasharray="6 4" opacity="0.7"/>

              {/* Stops */}
              {stops.map((s, i) => {
                const c = stopCoords[i];
                const isActive = i === selectedStop;
                const color = s.status === 'done' ? 'var(--success)' : s.status === 'mora' ? 'var(--danger)' : 'var(--accent)';
                return (
                  <g key={i} onClick={() => setSelectedStop(i)} style={{cursor:'pointer'}}>
                    {isActive && <circle cx={c.x} cy={c.y} r="22" fill={color} opacity="0.15"/>}
                    <circle cx={c.x} cy={c.y} r={isActive ? 12 : 9} fill="var(--bg)" stroke={color} strokeWidth="2"/>
                    <text x={c.x} y={c.y+4} fontSize="10" fill={color} textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="600">{i+1}</text>
                  </g>
                );
              })}
            </svg>

            {/* Floating selected card */}
            {(() => {
              const s = stops[selectedStop];
              return (
                <div className="fpc fade-up" style={{position:'absolute', bottom:20, left:20, right:20, padding:'16px 18px'}}>
                  <div className="row" style={{justifyContent:'space-between', alignItems:'flex-start'}}>
                    <div>
                      <div className="mono" style={{fontSize:10, color:'var(--text-3)', letterSpacing:'0.08em'}}>PARADA {(selectedStop+1).toString().padStart(2,'0')} / 08</div>
                      <div className="serif" style={{fontSize:26, marginTop:2}}>{s.n}</div>
                      <div style={{fontSize:13, color:'var(--text-3)', marginTop:2}}>{s.a}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div className="mono" style={{fontSize:11, color:'var(--text-3)'}}>CUOTA</div>
                      <div className="serif" style={{fontSize:26}}>$ {MOCK.fmt(s.amt)}</div>
                    </div>
                  </div>
                  <div className="hr" style={{margin:'14px 0'}}/>
                  <div className="row" style={{gap:8}}>
                    <button className="btn btn-primary" style={{flex:1, justifyContent:'center'}}><Icons.Check size={14}/>Marcar pagado</button>
                    <button className="btn"><Icons.Phone size={14}/>Llamar</button>
                    <button className="btn"><Icons.Pin size={14}/>Cómo llegar</button>
                  </div>
                </div>
              );
            })()}

            {/* Top-right legend */}
            <div className="fpc" style={{position:'absolute', top:16, right:16, padding:'10px 12px'}}>
              <div style={{fontSize:10, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>Leyenda</div>
              <div className="row" style={{gap:10, fontSize:11.5}}><span style={{width:8,height:8,borderRadius:'50%',border:'2px solid var(--accent)'}}></span>Pendiente</div>
              <div className="row" style={{gap:10, fontSize:11.5}}><span style={{width:8,height:8,borderRadius:'50%',border:'2px solid var(--success)'}}></span>Cobrado</div>
              <div className="row" style={{gap:10, fontSize:11.5}}><span style={{width:8,height:8,borderRadius:'50%',border:'2px solid var(--danger)'}}></span>Mora</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

window.RoutesScreen = RoutesScreen;
