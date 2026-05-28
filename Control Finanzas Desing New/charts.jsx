// Sparkline + chart helpers — pure SVG, no deps
const Sparkline = ({ data, w = 90, h = 32, stroke = 'var(--accent)', fill = 'none', smooth = true }) => {
  if (!data || !data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const dx = w / (data.length - 1);
  const pts = data.map((v, i) => [i * dx, h - ((v - min) / range) * (h - 4) - 2]);
  let d;
  if (smooth) {
    d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0,y0] = pts[i-1];
      const [x1,y1] = pts[i];
      const cx = (x0 + x1) / 2;
      d += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
    }
  } else {
    d = 'M ' + pts.map(p => p.join(' ')).join(' L ');
  }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="chart-canvas" style={{display:'block'}}>
      {fill !== 'none' && <path d={`${d} L ${w} ${h} L 0 ${h} Z`} fill={fill} opacity="0.15"/>}
      <path d={d} stroke={stroke} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    </svg>
  );
};

// Multi-line area chart
const AreaChart = ({ series, w = 700, h = 240, pad = { t: 20, r: 20, b: 30, l: 40 } }) => {
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const allY = series.flatMap(s => s.data);
  const max = Math.max(...allY) * 1.1;
  const min = 0;
  const len = series[0].data.length;
  const dx = innerW / (len - 1);
  const yScale = (v) => pad.t + innerH - ((v - min) / (max - min)) * innerH;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="chart-canvas" preserveAspectRatio="none" style={{width:'100%',height:h}}>
      {/* Y gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = pad.t + innerH * (1 - t);
        const val = (min + (max - min) * t);
        return (
          <g key={t}>
            <line x1={pad.l} x2={w-pad.r} y1={y} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray={t===0?'':'2 4'} />
            <text x={pad.l - 8} y={y+3} fontSize="10" fill="var(--text-3)" textAnchor="end" fontFamily="var(--font-mono)">{Math.round(val)}M</text>
          </g>
        );
      })}
      {series.map((s, si) => {
        const pts = s.data.map((v, i) => [pad.l + i * dx, yScale(v)]);
        let d = `M ${pts[0][0]} ${pts[0][1]}`;
        for (let i = 1; i < pts.length; i++) {
          const [x0,y0] = pts[i-1];
          const [x1,y1] = pts[i];
          const cx = (x0 + x1) / 2;
          d += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
        }
        const area = `${d} L ${pts[pts.length-1][0]} ${pad.t + innerH} L ${pts[0][0]} ${pad.t + innerH} Z`;
        return (
          <g key={si}>
            <path d={area} fill={s.color} opacity="0.08"/>
            <path d={d} stroke={s.color} strokeWidth="1.75" fill="none"/>
            {pts.map(([x,y], i) => i === pts.length-1 && <circle key={i} cx={x} cy={y} r="3" fill={s.color}/>)}
          </g>
        );
      })}
      {/* X labels */}
      {series[0].labels && series[0].labels.map((lbl, i) => (
        <text key={i} x={pad.l + i * dx} y={h - 8} fontSize="10" fill="var(--text-3)" textAnchor="middle" fontFamily="var(--font-mono)">{lbl}</text>
      ))}
    </svg>
  );
};

// Bar chart (cashflow)
const BarChart = ({ data, w = 700, h = 240, pad = { t: 20, r: 20, b: 40, l: 40 } }) => {
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const max = Math.max(...data.map(d => Math.max(d.inflow, d.outflow))) * 1.15;
  const barGroupW = innerW / data.length;
  const barW = barGroupW * 0.35;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{width:'100%', height: h}}>
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = pad.t + innerH * (1 - t);
        return (
          <g key={t}>
            <line x1={pad.l} x2={w-pad.r} y1={y} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray={t===0?'':'2 4'}/>
            <text x={pad.l-8} y={y+3} fontSize="10" fill="var(--text-3)" textAnchor="end" fontFamily="var(--font-mono)">{Math.round(max*t)}M</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const x = pad.l + i * barGroupW + barGroupW * 0.15;
        const hIn = (d.inflow / max) * innerH;
        const hOut = (d.outflow / max) * innerH;
        return (
          <g key={i}>
            <rect x={x} y={pad.t + innerH - hIn} width={barW} height={hIn} fill="var(--accent)" rx="1"/>
            <rect x={x + barW + 2} y={pad.t + innerH - hOut} width={barW} height={hOut} fill="#3a3a3a" rx="1"/>
            <text x={x + barW + 1} y={h - 22} fontSize="10" fill="var(--text-3)" textAnchor="middle" fontFamily="var(--font-mono)">{d.date}</text>
            <text x={x + barW + 1} y={h - 8} fontSize="9" fill="var(--text-4)" textAnchor="middle" fontFamily="var(--font-mono)">{d.day}</text>
          </g>
        );
      })}
    </svg>
  );
};

// Donut chart
const Donut = ({ segments, size = 160, thickness = 24 }) => {
  const r = (size - thickness) / 2;
  const c = size / 2;
  const total = segments.reduce((s, x) => s + x.value, 0);
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--border)" strokeWidth={thickness}/>
      {segments.map((seg, i) => {
        const frac = seg.value / total;
        const dash = frac * 2 * Math.PI * r;
        const gap = 2 * Math.PI * r - dash;
        const offset = -acc * 2 * Math.PI * r;
        acc += frac;
        return (
          <circle key={i} cx={c} cy={c} r={r} fill="none"
            stroke={seg.color} strokeWidth={thickness}
            strokeDasharray={`${dash} ${gap}`} strokeDashoffset={offset}
            transform={`rotate(-90 ${c} ${c})`} />
        );
      })}
    </svg>
  );
};

window.Charts = { Sparkline, AreaChart, BarChart, Donut };
