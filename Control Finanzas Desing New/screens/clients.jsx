// Clientes (CRM) — lista + perfil 360 + registro
const { useState: useStateCli } = React;

const statusMap = {
  'al-dia': { l:'Al día', c:'success' },
  'mora-corta': { l:'Mora <30d', c:'warning' },
  'mora-larga': { l:'Mora 30d+', c:'danger' },
};

const ClientsScreen = ({ onNav }) => {
  const [selected, setSelected] = useStateCli(null);
  const [search, setSearch] = useStateCli('');
  const [filter, setFilter] = useStateCli('all');
  const [showRegister, setShowRegister] = useStateCli(false);

  const clients = MOCK.CLIENTS.filter(c => {
    if (filter !== 'all' && c.status !== filter) return false;
    if (search && !c.n.toLowerCase().includes(search.toLowerCase()) && !c.cc.includes(search)) return false;
    return true;
  });

  if (showRegister) return <ClientRegister onClose={() => setShowRegister(false)}/>;
  if (selected) return <ClientDetail client={selected} onBack={() => setSelected(null)} onNav={onNav}/>;

  return (
    <main className="main">
      <Topbar crumb={['Cartera', 'Clientes']} actions={
        <>
          <button className="btn"><Icons.Download/>Exportar</button>
          <button className="btn btn-primary" onClick={() => setShowRegister(true)}><Icons.Plus/>Nuevo cliente</button>
        </>
      }/>

      <div className="page page-wide">
        <div className="page-head">
          <div>
            <h1 className="page-title">Clientes</h1>
            <div className="page-sub">{clients.length} de {MOCK.CLIENTS.length} · 23 en mora · score promedio 728</div>
          </div>
          <div className="right" style={{display:'flex', gap:24, alignItems:'baseline'}}>
            <div>
              <div className="mono" style={{fontSize:10, color:'var(--text-3)', letterSpacing:'0.08em'}}>CARTERA TOTAL</div>
              <div className="serif" style={{fontSize:26}}><span className="mono" style={{fontSize:11, color:'var(--text-3)'}}>$</span> 1.842M</div>
            </div>
          </div>
        </div>

        <div className="filters">
          <div className={'chip ' + (filter==='all'?'active':'')} onClick={() => setFilter('all')}>Todos <span className="mono" style={{color:'var(--text-3)', marginLeft:2}}>{MOCK.CLIENTS.length}</span></div>
          <div className={'chip ' + (filter==='al-dia'?'active':'')} onClick={() => setFilter('al-dia')}>Al día</div>
          <div className={'chip ' + (filter==='mora-corta'?'active':'')} onClick={() => setFilter('mora-corta')}>Mora corta</div>
          <div className={'chip ' + (filter==='mora-larga'?'active':'')} onClick={() => setFilter('mora-larga')}>Mora larga</div>
          <div style={{marginLeft:'auto', display:'flex', gap:8, alignItems:'center'}}>
            <div className="search" style={{width:260}}>
              <Icons.Search size={14}/>
              <input placeholder="Nombre o cédula…" value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
            <div className="chip"><Icons.Filter/>Filtros</div>
          </div>
        </div>

        <div className="card" style={{padding:0, overflow:'hidden'}}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{paddingLeft:18}}>Cliente</th>
                <th>Cédula</th>
                <th>Ciudad</th>
                <th>Score</th>
                <th>Activos</th>
                <th>Cartera</th>
                <th>% Puntual</th>
                <th>Estado</th>
                <th style={{paddingRight:18}}></th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => {
                const st = statusMap[c.status] || statusMap['al-dia'];
                const scoreColor = c.score >= 750 ? 'var(--success)' : c.score >= 650 ? 'var(--warning)' : 'var(--danger)';
                return (
                  <tr key={c.id} onClick={() => setSelected(c)} style={{cursor:'pointer'}}>
                    <td style={{paddingLeft:18}}>
                      <div style={{display:'flex', alignItems:'center', gap:10}}>
                        <div className="avatar" style={{width:30, height:30, fontSize:11, background:'var(--surface-2)', color:'var(--text-2)'}}>
                          {c.n.split(' ').map(s=>s[0]).slice(0,2).join('')}
                        </div>
                        <div>
                          <div style={{fontSize:13.5}}>{c.n}</div>
                          <div style={{fontSize:11, color:'var(--text-3)', fontFamily:'var(--font-mono)'}}>{c.id} · desde {c.since}</div>
                        </div>
                      </div>
                    </td>
                    <td className="mono dim">{c.cc}</td>
                    <td>{c.city}</td>
                    <td>
                      <span className="mono" style={{color: scoreColor, fontSize:13}}>{c.score}</span>
                    </td>
                    <td className="mono">{c.activos}{c.graduated && <span className="pill" style={{marginLeft:6}}>Graduado</span>}</td>
                    <td className="num mono">$ {MOCK.fmt(c.total)}</td>
                    <td>
                      <div className="row" style={{gap:6}}>
                        <div style={{width:42, height:3, background:'var(--surface-2)', borderRadius:2, overflow:'hidden'}}>
                          <div style={{height:'100%', width: c.ontime+'%', background: c.ontime>=95?'var(--accent)':c.ontime>=85?'var(--warning)':'var(--danger)'}}></div>
                        </div>
                        <span className="mono" style={{fontSize:11}}>{c.ontime}%</span>
                      </div>
                    </td>
                    <td><span className={'pill ' + st.c}><span className="dot"></span>{st.l}</span></td>
                    <td style={{paddingRight:18, textAlign:'right'}}><Icons.Chevron size={14} stroke="var(--text-3)"/></td>
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

// ====== Client Detail (360°) ======
const ClientDetail = ({ client, onBack, onNav }) => {
  const [tab, setTab] = useStateCli('overview');
  const loans = MOCK.LOANS.filter(l => l.clientId === client.id);
  const st = statusMap[client.status];
  const scoreColor = client.score >= 750 ? 'var(--success)' : client.score >= 650 ? 'var(--warning)' : 'var(--danger)';

  return (
    <main className="main">
      <Topbar crumb={['Cartera', 'Clientes', client.n]} actions={
        <>
          <button className="btn"><Icons.Phone size={14}/>Llamar</button>
          <button className="btn"><Icons.Receipt/>Nuevo préstamo</button>
          <button className="btn btn-primary"><Icons.Plus/>Registrar pago</button>
        </>
      }/>

      <div className="page page-wide">
        <button className="btn btn-ghost" onClick={onBack} style={{marginBottom:14, padding:'4px 8px'}}>← Volver a clientes</button>

        <div className="page-head">
          <div className="row" style={{gap:18}}>
            <div className="avatar" style={{width:72, height:72, fontSize:24, background:'linear-gradient(135deg, #60a5fa, #a78bfa)', color:'#000'}}>
              {client.n.split(' ').map(s=>s[0]).slice(0,2).join('')}
            </div>
            <div>
              <h1 className="page-title" style={{fontSize:36}}>{client.n}</h1>
              <div className="row" style={{gap:10, marginTop:8}}>
                <span className="pill"><Icons.User size={11}/>{client.id}</span>
                <span className="pill">{client.cc}</span>
                <span className="pill"><Icons.Pin size={11}/>{client.city}</span>
                <span className={'pill ' + st.c}><span className="dot"></span>{st.l}</span>
              </div>
              <div className="row" style={{gap:12, marginTop:8, color:'var(--text-3)', fontSize:12.5}}>
                <span>{client.tel}</span>
                <span>·</span>
                <span>Cliente desde {client.since}</span>
                <span>·</span>
                <span>Asesor: {client.ref}</span>
              </div>
            </div>
          </div>
          <div className="right" style={{display:'flex', gap:32, alignItems:'flex-start'}}>
            <div>
              <div className="mono" style={{fontSize:10, color:'var(--text-3)', letterSpacing:'0.08em'}}>SALDO</div>
              <div className="serif" style={{fontSize:28, marginTop:2}}><span className="mono" style={{fontSize:11, color:'var(--text-3)'}}>$</span> {MOCK.fmt(client.total)}</div>
            </div>
            <div>
              <div className="mono" style={{fontSize:10, color:'var(--text-3)', letterSpacing:'0.08em'}}>SCORE</div>
              <div className="serif" style={{fontSize:28, marginTop:2, color: scoreColor}}>{client.score}</div>
            </div>
            <div>
              <div className="mono" style={{fontSize:10, color:'var(--text-3)', letterSpacing:'0.08em'}}>PUNTUALIDAD</div>
              <div className="serif" style={{fontSize:28, marginTop:2}}>{client.ontime}<span style={{color:'var(--text-3)', fontSize:18}}>%</span></div>
            </div>
          </div>
        </div>

        <div className="tabs">
          {[
            ['overview','Resumen'],
            ['loans','Préstamos ('+loans.length+')'],
            ['payments','Pagos'],
            ['docs','Documentos'],
            ['contacts','Contactos & referencias'],
            ['activity','Actividad'],
          ].map(([k,l]) => (
            <div key={k} className={'tab ' + (tab===k?'active':'')} onClick={() => setTab(k)}>{l}</div>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="grid-12">
            <div>
              <div className="card" style={{marginBottom:16}}>
                <div className="card-head">
                  <div className="card-title">Préstamos activos</div>
                  <button className="btn btn-ghost" style={{fontSize:12, padding:'2px 6px'}} onClick={() => setTab('loans')}>Ver todos →</button>
                </div>
                {loans.length === 0 ? (
                  <div style={{color:'var(--text-3)', fontSize:13, padding:'8px 0'}}>Sin préstamos activos.</div>
                ) : loans.map(l => (
                  <div key={l.id} onClick={() => onNav && onNav('loans')} style={{padding:'14px 0', borderBottom:'1px solid var(--border)', cursor:'pointer'}}>
                    <div className="row" style={{justifyContent:'space-between', alignItems:'flex-start'}}>
                      <div>
                        <div className="mono" style={{fontSize:11, color:'var(--text-3)'}}>{l.id} · {l.purpose}</div>
                        <div className="serif" style={{fontSize:22, marginTop:2}}><span className="mono" style={{fontSize:11, color:'var(--text-3)'}}>$</span> {MOCK.fmt(l.balance)}</div>
                        <div style={{fontSize:12, color:'var(--text-3)', marginTop:3}}>
                          Cuota {l.paid}/{l.term} · Tasa {l.rate}% EA · {l.frequency}
                        </div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <span className={'pill ' + (l.status==='active'?'success':'danger')}>
                          <span className="dot"></span>{l.status==='active'?'Al día':`Mora ${l.daysLate}d`}
                        </span>
                        <div className="mono" style={{fontSize:12, marginTop:6, color:'var(--text-2)'}}>Próxima: {l.next}</div>
                      </div>
                    </div>
                    <div style={{marginTop:10, height:3, background:'var(--surface-2)', borderRadius:2, overflow:'hidden'}}>
                      <div style={{height:'100%', width: (l.paid/l.term*100)+'%', background:'var(--accent)'}}></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Timeline */}
              <div className="card">
                <div className="card-head"><div className="card-title">Actividad reciente</div></div>
                {[
                  { d:'23 may · 14:32', t:'Pago confirmado', det:'$ 850.000 vía Nequi · cuota 7/24', tag:'success' },
                  { d:'06 may · 09:15', t:'Pago confirmado', det:'$ 850.000 vía Nequi · cuota 6/24', tag:'success' },
                  { d:'02 may', t:'WhatsApp enviado', det:'Recordatorio de cuota', tag:'info' },
                  { d:'15 abr · 10:00', t:'Visita de cobrador', det:'Diego Ortiz · pago en efectivo $ 850.000', tag:'success' },
                  { d:'12 nov 2025', t:'Préstamo desembolsado', det:'PR-1209 · $ 18.000.000 a 24 meses', tag:'accent' },
                ].map((a,i) => (
                  <div key={i} className="row" style={{padding:'12px 0', borderBottom: i<4?'1px solid var(--border)':'none', gap:14, alignItems:'flex-start'}}>
                    <div style={{width:8, height:8, borderRadius:'50%', background: a.tag==='success'?'var(--success)':a.tag==='accent'?'var(--accent)':'var(--info)', marginTop:6, flexShrink:0}}></div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13}}>{a.t}</div>
                      <div style={{fontSize:12, color:'var(--text-3)', marginTop:2}}>{a.det}</div>
                    </div>
                    <div className="mono" style={{fontSize:11, color:'var(--text-3)'}}>{a.d}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="card" style={{marginBottom:16}}>
                <div className="card-title" style={{marginBottom:14}}>Score de crédito</div>
                <div style={{position:'relative', textAlign:'center', padding:'8px 0 12px'}}>
                  <Charts.Donut size={140} thickness={16} segments={[
                    { value: client.score, color: scoreColor },
                    { value: 900 - client.score, color: 'var(--surface-2)' },
                  ]}/>
                  <div style={{position:'absolute', inset:0, display:'grid', placeItems:'center'}}>
                    <div>
                      <div className="serif" style={{fontSize:36, lineHeight:1, color: scoreColor}}>{client.score}</div>
                      <div style={{fontSize:10, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginTop:4}}>/ 900</div>
                    </div>
                  </div>
                </div>
                <div className="hr"/>
                {[
                  ['Pagos a tiempo', `${client.ontime}%`, 'success'],
                  ['Antigüedad', client.since, ''],
                  ['Capacidad pago', '$ 1.4M/mes', ''],
                  ['Datacrédito', 'Reporte limpio', 'success'],
                ].map(([k,v,t]) => (
                  <div key={k} className="row" style={{justifyContent:'space-between', padding:'6px 0', fontSize:12.5}}>
                    <span style={{color:'var(--text-3)'}}>{k}</span>
                    <span style={{color: t==='success'?'var(--success)':'var(--text)'}}>{v}</span>
                  </div>
                ))}
              </div>

              <div className="card" style={{marginBottom:16}}>
                <div className="card-title" style={{marginBottom:10}}>Información personal</div>
                {[
                  ['Cédula', client.cc],
                  ['Teléfono', client.tel],
                  ['Ciudad', client.city],
                  ['Ocupación', 'Comerciante'],
                  ['Ingresos', '$ 3.2M/mes'],
                  ['Estado civil', 'Casada'],
                  ['Dependientes', '2'],
                ].map(([k,v]) => (
                  <div key={k} className="row" style={{justifyContent:'space-between', padding:'5px 0', fontSize:12.5}}>
                    <span style={{color:'var(--text-3)'}}>{k}</span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>

              <div className="card">
                <div className="card-title" style={{marginBottom:10}}>Codeudor / Garantía</div>
                <div style={{fontSize:13}}>Andrés Ramírez Botero</div>
                <div style={{fontSize:12, color:'var(--text-3)', marginTop:2}}>CC 71.118.991 · esposo · +57 310 442 1188</div>
              </div>
            </div>
          </div>
        )}

        {tab === 'loans' && (
          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <table className="tbl">
              <thead>
                <tr><th style={{paddingLeft:18}}>Préstamo</th><th>Desembolso</th><th>Monto</th><th>Saldo</th><th>Cuotas</th><th>Próxima</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {loans.map(l => (
                  <tr key={l.id} onClick={() => onNav && onNav('loans')} style={{cursor:'pointer'}}>
                    <td style={{paddingLeft:18}} className="mono">{l.id}</td>
                    <td className="dim">{l.desembolso}</td>
                    <td className="mono">$ {MOCK.fmt(l.principal)}</td>
                    <td className="mono">$ {MOCK.fmt(l.balance)}</td>
                    <td className="mono">{l.paid}/{l.term}</td>
                    <td className="dim mono">{l.next}</td>
                    <td><span className={'pill ' + (l.status==='active'?'success':'danger')}><span className="dot"></span>{l.status==='active'?'Al día':`Mora ${l.daysLate}d`}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'payments' && (
          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <table className="tbl">
              <thead>
                <tr><th style={{paddingLeft:18}}>Fecha</th><th>Concepto</th><th>Préstamo</th><th>Método</th><th style={{textAlign:'right', paddingRight:18}}>Monto</th></tr>
              </thead>
              <tbody>
                {[
                  ['23 may 2026','Cuota 7/24','PR-1209','Nequi',850000],
                  ['06 may 2026','Cuota 6/24','PR-1209','Nequi',850000],
                  ['08 abr 2026','Cuota 5/24','PR-1209','Efectivo',850000],
                  ['10 mar 2026','Cuota 4/24','PR-1209','Nequi',850000],
                  ['11 feb 2026','Cuota 3/24','PR-1209','Bancolombia',850000],
                  ['12 ene 2026','Cuota 2/24','PR-1209','Efectivo',850000],
                  ['11 dic 2025','Cuota 1/24','PR-1209','Nequi',850000],
                ].map((p,i) => (
                  <tr key={i}>
                    <td style={{paddingLeft:18}} className="dim mono">{p[0]}</td>
                    <td>{p[1]}</td>
                    <td className="mono dim">{p[2]}</td>
                    <td>{p[3]}</td>
                    <td className="num mono" style={{paddingRight:18}}>$ {MOCK.fmt(p[4])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'docs' && (
          <div className="grid-3">
            {['Cédula frente.jpg','Cédula respaldo.jpg','Pagaré PR-1209.pdf','Servicios públicos.pdf','Carta laboral.pdf','Datacrédito.pdf'].map(d => (
              <div key={d} className="card" style={{padding:16, display:'flex', flexDirection:'column', gap:12}}>
                <div style={{aspectRatio:'4/3', background:'var(--surface-2)', borderRadius:8, display:'grid', placeItems:'center', color:'var(--text-3)', fontFamily:'var(--font-mono)', fontSize:11}}>
                  PDF / IMG
                </div>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <span style={{fontSize:13}}>{d}</span>
                  <button className="icon-btn" style={{width:28, height:28}}><Icons.Download size={12}/></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'contacts' && (
          <div className="card">
            <div className="card-title" style={{marginBottom:14}}>Referencias personales</div>
            {[
              { n:'María Eugenia Botero', rel:'Hermana', tel:'+57 314 882 4411', city:'Belén' },
              { n:'Jaime Ramírez', rel:'Hermano', tel:'+57 313 992 1144', city:'Itagüí' },
            ].map(r => (
              <div key={r.n} className="row" style={{padding:'14px 0', borderBottom:'1px solid var(--border)', gap:14}}>
                <div className="avatar" style={{width:36, height:36, fontSize:12, background:'var(--surface-2)', color:'var(--text-2)'}}>
                  {r.n.split(' ').map(s=>s[0]).slice(0,2).join('')}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13.5}}>{r.n}</div>
                  <div style={{fontSize:12, color:'var(--text-3)'}}>{r.rel} · {r.city}</div>
                </div>
                <div className="mono" style={{fontSize:13}}>{r.tel}</div>
                <button className="icon-btn"><Icons.Phone size={14}/></button>
              </div>
            ))}
          </div>
        )}

        {tab === 'activity' && (
          <div className="card">
            <div style={{padding:'8px 0'}}>
              {[
                ['23 may · 14:32','Pago $850.000 confirmado vía Nequi'],
                ['23 may · 14:30','Cobrador Diego Ortiz visitó'],
                ['22 may · 18:00','WhatsApp automático: recordatorio'],
                ['06 may · 09:15','Pago $850.000 confirmado'],
                ['02 may · 09:00','SMS enviado'],
                ['15 abr · 10:00','Cobrador visitó'],
                ['12 nov 2025','Préstamo PR-1209 desembolsado'],
                ['12 nov 2025','Pagaré firmado digitalmente'],
                ['10 nov 2025','Score actualizado: 824'],
                ['08 nov 2025','Cliente registrado por Diego Ortiz'],
              ].map(([d,t],i) => (
                <div key={i} className="row" style={{padding:'10px 0', borderBottom:i<9?'1px solid var(--border)':'none', gap:14}}>
                  <span className="mono dim" style={{fontSize:11, width:120}}>{d}</span>
                  <span style={{fontSize:13}}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

// ====== Client Register form ======
const ClientRegister = ({ onClose }) => {
  const [step, setStep] = useStateCli(1);
  return (
    <main className="main">
      <Topbar crumb={['Cartera', 'Clientes', 'Nuevo cliente']} actions={
        <button className="btn btn-ghost" onClick={onClose}><Icons.X/>Cancelar</button>
      }/>

      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Registrar <em>cliente</em></h1>
            <div className="page-sub">Paso {step} de 4 · datos personales, financieros, referencias y documentos</div>
          </div>
        </div>

        <div className="steps" style={{marginBottom:24}}>
          {[1,2,3,4].map(n => (
            <div key={n} className={'step-dot ' + (n < step ? 'done' : n === step ? 'current' : '')} style={{width:60}}/>
          ))}
        </div>

        <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:32}}>
          <div className="card" style={{padding: 28}}>
            {step === 1 && <>
              <div className="serif" style={{fontSize:24, marginBottom:18}}>Datos personales</div>
              <FormGrid>
                <Field label="Tipo de documento" type="select" options={['Cédula de ciudadanía','Cédula de extranjería','Pasaporte','NIT']}/>
                <Field label="Número de documento" placeholder="43.118.927"/>
                <Field label="Nombres" placeholder="Marisol" wide/>
                <Field label="Apellidos" placeholder="Ramírez Botero" wide/>
                <Field label="Fecha de nacimiento" type="date"/>
                <Field label="Género" type="select" options={['Femenino','Masculino','Otro','Prefiere no decir']}/>
                <Field label="Estado civil" type="select" options={['Soltero/a','Casado/a','Unión libre','Divorciado/a','Viudo/a']}/>
                <Field label="Personas a cargo" placeholder="2"/>
                <Field label="Teléfono móvil" placeholder="+57 310 442 1188"/>
                <Field label="Correo (opcional)" placeholder="marisol@ejemplo.com"/>
                <Field label="Dirección de residencia" placeholder="Cra 43 #18-22" wide/>
                <Field label="Barrio" placeholder="Belén"/>
                <Field label="Ciudad" type="select" options={['Medellín','Bello','Itagüí','Envigado','Sabaneta']}/>
              </FormGrid>
            </>}
            {step === 2 && <>
              <div className="serif" style={{fontSize:24, marginBottom:18}}>Información financiera</div>
              <FormGrid>
                <Field label="Ocupación" type="select" options={['Empleado','Independiente','Comerciante','Pensionado','Estudiante']}/>
                <Field label="Empresa / Negocio" placeholder="Tienda La Esperanza"/>
                <Field label="Cargo / Actividad" placeholder="Propietaria" wide/>
                <Field label="Ingresos mensuales" placeholder="3.200.000" prefix="$"/>
                <Field label="Otros ingresos" placeholder="0" prefix="$"/>
                <Field label="Gastos mensuales" placeholder="1.800.000" prefix="$"/>
                <Field label="Obligaciones financieras" placeholder="450.000" prefix="$"/>
                <Field label="Patrimonio estimado" placeholder="35.000.000" prefix="$"/>
                <Field label="Tipo de vivienda" type="select" options={['Propia','Familiar','Arrendada']}/>
              </FormGrid>
            </>}
            {step === 3 && <>
              <div className="serif" style={{fontSize:24, marginBottom:18}}>Referencias y codeudor</div>
              <div style={{fontSize:11, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10}}>CODEUDOR / GARANTE</div>
              <FormGrid>
                <Field label="Nombre completo" placeholder="Andrés Ramírez Botero" wide/>
                <Field label="Cédula" placeholder="71.118.991"/>
                <Field label="Parentesco" type="select" options={['Cónyuge','Padre/Madre','Hermano/a','Hijo/a','Amigo/a','Otro']}/>
                <Field label="Teléfono" placeholder="+57 310 442 1188"/>
                <Field label="Ocupación" placeholder="Empleado"/>
              </FormGrid>
              <div className="hr" style={{margin:'22px 0'}}/>
              <div style={{fontSize:11, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10}}>REFERENCIAS PERSONALES</div>
              {[1,2].map(i => (
                <FormGrid key={i} style={{marginBottom:14}}>
                  <Field label={`Referencia ${i} · Nombre`} placeholder="María Eugenia Botero"/>
                  <Field label="Parentesco" type="select" options={['Familiar','Amigo/a','Vecino/a','Conocido/a']}/>
                  <Field label="Teléfono" placeholder="+57 314 882 4411"/>
                </FormGrid>
              ))}
            </>}
            {step === 4 && <>
              <div className="serif" style={{fontSize:24, marginBottom:18}}>Documentos</div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                {['Cédula frente','Cédula respaldo','Servicios públicos','Carta laboral / RUT','Datacrédito (opcional)','Foto del cliente'].map((d,i) => (
                  <div key={d} className="card" style={{padding:16, textAlign:'center', borderStyle: i<3?'solid':'dashed', borderColor: i<3?'var(--accent)':'var(--border-strong)'}}>
                    <div style={{width:48, height:48, borderRadius:10, background:'var(--surface-2)', margin:'0 auto 10px', display:'grid', placeItems:'center', color: i<3?'var(--accent)':'var(--text-3)'}}>
                      {i<3 ? <Icons.Check size={20}/> : <Icons.Plus size={20}/>}
                    </div>
                    <div style={{fontSize:13.5}}>{d}</div>
                    <div style={{fontSize:11.5, color:'var(--text-3)', marginTop:2}}>{i<3 ? 'Cargado · 2.4 MB' : 'PNG, JPG o PDF'}</div>
                  </div>
                ))}
              </div>
            </>}

            <div className="row" style={{justifyContent:'space-between', marginTop: 28}}>
              <button className="btn" onClick={() => step>1?setStep(step-1):onClose()}>← {step>1?'Atrás':'Cancelar'}</button>
              <div className="row" style={{gap:8}}>
                <button className="btn btn-ghost">Guardar borrador</button>
                <button className="btn btn-primary" onClick={() => step<4?setStep(step+1):onClose()}>{step<4?'Continuar':'Registrar cliente'}<Icons.Chevron size={14}/></button>
              </div>
            </div>
          </div>

          <div>
            <div className="card" style={{marginBottom:14, padding: 20}}>
              <div className="card-title" style={{marginBottom: 12}}>Pre-validación</div>
              <div style={{textAlign:'center', padding:'12px 0'}}>
                <div className="serif" style={{fontSize:42, color:'var(--success)'}}>724</div>
                <div className="mono" style={{fontSize:11, color:'var(--text-3)', letterSpacing:'0.08em'}}>SCORE ESTIMADO</div>
              </div>
              <div className="hr"/>
              {[
                ['Datacrédito','Limpio','success'],
                ['Listas restrictivas','OK','success'],
                ['Edad','38 años','success'],
                ['Capacidad','Buena','success'],
                ['Antigüedad', '— ', ''],
              ].map(([k,v,t]) => (
                <div key={k} className="row" style={{justifyContent:'space-between', padding:'6px 0', fontSize:12.5}}>
                  <span style={{color:'var(--text-3)'}}>{k}</span>
                  <span style={{color: t==='success'?'var(--success)':'var(--text)'}}>{v}</span>
                </div>
              ))}
            </div>
            <div className="card" style={{padding:18, background:'var(--bg-elev)'}}>
              <div className="row" style={{gap:10, marginBottom:8}}>
                <Icons.Sparkles size={14} stroke="var(--accent)"/>
                <span className="mono" style={{fontSize:11, color:'var(--accent)', letterSpacing:'0.08em'}}>IA</span>
              </div>
              <div style={{fontSize:13, color:'var(--text-2)', letterSpacing:'-0.005em'}}>
                Cliente tiene perfil sólido. Recomendamos cupo inicial entre <strong style={{color:'var(--text)'}}>$2M y $8M</strong> a 12-18 meses.
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

// ====== Form primitives ======
const FormGrid = ({ children, style }) => (
  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, ...style}}>{children}</div>
);

const Field = ({ label, placeholder, wide, type='text', options, prefix, defaultValue }) => (
  <div style={{gridColumn: wide?'span 2':'auto'}}>
    <label style={{display:'block', fontSize:11, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>{label}</label>
    {type === 'select' ? (
      <div style={{position:'relative'}}>
        <select style={{width:'100%', padding:'9px 12px', background:'var(--surface-2)', border:'1px solid var(--border-strong)', borderRadius:6, color:'var(--text)', fontSize:13, appearance:'none'}}>
          {(options||[]).map(o => <option key={o}>{o}</option>)}
        </select>
        <Icons.Chevron size={12} style={{position:'absolute', right:10, top:'50%', transform:'translateY(-50%) rotate(90deg)', color:'var(--text-3)', pointerEvents:'none'}}/>
      </div>
    ) : (
      <div style={{position:'relative', display:'flex', alignItems:'center'}}>
        {prefix && <span style={{position:'absolute', left:12, color:'var(--text-3)', fontFamily:'var(--font-mono)', fontSize:13}}>{prefix}</span>}
        <input type={type} defaultValue={defaultValue} placeholder={placeholder} style={{width:'100%', padding: prefix?'9px 12px 9px 24px':'9px 12px', background:'var(--surface-2)', border:'1px solid var(--border-strong)', borderRadius:6, color:'var(--text)', fontSize:13}}/>
      </div>
    )}
  </div>
);

window.ClientsScreen = ClientsScreen;
window.ClientRegister = ClientRegister;
window.FormGrid = FormGrid;
window.Field = Field;
