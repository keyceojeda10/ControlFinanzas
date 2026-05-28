// Mock data — Spanish LATAM, prestamistas, COP
const fmt = (n, opts = {}) => {
  const { dec = 0, sign = false } = opts;
  const v = Math.abs(n);
  const s = v.toLocaleString('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  if (sign) return (n < 0 ? '−' : '+') + s;
  return (n < 0 ? '−' : '') + s;
};

const CURRENCY = 'COP';

const KPIS = [
  { label: 'Cartera activa', value: 1842500000, delta: 4.2, deltaLabel: 'vs mes ant.', spark: [12,14,13,16,18,17,20,22,21,24,26,28,30,29,32], cur: '$' },
  { label: 'Cuotas por cobrar (hoy)', value: 38420000, delta: -2.1, deltaLabel: '12 cuotas', spark: [22,18,20,22,19,24,26,22,28,30,26,29,32,30,28], cur: '$' },
  { label: 'Mora total', value: 184320000, delta: 1.8, deltaLabel: '23 clientes', spark: [8,10,9,11,12,11,13,14,13,15,16,15,17,18,17], cur: '$' },
  { label: 'Recaudo del mes', value: 412800000, delta: 12.4, deltaLabel: 'meta 480M', spark: [4,6,8,10,12,15,18,22,26,30,34,38,42,46,48], cur: '$' },
];

const KPIS_DENSE = [
  ...KPIS,
  { label: 'Clientes activos', value: 1247, delta: 1.4, deltaLabel: '+18 mes', spark: [10,11,12,12,13,14,14,15,15,16,17,18,18,19,20], cur: '' },
  { label: 'Tasa promedio', value: 18.4, delta: 0.2, deltaLabel: 'efectiva mes', spark: [18,18,18,18,19,19,18,19,18,19,18,18,19,18,18], cur: '', suffix: '%' },
];

const TRANSACTIONS = [
  { id: 'TX-04821', date: '23 May 2026 · 14:32', client: 'Marisol Ramírez', concept: 'Cuota 7/24 — Préstamo PR-1209', amount: 850000, type: 'in', status: 'success', method: 'Nequi', cobrador: 'D. Ortiz' },
  { id: 'TX-04820', date: '23 May 2026 · 13:18', client: 'Carlos Mendoza', concept: 'Abono extraordinario', amount: 2400000, type: 'in', status: 'success', method: 'Transferencia', cobrador: '—' },
  { id: 'TX-04819', date: '23 May 2026 · 11:55', client: 'Yuliana Pérez', concept: 'Desembolso PR-1247', amount: 5000000, type: 'out', status: 'success', method: 'Bancolombia', cobrador: '—' },
  { id: 'TX-04818', date: '23 May 2026 · 10:42', client: 'Andrés Quintero', concept: 'Cuota 12/18 — Préstamo PR-1102', amount: 620000, type: 'in', status: 'success', method: 'Efectivo', cobrador: 'J. Salazar' },
  { id: 'TX-04817', date: '23 May 2026 · 09:21', client: 'Diana Castaño', concept: 'Cuota 3/12 — Mora 4 días', amount: 480000, type: 'in', status: 'warning', method: 'Daviplata', cobrador: 'D. Ortiz' },
  { id: 'TX-04816', date: '22 May 2026 · 18:04', client: 'Roberto Acosta', concept: 'Cuota 9/24', amount: 720000, type: 'in', status: 'success', method: 'Efectivo', cobrador: 'M. Tovar' },
  { id: 'TX-04815', date: '22 May 2026 · 16:47', client: 'Esperanza Gil', concept: 'Cobro fallido — Sin fondos', amount: 540000, type: 'in', status: 'danger', method: 'PSE', cobrador: 'J. Salazar' },
  { id: 'TX-04814', date: '22 May 2026 · 15:30', client: 'Luis Beltrán', concept: 'Desembolso PR-1246', amount: 3500000, type: 'out', status: 'success', method: 'Transferencia', cobrador: '—' },
  { id: 'TX-04813', date: '22 May 2026 · 14:12', client: 'Paola Hernández', concept: 'Cuota 18/18 — Final', amount: 380000, type: 'in', status: 'success', method: 'Efectivo', cobrador: 'M. Tovar' },
  { id: 'TX-04812', date: '22 May 2026 · 11:50', client: 'Iván Cárdenas', concept: 'Cuota 5/12', amount: 920000, type: 'in', status: 'success', method: 'Nequi', cobrador: 'D. Ortiz' },
];

const ROUTE_CLIENTS = [
  { n: 'Marisol Ramírez', a: 'Cra 43 #18-22, Belén', amt: 850000, status: 'pending', time: '08:30' },
  { n: 'Andrés Quintero', a: 'Cl 70 #52-14, Laureles', amt: 620000, status: 'done', time: '09:15' },
  { n: 'Diana Castaño', a: 'Cra 80 #34-09, La América', amt: 480000, status: 'mora', time: '10:00' },
  { n: 'Roberto Acosta', a: 'Cl 33 #66-50, Belén', amt: 720000, status: 'pending', time: '10:45' },
  { n: 'Esperanza Gil', a: 'Cra 65 #45-12, Estadio', amt: 540000, status: 'pending', time: '11:30' },
  { n: 'Iván Cárdenas', a: 'Cl 10 #43-25, El Poblado', amt: 920000, status: 'done', time: '12:15' },
  { n: 'Paola Hernández', a: 'Cra 50 #29-17, Industrial', amt: 380000, status: 'pending', time: '13:00' },
  { n: 'Carlos Mendoza', a: 'Cl 4 sur #43-145, El Poblado', amt: 2400000, status: 'pending', time: '14:00' },
];

const CASHFLOW_14D = (() => {
  // 14-day forecast
  const base = [
    { day: 'Lun', date: '26', inflow: 32, outflow: 8 },
    { day: 'Mar', date: '27', inflow: 38, outflow: 12 },
    { day: 'Mié', date: '28', inflow: 42, outflow: 5 },
    { day: 'Jue', date: '29', inflow: 28, outflow: 18 },
    { day: 'Vie', date: '30', inflow: 51, outflow: 22 },
    { day: 'Sáb', date: '31', inflow: 24, outflow: 4 },
    { day: 'Dom', date: '01', inflow: 8, outflow: 2 },
    { day: 'Lun', date: '02', inflow: 36, outflow: 10 },
    { day: 'Mar', date: '03', inflow: 41, outflow: 7 },
    { day: 'Mié', date: '04', inflow: 45, outflow: 24 },
    { day: 'Jue', date: '05', inflow: 30, outflow: 6 },
    { day: 'Vie', date: '06', inflow: 58, outflow: 28 },
    { day: 'Sáb', date: '07', inflow: 22, outflow: 3 },
    { day: 'Dom', date: '08', inflow: 6, outflow: 1 },
  ];
  return base;
})();

const COHORTS = [
  { cohort: 'Ene 2026', desembolsos: 142, mora: 4.2, recaudo: 96.1 },
  { cohort: 'Feb 2026', desembolsos: 168, mora: 5.1, recaudo: 94.8 },
  { cohort: 'Mar 2026', desembolsos: 187, mora: 3.8, recaudo: 97.2 },
  { cohort: 'Abr 2026', desembolsos: 203, mora: 6.4, recaudo: 92.5 },
  { cohort: 'May 2026', desembolsos: 221, mora: 4.9, recaudo: 95.7 },
];

const COBRADORES = [
  { n: 'Diego Ortiz', zone: 'Norte', recaudo: 98200000, ef: 96, color: '#d4ff3a' },
  { n: 'Juan Salazar', zone: 'Centro', recaudo: 76400000, ef: 88, color: '#4ade80' },
  { n: 'Mauricio Tovar', zone: 'Sur', recaudo: 84100000, ef: 92, color: '#fbbf24' },
  { n: 'Laura Vélez', zone: 'Occ.', recaudo: 62800000, ef: 90, color: '#60a5fa' },
];

window.MOCK = {
  fmt, CURRENCY,
  KPIS, KPIS_DENSE, TRANSACTIONS, ROUTE_CLIENTS,
  CASHFLOW_14D, COHORTS, COBRADORES,
};

// ============= Clientes (CRM) =============
const CLIENTS = [
  { id:'CL-0421', n:'Marisol Ramírez', cc:'43.118.927', tel:'+57 310 442 1188', city:'Belén', score:824, status:'al-dia', activos:1, total:14450000, since:'feb 2024', ontime:96, ref:'Diego Ortiz' },
  { id:'CL-0420', n:'Carlos Mendoza', cc:'71.448.092', tel:'+57 304 882 0014', city:'El Poblado', score:781, status:'al-dia', activos:2, total:28700000, since:'ago 2023', ontime:92, ref:'—' },
  { id:'CL-0419', n:'Yuliana Pérez', cc:'1.014.882.711', tel:'+57 320 111 3344', city:'Robledo', score:702, status:'al-dia', activos:1, total:5000000, since:'may 2026', ontime:100, ref:'Laura Vélez' },
  { id:'CL-0418', n:'Andrés Quintero', cc:'8.402.119', tel:'+57 313 442 8810', city:'Laureles', score:765, status:'al-dia', activos:1, total:7200000, since:'ene 2025', ontime:98, ref:'Juan Salazar' },
  { id:'CL-0417', n:'Diana Castaño', cc:'42.116.448', tel:'+57 312 880 1144', city:'La América', score:612, status:'mora-corta', activos:1, total:4800000, since:'mar 2025', ontime:82, ref:'Diego Ortiz' },
  { id:'CL-0416', n:'Roberto Acosta', cc:'70.119.882', tel:'+57 311 442 0099', city:'Belén', score:744, status:'al-dia', activos:1, total:8400000, since:'jul 2024', ontime:94, ref:'Mauricio Tovar' },
  { id:'CL-0415', n:'Esperanza Gil', cc:'43.881.044', tel:'+57 318 442 8811', city:'Estadio', score:584, status:'mora-larga', activos:1, total:6500000, since:'oct 2024', ontime:71, ref:'Juan Salazar' },
  { id:'CL-0414', n:'Luis Beltrán', cc:'8.998.011', tel:'+57 315 110 8844', city:'Aranjuez', score:701, status:'al-dia', activos:1, total:3500000, since:'may 2026', ontime:100, ref:'—' },
  { id:'CL-0413', n:'Paola Hernández', cc:'1.037.882.119', tel:'+57 322 880 4411', city:'Industrial', score:812, status:'al-dia', activos:0, total:0, since:'ene 2024', ontime:100, ref:'Mauricio Tovar', graduated:true },
  { id:'CL-0412', n:'Iván Cárdenas', cc:'71.882.119', tel:'+57 313 882 1144', city:'El Poblado', score:758, status:'al-dia', activos:1, total:11000000, since:'mar 2024', ontime:95, ref:'Diego Ortiz' },
  { id:'CL-0411', n:'Sandra Lozano', cc:'43.991.220', tel:'+57 319 442 8800', city:'Robledo', score:678, status:'mora-corta', activos:2, total:9200000, since:'sep 2024', ontime:88, ref:'Laura Vélez' },
  { id:'CL-0410', n:'Néstor Aristizábal', cc:'8.114.991', tel:'+57 310 882 4411', city:'Castilla', score:732, status:'al-dia', activos:1, total:6800000, since:'feb 2025', ontime:97, ref:'Diego Ortiz' },
];

// ============= Préstamos =============
const LOANS = [
  { id:'PR-1209', client:'Marisol Ramírez', clientId:'CL-0421', principal:18000000, balance:13600000, rate:18.4, term:24, paid:7, remaining:17, next:'06 jun 2026', cuota:850000, status:'active', frequency:'mensual', purpose:'Inventario tienda', collateral:'Codeudor', desembolso:'12 nov 2025' },
  { id:'PR-1208', client:'Carlos Mendoza', clientId:'CL-0420', principal:35000000, balance:22400000, rate:16.8, term:36, paid:14, remaining:22, next:'02 jun 2026', cuota:1240000, status:'active', frequency:'mensual', purpose:'Capital de trabajo', collateral:'Hipoteca II', desembolso:'05 mar 2025' },
  { id:'PR-1207', client:'Andrés Quintero', clientId:'CL-0418', principal:7200000, balance:3600000, rate:19.2, term:18, paid:12, remaining:6, next:'04 jun 2026', cuota:620000, status:'active', frequency:'mensual', purpose:'Compra moto', collateral:'Prenda vehículo', desembolso:'08 sep 2024' },
  { id:'PR-1206', client:'Diana Castaño', clientId:'CL-0417', principal:4800000, balance:3120000, rate:21.0, term:12, paid:3, remaining:9, next:'19 may 2026', cuota:480000, status:'late', daysLate:4, frequency:'mensual', purpose:'Emergencia médica', collateral:'—', desembolso:'20 feb 2026' },
  { id:'PR-1205', client:'Esperanza Gil', clientId:'CL-0415', principal:6500000, balance:5460000, rate:22.5, term:18, paid:2, remaining:16, next:'12 abr 2026', cuota:540000, status:'late', daysLate:41, frequency:'mensual', purpose:'Refinanciación', collateral:'—', desembolso:'10 mar 2026' },
  { id:'PR-1204', client:'Iván Cárdenas', clientId:'CL-0412', principal:11000000, balance:6600000, rate:17.4, term:24, paid:10, remaining:14, next:'08 jun 2026', cuota:920000, status:'active', frequency:'mensual', purpose:'Mercancía a crédito', collateral:'Mercancía', desembolso:'12 jul 2025' },
  { id:'PR-1203', client:'Néstor Aristizábal', clientId:'CL-0410', principal:6800000, balance:5440000, rate:18.0, term:18, paid:4, remaining:14, next:'05 jun 2026', cuota:580000, status:'active', frequency:'quincenal', purpose:'Estudio hijo', collateral:'Codeudor', desembolso:'15 ene 2026' },
];

// Amortization table generator
function genAmortization(principal, rate, term, startDate) {
  const r = rate / 100 / 12;
  const pmt = (principal * r) / (1 - Math.pow(1 + r, -term));
  const rows = [];
  let balance = principal;
  const d = new Date(startDate);
  for (let i = 1; i <= term; i++) {
    const interest = balance * r;
    const capital = pmt - interest;
    balance -= capital;
    d.setMonth(d.getMonth() + 1);
    rows.push({
      n: i,
      date: d.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'2-digit' }),
      cuota: Math.round(pmt),
      capital: Math.round(capital),
      interest: Math.round(interest),
      balance: Math.max(0, Math.round(balance)),
    });
  }
  return rows;
}

// ============= Mercancía =============
const MERCH_CATALOG = [
  { id:'M-001', name:'Nevera 320L Indurama', sku:'NV-320', stock:8, price:2890000, financed:24, sales:42, category:'Electrodomésticos' },
  { id:'M-002', name:'Televisor 55" 4K LG', sku:'TV-55-LG', stock:14, price:2199000, financed:18, sales:67, category:'Electrónica' },
  { id:'M-003', name:'Lavadora 18kg Whirlpool', sku:'LV-18W', stock:5, price:1680000, financed:18, sales:31, category:'Electrodomésticos' },
  { id:'M-004', name:'Sala 3-2-1 Bellini', sku:'SL-B321', stock:3, price:3450000, financed:30, sales:18, category:'Muebles' },
  { id:'M-005', name:'Bicicleta MTB GW Hyena', sku:'BC-GH', stock:11, price:1290000, financed:12, sales:24, category:'Deporte' },
  { id:'M-006', name:'Estufa 4 puestos Haceb', sku:'EST-4H', stock:9, price:980000, financed:12, sales:38, category:'Electrodomésticos' },
  { id:'M-007', name:'Computador Lenovo Ideapad', sku:'PC-LIP', stock:6, price:2750000, financed:24, sales:22, category:'Cómputo' },
  { id:'M-008', name:'Cama queen + colchón', sku:'CM-QS', stock:4, price:1850000, financed:18, sales:15, category:'Muebles' },
];

const MERCH_CREDITS = [
  { id:'MC-0124', client:'Marisol Ramírez', item:'Nevera 320L Indurama', total:2890000, paid:1200000, status:'active', cuotas:'10/24' },
  { id:'MC-0123', client:'Iván Cárdenas', item:'TV 55" 4K LG', total:2199000, paid:2199000, status:'paid', cuotas:'18/18' },
  { id:'MC-0122', client:'Sandra Lozano', item:'Lavadora 18kg', total:1680000, paid:280000, status:'late', cuotas:'2/18', daysLate:9 },
  { id:'MC-0121', client:'Roberto Acosta', item:'Sala 3-2-1', total:3450000, paid:920000, status:'active', cuotas:'8/30' },
];

// ============= Collections / Mora =============
const COLLECTIONS = [
  { client:'Esperanza Gil', loan:'PR-1205', amount:5460000, days:41, attempts:7, lastContact:'Hace 2 días', stage:'gestion', priority:'alta', assigned:'Juan Salazar' },
  { client:'Diana Castaño', loan:'PR-1206', amount:480000, days:4, attempts:2, lastContact:'Ayer', stage:'recordatorio', priority:'media', assigned:'Diego Ortiz' },
  { client:'Sandra Lozano', loan:'PR-1199', amount:920000, days:9, attempts:3, lastContact:'Hoy', stage:'gestion', priority:'media', assigned:'Laura Vélez' },
  { client:'Jorge Hincapié', loan:'PR-1187', amount:1840000, days:67, attempts:14, lastContact:'Hace 4 días', stage:'juridico', priority:'critica', assigned:'Externo' },
  { client:'Lina Cifuentes', loan:'PR-1193', amount:3200000, days:88, attempts:18, lastContact:'Hace 1 sem', stage:'juridico', priority:'critica', assigned:'Externo' },
  { client:'Mauricio Pinto', loan:'PR-1201', amount:680000, days:15, attempts:4, lastContact:'Ayer', stage:'gestion', priority:'media', assigned:'Mauricio Tovar' },
  { client:'Yuliana Castro', loan:'PR-1188', amount:1240000, days:32, attempts:9, lastContact:'Hace 3 días', stage:'gestion', priority:'alta', assigned:'Juan Salazar' },
];

window.MOCK = Object.assign(window.MOCK, {
  CLIENTS, LOANS, MERCH_CATALOG, MERCH_CREDITS, COLLECTIONS,
  genAmortization,
});
