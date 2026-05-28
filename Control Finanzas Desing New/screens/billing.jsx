// Plan & Facturación SaaS
const { useState: useStateBill } = React;

const BillingScreen = () => {
  const [tab, setTab] = useStateBill('plan');

  const usage = {
    clientes: { used: 1247, limit: 2000 },
    cobradores: { used: 4, limit: 10 },
    storage: { used: 4.2, limit: 25 },
    sms: { used: 1840, limit: 5000 },
  };

  return (
    <main className="main">
      <Topbar crumb={['Cuenta', 'Plan & Facturación']}/>

      <div className="page page-wide">
        <div className="page-head">
          <div>
            <h1 className="page-title">Plan & <em>facturación</em></h1>
            <div className="page-sub">Préstamos Andina S.A.S · Plan Pro · facturación mensual</div>
          </div>
        </div>

        <div className="tabs">
          {[['plan','Plan actual'],['usage','Uso'],['invoices','Facturas'],['payment','Método de pago']].map(([k,l]) => (
            <div key={k} className={'tab ' + (tab===k?'active':'')} onClick={() => setTab(k)}>{l}</div>
          ))}
        </div>

        {tab === 'plan' && (
          <>
            <div style={{display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:24, marginBottom:24}}>
              <div className="card" style={{padding:28, position:'relative', overflow:'hidden'}}>
                <div style={{position:'absolute', top:-40, right:-40, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle, var(--accent-soft), transparent 70%)'}}></div>
                <div className="mono" style={{fontSize:11, color:'var(--accent)', letterSpacing:'0.08em'}}>PLAN ACTUAL</div>
                <div className="serif" style={{fontSize:48, marginTop:4, letterSpacing:'-0.02em'}}>Pro</div>
                <div style={{color:'var(--text-3)', marginTop:6, fontSize:14}}>Hasta 2.000 clientes · 10 cobradores · soporte prioritario</div>

                <div className="row" style={{gap:24, marginTop:24, alignItems:'baseline'}}>
                  <div>
                    <div className="serif" style={{fontSize:36, lineHeight:1}}><span className="mono" style={{fontSize:14, color:'var(--text-3)'}}>$</span>590.000</div>
                    <div className="mono" style={{fontSize:11, color:'var(--text-3)', marginTop:4}}>/ MES + IVA</div>
                  </div>
                  <span className="pill accent">Renovación 12 jun 2026</span>
                </div>

                <div className="hr" style={{margin:'24px 0'}}/>

                <div style={{fontSize:11, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:14}}>INCLUIDO</div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:24}}>
                  {[
                    'Clientes ilimitados en demo',
                    'Hasta 2.000 clientes activos',
                    '10 cobradores en campo',
                    'App móvil para cobradores',
                    'Conciliación bancaria automática',
                    'Reportes y analíticas IA',
                    'Mensajería WhatsApp Business',
                    'Soporte prioritario 24/7',
                    'Firma electrónica de pagarés',
                    'API y webhooks',
                  ].map(f => (
                    <div key={f} className="row" style={{gap:8, fontSize:13}}>
                      <Icons.Check size={14} stroke="var(--accent)"/>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>

                <div className="row" style={{gap:8}}>
                  <button className="btn btn-primary">Mejorar a Enterprise</button>
                  <button className="btn">Cambiar a anual <span className="pill accent" style={{marginLeft:6}}>−20%</span></button>
                </div>
              </div>

              <div>
                <div className="card" style={{marginBottom:14, padding:20}}>
                  <div className="card-title" style={{marginBottom:14}}>Próximo cobro</div>
                  <div className="serif" style={{fontSize:32, lineHeight:1}}><span className="mono" style={{fontSize:12, color:'var(--text-3)'}}>$</span>702.100</div>
                  <div style={{fontSize:12, color:'var(--text-3)', marginTop:4}}>12 de junio 2026 · IVA incluido</div>
                  <div className="hr"/>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0', fontSize:13}}>
                    <span style={{color:'var(--text-3)'}}>Suscripción Pro</span>
                    <span className="mono">$ 590.000</span>
                  </div>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0', fontSize:13}}>
                    <span style={{color:'var(--text-3)'}}>IVA 19%</span>
                    <span className="mono">$ 112.100</span>
                  </div>
                </div>

                <div className="card" style={{padding:20}}>
                  <div className="card-title" style={{marginBottom:12}}>Método actual</div>
                  <div className="row" style={{gap:14}}>
                    <div style={{width:46, height:32, borderRadius:5, background:'linear-gradient(135deg, #1a1a1a, #333)', display:'grid', placeItems:'center', fontSize:9, fontFamily:'var(--font-mono)', color:'var(--text-2)'}}>VISA</div>
                    <div>
                      <div style={{fontSize:13}}>•••• 4421</div>
                      <div style={{fontSize:11.5, color:'var(--text-3)'}}>Expira 09/27</div>
                    </div>
                    <button className="btn btn-ghost" style={{marginLeft:'auto'}}>Cambiar</button>
                  </div>
                </div>
              </div>
            </div>

            {/* All plans comparison */}
            <div className="serif" style={{fontSize:24, marginBottom:14}}>Otros planes</div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12}}>
              {[
                { n:'Starter', p:'89.000', clients:'100', cobr:'2', current:false },
                { n:'Operativo', p:'249.000', clients:'500', cobr:'5', current:false },
                { n:'Pro', p:'590.000', clients:'2.000', cobr:'10', current:true },
                { n:'Enterprise', p:'Personalizado', clients:'Ilimitado', cobr:'Ilimitado', current:false },
              ].map(p => (
                <div key={p.n} className="card" style={{padding:20, borderColor: p.current?'var(--accent)':'var(--border)', position:'relative'}}>
                  {p.current && <span className="pill accent" style={{position:'absolute', top:-9, right:14}}>Actual</span>}
                  <div className="serif" style={{fontSize:22}}>{p.n}</div>
                  <div style={{marginTop:8, marginBottom:14}}>
                    {p.p === 'Personalizado' ? (
                      <div className="serif" style={{fontSize:24}}>Custom</div>
                    ) : (
                      <div className="row" style={{alignItems:'baseline', gap:4}}>
                        <span className="mono" style={{fontSize:11, color:'var(--text-3)'}}>$</span>
                        <span className="serif" style={{fontSize:28}}>{p.p}</span>
                        <span style={{fontSize:11, color:'var(--text-3)', fontFamily:'var(--font-mono)'}}>/mes</span>
                      </div>
                    )}
                  </div>
                  <div style={{fontSize:12, color:'var(--text-3)', display:'flex', flexDirection:'column', gap:6}}>
                    <div>{p.clients} clientes</div>
                    <div>{p.cobr} cobradores</div>
                  </div>
                  {!p.current && <button className="btn" style={{width:'100%', justifyContent:'center', marginTop:14}}>Seleccionar</button>}
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'usage' && (
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
            {[
              { k:'Clientes activos', u: usage.clientes.used, l: usage.clientes.limit, fmt: (v) => v.toLocaleString('es-CO') },
              { k:'Cobradores en campo', u: usage.cobradores.used, l: usage.cobradores.limit, fmt: (v) => v },
              { k:'Almacenamiento (GB)', u: usage.storage.used, l: usage.storage.limit, fmt: (v) => v.toFixed(1) },
              { k:'SMS / WhatsApp', u: usage.sms.used, l: usage.sms.limit, fmt: (v) => v.toLocaleString('es-CO') },
            ].map(u => {
              const pct = u.u / u.l * 100;
              const color = pct > 85 ? 'var(--danger)' : pct > 60 ? 'var(--warning)' : 'var(--accent)';
              return (
                <div key={u.k} className="card" style={{padding:22}}>
                  <div className="card-title" style={{marginBottom:14}}>{u.k}</div>
                  <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
                    <div className="serif" style={{fontSize:38, lineHeight:1}}>{u.fmt(u.u)}</div>
                    <div className="mono" style={{fontSize:12, color:'var(--text-3)'}}>/ {u.fmt(u.l)}</div>
                  </div>
                  <div style={{height:6, background:'var(--surface-2)', borderRadius:3, marginTop:14, overflow:'hidden'}}>
                    <div style={{height:'100%', width: pct+'%', background: color, borderRadius:3}}></div>
                  </div>
                  <div className="row" style={{justifyContent:'space-between', marginTop:8, fontSize:11.5, color:'var(--text-3)'}}>
                    <span>{pct.toFixed(0)}% usado</span>
                    <span className="mono">{u.fmt(u.l - u.u)} restante</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'invoices' && (
          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <table className="tbl">
              <thead>
                <tr><th style={{paddingLeft:18}}>Factura</th><th>Fecha</th><th>Concepto</th><th>Estado</th><th style={{textAlign:'right'}}>Monto</th><th style={{paddingRight:18}}></th></tr>
              </thead>
              <tbody>
                {[
                  ['FE-2026-0512','12 may 2026','Suscripción Pro · mayo','paid',702100],
                  ['FE-2026-0412','12 abr 2026','Suscripción Pro · abril','paid',702100],
                  ['FE-2026-0312','12 mar 2026','Suscripción Pro · marzo','paid',702100],
                  ['FE-2026-0312-A','08 mar 2026','SMS adicional (1.500 uds)','paid',45000],
                  ['FE-2026-0212','12 feb 2026','Suscripción Pro · febrero','paid',702100],
                  ['FE-2026-0112','12 ene 2026','Suscripción Pro · enero','paid',702100],
                ].map(([id,d,c,st,m]) => (
                  <tr key={id}>
                    <td style={{paddingLeft:18}} className="mono">{id}</td>
                    <td className="dim">{d}</td>
                    <td>{c}</td>
                    <td><span className="pill success"><Icons.Check size={10}/>Pagada</span></td>
                    <td className="num mono">$ {MOCK.fmt(m)}</td>
                    <td style={{paddingRight:18}}><button className="btn btn-ghost" style={{padding:'2px 8px'}}><Icons.Download size={12}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'payment' && (
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24}}>
            <div className="card" style={{padding:24}}>
              <div className="card-title" style={{marginBottom:16}}>Método principal</div>
              <div style={{padding:'20px 24px', borderRadius:14, background:'linear-gradient(135deg, #1a1a1a, #0a0a0a)', border:'1px solid var(--border-strong)', position:'relative', overflow:'hidden'}}>
                <div style={{position:'absolute', top:-20, right:-20, width:120, height:120, borderRadius:'50%', background:'radial-gradient(circle, var(--accent-soft), transparent 70%)'}}></div>
                <div style={{fontSize:11, color:'var(--text-3)', fontFamily:'var(--font-mono)', letterSpacing:'0.08em'}}>TARJETA DE CRÉDITO</div>
                <div className="mono" style={{fontSize:20, marginTop: 24, letterSpacing:'0.15em'}}>•••• •••• •••• 4421</div>
                <div className="row" style={{justifyContent:'space-between', marginTop:18}}>
                  <div>
                    <div style={{fontSize:10, color:'var(--text-3)', fontFamily:'var(--font-mono)'}}>TITULAR</div>
                    <div style={{fontSize:13, marginTop:2}}>Diana Mejía</div>
                  </div>
                  <div>
                    <div style={{fontSize:10, color:'var(--text-3)', fontFamily:'var(--font-mono)'}}>EXPIRA</div>
                    <div className="mono" style={{fontSize:13, marginTop:2}}>09/27</div>
                  </div>
                  <div style={{padding:'4px 8px', borderRadius:4, background:'rgba(255,255,255,0.06)', fontFamily:'var(--font-mono)', fontSize:11}}>VISA</div>
                </div>
              </div>
              <button className="btn" style={{width:'100%', justifyContent:'center', marginTop:16}}><Icons.Plus/>Agregar otra</button>
            </div>

            <div className="card" style={{padding:24}}>
              <div className="card-title" style={{marginBottom:16}}>Facturación</div>
              <FormGrid>
                <Field label="Razón social" defaultValue="Préstamos Andina S.A.S" wide/>
                <Field label="NIT" defaultValue="901.234.567-8"/>
                <Field label="Régimen" type="select" options={['Común','Simplificado','No responsable IVA']}/>
                <Field label="Email facturación" defaultValue="contabilidad@prestamos-andina.co" wide/>
                <Field label="Dirección" defaultValue="Cra 43 #18-22, Medellín" wide/>
              </FormGrid>
              <button className="btn btn-primary" style={{marginTop:16}}>Guardar cambios</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

window.BillingScreen = BillingScreen;
