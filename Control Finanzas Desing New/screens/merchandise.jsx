// Mercancía a crédito — catálogo, créditos mercantiles, registro
const { useState: useStateMer } = React;

const MerchandiseScreen = () => {
  const [tab, setTab] = useStateMer('catalog');
  const [showAdd, setShowAdd] = useStateMer(false);
  const [selected, setSelected] = useStateMer(null);

  if (showAdd) return <MerchRegister onClose={() => setShowAdd(false)}/>;
  if (selected) return <MerchSale item={selected} onBack={() => setSelected(null)}/>;

  return (
    <main className="main">
      <Topbar crumb={['Comercio', 'Mercancía']} actions={
        <>
          <button className="btn"><Icons.Download/>Inventario CSV</button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Icons.Plus/>Nuevo artículo</button>
        </>
      }/>

      <div className="page page-wide">
        <div className="page-head">
          <div>
            <h1 className="page-title">Mercancía a <em>crédito</em></h1>
            <div className="page-sub">Catálogo, créditos mercantiles e inventario en bodega</div>
          </div>
          <div className="right" style={{display:'flex', gap:24, alignItems:'baseline'}}>
            <div>
              <div className="mono" style={{fontSize:10, color:'var(--text-3)', letterSpacing:'0.08em'}}>INVENTARIO</div>
              <div className="serif" style={{fontSize:26}}>60 <span style={{color:'var(--text-3)', fontSize:18}}>uds</span></div>
            </div>
            <div>
              <div className="mono" style={{fontSize:10, color:'var(--text-3)', letterSpacing:'0.08em'}}>VENDIDO MES</div>
              <div className="serif" style={{fontSize:26}}><span className="mono" style={{fontSize:11, color:'var(--text-3)'}}>$</span> 42M</div>
            </div>
            <div>
              <div className="mono" style={{fontSize:10, color:'var(--text-3)', letterSpacing:'0.08em'}}>CRÉDITOS ACTIVOS</div>
              <div className="serif" style={{fontSize:26}}>{MOCK.MERCH_CREDITS.filter(c=>c.status!=='paid').length}</div>
            </div>
          </div>
        </div>

        <div className="tabs">
          <div className={'tab ' + (tab==='catalog'?'active':'')} onClick={() => setTab('catalog')}>Catálogo</div>
          <div className={'tab ' + (tab==='credits'?'active':'')} onClick={() => setTab('credits')}>Créditos mercantiles</div>
          <div className={'tab ' + (tab==='inventory'?'active':'')} onClick={() => setTab('inventory')}>Inventario & bodega</div>
        </div>

        {tab === 'catalog' && (
          <>
            <div className="filters">
              <div className="chip active">Todos · {MOCK.MERCH_CATALOG.length}</div>
              <div className="chip">Electrodomésticos</div>
              <div className="chip">Electrónica</div>
              <div className="chip">Muebles</div>
              <div className="chip">Cómputo</div>
              <div style={{marginLeft:'auto'}} className="search" style={{width:240}}>
                <Icons.Search size={14}/>
                <input placeholder="Buscar artículo o SKU…"/>
              </div>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14}}>
              {MOCK.MERCH_CATALOG.map(m => (
                <div key={m.id} className="card" style={{padding:0, overflow:'hidden', cursor:'pointer'}} onClick={() => setSelected(m)}>
                  {/* Product image placeholder — striped */}
                  <div style={{aspectRatio:'4/3', background:`repeating-linear-gradient(135deg, var(--surface-2) 0 8px, var(--surface) 8px 16px)`, position:'relative'}}>
                    <div style={{position:'absolute', top:10, left:10, padding:'2px 6px', borderRadius:4, background:'rgba(10,10,10,0.7)', fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-2)'}}>{m.sku}</div>
                    <div style={{position:'absolute', bottom:10, right:10}}>
                      <span className={'pill ' + (m.stock>5?'success':m.stock>0?'warning':'danger')}>
                        <span className="dot"></span>{m.stock} en bodega
                      </span>
                    </div>
                  </div>
                  <div style={{padding:14}}>
                    <div style={{fontSize:11, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.05em', fontFamily:'var(--font-mono)'}}>{m.category}</div>
                    <div style={{fontSize:14, marginTop:4, lineHeight:1.3}}>{m.name}</div>
                    <div className="row" style={{justifyContent:'space-between', marginTop:10, alignItems:'baseline'}}>
                      <div>
                        <div className="serif" style={{fontSize:22, lineHeight:1}}><span className="mono" style={{fontSize:10, color:'var(--text-3)'}}>$</span> {MOCK.fmt(m.price)}</div>
                        <div style={{fontSize:11, color:'var(--text-3)', marginTop:2}}>o $ {MOCK.fmt(Math.round(m.price/m.financed))}/mes × {m.financed}</div>
                      </div>
                      <button className="icon-btn" style={{width:28, height:28}}><Icons.Plus size={14}/></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'credits' && (
          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{paddingLeft:18}}>ID</th>
                  <th>Cliente</th>
                  <th>Artículo</th>
                  <th>Valor</th>
                  <th>Pagado</th>
                  <th>Cuotas</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {MOCK.MERCH_CREDITS.map(c => (
                  <tr key={c.id} style={{cursor:'pointer'}}>
                    <td style={{paddingLeft:18}} className="mono">{c.id}</td>
                    <td>{c.client}</td>
                    <td className="dim">{c.item}</td>
                    <td className="num mono">$ {MOCK.fmt(c.total)}</td>
                    <td>
                      <div className="row" style={{gap:8}}>
                        <span className="mono" style={{fontSize:12}}>$ {MOCK.fmt(c.paid)}</span>
                        <div style={{width:60, height:3, background:'var(--surface-2)', borderRadius:2, overflow:'hidden'}}>
                          <div style={{height:'100%', width: (c.paid/c.total*100)+'%', background: c.status==='paid'?'var(--success)':'var(--accent)'}}></div>
                        </div>
                      </div>
                    </td>
                    <td className="mono">{c.cuotas}</td>
                    <td>
                      {c.status==='paid' ? <span className="pill success"><Icons.Check size={10}/>Saldado</span>
                        : c.status==='late' ? <span className="pill danger"><span className="dot"></span>Mora {c.daysLate}d</span>
                        : <span className="pill accent"><span className="dot"></span>Activo</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'inventory' && (
          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{paddingLeft:18}}>SKU</th>
                  <th>Artículo</th>
                  <th>Bodega</th>
                  <th>Stock</th>
                  <th>Ventas mes</th>
                  <th>Rotación</th>
                  <th style={{textAlign:'right', paddingRight:18}}>Valor inventario</th>
                </tr>
              </thead>
              <tbody>
                {MOCK.MERCH_CATALOG.map(m => (
                  <tr key={m.id}>
                    <td style={{paddingLeft:18}} className="mono">{m.sku}</td>
                    <td>{m.name}</td>
                    <td className="dim">Principal</td>
                    <td>
                      <span className={'pill ' + (m.stock>5?'success':'warning')}><span className="dot"></span>{m.stock} uds</span>
                    </td>
                    <td className="mono">{m.sales}</td>
                    <td>
                      <div style={{width:60, height:3, background:'var(--surface-2)', borderRadius:2, overflow:'hidden'}}>
                        <div style={{height:'100%', width: Math.min(m.sales*2, 100)+'%', background:'var(--accent)'}}></div>
                      </div>
                    </td>
                    <td className="num mono" style={{paddingRight:18}}>$ {MOCK.fmt(m.price * m.stock)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
};

// ====== Merch register (new article) ======
const MerchRegister = ({ onClose }) => (
  <main className="main">
    <Topbar crumb={['Comercio', 'Mercancía', 'Nuevo artículo']} actions={
      <button className="btn btn-ghost" onClick={onClose}><Icons.X/>Cancelar</button>
    }/>
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Nuevo <em>artículo</em></h1>
          <div className="page-sub">Catálogo de mercancía financiable</div>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:24}}>
        <div className="card" style={{padding:28}}>
          <div className="serif" style={{fontSize:24, marginBottom:18}}>Información del artículo</div>
          <FormGrid>
            <Field label="Nombre del artículo" placeholder="Nevera 320L Indurama" wide/>
            <Field label="SKU" placeholder="NV-320"/>
            <Field label="Código de barras" placeholder="7702123456789"/>
            <Field label="Categoría" type="select" options={['Electrodomésticos','Electrónica','Muebles','Cómputo','Deporte','Hogar']}/>
            <Field label="Marca" placeholder="Indurama"/>
            <Field label="Modelo" placeholder="RI-320"/>
            <Field label="Bodega" type="select" options={['Principal','Sucursal Norte','Sucursal Sur']}/>
          </FormGrid>

          <div className="hr"/>
          <div className="serif" style={{fontSize:20, marginBottom:14}}>Precio y financiación</div>
          <FormGrid>
            <Field label="Precio de costo" prefix="$" placeholder="2.100.000"/>
            <Field label="Precio de venta" prefix="$" placeholder="2.890.000"/>
            <Field label="IVA aplicable" type="select" options={['19%','5%','0%','Excluido']}/>
            <Field label="Margen objetivo" placeholder="38%" prefix="%"/>
            <Field label="Tasa financiación EA" placeholder="22.0" prefix="%"/>
            <Field label="Cuota inicial mínima" placeholder="20%" prefix="%"/>
            <Field label="Plazo máximo" type="select" options={['12 meses','18 meses','24 meses','30 meses','36 meses']}/>
            <Field label="Frecuencia de cuota" type="select" options={['Mensual','Quincenal','Semanal']}/>
          </FormGrid>

          <div className="hr"/>
          <div className="serif" style={{fontSize:20, marginBottom:14}}>Inventario inicial</div>
          <FormGrid>
            <Field label="Cantidad" placeholder="10"/>
            <Field label="Stock mínimo" placeholder="3"/>
            <Field label="Ubicación en bodega" placeholder="Estantería A-3"/>
            <Field label="Proveedor" placeholder="Indurama Colombia S.A."/>
          </FormGrid>

          <div className="hr"/>
          <div className="serif" style={{fontSize:20, marginBottom:14}}>Imágenes</div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10}}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{aspectRatio:'1/1', border:'1px dashed var(--border-strong)', borderRadius:8, display:'grid', placeItems:'center', color:'var(--text-3)', cursor:'pointer'}}>
                <Icons.Plus size={18}/>
              </div>
            ))}
          </div>

          <div className="row" style={{justifyContent:'space-between', marginTop: 28}}>
            <button className="btn" onClick={onClose}>Cancelar</button>
            <div className="row" style={{gap:8}}>
              <button className="btn">Guardar borrador</button>
              <button className="btn btn-primary">Crear artículo</button>
            </div>
          </div>
        </div>

        <div>
          <div className="card" style={{padding:20, marginBottom:14}}>
            <div className="card-title" style={{marginBottom:14}}>Vista previa</div>
            <div style={{aspectRatio:'4/3', background:`repeating-linear-gradient(135deg, var(--surface-2) 0 8px, var(--surface) 8px 16px)`, borderRadius:10, marginBottom:12, display:'grid', placeItems:'center', color:'var(--text-3)', fontFamily:'var(--font-mono)', fontSize:11}}>
              Imagen del artículo
            </div>
            <div style={{fontSize:14}}>Nevera 320L Indurama</div>
            <div className="serif" style={{fontSize:24, marginTop:4}}><span className="mono" style={{fontSize:11, color:'var(--text-3)'}}>$</span> 2.890.000</div>
            <div style={{fontSize:11.5, color:'var(--text-3)', marginTop:4}}>o $ 120.417/mes × 24</div>
          </div>
          <div className="card" style={{padding:18, background:'var(--bg-elev)'}}>
            <div className="mono" style={{fontSize:11, color:'var(--accent)', letterSpacing:'0.08em', marginBottom:6}}>TIP</div>
            <div style={{fontSize:13, color:'var(--text-2)'}}>Para electrodomésticos de gama media, una cuota inicial del 20% y plazo de 24 meses tiene la mejor conversión histórica.</div>
          </div>
        </div>
      </div>
    </div>
  </main>
);

// ====== Merch sale flow ======
const MerchSale = ({ item, onBack }) => {
  const [inicial, setInicial] = useStateMer(20);
  const [plazo, setPlazo] = useStateMer(item.financed);
  const initialAmt = item.price * inicial / 100;
  const financed = item.price - initialAmt;
  const cuota = (financed * 0.022) / (1 - Math.pow(1.022, -plazo));

  return (
    <main className="main">
      <Topbar crumb={['Comercio', 'Mercancía', 'Venta a crédito']}/>
      <div className="page page-wide">
        <button className="btn btn-ghost" onClick={onBack} style={{marginBottom:14, padding:'4px 8px'}}>← Volver al catálogo</button>
        <div className="page-head">
          <div>
            <div className="mono" style={{fontSize:11, color:'var(--text-3)', letterSpacing:'0.08em'}}>VENDER A CRÉDITO</div>
            <h1 className="page-title" style={{fontSize:36}}>{item.name}</h1>
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24}}>
          <div className="card" style={{padding:28}}>
            <div style={{aspectRatio:'4/3', background:`repeating-linear-gradient(135deg, var(--surface-2) 0 8px, var(--surface) 8px 16px)`, borderRadius:10, marginBottom: 20, display:'grid', placeItems:'center', color:'var(--text-3)', fontSize:11, fontFamily:'var(--font-mono)'}}>{item.sku} · IMG</div>

            <div className="row" style={{justifyContent:'space-between'}}>
              <div>
                <div className="mono" style={{fontSize:11, color:'var(--text-3)', letterSpacing:'0.08em'}}>PRECIO DE CONTADO</div>
                <div className="serif" style={{fontSize:42, lineHeight:1, letterSpacing:'-0.02em'}}><span className="mono" style={{fontSize:14, color:'var(--text-3)'}}>$</span> {MOCK.fmt(item.price)}</div>
              </div>
              <div>
                <div className="mono" style={{fontSize:11, color:'var(--text-3)', letterSpacing:'0.08em'}}>STOCK</div>
                <div className="serif" style={{fontSize:42, lineHeight:1, color:'var(--accent)'}}>{item.stock}</div>
              </div>
            </div>

            <div className="hr"/>

            <Field label="Cliente" placeholder="Buscar por nombre o cédula…" wide/>
            <div style={{height: 14}}/>
            <div className="card" style={{padding:12, background:'var(--bg-elev)'}}>
              <div className="row" style={{gap:10}}>
                <div className="avatar" style={{width:32, height:32, fontSize:11, background:'var(--surface-2)', color:'var(--text-2)'}}>IC</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13.5}}>Iván Cárdenas</div>
                  <div style={{fontSize:11, color:'var(--text-3)'}}>CC 71.882.119 · score 758 · 1 préstamo activo</div>
                </div>
                <span className="pill success"><span className="dot"></span>Apto</span>
              </div>
            </div>
          </div>

          <div className="card" style={{padding:28}}>
            <div className="serif" style={{fontSize:22, marginBottom:18}}>Plan de pago</div>

            <div>
              <label style={{display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8}}>
                <span>CUOTA INICIAL</span>
                <span className="mono" style={{color:'var(--text)'}}>{inicial}%</span>
              </label>
              <input type="range" min={0} max={60} step={5} value={inicial} onChange={e=>setInicial(+e.target.value)} style={{width:'100%', accentColor:'var(--accent)'}}/>
            </div>

            <div style={{marginTop:18}}>
              <label style={{display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8}}>
                <span>PLAZO</span>
                <span className="mono" style={{color:'var(--text)'}}>{plazo} cuotas</span>
              </label>
              <input type="range" min={6} max={36} value={plazo} onChange={e=>setPlazo(+e.target.value)} style={{width:'100%', accentColor:'var(--accent)'}}/>
            </div>

            <div className="hr"/>

            <div style={{background:'var(--bg-elev)', borderRadius:10, padding:18, marginBottom:14}}>
              <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
                <span style={{color:'var(--text-3)', fontSize:12}}>Cuota inicial</span>
                <span className="mono">$ {MOCK.fmt(Math.round(initialAmt))}</span>
              </div>
              <div className="row" style={{justifyContent:'space-between', alignItems:'baseline', marginTop:6}}>
                <span style={{color:'var(--text-3)', fontSize:12}}>A financiar</span>
                <span className="mono">$ {MOCK.fmt(Math.round(financed))}</span>
              </div>
              <div className="row" style={{justifyContent:'space-between', alignItems:'baseline', marginTop:10, paddingTop:10, borderTop:'1px solid var(--border)'}}>
                <span style={{color:'var(--text-2)', fontSize:13}}>Cuota mensual</span>
                <span className="serif" style={{fontSize:28, color:'var(--accent)'}}>$ {MOCK.fmt(Math.round(cuota))}</span>
              </div>
            </div>

            <button className="btn btn-primary" style={{width:'100%', justifyContent:'center', padding:'14px'}}>
              Confirmar venta · $ {MOCK.fmt(Math.round(initialAmt))} hoy
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};

window.MerchandiseScreen = MerchandiseScreen;
