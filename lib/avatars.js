export const AVATAR_CATEGORIES = [
  { id: 'heroes', nombre: 'Super Heroes' },
  { id: 'disney', nombre: 'Disney' },
  { id: 'caritas', nombre: 'Caritas' },
  { id: 'comida', nombre: 'Comida' },
  { id: 'animales', nombre: 'Animales' },
  { id: 'naturaleza', nombre: 'Naturaleza' },
  { id: 'personajes', nombre: 'Personajes' },
]

export const AVATARS = [
  // ═══════════════════════════════════════════════════════════
  // SUPER HEROES (10)
  // ═══════════════════════════════════════════════════════════
  {
    id: 'ironman', nombre: 'Iron Man', categoria: 'heroes',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#B71C1C"/><path d="M30,38 Q30,14 60,10 Q90,14 90,38 L90,76 Q90,102 60,106 Q30,102 30,76 Z" fill="#F44336"/><path d="M36,42 Q36,22 60,18 Q84,22 84,42 L84,56 L60,64 L36,56 Z" fill="#FFD700"/><path d="M36,56 L60,64 L84,56 L84,76 Q84,96 60,100 Q36,96 36,76 Z" fill="#E53935"/><path d="M44,52 L60,60 L76,52" fill="none" stroke="#C62828" stroke-width="2"/><line x1="60" y1="60" x2="60" y2="100" stroke="#C62828" stroke-width="2"/><path d="M42,40 L54,38 L50,48 L42,48 Z" fill="#E3F2FD"/><path d="M78,40 L66,38 L70,48 L78,48 Z" fill="#E3F2FD"/><path d="M44,41 L52,40 L49,47 L44,46 Z" fill="#81D4FA"/><path d="M76,41 L68,40 L71,47 L76,46 Z" fill="#81D4FA"/></svg>`,
  },
  {
    id: 'capitan', nombre: 'Capitán', categoria: 'heroes',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#1565C0"/><path d="M28,56 Q28,16 60,12 Q92,16 92,56 Z" fill="#1E88E5"/><path d="M52,30 L60,16 L68,30 L64,30 L60,22 L56,30 Z" fill="#F5F5F5"/><path d="M30,42 L20,34 L30,48" fill="#F5F5F5"/><path d="M90,42 L100,34 L90,48" fill="#F5F5F5"/><rect x="28" y="54" width="64" height="4" rx="1" fill="#1976D2"/><path d="M32,58 L88,58 L88,80 Q88,100 60,104 Q32,100 32,80 Z" fill="#FFE0BD"/><path d="M42,58 L42,82 Q42,94 60,96 Q78,94 78,82 L78,58" fill="none" stroke="#1565C0" stroke-width="2.5"/><circle cx="48" cy="68" r="3" fill="#1565C0"/><circle cx="72" cy="68" r="3" fill="#1565C0"/><circle cx="47" cy="67" r="1" fill="#fff"/><circle cx="71" cy="67" r="1" fill="#fff"/><path d="M52,84 L68,84" stroke="#C0825A" stroke-width="2" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'spiderman', nombre: 'Spider-Man', categoria: 'heroes',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#D32F2F"/><circle cx="60" cy="60" r="36" fill="#F44336"/><line x1="60" y1="24" x2="60" y2="96" stroke="#C62828" stroke-width="1"/><line x1="24" y1="60" x2="96" y2="60" stroke="#C62828" stroke-width="1"/><line x1="30" y1="30" x2="90" y2="90" stroke="#C62828" stroke-width="1"/><line x1="90" y1="30" x2="30" y2="90" stroke="#C62828" stroke-width="1"/><path d="M36,36 Q60,42 84,36" fill="none" stroke="#C62828" stroke-width="0.8"/><path d="M28,48 Q60,56 92,48" fill="none" stroke="#C62828" stroke-width="0.8"/><path d="M28,72 Q60,80 92,72" fill="none" stroke="#C62828" stroke-width="0.8"/><path d="M36,84 Q60,90 84,84" fill="none" stroke="#C62828" stroke-width="0.8"/><path d="M32,54 L46,38 L58,56 L48,68 L32,64 Z" fill="#F5F5F5" stroke="#1A1A1A" stroke-width="2"/><path d="M88,54 L74,38 L62,56 L72,68 L88,64 Z" fill="#F5F5F5" stroke="#1A1A1A" stroke-width="2"/></svg>`,
  },
  {
    id: 'wolverine', nombre: 'Wolverine', categoria: 'heroes',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#F9A825"/><polygon points="16,16 34,54 16,54" fill="#FFD54F"/><polygon points="104,16 86,54 104,54" fill="#FFD54F"/><path d="M26,48 Q26,24 60,20 Q94,24 94,48 L94,74 Q94,102 60,106 Q26,102 26,74 Z" fill="#FFD54F"/><path d="M28,50 L50,50 L50,66 Q50,74 40,70 L28,66 Z" fill="#1A1A1A"/><path d="M92,50 L70,50 L70,66 Q70,74 80,70 L92,66 Z" fill="#1A1A1A"/><ellipse cx="40" cy="58" rx="8" ry="5" fill="#F5F5F5"/><ellipse cx="80" cy="58" rx="8" ry="5" fill="#F5F5F5"/><path d="M50,68 Q60,62 70,68 L70,82 Q70,96 60,98 Q50,96 50,82 Z" fill="#FFE0BD"/><circle cx="56" cy="78" r="1.5" fill="#C0825A"/><circle cx="64" cy="78" r="1.5" fill="#C0825A"/><path d="M52,88 Q60,94 68,88" fill="none" stroke="#1A1A1A" stroke-width="2" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'pantera', nombre: 'Pantera Negra', categoria: 'heroes',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#311B92"/><polygon points="28,34 18,10 44,28" fill="#212121"/><polygon points="92,34 102,10 76,28" fill="#212121"/><path d="M26,44 Q26,16 60,12 Q94,16 94,44 L94,76 Q94,104 60,108 Q26,104 26,76 Z" fill="#212121"/><polygon points="30,34 22,14 42,28" fill="none" stroke="#9E9E9E" stroke-width="1.5"/><polygon points="90,34 98,14 78,28" fill="none" stroke="#9E9E9E" stroke-width="1.5"/><line x1="60" y1="18" x2="60" y2="42" stroke="#9E9E9E" stroke-width="1.5"/><path d="M44,28 L60,42 L76,28" fill="none" stroke="#9E9E9E" stroke-width="1.5"/><path d="M36,54 L50,46 L52,58 L36,62 Z" fill="#E0E0E0"/><path d="M84,54 L70,46 L68,58 L84,62 Z" fill="#E0E0E0"/><path d="M30,78 Q38,70 46,76 Q54,68 60,76 Q66,68 74,76 Q82,70 90,78" fill="none" stroke="#9E9E9E" stroke-width="2.5" stroke-linecap="round"/><path d="M42,84 Q52,78 60,84 Q68,78 78,84" fill="none" stroke="#7C4DFF" stroke-width="1.5"/></svg>`,
  },
  {
    id: 'thor', nombre: 'Thor', categoria: 'heroes',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#1565C0"/><path d="M28,52 Q28,20 60,16 Q92,20 92,52 L92,58 L28,58 Z" fill="#FFD54F"/><path d="M38,48 Q46,24 60,20 Q74,24 82,48" fill="none" stroke="#FFC107" stroke-width="2"/><circle cx="24" cy="42" r="8" fill="#BDBDBD"/><circle cx="96" cy="42" r="8" fill="#BDBDBD"/><path d="M18,46 L10,32 L24,42" fill="#E0E0E0"/><path d="M102,46 L110,32 L96,42" fill="#E0E0E0"/><path d="M32,58 L88,58 L88,80 Q88,100 60,104 Q32,100 32,80 Z" fill="#FFE0BD"/><circle cx="48" cy="68" r="3" fill="#1E88E5"/><circle cx="72" cy="68" r="3" fill="#1E88E5"/><circle cx="47" cy="67" r="1" fill="#fff"/><circle cx="71" cy="67" r="1" fill="#fff"/><path d="M42,80 Q48,76 54,78 Q57,74 60,78 Q63,74 66,78 Q72,76 78,80 L78,88 Q78,98 60,100 Q42,98 42,88 Z" fill="#E6A817"/><path d="M26,92 L34,80" stroke="#E53935" stroke-width="4" stroke-linecap="round"/><path d="M94,92 L86,80" stroke="#E53935" stroke-width="4" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'hulk', nombre: 'Hulk', categoria: 'heroes',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#2E7D32"/><path d="M24,46 Q24,14 60,10 Q96,14 96,46 L96,80 Q96,108 60,112 Q24,108 24,80 Z" fill="#66BB6A"/><path d="M28,44 Q28,14 60,10 Q92,14 92,44 Q84,20 60,18 Q36,20 28,44" fill="#1A1A1A"/><path d="M32,42 Q38,26 46,36" fill="#1A1A1A"/><path d="M88,42 Q82,26 74,36" fill="#1A1A1A"/><path d="M30,48 L54,56" stroke="#388E3C" stroke-width="5" stroke-linecap="round"/><path d="M90,48 L66,56" stroke="#388E3C" stroke-width="5" stroke-linecap="round"/><circle cx="44" cy="62" r="5" fill="#F5F5F5"/><circle cx="76" cy="62" r="5" fill="#F5F5F5"/><circle cx="46" cy="62" r="3" fill="#1A1A1A"/><circle cx="78" cy="62" r="3" fill="#1A1A1A"/><path d="M54,74 Q60,78 66,74" fill="#4CAF50" stroke="#388E3C" stroke-width="1"/><path d="M38,86 L42,82 L46,86 L50,82 L54,86 L58,82 L62,86 L66,82 L70,86 L74,82 L78,86 L82,82" fill="none" stroke="#F5F5F5" stroke-width="2.5" stroke-linecap="round"/><path d="M24,98 L34,88 L44,98 L52,92" fill="#7B1FA2"/><path d="M96,98 L86,88 L76,98 L68,92" fill="#7B1FA2"/></svg>`,
  },
  {
    id: 'deadpool', nombre: 'Deadpool', categoria: 'heroes',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#C62828"/><ellipse cx="60" cy="58" rx="32" ry="38" fill="#F44336"/><line x1="60" y1="20" x2="60" y2="96" stroke="#D32F2F" stroke-width="2.5"/><ellipse cx="42" cy="48" rx="14" ry="12" fill="#1A1A1A"/><ellipse cx="78" cy="48" rx="14" ry="12" fill="#1A1A1A"/><ellipse cx="42" cy="48" rx="10" ry="8" fill="#F5F5F5"/><ellipse cx="78" cy="48" rx="10" ry="8" fill="#F5F5F5"/><circle cx="44" cy="46" r="3" fill="#1A1A1A"/><circle cx="76" cy="50" r="3" fill="#1A1A1A"/><path d="M42,76 Q52,84 60,78 Q68,84 78,76" fill="none" stroke="#D32F2F" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'thanos', nombre: 'Thanos', categoria: 'heroes',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#4A148C"/><path d="M26,44 Q26,14 60,10 Q94,14 94,44 L94,80 Q94,106 60,110 Q26,106 26,80 Z" fill="#9C27B0"/><path d="M28,44 Q28,20 60,16 Q92,20 92,44 Q82,26 60,22 Q38,26 28,44" fill="#FFD700"/><line x1="44" y1="82" x2="44" y2="100" stroke="#7B1FA2" stroke-width="2"/><line x1="52" y1="84" x2="52" y2="102" stroke="#7B1FA2" stroke-width="2"/><line x1="60" y1="84" x2="60" y2="104" stroke="#7B1FA2" stroke-width="2"/><line x1="68" y1="84" x2="68" y2="102" stroke="#7B1FA2" stroke-width="2"/><line x1="76" y1="82" x2="76" y2="100" stroke="#7B1FA2" stroke-width="2"/><rect x="36" y="50" width="16" height="10" rx="2" fill="#E3F2FD"/><rect x="68" y="50" width="16" height="10" rx="2" fill="#E3F2FD"/><rect x="38" y="52" width="12" height="6" rx="1" fill="#42A5F5"/><rect x="70" y="52" width="12" height="6" rx="1" fill="#42A5F5"/><path d="M54,66 L60,74 L66,66" fill="#7B1FA2"/><path d="M44,82 L76,82" stroke="#6A1B9A" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'venom', nombre: 'Venom', categoria: 'heroes',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#1A1A1A"/><path d="M22,40 Q22,10 60,6 Q98,10 98,40 L98,76 Q98,106 60,110 Q22,106 22,76 Z" fill="#212121"/><path d="M26,42 L44,26 L56,46 L46,60 L26,56 Z" fill="#F5F5F5"/><path d="M94,42 L76,26 L64,46 L74,60 L94,56 Z" fill="#F5F5F5"/><path d="M24,70 Q60,62 96,70 Q60,106 24,70" fill="#212121" stroke="#333" stroke-width="1"/><polygon points="30,70 36,84 42,70" fill="#F5F5F5"/><polygon points="42,68 48,86 54,68" fill="#F5F5F5"/><polygon points="54,66 58,88 62,66" fill="#F5F5F5"/><polygon points="66,68 72,86 78,68" fill="#F5F5F5"/><polygon points="78,70 84,84 90,70" fill="#F5F5F5"/><path d="M52,86 Q56,100 64,86" fill="#E53935"/></svg>`,
  },
  // ═══════════════════════════════════════════════════════════
  // DISNEY (8) — Mickey reemplazado con Mike Wazowski
  // ═══════════════════════════════════════════════════════════
  {
    id: 'mike', nombre: 'Mike W.', categoria: 'disney',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#8BC34A"/><circle cx="60" cy="60" r="36" fill="#66BB6A"/><ellipse cx="48" cy="28" rx="5" ry="10" fill="#66BB6A"/><ellipse cx="72" cy="28" rx="5" ry="10" fill="#66BB6A"/><circle cx="60" cy="50" r="18" fill="#F5F5F5"/><circle cx="60" cy="50" r="12" fill="#4CAF50"/><circle cx="60" cy="50" r="6" fill="#1A1A1A"/><circle cx="63" cy="48" r="2" fill="#F5F5F5"/><path d="M38,76 Q60,92 82,76" fill="#1A1A1A"/><path d="M42,76 L46,80 L50,76 L54,80 L58,76 L62,80 L66,76 L70,80 L74,76 L78,80" fill="none" stroke="#F5F5F5" stroke-width="1.5"/></svg>`,
  },
  {
    id: 'stitch', nombre: 'Stitch', categoria: 'disney',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#42A5F5"/><ellipse cx="26" cy="36" rx="14" ry="24" fill="#1E88E5" transform="rotate(-20 26 36)"/><ellipse cx="94" cy="36" rx="14" ry="24" fill="#1E88E5" transform="rotate(20 94 36)"/><ellipse cx="26" cy="36" rx="8" ry="16" fill="#FFB5B5" transform="rotate(-20 26 36)"/><ellipse cx="94" cy="36" rx="8" ry="16" fill="#FFB5B5" transform="rotate(20 94 36)"/><ellipse cx="60" cy="64" rx="32" ry="30" fill="#2196F3"/><circle cx="44" cy="54" r="8" fill="#1A1A1A"/><circle cx="76" cy="54" r="8" fill="#1A1A1A"/><circle cx="46" cy="52" r="4" fill="#F5F5F5"/><circle cx="78" cy="52" r="4" fill="#F5F5F5"/><circle cx="47" cy="51" r="1.5" fill="#1A1A1A"/><circle cx="79" cy="51" r="1.5" fill="#1A1A1A"/><ellipse cx="60" cy="66" rx="4" ry="3" fill="#1565C0"/><path d="M38,76 Q60,90 82,76" fill="#1A1A1A"/><path d="M42,76 L46,80 L50,76 L54,80 L58,76 L62,80 L66,76 L70,80 L74,76 L78,80" fill="none" stroke="#F5F5F5" stroke-width="1.5"/></svg>`,
  },
  {
    id: 'osito', nombre: 'Pooh', categoria: 'disney',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#FFD93D"/><circle cx="36" cy="28" r="14" fill="#E6A817"/><circle cx="36" cy="28" r="9" fill="#F5C842"/><circle cx="84" cy="28" r="14" fill="#E6A817"/><circle cx="84" cy="28" r="9" fill="#F5C842"/><ellipse cx="60" cy="60" rx="34" ry="36" fill="#F5C842"/><circle cx="46" cy="50" r="3.5" fill="#1A1A1A"/><circle cx="74" cy="50" r="3.5" fill="#1A1A1A"/><circle cx="45" cy="49" r="1" fill="#fff"/><circle cx="73" cy="49" r="1" fill="#fff"/><ellipse cx="60" cy="62" rx="8" ry="6" fill="#E6A817"/><ellipse cx="60" cy="60" rx="4" ry="3" fill="#1A1A1A"/><path d="M56,66 Q60,72 64,66" fill="none" stroke="#1A1A1A" stroke-width="1.5" stroke-linecap="round"/><path d="M32,82 L88,82 Q88,100 60,102 Q32,100 32,82" fill="#E53935"/></svg>`,
  },
  {
    id: 'grogu', nombre: 'Grogu', categoria: 'disney',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#558B2F"/><path d="M38,72 Q38,60 60,56 Q82,60 82,72 L84,104 L36,104 Z" fill="#795548"/><path d="M42,74 Q42,64 60,60 Q78,64 78,74 L80,104 L40,104 Z" fill="#8D6E63"/><circle cx="60" cy="52" r="22" fill="#8BC34A"/><ellipse cx="20" cy="50" rx="24" ry="10" fill="#8BC34A"/><ellipse cx="100" cy="50" rx="24" ry="10" fill="#8BC34A"/><ellipse cx="20" cy="50" rx="20" ry="7" fill="#9CCC65"/><ellipse cx="100" cy="50" rx="20" ry="7" fill="#9CCC65"/><circle cx="52" cy="48" r="7" fill="#1A1A1A"/><circle cx="68" cy="48" r="7" fill="#1A1A1A"/><circle cx="50" cy="46" r="2.5" fill="#F5F5F5"/><circle cx="66" cy="46" r="2.5" fill="#F5F5F5"/><path d="M56,62 Q60,66 64,62" fill="none" stroke="#689F38" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'baymax', nombre: 'Baymax', categoria: 'disney',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#ECEFF1"/><ellipse cx="60" cy="62" rx="36" ry="38" fill="#F5F5F5"/><ellipse cx="60" cy="46" rx="28" ry="22" fill="#FAFAFA"/><circle cx="48" cy="44" r="4" fill="#333"/><circle cx="72" cy="44" r="4" fill="#333"/><line x1="52" y1="44" x2="68" y2="44" stroke="#333" stroke-width="2" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'olaf', nombre: 'Olaf', categoria: 'disney',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#90CAF9"/><ellipse cx="60" cy="84" rx="22" ry="18" fill="#F5F5F5"/><circle cx="60" cy="48" r="24" fill="#FAFAFA"/><line x1="54" y1="24" x2="52" y2="10" stroke="#795548" stroke-width="2.5" stroke-linecap="round"/><line x1="60" y1="24" x2="60" y2="8" stroke="#795548" stroke-width="2.5" stroke-linecap="round"/><line x1="66" y1="24" x2="68" y2="10" stroke="#795548" stroke-width="2.5" stroke-linecap="round"/><circle cx="50" cy="42" r="3.5" fill="#1A1A1A"/><circle cx="70" cy="42" r="3.5" fill="#1A1A1A"/><circle cx="49" cy="41" r="1.2" fill="#fff"/><circle cx="69" cy="41" r="1.2" fill="#fff"/><polygon points="60,50 50,56 60,58" fill="#FF9800"/><path d="M44,62 Q60,76 76,62" fill="none" stroke="#1A1A1A" stroke-width="2" stroke-linecap="round"/><rect x="56" y="62" width="3" height="4" rx="1" fill="#F5F5F5"/><rect x="61" y="62" width="3" height="4" rx="1" fill="#F5F5F5"/><circle cx="60" cy="78" r="2.5" fill="#1A1A1A"/><circle cx="60" cy="88" r="2.5" fill="#1A1A1A"/></svg>`,
  },
  {
    id: 'jack', nombre: 'Jack', categoria: 'disney',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#37474F"/><ellipse cx="60" cy="46" rx="28" ry="34" fill="#F5F5F5"/><circle cx="46" cy="40" r="10" fill="#1A1A1A"/><circle cx="74" cy="40" r="10" fill="#1A1A1A"/><path d="M58,54 L60,58 L62,54" fill="#1A1A1A"/><path d="M34,64 Q60,80 86,64" fill="none" stroke="#1A1A1A" stroke-width="2.5"/><line x1="36" y1="64" x2="36" y2="60" stroke="#1A1A1A" stroke-width="1.5"/><line x1="44" y1="68" x2="44" y2="64" stroke="#1A1A1A" stroke-width="1.5"/><line x1="52" y1="72" x2="52" y2="68" stroke="#1A1A1A" stroke-width="1.5"/><line x1="60" y1="72" x2="60" y2="68" stroke="#1A1A1A" stroke-width="1.5"/><line x1="68" y1="72" x2="68" y2="68" stroke="#1A1A1A" stroke-width="1.5"/><line x1="76" y1="68" x2="76" y2="64" stroke="#1A1A1A" stroke-width="1.5"/><line x1="84" y1="64" x2="84" y2="60" stroke="#1A1A1A" stroke-width="1.5"/><rect x="56" y="78" width="8" height="12" fill="#F5F5F5"/><polygon points="48,88 60,94 72,88 60,100" fill="#1A1A1A"/></svg>`,
  },
  {
    id: 'elsa', nombre: 'Elsa', categoria: 'disney',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#90CAF9"/><path d="M28,48 Q28,16 60,12 Q92,16 92,48 L92,58 L28,58 Z" fill="#E3F2FD"/><path d="M40,58 Q30,70 34,84 Q36,94 44,104" stroke="#E3F2FD" stroke-width="10" stroke-linecap="round" fill="none"/><path d="M40,58 Q32,70 36,84 Q38,94 46,104" stroke="#BBDEFB" stroke-width="6" stroke-linecap="round" fill="none"/><circle cx="60" cy="58" r="26" fill="#FFE0BD"/><path d="M34,48 Q34,28 60,24 Q86,28 86,48 Q78,32 60,30 Q42,32 34,48" fill="#E3F2FD"/><circle cx="50" cy="56" r="3.5" fill="#42A5F5"/><circle cx="70" cy="56" r="3.5" fill="#42A5F5"/><circle cx="49" cy="55" r="1.2" fill="#fff"/><circle cx="69" cy="55" r="1.2" fill="#fff"/><path d="M55,70 Q60,74 65,70" fill="#FF8FAB"/><circle cx="84" cy="26" r="3" fill="#E3F2FD" opacity="0.7"/><circle cx="18" cy="38" r="2" fill="#E3F2FD" opacity="0.5"/><circle cx="92" cy="48" r="2.5" fill="#E3F2FD" opacity="0.6"/><path d="M38,82 Q60,74 82,82" fill="#42A5F5"/></svg>`,
  },
  // ═══════════════════════════════════════════════════════════
  // CARITAS (6) — emoji-style faces
  // ═══════════════════════════════════════════════════════════
  {
    id: 'feliz', nombre: 'Feliz', categoria: 'caritas',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#FDD835"/><circle cx="60" cy="60" r="38" fill="#FFEE58"/><circle cx="46" cy="50" r="4" fill="#1A1A1A"/><circle cx="74" cy="50" r="4" fill="#1A1A1A"/><path d="M38,66 Q60,84 82,66" fill="none" stroke="#1A1A1A" stroke-width="3" stroke-linecap="round"/><ellipse cx="38" cy="62" rx="5" ry="3" fill="#FF8FAB" opacity="0.3"/><ellipse cx="82" cy="62" rx="5" ry="3" fill="#FF8FAB" opacity="0.3"/></svg>`,
  },
  {
    id: 'cool', nombre: 'Cool', categoria: 'caritas',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#FDD835"/><circle cx="60" cy="60" r="38" fill="#FFEE58"/><rect x="28" y="46" width="26" height="16" rx="4" fill="#1A1A1A"/><rect x="66" y="46" width="26" height="16" rx="4" fill="#1A1A1A"/><line x1="54" y1="54" x2="66" y2="54" stroke="#1A1A1A" stroke-width="2.5"/><path d="M42,74 Q60,84 78,74" fill="none" stroke="#1A1A1A" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'amor', nombre: 'Amor', categoria: 'caritas',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#FDD835"/><circle cx="60" cy="60" r="38" fill="#FFEE58"/><path d="M34,48 C34,40 44,40 44,48 C44,40 54,40 54,48 C54,58 44,62 44,62 C44,62 34,58 34,48 Z" fill="#E53935"/><path d="M66,48 C66,40 76,40 76,48 C76,40 86,40 86,48 C86,58 76,62 76,62 C76,62 66,58 66,48 Z" fill="#E53935"/><path d="M42,70 Q60,86 78,70" fill="#1A1A1A"/></svg>`,
  },
  {
    id: 'risa', nombre: 'Risa', categoria: 'caritas',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#FDD835"/><circle cx="60" cy="60" r="38" fill="#FFEE58"/><path d="M34,50 Q44,42 54,50" fill="none" stroke="#1A1A1A" stroke-width="3" stroke-linecap="round"/><path d="M66,50 Q76,42 86,50" fill="none" stroke="#1A1A1A" stroke-width="3" stroke-linecap="round"/><path d="M38,68 Q60,90 82,68" fill="#1A1A1A"/><path d="M40,68 Q60,74 80,68" fill="#F5F5F5"/><path d="M84,52 Q88,60 86,66" fill="#42A5F5"/></svg>`,
  },
  {
    id: 'guino', nombre: 'Guiño', categoria: 'caritas',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#FDD835"/><circle cx="60" cy="60" r="38" fill="#FFEE58"/><circle cx="42" cy="50" r="4" fill="#1A1A1A"/><path d="M68,50 Q78,44 88,50" fill="none" stroke="#1A1A1A" stroke-width="3" stroke-linecap="round"/><path d="M40,70 Q60,82 80,70" fill="none" stroke="#1A1A1A" stroke-width="2.5" stroke-linecap="round"/><path d="M56,74 Q60,84 64,74" fill="#E53935"/></svg>`,
  },
  {
    id: 'dormido', nombre: 'Dormido', categoria: 'caritas',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#FDD835"/><circle cx="60" cy="60" r="38" fill="#FFEE58"/><path d="M34,52 Q44,58 54,52" fill="none" stroke="#1A1A1A" stroke-width="3" stroke-linecap="round"/><path d="M66,52 Q76,58 86,52" fill="none" stroke="#1A1A1A" stroke-width="3" stroke-linecap="round"/><ellipse cx="60" cy="74" rx="6" ry="5" fill="#1A1A1A"/><path d="M82,38 L92,38 L82,48 L92,48" fill="none" stroke="#42A5F5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M92,28 L100,28 L92,36 L100,36" fill="none" stroke="#42A5F5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  // ═══════════════════════════════════════════════════════════
  // COMIDA (10)
  // ═══════════════════════════════════════════════════════════
  {
    id: 'paleta', nombre: 'Paleta', categoria: 'comida',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#A8E6CF"/><rect x="56" y="74" width="8" height="24" rx="3" fill="#C4956A"/><path d="M43,30 Q43,20 53,20 L67,20 Q77,20 77,30 L77,74 L43,74 Z" fill="#FFE066"/><rect x="43" y="20" width="34" height="22" rx="10" fill="#FF6B8A"/><rect x="43" y="40" width="34" height="16" fill="#7EC8E3"/><rect x="49" y="26" width="5" height="12" rx="2.5" fill="rgba(255,255,255,0.4)"/></svg>`,
  },
  {
    id: 'hotdog', nombre: 'Hot Dog', categoria: 'comida',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#F4845F"/><ellipse cx="60" cy="64" rx="36" ry="16" fill="#E8C170"/><path d="M24,60 Q24,44 60,44 Q96,44 96,60" fill="#DEAE54"/><ellipse cx="60" cy="58" rx="40" ry="9" fill="#D94F4F"/><polyline points="32,54 40,47 48,54 56,47 64,54 72,47 80,54 88,47" fill="none" stroke="#FFD93D" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    id: 'helado', nombre: 'Helado', categoria: 'comida',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#FFD1DC"/><polygon points="45,58 75,58 60,98" fill="#D4A56A"/><line x1="45" y1="68" x2="75" y2="68" stroke="#C4956A" stroke-width="1"/><line x1="47" y1="78" x2="73" y2="78" stroke="#C4956A" stroke-width="1"/><circle cx="60" cy="46" r="20" fill="#FF8FAB"/><circle cx="60" cy="42" r="16" fill="#FFA0BC"/><circle cx="53" cy="38" r="3" fill="rgba(255,255,255,0.45)"/><circle cx="60" cy="28" r="4" fill="#E74C3C"/><rect x="59" y="22" width="2" height="6" rx="1" fill="#4CAF50"/></svg>`,
  },
  {
    id: 'galleta', nombre: 'Galleta', categoria: 'comida',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#FFE5A0"/><circle cx="60" cy="60" r="34" fill="#D4944C"/><circle cx="60" cy="60" r="32" fill="#E0A85C"/><circle cx="48" cy="48" r="4" fill="#5D3A1A"/><circle cx="68" cy="44" r="3.5" fill="#5D3A1A"/><circle cx="54" cy="66" r="4" fill="#5D3A1A"/><circle cx="72" cy="64" r="3" fill="#5D3A1A"/><circle cx="42" cy="60" r="3" fill="#5D3A1A"/><circle cx="62" cy="54" r="3.5" fill="#5D3A1A"/><circle cx="50" cy="78" r="3" fill="#5D3A1A"/><circle cx="68" cy="76" r="3.5" fill="#5D3A1A"/></svg>`,
  },
  {
    id: 'pizza', nombre: 'Pizza', categoria: 'comida',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#FFB347"/><path d="M60,22 L92,92 L28,92 Z" fill="#FFD93D"/><path d="M28,92 Q60,98 92,92" fill="#D4944C" stroke="#C4856A" stroke-width="1"/><circle cx="52" cy="62" r="6" fill="#E74C3C"/><circle cx="68" cy="72" r="5" fill="#E74C3C"/><circle cx="58" cy="78" r="5.5" fill="#E74C3C"/><circle cx="60" cy="50" r="4" fill="#E74C3C"/><circle cx="50" cy="72" r="2" fill="#4CAF50"/><circle cx="72" cy="82" r="2" fill="#4CAF50"/></svg>`,
  },
  {
    id: 'palomitas', nombre: 'Palomitas', categoria: 'comida',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#E74C3C"/><path d="M36,50 L30,95 L90,95 L84,50 Z" fill="#D42B2B"/><rect x="36" y="48" width="48" height="8" rx="2" fill="#F5F5F5"/><rect x="30" y="56" width="6" height="39" fill="#F5F5F5" transform="rotate(4 33 75)"/><rect x="84" y="56" width="6" height="39" fill="#F5F5F5" transform="rotate(-4 87 75)"/><rect x="52" y="50" width="5" height="45" fill="#F5F5F5"/><circle cx="45" cy="42" r="10" fill="#FFF8DC"/><circle cx="60" cy="36" r="11" fill="#FFFACD"/><circle cx="75" cy="42" r="10" fill="#FFF8DC"/><circle cx="52" cy="30" r="9" fill="#FFFACD"/><circle cx="68" cy="30" r="9" fill="#FFF8DC"/><circle cx="60" cy="24" r="8" fill="#FFFACD"/></svg>`,
  },
  {
    id: 'dona', nombre: 'Dona', categoria: 'comida',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#FFDAB9"/><circle cx="60" cy="62" r="32" fill="#D4944C"/><circle cx="60" cy="62" r="12" fill="#FFDAB9"/><path d="M28,58 Q30,40 60,36 Q90,40 92,58 Q88,52 60,50 Q32,52 28,58" fill="#FF8FAB"/><circle cx="42" cy="44" r="2.5" fill="#FFD93D"/><circle cx="72" cy="42" r="2" fill="#7ED957"/><circle cx="56" cy="38" r="2" fill="#FF6B8A"/><circle cx="82" cy="52" r="2" fill="#FFD93D"/><circle cx="38" cy="54" r="1.8" fill="#81D4FA"/><circle cx="66" cy="40" r="2.2" fill="#81D4FA"/><circle cx="50" cy="42" r="1.8" fill="#7ED957"/></svg>`,
  },
  {
    id: 'hamburguesa', nombre: 'Burger', categoria: 'comida',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#A1887F"/><path d="M28,54 Q28,36 60,34 Q92,36 92,54 Z" fill="#E8AA5C"/><circle cx="42" cy="44" r="2" fill="#D4944C"/><circle cx="58" cy="40" r="2" fill="#D4944C"/><circle cx="74" cy="44" r="2" fill="#D4944C"/><rect x="26" y="54" width="68" height="8" rx="2" fill="#4CAF50"/><rect x="28" y="62" width="64" height="8" fill="#D4944C"/><rect x="28" y="70" width="64" height="6" fill="#FFD93D"/><rect x="30" y="76" width="60" height="8" rx="4" fill="#E8AA5C"/></svg>`,
  },
  {
    id: 'taco', nombre: 'Taco', categoria: 'comida',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#FFF9C4"/><path d="M16,72 Q60,20 104,72" fill="#E8C170" stroke="#D4A56A" stroke-width="2"/><path d="M20,70 Q60,28 100,70" fill="#DEAE54"/><ellipse cx="46" cy="58" rx="10" ry="8" fill="#8BC34A"/><ellipse cx="66" cy="56" rx="8" ry="7" fill="#E74C3C"/><ellipse cx="56" cy="52" rx="7" ry="6" fill="#FF9800"/><ellipse cx="76" cy="60" rx="8" ry="7" fill="#8BC34A"/><ellipse cx="38" cy="62" rx="6" ry="5" fill="#FF9800"/><circle cx="50" cy="48" r="3" fill="#FFD93D"/><circle cx="70" cy="50" r="2.5" fill="#FFD93D"/></svg>`,
  },
  {
    id: 'sushi', nombre: 'Sushi', categoria: 'comida',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#BBDEFB"/><ellipse cx="60" cy="66" rx="34" ry="24" fill="#1A1A1A"/><ellipse cx="60" cy="62" rx="34" ry="24" fill="#F5F5F5"/><ellipse cx="60" cy="58" rx="28" ry="18" fill="#FF8A65"/><ellipse cx="60" cy="56" rx="24" ry="14" fill="#FFAB91"/><circle cx="50" cy="50" r="2.5" fill="#1A1A1A"/><circle cx="70" cy="50" r="2.5" fill="#1A1A1A"/><circle cx="49" cy="49" r="0.8" fill="#fff"/><circle cx="69" cy="49" r="0.8" fill="#fff"/><path d="M56,58 Q60,62 64,58" fill="none" stroke="#E64A19" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  },
  // ═══════════════════════════════════════════════════════════
  // ANIMALES (8) — centrado arreglado
  // ═══════════════════════════════════════════════════════════
  {
    id: 'gato', nombre: 'Gato', categoria: 'animales',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#7B68AE"/><polygon points="30,54 26,24 48,46" fill="#1A1A1A"/><polygon points="90,54 94,24 72,46" fill="#1A1A1A"/><polygon points="30,54 28,28 46,46" fill="#333"/><polygon points="90,54 92,28 74,46" fill="#333"/><circle cx="60" cy="66" r="28" fill="#1A1A1A"/><ellipse cx="46" cy="60" rx="8" ry="9" fill="#7ED957"/><ellipse cx="74" cy="60" rx="8" ry="9" fill="#7ED957"/><ellipse cx="46" cy="60" rx="3" ry="8" fill="#1A1A1A"/><ellipse cx="74" cy="60" rx="3" ry="8" fill="#1A1A1A"/><ellipse cx="60" cy="74" rx="4" ry="3" fill="#FF8FAB"/><path d="M56,78 Q60,82 64,78" fill="none" stroke="#555" stroke-width="1.5" stroke-linecap="round"/><line x1="28" y1="68" x2="42" y2="70" stroke="#555" stroke-width="1.2"/><line x1="28" y1="74" x2="42" y2="73" stroke="#555" stroke-width="1.2"/><line x1="92" y1="68" x2="78" y2="70" stroke="#555" stroke-width="1.2"/><line x1="92" y1="74" x2="78" y2="73" stroke="#555" stroke-width="1.2"/></svg>`,
  },
  {
    id: 'panda', nombre: 'Panda', categoria: 'animales',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#E0E0E0"/><circle cx="36" cy="34" r="14" fill="#1A1A1A"/><circle cx="84" cy="34" r="14" fill="#1A1A1A"/><circle cx="60" cy="62" r="32" fill="#F5F5F5"/><ellipse cx="44" cy="54" rx="12" ry="10" fill="#1A1A1A"/><ellipse cx="76" cy="54" rx="12" ry="10" fill="#1A1A1A"/><circle cx="44" cy="54" r="4" fill="#F5F5F5"/><circle cx="76" cy="54" r="4" fill="#F5F5F5"/><circle cx="45" cy="53" r="2" fill="#1A1A1A"/><circle cx="77" cy="53" r="2" fill="#1A1A1A"/><ellipse cx="60" cy="68" rx="6" ry="4" fill="#1A1A1A"/><path d="M54,74 Q60,79 66,74" fill="none" stroke="#1A1A1A" stroke-width="1.5" stroke-linecap="round"/><ellipse cx="48" cy="64" rx="4" ry="2.5" fill="#FFB5B5" opacity="0.35"/><ellipse cx="72" cy="64" rx="4" ry="2.5" fill="#FFB5B5" opacity="0.35"/></svg>`,
  },
  {
    id: 'zorro', nombre: 'Zorro', categoria: 'animales',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#FFCC80"/><polygon points="26,30 36,60 20,60" fill="#E65100"/><polygon points="94,30 84,60 100,60" fill="#E65100"/><polygon points="28,32 36,58 22,58" fill="#FF9800"/><polygon points="92,32 84,58 98,58" fill="#FF9800"/><circle cx="60" cy="66" r="28" fill="#FF9800"/><path d="M32,72 Q60,102 88,72" fill="#F5F5F5"/><circle cx="46" cy="60" r="4" fill="#1A1A1A"/><circle cx="74" cy="60" r="4" fill="#1A1A1A"/><circle cx="45" cy="59" r="1.2" fill="#fff"/><circle cx="73" cy="59" r="1.2" fill="#fff"/><ellipse cx="60" cy="72" rx="5" ry="3.5" fill="#1A1A1A"/><path d="M55,76 Q60,80 65,76" fill="none" stroke="#BF360C" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'leon', nombre: 'Leon', categoria: 'animales',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#FFE0B2"/><circle cx="60" cy="60" r="38" fill="#E65100"/><circle cx="60" cy="60" r="36" fill="#FF9800"/><circle cx="60" cy="62" r="26" fill="#FFCC80"/><circle cx="48" cy="56" r="3" fill="#1A1A1A"/><circle cx="72" cy="56" r="3" fill="#1A1A1A"/><circle cx="47" cy="55" r="1" fill="#fff"/><circle cx="71" cy="55" r="1" fill="#fff"/><ellipse cx="60" cy="66" rx="5" ry="4" fill="#E65100"/><path d="M55,66 L60,72 L65,66" fill="#E65100"/><path d="M54,76 Q60,82 66,76" fill="none" stroke="#BF360C" stroke-width="1.5" stroke-linecap="round"/><line x1="38" y1="64" x2="48" y2="66" stroke="#BF360C" stroke-width="1.2"/><line x1="38" y1="70" x2="48" y2="69" stroke="#BF360C" stroke-width="1.2"/><line x1="82" y1="64" x2="72" y2="66" stroke="#BF360C" stroke-width="1.2"/><line x1="82" y1="70" x2="72" y2="69" stroke="#BF360C" stroke-width="1.2"/></svg>`,
  },
  {
    id: 'conejo', nombre: 'Conejo', categoria: 'animales',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#F8BBD0"/><ellipse cx="44" cy="30" rx="10" ry="20" fill="#F5F5F5"/><ellipse cx="76" cy="30" rx="10" ry="20" fill="#F5F5F5"/><ellipse cx="44" cy="30" rx="6" ry="14" fill="#FFB5B5"/><ellipse cx="76" cy="30" rx="6" ry="14" fill="#FFB5B5"/><circle cx="60" cy="68" r="28" fill="#F5F5F5"/><circle cx="48" cy="62" r="3" fill="#1A1A1A"/><circle cx="72" cy="62" r="3" fill="#1A1A1A"/><circle cx="47" cy="61" r="1" fill="#fff"/><circle cx="71" cy="61" r="1" fill="#fff"/><ellipse cx="60" cy="72" rx="4" ry="3" fill="#FFB5B5"/><path d="M56,76 Q60,80 64,76" fill="none" stroke="#C0825A" stroke-width="1.5" stroke-linecap="round"/><circle cx="60" cy="90" r="6" fill="#F5F5F5"/></svg>`,
  },
  {
    id: 'koala', nombre: 'Koala', categoria: 'animales',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#B0BEC5"/><circle cx="34" cy="40" r="16" fill="#78909C"/><circle cx="34" cy="40" r="10" fill="#FFB5B5"/><circle cx="86" cy="40" r="16" fill="#78909C"/><circle cx="86" cy="40" r="10" fill="#FFB5B5"/><circle cx="60" cy="62" r="30" fill="#78909C"/><ellipse cx="60" cy="72" rx="18" ry="14" fill="#ECEFF1"/><circle cx="48" cy="56" r="3.5" fill="#1A1A1A"/><circle cx="72" cy="56" r="3.5" fill="#1A1A1A"/><circle cx="47" cy="55" r="1.2" fill="#fff"/><circle cx="71" cy="55" r="1.2" fill="#fff"/><ellipse cx="60" cy="66" rx="7" ry="5" fill="#1A1A1A"/><path d="M56,74 Q60,78 64,74" fill="none" stroke="#546E7A" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'pinguino', nombre: 'Pinguino', categoria: 'animales',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#87CEEB"/><ellipse cx="60" cy="62" rx="30" ry="34" fill="#1A1A1A"/><ellipse cx="60" cy="68" rx="20" ry="24" fill="#F5F5F5"/><circle cx="48" cy="50" r="5" fill="#F5F5F5"/><circle cx="72" cy="50" r="5" fill="#F5F5F5"/><circle cx="48" cy="50" r="2.5" fill="#1A1A1A"/><circle cx="72" cy="50" r="2.5" fill="#1A1A1A"/><polygon points="60,56 54,64 66,64" fill="#FF9800"/><ellipse cx="48" cy="88" rx="8" ry="4" fill="#FF9800"/><ellipse cx="72" cy="88" rx="8" ry="4" fill="#FF9800"/><path d="M28,58 Q24,72 32,78" fill="none" stroke="#1A1A1A" stroke-width="6" stroke-linecap="round"/><path d="M92,58 Q96,72 88,78" fill="none" stroke="#1A1A1A" stroke-width="6" stroke-linecap="round"/><ellipse cx="42" cy="56" rx="4" ry="2.5" fill="#FFB5B5" opacity="0.4"/><ellipse cx="78" cy="56" rx="4" ry="2.5" fill="#FFB5B5" opacity="0.4"/></svg>`,
  },
  {
    id: 'dinosaurio', nombre: 'Dino', categoria: 'animales',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#A5D6A7"/><circle cx="60" cy="66" r="28" fill="#4CAF50"/><polygon points="42,38 48,26 54,38" fill="#66BB6A"/><polygon points="54,34 60,22 66,34" fill="#66BB6A"/><polygon points="66,38 72,26 78,38" fill="#66BB6A"/><circle cx="46" cy="58" r="6" fill="#F5F5F5"/><circle cx="74" cy="58" r="6" fill="#F5F5F5"/><circle cx="48" cy="58" r="3" fill="#1A1A1A"/><circle cx="76" cy="58" r="3" fill="#1A1A1A"/><circle cx="47" cy="57" r="1" fill="#fff"/><circle cx="75" cy="57" r="1" fill="#fff"/><ellipse cx="36" cy="70" rx="6" ry="4" fill="#388E3C"/><ellipse cx="84" cy="70" rx="6" ry="4" fill="#388E3C"/><path d="M46,80 L50,76 L54,80 L58,76 L62,80 L66,76 L70,80 L74,76" fill="none" stroke="#F5F5F5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  // ═══════════════════════════════════════════════════════════
  // NATURALEZA (6)
  // ═══════════════════════════════════════════════════════════
  {
    id: 'sol', nombre: 'Sol', categoria: 'naturaleza',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#FFF9C4"/><line x1="60" y1="12" x2="60" y2="26" stroke="#FFB300" stroke-width="3" stroke-linecap="round"/><line x1="60" y1="94" x2="60" y2="108" stroke="#FFB300" stroke-width="3" stroke-linecap="round"/><line x1="12" y1="60" x2="26" y2="60" stroke="#FFB300" stroke-width="3" stroke-linecap="round"/><line x1="94" y1="60" x2="108" y2="60" stroke="#FFB300" stroke-width="3" stroke-linecap="round"/><line x1="26" y1="26" x2="36" y2="36" stroke="#FFB300" stroke-width="3" stroke-linecap="round"/><line x1="84" y1="26" x2="94" y2="36" stroke="#FFB300" stroke-width="3" stroke-linecap="round"/><line x1="26" y1="94" x2="36" y2="84" stroke="#FFB300" stroke-width="3" stroke-linecap="round"/><line x1="84" y1="94" x2="94" y2="84" stroke="#FFB300" stroke-width="3" stroke-linecap="round"/><circle cx="60" cy="60" r="28" fill="#FFD54F"/><circle cx="48" cy="54" r="3" fill="#1A1A1A"/><circle cx="72" cy="54" r="3" fill="#1A1A1A"/><path d="M48,70 Q60,80 72,70" fill="none" stroke="#F57F17" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="42" cy="64" rx="4" ry="2.5" fill="#FFB5B5" opacity="0.35"/><ellipse cx="78" cy="64" rx="4" ry="2.5" fill="#FFB5B5" opacity="0.35"/></svg>`,
  },
  {
    id: 'hongo', nombre: 'Hongo', categoria: 'naturaleza',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#FFCDD2"/><rect x="46" y="68" width="28" height="28" rx="6" fill="#FFF8E1"/><path d="M24,70 Q24,30 60,28 Q96,30 96,70 Z" fill="#F44336"/><circle cx="44" cy="46" r="5" fill="#F5F5F5"/><circle cx="70" cy="40" r="4.5" fill="#F5F5F5"/><circle cx="82" cy="56" r="4" fill="#F5F5F5"/><circle cx="54" cy="58" r="3.5" fill="#F5F5F5"/><circle cx="52" cy="80" r="2.5" fill="#1A1A1A"/><circle cx="68" cy="80" r="2.5" fill="#1A1A1A"/><path d="M56,88 Q60,92 64,88" fill="none" stroke="#C0825A" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'flor', nombre: 'Flor', categoria: 'naturaleza',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#F3E5F5"/><circle cx="60" cy="34" r="14" fill="#FF8FAB"/><circle cx="82" cy="50" r="14" fill="#FF8FAB"/><circle cx="76" cy="74" r="14" fill="#FF8FAB"/><circle cx="44" cy="74" r="14" fill="#FF8FAB"/><circle cx="38" cy="50" r="14" fill="#FF8FAB"/><circle cx="60" cy="58" r="16" fill="#FFD93D"/><circle cx="54" cy="54" r="2.5" fill="#1A1A1A"/><circle cx="66" cy="54" r="2.5" fill="#1A1A1A"/><path d="M55,62 Q60,66 65,62" fill="none" stroke="#F57F17" stroke-width="1.5" stroke-linecap="round"/><ellipse cx="50" cy="58" rx="3" ry="2" fill="#FFB5B5" opacity="0.3"/><ellipse cx="70" cy="58" rx="3" ry="2" fill="#FFB5B5" opacity="0.3"/></svg>`,
  },
  {
    id: 'nube', nombre: 'Nube', categoria: 'naturaleza',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#E3F2FD"/><circle cx="44" cy="58" r="20" fill="#F5F5F5"/><circle cx="68" cy="52" r="22" fill="#F5F5F5"/><circle cx="84" cy="60" r="16" fill="#F5F5F5"/><rect x="34" y="58" width="56" height="20" rx="10" fill="#F5F5F5"/><circle cx="50" cy="58" r="2.5" fill="#1A1A1A"/><circle cx="70" cy="56" r="2.5" fill="#1A1A1A"/><path d="M56,66 Q62,72 68,66" fill="none" stroke="#90A4AE" stroke-width="1.5" stroke-linecap="round"/><ellipse cx="44" cy="64" rx="4" ry="2" fill="#FFB5B5" opacity="0.25"/><ellipse cx="76" cy="62" rx="4" ry="2" fill="#FFB5B5" opacity="0.25"/></svg>`,
  },
  {
    id: 'cactus', nombre: 'Cactus', categoria: 'naturaleza',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#C8E6C9"/><rect x="48" y="28" width="24" height="50" rx="12" fill="#4CAF50"/><rect x="26" y="44" width="22" height="12" rx="6" fill="#4CAF50"/><rect x="26" y="32" width="12" height="18" rx="6" fill="#4CAF50"/><rect x="72" y="50" width="22" height="12" rx="6" fill="#4CAF50"/><rect x="82" y="38" width="12" height="18" rx="6" fill="#4CAF50"/><circle cx="54" cy="50" r="2.5" fill="#1A1A1A"/><circle cx="66" cy="50" r="2.5" fill="#1A1A1A"/><path d="M56,60 Q60,64 64,60" fill="none" stroke="#2E7D32" stroke-width="1.5" stroke-linecap="round"/><path d="M40,82 L80,82 L76,100 L44,100 Z" fill="#A1887F"/><rect x="38" y="78" width="44" height="6" rx="2" fill="#8D6E63"/></svg>`,
  },
  {
    id: 'aguacate', nombre: 'Aguacate', categoria: 'naturaleza',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#C8E6C9"/><ellipse cx="60" cy="58" rx="28" ry="34" fill="#8BC34A"/><ellipse cx="60" cy="64" rx="24" ry="28" fill="#9CCC65"/><circle cx="60" cy="70" r="14" fill="#795548"/><circle cx="60" cy="70" r="12" fill="#8D6E63"/><circle cx="54" cy="66" r="2.5" fill="#1A1A1A"/><circle cx="66" cy="66" r="2.5" fill="#1A1A1A"/><path d="M56,76 Q60,80 64,76" fill="none" stroke="#5D4037" stroke-width="1.5" stroke-linecap="round"/><ellipse cx="50" cy="70" rx="3" ry="2" fill="#FFB5B5" opacity="0.25"/><ellipse cx="70" cy="70" rx="3" ry="2" fill="#FFB5B5" opacity="0.25"/></svg>`,
  },
  // ═══════════════════════════════════════════════════════════
  // PERSONAJES (8)
  // ═══════════════════════════════════════════════════════════
  {
    id: 'unicornio', nombre: 'Unicornio', categoria: 'personajes',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#E1BEE7"/><circle cx="60" cy="65" r="28" fill="#F5F5F5"/><circle cx="36" cy="48" r="10" fill="#F5F5F5"/><circle cx="84" cy="48" r="10" fill="#F5F5F5"/><circle cx="36" cy="48" r="6" fill="#FFB5B5"/><circle cx="84" cy="48" r="6" fill="#FFB5B5"/><polygon points="60,8 54,36 66,36" fill="#FFD700"/><polygon points="60,8 60,36 54,36" fill="#FFC107"/><circle cx="48" cy="60" r="3" fill="#1A1A1A"/><circle cx="72" cy="60" r="3" fill="#1A1A1A"/><circle cx="47" cy="59" r="1" fill="#fff"/><circle cx="71" cy="59" r="1" fill="#fff"/><path d="M55,72 Q60,77 65,72" fill="none" stroke="#C0825A" stroke-width="1.5" stroke-linecap="round"/><ellipse cx="44" cy="66" rx="4" ry="2.5" fill="#FFB5B5" opacity="0.4"/><ellipse cx="76" cy="66" rx="4" ry="2.5" fill="#FFB5B5" opacity="0.4"/><path d="M78,40 Q88,32 92,38 Q96,42 90,44" fill="#FF8FAB"/><path d="M86,34 Q92,28 96,34 Q98,40 94,40" fill="#C084FC"/><path d="M90,30 Q96,24 98,30 Q100,36 96,36" fill="#81D4FA"/></svg>`,
  },
  {
    id: 'mono', nombre: 'Mono', categoria: 'personajes',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#DEB887"/><circle cx="28" cy="56" r="14" fill="#8B5E3C"/><circle cx="28" cy="56" r="9" fill="#FFDAB9"/><circle cx="92" cy="56" r="14" fill="#8B5E3C"/><circle cx="92" cy="56" r="9" fill="#FFDAB9"/><circle cx="60" cy="60" r="32" fill="#8B5E3C"/><ellipse cx="60" cy="68" rx="22" ry="18" fill="#FFDAB9"/><circle cx="48" cy="52" r="3.5" fill="#1A1A1A"/><circle cx="72" cy="52" r="3.5" fill="#1A1A1A"/><circle cx="47" cy="51" r="1" fill="#fff"/><circle cx="71" cy="51" r="1" fill="#fff"/><ellipse cx="60" cy="66" rx="5" ry="3.5" fill="#C4956A"/><path d="M55,72 Q60,76 65,72" fill="none" stroke="#8B5E3C" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'alien', nombre: 'Alien', categoria: 'personajes',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#66BB6A"/><line x1="60" y1="16" x2="60" y2="30" stroke="#2E7D32" stroke-width="3" stroke-linecap="round"/><circle cx="60" cy="14" r="5" fill="#81C784"/><ellipse cx="60" cy="64" rx="30" ry="32" fill="#4CAF50"/><circle cx="60" cy="54" r="16" fill="#F5F5F5"/><circle cx="60" cy="54" r="10" fill="#1A1A1A"/><circle cx="63" cy="51" r="3" fill="#F5F5F5"/><path d="M44,76 Q52,86 60,82 Q68,86 76,76" fill="none" stroke="#2E7D32" stroke-width="2.5" stroke-linecap="round"/><rect x="42" y="78" width="4" height="3" rx="1" fill="#F5F5F5"/><rect x="50" y="80" width="4" height="3" rx="1" fill="#F5F5F5"/><rect x="58" y="80" width="4" height="3" rx="1" fill="#F5F5F5"/><rect x="66" y="80" width="4" height="3" rx="1" fill="#F5F5F5"/><rect x="74" y="78" width="4" height="3" rx="1" fill="#F5F5F5"/></svg>`,
  },
  {
    id: 'ninja', nombre: 'Ninja', categoria: 'personajes',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#37474F"/><circle cx="60" cy="60" r="30" fill="#1A1A1A"/><rect x="28" y="48" width="64" height="18" rx="4" fill="#333"/><circle cx="46" cy="56" r="5" fill="#F5F5F5"/><circle cx="74" cy="56" r="5" fill="#F5F5F5"/><circle cx="46" cy="56" r="2.5" fill="#1A1A1A"/><circle cx="74" cy="56" r="2.5" fill="#1A1A1A"/><circle cx="45" cy="55" r="0.8" fill="#fff"/><circle cx="73" cy="55" r="0.8" fill="#fff"/><rect x="28" y="50" width="64" height="3" rx="1" fill="#E74C3C"/><path d="M92,52 L102,48 L100,44" fill="none" stroke="#E74C3C" stroke-width="3" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'astronauta', nombre: 'Astronauta', categoria: 'personajes',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#283593"/><circle cx="60" cy="56" r="34" fill="#E0E0E0"/><circle cx="60" cy="56" r="30" fill="#BDBDBD"/><circle cx="60" cy="54" r="24" fill="#81D4FA"/><circle cx="60" cy="54" r="22" fill="#4FC3F7"/><circle cx="48" cy="50" r="3.5" fill="#1A1A1A"/><circle cx="72" cy="50" r="3.5" fill="#1A1A1A"/><circle cx="47" cy="49" r="1.2" fill="#fff"/><circle cx="71" cy="49" r="1.2" fill="#fff"/><path d="M54,60 Q60,65 66,60" fill="none" stroke="#1A1A1A" stroke-width="1.5" stroke-linecap="round"/><circle cx="52" cy="44" r="4" fill="rgba(255,255,255,0.3)"/><rect x="24" y="54" width="10" height="16" rx="5" fill="#E0E0E0"/><rect x="86" y="54" width="10" height="16" rx="5" fill="#E0E0E0"/><circle cx="60" cy="22" r="5" fill="#E74C3C"/></svg>`,
  },
  {
    id: 'pirata', nombre: 'Pirata', categoria: 'personajes',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#795548"/><circle cx="60" cy="64" r="28" fill="#FFE0BD"/><path d="M32,50 Q32,24 60,20 Q88,24 88,50" fill="#1A1A1A"/><rect x="30" y="44" width="60" height="6" rx="2" fill="#1A1A1A"/><circle cx="70" cy="58" r="3" fill="#1A1A1A"/><circle cx="69" cy="57" r="1" fill="#fff"/><ellipse cx="50" cy="58" rx="8" ry="7" fill="#1A1A1A"/><line x1="42" y1="51" x2="58" y2="51" stroke="#1A1A1A" stroke-width="2"/><path d="M54,74 Q60,80 66,74" fill="none" stroke="#C0825A" stroke-width="2" stroke-linecap="round"/><path d="M46,80 L42,92 Q44,96 48,92 L50,84" fill="#C0825A"/></svg>`,
  },
  {
    id: 'fantasma', nombre: 'Fantasma', categoria: 'personajes',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#5C6BC0"/><path d="M30,58 Q30,22 60,20 Q90,22 90,58 L90,92 L80,82 L70,92 L60,82 L50,92 L40,82 L30,92 Z" fill="#F5F5F5"/><path d="M32,58 Q32,24 60,22 Q88,24 88,58 L88,90 L80,82 L70,90 L60,82 L50,90 L40,82 L32,90 Z" fill="#FAFAFA"/><circle cx="48" cy="52" r="5" fill="#1A1A1A"/><circle cx="72" cy="52" r="5" fill="#1A1A1A"/><circle cx="46" cy="50" r="1.8" fill="#fff"/><circle cx="70" cy="50" r="1.8" fill="#fff"/><ellipse cx="60" cy="66" rx="5" ry="4" fill="#FF8FAB"/><ellipse cx="44" cy="60" rx="4" ry="2.5" fill="#FFB5B5" opacity="0.35"/><ellipse cx="76" cy="60" rx="4" ry="2.5" fill="#FFB5B5" opacity="0.35"/></svg>`,
  },
  {
    id: 'estrella', nombre: 'Estrella', categoria: 'personajes',
    svg: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="60" fill="#FFF176"/><polygon points="60,16 70,44 100,44 76,62 84,90 60,74 36,90 44,62 20,44 50,44" fill="#FFD93D"/><polygon points="60,20 68,44 96,44 74,60 82,86 60,72 38,86 46,60 24,44 52,44" fill="#FFEB3B"/><circle cx="50" cy="52" r="3" fill="#1A1A1A"/><circle cx="70" cy="52" r="3" fill="#1A1A1A"/><circle cx="49" cy="51" r="1" fill="#fff"/><circle cx="69" cy="51" r="1" fill="#fff"/><path d="M54,62 Q60,68 66,62" fill="none" stroke="#F57F17" stroke-width="2" stroke-linecap="round"/><ellipse cx="44" cy="56" rx="4" ry="2.5" fill="#FFB5B5" opacity="0.4"/><ellipse cx="76" cy="56" rx="4" ry="2.5" fill="#FFB5B5" opacity="0.4"/></svg>`,
  },
]

export const AVATAR_MAP = Object.fromEntries(AVATARS.map(a => [a.id, a]))
export function getAvatarById(id) { return AVATAR_MAP[id] || null }
