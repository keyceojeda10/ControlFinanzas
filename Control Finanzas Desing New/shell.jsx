// Sidebar + Topbar shared shell
const { useState } = React;

const NAV_SECTIONS = [
  { label: 'General', items: [
    { id: 'dashboard', label: 'Dashboard', icon: 'Dashboard' },
    { id: 'transactions', label: 'Transacciones', icon: 'Tx', badge: '23' },
  ]},
  { label: 'Cartera', items: [
    { id: 'clients', label: 'Clientes', icon: 'User', badge: '1.2k' },
    { id: 'loans', label: 'Préstamos', icon: 'Receipt' },
    { id: 'collections', label: 'Cobranza', icon: 'Bell', badge: '47' },
    { id: 'routes', label: 'Rutas', icon: 'Route', badge: '4' },
  ]},
  { label: 'Comercio', items: [
    { id: 'merchandise', label: 'Mercancía', icon: 'Bank' },
  ]},
  { label: 'Análisis', items: [
    { id: 'reports', label: 'Reportes', icon: 'Chart' },
    { id: 'cashflow', label: 'Cashflow', icon: 'Flow' },
  ]},
  { label: 'Cuenta', items: [
    { id: 'billing', label: 'Plan & Facturación', icon: 'Sparkles' },
    { id: 'settings', label: 'Configuración', icon: 'Cog' },
  ]},
];

const Sidebar = ({ current, onNav }) => {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">c</div>
        <div className="brand-name">Cartera<em>.</em></div>
      </div>

      {NAV_SECTIONS.map(sec => (
        <React.Fragment key={sec.label}>
          <div className="nav-section-label">{sec.label}</div>
          {sec.items.map(item => {
            const I = Icons[item.icon];
            return (
              <div key={item.id}
                   className={'nav-item' + (current === item.id ? ' active' : '')}
                   onClick={() => onNav(item.id)}>
                <I/>
                <span>{item.label}</span>
                {item.badge && <span className="badge">{item.badge}</span>}
              </div>
            );
          })}
        </React.Fragment>
      ))}

      <div className="sidebar-footer">
        <div className="user-chip">
          <div className="avatar">DM</div>
          <div className="user-meta">
            <span className="n">Diana Mejía</span>
            <span className="e">Préstamos Andina S.A.S</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

const Topbar = ({ crumb = [], actions }) => {
  return (
    <div className="topbar">
      <div className="crumb">
        {crumb.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="sep">/</span>}
            <span className={i === crumb.length-1 ? 'now' : ''}>{c}</span>
          </React.Fragment>
        ))}
      </div>
      <div className="right">
        <div className="search">
          <Icons.Search size={14}/>
          <input placeholder="Buscar cliente, préstamo, transacción…"/>
          <span className="kbd">⌘K</span>
        </div>
        <button className="icon-btn" title="Notificaciones"><Icons.Bell/></button>
        {actions}
      </div>
    </div>
  );
};

window.Sidebar = Sidebar;
window.Topbar = Topbar;
