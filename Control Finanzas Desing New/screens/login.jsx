// Login + Onboarding
const { useState: useStateLogin } = React;

const LoginScreen = ({ onLogin, onOnboard }) => {
  const [email, setEmail] = useStateLogin('diana@prestamos-andina.co');
  const [pwd, setPwd] = useStateLogin('••••••••••••');

  return (
    <div className="login">
      <div className="login-panel">
        <div className="brand" style={{borderBottom:'none', padding: 0, marginBottom: 0}}>
          <div className="brand-mark">c</div>
          <div className="brand-name">Cartera<em>.</em></div>
        </div>

        <div className="login-form">
          <h1>Bienvenida<br/>de <em>vuelta</em>.</h1>
          <p className="lede">La plataforma de cartera más usada por prestamistas en Colombia.</p>

          <div className="field">
            <label>Correo</label>
            <input value={email} onChange={e => setEmail(e.target.value)}/>
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input type="password" value={pwd} onChange={e => setPwd(e.target.value)}/>
          </div>

          <button className="btn btn-primary" style={{width:'100%', justifyContent:'center', padding:'11px', marginTop:8}}
                  onClick={onLogin}>
            Iniciar sesión <Icons.Chevron size={14}/>
          </button>

          <div className="divider">o continúa con</div>

          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8}}>
            <button className="btn" style={{justifyContent:'center'}}>Google</button>
            <button className="btn" style={{justifyContent:'center'}}>Microsoft</button>
          </div>

          <p style={{marginTop:28, color:'var(--text-3)', fontSize:12.5}}>
            ¿Apenas empiezas? <a onClick={onOnboard} style={{color:'var(--accent)', cursor:'pointer'}}>Crea tu cuenta →</a>
          </p>
        </div>

        <div style={{marginTop:'auto', display:'flex', gap:24, color:'var(--text-4)', fontSize:11.5}}>
          <span>SOC 2 Type II</span>
          <span>·</span>
          <span>SuperFinanciera Colombia</span>
          <span>·</span>
          <span>v 4.2.1</span>
        </div>
      </div>

      <div className="login-art">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
          <div style={{color:'var(--text-3)', fontSize:12}}>
            <div className="mono" style={{color:'var(--text-2)'}}>EN VIVO · 23 MAY 2026</div>
            <div style={{marginTop:6}}>Plataforma operando con normalidad</div>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:6, color:'var(--success)', fontSize:12}}>
            <div style={{width:6, height:6, borderRadius:'50%', background:'var(--success)'}}></div>
            <span>Todos los sistemas activos</span>
          </div>
        </div>

        {/* Floating preview cards */}
        <div className="fpc" style={{top:120, left:80, width: 280, transform:'rotate(-2deg)'}}>
          <div style={{display:'flex', justifyContent:'space-between', color:'var(--text-3)', fontSize:11}}>
            <span>RECAUDO DE HOY</span>
            <span className="pill success"><span className="dot"></span>+12%</span>
          </div>
          <div className="serif" style={{fontSize:32, marginTop:6}}>
            <span className="mono" style={{fontSize:12, color:'var(--text-3)'}}>$</span>
            38<span style={{color:'var(--text-3)'}}>.420.000</span>
          </div>
          <div style={{marginTop:8, display:'flex', alignItems:'flex-end', gap:2, height:32}}>
            {[8,12,10,14,11,16,13,18,15,20,17,22,19,24,28,26].map((h,i) => (
              <div key={i} style={{flex:1, height: h*1.2, background: i===15?'var(--accent)':'var(--surface-2)', borderRadius:1}}></div>
            ))}
          </div>
        </div>

        <div className="fpc" style={{top:340, right: 80, width: 300, transform:'rotate(1.5deg)'}}>
          <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:10}}>
            <div className="avatar" style={{background:'linear-gradient(135deg,#60a5fa,#a78bfa)'}}>MR</div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:13}}>Marisol Ramírez</div>
              <div style={{fontSize:11.5, color:'var(--text-3)'}}>Cuota 7/24 · PR-1209</div>
            </div>
            <span className="pill accent"><Icons.Check size={10}/> Pagado</span>
          </div>
          <div style={{display:'flex', justifyContent:'space-between', paddingTop:10, borderTop:'1px solid var(--border)'}}>
            <div>
              <div className="mono" style={{fontSize:10, color:'var(--text-3)'}}>MONTO</div>
              <div className="mono" style={{fontSize:14, marginTop:2}}>$ 850.000</div>
            </div>
            <div>
              <div className="mono" style={{fontSize:10, color:'var(--text-3)'}}>VÍA</div>
              <div style={{fontSize:13, marginTop:2}}>Nequi</div>
            </div>
            <div>
              <div className="mono" style={{fontSize:10, color:'var(--text-3)'}}>HORA</div>
              <div className="mono" style={{fontSize:13, marginTop:2}}>14:32</div>
            </div>
          </div>
        </div>

        <div className="fpc" style={{top:540, left: 140, width: 260, transform:'rotate(-1deg)'}}>
          <div style={{fontSize:11, color:'var(--text-3)', marginBottom:8}}>RUTA HOY · DIEGO ORTIZ</div>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <div style={{width:32, height:32, borderRadius:8, background:'var(--accent-soft)', display:'grid', placeItems:'center', color:'var(--accent)', fontFamily:'var(--font-mono)', fontSize:13}}>8</div>
            <div>
              <div style={{fontSize:13}}>8 visitas programadas</div>
              <div style={{fontSize:11.5, color:'var(--text-3)'}}>Cra 43 → Belén → Estadio</div>
            </div>
          </div>
        </div>

        <div className="login-art-quote">
          <q>Pasamos de Excel a Cartera y nuestra mora bajó del 14% al 5.2% en cuatro meses.</q>
          <div className="who">— Ricardo Tovar · Préstamos del Valle · 800+ clientes activos</div>
        </div>
      </div>
    </div>
  );
};

const OnboardScreen = ({ onDone }) => {
  const [step, setStep] = useStateLogin(1);
  const total = 4;

  const next = () => step < total ? setStep(step+1) : onDone();

  return (
    <div className="onboard">
      <div className="onboard-card">
        <div className="brand" style={{borderBottom:'none', padding:0, marginBottom:24}}>
          <div className="brand-mark">c</div>
          <div className="brand-name">Cartera<em>.</em></div>
        </div>

        <div className="steps">
          {[1,2,3,4].map(n => (
            <div key={n} className={'step-dot ' + (n < step ? 'done' : n === step ? 'current' : '')}/>
          ))}
          <span style={{marginLeft:10, fontSize:11, color:'var(--text-3)', fontFamily:'var(--font-mono)'}}>{step} / {total}</span>
        </div>

        {step === 1 && (
          <div className="fade-up">
            <h2 className="serif" style={{fontSize:36, margin:0, letterSpacing:'-0.01em'}}>Cuéntanos sobre tu <em style={{color:'var(--accent)'}}>operación</em>.</h2>
            <p style={{color:'var(--text-3)', marginTop:8, marginBottom: 24}}>Esto nos ayuda a configurar tu cartera. Tomará menos de un minuto.</p>

            <div className="field">
              <label>Razón social</label>
              <input defaultValue="Préstamos Andina S.A.S"/>
            </div>
            <div className="field">
              <label>NIT</label>
              <input defaultValue="901.234.567-8"/>
            </div>
            <div className="field">
              <label>Tipo de operación</label>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                {['Microcrédito','Libranza','Gota a gota','Consumo'].map((t,i) => (
                  <div key={t} className="chip" style={{justifyContent:'center', padding:'10px', background: i===0?'var(--accent-soft)':'var(--surface)', borderColor: i===0?'rgba(212,255,58,0.3)':'var(--border)', color: i===0?'var(--accent)':'var(--text-2)'}}>{t}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="fade-up">
            <h2 className="serif" style={{fontSize:36, margin:0}}>¿Cuántos <em style={{color:'var(--accent)'}}>clientes</em> manejas?</h2>
            <p style={{color:'var(--text-3)', marginTop:8, marginBottom: 24}}>Te recomendaremos el plan adecuado.</p>

            <div style={{display:'grid', gap:10}}>
              {[
                { r:'1 — 100', plan:'Starter', price:'$89.000/mes'},
                { r:'101 — 500', plan:'Operativo', price:'$249.000/mes', recommended:true},
                { r:'501 — 2.000', plan:'Pro', price:'$590.000/mes'},
                { r:'+2.000', plan:'Enterprise', price:'Personalizado'},
              ].map(p => (
                <div key={p.r} className="card" style={{display:'flex', alignItems:'center', padding:'14px 16px', borderColor: p.recommended?'var(--accent)':'var(--border)'}}>
                  <div style={{flex:1}}>
                    <div className="mono" style={{fontSize:11, color:'var(--text-3)'}}>{p.r} CLIENTES</div>
                    <div className="serif" style={{fontSize:22, marginTop:2}}>{p.plan}</div>
                  </div>
                  <div className="mono" style={{fontSize:13}}>{p.price}</div>
                  {p.recommended && <span className="pill accent" style={{marginLeft:12}}>Recomendado</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="fade-up">
            <h2 className="serif" style={{fontSize:36, margin:0}}>Conecta tus <em style={{color:'var(--accent)'}}>medios de pago</em>.</h2>
            <p style={{color:'var(--text-3)', marginTop:8, marginBottom: 24}}>Concilia automáticamente los abonos de tus clientes.</p>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
              {['Nequi','Daviplata','Bancolombia','Davivienda','PSE','Efectivo'].map((m,i) => (
                <div key={m} className="card" style={{padding:14, display:'flex', alignItems:'center', gap:10, borderColor: i<3?'var(--accent)':'var(--border)'}}>
                  <div style={{width:32, height:32, borderRadius:6, background:'var(--surface-2)', display:'grid', placeItems:'center'}}>
                    <Icons.Bank size={16}/>
                  </div>
                  <span style={{flex:1, fontSize:13.5}}>{m}</span>
                  {i<3 ? <Icons.Check size={16} stroke="var(--accent)"/> : <Icons.Plus size={16} stroke="var(--text-3)"/>}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="fade-up" style={{textAlign:'center', padding:'20px 0'}}>
            <div style={{width:64, height:64, borderRadius:'50%', background:'var(--accent-soft)', display:'grid', placeItems:'center', margin:'0 auto 20px'}}>
              <Icons.Check size={32} stroke="var(--accent)"/>
            </div>
            <h2 className="serif" style={{fontSize:36, margin:0}}>Todo <em style={{color:'var(--accent)'}}>listo</em>.</h2>
            <p style={{color:'var(--text-3)', marginTop:8, marginBottom: 24, maxWidth: 360, margin:'8px auto 28px'}}>Tu cuenta está activa. Hemos importado un set de datos de demostración para que explores.</p>
          </div>
        )}

        <div style={{display:'flex', justifyContent:'space-between', marginTop:28}}>
          <button className="btn btn-ghost" onClick={() => step>1 ? setStep(step-1) : onDone()}>
            {step === 1 ? 'Saltar' : '← Atrás'}
          </button>
          <button className="btn btn-primary" onClick={next}>
            {step === total ? 'Entrar al dashboard' : 'Continuar'} <Icons.Chevron size={14}/>
          </button>
        </div>
      </div>
    </div>
  );
};

window.LoginScreen = LoginScreen;
window.OnboardScreen = OnboardScreen;
