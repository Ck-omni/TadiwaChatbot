import React from 'react';

export interface TrendPoint {
  label: string;
  value: number;
}

interface LineTrendChartProps {
  data: TrendPoint[];
  /** Series color — defaults to this app's brand blue. */
  color?: string;
  /** Formats the value shown in the end-label and tooltip, e.g. (v) => `${v}`. */
  formatValue?: (value: number) => string;
}

const WIDTH = 600;
const HEIGHT = 260;
const PAD = { top: 34, right: 24, bottom: 34, left: 44 };

/** Rounds a domain out to a "nice" step so gridlines land on clean numbers. */
function niceDomain(min: number, max: number, steps = 4) {
  const rawStep = (max - min) / steps || 1;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const niceStep = Math.ceil(rawStep / magnitude) * magnitude;
  const niceMin = Math.floor(min / niceStep) * niceStep;
  const niceMax = Math.ceil(max / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + 1e-9; v += niceStep) ticks.push(Math.round(v));
  return { min: niceMin, max: niceMax, ticks };
}

/**
 * A single-series trend line. One series needs no legend box — the chart's
 * title/subtitle already names what's plotted (see dataviz skill: legends
 * are for telling series apart, not for a single line).
 *
 * Ships a crosshair + tooltip on hover AND keyboard focus, per the same
 * standard, with the same info reachable either way.
 */
export default function LineTrendChart({ data, color = '#2563eb', formatValue = (v) => String(v) }: LineTrendChartProps) {
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;

  const values = data.map((d) => d.value);
  const { min: yMin, max: yMax, ticks } = niceDomain(Math.min(...values), Math.max(...values));

  const xAt = (i: number) => PAD.left + (data.length === 1 ? plotWidth / 2 : (i / (data.length - 1)) * plotWidth);
  const yAt = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * plotHeight;

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(d.value)}`).join(' ');
  const areaPath = `${linePath} L ${xAt(data.length - 1)} ${PAD.top + plotHeight} L ${xAt(0)} ${PAD.top + plotHeight} Z`;

  const last = data[data.length - 1];
  const active = activeIndex !== null ? data[activeIndex] : null;

  // Tooltip position as a % of the container so it stays correct at any
  // rendered size, even though the SVG's own coordinate space is fixed.
  const tooltipStyle: React.CSSProperties | undefined =
    activeIndex !== null
      ? {
          left: `${(xAt(activeIndex) / WIDTH) * 100}%`,
          top: `${(yAt(data[activeIndex].value) / HEIGHT) * 100}%`,
        }
      : undefined;

  return (
    <div ref={containerRef} className="relative w-full">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" role="img" aria-label="Trend line chart">
        {/* Gridlines — hairline, recessive, never dashed */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={yAt(t)}
              y2={yAt(t)}
              stroke="#e2e8f0"
              strokeWidth={1}
            />
            <text x={PAD.left - 10} y={yAt(t)} textAnchor="end" dominantBaseline="middle" className="fill-slate-400" fontSize={10}>
              {t.toLocaleString()}
            </text>
          </g>
        ))}

        {/* Area wash under the line, ~10% opacity per spec */}
        <path d={areaPath} fill={color} opacity={0.08} />

        {/* The line itself: 2px, round join/cap */}
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* X-axis labels */}
        {data.map((d, i) => (
          <text key={d.label} x={xAt(i)} y={HEIGHT - PAD.bottom + 20} textAnchor="middle" className="fill-slate-400" fontSize={10}>
            {d.label}
          </text>
        ))}

        {/* Crosshair on hover/focus */}
        {activeIndex !== null && (
          <line
            x1={xAt(activeIndex)}
            x2={xAt(activeIndex)}
            y1={PAD.top}
            y2={PAD.top + plotHeight}
            stroke="#cbd5e1"
            strokeWidth={1}
          />
        )}

        {/* End-of-line marker + direct label (value at the end, per spec) */}
        <circle cx={xAt(data.length - 1)} cy={yAt(last.value)} r={5} fill={color} stroke="#ffffff" strokeWidth={2} />
        <text
          x={xAt(data.length - 1)}
          y={yAt(last.value) - 14}
          textAnchor="end"
          className="fill-slate-900 font-semibold"
          fontSize={13}
        >
          {formatValue(last.value)}
        </text>

        {/* Highlighted dot for the hovered/focused point */}
        {active && activeIndex !== data.length - 1 && (
          <circle cx={xAt(activeIndex!)} cy={yAt(active.value)} r={5} fill={color} stroke="#ffffff" strokeWidth={2} />
        )}

        {/* Invisible hit bands — one per point, bigger than the visual mark,
            with keyboard focus support carrying the same info as hover. */}
        {data.map((d, i) => {
          const bandLeft = i === 0 ? PAD.left : (xAt(i - 1) + xAt(i)) / 2;
          const bandRight = i === data.length - 1 ? WIDTH - PAD.right : (xAt(i) + xAt(i + 1)) / 2;
          return (
            <rect
              key={d.label}
              x={bandLeft}
              y={PAD.top}
              width={bandRight - bandLeft}
              height={plotHeight}
              fill="transparent"
              tabIndex={0}
              role="img"
              aria-label={`${d.label}: ${formatValue(d.value)}`}
              onPointerEnter={() => setActiveIndex(i)}
              onPointerLeave={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(i)}
              onBlur={() => setActiveIndex(null)}
              className="cursor-crosshair outline-none"
            />
          );
        })}
      </svg>

      {active && tooltipStyle && (
        <div
          className="absolute -translate-x-1/2 -translate-y-[calc(100%+10px)] pointer-events-none bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 whitespace-nowrap z-10"
          style={tooltipStyle}
        >
          <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">{active.label}</p>
          <p className="text-sm font-bold text-slate-900">{formatValue(active.value)}</p>
        </div>
      )}
    </div>
  );
}
