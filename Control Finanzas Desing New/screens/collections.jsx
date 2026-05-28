// Cobranza / Mora — bandeja de gestión
const { useState: useStateCol } = React;

const stageMap = {
  recordatorio: { l:'Recordatorio', c:'#60a5fa' },
  gestion: { l:'Gestión', c:'#fbbf24' },
  juridico: { l:'Jurídico', c:'#f87171' },
};

const priorityMap = {
  baja: { l:'Baja', c:'var(--text-3)' },
  media: { l:'Media', c:'#fbbf24' },
  alta: { l:'Alta', c:'#fb923c' },
  critica: { l:'Crítica', c:'#f87171' },
};

const CollectionsScreen = () => {
  const [stage, setStage] = useStateCol('all');
  const [selected, setSelected] = useStateCol(null);

  const items = MOCK.COLLECTIONS.filter(c => stage === 'all' || c.stage === stage);
  const totalMora = MOCK.COLLECTIONS.reduce((s,c)=>s+c.amount, 0);
  const totalCases = MOCK.COLLECTIONS.length;
  const criticos = MOCK.COLLECTIONS.filter(c=>c.priority==='critica').length;

  return (
    <main className="main">
      <Topbar crumb={['Cartera', 'Cobranza']} actions={
        <>
          <button className="btn"><Icons.Download/>Reporte</button>
          <button className="btn"><Icons.Bell/>Enviar masivo</button>
          <button className="btn btn-primary"><Icons.Sparkles/>Plan IA</button>
        </>
      }/>

      <div className="page page-wide">
        <div className="page-head">
          <div>
            <h1 className="page-title">Cobranza</h1>
            <div className="page-sub">{totalCases} casos en gestión · {criticos} críticos</div>
          </div>
          <div className="right" style={{display:'flex', gap:24, alignItems:'baseline'}}>
            <div>
              <div className="mono" style={{fontSize:10, color:'var(--text-3)', letterSpacing:'0.08em'}}>EN MORA</div>
              <div className="serif" style={{fontSize:26, color:'var(--danger)'}}><span className="mono" style={{fontSize:11, color:'var(--text-3)'}}>$</span> {MOCK.fmt(totalMora)}</div>
            </div>
            <div>
              <div className="mono" style={{fontSize:10, color:'var(--text-3)', letterSpacing:'0.08em'}}>% CARTERA</div>
              <div className="serif" style={{fontSize:26}}>5.8<span style={{color:'var(--text-3)', fontSize:18}}>%</span></div>
            </div>
            <div>
              <div className="mono" style={{fontSize:10, color:'var(--text-3)', letterSpacing:'0.08em'}}>RECUPERADO MES</div>
              <div className="serif" style={{fontSize:26, color:'var(--accent)'}}>74<span style={{color:'var(--text-3)', fontSize:18}}>%</span></div>
            </div>
          </div>
        </div>

        {/* Pipeline: kanban view */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16, marginBottom: 20}}>
          {[
            { id:'recordatorio', label:'Recordatorio', desc:'1-15 días de mora' },
            { id:'gestion', label:'Gestión activa', desc:'16-60 días' },
            { id:'juridico', label:'Jurídico', desc:'+60 días' },
          ].map(col => {
            const colItems = MOCK.COLLECTIONS.filter(c => c.stage === col.id);
            const colTotal = colItems.reduce((s,c)=>s+c.amount, 0);
            const meta = stageMap[col.id];
            return (
              <div key={col.id} style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden'}}>
                <div style={{padding:'14px 16px', borderBottom:'1px solid var(--border)'}}>
                  <div className="row" style={{justifyContent:'space-between', marginBottom:4}}>
                    <div className="row" style={{gap:8}}>
                      <span style={{width:8, height:8, borderRadius:'50%', background: meta.c}}></span>
                      <span style={{fontSize:13}}>{col.label}</span>
                    </div>
                    <span className="mono" style={{fontSize:11.5, color:'var(--text-3)'}}>{colItems.length} casos</span>
                  </div>
                  <div className="row" style={{justifyContent:'space-between'}}>
                    <span style={{fontSize:11, color:'var(--text-3)'}}>{col.desc}</span>
                    <span className="mono" style={{fontSize:12}}>$ {MOCK.fmt(colTotal)}</span>
                  </div>
                </div>
                <div style={{padding:10, display:'flex', flexDirection:'column', gap:8, maxHeight:340, overflowY:'auto'}}>
                  {colItems.map(c => (
                    <div key={c.client} onClick={() => setSelected(c)} className="card" style={{padding:'10px 12px', background:'var(--bg-elev)', cursor:'pointer'}}>
                      <div className="row" style={{justifyContent:'space-between', alignItems:'flex-start'}}>
                        <div>
                          <div style={{fontSize:13}}>{c.client}</div>
                          <div style={{fontSize:11, color:'var(--text-3)', fontFamily:'var(--font-mono)'}}>{c.loan}</div>
                        </div>
                        <span style={{
                          fontSize:10, color: priorityMap[c.priority].c,
                          padding:'1px 6px', border:'1px solid '+priorityMap[c.priority].c, borderRadius:3,
                          fontFamily:'var(--font-mono)', textTransform:'uppercase'
                        }}>{priorityMap[c.priority].l}</span>
                      </div>
                      <div className="row" style={{justifyContent:'space-between', marginTop:8, fontSize:11.5}}>
                        <span style={{color:'var(--danger)'}}>{c.days} días</span>
                        <span className="mono">$ {MOCK.fmt(c.amount)}</span>
                      </div>
                      <div style={{height:2, background:'var(--surface-2)', borderRadius:1, marginTop:6, overflow:'hidden'}}>
                        <div style={{height:'100%', width: Math.min(c.days*1.2, 100)+'%', background: c.days>60?'var(--danger)':c.days>30?'#fb923c':'var(--warning)'}}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Full table */}
        <div className="card" style={{padding:0, overflow:'hidden'}}>
          <div style={{padding:'14px 20px', borderBottom:'1px solid var(--border)'}}>
            <div className="card-title">Bandeja completa</div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{paddingLeft:18}}>Cliente / Préstamo</th>
                <th>Etapa</th>
                <th>Días</th>
                <th>Monto</th>
                <th>Intentos</th>
                <th>Último contacto</th>
                <th>Asignado</th>
                <th>Prioridad</th>
                <th style={{paddingRight:18}}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map(c => {
                const sm = stageMap[c.stage];
                const pm = priorityMap[c.priority];
                return (
                  <tr key={c.client} onClick={() => setSelected(c)} style={{cursor:'pointer'}}>
                    <td style={{paddingLeft:18}}>
                      <div>
                        <div style={{fontSize:13.5}}>{c.client}</div>
                        <div className="mono dim" style={{fontSize:11}}>{c.loan}</div>
                      </div>
                    </td>
                    <td>
                      <span style={{display:'inline-flex', alignItems:'center', gap:5, padding:'2px 8px', borderRadius:999, fontSize:11, color: sm.c, background:`${sm.c}1a`, border:`1px solid ${sm.c}40`, fontFamily:'var(--font-mono)'}}>
                        <span style={{width:5, height:5, borderRadius:'50%', background: sm.c}}></span>{sm.l}
                      </span>
                    </td>
                    <td>
                      <span className="mono" style={{color: c.days>60?'var(--danger)':c.days>30?'#fb923c':'var(--warning)'}}>{c.days}d</span>
                    </td>
                    <td className="num mono">$ {MOCK.fmt(c.amount)}</td>
                    <td className="mono">{c.attempts}</td>
                    <td className="dim">{c.lastContact}</td>
                    <td>{c.assigned}</td>
                    <td>
                      <span style={{fontSize:11, color: pm.c, fontFamily:'var(--font-mono)', textTransform:'uppercase'}}>● {pm.l}</span>
                    </td>
                    <td style={{paddingRight:18}}>
                      <div className="row" style={{gap:4}}>
                        <button className="icon-btn" style={{width:28, height:28}} onClick={e => e.stopPropagation()}><Icons.Phone size={12}/></button>
                        <button className="icon-btn" style={{width:28, height:28}} onClick={e => e.stopPropagation()}><Icons.Bell size={12}/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
};

window.CollectionsScreen = CollectionsScreen;
