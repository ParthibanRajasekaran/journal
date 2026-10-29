import React, { useState } from 'react';
import { MealEntry, MicronutrientProfile, MICRONUTRIENT_RDAS } from '../types/nutrition';
import {
  Sparkles,
  ShieldCheck,
  Zap,
  Heart,
  Sun,
  Activity,
  ChevronRight,
  TrendingUp,
  Info,
  CheckCircle2,
  AlertCircle,
  Plus
} from 'lucide-react';

interface MicronutrientDashboardProps {
  meals: MealEntry[];
  currentDate: string;
}

type NutrientKey = keyof MicronutrientProfile;

const NUTRIENT_ICONS: Record<NutrientKey, React.ComponentType<any>> = {
  vitaminD_iu: Sun,
  vitaminB12_mcg: Zap,
  vitaminC_mg: Heart,
  iron_mg: Activity,
  magnesium_mg: ShieldCheck,
  zinc_mg: Sparkles,
};

export const MicronutrientDashboard: React.FC<MicronutrientDashboardProps> = ({
  meals,
  currentDate,
}) => {
  const [viewMode, setViewMode] = useState<'today' | '7day'>('7day');
  const [selectedNutrient, setSelectedNutrient] = useState<NutrientKey | null>(null);

  // Calculate 7-day date range ending on currentDate
  const last7Days: string[] = [];
  const currD = new Date(currentDate + 'T12:00:00');
  for (let i = 6; i >= 0; i--) {
    const d = new Date(currD);
    d.setDate(d.getDate() - i);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    last7Days.push(`${yr}-${mo}-${da}`);
  }

  // Filter meals for today and last 7 days
  const todayMeals = meals.filter(m => m.date === currentDate);
  const weekMeals = meals.filter(m => last7Days.includes(m.date));

  // Compute daily intake for each day in last 7 days
  const dailyNutrientIntake: Record<string, Record<NutrientKey, number>> = {};
  last7Days.forEach(d => {
    dailyNutrientIntake[d] = {
      vitaminD_iu: 0,
      vitaminB12_mcg: 0,
      vitaminC_mg: 0,
      iron_mg: 0,
      magnesium_mg: 0,
      zinc_mg: 0,
    };
  });

  weekMeals.forEach(m => {
    if (dailyNutrientIntake[m.date] && m.micronutrients) {
      dailyNutrientIntake[m.date].vitaminD_iu += m.micronutrients.vitaminD_iu || 0;
      dailyNutrientIntake[m.date].vitaminB12_mcg += m.micronutrients.vitaminB12_mcg || 0;
      dailyNutrientIntake[m.date].vitaminC_mg += m.micronutrients.vitaminC_mg || 0;
      dailyNutrientIntake[m.date].iron_mg += m.micronutrients.iron_mg || 0;
      dailyNutrientIntake[m.date].magnesium_mg += m.micronutrients.magnesium_mg || 0;
      dailyNutrientIntake[m.date].zinc_mg += m.micronutrients.zinc_mg || 0;
    }
  });

  // Today totals
  const todayTotals: Record<NutrientKey, number> = {
    vitaminD_iu: todayMeals.reduce((s, m) => s + (m.micronutrients?.vitaminD_iu || 0), 0),
    vitaminB12_mcg: todayMeals.reduce((s, m) => s + (m.micronutrients?.vitaminB12_mcg || 0), 0),
    vitaminC_mg: todayMeals.reduce((s, m) => s + (m.micronutrients?.vitaminC_mg || 0), 0),
    iron_mg: todayMeals.reduce((s, m) => s + (m.micronutrients?.iron_mg || 0), 0),
    magnesium_mg: todayMeals.reduce((s, m) => s + (m.micronutrients?.magnesium_mg || 0), 0),
    zinc_mg: todayMeals.reduce((s, m) => s + (m.micronutrients?.zinc_mg || 0), 0),
  };

  // 7-day average totals
  const weekTotals: Record<NutrientKey, number> = {
    vitaminD_iu: Math.round(last7Days.reduce((s, d) => s + dailyNutrientIntake[d].vitaminD_iu, 0) / 7),
    vitaminB12_mcg: Number((last7Days.reduce((s, d) => s + dailyNutrientIntake[d].vitaminB12_mcg, 0) / 7).toFixed(1)),
    vitaminC_mg: Math.round(last7Days.reduce((s, d) => s + dailyNutrientIntake[d].vitaminC_mg, 0) / 7),
    iron_mg: Number((last7Days.reduce((s, d) => s + dailyNutrientIntake[d].iron_mg, 0) / 7).toFixed(1)),
    magnesium_mg: Math.round(last7Days.reduce((s, d) => s + dailyNutrientIntake[d].magnesium_mg, 0) / 7),
    zinc_mg: Number((last7Days.reduce((s, d) => s + dailyNutrientIntake[d].zinc_mg, 0) / 7).toFixed(1)),
  };

  const activeTotals = viewMode === 'today' ? todayTotals : weekTotals;

  // Compute overall vitality fulfillment score
  const nutrientKeys = Object.keys(MICRONUTRIENT_RDAS) as NutrientKey[];
  const fulfillmentPercentages = nutrientKeys.map(k => {
    const rda = MICRONUTRIENT_RDAS[k].rda;
    return Math.min(100, Math.round((activeTotals[k] / rda) * 100));
  });
  const overallVitalityScore = Math.round(
    fulfillmentPercentages.reduce((a, b) => a + b, 0) / fulfillmentPercentages.length
  );

  return (
    <section className="bg-white rounded-2xl border border-stone-200/80 p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200/70">
              Cellular Health
            </span>
            <span className="text-xs text-stone-400">Vitality Panel</span>
          </div>
          <h3 className="font-editorial text-xl font-bold text-stone-900">
            Micronutrient Intelligence Dashboard
          </h3>
          <p className="text-xs text-stone-500 max-w-xl">
            Track daily bioavailability against Recommended Daily Allowances (RDAs) for essential vitamins and minerals.
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs font-medium shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('7day')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === '7day' ? 'bg-white text-stone-900 shadow-xs font-semibold' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            7-Day Cadence
          </button>
          <button
            type="button"
            onClick={() => setViewMode('today')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === 'today' ? 'bg-white text-stone-900 shadow-xs font-semibold' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Today's Plate
          </button>
        </div>
      </div>

      {/* Top Banner: Overall Vitality Fulfillment Score */}
      <div className="p-4 sm:p-5 rounded-2xl bg-linear-to-r from-teal-900 via-stone-900 to-teal-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold text-teal-300 tracking-wider">
            Overall Cellular Balance
          </span>
          <div className="flex items-baseline gap-2">
            <span className="font-mono-nums text-3xl font-extrabold text-white">
              {overallVitalityScore}%
            </span>
            <span className="text-xs text-teal-200 font-medium">RDA Fulfilled Across Vitality Panel</span>
          </div>
          <p className="text-xs text-stone-300 max-w-md">
            {overallVitalityScore >= 85
              ? 'Outstanding micronutrient diversity! Your whole-food selections are shielding metabolic resilience and cognitive vitality.'
              : 'Good foundation. Tapping into one or two whole-food powerhouses below can easily close your remaining nutrient gaps.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-teal-300">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 6 RDA Fulfillment Cards with 7-Day Trend Sparklines */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {nutrientKeys.map(key => {
          const config = MICRONUTRIENT_RDAS[key];
          const Icon = NUTRIENT_ICONS[key];
          const currentVal = activeTotals[key];
          const percent = Math.round((currentVal / config.rda) * 100);

          let statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
          let statusLabel = 'Optimal';
          if (percent < 60) {
            statusColor = 'text-rose-700 bg-rose-50 border-rose-200';
            statusLabel = 'Needs Focus';
          } else if (percent < 90) {
            statusColor = 'text-amber-700 bg-amber-50 border-amber-200';
            statusLabel = 'Moderate';
          }

          // 7-day sparkline points
          const maxVal = Math.max(config.rda * 1.3, ...last7Days.map(d => dailyNutrientIntake[d][key]));

          return (
            <div
              key={key}
              className="p-4 sm:p-5 rounded-2xl border border-stone-200/90 bg-stone-50/40 hover:bg-white hover:border-teal-300 transition-all flex flex-col justify-between gap-4 shadow-2xs group"
            >
              {/* Card Header */}
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-white border border-stone-200 shadow-2xs flex items-center justify-center text-teal-800">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-editorial text-base font-bold text-stone-900 leading-tight">
                        {config.name}
                      </h4>
                      <span className="text-[10px] uppercase font-semibold text-stone-400">
                        {config.category} · RDA: {config.rda} {config.unit}
                      </span>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor}`}>
                    {statusLabel}
                  </span>
                </div>

                {/* Intake vs RDA */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono-nums text-xl font-bold text-stone-900">
                      {currentVal} <span className="text-xs font-normal text-stone-500">{config.unit}</span>
                    </span>
                    <span className="font-mono-nums text-xs font-semibold text-stone-600">
                      {percent}% of RDA
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        percent >= 90
                          ? 'bg-emerald-600'
                          : percent >= 60
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>
                </div>

                {/* 7-Day Sparkline Cadence */}
                <div className="pt-2">
                  <div className="flex items-center justify-between text-[10px] text-stone-400 pb-1">
                    <span>7-Day Rhythm</span>
                    <span className="font-mono-nums">Target: {config.rda}</span>
                  </div>

                  {/* Micro Bar Chart */}
                  <div className="h-10 flex items-end justify-between gap-1 pt-1 border-b border-stone-200">
                    {last7Days.map((dStr, idx) => {
                      const val = dailyNutrientIntake[dStr][key];
                      const barH = maxVal > 0 ? (val / maxVal) * 100 : 0;
                      const dayLetter = new Date(dStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'narrow' });
                      const isTargetMet = val >= config.rda;

                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group/bar">
                          <div
                            className={`w-full rounded-t-sm transition-all ${
                              isTargetMet ? 'bg-teal-600' : 'bg-stone-300 group-hover/bar:bg-stone-400'
                            }`}
                            style={{ height: `${Math.max(10, barH)}%` }}
                            title={`${dStr}: ${val} ${config.unit}`}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Days labels */}
                  <div className="flex justify-between text-[9px] font-mono-nums text-stone-400 pt-0.5">
                    {last7Days.map((dStr, idx) => (
                      <span key={idx}>
                        {new Date(dStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'narrow' })}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Role Note */}
                <p className="text-[11px] text-stone-500 leading-snug pt-1">
                  <span className="font-medium text-stone-700">Role: </span>
                  {config.role}
                </p>
              </div>

              {/* Actionable Whole-Food Gap Recommendations */}
              <div className="pt-2 border-t border-stone-200/80 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 block">
                  Replenish Gap with Real Food:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {config.topFoodSources.map((food, fIdx) => (
                    <button
                      key={fIdx}
                      type="button"
                      onClick={() => setSelectedNutrient(key)}
                      className="text-[10px] px-2 py-0.5 rounded-lg bg-white border border-stone-200 text-stone-700 hover:border-teal-500 hover:text-teal-900 transition-colors cursor-pointer"
                    >
                      +{food}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Food Source Modal / Drawer */}
      {selectedNutrient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-stone-200 shadow-xl w-full max-w-sm p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center">
                  {React.createElement(NUTRIENT_ICONS[selectedNutrient], { className: 'w-5 h-5' })}
                </div>
                <div>
                  <h4 className="font-editorial text-lg font-bold text-stone-900">
                    {MICRONUTRIENT_RDAS[selectedNutrient].name} Powerhouses
                  </h4>
                  <span className="text-xs text-stone-500">
                    RDA Target: {MICRONUTRIENT_RDAS[selectedNutrient].rda} {MICRONUTRIENT_RDAS[selectedNutrient].unit}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedNutrient(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider block">
                Recommended Whole-Food Sources
              </span>
              <div className="space-y-1.5">
                {MICRONUTRIENT_RDAS[selectedNutrient].topFoodSources.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/80 flex items-center justify-between text-xs text-stone-800 font-medium"
                  >
                    <span>{item}</span>
                    <span className="text-[11px] text-teal-700 font-semibold">Whole Food Rich</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-teal-50/70 border border-teal-100 text-xs space-y-1">
              <span className="font-semibold text-teal-950 block">Scientific Function:</span>
              <p className="text-stone-600 leading-relaxed">
                {MICRONUTRIENT_RDAS[selectedNutrient].role}. Consistent dietary intake avoids the fatigue and metabolic slowdown caused by subclinical deficiencies.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSelectedNutrient(null)}
              className="w-full py-2.5 rounded-xl bg-stone-900 text-white font-medium text-xs hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
