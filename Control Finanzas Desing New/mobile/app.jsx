// Mobile prototype root — shows all key cobrador screens
const { useState: useStateMob } = React;

function MobileApp() {
  // Single interactive phone state
  const [interactiveTab, setInteractiveTab] = useStateMob('home');

  const InteractiveScreen = () => {
    if (interactiveTab === 'home') return <MOB.MobHome setTab={setInteractiveTab}/>;
    if (interactiveTab === 'route') return <MOB.MobRoute/>;
    if (interactiveTab === 'tx') return <MOB.MobTransactions/>;
    if (interactiveTab === 'client') return <MOB.MobClient/>;
    if (interactiveTab === 'profile') return (
      <div style={{padding:'72px 24px', background:'#0a0a0a', color:'#fafafa', height:'100%', fontFamily:"'Geist', system-ui, sans-serif"}}>
        <div style={{fontFamily:"'Instrument Serif', serif", fontSize:32, letterSpacing:'-0.015em'}}>Perfil</div>
        <div style={{color:'#6b6b6b', marginTop:4, fontSize:13}}>Diego Ortiz · Ruta Norte</div>
      </div>
    );
    return <MOB.MobHome setTab={setInteractiveTab}/>;
  };

  // Phone shell wrapping any screen
  const Phone = ({ children, dark = true, withNav = false, tab, setTab }) => (
    <IOSDevice width={390} height={844} dark={dark}>
      <div style={{position:'relative', height:'100%', overflow:'hidden', background:'#0a0a0a'}}>
        <div style={{height:'100%', overflowY:'auto', paddingBottom: withNav?80:0}}>
          {children}
        </div>
        {withNav && <MOB.MBottomNav tab={tab} setTab={setTab}/>}
      </div>
    </IOSDevice>
  );

  return (
    <DesignCanvas>
      <DCSection id="hero" title="Cobrador · interactivo" subtitle="Navega con el bottom nav · clic en 'Cobrar' lleva al detalle del cliente">
        <DCArtboard id="interactive" label="◉ Phone interactivo (navegable)" width={390} height={844}>
          <Phone withNav tab={interactiveTab === 'client' ? 'route' : interactiveTab} setTab={setInteractiveTab}>
            <InteractiveScreen/>
          </Phone>
        </DCArtboard>
      </DCSection>

      <DCSection id="flow" title="Cobrador · flujo crítico de cobro" subtitle="Login → Hoy → Ruta → Cobrar → Confirmación → Cierre">
        <DCArtboard id="login" label="01 · Login con PIN" width={390} height={844}>
          <Phone><MOB.MobLogin/></Phone>
        </DCArtboard>
        <DCArtboard id="home" label="02 · Hoy" width={390} height={844}>
          <Phone withNav tab="home"><MOB.MobHome/></Phone>
        </DCArtboard>
        <DCArtboard id="route" label="03 · Ruta del día" width={390} height={844}>
          <Phone withNav tab="route"><MOB.MobRoute/></Phone>
        </DCArtboard>
        <DCArtboard id="mapnav" label="04 · Navegación turn-by-turn" width={390} height={844}>
          <Phone><MOB2.MobMapNav/></Phone>
        </DCArtboard>
        <DCArtboard id="client" label="05 · Cobrar cuota" width={390} height={844}>
          <Phone withNav tab="route"><MOB.MobClient/></Phone>
        </DCArtboard>
        <DCArtboard id="cash" label="06 · Cobro en efectivo + cambio" width={390} height={844}>
          <Phone><MOB2.MobCashCollect/></Phone>
        </DCArtboard>
        <DCArtboard id="confirm" label="07 · Confirmación" width={390} height={844}>
          <Phone><MOB.MobConfirm/></Phone>
        </DCArtboard>
        <DCArtboard id="reschedule" label="08 · Reagendar visita" width={390} height={844}>
          <Phone><MOB2.MobReschedule/></Phone>
        </DCArtboard>
        <DCArtboard id="eod" label="09 · Cierre de día" width={390} height={844}>
          <Phone><MOB2.MobEndOfDay/></Phone>
        </DCArtboard>
      </DCSection>

      <DCSection id="extras" title="Cobrador · CRM y comunicación" subtitle="Cliente 360° + notificaciones">
        <DCArtboard id="profile" label="Perfil del cliente" width={390} height={844}>
          <Phone><MOB2.MobClientProfile/></Phone>
        </DCArtboard>
        <DCArtboard id="tx" label="Mis cobros (historial)" width={390} height={844}>
          <Phone withNav tab="tx"><MOB.MobTransactions/></Phone>
        </DCArtboard>
        <DCArtboard id="notif" label="Notificaciones" width={390} height={844}>
          <Phone><MOB2.MobNotifications/></Phone>
        </DCArtboard>
      </DCSection>

      <DCSection id="admin-overview" title="Admin · Panorama del negocio" subtitle="Dueño / prestamista: pulso diario, caja, gastos, capital">
        <DCArtboard id="adm-home" label="Inicio · pulso del negocio" width={390} height={844}>
          <Phone><ADM.AdminHome/><ADM.ABottomNav tab="home"/></Phone>
        </DCArtboard>
        <DCArtboard id="adm-caja" label="Caja & tesorería" width={390} height={844}>
          <Phone><ADM.AdminCaja/><ADM.ABottomNav tab="caja"/></Phone>
        </DCArtboard>
        <DCArtboard id="adm-gastos" label="Gastos / Egresos" width={390} height={844}>
          <Phone><ADM.AdminGastos/></Phone>
        </DCArtboard>
        <DCArtboard id="adm-capital" label="Mi capital · ROI 23.8%" width={390} height={844}>
          <Phone><ADM.AdminCapital/></Phone>
        </DCArtboard>
      </DCSection>

      <DCSection id="admin-team" title="Admin · Equipo" subtitle="Gestionar cobradores, crearlos, asignar rutas con IA">
        <DCArtboard id="adm-team" label="Equipo de cobradores" width={390} height={844}>
          <Phone><ADM2.AdminTeam/><ADM.ABottomNav tab="team"/></Phone>
        </DCArtboard>
        <DCArtboard id="adm-create" label="Crear cobrador" width={390} height={844}>
          <Phone><ADM2.AdminCreateCobrador/></Phone>
        </DCArtboard>
        <DCArtboard id="adm-routes" label="Asignar rutas (IA)" width={390} height={844}>
          <Phone><ADM2.AdminAssignRoutes/></Phone>
        </DCArtboard>
        <DCArtboard id="adm-approvals" label="Aprobaciones · IA pre-evaluó" width={390} height={844}>
          <Phone><ADM2.AdminApprovals/></Phone>
        </DCArtboard>
      </DCSection>

      <DCSection id="admin-ai" title="Admin · Inteligencia & análisis" subtitle="IA integrada en todo el flujo de gestión">
        <DCArtboard id="adm-insights" label="Centro de inteligencia" width={390} height={844}>
          <Phone><ADM3.AdminAIInsights/><ADM.ABottomNav tab="ai"/></Phone>
        </DCArtboard>
        <DCArtboard id="adm-chat" label="Chat IA · pregúntale al negocio" width={390} height={844}>
          <Phone><ADM3.AdminAIChat/></Phone>
        </DCArtboard>
        <DCArtboard id="adm-reports" label="Reportes ejecutivos" width={390} height={844}>
          <Phone><ADM3.AdminReports/></Phone>
        </DCArtboard>
        <DCArtboard id="adm-cashflow" label="Cashflow proyectado · 14d" width={390} height={844}>
          <Phone><ADM3.AdminCashflowMob/></Phone>
        </DCArtboard>
      </DCSection>

      <DCSection id="admin-billing" title="Admin · Pago del SaaS" subtitle="Mi suscripción a Cartera">
        <DCArtboard id="billing" label="Mi plan & facturación" width={390} height={844}>
          <Phone><MOB2.MobBilling/></Phone>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<MobileApp/>);
