import React from 'react';
import { DailyTarget, MealEntry } from '../types/nutrition';
import { Droplet, Flame, Sparkles, TrendingUp, Info } from 'lucide-react';

interface AdaptiveDailyHeaderProps {
  meals: MealEntry[];
  target: DailyTarget;
  waterIntakeMl: number;
  onUpdateWater: (newMl: number) => void;
  dateStr: string;
}

export const AdaptiveDailyHeader: React.FC<AdaptiveDailyHeaderProps> = ({
  meals,
  target,
  waterIntakeMl,
  onUpdateWater,
  dateStr,
}) => {
  // Aggregate daily totals
  const totalCalories = meals.reduce((sum, m) => sum + (m.calories || 0), 0);
  const totalProtein = meals.reduce((sum, m) => sum + (m.macros?.protein || 0), 0);
  const totalCarbs = meals.reduce((sum, m) => sum + (m.macros?.carbs || 0), 0);
  const totalFat = meals.reduce((sum, m) => sum + (m.macros?.fat || 0), 0);
  const totalFiber = meals.reduce((sum, m) => sum + (m.macros?.fiber || 0), 0);

  const calRemaining = Math.max(0, target.calories - totalCalories);
  const calPercent = Math.min(100, Math.round((totalCalories / target.calories) * 100));

  // Concentric 4-Ring Visual Progress Component (Calories, Protein, Carbs, Fat)
  const rCal = 68;
  const cCal = 2 * Math.PI * rCal;
  const calOffset = cCal - (calPercent / 100) * cCal;

  const proteinPercent = Math.min(100, Math.round((totalProtein / Math.max(1, target.protein)) * 100));
  const rProtein = 55;
  const cProtein = 2 * Math.PI * rProtein;
  const proteinOffset = cProtein - (proteinPercent / 100) * cProtein;

  const carbsPercent = Math.min(100, Math.round((totalCarbs / Math.max(1, target.carbs)) * 100));
  const rCarbs = 42;
  const cCarbs = 2 * Math.PI * rCarbs;
  const carbsOffset = cCarbs - (carbsPercent / 100) * cCarbs;

  const fatPercent = Math.min(100, Math.round((totalFat / Math.max(1, target.fat)) * 100));
  const rFat = 29;
  const cFat = 2 * Math.PI * rFat;
  const fatOffset = cFat - (fatPercent / 100) * cFat;

  // Adaptive smart pacing deduction
  const getPacingMessage = () => {
    if (!target.adaptiveMode) return `${calRemaining} kcal remaining`;
    if (totalCalories === 0) return 'Ready for nourishing breakfast fuel';
    if (totalCalories < target.calories * 0.4) {
      return `Light morning intake · ${calRemaining} kcal pacing for lunch & dinner`;
    }
    if (totalCalories < target.calories * 0.75) {
      return `Balanced pacing · ${calRemaining} kcal reserved for dinner`;
    }
    if (totalCalories <= target.calories) {
      return `Target nearly achieved · ${calRemaining} kcal light evening snack allowance`;
    }
    const over = totalCalories - target.calories;
    return `Generous fuel day (+${over} kcal) · Focus on hydration & movement`;
  };

  return (
    <section className="bg-white rounded-2xl border border-stone-200/80 p-5 sm:p-6 shadow-xs space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Left: Concentric Multi-Ring Progress & Adaptive Stat */}
        <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6 w-full md:w-auto">
          {/* Concentric SVG Rings for Calorie, Protein, Carbs, Fat */}
          <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
              {/* Outer Ring: Calories */}
              <circle cx="80" cy="80" r={rCal} stroke="#f1f5f9" strokeWidth="6" fill="transparent" />
              <circle
                cx="80"
                cy="80"
                r={rCal}
                stroke={totalCalories > target.calories ? '#d97706' : '#059669'}
                strokeWidth="6"
                strokeDasharray={cCal}
                strokeDashoffset={calOffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-700 ease-out"
              />

              {/* Middle Ring 1: Protein */}
              <circle cx="80" cy="80" r={rProtein} stroke="#f1f5f9" strokeWidth="5.5" fill="transparent" />
              <circle
                cx="80"
                cy="80"
                r={rProtein}
                stroke="#3b82f6"
                strokeWidth="5.5"
                strokeDasharray={cProtein}
                strokeDashoffset={proteinOffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-700 ease-out"
              />

              {/* Middle Ring 2: Carbs */}
              <circle cx="80" cy="80" r={rCarbs} stroke="#f1f5f9" strokeWidth="5.5" fill="transparent" />
              <circle
                cx="80"
                cy="80"
                r={rCarbs}
                stroke="#f59e0b"
                strokeWidth="5.5"
                strokeDasharray={cCarbs}
                strokeDashoffset={carbsOffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-700 ease-out"
              />

              {/* Innermost Ring: Fat */}
              <circle cx="80" cy="80" r={rFat} stroke="#f1f5f9" strokeWidth="5" fill="transparent" />
              <circle
                cx="80"
                cy="80"
                r={rFat}
                stroke="#f43f5e"
                strokeWidth="5"
                strokeDasharray={cFat}
                strokeDashoffset={fatOffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-700 ease-out"
              />
            </svg>

            {/* Ring Center */}
            <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="font-mono-nums text-xl font-bold tracking-tight text-stone-900 leading-none">
                {totalCalories}
              </span>
              <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider pt-0.5">
                kcal
              </span>
            </div>
          </div>

          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Daily Nutrition Progress
              </span>
              {target.adaptiveMode && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                  <Sparkles className="w-2.5 h-2.5" />
                  Adaptive
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-2">
              <span className="font-editorial text-3xl font-semibold text-stone-900">
                {calRemaining}
              </span>
              <span className="text-sm font-medium text-stone-500">
                kcal {totalCalories > target.calories ? 'above goal' : 'remaining'}
              </span>
            </div>

            {/* Concentric Ring Legends */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] pt-1">
              <span className="inline-flex items-center gap-1 text-emerald-800 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
                Cal: {calPercent}%
              </span>
              <span className="inline-flex items-center gap-1 text-blue-800 font-medium">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                Protein: {proteinPercent}%
              </span>
              <span className="inline-flex items-center gap-1 text-amber-800 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                Carbs: {carbsPercent}%
              </span>
              <span className="inline-flex items-center gap-1 text-rose-800 font-medium">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                Fat: {fatPercent}%
              </span>
            </div>

            <p className="text-xs text-stone-600 flex items-center gap-1.5 pt-0.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>{getPacingMessage()}</span>
            </p>
          </div>
        </div>

        {/* Right: Water Hydration Tracker */}
        <div className="w-full md:w-64 bg-sky-50/60 rounded-xl p-3.5 border border-sky-100 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sky-900 font-semibold text-xs">
              <Droplet className="w-4 h-4 text-sky-600 fill-sky-200" />
              <span>Hydration</span>
            </div>
            <span className="font-mono-nums text-xs font-bold text-sky-900">
              {waterIntakeMl} / {target.waterGoalMl} ml
            </span>
          </div>

          <div className="w-full bg-sky-200/60 h-2 rounded-full overflow-hidden">
            <div
              className="bg-sky-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (waterIntakeMl / target.waterGoalMl) * 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onUpdateWater(Math.max(0, waterIntakeMl - 250))}
              disabled={waterIntakeMl <= 0}
              className="text-[11px] px-2 py-1 rounded-lg bg-white/80 hover:bg-white text-stone-600 disabled:opacity-40 transition-colors border border-sky-200/60 cursor-pointer"
            >
              -250 ml
            </button>
            <span className="text-[11px] text-sky-800/80">
              {Math.round(waterIntakeMl / 250)} glasses
            </span>
            <button
              type="button"
              onClick={() => onUpdateWater(waterIntakeMl + 250)}
              className="text-[11px] px-2 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium transition-colors shadow-2xs cursor-pointer"
            >
              +250 ml
            </button>
          </div>
        </div>
      </div>

      {/* Macronutrient Tri-Bars + Fiber */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-stone-100">
        {/* Protein */}
        <div className="p-3 rounded-xl bg-stone-50/70 border border-stone-200/60 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-stone-600">Protein</span>
            <span className="font-mono-nums font-semibold text-emerald-800">
              {totalProtein}g <span className="text-stone-400 font-normal">/ {target.protein}g</span>
            </span>
          </div>
          <div className="w-full bg-stone-200/80 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-700 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (totalProtein / target.protein) * 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-stone-500">
            {Math.round((totalProtein / target.protein) * 100)}% target
          </p>
        </div>

        {/* Carbs */}
        <div className="p-3 rounded-xl bg-stone-50/70 border border-stone-200/60 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-stone-600">Carbs</span>
            <span className="font-mono-nums font-semibold text-amber-800">
              {totalCarbs}g <span className="text-stone-400 font-normal">/ {target.carbs}g</span>
            </span>
          </div>
          <div className="w-full bg-stone-200/80 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-amber-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (totalCarbs / target.carbs) * 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-stone-500">
            {Math.round((totalCarbs / target.carbs) * 100)}% target
          </p>
        </div>

        {/* Fat */}
        <div className="p-3 rounded-xl bg-stone-50/70 border border-stone-200/60 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-stone-600">Healthy Fats</span>
            <span className="font-mono-nums font-semibold text-rose-800">
              {totalFat}g <span className="text-stone-400 font-normal">/ {target.fat}g</span>
            </span>
          </div>
          <div className="w-full bg-stone-200/80 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-rose-600/80 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (totalFat / target.fat) * 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-stone-500">
            {Math.round((totalFat / target.fat) * 100)}% target
          </p>
        </div>

        {/* Fiber */}
        <div className="p-3 rounded-xl bg-stone-50/70 border border-stone-200/60 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-stone-600">Fiber (Microbiome)</span>
            <span className="font-mono-nums font-semibold text-teal-800">
              {totalFiber}g <span className="text-stone-400 font-normal">/ {target.fiber}g</span>
            </span>
          </div>
          <div className="w-full bg-stone-200/80 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-teal-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (totalFiber / target.fiber) * 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-stone-500">
            {Math.round((totalFiber / target.fiber) * 100)}% target
          </p>
        </div>
      </div>
    </section>
  );
};
