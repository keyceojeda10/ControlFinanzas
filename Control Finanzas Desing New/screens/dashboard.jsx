// Dashboard — 3 variants: editorial / dense / spatial
const { useState: useStateDash } = React;

const KpiCard = ({ k, variant }) => {
  const isUp = k.delta >= 0;
  return (
    <div className="kpi">
      <div className="kpi-label">{k.label}</div>
      <div className="kpi-value">
        {k.cur && <span className="cur mono">{k.cur}</span>}
        {MOCK.fmt(k.value)}{k.suffix || ''}
      </div>
      <div className="row" style={{gap:10}}>
        <span className={'kpi-delta ' + (isUp ? 'up' : 'down')}>
          {isUp ? <Icons.ArrowUp size={11}/> : <Icons.ArrowDown size={11}/>}
          {Math.abs(k.delta).toFixed(1)}%
        </span>
        <span style={{fontSize:11, color:'var(--text-3)'}}>{k.deltaLabel}</span>
      </div>
      <div className="kpi-spark">
        <Charts.Sparkline data={k.spark} w={90} h={32} stroke={isUp ? 'var(--accent)' : 'var(--danger)'} fill={isUp ? 'var(--accent)' : 'var(--danger)'}/>
      </div>
    </div>
  );
};

const RecentTxRow = ({ tx }) => (
  <tr>
    <td>
      <div style={{display:'flex', alignItems:'center', gap:10}}>
        <div className="avatar" style={{width:28, height:28, fontSize:10, background:'var(--surface-2)', color:'var(--text-2)'}}>
          {tx.client.split(' ').map(s=>s[0]).slice(0,2).join('')}
        </div>
        <div>
          <div style={{fontSize:13}}>{tx.client}</div>
          <div style={{fontSize:11.5, color:'var(--text-3)'}}>{tx.concept}</div>
        </div>
      </div>
    </td>
    <td className="dim mono" style={{fontSize:12}}>{tx.id}</td>
    <td>
      <span className={'pill ' + (tx.status === 'success' ? 'success' : tx.status === 'warning' ? 'warning' : 'danger')}>
        <span className="dot"></span>{tx.method}
      </span>
    </td>
    <td className="num mono" style={{color: tx.type==='in'?'var(--text)':'var(--text-3)'}}>
      {tx.type==='out'?'−':''}$ {MOCK.fmt(tx.amount)}
    </td>
  </tr>
);

const DashboardScreen = ({ variant = 'editorial', onNav }) => {
  const kpis = variant === 'dense' ? MOCK.KPIS_DENSE : MOCK.KPIS;
  const recent = MOCK.TRANSACTIONS.slice(0, 6);

  // Pipeline series
  const series = [
    { color: 'var(--accent)', labels: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'], data: [180,210,245,260,310,340,370,395,410,432,455,478] },
    { color: '#60a5fa', labels: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'], data: [120,135,160,175,210,230,245,260,280,295,310,328] },
  ];

  return (
    <main className="main">
      <Topbar crumb={['Operación', 'Dashboard']} actions={
        <>
          <button className="btn"><Icons.Download/>Exportar</button>
          <button className="btn btn-primary"><Icons.Plus/>Nuevo préstamo</button>
        </>
      }/>

      <div className={'page page-wide dashboard ' + variant}>
        <div className="page-head">
          <div>
            <h1 className="page-title">Buenos días, <em>Diana</em>.</h1>
            <div className="page-sub">Sábado · 23 de mayo · 1.247 clientes activos · $1.842M en cartera</div>
          </div>
          <div className="right">
            <div className="chip"><Icons.Calendar/>Últimos 30 días <Icons.Chevron size={11}/></div>
            <div className="chip">Todas las rutas <Icons.Chevron size={11}/></div>
          </div>
        </div>

        {/* KPIs */}
        <div className="kpi-grid" style={{marginBottom: 24}}>
          {kpis.map(k => <KpiCard key={k.label} k={k} variant={variant}/>)}
        </div>

        {/* Editorial: insight banner */}
        {variant === 'editorial' && (
          <div className="card" style={{marginBottom:24, background:'linear-gradient(180deg, var(--surface), var(--bg-elev))', padding:'22px 24px', display:'flex', alignItems:'center', gap:20}}>
            <div style={{width:40, height:40, borderRadius:10, background:'var(--accent-soft)', display:'grid', placeItems:'center', color:'var(--accent)', flexShrink:0}}>
              <Icons.Sparkles size={20}/>
            </div>
            <div style={{flex:1}}>
              <div className="mono" style={{fontSize:11, color:'var(--accent)', letterSpacing:'0.08em'}}>INSIGHT · IA</div>
              <div className="serif" style={{fontSize:20, marginTop:2, letterSpacing:'-0.005em'}}>
                Tu mora subió <em style={{color:'var(--accent)'}}>1.8%</em> esta semana, concentrada en ruta Centro. 4 clientes acumulan 60+ días.
              </div>
            </div>
            <button className="btn">Ver detalle <Icons.Chevron size={13}/></button>
          </div>
        )}

        {/* Main chart + side */}
        <div className="grid-12" style={{marginBottom:24}}>
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Cartera vs Recaudo</div>
                <div className="serif" style={{fontSize:24, marginTop:4, letterSpacing:'-0.01em'}}>
                  <span className="mono" style={{fontSize:12, color:'var(--text-3)'}}>$</span>
                  478<span style={{color:'var(--text-3)'}}>M</span> proyectado dic.
                </div>
              </div>
              <div className="row gap-12">
                <div className="row" style={{fontSize:12, color:'var(--text-2)'}}>
                  <span style={{width:8, height:8, borderRadius:'50%', background:'var(--accent)', marginRight:6}}></span>Cartera
                </div>
                <div className="row" style={{fontSize:12, color:'var(--text-2)'}}>
                  <span style={{width:8, height:8, borderRadius:'50%', background:'#60a5fa', marginRight:6}}></span>Recaudo
                </div>
                <div className="tabs" style={{marginBottom:0, borderBottom:'none'}}>
                  <div className="tab active">12M</div>
                  <div className="tab">6M</div>
                  <div className="tab">YTD</div>
                </div>
              </div>
            </div>
            <Charts.AreaChart series={series} h={260}/>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="card-title">Composición de cartera</div>
              <button className="btn btn-ghost" style={{padding:'4px 6px'}}><Icons.More size={14}/></button>
            </div>
            <div style={{display:'flex', alignItems:'center', justifyContent:'center', padding:'12px 0 18px'}}>
              <div style={{position:'relative'}}>
                <Charts.Donut size={150} thickness={22} segments={[
                  { value: 62, color: 'var(--accent)' },
                  { value: 22, color: '#60a5fa' },
                  { value: 10, color: '#fbbf24' },
                  { value: 6, color: '#f87171' },
                ]}/>
                <div style={{position:'absolute', inset:0, display:'grid', placeItems:'center', textAlign:'center'}}>
                  <div>
                    <div className="serif" style={{fontSize:28, lineHeight:1}}>$1.84B</div>
                    <div style={{fontSize:10, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginTop:2}}>Total</div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              {[
                { label:'Al día', v:62, color:'var(--accent)' },
                { label:'Por vencer (7d)', v:22, color:'#60a5fa' },
                { label:'Mora < 30d', v:10, color:'#fbbf24' },
                { label:'Mora 30d+', v:6, color:'#f87171' },
              ].map(s => (
                <div key={s.label} className="row" style={{justifyContent:'space-between', fontSize:12.5}}>
                  <div className="row" style={{gap:8}}>
                    <span style={{width:8,height:8,borderRadius:'50%',background:s.color}}></span>
                    <span>{s.label}</span>
                  </div>
                  <span className="mono" style={{color:'var(--text-2)'}}>{s.v}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent + Cobradores */}
        <div className="grid-21">
          <div className="card">
            <div className="card-head">
              <div className="card-title">Top cobradores</div>
              <button className="btn btn-ghost" style={{padding:'2px 6px', fontSize:12}} onClick={() => onNav && onNav('routes')}>Ver todos →</button>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:14}}>
              {MOCK.COBRADORES.map((c,i) => (
                <div key={c.n}>
                  <div className="row" style={{justifyContent:'space-between', marginBottom:6}}>
                    <div className="row" style={{gap:10}}>
                      <span className="mono" style={{fontSize:10, color:'var(--text-3)', width:14}}>{(i+1).toString().padStart(2,'0')}</span>
                      <span style={{fontSize:13}}>{c.n}</span>
                      <span className="pill" style={{marginLeft:4}}>{c.zone}</span>
                    </div>
                    <span className="mono" style={{fontSize:12.5}}>$ {MOCK.fmt(c.recaudo)}</span>
                  </div>
                  <div style={{height:4, background:'var(--surface-2)', borderRadius:2, overflow:'hidden'}}>
                    <div style={{height:'100%', width: c.ef+'%', background: c.color, borderRadius:2}}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <div className="card-head" style={{padding:'18px 18px 12px', marginBottom:0}}>
              <div className="card-title">Movimientos recientes</div>
              <button className="btn btn-ghost" style={{padding:'2px 6px', fontSize:12}} onClick={() => onNav && onNav('transactions')}>Ver todos →</button>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Cliente / Concepto</th>
                  <th>Ref</th>
                  <th>Método</th>
                  <th style={{textAlign:'right'}}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(tx => <RecentTxRow key={tx.id} tx={tx}/>)}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  );
};

window.DashboardScreen = DashboardScreen;
