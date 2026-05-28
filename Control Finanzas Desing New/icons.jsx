// Minimal stroke icons — line-style premium icon set
const Icon = ({ d, size = 16, stroke = "currentColor", strokeWidth = 1.5, fill = "none", children, ...rest }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {d ? <path d={d} /> : children}
  </svg>
);

const Icons = {
  Dashboard: (p) => <Icon {...p}><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></Icon>,
  Tx: (p) => <Icon {...p}><path d="M3 7h13l-3-3"/><path d="M21 17H8l3 3"/></Icon>,
  Chart: (p) => <Icon {...p}><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></Icon>,
  Flow: (p) => <Icon {...p}><path d="M3 12h6"/><path d="M3 6h10"/><path d="M3 18h14"/><path d="M19 6l2 2-2 2"/><path d="M15 12l2 2-2 2"/><path d="M21 18l-2-2"/></Icon>,
  Route: (p) => <Icon {...p}><circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M6 8v4a4 4 0 004 4h4"/></Icon>,
  Cog: (p) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.9 2.9l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.9-2.9l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.9-2.9l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.9 2.9l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/></Icon>,
  Search: (p) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></Icon>,
  Plus: (p) => <Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>,
  Download: (p) => <Icon {...p}><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M5 21h14"/></Icon>,
  Filter: (p) => <Icon {...p}><path d="M3 5h18l-7 9v6l-4-2v-4z"/></Icon>,
  Bell: (p) => <Icon {...p}><path d="M6 8a6 6 0 1112 0c0 7 3 7 3 9H3c0-2 3-2 3-9z"/><path d="M10 21a2 2 0 004 0"/></Icon>,
  ArrowUp: (p) => <Icon {...p}><path d="M7 11l5-5 5 5"/><path d="M12 6v12"/></Icon>,
  ArrowDown: (p) => <Icon {...p}><path d="M7 13l5 5 5-5"/><path d="M12 18V6"/></Icon>,
  Check: (p) => <Icon {...p}><path d="M5 12l4 4 10-10"/></Icon>,
  X: (p) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18"/></Icon>,
  Chevron: (p) => <Icon {...p}><path d="M9 6l6 6-6 6"/></Icon>,
  More: (p) => <Icon {...p}><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></Icon>,
  Calendar: (p) => <Icon {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></Icon>,
  Pin: (p) => <Icon {...p}><path d="M12 22s-7-7-7-12a7 7 0 1114 0c0 5-7 12-7 12z"/><circle cx="12" cy="10" r="2.5"/></Icon>,
  User: (p) => <Icon {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></Icon>,
  Logo: (p) => <Icon {...p}><path d="M4 18 L12 4 L20 18 Z"/><path d="M8 14h8"/></Icon>,
  Phone: (p) => <Icon {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/></Icon>,
  Sparkles: (p) => <Icon {...p}><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M19 15l.7 2 2 .7-2 .8-.7 2-.8-2-2-.7 2-.8z"/></Icon>,
  Bank: (p) => <Icon {...p}><path d="M3 10h18L12 3z"/><path d="M5 10v8M9 10v8M15 10v8M19 10v8"/><path d="M3 21h18"/></Icon>,
  Receipt: (p) => <Icon {...p}><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/></Icon>,
  AI: (p) => <Icon {...p}><path d="M12 3l2 4 4 2-4 2-2 4-2-4-4-2 4-2z"/></Icon>,
};

window.Icon = Icon;
window.Icons = Icons;
