// lib/avatars.js — Coleccion de avatares NFT abstractos para perfiles de usuario
// Cada avatar es un SVG inline con composicion geometrica abstracta, tonos vibrantes solidos.
// Inspirados en conceptos financieros pero representados de forma artistica/abstracta.

export const AVATARS = [
  {
    id: 'bull',
    nombre: 'Taurus',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#0f172a"/><polygon points="20,95 60,20 100,95" fill="#e11d48"/><polygon points="35,95 60,40 85,95" fill="#f43f5e"/><polygon points="10,50 30,25 35,60" fill="#be123c" transform="rotate(-15 25 45)"/><polygon points="85,50 105,25 90,60" fill="#be123c" transform="rotate(15 95 45)"/><circle cx="48" cy="65" r="4" fill="#fbbf24"/><circle cx="72" cy="65" r="4" fill="#fbbf24"/><rect x="45" y="80" width="30" height="4" rx="2" fill="#881337"/><line x1="35" y1="100" x2="50" y2="90" stroke="#9f1239" stroke-width="3"/><line x1="85" y1="100" x2="70" y2="90" stroke="#9f1239" stroke-width="3"/></svg>`,
  },
  {
    id: 'diamond',
    nombre: 'Prisma',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#1e1b4b"/><polygon points="60,10 100,45 60,110 20,45" fill="#7c3aed"/><polygon points="60,10 60,110 20,45" fill="#6d28d9"/><polygon points="20,45 60,10 60,45" fill="#a78bfa"/><polygon points="100,45 60,10 60,45" fill="#8b5cf6"/><polygon points="20,45 60,45 60,110" fill="#5b21b6"/><polygon points="100,45 60,45 60,110" fill="#7c3aed"/><line x1="60" y1="10" x2="60" y2="110" stroke="#c4b5fd" stroke-width="1" opacity="0.4"/><line x1="20" y1="45" x2="100" y2="45" stroke="#c4b5fd" stroke-width="1" opacity="0.4"/></svg>`,
  },
  {
    id: 'rocket',
    nombre: 'Orbital',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#0c0a09"/><circle cx="60" cy="60" r="35" fill="none" stroke="#f97316" stroke-width="2" opacity="0.3"/><circle cx="60" cy="60" r="50" fill="none" stroke="#f97316" stroke-width="1" opacity="0.15"/><polygon points="60,15 72,55 60,50 48,55" fill="#f97316"/><polygon points="60,15 48,55 60,50" fill="#ea580c"/><polygon points="48,55 40,75 60,65" fill="#dc2626"/><polygon points="72,55 80,75 60,65" fill="#dc2626"/><circle cx="60" cy="42" r="5" fill="#fbbf24"/><circle cx="55" cy="80" r="2" fill="#f97316" opacity="0.6"/><circle cx="65" cy="85" r="1.5" fill="#fb923c" opacity="0.5"/><circle cx="58" cy="90" r="2.5" fill="#f97316" opacity="0.4"/></svg>`,
  },
  {
    id: 'crown',
    nombre: 'Regente',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#1c1917"/><polygon points="20,80 30,35 45,60 60,25 75,60 90,35 100,80" fill="#eab308"/><polygon points="20,80 30,35 45,60 60,25" fill="#ca8a04"/><rect x="18" y="78" width="84" height="12" rx="3" fill="#a16207"/><rect x="18" y="78" width="84" height="12" rx="3" fill="#eab308" opacity="0.7"/><circle cx="60" cy="55" r="5" fill="#fef3c7"/><circle cx="38" cy="62" r="3.5" fill="#fef3c7" opacity="0.8"/><circle cx="82" cy="62" r="3.5" fill="#fef3c7" opacity="0.8"/><rect x="25" y="92" width="70" height="3" rx="1.5" fill="#854d0e" opacity="0.5"/></svg>`,
  },
  {
    id: 'shield',
    nombre: 'Fortaleza',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#022c22"/><path d="M60,15 L95,35 L95,65 Q95,95 60,110 Q25,95 25,65 L25,35 Z" fill="#059669"/><path d="M60,15 L60,110 Q25,95 25,65 L25,35 Z" fill="#047857"/><path d="M60,25 L88,42 L88,63 Q88,88 60,102 Q32,88 32,63 L32,42 Z" fill="none" stroke="#34d399" stroke-width="2" opacity="0.5"/><polygon points="60,40 68,58 60,55 52,58" fill="#6ee7b7"/><polygon points="52,58 60,55 60,80 45,72" fill="#34d399"/><polygon points="68,58 60,55 60,80 75,72" fill="#10b981"/></svg>`,
  },
  {
    id: 'lightning',
    nombre: 'Voltaje',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#172554"/><polygon points="65,10 35,60 55,60 40,110 90,50 65,50 80,10" fill="#3b82f6"/><polygon points="65,10 35,60 55,60 40,110" fill="#2563eb"/><polygon points="55,60 40,110 90,50 65,50" fill="#60a5fa"/><circle cx="30" cy="30" r="2" fill="#93c5fd" opacity="0.6"/><circle cx="95" cy="25" r="1.5" fill="#93c5fd" opacity="0.4"/><circle cx="20" cy="85" r="2.5" fill="#93c5fd" opacity="0.3"/><circle cx="100" cy="90" r="2" fill="#93c5fd" opacity="0.5"/></svg>`,
  },
  {
    id: 'fire',
    nombre: 'Ignis',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#1c1917"/><path d="M60,15 Q80,40 85,60 Q90,80 75,95 Q65,105 60,105 Q55,105 45,95 Q30,80 35,60 Q40,40 60,15" fill="#dc2626"/><path d="M60,30 Q75,50 78,65 Q82,80 70,90 Q65,95 60,95 Q55,95 50,90 Q38,80 42,65 Q45,50 60,30" fill="#ef4444"/><path d="M60,50 Q70,62 72,72 Q74,82 65,88 Q62,90 60,90 Q58,90 55,88 Q46,82 48,72 Q50,62 60,50" fill="#f97316"/><path d="M60,65 Q66,73 67,78 Q68,84 62,87 Q61,88 60,88 Q59,88 58,87 Q52,84 53,78 Q54,73 60,65" fill="#fbbf24"/></svg>`,
  },
  {
    id: 'eagle',
    nombre: 'Apex',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#0f172a"/><polygon points="60,15 90,55 95,50" fill="#64748b"/><polygon points="60,15 30,55 25,50" fill="#475569"/><polygon points="60,15 30,55 60,70 90,55" fill="#94a3b8"/><polygon points="60,15 30,55 60,70" fill="#64748b"/><polygon points="60,70 45,100 60,90 75,100" fill="#cbd5e1"/><polygon points="60,70 45,100 60,90" fill="#94a3b8"/><polygon points="52,45 60,35 68,45 60,50" fill="#fbbf24"/><circle cx="52" cy="42" r="2.5" fill="#1e293b"/><circle cx="68" cy="42" r="2.5" fill="#1e293b"/></svg>`,
  },
  {
    id: 'vault',
    nombre: 'Cofre',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#1e1b4b"/><rect x="20" y="35" width="80" height="55" rx="8" fill="#7c3aed"/><rect x="20" y="35" width="80" height="28" rx="8" fill="#6d28d9"/><circle cx="60" cy="62" r="15" fill="none" stroke="#a78bfa" stroke-width="3"/><circle cx="60" cy="62" r="5" fill="#c4b5fd"/><line x1="60" y1="47" x2="60" y2="52" stroke="#a78bfa" stroke-width="2"/><line x1="60" y1="72" x2="60" y2="77" stroke="#a78bfa" stroke-width="2"/><line x1="45" y1="62" x2="50" y2="62" stroke="#a78bfa" stroke-width="2"/><line x1="70" y1="62" x2="75" y2="62" stroke="#a78bfa" stroke-width="2"/><rect x="25" y="90" width="10" height="8" rx="2" fill="#5b21b6"/><rect x="85" y="90" width="10" height="8" rx="2" fill="#5b21b6"/></svg>`,
  },
  {
    id: 'chart',
    nombre: 'Ascenso',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#052e16"/><line x1="20" y1="95" x2="105" y2="95" stroke="#166534" stroke-width="2"/><line x1="20" y1="95" x2="20" y2="15" stroke="#166534" stroke-width="2"/><polyline points="25,85 40,75 50,78 65,50 80,40 95,20" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><polygon points="25,85 40,75 50,78 65,50 80,40 95,20 95,95 25,95" fill="#22c55e" opacity="0.15"/><circle cx="95" cy="20" r="5" fill="#4ade80"/><circle cx="80" cy="40" r="3" fill="#22c55e"/><circle cx="65" cy="50" r="3" fill="#22c55e"/></svg>`,
  },
  {
    id: 'coin',
    nombre: 'Aureo',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#1c1917"/><ellipse cx="60" cy="64" rx="38" ry="38" fill="#a16207"/><ellipse cx="60" cy="60" rx="38" ry="38" fill="#eab308"/><ellipse cx="60" cy="60" rx="38" ry="38" fill="none" stroke="#fbbf24" stroke-width="3"/><ellipse cx="60" cy="60" rx="30" ry="30" fill="none" stroke="#ca8a04" stroke-width="2"/><text x="60" y="72" text-anchor="middle" font-size="36" font-weight="bold" fill="#854d0e" font-family="serif">$</text></svg>`,
  },
  {
    id: 'waves',
    nombre: 'Flujo',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#0c4a6e"/><path d="M0,70 Q30,50 60,70 Q90,90 120,70" fill="none" stroke="#0ea5e9" stroke-width="4" opacity="0.8"/><path d="M0,55 Q30,35 60,55 Q90,75 120,55" fill="none" stroke="#38bdf8" stroke-width="3" opacity="0.6"/><path d="M0,40 Q30,20 60,40 Q90,60 120,40" fill="none" stroke="#7dd3fc" stroke-width="2.5" opacity="0.4"/><path d="M0,85 Q30,65 60,85 Q90,105 120,85" fill="none" stroke="#0284c7" stroke-width="5" opacity="0.9"/><circle cx="85" cy="25" r="12" fill="#fbbf24" opacity="0.9"/><circle cx="85" cy="25" r="8" fill="#fde68a"/></svg>`,
  },
  {
    id: 'hexagon',
    nombre: 'Nexus',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#14532d"/><polygon points="60,15 95,32 95,68 60,85 25,68 25,32" fill="#16a34a"/><polygon points="60,15 60,85 25,68 25,32" fill="#15803d"/><polygon points="60,25 85,38 85,62 60,75 35,62 35,38" fill="none" stroke="#4ade80" stroke-width="1.5" opacity="0.6"/><polygon points="60,35 75,44 75,56 60,65 45,56 45,44" fill="#22c55e" opacity="0.5"/><circle cx="60" cy="50" r="8" fill="#bbf7d0"/><polygon points="60,90 75,100 60,110 45,100" fill="#166534" opacity="0.6"/></svg>`,
  },
  {
    id: 'phoenix',
    nombre: 'Fenix',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#1c1917"/><path d="M60,20 Q45,40 40,55 Q35,70 45,85 L60,75 L75,85 Q85,70 80,55 Q75,40 60,20" fill="#dc2626"/><path d="M60,20 Q45,40 40,55 Q35,70 45,85 L60,75" fill="#b91c1c"/><path d="M60,35 Q50,48 47,58 Q44,68 50,78 L60,70 L70,78 Q76,68 73,58 Q70,48 60,35" fill="#f97316"/><path d="M60,50 Q55,58 53,63 Q51,70 56,75 L60,72 L64,75 Q69,70 67,63 Q65,58 60,50" fill="#fbbf24"/><path d="M35,55 Q20,45 10,50" stroke="#ef4444" stroke-width="2.5" fill="none"/><path d="M85,55 Q100,45 110,50" stroke="#ef4444" stroke-width="2.5" fill="none"/><path d="M30,60 Q15,55 8,62" stroke="#dc2626" stroke-width="2" fill="none"/><path d="M90,60 Q105,55 112,62" stroke="#dc2626" stroke-width="2" fill="none"/></svg>`,
  },
  {
    id: 'pyramid',
    nombre: 'Cumbre',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#1e1b4b"/><polygon points="60,15 105,100 15,100" fill="#6366f1"/><polygon points="60,15 15,100 60,100" fill="#4f46e5"/><line x1="15" y1="100" x2="105" y2="100" stroke="#818cf8" stroke-width="1" opacity="0.5"/><line x1="27" y1="80" x2="93" y2="80" stroke="#818cf8" stroke-width="1" opacity="0.4"/><line x1="39" y1="60" x2="81" y2="60" stroke="#818cf8" stroke-width="1" opacity="0.3"/><line x1="51" y1="40" x2="69" y2="40" stroke="#818cf8" stroke-width="1" opacity="0.2"/><polygon points="56,12 64,12 60,5" fill="#fbbf24"/><circle cx="60" cy="14" r="3" fill="#fbbf24" opacity="0.8"/></svg>`,
  },
  {
    id: 'infinity',
    nombre: 'Perpetuo',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#0f172a"/><path d="M60,60 C60,40 80,30 90,40 C100,50 100,70 90,80 C80,90 60,80 60,60 C60,40 40,30 30,40 C20,50 20,70 30,80 C40,90 60,80 60,60" fill="none" stroke="#a855f7" stroke-width="5"/><path d="M60,60 C60,44 76,35 85,42 C94,50 94,70 85,78 C76,85 60,76 60,60" fill="#a855f7" opacity="0.15"/><path d="M60,60 C60,44 44,35 35,42 C26,50 26,70 35,78 C44,85 60,76 60,60" fill="#a855f7" opacity="0.1"/><circle cx="60" cy="60" r="4" fill="#d8b4fe"/><circle cx="90" cy="55" r="2" fill="#c084fc" opacity="0.6"/><circle cx="30" cy="65" r="2" fill="#c084fc" opacity="0.6"/></svg>`,
  },
  {
    id: 'star',
    nombre: 'Estelar',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#172554"/><polygon points="60,10 70,42 105,42 77,62 87,95 60,75 33,95 43,62 15,42 50,42" fill="#3b82f6"/><polygon points="60,10 50,42 15,42 43,62 33,95 60,75" fill="#2563eb"/><polygon points="60,20 68,45 95,45 73,60 81,88 60,72 39,88 47,60 25,45 52,45" fill="none" stroke="#93c5fd" stroke-width="1" opacity="0.5"/><circle cx="60" cy="50" r="8" fill="#bfdbfe"/><circle cx="60" cy="50" r="4" fill="#dbeafe"/></svg>`,
  },
  {
    id: 'bars',
    nombre: 'Capital',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#1c1917"/><rect x="15" y="70" width="16" height="35" rx="3" fill="#f59e0b"/><rect x="37" y="55" width="16" height="50" rx="3" fill="#eab308"/><rect x="59" y="40" width="16" height="65" rx="3" fill="#fbbf24"/><rect x="81" y="25" width="16" height="80" rx="3" fill="#fde68a"/><rect x="15" y="70" width="16" height="18" rx="3" fill="#d97706" opacity="0.3"/><rect x="37" y="55" width="16" height="18" rx="3" fill="#ca8a04" opacity="0.3"/><rect x="59" y="40" width="16" height="18" rx="3" fill="#eab308" opacity="0.3"/><rect x="81" y="25" width="16" height="18" rx="3" fill="#fbbf24" opacity="0.3"/><line x1="10" y1="105" x2="110" y2="105" stroke="#78350f" stroke-width="2"/></svg>`,
  },
  {
    id: 'robot',
    nombre: 'Androide',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#0f172a"/><rect x="28" y="38" width="64" height="55" rx="10" fill="#334155"/><rect x="28" y="38" width="64" height="28" rx="10" fill="#1e40af"/><circle cx="44" cy="55" r="9" fill="#0f172a"/><circle cx="44" cy="55" r="5" fill="#38bdf8"/><circle cx="44" cy="55" r="2" fill="#e0f2fe"/><circle cx="76" cy="55" r="9" fill="#0f172a"/><circle cx="76" cy="55" r="5" fill="#38bdf8"/><circle cx="76" cy="55" r="2" fill="#e0f2fe"/><rect x="40" y="76" width="40" height="8" rx="4" fill="#0f172a"/><rect x="43" y="78" width="10" height="4" rx="2" fill="#4ade80"/><rect x="57" y="78" width="10" height="4" rx="2" fill="#facc15"/><rect x="71" y="78" width="6" height="4" rx="2" fill="#f87171"/><rect x="50" y="20" width="6" height="18" rx="3" fill="#475569"/><rect x="64" y="20" width="6" height="18" rx="3" fill="#475569"/><circle cx="53" cy="18" r="4" fill="#38bdf8"/><circle cx="67" cy="18" r="4" fill="#38bdf8"/><rect x="12" y="50" width="16" height="10" rx="5" fill="#334155"/><rect x="92" y="50" width="16" height="10" rx="5" fill="#334155"/></svg>`,
  },
  {
    id: 'fox',
    nombre: 'Zorro',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#1c1917"/><polygon points="60,20 30,55 40,55 40,90 80,90 80,55 90,55" fill="#ea580c"/><polygon points="60,20 30,55 40,55 40,90 60,90" fill="#c2410c"/><polygon points="30,30 10,15 30,55" fill="#ea580c"/><polygon points="90,30 110,15 90,55" fill="#ea580c"/><polygon points="30,30 10,15 30,55" fill="#c2410c"/><polygon points="40,60 80,60 75,85 45,85" fill="#fef3c7"/><circle cx="47" cy="68" r="5" fill="#0f172a"/><circle cx="73" cy="68" r="5" fill="#0f172a"/><circle cx="48" cy="67" r="2" fill="#60a5fa"/><circle cx="74" cy="67" r="2" fill="#60a5fa"/><ellipse cx="60" cy="78" rx="6" ry="4" fill="#e11d48"/><path d="M54,80 Q60,85 66,80" fill="none" stroke="#9f1239" stroke-width="1.5"/></svg>`,
  },
  {
    id: 'wolf',
    nombre: 'Lobo',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#1e1b4b"/><polygon points="60,22 35,60 45,60 45,88 75,88 75,60 85,60" fill="#94a3b8"/><polygon points="60,22 35,60 45,60 45,88 60,88" fill="#64748b"/><polygon points="35,32 18,12 38,58" fill="#94a3b8"/><polygon points="85,32 102,12 82,58" fill="#94a3b8"/><polygon points="35,32 18,12 38,58" fill="#64748b"/><ellipse cx="60" cy="78" rx="12" ry="8" fill="#cbd5e1"/><circle cx="50" cy="66" r="5" fill="#0f172a"/><circle cx="70" cy="66" r="5" fill="#0f172a"/><circle cx="51" cy="65" r="2" fill="#818cf8"/><circle cx="71" cy="65" r="2" fill="#818cf8"/><ellipse cx="60" cy="78" rx="4" ry="3" fill="#e11d48"/><path d="M54,80 Q60,86 66,80" fill="none" stroke="#9f1239" stroke-width="2"/><path d="M48,85 Q60,95 72,85" fill="none" stroke="#475569" stroke-width="1.5" opacity="0.5"/></svg>`,
  },
  {
    id: 'dragon',
    nombre: 'Dragón',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#0c0a09"/><path d="M60,15 Q85,25 95,50 Q105,75 85,95 Q70,110 60,105 Q50,110 35,95 Q15,75 25,50 Q35,25 60,15" fill="#15803d"/><path d="M60,15 Q35,25 25,50 Q15,75 35,95 Q50,110 60,105" fill="#166534"/><path d="M60,25 Q80,32 88,52 Q96,72 78,88" fill="none" stroke="#4ade80" stroke-width="1.5" opacity="0.4"/><circle cx="47" cy="58" r="7" fill="#0f172a"/><circle cx="47" cy="58" r="4" fill="#facc15"/><circle cx="47" cy="57" r="2" fill="#0f172a"/><circle cx="73" cy="58" r="7" fill="#0f172a"/><circle cx="73" cy="58" r="4" fill="#facc15"/><circle cx="73" cy="57" r="2" fill="#0f172a"/><path d="M50,75 Q60,72 70,75 Q65,85 60,82 Q55,85 50,75" fill="#dc2626"/><path d="M52,80 L60,95 L68,80" fill="none" stroke="#ef4444" stroke-width="2"/><polygon points="38,20 28,8 42,28" fill="#16a34a"/><polygon points="82,20 92,8 78,28" fill="#16a34a"/></svg>`,
  },
  {
    id: 'planet',
    nombre: 'Cosmos',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#0a0520"/><circle cx="60" cy="60" r="30" fill="#7c3aed"/><circle cx="60" cy="60" r="30" fill="none" stroke="#a78bfa" stroke-width="1" opacity="0.4"/><ellipse cx="60" cy="60" rx="55" ry="18" fill="none" stroke="#c4b5fd" stroke-width="3" opacity="0.6" transform="rotate(-20 60 60)"/><circle cx="48" cy="50" r="8" fill="#6d28d9" opacity="0.7"/><circle cx="68" cy="62" r="5" fill="#5b21b6" opacity="0.5"/><circle cx="55" cy="68" r="4" fill="#8b5cf6" opacity="0.6"/><circle cx="20" cy="25" r="2" fill="white" opacity="0.8"/><circle cx="90" cy="15" r="1.5" fill="white" opacity="0.6"/><circle cx="100" cy="85" r="2" fill="white" opacity="0.7"/><circle cx="15" cy="90" r="1.5" fill="white" opacity="0.5"/><circle cx="105" cy="40" r="1" fill="white" opacity="0.9"/></svg>`,
  },
  {
    id: 'eye',
    nombre: 'Oráculo',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#0f172a"/><path d="M15,60 Q40,25 60,25 Q80,25 105,60 Q80,95 60,95 Q40,95 15,60" fill="#1e293b"/><path d="M15,60 Q40,25 60,25 Q80,25 105,60" fill="#0f172a" opacity="0.3"/><circle cx="60" cy="60" r="22" fill="#0c4a6e"/><circle cx="60" cy="60" r="15" fill="#0284c7"/><circle cx="60" cy="60" r="8" fill="#0f172a"/><circle cx="64" cy="56" r="3" fill="white" opacity="0.8"/><path d="M18,58 Q40,28 60,28 Q80,28 102,58" fill="none" stroke="#38bdf8" stroke-width="1" opacity="0.3"/><path d="M18,62 Q40,92 60,92 Q80,92 102,62" fill="none" stroke="#38bdf8" stroke-width="1" opacity="0.3"/><circle cx="38" cy="50" r="2" fill="#38bdf8" opacity="0.4"/><circle cx="82" cy="50" r="2" fill="#38bdf8" opacity="0.4"/></svg>`,
  },
  {
    id: 'bee',
    nombre: 'Colmena',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#1c1917"/><ellipse cx="60" cy="65" rx="28" ry="35" fill="#eab308"/><ellipse cx="60" cy="65" rx="28" ry="35" fill="none" stroke="#ca8a04" stroke-width="1.5"/><rect x="32" y="52" width="56" height="7" rx="2" fill="#0f172a" opacity="0.6"/><rect x="32" y="64" width="56" height="7" rx="2" fill="#0f172a" opacity="0.6"/><rect x="32" y="76" width="56" height="7" rx="2" fill="#0f172a" opacity="0.6"/><ellipse cx="60" cy="38" rx="14" ry="10" fill="#1c1917"/><circle cx="52" cy="36" r="5" fill="#0f172a"/><circle cx="68" cy="36" r="5" fill="#0f172a"/><circle cx="52" cy="35" r="2.5" fill="#38bdf8"/><circle cx="68" cy="35" r="2.5" fill="#38bdf8"/><path d="M30,50 Q15,35 20,20" stroke="#ca8a04" stroke-width="2.5" fill="none"/><path d="M90,50 Q105,35 100,20" stroke="#ca8a04" stroke-width="2.5" fill="none"/><ellipse cx="22" cy="18" rx="8" ry="5" fill="#fde68a" opacity="0.6" transform="rotate(-30 22 18)"/><ellipse cx="98" cy="18" rx="8" ry="5" fill="#fde68a" opacity="0.6" transform="rotate(30 98 18)"/></svg>`,
  },
  {
    id: 'crystal',
    nombre: 'Cristal',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#0c0a09"/><polygon points="60,10 85,35 85,85 60,110 35,85 35,35" fill="#06b6d4"/><polygon points="60,10 35,35 35,85 60,110" fill="#0891b2"/><polygon points="60,10 85,35 60,35" fill="#67e8f9" opacity="0.7"/><polygon points="35,35 85,35 60,35" fill="#22d3ee" opacity="0.5"/><polygon points="35,85 85,85 60,110" fill="#164e63" opacity="0.8"/><line x1="60" y1="10" x2="60" y2="110" stroke="#a5f3fc" stroke-width="1" opacity="0.3"/><line x1="35" y1="35" x2="85" y2="85" stroke="#a5f3fc" stroke-width="1" opacity="0.2"/><line x1="85" y1="35" x2="35" y2="85" stroke="#a5f3fc" stroke-width="1" opacity="0.2"/><circle cx="60" cy="60" r="8" fill="#cffafe" opacity="0.3"/><circle cx="60" cy="60" r="3" fill="white" opacity="0.5"/></svg>`,
  },
  {
    id: 'moon',
    nombre: 'Luna',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#0a0520"/><path d="M75,20 Q95,40 90,65 Q85,90 60,100 Q35,108 18,90 Q5,72 12,50 Q19,28 40,20 Q55,14 75,20 Q58,28 52,48 Q46,68 58,82 Q70,96 85,88 Q98,80 98,65 Q98,42 80,28 Z" fill="#fbbf24"/><circle cx="35" cy="60" r="5" fill="#ca8a04" opacity="0.4"/><circle cx="50" cy="40" r="3" fill="#ca8a04" opacity="0.3"/><circle cx="42" cy="75" r="4" fill="#ca8a04" opacity="0.35"/><circle cx="20" cy="30" r="2" fill="white" opacity="0.8"/><circle cx="100" cy="20" r="1.5" fill="white" opacity="0.6"/><circle cx="15" cy="80" r="1" fill="white" opacity="0.7"/><circle cx="105" cy="95" r="2" fill="white" opacity="0.5"/></svg>`,
  },
  {
    id: 'octopus',
    nombre: 'Kraken',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#0c4a6e"/><ellipse cx="60" cy="50" rx="28" ry="25" fill="#7c3aed"/><circle cx="48" cy="45" r="7" fill="#0f172a"/><circle cx="48" cy="45" r="4" fill="#f59e0b"/><circle cx="48" cy="44" r="2" fill="#0f172a"/><circle cx="72" cy="45" r="7" fill="#0f172a"/><circle cx="72" cy="45" r="4" fill="#f59e0b"/><circle cx="72" cy="44" r="2" fill="#0f172a"/><path d="M32,65 Q22,75 18,90 Q22,82 28,85" stroke="#6d28d9" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M42,70 Q35,82 32,100 Q36,90 42,92" stroke="#7c3aed" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M55,72 Q52,85 50,103 Q54,92 58,94" stroke="#6d28d9" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M65,72 Q68,85 70,103 Q66,92 62,94" stroke="#7c3aed" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M78,70 Q85,82 88,100 Q84,90 78,92" stroke="#6d28d9" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M88,65 Q98,75 102,90 Q98,82 92,85" stroke="#7c3aed" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'sword',
    nombre: 'Gladius',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#1c1917"/><rect x="57" y="15" width="6" height="65" rx="3" fill="#94a3b8"/><polygon points="60,10 55,30 65,30" fill="#e2e8f0"/><rect x="57" y="15" width="6" height="65" fill="url(#grad)" opacity="0.5"/><defs><linearGradient id="grad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#60a5fa"/><stop offset="100%" stop-color="transparent"/></linearGradient></defs><rect x="38" y="72" width="44" height="8" rx="4" fill="#ca8a04"/><rect x="38" y="72" width="44" height="4" rx="2" fill="#eab308"/><rect x="57" y="80" width="6" height="18" rx="3" fill="#92400e"/><rect x="54" y="95" width="12" height="8" rx="3" fill="#78350f"/><circle cx="60" cy="99" r="4" fill="#b45309"/><circle cx="30" cy="76" r="4" fill="#eab308" opacity="0.5"/><circle cx="90" cy="76" r="4" fill="#eab308" opacity="0.5"/></svg>`,
  },
  {
    id: 'panda',
    nombre: 'Panda',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#0f172a"/><circle cx="60" cy="65" r="32" fill="#f8fafc"/><circle cx="33" cy="35" r="13" fill="#1e293b"/><circle cx="87" cy="35" r="13" fill="#1e293b"/><ellipse cx="46" cy="58" rx="10" ry="12" fill="#1e293b"/><ellipse cx="74" cy="58" rx="10" ry="12" fill="#1e293b"/><circle cx="48" cy="56" r="3" fill="#f8fafc"/><circle cx="76" cy="56" r="3" fill="#f8fafc"/><ellipse cx="60" cy="75" rx="6" ry="5" fill="#1e293b"/><path d="M52,82 Q60,88 68,82" fill="none" stroke="#64748b" stroke-width="2"/></svg>`,
  },
  {
    id: 'owl',
    nombre: 'Sabio',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#1c1917"/><ellipse cx="60" cy="65" rx="38" ry="40" fill="#92400e"/><ellipse cx="60" cy="65" rx="38" ry="40" fill="none" stroke="#b45309" stroke-width="2"/><circle cx="44" cy="55" r="15" fill="#fef3c7"/><circle cx="76" cy="55" r="15" fill="#fef3c7"/><circle cx="44" cy="55" r="8" fill="#1c1917"/><circle cx="76" cy="55" r="8" fill="#1c1917"/><circle cx="46" cy="53" r="2.5" fill="#fbbf24"/><circle cx="78" cy="53" r="2.5" fill="#fbbf24"/><polygon points="60,68 53,80 67,80" fill="#f97316"/><polygon points="22,35 38,45 25,55" fill="#78350f"/><polygon points="98,35 82,45 95,55" fill="#78350f"/></svg>`,
  },
  {
    id: 'cat',
    nombre: 'Felino',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#172554"/><polygon points="30,30 45,55 25,60" fill="#f59e0b"/><polygon points="90,30 75,55 95,60" fill="#f59e0b"/><circle cx="60" cy="65" r="33" fill="#fbbf24"/><circle cx="48" cy="60" r="5" fill="#0f172a"/><circle cx="72" cy="60" r="5" fill="#0f172a"/><polygon points="60,68 55,76 65,76" fill="#ea580c"/><path d="M55,80 Q60,84 65,80" fill="none" stroke="#0f172a" stroke-width="2"/><line x1="30" y1="70" x2="10" y2="65" stroke="#0f172a" stroke-width="1.5"/><line x1="30" y1="76" x2="10" y2="78" stroke="#0f172a" stroke-width="1.5"/><line x1="90" y1="70" x2="110" y2="65" stroke="#0f172a" stroke-width="1.5"/><line x1="90" y1="76" x2="110" y2="78" stroke="#0f172a" stroke-width="1.5"/></svg>`,
  },
  {
    id: 'compass',
    nombre: 'Brujula',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#0c4a6e"/><circle cx="60" cy="60" r="42" fill="#0e7490"/><circle cx="60" cy="60" r="42" fill="none" stroke="#67e8f9" stroke-width="3"/><circle cx="60" cy="60" r="32" fill="none" stroke="#22d3ee" stroke-width="1" opacity="0.5"/><polygon points="60,25 70,60 60,55 50,60" fill="#f87171"/><polygon points="60,95 70,60 60,65 50,60" fill="#e0f2fe"/><circle cx="60" cy="60" r="5" fill="#fbbf24"/><circle cx="60" cy="30" r="2" fill="#a5f3fc"/><circle cx="60" cy="90" r="2" fill="#a5f3fc"/><circle cx="30" cy="60" r="2" fill="#a5f3fc"/><circle cx="90" cy="60" r="2" fill="#a5f3fc"/></svg>`,
  },
  {
    id: 'key',
    nombre: 'Acceso',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#1e1b4b"/><circle cx="42" cy="48" r="22" fill="#fbbf24"/><circle cx="42" cy="48" r="11" fill="#1e1b4b"/><rect x="58" y="60" width="48" height="9" rx="2" fill="#fbbf24" transform="rotate(45 58 60)"/><rect x="80" y="78" width="10" height="9" fill="#fbbf24" transform="rotate(45 80 78)"/><rect x="92" y="90" width="10" height="9" fill="#fbbf24" transform="rotate(45 92 90)"/></svg>`,
  },
  {
    id: 'globe',
    nombre: 'Global',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#022c22"/><circle cx="60" cy="60" r="42" fill="#10b981"/><ellipse cx="60" cy="60" rx="42" ry="18" fill="none" stroke="#022c22" stroke-width="2" opacity="0.4"/><ellipse cx="60" cy="60" rx="18" ry="42" fill="none" stroke="#022c22" stroke-width="2" opacity="0.4"/><line x1="18" y1="60" x2="102" y2="60" stroke="#022c22" stroke-width="2" opacity="0.4"/><path d="M40,30 Q55,45 45,60 Q35,75 50,90" fill="#34d399" opacity="0.6"/><path d="M75,25 Q85,40 78,55 Q90,70 80,95" fill="#34d399" opacity="0.6"/></svg>`,
  },
  {
    id: 'gem',
    nombre: 'Esmeralda',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#022c22"/><polygon points="60,12 95,40 80,108 40,108 25,40" fill="#10b981"/><polygon points="60,12 95,40 60,55 25,40" fill="#34d399"/><polygon points="60,12 25,40 60,55" fill="#6ee7b7"/><polygon points="40,108 60,55 80,108" fill="#047857"/><line x1="60" y1="12" x2="60" y2="55" stroke="#d1fae5" stroke-width="1" opacity="0.4"/><line x1="25" y1="40" x2="95" y2="40" stroke="#d1fae5" stroke-width="1" opacity="0.4"/></svg>`,
  },
  {
    id: 'medal',
    nombre: 'Campeon',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#1c1917"/><polygon points="40,15 60,55 80,15" fill="#3b82f6"/><polygon points="45,15 60,45 75,15" fill="#60a5fa"/><circle cx="60" cy="72" r="32" fill="#fbbf24"/><circle cx="60" cy="72" r="32" fill="none" stroke="#ca8a04" stroke-width="3"/><circle cx="60" cy="72" r="20" fill="#f59e0b"/><polygon points="60,60 64,70 75,70 66,77 69,88 60,81 51,88 54,77 45,70 56,70" fill="#fef3c7"/></svg>`,
  },
  {
    id: 'satellite',
    nombre: 'Satelite',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#0a0520"/><rect x="45" y="45" width="30" height="30" rx="4" fill="#94a3b8"/><circle cx="60" cy="60" r="8" fill="#38bdf8"/><rect x="10" y="40" width="28" height="40" rx="2" fill="#3b82f6" transform="rotate(-30 24 60)"/><rect x="82" y="40" width="28" height="40" rx="2" fill="#3b82f6" transform="rotate(30 96 60)"/><line x1="45" y1="50" x2="20" y2="35" stroke="#cbd5e1" stroke-width="2"/><circle cx="20" cy="35" r="2" fill="#fbbf24"/><circle cx="95" cy="20" r="1.5" fill="white" opacity="0.7"/><circle cx="105" cy="95" r="2" fill="white" opacity="0.6"/><circle cx="15" cy="90" r="1" fill="white" opacity="0.5"/></svg>`,
  },
  {
    id: 'leaf',
    nombre: 'Brote',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#052e16"/><path d="M60,105 Q40,80 40,55 Q40,25 75,15 Q85,50 70,75 Q65,90 60,105" fill="#22c55e"/><path d="M60,105 Q40,80 40,55 Q40,25 75,15" fill="#16a34a"/><line x1="60" y1="105" x2="68" y2="35" stroke="#15803d" stroke-width="2"/><line x1="62" y1="80" x2="48" y2="68" stroke="#15803d" stroke-width="1.5"/><line x1="65" y1="60" x2="78" y2="50" stroke="#15803d" stroke-width="1.5"/></svg>`,
  },
  {
    id: 'umbrella',
    nombre: 'Resguardo',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#0c4a6e"/><path d="M15,55 Q60,15 105,55 Q90,45 75,55 Q60,45 45,55 Q30,45 15,55" fill="#0ea5e9"/><path d="M15,55 Q37.5,40 60,55" fill="#38bdf8"/><path d="M60,55 Q82.5,40 105,55" fill="#0284c7"/><line x1="60" y1="55" x2="60" y2="100" stroke="#e0f2fe" stroke-width="3"/><path d="M60,100 Q60,108 50,108" fill="none" stroke="#e0f2fe" stroke-width="3"/></svg>`,
  },
  {
    id: 'target',
    nombre: 'Objetivo',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#1c1917"/><circle cx="60" cy="60" r="42" fill="#ef4444"/><circle cx="60" cy="60" r="30" fill="#f8fafc"/><circle cx="60" cy="60" r="18" fill="#ef4444"/><circle cx="60" cy="60" r="6" fill="#f8fafc"/><line x1="60" y1="10" x2="60" y2="25" stroke="#fbbf24" stroke-width="3"/><line x1="60" y1="95" x2="60" y2="110" stroke="#fbbf24" stroke-width="3"/></svg>`,
  },
  {
    id: 'puzzle',
    nombre: 'Estrategia',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#1e1b4b"/><path d="M20,20 H55 V35 a8,8 0 0 1 16,0 V20 H100 V55 H85 a8,8 0 0 0 0,16 H100 V100 H65 V85 a8,8 0 0 0 -16,0 V100 H20 V65 H35 a8,8 0 0 0 0,-16 H20 Z" fill="#a78bfa"/><path d="M20,20 H55 V35 a8,8 0 0 1 16,0 V20 H100 V55 H85 a8,8 0 0 0 0,16 H100 V100 H65 V85 a8,8 0 0 0 -16,0 V100 H20 Z" fill="none" stroke="#7c3aed" stroke-width="2" opacity="0.6"/></svg>`,
  },
  {
    id: 'rabbit',
    nombre: 'Veloz',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#1c1917"/><ellipse cx="60" cy="72" rx="30" ry="26" fill="#f1f5f9"/><ellipse cx="42" cy="35" rx="9" ry="28" fill="#f1f5f9" transform="rotate(-15 42 35)"/><ellipse cx="78" cy="35" rx="9" ry="28" fill="#f1f5f9" transform="rotate(15 78 35)"/><ellipse cx="42" cy="35" rx="4" ry="20" fill="#f9a8d4" transform="rotate(-15 42 35)"/><ellipse cx="78" cy="35" rx="4" ry="20" fill="#f9a8d4" transform="rotate(15 78 35)"/><circle cx="50" cy="68" r="4" fill="#0f172a"/><circle cx="70" cy="68" r="4" fill="#0f172a"/><ellipse cx="60" cy="80" rx="5" ry="3.5" fill="#f9a8d4"/><path d="M55,82 Q60,88 65,82" fill="none" stroke="#94a3b8" stroke-width="1.5"/></svg>`,
  },
]

export const AVATAR_MAP = Object.fromEntries(AVATARS.map(a => [a.id, a]))

export function getAvatarById(id) {
  return AVATAR_MAP[id] || null
}
