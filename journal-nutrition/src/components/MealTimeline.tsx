import React, { useState } from 'react';
import { MealEntry, MealType } from '../types/nutrition';
import { ConfidenceMeter } from './ConfidenceMeter';
import {
  Coffee,
  Sun,
  Moon,
  Cookie,
  Trash2,
  ChevronDown,
  ChevronUp,
  Tag,
  Sparkles,
  Clock,
  Plus,
  CloudOff,
} from 'lucide-react';

interface MealTimelineProps {
  meals: MealEntry[];
  onDeleteMeal: (id: string) => void;
  onOpenCaptureForMeal: (type: MealType) => void;
}

export const MealTimeline: React.FC<MealTimelineProps> = ({
  meals,
  onDeleteMeal,
  onOpenCaptureForMeal,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const mealCategories: { type: MealType; label: string; icon: React.ComponentType<any>; color: string }[] = [
    { type: 'breakfast', label: 'Breakfast', icon: Coffee, color: 'text-amber-700 bg-amber-50 border-amber-200' },
    { type: 'lunch', label: 'Lunch', icon: Sun, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    { type: 'dinner', label: 'Dinner', icon: Moon, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
    { type: 'snack', label: 'Snacks & Drinks', icon: Cookie, color: 'text-rose-700 bg-rose-50 border-rose-200' },
  ];

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      {mealCategories.map(cat => {
        const categoryMeals = meals.filter(m => m.mealType === cat.type);
        const Icon = cat.icon;
        const totalCals = categoryMeals.reduce((s, m) => s + (m.calories || 0), 0);

        return (
          <div key={cat.type} className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs space-y-4">
            {/* Category Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl border ${cat.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-stone-900 text-sm">
                    {cat.label}
                  </h3>
                  <p className="text-xs text-stone-400">
                    {categoryMeals.length} {categoryMeals.length === 1 ? 'entry' : 'entries'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {totalCals > 0 && (
                  <span className="font-mono-nums text-sm font-semibold text-stone-700">
                    {totalCals} <span className="text-xs font-normal text-stone-400">kcal</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onOpenCaptureForMeal(cat.type)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100/80 px-2.5 py-1.5 rounded-lg border border-emerald-200/60 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log</span>
                </button>
              </div>
            </div>

            {/* Meal Items List */}
            {categoryMeals.length === 0 ? (
              <div
                onClick={() => onOpenCaptureForMeal(cat.type)}
                className="rounded-xl border border-dashed border-stone-200 p-4 text-center hover:border-emerald-400 hover:bg-emerald-50/20 transition-all cursor-pointer group"
              >
                <p className="text-xs text-stone-400 group-hover:text-emerald-800 transition-colors">
                  Nothing logged for {cat.label.toLowerCase()} yet. Tap to snap a photo or speak a note.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {categoryMeals.map(meal => {
                  const isExpanded = expandedId === meal.id;

                  return (
                    <div
                      key={meal.id}
                      className="rounded-xl border border-stone-200/80 hover:border-stone-300 transition-all overflow-hidden bg-stone-50/30"
                    >
                      {/* Main card row */}
                      <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start sm:items-center gap-3">
                          {/* Meal photo thumbnail or fallback icon */}
                          {meal.photoUrl ? (
                            <img
                              src={meal.photoUrl}
                              alt={meal.name}
                              className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-stone-200 shrink-0 shadow-2xs"
                            />
                          ) : (
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-400 shrink-0">
                              <Sparkles className="w-6 h-6 text-stone-300" />
                            </div>
                          )}

                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-semibold text-stone-900 text-sm leading-tight">
                                {meal.name}
                              </h4>
                              {meal.syncStatus === 'pending_sync' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-200">
                                  <CloudOff className="w-2.5 h-2.5" />
                                  <span>Offline Queued</span>
                                </span>
                              )}
                              <ConfidenceMeter
                                score={meal.confidenceScore}
                                level={meal.confidenceLevel}
                                reason={meal.confidenceReason}
                                compact={true}
                              />
                            </div>

                            {/* Timestamp & description snippet */}
                            <div className="flex items-center gap-2 text-xs text-stone-500">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTime(meal.timestamp)}
                              </span>
                              {meal.description && (
                                <>
                                  <span>·</span>
                                  <span className="line-clamp-1 italic text-stone-500 max-w-xs sm:max-w-md">
                                    "{meal.description}"
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Macro badges */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              <span className="font-mono-nums text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-medium">
                                P: {meal.macros.protein}g
                              </span>
                              <span className="font-mono-nums text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/60 font-medium">
                                C: {meal.macros.carbs}g
                              </span>
                              <span className="font-mono-nums text-[11px] px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200/60 font-medium">
                                F: {meal.macros.fat}g
                              </span>
                              {meal.macros.fiber > 0 && (
                                <span className="font-mono-nums text-[11px] px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200/60 font-medium">
                                  Fib: {meal.macros.fiber}g
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Calories & Action buttons */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                          <div className="text-left sm:text-right">
                            <span className="font-mono-nums text-lg font-bold text-stone-900 block leading-tight">
                              {meal.calories} <span className="text-xs font-normal text-stone-500">kcal</span>
                            </span>
                            {meal.calorieRange && (
                              <span className="text-[10px] text-stone-400 block font-mono-nums">
                                ~{meal.calorieRange.min}–{meal.calorieRange.max}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => toggleExpand(meal.id)}
                              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 transition-colors cursor-pointer"
                              title="Toggle ingredient details"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => onDeleteMeal(meal.id)}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete meal entry"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expandable details: Ingredients deconstruction & Wellness notes */}
                      {isExpanded && (
                        <div className="p-4 bg-white border-t border-stone-200/70 space-y-3.5 text-xs animate-in fade-in duration-200">
                          {/* Confidence details */}
                          <ConfidenceMeter
                            score={meal.confidenceScore}
                            level={meal.confidenceLevel}
                            reason={meal.confidenceReason}
                            clarifications={meal.clarificationPrompts}
                          />

                          {/* Ingredient Deconstruction */}
                          {meal.ingredients && meal.ingredients.length > 0 && (
                            <div className="space-y-2">
                              <span className="font-semibold text-stone-700 uppercase tracking-wider text-[11px]">
                                Deconstructed Ingredients
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {meal.ingredients.map((ing, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center justify-between p-2 rounded-lg bg-stone-50 border border-stone-200/60"
                                  >
                                    <div>
                                      <p className="font-medium text-stone-800">{ing.name}</p>
                                      <p className="text-[11px] text-stone-400">{ing.portion}</p>
                                    </div>
                                    <div className="text-right">
                                      <span className="font-mono-nums font-semibold text-stone-700">
                                        {ing.calories} kcal
                                      </span>
                                      <span className="block text-[10px] text-emerald-700 font-mono-nums">
                                        {ing.confidence}% match
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Wellness Notes & Dietary tags */}
                          {meal.wellnessNotes && (
                            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 text-stone-700">
                              <span className="font-semibold text-emerald-900 block mb-1">
                                Nutritional Coaching Note:
                              </span>
                              <p className="leading-relaxed text-stone-600">{meal.wellnessNotes}</p>
                            </div>
                          )}

                          {meal.dietaryTags && meal.dietaryTags.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <Tag className="w-3 h-3 text-stone-400" />
                              {meal.dietaryTags.map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
