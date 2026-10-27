import React, { useState } from 'react';
import { MealEntry, DailyTarget } from '../types/nutrition';
import { Dumbbell, TrendingUp, Award, Calendar, CheckCircle, Info } from 'lucide-react';

interface ProteinTrendLineChartProps {
  meals: MealEntry[];
  target: DailyTarget;
}

export const ProteinTrendLineChart: React.FC<ProteinTrendLineChartProps> = ({ meals, target }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // 1. Build 30-day timeline (29 days ago up to today)
  const past30Days: { dateStr: string; label: string; protein: number; meetsTarget: boolean }[] = [];

  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yr}-${mo}-${da}`;

    const shortLabel = i === 0 ? 'Today' : i === 1 ? 'Yest' : `${d.getMonth() + 1}/${d.getDate()}`;

    const dayMeals = meals.filter((m) => m.date === dateStr);
    const protein = Math.round(dayMeals.reduce((sum, m) => sum + (m.macros?.protein || 0), 0));

    past30Days.push({
      dateStr,
      label: shortLabel,
      protein,
      meetsTarget: protein >= target.protein,
    });
  }

  // 2. Metrics summary
  const proteinValues = past30Days.map((d) => d.protein);
  const totalProtein = proteinValues.reduce((a, b) => a + b, 0);
  const activeDaysCount = past30Days.filter((d) => d.protein > 0).length;
  const avgProtein = activeDaysCount > 0 ? Math.round(totalProtein / activeDaysCount) : 0;
  const daysHitTarget = past30Days.filter((d) => d.meetsTarget).length;
  const hitTargetRate = Math.round((daysHitTarget / 30) * 100);
  const maxProtein = Math.max(target.protein * 1.3, ...proteinValues, 50);

  // 3. SVG Dimensions & Coordinate Mapping
  const width = 680;
  const height = 180;
  const paddingLeft = 45;
  const paddingRight = 25;
  const paddingTop = 25;
  const paddingBottom = 30;

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const points = past30Days.map((d, index) => {
    const x = paddingLeft + (index / (past30Days.length - 1)) * plotWidth;
    const y = paddingTop + plotHeight - (Math.min(d.protein, maxProtein) / maxProtein) * plotHeight;
    return { x, y, ...d };
  });

  // Construct SVG paths
  const linePath = points.reduce((path, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${path} L ${pt.x} ${pt.y}`;
  }, '');

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${paddingTop + plotHeight} L ${points[0].x} ${paddingTop + plotHeight} Z`;

  // Target line Y coordinate
  const targetY = paddingTop + plotHeight - (target.protein / maxProtein) * plotHeight;

  // Selected or hovered point
  const currentHoverPoint = hoveredIndex !== null ? points[hoveredIndex] : points[points.length - 1];

  return (
    <div className="p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-5">
      {/* Header & Stat Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
              <Dumbbell className="w-4 h-4 text-blue-700" />
            </div>
            <h3 className="font-editorial text-lg font-semibold text-stone-900">
              30-Day Protein Trajectory
            </h3>
          </div>
          <p className="text-xs text-stone-500">
            Daily cellular repair, satiety & lean muscle synthesis tracking
          </p>
        </div>

        {/* Adherence and Average badges */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200/60 text-right">
            <span className="text-[10px] uppercase font-semibold text-blue-700 block">
              30-Day Average
            </span>
            <span className="font-mono-nums text-base font-bold text-blue-900">
              {avgProtein}g <span className="text-xs font-normal text-stone-500">/ day</span>
            </span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-right">
            <span className="text-[10px] uppercase font-semibold text-stone-500 block">
              Target Achieved
            </span>
            <span className="font-mono-nums text-base font-bold text-stone-800">
              {daysHitTarget} <span className="text-xs font-normal text-stone-400">/ 30 days ({hitTargetRate}%)</span>
            </span>
          </div>
        </div>
      </div>

      {/* SVG Line Chart Container */}
      <div className="relative pt-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            {/* Area gradient under the protein trend line */}
            <linearGradient id="proteinAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.00" />
            </linearGradient>

            {/* Glowing filter for data points */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#1d4ed8" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Grid lines (horizontal) */}
          {[0, 0.5, 1].map((ratio, i) => {
            const y = paddingTop + plotHeight * (1 - ratio);
            const val = Math.round(maxProtein * ratio);
            return (
              <g key={i}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-stone-400 font-mono text-[10px]"
                >
                  {val}g
                </text>
              </g>
            );
          })}

          {/* Target guideline (dashed blue line) */}
          <line
            x1={paddingLeft}
            y1={targetY}
            x2={width - paddingRight}
            y2={targetY}
            stroke="#60a5fa"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <text
            x={width - paddingRight + 4}
            y={targetY + 3}
            textAnchor="start"
            className="fill-blue-600 font-mono text-[9px] font-semibold"
          >
            {target.protein}g Target
          </text>

          {/* Shaded Area Under Curve */}
          <path d={areaPath} fill="url(#proteinAreaGradient)" />

          {/* Protein Trend Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#2563eb"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-all duration-300"
          />

          {/* Hover crosshair line */}
          {hoveredIndex !== null && (
            <line
              x1={points[hoveredIndex].x}
              y1={paddingTop}
              x2={points[hoveredIndex].x}
              y2={paddingTop + plotHeight}
              stroke="#94a3b8"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
          )}

          {/* Interactive Data Points (Circles) */}
          {points.map((pt, i) => {
            const isHovered = hoveredIndex === i;
            const isSelected = i === points.length - 1 && hoveredIndex === null;
            const meets = pt.meetsTarget;

            return (
              <g
                key={i}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Hit test circle for easy hover */}
                <circle cx={pt.x} cy={pt.y} r="9" fill="transparent" />

                {/* Visible dot */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered || isSelected ? 5.5 : 2.5}
                  fill={meets ? '#2563eb' : '#93c5fd'}
                  stroke="#ffffff"
                  strokeWidth={isHovered || isSelected ? 2 : 1}
                  filter={isHovered ? 'url(#glow)' : undefined}
                  className="transition-all duration-150"
                />
              </g>
            );
          })}

          {/* X-axis date interval labels (every 5-7 days) */}
          {[0, 7, 14, 21, 29].map((idx) => {
            if (!points[idx]) return null;
            return (
              <text
                key={idx}
                x={points[idx].x}
                y={paddingTop + plotHeight + 18}
                textAnchor="middle"
                className="fill-stone-400 text-[10px] font-medium"
              >
                {points[idx].label}
              </text>
            );
          })}
        </svg>

        {/* Interactive Tooltip Card */}
        {currentHoverPoint && (
          <div className="mt-3 p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-700" />
              <span className="font-semibold text-stone-900">
                {currentHoverPoint.dateStr} ({currentHoverPoint.label})
              </span>
            </div>

            <div className="flex items-center gap-4">
              <span className="font-mono-nums font-bold text-blue-900 text-sm">
                {currentHoverPoint.protein}g Protein
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  currentHoverPoint.meetsTarget
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                {currentHoverPoint.meetsTarget ? (
                  <>
                    <CheckCircle className="w-3 h-3 text-emerald-700" />
                    <span>Target Met ({Math.round((currentHoverPoint.protein / target.protein) * 100)}%)</span>
                  </>
                ) : (
                  <>
                    <Info className="w-3 h-3 text-amber-700" />
                    <span>{target.protein - currentHoverPoint.protein}g shy of target</span>
                  </>
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Trajectory Insights Footer */}
      <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/70 text-xs text-stone-600 flex items-start gap-2.5">
        <TrendingUp className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Maintaining consistent daily protein stabilizes postprandial glucose levels and curbs evening craving spikes. You achieved your protein target on <strong className="text-stone-900 font-semibold">{daysHitTarget} of the past 30 days</strong>.
        </p>
      </div>
    </div>
  );
};
