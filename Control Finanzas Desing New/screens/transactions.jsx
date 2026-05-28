// Transactions screen
const { useState: useStateTx } = React;

const TransactionsScreen = () => {
  const [filter, setFilter] = useStateTx('all');
  const [selected, setSelected] = useStateTx(null);

  const filtered = MOCK.TRANSACTIONS.filter(tx => {
    if (filter === 'all') return true;
    if (filter === 'in') return tx.type === 'in';
    if (filter === 'out') return tx.type === 'out';
    if (filter === 'mora') return tx.status === 'warning' || tx.status === 'danger';
    return true;
  });

  const totalIn = MOCK.TRANSACTIONS.filter(t => t.type==='in' && t.status==='success').reduce((s,t)=>s+t.amount,0);
  const totalOut = MOCK.TRANSACTIONS.filter(t => t.type==='out').reduce((s,t)=>s+t.amount,0);

  return (
    <main className="main">
      <Topbar crumb={['Operación', 'Transacciones']} actions={
        <>
          <button className="btn"><Icons.Download/>Exportar CSV</button>
          <button className="btn btn-primary"><Icons.Plus/>Registrar pago</button>
        </>
      }/>

      <div className="page page-wide">
        <div className="page-head">
          <div>
            <h1 className="page-title">Transacciones</h1>
            <div className="page-sub">{filtered.length} movimientos · últimas 48h</div>
          </div>
          <div className="right" style={{display:'flex', gap:24, alignItems:'baseline'}}>
            <div>
              <div className="mono" style={{fontSize:10, color:'var(--text-3)', letterSpacing:'0.08em'}}>ENTRADAS</div>
              <div className="serif" style={{fontSize:26}}>
                <span className="mono" style={{fontSize:11, color:'var(--text-3)'}}>$</span> {MOCK.fmt(totalIn)}
              </div>
            </div>
            <div style={{color:'var(--text-4)', fontSize:24}}>·</div>
            <div>
              <div className="mono" style={{fontSize:10, color:'var(--text-3)', letterSpacing:'0.08em'}}>SALIDAS</div>
              <div className="serif" style={{fontSize:26, color:'var(--text-2)'}}>
                <span className="mono" style={{fontSize:11, color:'var(--text-3)'}}>$</span> {MOCK.fmt(totalOut)}
              </div>
            </div>
          </div>
        </div>

        <div className="filters">
          <div className={'chip ' + (filter==='all'?'active':'')} onClick={() => setFilter('all')}>Todas <span className="mono" style={{color:'var(--text-3)', marginLeft:2}}>{MOCK.TRANSACTIONS.length}</span></div>
          <div className={'chip ' + (filter==='in'?'active':'')} onClick={() => setFilter('in')}>Entradas</div>
          <div className={'chip ' + (filter==='out'?'active':'')} onClick={() => setFilter('out')}>Desembolsos</div>
          <div className={'chip ' + (filter==='mora'?'active':'')} onClick={() => setFilter('mora')}>Mora / Fallidas</div>
          <div style={{marginLeft:'auto', display:'flex', gap:8}}>
            <div className="chip"><Icons.Calendar/>Hoy y ayer <Icons.Chevron size={11}/></div>
            <div className="chip"><Icons.Filter/>Filtros</div>
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap:16, alignItems:'flex-start'}}>
          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{paddingLeft: 18}}>Fecha</th>
                  <th>Cliente</th>
                  <th>Concepto</th>
                  <th>Método</th>
                  <th>Cobrador</th>
                  <th>Estado</th>
                  <th style={{textAlign:'right', paddingRight:18}}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(tx => (
                  <tr key={tx.id} onClick={() => setSelected(tx)} style={{cursor:'pointer', background: selected?.id===tx.id?'var(--surface-2)':'transparent'}}>
                    <td style={{paddingLeft:18}} className="dim mono">{tx.date}</td>
                    <td>
                      <div style={{display:'flex', alignItems:'center', gap:10}}>
                        <div className="avatar" style={{width:26, height:26, fontSize:10, background:'var(--surface-2)', color:'var(--text-2)'}}>
                          {tx.client.split(' ').map(s=>s[0]).slice(0,2).join('')}
                        </div>
                        <span>{tx.client}</span>
                      </div>
                    </td>
                    <td className="dim">{tx.concept}</td>
                    <td>{tx.method}</td>
                    <td className="dim">{tx.cobrador}</td>
                    <td>
                      <span className={'pill ' + (tx.status==='success'?'success':tx.status==='warning'?'warning':'danger')}>
                        <span className="dot"></span>
                        {tx.status==='success'?'Confirmado':tx.status==='warning'?'En mora':'Fallido'}
                      </span>
                    </td>
                    <td className="num mono" style={{paddingRight:18, color: tx.type==='in'?'var(--text)':'var(--danger)'}}>
                      {tx.type==='out'?'−':''}$ {MOCK.fmt(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selected && <TxDrawer tx={selected} onClose={() => setSelected(null)}/>}
        </div>
      </div>
    </main>
  );
};

const TxDrawer = ({ tx, onClose }) => (
  <div className="card fade-up" style={{position:'sticky', top: 80}}>
    <div className="row" style={{justifyContent:'space-between', marginBottom:14}}>
      <span className="mono" style={{fontSize:11, color:'var(--text-3)'}}>{tx.id}</span>
      <button className="icon-btn" onClick={onClose}><Icons.X/></button>
    </div>
    <div className="serif" style={{fontSize:42, lineHeight:1, letterSpacing:'-0.02em'}}>
      <span className="mono" style={{fontSize:14, color:'var(--text-3)', verticalAlign:6}}>{tx.type==='out'?'−$':'$'}</span>
      {MOCK.fmt(tx.amount)}
    </div>
    <div style={{marginTop:8}}>
      <span className={'pill ' + (tx.status==='success'?'success':tx.status==='warning'?'warning':'danger')}>
        <span className="dot"></span>
        {tx.status==='success'?'Confirmado':tx.status==='warning'?'En mora':'Fallido'}
      </span>
    </div>

    <div className="hr"/>

    {[
      ['Cliente', tx.client],
      ['Concepto', tx.concept],
      ['Método', tx.method],
      ['Cobrador', tx.cobrador],
      ['Fecha', tx.date],
      ['Referencia', tx.id],
    ].map(([k,v]) => (
      <div key={k} className="row" style={{justifyContent:'space-between', padding:'8px 0', fontSize:13}}>
        <span style={{color:'var(--text-3)'}}>{k}</span>
        <span>{v}</span>
      </div>
    ))}

    <div className="hr"/>

    <div style={{display:'flex', gap:8}}>
      <button className="btn" style={{flex:1, justifyContent:'center'}}>Recibo</button>
      <button className="btn" style={{flex:1, justifyContent:'center'}}>Conciliar</button>
    </div>
  </div>
);

window.TransactionsScreen = TransactionsScreen;
