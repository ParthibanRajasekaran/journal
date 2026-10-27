import React, { useState } from 'react';
import { MealEntry, DailyTarget, MealType } from '../types/nutrition';
import {
  Sparkles,
  ChefHat,
  Clock,
  Flame,
  ArrowRight,
  RotateCcw,
  Check,
  Utensils,
  Heart,
  Plus
} from 'lucide-react';

interface NextMealRecommenderProps {
  todayMeals: MealEntry[];
  target: DailyTarget;
  dietaryPreference: string;
  onQuickLogMeal: (suggested: {
    name: string;
    calories: number;
    mealType: MealType;
    macros: { protein: number; carbs: number; fat: number; fiber: number };
    ingredients: Array<{ name: string; portion: string; calories: number; confidence: number }>;
    description: string;
  }) => void;
}

interface MealSuggestion {
  name: string;
  description: string;
  calories: number;
  prepMinutes: number;
  mealType: MealType;
  macros: {
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  ingredients: Array<{
    name: string;
    portion: string;
    calories: number;
  }>;
  fitReason: string;
}

export const NextMealRecommender: React.FC<NextMealRecommenderProps> = ({
  todayMeals,
  target,
  dietaryPreference,
  onQuickLogMeal,
}) => {
  // Current state of step
  // 0 = Initial state / prompt
  // 1 = Hunger Level
  // 2 = Flavor & Craving
  // 3 = Prep Time
  // 4 = Showing Results
  const [step, setStep] = useState<number>(0);
  const [hungerLevel, setHungerLevel] = useState<'light' | 'moderate' | 'hearty'>('moderate');
  const [craving, setCraving] = useState<'savory' | 'fresh' | 'sweet' | 'high-protein'>('savory');
  const [prepTime, setPrepTime] = useState<'quick' | 'medium' | 'cook'>('quick');

  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<MealSuggestion[]>([]);

  // Calculate remaining stats
  const consumedCals = todayMeals.reduce((s, m) => s + (m.calories || 0), 0);
  const consumedProtein = todayMeals.reduce((s, m) => s + (m.macros?.protein || 0), 0);
  const remainingCals = Math.max(250, target.calories - consumedCals);
  const remainingProtein = Math.max(15, target.protein - consumedProtein);

  const fetchSuggestions = async (hunger = hungerLevel, flav = craving, time = prepTime) => {
    setIsLoading(true);
    setStep(4);

    try {
      const res = await fetch('/api/suggest-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hungerLevel: hunger,
          craving: flav,
          prepTime: time,
          remainingCalories: remainingCals,
          remainingProtein: remainingProtein,
          dietaryPreference,
          todayMealsSummary: todayMeals.map(m => m.name).join(', '),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (e) {
      console.warn('Error fetching recommendations:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSurpriseMe = () => {
    fetchSuggestions('moderate', 'savory', 'quick');
  };

  return (
    <section className="bg-white rounded-2xl border border-stone-200/80 p-5 sm:p-6 shadow-xs space-y-4 overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center">
            <ChefHat className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-editorial text-lg font-semibold text-stone-900">
              Next Meal Recommender
            </h3>
            <p className="text-xs text-stone-500">
              Tailored fuel recommendations calibrated to your remaining {remainingCals} kcal
            </p>
          </div>
        </div>

        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(0)}
            className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Step 0: Warm Invitation Card */}
      {step === 0 && (
        <div className="p-5 rounded-2xl bg-linear-to-r from-emerald-50/80 to-stone-50 border border-emerald-100/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 block">
              What is your body asking for next?
            </span>
            <p className="text-xs sm:text-sm text-stone-700 leading-relaxed max-w-lg">
              Answer 3 quick questions about hunger, cravings, and prep time — or let Journal surprise you with a balanced chef's plate.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleSurpriseMe}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-stone-700 hover:bg-white bg-white/70 border border-stone-200/80 transition-colors cursor-pointer"
            >
              Surprise Me
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 transition-colors shadow-xs cursor-pointer"
            >
              <span>Personalize</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Hunger Level */}
      {step === 1 && (
        <div className="space-y-3.5 animate-in fade-in slide-in-from-right-4 duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
              Step 1 of 3: How hungry are you?
            </span>
            <span className="text-xs text-stone-400">Optional</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: 'light' as const, label: 'Light Snack', sub: '200–350 kcal · Quick satiety boost' },
              { id: 'moderate' as const, label: 'Balanced Fuel', sub: '400–600 kcal · Sustained midday plate' },
              { id: 'hearty' as const, label: 'Hearty Plate', sub: '650+ kcal · High nourishment meal' },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setHungerLevel(item.id);
                  setStep(2);
                }}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  hungerLevel === item.id
                    ? 'border-emerald-700 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-700'
                    : 'border-stone-200 bg-stone-50/50 hover:bg-white hover:border-stone-300'
                }`}
              >
                <span className="font-semibold text-xs text-stone-900 block">{item.label}</span>
                <span className="text-[11px] text-stone-500 mt-0.5 block">{item.sub}</span>
              </button>
            ))}
          </div>

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="text-xs text-stone-500 hover:text-stone-800"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Flavor & Craving */}
      {step === 2 && (
        <div className="space-y-3.5 animate-in fade-in slide-in-from-right-4 duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
              Step 2 of 3: What flavor profile do you crave?
            </span>
            <span className="text-xs text-stone-400">Optional</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: 'savory' as const, label: 'Savory & Warm', sub: 'Herbs, roasted, cozy' },
              { id: 'fresh' as const, label: 'Fresh & Crisp', sub: 'Crunchy greens & raw veggies' },
              { id: 'sweet' as const, label: 'Sweet & Wholesome', sub: 'Berries, honey, Greek yogurt' },
              { id: 'high-protein' as const, label: 'Protein Surge', sub: 'Targeted recovery fuel' },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setCraving(item.id);
                  setStep(3);
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  craving === item.id
                    ? 'border-emerald-700 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-700'
                    : 'border-stone-200 bg-stone-50/50 hover:bg-white hover:border-stone-300'
                }`}
              >
                <span className="font-semibold text-xs text-stone-900 block">{item.label}</span>
                <span className="text-[11px] text-stone-500 mt-0.5 block">{item.sub}</span>
              </button>
            ))}
          </div>

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-stone-500 hover:text-stone-800"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Prep Time */}
      {step === 3 && (
        <div className="space-y-3.5 animate-in fade-in slide-in-from-right-4 duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
              Step 3 of 3: How much prep time do you have?
            </span>
            <span className="text-xs text-stone-400">Optional</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: 'quick' as const, label: 'Under 5 Minutes', sub: 'Grab-and-go / assemble bowl' },
              { id: 'medium' as const, label: '10–15 Minutes', sub: 'Quick skillet or stovetop' },
              { id: 'cook' as const, label: '20+ Minutes', sub: 'Full mindful meal cooking' },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setPrepTime(item.id);
                  fetchSuggestions(hungerLevel, craving, item.id);
                }}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  prepTime === item.id
                    ? 'border-emerald-700 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-700'
                    : 'border-stone-200 bg-stone-50/50 hover:bg-white hover:border-stone-300'
                }`}
              >
                <span className="font-semibold text-xs text-stone-900 block">{item.label}</span>
                <span className="text-[11px] text-stone-500 mt-0.5 block">{item.sub}</span>
              </button>
            ))}
          </div>

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-xs text-stone-500 hover:text-stone-800"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => fetchSuggestions(hungerLevel, craving, prepTime)}
              className="text-xs font-semibold px-4 py-2 rounded-xl bg-emerald-800 text-white hover:bg-emerald-900 shadow-xs cursor-pointer"
            >
              Get Suggestions
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Loading & Display Results */}
      {step === 4 && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {isLoading ? (
            <div className="py-10 text-center space-y-3">
              <div className="w-10 h-10 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="font-editorial text-base font-semibold text-stone-800">
                Crafting personalized meal options...
              </p>
              <p className="text-xs text-stone-500">
                Balancing {remainingCals} kcal budget with your craving for {craving} flavors
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-600">
                  Recommended for your remaining {remainingCals} kcal
                </span>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-emerald-800 hover:text-emerald-950 underline font-medium cursor-pointer"
                >
                  Adjust Preferences
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {suggestions.map((sugg, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl border border-stone-200/90 bg-stone-50/50 hover:bg-white hover:border-emerald-300 transition-all flex flex-col justify-between gap-3 shadow-xs"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          <Clock className="w-3 h-3" />
                          {sugg.prepMinutes} min prep
                        </span>

                        <span className="font-mono-nums font-bold text-stone-900 text-sm">
                          {sugg.calories} <span className="text-xs font-normal text-stone-500">kcal</span>
                        </span>
                      </div>

                      <h4 className="font-editorial text-base font-bold text-stone-900 leading-snug">
                        {sugg.name}
                      </h4>
                      <p className="text-xs text-stone-600 leading-relaxed">
                        {sugg.description}
                      </p>

                      {/* Macros */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="font-mono-nums text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-semibold">
                          P: {sugg.macros.protein}g
                        </span>
                        <span className="font-mono-nums text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/60 font-semibold">
                          C: {sugg.macros.carbs}g
                        </span>
                        <span className="font-mono-nums text-[10px] px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200/60 font-semibold">
                          F: {sugg.macros.fat}g
                        </span>
                        <span className="font-mono-nums text-[10px] px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200/60 font-semibold">
                          Fib: {sugg.macros.fiber}g
                        </span>
                      </div>

                      {/* Why it fits note */}
                      <div className="p-2.5 rounded-xl bg-white border border-stone-200/60 text-[11px] text-stone-600 space-y-0.5">
                        <span className="font-semibold text-stone-800 block">Why it fits today:</span>
                        <p>{sugg.fitReason}</p>
                      </div>
                    </div>

                    {/* Quick Log button */}
                    <button
                      type="button"
                      onClick={() => {
                        onQuickLogMeal({
                          name: sugg.name,
                          calories: sugg.calories,
                          mealType: sugg.mealType,
                          macros: sugg.macros,
                          ingredients: sugg.ingredients.map(ing => ({ ...ing, confidence: 92 })),
                          description: sugg.description,
                        });
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Log this Plate</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
