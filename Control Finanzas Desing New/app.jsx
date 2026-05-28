// Main App
const { useState: useStateApp, useEffect: useEffectApp } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dashboard_variant": "editorial",
  "accent": "#d4ff3a",
  "ai_banner": true
}/*EDITMODE-END*/;

function App() {
  const [route, setRoute] = useStateApp('login');
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply accent live
  useEffectApp(() => {
    document.documentElement.style.setProperty('--accent', t.accent);
    // derive accent-soft
    const hex = t.accent.replace('#','');
    const r = parseInt(hex.substring(0,2),16);
    const g = parseInt(hex.substring(2,4),16);
    const b = parseInt(hex.substring(4,6),16);
    document.documentElement.style.setProperty('--accent-soft', `rgba(${r},${g},${b},0.12)`);
  }, [t.accent]);

  const nav = (r) => setRoute(r);

  if (route === 'login') return (
    <>
      <LoginScreen onLogin={() => setRoute('dashboard')} onOnboard={() => setRoute('onboard')}/>
      <TweaksPanelMount t={t} setTweak={setTweak}/>
    </>
  );
  if (route === 'onboard') return (
    <>
      <OnboardScreen onDone={() => setRoute('dashboard')}/>
      <TweaksPanelMount t={t} setTweak={setTweak}/>
    </>
  );

  let Screen = DashboardScreen;
  if (route === 'transactions') Screen = TransactionsScreen;
  if (route === 'reports') Screen = ReportsScreen;
  if (route === 'cashflow') Screen = CashflowScreen;
  if (route === 'routes') Screen = RoutesScreen;
  if (route === 'settings') Screen = SettingsScreen;
  if (route === 'clients') Screen = ClientsScreen;
  if (route === 'loans') Screen = LoansScreen;
  if (route === 'merchandise') Screen = MerchandiseScreen;
  if (route === 'collections') Screen = CollectionsScreen;
  if (route === 'billing') Screen = BillingScreen;

  return (
    <>
      <div className="app">
        <Sidebar current={route} onNav={nav}/>
        <Screen variant={t.dashboard_variant} onNav={nav}/>
      </div>
      <TweaksPanelMount t={t} setTweak={setTweak} extraNav={
        <div style={{borderTop:'1px solid var(--border)', paddingTop:8, marginTop:8}}>
          <div style={{fontSize:10, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', padding:'4px 8px'}}>Atajos</div>
          {['login','onboard','dashboard','clients','loans','collections','routes','merchandise','transactions','reports','cashflow','billing','settings'].map(r => (
            <div key={r} onClick={() => setRoute(r)}
                 style={{padding:'5px 8px', fontSize:12, color: route===r?'var(--accent)':'var(--text-2)', cursor:'pointer', borderRadius:4}}
                 onMouseOver={e=>e.currentTarget.style.background='var(--surface)'}
                 onMouseOut={e=>e.currentTarget.style.background='transparent'}>
              {r}
            </div>
          ))}
        </div>
      }/>
    </>
  );
}

const TweaksPanelMount = ({ t, setTweak, extraNav }) => (
  <TweaksPanel>
    <TweakSection label="Dashboard">
      <TweakRadio
        label="Variante"
        value={t.dashboard_variant}
        onChange={v => setTweak('dashboard_variant', v)}
        options={[
          { value:'editorial', label:'Editorial' },
          { value:'dense', label:'Densa' },
          { value:'spatial', label:'Spatial' },
        ]}/>
      <TweakToggle label="Banner IA" value={t.ai_banner} onChange={v => setTweak('ai_banner', v)}/>
    </TweakSection>
    <TweakSection label="Marca">
      <TweakColor
        label="Acento"
        value={t.accent}
        onChange={v => setTweak('accent', v)}
        options={['#d4ff3a','#a3e635','#4ade80','#60a5fa','#f472b6','#fbbf24']}
      />
    </TweakSection>
    {extraNav && <TweakSection label="Pantallas">{extraNav}</TweakSection>}
  </TweaksPanel>
);

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
