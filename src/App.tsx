import React, { useState, useEffect } from 'react';
import { MealEntry, DailyTarget, CoachInsight, MealType, UserPreferences } from './types/nutrition';
import {
  DEFAULT_TARGET,
  INITIAL_COACH_INSIGHT,
  getSeedMeals,
  generateQuarterlyHistory,
  getTodayDateString,
} from './data/seedMeals';
import { Header } from './components/Header';
import { AdaptiveDailyHeader } from './components/AdaptiveDailyHeader';
import { CoachBanner } from './components/CoachBanner';
import { NextMealRecommender } from './components/NextMealRecommender';
import { MealTimeline } from './components/MealTimeline';
import { AnalyticsView } from './components/AnalyticsView';
import { HybridCaptureModal } from './components/HybridCaptureModal';
import { SettingsModal } from './components/SettingsModal';
import { LegalMedicalDisclaimerModal } from './components/LegalMedicalDisclaimerModal';
import { SmartHydrationBanner } from './components/SmartHydrationBanner';
import { ProTipCard } from './components/ProTipCard';
import { ProTipData } from './types/nutrition';
import { BiometricLockScreen } from './components/BiometricLockScreen';
import { isBiometricLockEnabled } from './services/biometricAuth';
import { parseIncomingDeepLink } from './utils/deepLinkHandler';
import {
  initSQLite,
  getAllMealsFromSQLite,
  saveMealToSQLite,
  deleteMealFromSQLite,
} from './db/sqliteManager';
import {
  subscribeToMealUpdates,
  getEffectiveOnlineStatus,
  triggerBackgroundSync,
} from './utils/syncManager';
import { Plus, Camera, Mic } from 'lucide-react';

export default function App() {
  const todayStr = getTodayDateString();
  const [isLocked, setIsLocked] = useState<boolean>(() => isBiometricLockEnabled());

  // 1. Persistent meals state
  const [meals, setMeals] = useState<MealEntry[]>(() => {
    try {
      const saved = localStorage.getItem('journal_meals_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Error reading saved meals', e);
    }
    // Initialize with rich 90-day data so track record and badges are alive
    return generateQuarterlyHistory();
  });

  // 2. Persistent target state
  const [target, setTarget] = useState<DailyTarget>(() => {
    try {
      const saved = localStorage.getItem('journal_target_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Error reading saved target', e);
    }
    return DEFAULT_TARGET;
  });

  // 3. Persistent dietary philosophy
  const [dietaryPref, setDietaryPref] = useState<UserPreferences['dietaryPreference']>(() => {
    try {
      const saved = localStorage.getItem('journal_pref_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return 'Mindful Omnivore';
  });

  // 4. Persistent water intake map { "YYYY-MM-DD": 1500 }
  const [waterMap, setWaterMap] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('journal_water_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { [todayStr]: 2500 };
  });

  // 5. Persistent coaching insight
  const [coachInsight, setCoachInsight] = useState<CoachInsight>(() => {
    try {
      const saved = localStorage.getItem('journal_coach_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_COACH_INSIGHT;
  });

  // 6. Pro feature unlocked toggle
  const [isProUnlocked, setIsProUnlocked] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('journal_pro_v1');
      if (saved !== null) return JSON.parse(saved);
    } catch {}
    return true; // Default unlocked so users can immediately test the 3-month feature
  });

  // 7. AI Pro-Tip state (Food pairings & smart ingredient swaps)
  const [proTip, setProTip] = useState<ProTipData>({
    id: 'tip-starter',
    type: 'pairing',
    headline: 'Fat-Soluble Synergy',
    contextMealName: 'Based on your Avocado & Poached Eggs',
    tip: 'The healthy monounsaturated lipids in avocado and egg yolks allow your body to absorb fat-soluble carotenoids (lutein & zeaxanthin) that shield your vision.',
    benefit: 'Max Eye Health Synergy',
    timestamp: new Date().toISOString(),
  });
  const [isProTipLoading, setIsProTipLoading] = useState(false);

  const fetchProTip = async (mealsToInspect: MealEntry[]) => {
    setIsProTipLoading(true);
    try {
      const res = await fetch('/api/pro-tip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recentMeals: mealsToInspect.slice(0, 3),
          dietaryPreference: dietaryPref,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.headline) {
          setProTip(data);
        }
      }
    } catch (e) {
      console.warn('Pro-tip update note:', e);
    } finally {
      setIsProTipLoading(false);
    }
  };

  // 8. Navigation and modal states
  const [currentDate, setCurrentDate] = useState<string>(todayStr);
  const [activeTab, setActiveTab] = useState<'log' | 'analytics' | 'settings'>('log');
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [captureMealType, setCaptureMealType] = useState<MealType>('lunch');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDisclaimerOpen, setIsDisclaimerOpen] = useState(false);

  // Check incoming assistant deep link (Siri / Claude / URL Scheme)
  useEffect(() => {
    const payload = parseIncomingDeepLink();
    if (payload) {
      if (payload.action === 'log') {
        if (payload.mealType) setCaptureMealType(payload.mealType);
        setIsCaptureOpen(true);
      } else if (payload.action === 'quick-water') {
        const ml = payload.waterMl || 250;
        setWaterMap(prev => ({
          ...prev,
          [todayStr]: (prev[todayStr] || 0) + ml,
        }));
      }
    }
  }, []);

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem('journal_meals_v2', JSON.stringify(meals));
    } catch (e) {
      console.warn('Failed to save meals to localStorage', e);
    }
  }, [meals]);

  useEffect(() => {
    try {
      localStorage.setItem('journal_target_v1', JSON.stringify(target));
    } catch (e) {}
  }, [target]);

  useEffect(() => {
    try {
      localStorage.setItem('journal_pref_v1', JSON.stringify(dietaryPref));
    } catch (e) {}
  }, [dietaryPref]);

  useEffect(() => {
    try {
      localStorage.setItem('journal_water_v1', JSON.stringify(waterMap));
    } catch (e) {}
  }, [waterMap]);

  useEffect(() => {
    try {
      localStorage.setItem('journal_coach_v1', JSON.stringify(coachInsight));
    } catch (e) {}
  }, [coachInsight]);

  useEffect(() => {
    try {
      localStorage.setItem('journal_pro_v1', JSON.stringify(isProUnlocked));
    } catch (e) {}
  }, [isProUnlocked]);

  // Meals for currently selected date
  const currentDayMeals = meals.filter(m => m.date === currentDate);
  const currentWaterMl = waterMap[currentDate] || 0;

  const handleUpdateWater = (newMl: number) => {
    setWaterMap(prev => ({
      ...prev,
      [currentDate]: newMl,
    }));
  };

  // Initialize SQLite WebAssembly storage & subscribe to background sync
  useEffect(() => {
    let isMounted = true;
    initSQLite()
      .then(() => {
        if (!isMounted) return;
        const sqliteMeals = getAllMealsFromSQLite();
        if (sqliteMeals.length > 0) {
          setMeals(sqliteMeals);
        }
        // If online, check for any pending sync items immediately
        if (getEffectiveOnlineStatus()) {
          triggerBackgroundSync();
        }
      })
      .catch((err) => {
        console.warn('[SQLite] Initialization note:', err);
      });

    const unsubscribe = subscribeToMealUpdates((updatedMeals) => {
      if (isMounted) {
        setMeals(updatedMeals);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const handleTogglePro = () => {
    const nextState = !isProUnlocked;
    setIsProUnlocked(nextState);
    if (nextState && meals.length < 20) {
      const quarterly = generateQuarterlyHistory();
      setMeals(quarterly);
      quarterly.forEach(m => saveMealToSQLite(m, 'synced', false));
    }
  };

  const handleSaveMeal = (newMeal: MealEntry) => {
    // 1. Persist directly to local SQLite database
    saveMealToSQLite(newMeal, newMeal.syncStatus || 'synced', newMeal.isOfflineOptimistic || false);

    // 2. Update React memory state
    setMeals(prev => [newMeal, ...prev.filter(m => m.id !== newMeal.id)]);

    // 3. Proactively update coaching card in background if online
    if (newMeal.date === todayStr && getEffectiveOnlineStatus()) {
      const updatedTodayMeals = [newMeal, ...meals.filter(m => m.date === todayStr)];
      fetch('/api/coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          todayMeals: updatedTodayMeals,
          dailyTarget: target,
          timeOfDay: new Date().getHours() < 14 ? 'afternoon' : 'evening',
        }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.headline) {
            setCoachInsight({ ...data, updatedAt: new Date().toISOString() });
          }
        })
        .catch(err => console.warn('Background coach update notice:', err));
    }

    // 4. Proactively refresh AI Pro-Tip for ingredient swaps and pairings if online
    if (getEffectiveOnlineStatus()) {
      fetchProTip([newMeal, ...meals]);
    }
  };

  const handleQuickLogSuggestedMeal = (suggested: {
    name: string;
    calories: number;
    mealType: MealType;
    macros: { protein: number; carbs: number; fat: number; fiber: number };
    ingredients: Array<{ name: string; portion: string; calories: number; confidence: number }>;
    description: string;
  }) => {
    const newEntry: MealEntry = {
      id: `sugg-${Date.now()}`,
      name: suggested.name,
      mealType: suggested.mealType,
      timestamp: `${currentDate}T${new Date().toTimeString().slice(0, 8)}.000Z`,
      date: currentDate,
      description: suggested.description,
      calories: suggested.calories,
      calorieRange: { min: Math.round(suggested.calories * 0.95), max: Math.round(suggested.calories * 1.05) },
      macros: suggested.macros,
      ingredients: suggested.ingredients,
      confidenceScore: 92,
      confidenceLevel: 'high',
      confidenceReason: 'Chef recommendation with specified portions and ingredients.',
      clarificationPrompts: [],
      wellnessNotes: 'Wholesome personalized recommendation aligned with daily calorie target.',
      dietaryTags: ['Chef Recommendation', 'Target Aligned'],
    };

    handleSaveMeal(newEntry);
  };

  const handleDeleteMeal = (id: string) => {
    deleteMealFromSQLite(id);
    setMeals(prev => prev.filter(m => m.id !== id));
  };

  const handleOpenCaptureForMeal = (type: MealType) => {
    setCaptureMealType(type);
    setIsCaptureOpen(true);
  };

  const handleResetSeedData = () => {
    setMeals(generateQuarterlyHistory());
    setTarget(DEFAULT_TARGET);
    setCoachInsight(INITIAL_COACH_INSIGHT);
    setWaterMap({ [todayStr]: 2500 });
  };

  if (isLocked) {
    return <BiometricLockScreen onUnlock={() => setIsLocked(false)} />;
  }

  return (
    <div className="min-h-screen bg-[#FBFBFA] flex flex-col selection:bg-emerald-100 selection:text-emerald-900">
      {/* Top Navigation & Date Bar */}
      <Header
        currentDate={currentDate}
        onSelectDate={setCurrentDate}
        onOpenCapture={() => {
          setCaptureMealType('lunch');
          setIsCaptureOpen(true);
        }}
        activeTab={activeTab}
        onChangeTab={tab => {
          if (tab === 'settings') {
            setIsSettingsOpen(true);
          } else {
            setActiveTab(tab);
          }
        }}
        onLockApp={() => setIsLocked(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {activeTab === 'log' ? (
          <>
            {/* 1. Proactive AI Coaching Banner (Strategic Moat #2) */}
            <CoachBanner
              insight={coachInsight}
              meals={currentDayMeals}
              target={target}
              onUpdateInsight={setCoachInsight}
            />

            {/* 2. Adaptive Daily Target Calorie Ring & Tri-Macros */}
            <AdaptiveDailyHeader
              meals={currentDayMeals}
              target={target}
              waterIntakeMl={currentWaterMl}
              onUpdateWater={handleUpdateWater}
              dateStr={currentDate}
            />

            {/* Smart Hydration Notification & Circadian Intake Tracker */}
            <SmartHydrationBanner
              currentMl={currentWaterMl}
              targetMl={target.waterGoalMl}
              onAddWater={(add) => handleUpdateWater(currentWaterMl + add)}
            />

            {/* 3. Next Meal Recommender (Interactive animated questionnaire) */}
            <NextMealRecommender
              todayMeals={currentDayMeals}
              target={target}
              dietaryPreference={dietaryPref}
              onQuickLogMeal={handleQuickLogSuggestedMeal}
            />

            {/* 4. Meal Category Timeline & Deconstructed Ingredient Drawers */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-editorial text-xl font-semibold text-stone-900">
                    Today's Nourishment
                  </h2>
                  <p className="text-xs text-stone-500">
                    Logged meals with verified calories and deconstructed ingredients
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenCaptureForMeal('snack')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-800 text-white hover:bg-emerald-900 transition-all cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Quick Log</span>
                </button>
              </div>

              <MealTimeline
                meals={currentDayMeals}
                onDeleteMeal={handleDeleteMeal}
                onOpenCaptureForMeal={handleOpenCaptureForMeal}
              />
            </section>

            {/* 5. AI Pro-Tip Floating Card (Contextual food pairings & smart swaps) */}
            <ProTipCard
              proTip={proTip}
              onRefreshTip={() => fetchProTip(currentDayMeals.length > 0 ? currentDayMeals : meals)}
              isLoading={isProTipLoading}
            />
          </>
        ) : (
          /* Weekly Trends, Achievement Badges, and 3-Month Daily Meal Track Record */
          <AnalyticsView
            meals={meals}
            target={target}
            waterMap={waterMap}
            isProUnlocked={isProUnlocked}
            currentDate={currentDate}
            onTogglePro={handleTogglePro}
            onSelectDate={date => {
              setCurrentDate(date);
              setActiveTab('log');
            }}
          />
        )}
      </main>

      {/* Mobile Floating Capture Action */}
      <div className="sm:hidden fixed bottom-5 right-5 z-40">
        <button
          type="button"
          onClick={() => {
            setCaptureMealType('lunch');
            setIsCaptureOpen(true);
          }}
          className="flex items-center gap-2 px-5 py-3.5 rounded-full bg-emerald-800 text-white font-semibold text-xs shadow-lg hover:bg-emerald-900 active:scale-95 transition-all cursor-pointer"
        >
          <Camera className="w-4 h-4 text-emerald-200" />
          <Mic className="w-4 h-4 text-emerald-200" />
          <span>Log Food</span>
        </button>
      </div>

      {/* Hybrid Multimodal Capture Modal (The Hybrid Moat + Confidence Meter) */}
      <HybridCaptureModal
        isOpen={isCaptureOpen}
        onClose={() => setIsCaptureOpen(false)}
        onSaveMeal={handleSaveMeal}
        initialMealType={captureMealType}
        selectedDate={currentDate}
      />

      {/* Settings & Goals Calibration Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        target={target}
        onUpdateTarget={setTarget}
        dietaryPreference={dietaryPref}
        onUpdateDietaryPreference={setDietaryPref}
        allMeals={meals}
        onImportMeals={imported => setMeals(imported)}
        onResetSeedData={handleResetSeedData}
        onLockApp={() => setIsLocked(true)}
        onOpenDisclaimer={() => setIsDisclaimerOpen(true)}
      />

      {/* App Store & Play Store Medical Disclaimer Modal */}
      <LegalMedicalDisclaimerModal
        isOpen={isDisclaimerOpen}
        onClose={() => setIsDisclaimerOpen(false)}
      />

      {/* Footer */}
      <footer className="mt-auto border-t border-stone-200/80 py-6 text-center text-xs text-stone-500 space-y-1">
        <p className="font-editorial text-sm font-medium text-stone-800">
          Journal · Mindful AI Calorie & Well-Being Companion
        </p>
        <p className="text-[11px] text-stone-400">
          Prioritizing description + photo hybrid intelligence, honest confidence metering, and proactive nutrition coaching.
        </p>
        <div className="pt-1 text-[11px] text-stone-400 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setIsDisclaimerOpen(true)}
            className="text-stone-500 hover:text-emerald-800 underline cursor-pointer"
          >
            Health & Medical Disclaimer (Store Policy 1.4.1)
          </button>
          <span>•</span>
          <span>Local-First SQLite Storage</span>
        </div>
      </footer>
    </div>
  );
}
