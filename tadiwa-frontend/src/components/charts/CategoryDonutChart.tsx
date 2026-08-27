import React from 'react';

export interface CategorySlice {
  label: string;
  value: number;
  /** Hex color for this slice — pass validated categorical hues, not ad hoc picks. */
  color: string;
}

interface CategoryDonutChartProps {
  data: CategorySlice[];
  /** Shown in the center of the ring, e.g. "Tickets This Week". */
  centerLabel: string;
}

const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = 70;
const STROKE = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP_PX = 3; // surface gap between adjacent slices

/**
 * Part-to-whole donut. At 4 categories, direct labels are mandatory (dataviz
 * skill's series-count ladder) — so every legend row carries its own value
 * and share, not just a color swatch. A legend is always present for 2+
 * series regardless.
 */
export default function CategoryDonutChart({ data, centerLabel }: CategoryDonutChartProps) {
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = React.useState<{ x: number; y: number } | null>(null);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  let cumulative = 0;
  const segments = data.map((d) => {
    const fraction = total > 0 ? d.value / total : 0;
    const fullDash = fraction * CIRCUMFERENCE;
    const dash = Math.max(fullDash - GAP_PX, 0);
    const offset = -cumulative;
    cumulative += fullDash;
    return { ...d, fraction, dash, offset };
  });

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        ref={containerRef}
        className="relative shrink-0"
        style={{ width: SIZE, height: SIZE }}
        onPointerMove={handleMove}
        onPointerLeave={() => setActiveIndex(null)}
      >
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full" role="img" aria-label="Ticket category breakdown">
          <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
            {segments.map((s, i) => (
              <circle
                key={s.label}
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke={s.color}
                strokeWidth={activeIndex === i ? STROKE + 4 : STROKE}
                strokeDasharray={`${s.dash} ${CIRCUMFERENCE - s.dash}`}
                strokeDashoffset={s.offset}
                strokeLinecap="butt"
                style={{ transition: 'stroke-width 120ms ease' }}
                tabIndex={0}
                role="img"
                aria-label={`${s.label}: ${s.value.toLocaleString()} (${Math.round(s.fraction * 100)}%)`}
                onPointerEnter={() => setActiveIndex(i)}
                onFocus={() => setActiveIndex(i)}
                onBlur={() => setActiveIndex(null)}
                className="cursor-pointer outline-none"
              />
            ))}
          </g>
        </svg>

        {/* Center hero figure */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-bold text-slate-900 dark:text-slate-300 tracking-tighter">{total.toLocaleString()}</span>
          <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold text-center px-6">{centerLabel}</span>
        </div>

        {activeIndex !== null && cursor && (
          <div
            className="absolute pointer-events-none bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 whitespace-nowrap z-10 -translate-x-1/2 -translate-y-[calc(100%+12px)]"
            style={{ left: cursor.x, top: cursor.y }}
          >
            <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">{segments[activeIndex].label}</p>
            <p className="text-sm font-bold text-slate-900">
              {segments[activeIndex].value.toLocaleString()}{' '}
              <span className="text-slate-400 font-normal">({Math.round(segments[activeIndex].fraction * 100)}%)</span>
            </p>
          </div>
        )}
      </div>

      {/* Legend — mandatory at 2+ series; values shown directly since 4
          series makes direct labels mandatory (and mitigates the CVD/contrast
          WARN band on a couple of these hues — see the skill's palette notes). */}
      <ul className="w-full space-y-3">
        {segments.map((s, i) => (
          <li
            key={s.label}
            className={`flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg transition-colors ${activeIndex === i ? 'bg-slate-50' : ''}`}
            onPointerEnter={() => setActiveIndex(i)}
            onPointerLeave={() => setActiveIndex(null)}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-xs text-slate-600 truncate dark:text-slate-300">{s.label}</span>
            </span>
            <span className="text-xs font-bold text-slate-900 shrink-0 dark:text-slate-400">
              {s.value.toLocaleString()} <span className="text-slate-300 font-normal">({Math.round(s.fraction * 100)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
