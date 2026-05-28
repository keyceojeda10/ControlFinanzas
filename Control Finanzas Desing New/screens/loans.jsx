// Préstamos — lista, detalle con amortización, originación
const { useState: useStateLoans } = React;

const LoansScreen = ({ onNav }) => {
  const [selected, setSelected] = useStateLoans(null);
  const [showNew, setShowNew] = useStateLoans(false);
  const [filter, setFilter] = useStateLoans('all');

  const loans = MOCK.LOANS.filter(l => {
    if (filter === 'all') return true;
    if (filter === 'active') return l.status === 'active';
    if (filter === 'late') return l.status === 'late';
    return true;
  });

  if (showNew) return <LoanOrigination onClose={() => setShowNew(false)}/>;
  if (selected) return <LoanDetail loan={selected} onBack={() => setSelected(null)}/>;

  const totalCartera = MOCK.LOANS.reduce((s,l)=>s+l.balance,0);
  const totalActivos = MOCK.LOANS.filter(l=>l.status==='active').length;

  return (
    <main className="main">
      <Topbar crumb={['Cartera', 'Préstamos']} actions={
        <>
          <button className="btn"><Icons.Download/>Exportar</button>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}><Icons.Plus/>Nuevo préstamo</button>
        </>
      }/>

      <div className="page page-wide">
        <div className="page-head">
          <div>
            <h1 className="page-title">Préstamos</h1>
            <div className="page-sub">{loans.length} préstamos · {totalActivos} activos · 2 en mora</div>
          </div>
          <div className="right" style={{display:'flex', gap:24, alignItems:'baseline'}}>
            <div>
              <div className="mono" style={{fontSize:10, color:'var(--text-3)', letterSpacing:'0.08em'}}>SALDO TOTAL</div>
              <div className="serif" style={{fontSize:26}}><span className="mono" style={{fontSize:11, color:'var(--text-3)'}}>$</span> {MOCK.fmt(totalCartera)}</div>
            </div>
            <div>
              <div className="mono" style={{fontSize:10, color:'var(--text-3)', letterSpacing:'0.08em'}}>TASA PROM.</div>
              <div className="serif" style={{fontSize:26}}>18.5<span style={{color:'var(--text-3)', fontSize:18}}>%</span></div>
            </div>
          </div>
        </div>

        <div className="filters">
          <div className={'chip ' + (filter==='all'?'active':'')} onClick={() => setFilter('all')}>Todos</div>
          <div className={'chip ' + (filter==='active'?'active':'')} onClick={() => setFilter('active')}>Al día</div>
          <div className={'chip ' + (filter==='late'?'active':'')} onClick={() => setFilter('late')}>En mora</div>
          <div className="chip">Por vencer 7d</div>
          <div style={{marginLeft:'auto', display:'flex', gap:8}}>
            <div className="search" style={{width:240}}>
              <Icons.Search size={14}/>
              <input placeholder="ID, cliente, propósito…"/>
            </div>
          </div>
        </div>

        <div className="card" style={{padding:0, overflow:'hidden'}}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{paddingLeft:18}}>ID</th>
                <th>Cliente</th>
                <th>Propósito</th>
                <th>Principal</th>
                <th>Saldo</th>
                <th>Cuotas</th>
                <th>Tasa</th>
                <th>Próxima</th>
                <th>Estado</th>
                <th style={{paddingRight:18}}></th>
              </tr>
            </thead>
            <tbody>
              {loans.map(l => (
                <tr key={l.id} onClick={() => setSelected(l)} style={{cursor:'pointer'}}>
                  <td style={{paddingLeft:18}} className="mono">{l.id}</td>
                  <td>{l.client}</td>
                  <td className="dim">{l.purpose}</td>
                  <td className="num mono">$ {MOCK.fmt(l.principal)}</td>
                  <td className="num mono">$ {MOCK.fmt(l.balance)}</td>
                  <td>
                    <div className="row" style={{gap:8}}>
                      <span className="mono" style={{fontSize:12, width:40}}>{l.paid}/{l.term}</span>
                      <div style={{flex:1, maxWidth:80, height:3, background:'var(--surface-2)', borderRadius:2, overflow:'hidden'}}>
                        <div style={{height:'100%', width: (l.paid/l.term*100)+'%', background:'var(--accent)'}}></div>
                      </div>
                    </div>
                  </td>
                  <td className="mono">{l.rate}%</td>
                  <td className="dim mono">{l.next}</td>
                  <td><span className={'pill ' + (l.status==='active'?'success':'danger')}><span className="dot"></span>{l.status==='active'?'Al día':`Mora ${l.daysLate}d`}</span></td>
                  <td style={{paddingRight:18}}><Icons.Chevron size={14} stroke="var(--text-3)"/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
};

// ====== Loan Detail with amortization ======
const LoanDetail = ({ loan, onBack }) => {
  const [tab, setTab] = useStateLoans('amortization');
  const desemboldateStr = loan.desembolso;
  const dateMap = { ene:0, feb:1, mar:2, abr:3, may:4, jun:5, jul:6, ago:7, sep:8, oct:9, nov:10, dic:11 };
  const parts = desemboldateStr.split(' ');
  const sd = new Date(parseInt(parts[2]), dateMap[parts[1]], parseInt(parts[0]));
  const schedule = MOCK.genAmortization(loan.principal, loan.rate, loan.term, sd);

  return (
    <main className="main">
      <Topbar crumb={['Cartera', 'Préstamos', loan.id]} actions={
        <>
          <button className="btn"><Icons.Download/>Pagaré</button>
          <button className="btn"><Icons.Receipt/>Estado de cuenta</button>
          <button className="btn btn-primary"><Icons.Plus/>Registrar pago</button>
        </>
      }/>

      <div className="page page-wide">
        <button className="btn btn-ghost" onClick={onBack} style={{marginBottom:14, padding:'4px 8px'}}>← Volver a préstamos</button>

        <div className="page-head">
          <div>
            <div className="mono" style={{fontSize:11, color:'var(--text-3)', letterSpacing:'0.08em'}}>PRÉSTAMO · {loan.id}</div>
            <h1 className="page-title" style={{fontSize:38}}>{loan.client}</h1>
            <div className="row" style={{gap:10, marginTop:8}}>
              <span className="pill">{loan.purpose}</span>
              <span className="pill">Garantía: {loan.collateral}</span>
              <span className="pill">{loan.frequency}</span>
              <span className={'pill ' + (loan.status==='active'?'success':'danger')}>
                <span className="dot"></span>{loan.status==='active'?'Al día':`Mora ${loan.daysLate}d`}
              </span>
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="kpi-grid" style={{marginBottom:24, gridTemplateColumns:'repeat(5, 1fr)'}}>
          <div className="kpi">
            <div className="kpi-label">Principal</div>
            <div className="kpi-value" style={{fontSize:28}}><span className="cur mono">$</span>{MOCK.fmt(loan.principal)}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Saldo</div>
            <div className="kpi-value" style={{fontSize:28, color:'var(--accent)'}}><span className="cur mono" style={{color:'var(--accent)'}}>$</span>{MOCK.fmt(loan.balance)}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Cuota</div>
            <div className="kpi-value" style={{fontSize:28}}><span className="cur mono">$</span>{MOCK.fmt(loan.cuota)}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Tasa EA</div>
            <div className="kpi-value" style={{fontSize:28}}>{loan.rate}<span style={{color:'var(--text-3)', fontSize:18}}>%</span></div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Progreso</div>
            <div className="kpi-value" style={{fontSize:28}}>{loan.paid}<span style={{color:'var(--text-3)', fontSize:18}}>/{loan.term}</span></div>
          </div>
        </div>

        <div className="tabs">
          {[
            ['amortization','Tabla de amortización'],
            ['payments','Historial de pagos'],
            ['documents','Documentos'],
            ['notes','Notas internas'],
          ].map(([k,l]) => (
            <div key={k} className={'tab ' + (tab===k?'active':'')} onClick={() => setTab(k)}>{l}</div>
          ))}
        </div>

        {tab === 'amortization' && (
          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <div style={{padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div>
                <div className="card-title">Cronograma · {loan.term} cuotas {loan.frequency}es</div>
                <div style={{fontSize:12, color:'var(--text-3)', marginTop:2}}>Desembolso: {loan.desembolso} · Tasa {loan.rate}% EA</div>
              </div>
              <div className="row" style={{gap:8}}>
                <button className="btn"><Icons.Download/>Excel</button>
                <button className="btn">Imprimir</button>
              </div>
            </div>
            <div style={{maxHeight:480, overflowY:'auto'}}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{paddingLeft:20, width:50}}>#</th>
                    <th>Fecha</th>
                    <th style={{textAlign:'right'}}>Cuota</th>
                    <th style={{textAlign:'right'}}>Capital</th>
                    <th style={{textAlign:'right'}}>Interés</th>
                    <th style={{textAlign:'right', paddingRight:20}}>Saldo</th>
                    <th style={{paddingRight:18}}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((row,i) => {
                    const isPaid = i < loan.paid;
                    const isCurrent = i === loan.paid;
                    const isLate = isCurrent && loan.status === 'late';
                    return (
                      <tr key={i} style={{background: isCurrent?'var(--surface-2)':'transparent'}}>
                        <td style={{paddingLeft:20}} className="mono">{(i+1).toString().padStart(2,'0')}</td>
                        <td className="dim mono">{row.date}</td>
                        <td className="num mono">$ {MOCK.fmt(row.cuota)}</td>
                        <td className="num mono" style={{color:'var(--text-2)'}}>$ {MOCK.fmt(row.capital)}</td>
                        <td className="num mono" style={{color:'var(--text-3)'}}>$ {MOCK.fmt(row.interest)}</td>
                        <td className="num mono" style={{paddingRight:20}}>$ {MOCK.fmt(row.balance)}</td>
                        <td style={{paddingRight:18}}>
                          {isPaid ? <span className="pill success"><Icons.Check size={10}/>Pagada</span>
                            : isLate ? <span className="pill danger"><span className="dot"></span>Mora</span>
                            : isCurrent ? <span className="pill accent"><span className="dot"></span>Actual</span>
                            : <span className="pill"><span className="dot"></span>Pendiente</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'payments' && (
          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <table className="tbl">
              <thead><tr><th style={{paddingLeft:20}}>Fecha</th><th>Cuota #</th><th>Método</th><th>Cobrador</th><th style={{textAlign:'right', paddingRight:20}}>Monto</th></tr></thead>
              <tbody>
                {schedule.slice(0, loan.paid).reverse().map((r,i) => (
                  <tr key={i}>
                    <td style={{paddingLeft:20}} className="dim mono">{r.date}</td>
                    <td className="mono">{loan.paid - i}/{loan.term}</td>
                    <td>{['Nequi','Efectivo','Bancolombia','Daviplata'][i%4]}</td>
                    <td className="dim">{['Diego Ortiz','—','Diego Ortiz','—'][i%4]}</td>
                    <td className="num mono" style={{paddingRight:20}}>$ {MOCK.fmt(r.cuota)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'documents' && (
          <div className="grid-3">
            {[`Pagaré ${loan.id}.pdf`,'Contrato firmado.pdf','Solicitud original.pdf','Estudio de crédito.pdf','Tabla amortización.pdf','Liquidación.pdf'].map(d => (
              <div key={d} className="card" style={{padding:16}}>
                <div style={{aspectRatio:'4/3', background:'var(--surface-2)', borderRadius:8, display:'grid', placeItems:'center', color:'var(--text-3)', marginBottom:10}}>PDF</div>
                <div className="row" style={{justifyContent:'space-between'}}>
                  <span style={{fontSize:13}}>{d}</span>
                  <Icons.Download size={14} stroke="var(--text-3)"/>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'notes' && (
          <div className="card">
            <textarea placeholder="Agregar nota interna sobre este préstamo…" style={{width:'100%', minHeight:80, background:'var(--surface-2)', border:'1px solid var(--border-strong)', borderRadius:8, padding:12, color:'var(--text)', resize:'vertical'}}/>
            <div className="row" style={{justifyContent:'flex-end', marginTop:10}}>
              <button className="btn btn-primary">Guardar nota</button>
            </div>
            <div className="hr"/>
            {[
              { d:'12 nov 2025', a:'Diana Mejía', n:'Cliente prometió mejorar puntualidad. Garantía verificada con codeudor.'},
              { d:'10 nov 2025', a:'Diego Ortiz', n:'Visita de campo: negocio operando, inventario alto. Recomiendo aprobar.'},
            ].map((n,i) => (
              <div key={i} style={{padding:'14px 0', borderBottom: i===0?'1px solid var(--border)':'none'}}>
                <div className="row" style={{justifyContent:'space-between', marginBottom:6}}>
                  <span style={{fontSize:13}}>{n.a}</span>
                  <span className="mono" style={{fontSize:11, color:'var(--text-3)'}}>{n.d}</span>
                </div>
                <div style={{fontSize:13, color:'var(--text-2)'}}>{n.n}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

// ====== Loan Origination (new loan form + simulator) ======
const LoanOrigination = ({ onClose }) => {
  const [principal, setPrincipal] = useStateLoans(5000000);
  const [rate, setRate] = useStateLoans(18.4);
  const [term, setTerm] = useStateLoans(18);
  const [step, setStep] = useStateLoans(1);

  const r = rate / 100 / 12;
  const cuota = (principal * r) / (1 - Math.pow(1 + r, -term));
  const totalPay = cuota * term;
  const totalInt = totalPay - principal;

  return (
    <main className="main">
      <Topbar crumb={['Cartera', 'Préstamos', 'Nuevo']} actions={
        <button className="btn btn-ghost" onClick={onClose}><Icons.X/>Cancelar</button>
      }/>

      <div className="page page-wide">
        <div className="page-head">
          <div>
            <h1 className="page-title">Nuevo <em>préstamo</em></h1>
            <div className="page-sub">Simulador, evaluación y desembolso · paso {step} de 3</div>
          </div>
        </div>

        <div className="steps" style={{marginBottom:24}}>
          {['Cliente y monto','Términos y evaluación','Desembolso'].map((l,i) => (
            <React.Fragment key={l}>
              <div className={'step-dot ' + (i+1 < step ? 'done' : i+1 === step ? 'current' : '')} style={{width:60}}/>
              <span style={{fontSize:11.5, color: i+1 === step?'var(--text)':'var(--text-3)', marginRight:14}}>{l}</span>
            </React.Fragment>
          ))}
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:24}}>
          <div className="card" style={{padding:28}}>
            {step === 1 && <>
              <div className="serif" style={{fontSize:24, marginBottom:18}}>Cliente y monto</div>
              <Field label="Cliente" placeholder="Buscar por nombre o cédula…" wide/>
              <div style={{height:14}}/>
              <div className="card" style={{padding:14, background:'var(--bg-elev)', marginBottom:18}}>
                <div className="row" style={{gap:12}}>
                  <div className="avatar" style={{width:36, height:36, fontSize:12, background:'var(--surface-2)', color:'var(--text-2)'}}>MR</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14}}>Marisol Ramírez</div>
                    <div style={{fontSize:11.5, color:'var(--text-3)'}}>CC 43.118.927 · score 824 · 1 préstamo activo</div>
                  </div>
                  <span className="pill success"><span className="dot"></span>Pre-aprobado</span>
                </div>
              </div>

              <FormGrid>
                <Field label="Propósito" type="select" options={['Capital de trabajo','Inventario','Compra de activo','Educación','Emergencia','Otro']}/>
                <Field label="Tipo de cliente" type="select" options={['Recurrente','Nuevo','Graduado','Renegociación']}/>
              </FormGrid>

              <div style={{marginTop:18}}>
                <label style={{display:'block', fontSize:11, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8}}>Monto del préstamo</label>
                <div className="row" style={{gap:14, alignItems:'center'}}>
                  <span className="serif" style={{fontSize:38, minWidth:200}}>
                    <span className="mono" style={{fontSize:14, color:'var(--text-3)'}}>$</span> {MOCK.fmt(principal)}
                  </span>
                  <input type="range" min={500000} max={50000000} step={100000}
                         value={principal} onChange={e => setPrincipal(+e.target.value)}
                         style={{flex:1, accentColor:'var(--accent)'}}/>
                </div>
                <div className="row" style={{justifyContent:'space-between', marginTop:6, fontSize:11, color:'var(--text-3)', fontFamily:'var(--font-mono)'}}>
                  <span>$500k</span><span>$50M</span>
                </div>
              </div>
            </>}

            {step === 2 && <>
              <div className="serif" style={{fontSize:24, marginBottom:18}}>Términos</div>
              <FormGrid>
                <Field label="Frecuencia" type="select" options={['Mensual','Quincenal','Semanal','Diaria']}/>
                <Field label="Primer pago" type="date"/>
              </FormGrid>
              <div style={{marginTop:18}}>
                <label style={{display:'block', fontSize:11, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8}}>Plazo · {term} cuotas</label>
                <input type="range" min={3} max={48} value={term} onChange={e=>setTerm(+e.target.value)} style={{width:'100%', accentColor:'var(--accent)'}}/>
              </div>
              <div style={{marginTop:18}}>
                <label style={{display:'block', fontSize:11, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8}}>Tasa · {rate.toFixed(1)}% EA</label>
                <input type="range" min={10} max={30} step={0.1} value={rate} onChange={e=>setRate(+e.target.value)} style={{width:'100%', accentColor:'var(--accent)'}}/>
              </div>
              <div className="hr"/>
              <div className="serif" style={{fontSize:20, marginBottom:14}}>Garantía</div>
              <FormGrid>
                <Field label="Tipo" type="select" options={['Codeudor','Prenda','Hipoteca','Sin garantía','Mercancía']}/>
                <Field label="Valor garantía" prefix="$" placeholder="0"/>
              </FormGrid>
            </>}

            {step === 3 && <>
              <div className="serif" style={{fontSize:24, marginBottom:18}}>Desembolso</div>
              <FormGrid>
                <Field label="Método de desembolso" type="select" options={['Transferencia bancaria','Efectivo','Nequi','Daviplata','PSE']} wide/>
                <Field label="Cuenta destino" placeholder="*** *** 4421" wide/>
              </FormGrid>
              <div className="hr"/>
              <div style={{fontSize:11, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10}}>FIRMA DIGITAL</div>
              <div style={{display:'flex', flexDirection:'column', gap:10}}>
                {[
                  { l:'Pagaré electrónico', desc:'Documento principal de la obligación'},
                  { l:'Contrato de mutuo', desc:'Términos y condiciones del préstamo'},
                  { l:'Autorización Datacrédito', desc:'Consulta y reporte a centrales de riesgo'},
                ].map(d => (
                  <div key={d.l} className="card" style={{padding:'12px 14px', display:'flex', alignItems:'center', gap:12}}>
                    <div style={{width:30, height:30, borderRadius:6, background:'rgba(212,255,58,0.12)', display:'grid', placeItems:'center', color:'var(--accent)'}}>
                      <Icons.Check size={14}/>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13}}>{d.l}</div>
                      <div style={{fontSize:11.5, color:'var(--text-3)'}}>{d.desc}</div>
                    </div>
                    <span className="pill success"><Icons.Check size={10}/>Firmado</span>
                  </div>
                ))}
              </div>
            </>}

            <div className="row" style={{justifyContent:'space-between', marginTop: 28}}>
              <button className="btn" onClick={() => step>1?setStep(step-1):onClose()}>← {step>1?'Atrás':'Cancelar'}</button>
              <button className="btn btn-primary" onClick={() => step<3?setStep(step+1):onClose()}>
                {step<3?'Continuar':'Desembolsar préstamo'}<Icons.Chevron size={14}/>
              </button>
            </div>
          </div>

          {/* Simulator preview */}
          <div>
            <div className="card" style={{padding:22, marginBottom:14}}>
              <div className="card-title" style={{marginBottom:14}}>Simulación</div>
              <div className="row" style={{justifyContent:'space-between', alignItems:'flex-end', marginBottom: 18}}>
                <div>
                  <div className="mono" style={{fontSize:10, color:'var(--text-3)', letterSpacing:'0.08em'}}>CUOTA</div>
                  <div className="serif" style={{fontSize:42, lineHeight:1, letterSpacing:'-0.02em'}}>
                    <span className="mono" style={{fontSize:14, color:'var(--text-3)'}}>$</span> {MOCK.fmt(Math.round(cuota))}
                  </div>
                </div>
                <span className="pill accent">{rate.toFixed(1)}% EA</span>
              </div>
              {[
                ['Principal', `$ ${MOCK.fmt(principal)}`],
                ['Plazo', `${term} cuotas`],
                ['Total a pagar', `$ ${MOCK.fmt(Math.round(totalPay))}`],
                ['Total intereses', `$ ${MOCK.fmt(Math.round(totalInt))}`],
              ].map(([k,v]) => (
                <div key={k} className="row" style={{justifyContent:'space-between', padding:'6px 0', fontSize:13}}>
                  <span style={{color:'var(--text-3)'}}>{k}</span>
                  <span className="mono">{v}</span>
                </div>
              ))}
              <div className="hr"/>
              <div style={{display:'flex', alignItems:'flex-end', gap:2, height:48}}>
                {Array.from({length: Math.min(term, 24)}, (_,i) => (
                  <div key={i} style={{flex:1, height: 30 + (i*1.5), background: i===0?'var(--accent)':'var(--surface-2)', borderRadius:1}}></div>
                ))}
              </div>
              <div style={{fontSize:11, color:'var(--text-3)', marginTop:6, textAlign:'center'}}>Distribución de cuotas</div>
            </div>

            <div className="card" style={{padding:18}}>
              <div className="row" style={{gap:10, marginBottom:8}}>
                <Icons.Sparkles size={14} stroke="var(--accent)"/>
                <span className="mono" style={{fontSize:11, color:'var(--accent)', letterSpacing:'0.08em'}}>EVALUACIÓN IA</span>
              </div>
              <div style={{fontSize:13, color:'var(--text-2)', marginBottom:14}}>
                Cliente con perfil sólido. Cuota representa <strong style={{color:'var(--text)'}}>26.6%</strong> del ingreso, dentro del umbral seguro (&lt; 35%).
              </div>
              <div className="row" style={{gap:8}}>
                <span className="pill success"><Icons.Check size={10}/>Capacidad OK</span>
                <span className="pill success"><Icons.Check size={10}/>Historial OK</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

window.LoansScreen = LoansScreen;
