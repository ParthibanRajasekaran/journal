import React, { useState } from 'react';
import { MealEntry, DailyTarget, MealType } from '../types/nutrition';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Lock,
  Unlock,
  CheckCircle2,
  Clock,
  Coffee,
  Sun,
  Moon,
  Cookie,
  Crown,
  TrendingUp,
  Filter
} from 'lucide-react';

interface DailyMealTrackRecordProps {
  meals: MealEntry[];
  target: DailyTarget;
  isProUnlocked: boolean;
  onTogglePro: () => void;
  onSelectDate: (date: string) => void;
}

export const DailyMealTrackRecord: React.FC<DailyMealTrackRecordProps> = ({
  meals,
  target,
  isProUnlocked,
  onTogglePro,
  onSelectDate,
}) => {
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [selectedRange, setSelectedRange] = useState<'7' | '14' | '30' | '90'>('7');

  // Group meals by date
  const groupedMeals: Record<string, MealEntry[]> = {};
  meals.forEach(m => {
    if (!groupedMeals[m.date]) {
      groupedMeals[m.date] = [];
    }
    groupedMeals[m.date].push(m);
  });

  // Sort dates descending
  const allDates = Object.keys(groupedMeals).sort((a, b) => b.localeCompare(a));

  // Determine limit based on selected range and Pro status
  let limit = 7;
  if (selectedRange === '14') limit = 14;
  if (selectedRange === '30') limit = 30;
  if (selectedRange === '90') {
    limit = isProUnlocked ? 90 : 14; // locked without pro
  }

  const visibleDates = allDates.slice(0, limit);

  const toggleExpand = (date: string) => {
    setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }));
  };

  const getMealCategoryColor = (type: MealType) => {
    switch (type) {
      case 'breakfast':
        return { bg: 'bg-amber-500', text: 'text-amber-800', lightBg: 'bg-amber-50', icon: Coffee };
      case 'lunch':
        return { bg: 'bg-emerald-600', text: 'text-emerald-800', lightBg: 'bg-emerald-50', icon: Sun };
      case 'dinner':
        return { bg: 'bg-indigo-600', text: 'text-indigo-800', lightBg: 'bg-indigo-50', icon: Moon };
      case 'snack':
        return { bg: 'bg-rose-500', text: 'text-rose-800', lightBg: 'bg-rose-50', icon: Cookie };
    }
  };

  return (
    <div className="space-y-6">
      {/* Journal Pro 3-Month Archive Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-linear-to-r from-stone-900 via-stone-850 to-stone-900 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-400 text-stone-950">
                <Crown className="w-3.5 h-3.5" />
                Journal Pro
              </span>
              <span className="text-xs text-stone-400">Quarterly Intelligence</span>
            </div>
            <h3 className="font-editorial text-xl font-bold tracking-tight text-white">
              3-Month Historical Track Record
            </h3>
            <p className="text-xs text-stone-300 max-w-xl leading-relaxed">
              Analyze 90 days of meal trends, macro shifts, and metabolic consistency across Breakfast, Lunch, Dinner, and Snacks.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onTogglePro}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-sm cursor-pointer ${
                isProUnlocked
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isProUnlocked ? (
                <>
                  <Unlock className="w-4 h-4 text-emerald-300" />
                  <span>Pro Unlocked (90 Days Active)</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Unlock 3-Month Archive</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-editorial text-lg font-semibold text-stone-900">
            Daily Intake Record by Meal
          </h3>
          <p className="text-xs text-stone-500">
            Visual breakdown of calories distributed through each meal
          </p>
        </div>

        {/* Range selectors */}
        <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200/80 text-xs font-medium">
          <button
            type="button"
            onClick={() => setSelectedRange('7')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              selectedRange === '7' ? 'bg-white text-stone-900 shadow-xs font-semibold' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            7 Days
          </button>
          <button
            type="button"
            onClick={() => setSelectedRange('14')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              selectedRange === '14' ? 'bg-white text-stone-900 shadow-xs font-semibold' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            14 Days
          </button>
          <button
            type="button"
            onClick={() => setSelectedRange('30')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              selectedRange === '30' ? 'bg-white text-stone-900 shadow-xs font-semibold' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            30 Days
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedRange('90');
              if (!isProUnlocked) {
                onTogglePro();
              }
            }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              selectedRange === '90'
                ? 'bg-stone-900 text-white shadow-xs font-semibold'
                : 'text-stone-700 hover:text-stone-900'
            }`}
          >
            <Crown className="w-3 h-3 text-amber-500" />
            <span>3 Months (Pro)</span>
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-stone-600 p-3 rounded-xl bg-stone-50 border border-stone-200/60">
        <span className="font-semibold text-stone-500 uppercase tracking-wider text-[10px]">Meal Distribution:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span>Breakfast</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
          <span>Lunch</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
          <span>Dinner</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          <span>Snacks</span>
        </div>
      </div>

      {/* Day Cards List */}
      <div className="space-y-3.5">
        {visibleDates.map(dateStr => {
          const dayMeals = groupedMeals[dateStr] || [];
          const totalCalories = dayMeals.reduce((s, m) => s + (m.calories || 0), 0);
          const totalProtein = dayMeals.reduce((s, m) => s + (m.macros?.protein || 0), 0);
          const totalFiber = dayMeals.reduce((s, m) => s + (m.macros?.fiber || 0), 0);

          // Meal category totals
          const breakfastCals = dayMeals.filter(m => m.mealType === 'breakfast').reduce((s, m) => s + (m.calories || 0), 0);
          const lunchCals = dayMeals.filter(m => m.mealType === 'lunch').reduce((s, m) => s + (m.calories || 0), 0);
          const dinnerCals = dayMeals.filter(m => m.mealType === 'dinner').reduce((s, m) => s + (m.calories || 0), 0);
          const snackCals = dayMeals.filter(m => m.mealType === 'snack').reduce((s, m) => s + (m.calories || 0), 0);

          const isExpanded = !!expandedDates[dateStr];
          const dObj = new Date(dateStr + 'T12:00:00');
          const dateTitle = dObj.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });

          return (
            <div
              key={dateStr}
              className="bg-white rounded-2xl border border-stone-200/80 hover:border-stone-300 transition-all overflow-hidden shadow-xs"
            >
              {/* Day Header Row */}
              <div
                onClick={() => toggleExpand(dateStr)}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-stone-50/40 transition-colors"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-stone-400" />
                    <span className="font-editorial text-base font-bold text-stone-900">
                      {dateTitle}
                    </span>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onSelectDate(dateStr);
                      }}
                      className="text-[11px] font-medium text-emerald-700 hover:text-emerald-900 underline ml-1 cursor-pointer"
                    >
                      View in Daily Log
                    </button>
                  </div>

                  {/* Multi-segmented Stacked Calorie Bar */}
                  <div className="w-full bg-stone-100 h-3 rounded-full overflow-hidden flex">
                    {totalCalories > 0 && (
                      <>
                        <div
                          className="bg-amber-500 h-full transition-all"
                          style={{ width: `${(breakfastCals / totalCalories) * 100}%` }}
                          title={`Breakfast: ${breakfastCals} kcal`}
                        />
                        <div
                          className="bg-emerald-600 h-full transition-all"
                          style={{ width: `${(lunchCals / totalCalories) * 100}%` }}
                          title={`Lunch: ${lunchCals} kcal`}
                        />
                        <div
                          className="bg-indigo-600 h-full transition-all"
                          style={{ width: `${(dinnerCals / totalCalories) * 100}%` }}
                          title={`Dinner: ${dinnerCals} kcal`}
                        />
                        <div
                          className="bg-rose-500 h-full transition-all"
                          style={{ width: `${(snackCals / totalCalories) * 100}%` }}
                          title={`Snacks: ${snackCals} kcal`}
                        />
                      </>
                    )}
                  </div>

                  {/* Per-meal caloric chips */}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono-nums pt-0.5">
                    {breakfastCals > 0 && (
                      <span className="text-amber-800 font-medium">B: {breakfastCals} kcal</span>
                    )}
                    {lunchCals > 0 && (
                      <span className="text-emerald-800 font-medium">L: {lunchCals} kcal</span>
                    )}
                    {dinnerCals > 0 && (
                      <span className="text-indigo-800 font-medium">D: {dinnerCals} kcal</span>
                    )}
                    {snackCals > 0 && (
                      <span className="text-rose-800 font-medium">S: {snackCals} kcal</span>
                    )}
                  </div>
                </div>

                {/* Day Total and Expand Toggle */}
                <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                  <div className="text-left sm:text-right">
                    <span className="font-mono-nums text-lg font-bold text-stone-900 block leading-tight">
                      {totalCalories} <span className="text-xs font-normal text-stone-500">kcal</span>
                    </span>
                    <span className="text-[11px] font-mono-nums text-stone-500 block">
                      P: {totalProtein}g · Fib: {totalFiber}g
                    </span>
                  </div>

                  <div className="p-1 rounded-lg text-stone-400 group-hover:text-stone-700">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
              </div>

              {/* Expanded Meals Breakdown */}
              {isExpanded && (
                <div className="p-4 bg-stone-50/70 border-t border-stone-200/70 space-y-2.5 animate-in fade-in duration-200">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 block">
                    Individual Meals Logged ({dayMeals.length})
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {dayMeals.map(meal => {
                      const catConfig = getMealCategoryColor(meal.mealType);
                      const Icon = catConfig.icon;

                      return (
                        <div
                          key={meal.id}
                          className="p-3 rounded-xl bg-white border border-stone-200/80 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            {meal.photoUrl ? (
                              <img
                                src={meal.photoUrl}
                                alt={meal.name}
                                className="w-11 h-11 rounded-lg object-cover border border-stone-200 shrink-0"
                              />
                            ) : (
                              <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 border ${catConfig.lightBg} ${catConfig.text}`}>
                                <Icon className="w-4 h-4" />
                              </div>
                            )}

                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded border ${catConfig.lightBg} ${catConfig.text}`}>
                                  {meal.mealType}
                                </span>
                                <h5 className="font-medium text-stone-900 line-clamp-1">
                                  {meal.name}
                                </h5>
                              </div>
                              <span className="text-[11px] text-stone-400 font-mono-nums">
                                P: {meal.macros.protein}g · C: {meal.macros.carbs}g · F: {meal.macros.fat}g
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-mono-nums font-bold text-stone-900">
                              {meal.calories} kcal
                            </span>
                            <span className="block text-[10px] text-emerald-700 font-mono-nums">
                              {meal.confidenceScore}% conf
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
