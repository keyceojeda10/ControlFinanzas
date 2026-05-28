// Reports & Analytics
const ReportsScreen = () => {
  const moraSeries = [
    { color: 'var(--danger)', labels: ['S1','S2','S3','S4','S5','S6','S7','S8','S9','S10','S11','S12'], data: [3.2, 3.8, 4.1, 4.5, 4.2, 4.8, 5.1, 5.3, 4.9, 5.2, 5.5, 5.8] },
    { color: 'var(--accent)', labels: ['S1','S2','S3','S4','S5','S6','S7','S8','S9','S10','S11','S12'], data: [95.2, 94.8, 95.5, 94.1, 95.8, 94.2, 93.5, 94.0, 95.7, 95.1, 94.8, 96.1] },
  ];

  return (
    <main className="main">
      <Topbar crumb={['Análisis', 'Reportes']} actions={
        <>
          <button className="btn"><Icons.Calendar/>Mayo 2026 <Icons.Chevron size={12}/></button>
          <button className="btn"><Icons.Download/>Reporte PDF</button>
        </>
      }/>

      <div className="page page-wide">
        <div className="page-head">
          <div>
            <h1 className="page-title">Reportes</h1>
            <div className="page-sub">Análisis de cartera, mora y desempeño</div>
          </div>
        </div>

        <div className="tabs">
          <div className="tab active">Cartera</div>
          <div className="tab">Mora</div>
          <div className="tab">Cohortes</div>
          <div className="tab">Rentabilidad</div>
          <div className="tab">Cobradores</div>
        </div>

        <div className="grid-2" style={{marginBottom:16}}>
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Índice de mora</div>
                <div className="serif" style={{fontSize:32, marginTop:4}}>
                  5.8<span style={{color:'var(--text-3)', fontSize:20}}>%</span>
                </div>
                <span className="kpi-delta down"><Icons.ArrowUp size={11}/>0.6 pts</span>
              </div>
              <div className="row gap-12" style={{fontSize:11.5, color:'var(--text-2)'}}>
                <span><span style={{display:'inline-block', width:8, height:8, borderRadius:'50%', background:'var(--danger)', marginRight:6}}></span>% Mora</span>
              </div>
            </div>
            <Charts.AreaChart series={[moraSeries[0]]} h={200}/>
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Tasa de recaudo</div>
                <div className="serif" style={{fontSize:32, marginTop:4}}>
                  96.1<span style={{color:'var(--text-3)', fontSize:20}}>%</span>
                </div>
                <span className="kpi-delta up"><Icons.ArrowUp size={11}/>1.3 pts</span>
              </div>
              <div className="row gap-12" style={{fontSize:11.5, color:'var(--text-2)'}}>
                <span><span style={{display:'inline-block', width:8, height:8, borderRadius:'50%', background:'var(--accent)', marginRight:6}}></span>% Recaudo</span>
              </div>
            </div>
            <Charts.AreaChart series={[moraSeries[1]]} h={200}/>
          </div>
        </div>

        {/* Cohort table */}
        <div className="card" style={{padding:0, marginBottom: 16, overflow:'hidden'}}>
          <div className="card-head" style={{padding:'18px 20px 12px', marginBottom:0}}>
            <div>
              <div className="card-title">Análisis por cohorte</div>
              <div style={{fontSize:13, color:'var(--text-3)', marginTop:2}}>Desempeño de los desembolsos por mes de originación</div>
            </div>
            <button className="btn btn-ghost" style={{fontSize:12}}>Vista completa →</button>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{paddingLeft: 20}}>Cohorte</th>
                <th>Desembolsos</th>
                <th>Mora actual</th>
                <th>% Recaudo</th>
                <th style={{paddingRight: 20}}>Curva de mora</th>
              </tr>
            </thead>
            <tbody>
              {MOCK.COHORTS.map((c,i) => {
                const mora = c.mora;
                const moraColor = mora < 4 ? 'var(--success)' : mora < 5.5 ? 'var(--warning)' : 'var(--danger)';
                return (
                  <tr key={c.cohort}>
                    <td style={{paddingLeft: 20}}>{c.cohort}</td>
                    <td className="mono">{c.desembolsos}</td>
                    <td>
                      <div className="row" style={{gap:10}}>
                        <span className="mono" style={{width:40, color: moraColor}}>{mora.toFixed(1)}%</span>
                        <div style={{flex:1, maxWidth: 140, height:4, background:'var(--surface-2)', borderRadius:2, overflow:'hidden'}}>
                          <div style={{height:'100%', width: (mora * 10)+'%', background: moraColor}}></div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="mono">{c.recaudo.toFixed(1)}%</span>
                    </td>
                    <td style={{paddingRight: 20}}>
                      <div style={{width: 100}}>
                        <Charts.Sparkline w={100} h={20} data={[1, 1.5, 2, 2.5, 3, mora*0.6, mora*0.8, mora]} stroke={moraColor}/>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* By route + methods */}
        <div className="grid-2">
          <div className="card">
            <div className="card-head">
              <div className="card-title">Recaudo por método (mayo)</div>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:14}}>
              {[
                { m: 'Nequi', v: 142, pct: 34, color: 'var(--accent)' },
                { m: 'Efectivo', v: 98, pct: 24, color: '#60a5fa' },
                { m: 'Bancolombia', v: 84, pct: 20, color: '#fbbf24' },
                { m: 'Daviplata', v: 52, pct: 13, color: '#a78bfa' },
                { m: 'PSE', v: 24, pct: 6, color: '#f472b6' },
                { m: 'Otros', v: 12, pct: 3, color: '#525252' },
              ].map(r => (
                <div key={r.m}>
                  <div className="row" style={{justifyContent:'space-between', marginBottom:6, fontSize:12.5}}>
                    <div className="row" style={{gap:8}}>
                      <span style={{width:8, height:8, borderRadius:'50%', background:r.color}}></span>
                      <span>{r.m}</span>
                    </div>
                    <span className="mono"><span style={{color:'var(--text-3)'}}>$</span> {r.v}M · {r.pct}%</span>
                  </div>
                  <div style={{height: 6, background:'var(--surface-2)', borderRadius:3, overflow:'hidden'}}>
                    <div style={{height:'100%', width: r.pct*2.8+'%', background: r.color, borderRadius:3}}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="card-title">Aging de cartera</div>
              <span className="pill"><span className="dot"></span>al 23 mayo</span>
            </div>
            <div style={{display:'flex', alignItems:'flex-end', gap:12, height:220, padding:'12px 0'}}>
              {[
                { label: 'Al día', v: 62, color: 'var(--accent)' },
                { label: '1-15d', v: 18, color: '#a3e635' },
                { label: '16-30d', v: 10, color: 'var(--warning)' },
                { label: '31-60d', v: 6, color: '#fb923c' },
                { label: '61-90d', v: 3, color: '#f87171' },
                { label: '90d+', v: 1, color: '#dc2626' },
              ].map(b => (
                <div key={b.label} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:8}}>
                  <div className="mono" style={{fontSize:11, color:'var(--text-2)'}}>{b.v}%</div>
                  <div style={{width:'100%', height: b.v*3, background: b.color, borderRadius:'2px 2px 0 0', minHeight:4}}></div>
                  <div style={{fontSize:10.5, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.05em'}}>{b.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

window.ReportsScreen = ReportsScreen;
