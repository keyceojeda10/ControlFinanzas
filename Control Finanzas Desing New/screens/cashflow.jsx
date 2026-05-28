// Cashflow forecast
const { useState: useStateCf } = React;

const CashflowScreen = () => {
  const [horizon, setHorizon] = useStateCf('14d');
  const data = MOCK.CASHFLOW_14D;
  const totalIn = data.reduce((s,d)=>s+d.inflow, 0);
  const totalOut = data.reduce((s,d)=>s+d.outflow, 0);
  const net = totalIn - totalOut;

  return (
    <main className="main">
      <Topbar crumb={['Análisis', 'Proyección de flujo']} actions={
        <>
          <button className="btn"><Icons.Download/>Exportar</button>
          <button className="btn btn-primary"><Icons.Sparkles/>Optimizar IA</button>
        </>
      }/>

      <div className="page page-wide">
        <div className="page-head">
          <div>
            <h1 className="page-title">Cashflow <em>proyectado</em></h1>
            <div className="page-sub">Basado en cuotas confirmadas + modelo predictivo de mora</div>
          </div>
          <div className="right">
            <div className="tabs" style={{marginBottom:0, borderBottom:'none', gap:0}}>
              {['7d','14d','30d','90d'].map(h => (
                <div key={h} className={'chip ' + (horizon===h?'active':'')} onClick={() => setHorizon(h)} style={{borderRadius:0, borderRight:'none'}}>
                  {h}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Summary strip */}
        <div className="kpi-grid" style={{marginBottom:20, gridTemplateColumns:'repeat(3, 1fr)'}}>
          <div className="kpi">
            <div className="kpi-label"><span style={{width:8,height:8,borderRadius:'50%',background:'var(--accent)'}}></span>Entradas proyectadas</div>
            <div className="kpi-value">
              <span className="cur mono">$</span>{totalIn}<span style={{color:'var(--text-3)'}}>M</span>
            </div>
            <div className="row gap-12">
              <span className="kpi-delta up"><Icons.ArrowUp size={11}/>87% confianza</span>
              <span style={{fontSize:11, color:'var(--text-3)'}}>442 cuotas</span>
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label"><span style={{width:8,height:8,borderRadius:'50%',background:'#525252'}}></span>Desembolsos comprometidos</div>
            <div className="kpi-value">
              <span className="cur mono">$</span>{totalOut}<span style={{color:'var(--text-3)'}}>M</span>
            </div>
            <div className="row gap-12">
              <span className="kpi-delta"><span style={{color:'var(--text-3)'}}>•</span>14 nuevos préstamos</span>
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label"><span style={{width:8,height:8,borderRadius:'50%',background:'var(--success)'}}></span>Flujo neto · 14 días</div>
            <div className="kpi-value" style={{color:'var(--accent)'}}>
              <span className="cur mono" style={{color:'var(--accent)'}}>+$</span>{net}<span style={{color:'var(--text-3)'}}>M</span>
            </div>
            <div className="row gap-12">
              <span className="kpi-delta up">Caja al cierre: $612M</span>
            </div>
          </div>
        </div>

        <div className="card" style={{marginBottom: 16}}>
          <div className="card-head">
            <div className="card-title">Flujo diario · 26 mayo — 08 junio</div>
            <div className="row gap-12">
              <span style={{fontSize:11.5, color:'var(--text-2)'}}><span style={{display:'inline-block', width:8,height:8,background:'var(--accent)', marginRight:6, borderRadius:1}}></span>Entradas</span>
              <span style={{fontSize:11.5, color:'var(--text-2)'}}><span style={{display:'inline-block', width:8,height:8,background:'#3a3a3a', marginRight:6, borderRadius:1}}></span>Salidas</span>
            </div>
          </div>
          <Charts.BarChart data={data} h={260}/>
        </div>

        {/* Scenario builder + breakdown */}
        <div className="grid-21">
          <div className="card">
            <div className="card-head">
              <div className="card-title">Escenarios</div>
              <button className="btn btn-ghost" style={{padding:'2px 6px', fontSize:12}}><Icons.Plus size={12}/></button>
            </div>
            {[
              { n:'Base · actual', desc:'Tasa de recaudo 96.1%', net: '+$381M', active:true },
              { n:'Pesimista', desc:'Si recaudo cae a 88%', net: '+$298M' },
              { n:'Optimista', desc:'Cobro proactivo Centro', net: '+$424M' },
            ].map(s => (
              <div key={s.n} style={{padding:'12px 0', borderBottom:'1px solid var(--border)'}}>
                <div className="row" style={{justifyContent:'space-between'}}>
                  <div className="row" style={{gap:8}}>
                    <span style={{width:8, height:8, borderRadius:'50%', background: s.active?'var(--accent)':'var(--surface-2)', border: '1px solid var(--border-strong)'}}></span>
                    <span style={{fontSize:13.5}}>{s.n}</span>
                  </div>
                  <span className="mono" style={{fontSize:13, color: s.active?'var(--accent)':'var(--text-2)'}}>{s.net}</span>
                </div>
                <div style={{fontSize:12, color:'var(--text-3)', marginTop:4, marginLeft:16}}>{s.desc}</div>
              </div>
            ))}
            <div className="hr" style={{margin:'12px 0'}}/>
            <div style={{fontSize:11, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8}}>Variables</div>
            {[
              { l:'Tasa de recaudo', v:96.1 },
              { l:'% nuevos desembolsos', v:12 },
              { l:'Tasa de mora', v:5.8 },
            ].map(v => (
              <div key={v.l} style={{marginBottom:12}}>
                <div className="row" style={{justifyContent:'space-between', marginBottom:4, fontSize:12}}>
                  <span style={{color:'var(--text-2)'}}>{v.l}</span>
                  <span className="mono">{v.v}%</span>
                </div>
                <div style={{height:4, background:'var(--surface-2)', borderRadius:2, position:'relative'}}>
                  <div style={{position:'absolute', left: v.v+'%', top:-3, width:10, height:10, borderRadius:'50%', background:'var(--accent)', transform:'translateX(-50%)'}}></div>
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <div className="card-head" style={{padding:'18px 20px 12px', marginBottom:0}}>
              <div className="card-title">Próximos eventos</div>
              <button className="btn btn-ghost" style={{fontSize:12}}>Ver calendario →</button>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{paddingLeft:20}}>Fecha</th>
                  <th>Evento</th>
                  <th>Detalle</th>
                  <th>Confianza</th>
                  <th style={{textAlign:'right', paddingRight:20}}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { d:'Lun 26 May', t:'Cuotas vencen', det:'42 préstamos · 8 rutas', conf:94, amt:'+32.4M', sign:'in' },
                  { d:'Lun 26 May', t:'Desembolso programado', det:'PR-1248 · Microempresa', conf:100, amt:'−5.0M', sign:'out' },
                  { d:'Mar 27 May', t:'Cuotas vencen', det:'51 préstamos · 8 rutas', conf:91, amt:'+38.1M', sign:'in' },
                  { d:'Mié 28 May', t:'Quincena', det:'Pico de cobro', conf:96, amt:'+42.8M', sign:'in' },
                  { d:'Vie 30 May', t:'Pago nómina', det:'4 cobradores + admin', conf:100, amt:'−18.2M', sign:'out' },
                  { d:'Vie 30 May', t:'Cuotas vencen', det:'Día fuerte · 67 cuotas', conf:93, amt:'+51.4M', sign:'in' },
                ].map((e,i) => (
                  <tr key={i}>
                    <td style={{paddingLeft:20}} className="dim">{e.d}</td>
                    <td>{e.t}</td>
                    <td className="dim">{e.det}</td>
                    <td>
                      <div className="row" style={{gap:6}}>
                        <div style={{width:42, height:4, background:'var(--surface-2)', borderRadius:2, overflow:'hidden'}}>
                          <div style={{height:'100%', width: e.conf+'%', background: e.conf > 95 ? 'var(--accent)' : 'var(--warning)'}}></div>
                        </div>
                        <span className="mono" style={{fontSize:11.5}}>{e.conf}%</span>
                      </div>
                    </td>
                    <td className="num mono" style={{paddingRight:20, color: e.sign==='in'?'var(--accent)':'var(--text-2)'}}>$ {e.amt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
};

window.CashflowScreen = CashflowScreen;
