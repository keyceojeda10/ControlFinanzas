// Configuración detallada — 8+ secciones
const { useState: useStateSet } = React;

const SECTIONS = [
  { id:'cuenta', label:'Mi cuenta', group:'PERSONAL' },
  { id:'notif', label:'Notificaciones', group:'PERSONAL' },
  { id:'seguridad', label:'Seguridad', group:'PERSONAL' },

  { id:'org', label:'Organización', group:'EMPRESA' },
  { id:'sucursales', label:'Sucursales', group:'EMPRESA' },
  { id:'equipo', label:'Equipo y roles', group:'EMPRESA' },
  { id:'cobradores', label:'Cobradores', group:'EMPRESA' },

  { id:'productos', label:'Productos de crédito', group:'CONFIG. CARTERA' },
  { id:'tasas', label:'Tasas e intereses', group:'CONFIG. CARTERA' },
  { id:'mora', label:'Política de mora', group:'CONFIG. CARTERA' },
  { id:'pagos', label:'Métodos de pago', group:'CONFIG. CARTERA' },

  { id:'plantillas', label:'Plantillas WhatsApp', group:'COMUNICACIÓN' },
  { id:'recordatorios', label:'Recordatorios automáticos', group:'COMUNICACIÓN' },
  { id:'documentos', label:'Documentos legales', group:'COMUNICACIÓN' },

  { id:'integraciones', label:'Integraciones', group:'AVANZADO' },
  { id:'api', label:'API & Webhooks', group:'AVANZADO' },
  { id:'export', label:'Datos y exportación', group:'AVANZADO' },
  { id:'logs', label:'Bitácora del sistema', group:'AVANZADO' },
];

const SettingsScreen = () => {
  const [tab, setTab] = useStateSet('cuenta');

  const grouped = {};
  SECTIONS.forEach(s => { (grouped[s.group] = grouped[s.group] || []).push(s); });

  return (
    <main className="main">
      <Topbar crumb={['Cuenta', 'Configuración']}/>

      <div className="page page-wide">
        <div className="page-head">
          <div>
            <h1 className="page-title">Configuración</h1>
            <div className="page-sub">Préstamos Andina S.A.S · Plan Pro</div>
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'240px 1fr', gap:32, alignItems:'flex-start'}}>
          <nav className="settings-nav" style={{position:'sticky', top: 80}}>
            {Object.entries(grouped).map(([g, items]) => (
              <React.Fragment key={g}>
                <div className="nav-section-label" style={{padding:'14px 10px 4px'}}>{g}</div>
                {items.map(it => (
                  <div key={it.id} className={'settings-nav-item ' + (tab===it.id?'active':'')} onClick={() => setTab(it.id)}>{it.label}</div>
                ))}
              </React.Fragment>
            ))}
          </nav>

          <div style={{minWidth:0}}>
            {tab === 'cuenta' && <SecCuenta/>}
            {tab === 'notif' && <SecNotif/>}
            {tab === 'seguridad' && <SecSeguridad/>}
            {tab === 'org' && <SecOrg/>}
            {tab === 'sucursales' && <SecSucursales/>}
            {tab === 'equipo' && <SecEquipo/>}
            {tab === 'cobradores' && <SecCobradores/>}
            {tab === 'productos' && <SecProductos/>}
            {tab === 'tasas' && <SecTasas/>}
            {tab === 'mora' && <SecMora/>}
            {tab === 'pagos' && <SecPagos/>}
            {tab === 'plantillas' && <SecPlantillas/>}
            {tab === 'recordatorios' && <SecRecordatorios/>}
            {tab === 'documentos' && <SecDocumentos/>}
            {tab === 'integraciones' && <SecIntegraciones/>}
            {tab === 'api' && <SecApi/>}
            {tab === 'export' && <SecExport/>}
            {tab === 'logs' && <SecLogs/>}
          </div>
        </div>
      </div>
    </main>
  );
};

// ====== Helpers ======
const SecHead = ({ title, desc, action }) => (
  <div className="row" style={{justifyContent:'space-between', alignItems:'flex-start', marginBottom: 22}}>
    <div>
      <div className="serif" style={{fontSize:28, letterSpacing:'-0.015em'}}>{title}</div>
      {desc && <div style={{color:'var(--text-3)', marginTop:4, fontSize:13.5}}>{desc}</div>}
    </div>
    {action}
  </div>
);

const Toggle = ({ value, onChange }) => (
  <div className={'toggle ' + (value?'on':'')} onClick={() => onChange && onChange(!value)}></div>
);

const Row = ({ lbl, desc, children }) => (
  <div className="setting-row">
    <div style={{flex:1, marginRight:20}}>
      <div className="lbl">{lbl}</div>
      {desc && <div className="desc">{desc}</div>}
    </div>
    {children}
  </div>
);

// ====== Sections ======
const SecCuenta = () => {
  const [t, setT] = useStateSet({ notif: true, sms: false, mora_alert: true, ai_insights: true });
  return <>
    <SecHead title="Mi cuenta" desc="Información personal"/>
    <div className="card">
      <div className="row" style={{gap:16, marginBottom:14}}>
        <div className="avatar" style={{width:56, height:56, fontSize:18}}>DM</div>
        <div style={{flex:1}}>
          <div style={{fontSize:16}}>Diana Mejía</div>
          <div style={{fontSize:12.5, color:'var(--text-3)'}}>diana@prestamos-andina.co · Administradora</div>
        </div>
        <button className="btn">Cambiar foto</button>
      </div>
      <Row lbl="Nombre completo">
        <input style={{width:240, padding:'8px 10px', background:'var(--surface-2)', border:'1px solid var(--border-strong)', borderRadius:6, color:'var(--text)'}} defaultValue="Diana Mejía"/>
      </Row>
      <Row lbl="Correo" desc="Usado para iniciar sesión">
        <input style={{width:240, padding:'8px 10px', background:'var(--surface-2)', border:'1px solid var(--border-strong)', borderRadius:6, color:'var(--text)'}} defaultValue="diana@prestamos-andina.co"/>
      </Row>
      <Row lbl="Zona horaria" desc="America/Bogotá · UTC−5">
        <button className="btn">Cambiar</button>
      </Row>
      <Row lbl="Idioma">
        <button className="btn">Español (CO)</button>
      </Row>
    </div>
  </>;
};

const SecNotif = () => {
  const [t, setT] = useStateSet({ pago: true, mora: true, ruta: false, ai: true, weekly: true, alerts: true });
  return <>
    <SecHead title="Notificaciones" desc="Cuándo y cómo quieres ser notificada"/>
    <div className="card">
      <Row lbl="Pago confirmado" desc="Cuando un cliente paga su cuota"><Toggle value={t.pago} onChange={v=>setT({...t,pago:v})}/></Row>
      <Row lbl="Cliente entra en mora" desc="Alerta inmediata al cruzar el umbral"><Toggle value={t.mora} onChange={v=>setT({...t,mora:v})}/></Row>
      <Row lbl="Cobrador inicia ruta" desc="Cuando un cobrador comienza su recorrido"><Toggle value={t.ruta} onChange={v=>setT({...t,ruta:v})}/></Row>
      <Row lbl="Insights de IA" desc="Patrones y alertas inteligentes semanales"><Toggle value={t.ai} onChange={v=>setT({...t,ai:v})}/></Row>
      <Row lbl="Reporte semanal" desc="Resumen ejecutivo los lunes 7am"><Toggle value={t.weekly} onChange={v=>setT({...t,weekly:v})}/></Row>
      <Row lbl="Alertas críticas" desc="Mora alta, eventos importantes"><Toggle value={t.alerts} onChange={v=>setT({...t,alerts:v})}/></Row>
    </div>

    <div style={{height:24}}/>
    <div className="serif" style={{fontSize:20, marginBottom:12}}>Canales</div>
    <div className="card">
      <Row lbl="App móvil (push)"><Toggle value={true}/></Row>
      <Row lbl="Email"><Toggle value={true}/></Row>
      <Row lbl="WhatsApp Business"><Toggle value={false}/></Row>
      <Row lbl="SMS" desc="Cargo por uso · $80 / SMS"><Toggle value={false}/></Row>
    </div>
  </>;
};

const SecSeguridad = () => <>
  <SecHead title="Seguridad" desc="Protege el acceso a tu cuenta"/>
  <div className="card">
    <Row lbl="Autenticación de dos factores" desc="Configurado vía app autenticadora">
      <span className="pill success"><Icons.Check size={10}/>Activo</span>
    </Row>
    <Row lbl="Cambiar contraseña" desc="Último cambio hace 47 días">
      <button className="btn">Cambiar</button>
    </Row>
    <Row lbl="Sesiones activas" desc="3 dispositivos conectados">
      <button className="btn">Gestionar</button>
    </Row>
    <Row lbl="Verificación biométrica en móvil" desc="Huella digital en la app del cobrador"><Toggle value={true}/></Row>
    <Row lbl="Bloqueo automático" desc="Cerrar sesión tras 30 min de inactividad"><Toggle value={true}/></Row>
  </div>

  <div style={{height:24}}/>
  <div className="serif" style={{fontSize:20, marginBottom:12}}>Sesiones activas</div>
  <div className="card" style={{padding:0, overflow:'hidden'}}>
    {[
      { dev:'MacBook Pro · Chrome', loc:'Medellín, CO', when:'Activa ahora', current:true },
      { dev:'iPhone 15 Pro · Cartera App', loc:'Medellín, CO', when:'Hace 12 min' },
      { dev:'iPad · Safari', loc:'Bogotá, CO', when:'Hace 3 días' },
    ].map((s,i) => (
      <div key={i} className="row" style={{padding:14, gap:14, borderBottom: i<2?'1px solid var(--border)':'none'}}>
        <div style={{width:36, height:36, borderRadius:8, background:'var(--surface-2)', display:'grid', placeItems:'center', color:'var(--text-2)'}}>
          <Icons.Phone size={16}/>
        </div>
        <div style={{flex:1}}>
          <div className="row" style={{gap:8}}>
            <span style={{fontSize:13.5}}>{s.dev}</span>
            {s.current && <span className="pill accent">Esta sesión</span>}
          </div>
          <div style={{fontSize:11.5, color:'var(--text-3)', marginTop:2}}>{s.loc} · {s.when}</div>
        </div>
        {!s.current && <button className="btn btn-ghost" style={{color:'var(--danger)'}}>Cerrar</button>}
      </div>
    ))}
  </div>
</>;

const SecOrg = () => <>
  <SecHead title="Organización" desc="Información legal y de facturación"/>
  <div className="card">
    <Row lbl="Razón social"><input style={{width:280, padding:'8px 10px', background:'var(--surface-2)', border:'1px solid var(--border-strong)', borderRadius:6, color:'var(--text)'}} defaultValue="Préstamos Andina S.A.S"/></Row>
    <Row lbl="NIT"><input style={{width:200, padding:'8px 10px', background:'var(--surface-2)', border:'1px solid var(--border-strong)', borderRadius:6, color:'var(--text)'}} defaultValue="901.234.567-8"/></Row>
    <Row lbl="Tipo de operación" desc="Microcrédito, gota a gota, libranza, mercancía"><button className="btn">Microcrédito + Mercancía</button></Row>
    <Row lbl="Régimen tributario"><button className="btn">Común</button></Row>
    <Row lbl="Dirección principal"><input style={{width:280, padding:'8px 10px', background:'var(--surface-2)', border:'1px solid var(--border-strong)', borderRadius:6, color:'var(--text)'}} defaultValue="Cra 43 #18-22, Medellín"/></Row>
    <Row lbl="Logo organizacional"><button className="btn">Subir logo</button></Row>
  </div>
</>;

const SecSucursales = () => <>
  <SecHead title="Sucursales" desc="3 sucursales activas" action={<button className="btn btn-primary"><Icons.Plus/>Nueva sucursal</button>}/>
  <div className="card" style={{padding:0, overflow:'hidden'}}>
    <table className="tbl">
      <thead><tr><th style={{paddingLeft:18}}>Sucursal</th><th>Dirección</th><th>Encargado</th><th>Clientes</th><th>Cartera</th><th></th></tr></thead>
      <tbody>
        {[
          ['Principal Medellín','Cra 43 #18-22, Belén','Diana Mejía',842,'$ 1.214M'],
          ['Bello','Cl 38 #54-110, centro','Andrés Tobón',287,'$ 412M'],
          ['Itagüí','Cra 50 #45-12, sur','Patricia Vélez',118,'$ 216M'],
        ].map(([n,d,e,c,p],i) => (
          <tr key={n} style={{cursor:'pointer'}}>
            <td style={{paddingLeft:18}}><div style={{fontSize:13.5}}>{n}</div></td>
            <td className="dim">{d}</td>
            <td>{e}</td>
            <td className="mono">{c}</td>
            <td className="mono">{p}</td>
            <td><Icons.Chevron size={14} stroke="var(--text-3)"/></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</>;

const SecEquipo = () => <>
  <SecHead title="Equipo y roles" desc="7 miembros · 3 roles definidos" action={<button className="btn btn-primary"><Icons.Plus/>Invitar</button>}/>
  <div className="card" style={{padding:0, overflow:'hidden'}}>
    <table className="tbl">
      <thead><tr><th style={{paddingLeft:18}}>Miembro</th><th>Rol</th><th>Sucursal</th><th>Estado</th><th>Último acceso</th><th></th></tr></thead>
      <tbody>
        {[
          { n:'Diana Mejía', e:'diana@prestamos-andina.co', r:'Administradora', s:'Principal', st:'active', last:'Activa ahora', color:'var(--accent)' },
          { n:'Andrés Tobón', e:'andres@prestamos-andina.co', r:'Gerente sucursal', s:'Bello', st:'active', last:'Hace 18 min', color:'#60a5fa' },
          { n:'Patricia Vélez', e:'patricia@prestamos-andina.co', r:'Gerente sucursal', s:'Itagüí', st:'active', last:'Hace 1 h', color:'#60a5fa' },
          { n:'Catalina Ríos', e:'catalina@prestamos-andina.co', r:'Analista', s:'Principal', st:'active', last:'Hace 3 h', color:'#fbbf24' },
          { n:'Felipe Mesa', e:'felipe@prestamos-andina.co', r:'Analista', s:'Principal', st:'invite', last:'Invitación pendiente', color:'#fbbf24' },
        ].map(m => (
          <tr key={m.e}>
            <td style={{paddingLeft:18}}>
              <div className="row" style={{gap:10}}>
                <div className="avatar" style={{width:28, height:28, fontSize:10, background:'var(--surface-2)', color:'var(--text-2)'}}>
                  {m.n.split(' ').map(s=>s[0]).slice(0,2).join('')}
                </div>
                <div>
                  <div style={{fontSize:13}}>{m.n}</div>
                  <div style={{fontSize:11, color:'var(--text-3)'}}>{m.e}</div>
                </div>
              </div>
            </td>
            <td>
              <span style={{fontSize:11.5, color: m.color, fontFamily:'var(--font-mono)'}}>● {m.r}</span>
            </td>
            <td className="dim">{m.s}</td>
            <td>{m.st==='active' ? <span className="pill success"><span className="dot"></span>Activo</span> : <span className="pill warning"><span className="dot"></span>Pendiente</span>}</td>
            <td className="dim">{m.last}</td>
            <td><Icons.More size={14} stroke="var(--text-3)"/></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>

  <div style={{height:24}}/>
  <div className="serif" style={{fontSize:20, marginBottom:12}}>Roles y permisos</div>
  <div className="grid-3">
    {[
      { n:'Administrador', desc:'Acceso total al sistema', perms:['Crear/eliminar préstamos','Gestionar equipo','Configurar tasas y políticas','Ver reportes financieros','Acceso a facturación SaaS']},
      { n:'Gerente sucursal', desc:'Operación de una sucursal', perms:['Crear préstamos','Gestionar cobradores','Aprobar refinanciaciones','Reportes de sucursal','Sin acceso a facturación SaaS']},
      { n:'Analista', desc:'Operaciones diarias', perms:['Registrar clientes','Registrar pagos','Generar reportes operativos','Solo lectura en cartera','Sin acceso a configuración']},
    ].map(r => (
      <div key={r.n} className="card" style={{padding:20}}>
        <div style={{fontSize:14}}>{r.n}</div>
        <div style={{fontSize:12, color:'var(--text-3)', marginTop:2, marginBottom:12}}>{r.desc}</div>
        <div style={{display:'flex', flexDirection:'column', gap:6}}>
          {r.perms.map(p => (
            <div key={p} className="row" style={{gap:6, fontSize:12}}>
              <Icons.Check size={11} stroke="var(--text-3)"/>
              <span style={{color:'var(--text-2)'}}>{p}</span>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
</>;

const SecCobradores = () => <>
  <SecHead title="Cobradores" desc="4 cobradores · zonas y comisiones" action={<button className="btn btn-primary"><Icons.Plus/>Nuevo cobrador</button>}/>
  <div className="card" style={{padding:0, overflow:'hidden'}}>
    <table className="tbl">
      <thead><tr><th style={{paddingLeft:18}}>Cobrador</th><th>Zona</th><th>Clientes</th><th>Comisión</th><th>Efectividad</th><th></th></tr></thead>
      <tbody>
        {MOCK.COBRADORES.map(c => (
          <tr key={c.n}>
            <td style={{paddingLeft:18}}>
              <div className="row" style={{gap:10}}>
                <div className="avatar" style={{width:28, height:28, fontSize:10, background:c.color, color:'#000'}}>
                  {c.n.split(' ').map(s=>s[0]).slice(0,2).join('')}
                </div>
                <div>
                  <div style={{fontSize:13}}>{c.n}</div>
                  <div style={{fontSize:11, color:'var(--text-3)'}}>CC 71.882.119</div>
                </div>
              </div>
            </td>
            <td>{c.zone}</td>
            <td className="mono">{Math.floor(c.recaudo / 1500000)}</td>
            <td className="mono">3.5% s/recaudo</td>
            <td>
              <div className="row" style={{gap:8}}>
                <div style={{width:60, height:3, background:'var(--surface-2)', borderRadius:2, overflow:'hidden'}}>
                  <div style={{height:'100%', width: c.ef+'%', background: c.color}}></div>
                </div>
                <span className="mono" style={{fontSize:12}}>{c.ef}%</span>
              </div>
            </td>
            <td><Icons.More size={14} stroke="var(--text-3)"/></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</>;

const SecProductos = () => <>
  <SecHead title="Productos de crédito" desc="Configura los tipos de préstamo que ofreces" action={<button className="btn btn-primary"><Icons.Plus/>Nuevo producto</button>}/>
  <div className="grid-2">
    {[
      { n:'Microcrédito clásico', desc:'Capital de trabajo · 6-24 meses', rango:'$500k - $20M', tasa:'1.5-2.0% mensual', estado:true },
      { n:'Crédito mercantil', desc:'Mercancía a crédito con prenda', rango:'$1M - $10M', tasa:'1.8-2.2% mensual', estado:true },
      { n:'Crédito gota a gota', desc:'Cuotas diarias por 25-30 días', rango:'$100k - $2M', tasa:'20% sobre principal', estado:true },
      { n:'Refinanciación', desc:'Para clientes con mora gestionada', rango:'Variable', tasa:'2.0-2.5% mensual', estado:false },
    ].map(p => (
      <div key={p.n} className="card">
        <div className="row" style={{justifyContent:'space-between', alignItems:'flex-start'}}>
          <div>
            <div className="serif" style={{fontSize:20}}>{p.n}</div>
            <div style={{fontSize:12, color:'var(--text-3)', marginTop:2}}>{p.desc}</div>
          </div>
          <Toggle value={p.estado}/>
        </div>
        <div className="hr" style={{margin:'14px 0'}}/>
        <div className="row" style={{justifyContent:'space-between', padding:'4px 0', fontSize:12.5}}>
          <span style={{color:'var(--text-3)'}}>Rango</span>
          <span className="mono">{p.rango}</span>
        </div>
        <div className="row" style={{justifyContent:'space-between', padding:'4px 0', fontSize:12.5}}>
          <span style={{color:'var(--text-3)'}}>Tasa típica</span>
          <span className="mono">{p.tasa}</span>
        </div>
      </div>
    ))}
  </div>
</>;

const SecTasas = () => <>
  <SecHead title="Tasas e intereses" desc="Configuración de tasas, mora y cargos"/>
  <div className="card">
    <Row lbl="Tasa nominal mensual" desc="Interés mensual base sobre saldo">
      <div className="row" style={{gap:6}}>
        <input style={{width:80, padding:'8px 10px', background:'var(--surface-2)', border:'1px solid var(--border-strong)', borderRadius:6, color:'var(--text)', textAlign:'right'}} defaultValue="1.85"/>
        <span className="mono dim">%</span>
      </div>
    </Row>
    <Row lbl="Interés de mora" desc="Tasa adicional sobre saldo vencido">
      <div className="row" style={{gap:6}}>
        <input style={{width:80, padding:'8px 10px', background:'var(--surface-2)', border:'1px solid var(--border-strong)', borderRadius:6, color:'var(--text)', textAlign:'right'}} defaultValue="2.50"/>
        <span className="mono dim">%</span>
      </div>
    </Row>
    <Row lbl="Tasa de usura límite" desc="Límite legal vigente · Superfinanciera">
      <span className="mono">25.71% EA</span>
    </Row>
    <Row lbl="Costos administrativos" desc="Cobro único al desembolso">
      <div className="row" style={{gap:6}}>
        <input style={{width:80, padding:'8px 10px', background:'var(--surface-2)', border:'1px solid var(--border-strong)', borderRadius:6, color:'var(--text)', textAlign:'right'}} defaultValue="50000"/>
        <span className="mono dim">COP</span>
      </div>
    </Row>
    <Row lbl="Seguro de cartera" desc="Porcentaje sobre cuota">
      <div className="row" style={{gap:6}}>
        <input style={{width:80, padding:'8px 10px', background:'var(--surface-2)', border:'1px solid var(--border-strong)', borderRadius:6, color:'var(--text)', textAlign:'right'}} defaultValue="0.0"/>
        <span className="mono dim">%</span>
      </div>
    </Row>
  </div>
</>;

const SecMora = () => <>
  <SecHead title="Política de mora" desc="Cómo se gestiona la mora automáticamente"/>
  <div className="card">
    <Row lbl="Día de gracia" desc="Días sin penalización después del vencimiento">
      <input style={{width:80, padding:'8px 10px', background:'var(--surface-2)', border:'1px solid var(--border-strong)', borderRadius:6, color:'var(--text)', textAlign:'right'}} defaultValue="2"/>
    </Row>
    <Row lbl="Reportar a centrales" desc="Datacrédito y TransUnion automáticamente">
      <button className="btn">Después de 30 días</button>
    </Row>
    <Row lbl="Bloquear nuevos desembolsos" desc="Si el cliente está en mora">
      <Toggle value={true}/>
    </Row>
    <Row lbl="Pago parcial" desc="Aceptar pagos menores a la cuota">
      <Toggle value={true}/>
    </Row>
  </div>

  <div style={{height:20}}/>
  <div className="serif" style={{fontSize:20, marginBottom:12}}>Etapas de cobranza</div>
  <div className="card" style={{padding:0, overflow:'hidden'}}>
    <table className="tbl">
      <thead><tr><th style={{paddingLeft:18}}>Etapa</th><th>Rango de días</th><th>Acción automática</th><th>Responsable</th></tr></thead>
      <tbody>
        {[
          ['Recordatorio',   '1-15 días',   'WhatsApp + SMS día 3, 7, 12', 'Sistema'],
          ['Gestión activa', '16-60 días',  'Llamada del cobrador + visita', 'Cobrador asignado'],
          ['Jurídico',       '+60 días',    'Reporte a centrales + cobro jurídico', 'Equipo legal externo'],
          ['Castigo',        '+360 días',   'Provisión 100% + venta cartera', 'Administrador'],
        ].map(([s,r,a,re]) => (
          <tr key={s}>
            <td style={{paddingLeft:18}}>{s}</td>
            <td className="mono dim">{r}</td>
            <td>{a}</td>
            <td className="dim">{re}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</>;

const SecPagos = () => <>
  <SecHead title="Métodos de pago" desc="Canales de recaudo conectados"/>
  <div className="grid-2">
    {[
      { n:'Nequi', desc:'Pagos en línea + conciliación', st:'connected', stat:'68% del recaudo' },
      { n:'Daviplata', desc:'Pagos en línea + conciliación', st:'connected', stat:'13% del recaudo' },
      { n:'Bancolombia', desc:'PSE + transferencias', st:'connected', stat:'20% del recaudo' },
      { n:'Davivienda', desc:'PSE + transferencias', st:'connected', stat:'4% del recaudo' },
      { n:'Efectivo', desc:'Captura manual en visita', st:'always-on', stat:'24% del recaudo' },
      { n:'PSE multibanco', desc:'Vía pasarela general', st:'disabled', stat:'—' },
    ].map(p => (
      <div key={p.n} className="card">
        <div className="row" style={{justifyContent:'space-between', alignItems:'flex-start'}}>
          <div className="row" style={{gap:12}}>
            <div style={{width:36, height:36, borderRadius:8, background:'var(--surface-2)', display:'grid', placeItems:'center'}}>
              <Icons.Bank size={16}/>
            </div>
            <div>
              <div style={{fontSize:14}}>{p.n}</div>
              <div style={{fontSize:11.5, color:'var(--text-3)', marginTop:2}}>{p.desc}</div>
            </div>
          </div>
          {p.st === 'connected' ? <span className="pill success"><Icons.Check size={10}/>Conectado</span>
            : p.st === 'always-on' ? <span className="pill"><span className="dot"></span>Siempre activo</span>
            : <button className="btn">Conectar</button>}
        </div>
        <div className="hr" style={{margin:'14px 0 10px'}}/>
        <div className="row" style={{justifyContent:'space-between', fontSize:12}}>
          <span style={{color:'var(--text-3)'}}>Participación mes</span>
          <span className="mono">{p.stat}</span>
        </div>
      </div>
    ))}
  </div>
</>;

const SecPlantillas = () => <>
  <SecHead title="Plantillas WhatsApp" desc="6 plantillas aprobadas por Meta Business" action={<button className="btn btn-primary"><Icons.Plus/>Nueva plantilla</button>}/>
  <div className="card" style={{padding:0, overflow:'hidden'}}>
    {[
      { n:'Recordatorio cuota 3 días antes', tipo:'Utility', uses:842, lastUse:'Hoy', preview:'Hola {{nombre}}, te recordamos que tu cuota de {{monto}} vence el {{fecha}}.'},
      { n:'Recordatorio día de pago', tipo:'Utility', uses:1247, lastUse:'Hoy', preview:'Hola {{nombre}}, hoy vence tu cuota. Puedes pagar en {{enlace}}.'},
      { n:'Confirmación de pago', tipo:'Utility', uses:1842, lastUse:'Hace 18 min', preview:'¡Gracias {{nombre}}! Recibimos tu pago de {{monto}}.'},
      { n:'Mora 7 días', tipo:'Utility', uses:142, lastUse:'Hoy', preview:'Hola {{nombre}}, notamos que tu cuota está vencida...'},
      { n:'Felicitación préstamo final', tipo:'Marketing', uses:38, lastUse:'Ayer', preview:'¡Felicitaciones {{nombre}}! Terminaste de pagar tu préstamo.'},
      { n:'Pre-aprobación', tipo:'Marketing', uses:218, lastUse:'Hace 2 días', preview:'¡Buenas noticias {{nombre}}! Te pre-aprobamos un nuevo préstamo...'},
    ].map((p,i,arr) => (
      <div key={p.n} style={{padding:'16px 20px', borderBottom: i<arr.length-1?'1px solid var(--border)':'none'}}>
        <div className="row" style={{justifyContent:'space-between'}}>
          <div style={{flex:1}}>
            <div className="row" style={{gap:8}}>
              <span style={{fontSize:14}}>{p.n}</span>
              <span className="pill">{p.tipo}</span>
            </div>
            <div style={{fontSize:12.5, color:'var(--text-3)', marginTop:6, padding:'8px 10px', background:'var(--bg-elev)', borderRadius:6, fontFamily:'var(--font-mono)'}}>{p.preview}</div>
          </div>
          <div style={{textAlign:'right', minWidth:120, marginLeft:20}}>
            <div className="mono" style={{fontSize:13}}>{p.uses}</div>
            <div style={{fontSize:11, color:'var(--text-3)'}}>envíos · {p.lastUse}</div>
          </div>
        </div>
      </div>
    ))}
  </div>
</>;

const SecRecordatorios = () => <>
  <SecHead title="Recordatorios automáticos" desc="Comunicación automática con clientes"/>
  <div className="card">
    {[
      { l:'3 días antes del vencimiento', c:'WhatsApp', a:true },
      { l:'Día del vencimiento (mañana)', c:'WhatsApp + SMS', a:true },
      { l:'3 días después si no paga', c:'WhatsApp', a:true },
      { l:'7 días de mora', c:'WhatsApp + llamada IVR', a:true },
      { l:'15 días de mora', c:'Notificación al cobrador', a:true },
      { l:'Confirmación de pago', c:'WhatsApp inmediato', a:true },
      { l:'Cumpleaños del cliente', c:'WhatsApp marketing', a:false },
      { l:'Pre-aprobación nuevo préstamo', c:'WhatsApp + email', a:false },
    ].map(r => (
      <Row key={r.l} lbl={r.l} desc={r.c}><Toggle value={r.a}/></Row>
    ))}
  </div>
</>;

const SecDocumentos = () => <>
  <SecHead title="Documentos legales" desc="Plantillas de pagarés, contratos y autorizaciones"/>
  <div className="grid-2">
    {[
      { n:'Pagaré electrónico', d:'Plantilla actual · firmada digitalmente', v:'v 3.2'},
      { n:'Contrato de mutuo', d:'Términos generales del préstamo', v:'v 2.1'},
      { n:'Autorización Datacrédito', d:'Habeas data y reporte a centrales', v:'v 1.4'},
      { n:'Contrato de prenda', d:'Para créditos con garantía mercancía', v:'v 1.0'},
      { n:'Carta de aceptación', d:'Aceptación de oferta de crédito', v:'v 2.3'},
      { n:'Notificación de mora', d:'Comunicación formal a deudor', v:'v 1.2'},
    ].map(d => (
      <div key={d.n} className="card">
        <div className="row" style={{justifyContent:'space-between', alignItems:'flex-start'}}>
          <div>
            <div style={{fontSize:14}}>{d.n}</div>
            <div style={{fontSize:12, color:'var(--text-3)', marginTop:2}}>{d.d}</div>
            <span className="pill" style={{marginTop:8}}>{d.v}</span>
          </div>
          <button className="icon-btn" style={{width:28, height:28}}><Icons.Download size={12}/></button>
        </div>
      </div>
    ))}
  </div>
</>;

const SecIntegraciones = () => <>
  <SecHead title="Integraciones" desc="Conecta Cartera con tus herramientas"/>
  <div className="grid-3">
    {[
      { n:'WhatsApp Business', c:'Comunicación', s:'connected' },
      { n:'Nequi API', c:'Pagos', s:'connected' },
      { n:'Daviplata', c:'Pagos', s:'connected' },
      { n:'Bancolombia', c:'Pagos & PSE', s:'connected' },
      { n:'Datacrédito', c:'Centrales de riesgo', s:'connected' },
      { n:'TransUnion', c:'Centrales de riesgo', s:'connected' },
      { n:'Siigo Contable', c:'Contabilidad', s:'available' },
      { n:'World Office', c:'Contabilidad', s:'available' },
      { n:'Google Maps', c:'Rutas', s:'connected' },
      { n:'Zapier', c:'Automatización', s:'available' },
      { n:'Slack', c:'Notificaciones', s:'available' },
      { n:'Sendgrid', c:'Email transaccional', s:'connected' },
    ].map(i => (
      <div key={i.n} className="card" style={{padding:18}}>
        <div className="row" style={{justifyContent:'space-between', alignItems:'flex-start', marginBottom:6}}>
          <div style={{width:32, height:32, borderRadius:7, background:'var(--surface-2)', display:'grid', placeItems:'center'}}>
            <span style={{fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-2)'}}>{i.n.charAt(0)}</span>
          </div>
          {i.s === 'connected' ? <span className="pill success"><span className="dot"></span>Activo</span> : <span className="pill"><span className="dot"></span>Disponible</span>}
        </div>
        <div style={{fontSize:13, marginTop:4}}>{i.n}</div>
        <div style={{fontSize:11.5, color:'var(--text-3)', marginTop:2}}>{i.c}</div>
      </div>
    ))}
  </div>
</>;

const SecApi = () => <>
  <SecHead title="API & Webhooks" desc="Integra Cartera con tus sistemas internos"/>
  <div className="card" style={{marginBottom:16}}>
    <div className="card-title" style={{marginBottom:12}}>API Keys</div>
    <div style={{padding:14, background:'var(--bg-elev)', borderRadius:8, marginBottom:10, display:'flex', alignItems:'center', gap:12}}>
      <div style={{flex:1}}>
        <div className="row" style={{gap:8}}>
          <span className="pill success"><span className="dot"></span>Producción</span>
          <span style={{fontSize:13}}>Default key</span>
        </div>
        <div className="mono" style={{fontSize:12, color:'var(--text-3)', marginTop:6, letterSpacing:'0.02em'}}>cart_live_2K4n••••••••••••••••••••aB91</div>
      </div>
      <button className="btn">Mostrar</button>
      <button className="btn">Regenerar</button>
    </div>
    <div style={{padding:14, background:'var(--bg-elev)', borderRadius:8, display:'flex', alignItems:'center', gap:12}}>
      <div style={{flex:1}}>
        <div className="row" style={{gap:8}}>
          <span className="pill warning"><span className="dot"></span>Pruebas</span>
          <span style={{fontSize:13}}>Sandbox key</span>
        </div>
        <div className="mono" style={{fontSize:12, color:'var(--text-3)', marginTop:6}}>cart_test_8M4k••••••••••••••••••••cD12</div>
      </div>
      <button className="btn">Mostrar</button>
    </div>
  </div>

  <div className="card">
    <div className="row" style={{justifyContent:'space-between', marginBottom:12}}>
      <div className="card-title">Webhooks</div>
      <button className="btn btn-primary"><Icons.Plus/>Nuevo webhook</button>
    </div>
    {[
      { url:'https://api.prestamos-andina.co/hooks/cartera', ev:'payment.confirmed, loan.created', s:'active'},
      { url:'https://contable.prestamos-andina.co/sync', ev:'transaction.created', s:'active'},
      { url:'https://crm.prestamos-andina.co/incoming', ev:'client.created', s:'paused'},
    ].map((w,i,arr) => (
      <div key={w.url} style={{padding:'14px 0', borderBottom: i<arr.length-1?'1px solid var(--border)':'none'}}>
        <div className="row" style={{justifyContent:'space-between'}}>
          <div>
            <div className="mono" style={{fontSize:12.5}}>{w.url}</div>
            <div style={{fontSize:11.5, color:'var(--text-3)', marginTop:4}}>{w.ev}</div>
          </div>
          {w.s === 'active' ? <span className="pill success"><span className="dot"></span>Activo</span> : <span className="pill warning"><span className="dot"></span>Pausado</span>}
        </div>
      </div>
    ))}
  </div>
</>;

const SecExport = () => <>
  <SecHead title="Datos y exportación" desc="Descarga, respaldos y políticas de datos"/>
  <div className="grid-2">
    {[
      { n:'Clientes', desc:'1.247 registros · ~480 KB', date:'Último export: hoy 09:14'},
      { n:'Préstamos', desc:'7 préstamos activos · ~120 KB', date:'Hace 2 días'},
      { n:'Transacciones', desc:'18.420 movimientos · ~2.4 MB', date:'Ayer'},
      { n:'Mercancía e inventario', desc:'60 SKUs · ~180 KB', date:'Hace 1 semana'},
    ].map(e => (
      <div key={e.n} className="card">
        <div style={{fontSize:14}}>{e.n}</div>
        <div style={{fontSize:12, color:'var(--text-3)', marginTop:2}}>{e.desc}</div>
        <div className="mono" style={{fontSize:11, color:'var(--text-3)', marginTop:8}}>{e.date}</div>
        <div className="row" style={{gap:8, marginTop:14}}>
          <button className="btn"><Icons.Download/>CSV</button>
          <button className="btn"><Icons.Download/>Excel</button>
        </div>
      </div>
    ))}
  </div>

  <div style={{height:20}}/>
  <div className="card">
    <Row lbl="Respaldo automático" desc="Diariamente a las 2:00 AM en servidores de AWS São Paulo"><Toggle value={true}/></Row>
    <Row lbl="Política de retención" desc="Cuánto tiempo conservar registros eliminados"><button className="btn">90 días</button></Row>
    <Row lbl="Cumplimiento Habeas Data" desc="Última auditoría 12 abr 2026"><span className="pill success"><Icons.Check size={10}/>Conforme</span></Row>
  </div>
</>;

const SecLogs = () => <>
  <SecHead title="Bitácora del sistema" desc="Registro de acciones críticas de los últimos 90 días"/>
  <div className="card" style={{padding:0, overflow:'hidden'}}>
    <table className="tbl">
      <thead><tr><th style={{paddingLeft:18}}>Cuándo</th><th>Usuario</th><th>Acción</th><th>IP</th><th>Resultado</th></tr></thead>
      <tbody>
        {[
          ['23 may · 14:32', 'Sistema', 'Pago confirmado · TX-04821', '—', 'OK'],
          ['23 may · 11:55', 'Diana Mejía', 'Desembolso PR-1247 · $ 5.000.000', '186.86.x.x', 'OK'],
          ['23 may · 09:14', 'Diana Mejía', 'Exportación de clientes (CSV)', '186.86.x.x', 'OK'],
          ['22 may · 18:14', 'Catalina Ríos', 'Edición tasa producto Microcrédito', '190.27.x.x', 'OK'],
          ['22 may · 14:02', 'Diego Ortiz', 'Login desde app móvil', '190.27.x.x', 'OK'],
          ['22 may · 10:18', 'Sistema', 'Webhook payment.confirmed (3 intentos)', '—', 'Reintentos'],
          ['21 may · 20:45', 'Diana Mejía', 'Cambio de plan Pro → Pro', '186.86.x.x', 'OK'],
          ['21 may · 09:12', 'Felipe Mesa', 'Intento login fallido', '—', 'Bloqueado'],
        ].map((row,i) => (
          <tr key={i}>
            <td style={{paddingLeft:18}} className="mono dim">{row[0]}</td>
            <td>{row[1]}</td>
            <td className="dim">{row[2]}</td>
            <td className="mono dim">{row[3]}</td>
            <td>
              {row[4]==='OK' ? <span className="pill success"><Icons.Check size={10}/>OK</span>
                : row[4]==='Reintentos' ? <span className="pill warning"><span className="dot"></span>Reintentos</span>
                : <span className="pill danger"><span className="dot"></span>{row[4]}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</>;

window.SettingsScreen = SettingsScreen;
