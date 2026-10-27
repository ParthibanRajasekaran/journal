import React, { useState } from 'react';
import { MealEntry, DailyTarget, MICRONUTRIENT_RDAS } from '../types/nutrition';
import {
  Award,
  Flame,
  Droplet,
  Dumbbell,
  ShieldCheck,
  Sparkles,
  Heart,
  CheckCircle2,
  Lock,
  X,
  Zap,
  RotateCw,
} from 'lucide-react';
import { fireBotanicalConfetti } from '../utils/botanicalConfetti';

export interface BadgeItem {
  id: string;
  title: string;
  category: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  bgGradient: string;
  progress: number; // 0 to 100
  progressText: string;
  isUnlocked: boolean;
  unlockedDate?: string;
  rewardTip: string;
}

interface AchievementBadgesProps {
  meals: MealEntry[];
  target: DailyTarget;
  waterMap: Record<string, number>;
  onCelebrateBadge?: (badge: BadgeItem) => void;
}

export const AchievementBadges: React.FC<AchievementBadgesProps> = ({
  meals,
  target,
  waterMap,
  onCelebrateBadge,
}) => {
  const [selectedBadge, setSelectedBadge] = useState<BadgeItem | null>(null);

  // Group meals by date
  const uniqueDates = Array.from(new Set(meals.map(m => m.date)));

  // Streak calculation (consecutive days)
  let currentStreak = 0;
  const sortedDates = [...uniqueDates].sort((a, b) => b.localeCompare(a));
  if (sortedDates.length > 0) {
    currentStreak = 1;
    for (let i = 0; i < sortedDates.length - 1; i++) {
      const d1 = new Date(sortedDates[i] + 'T00:00:00');
      const d2 = new Date(sortedDates[i + 1] + 'T00:00:00');
      const diffDays = Math.round((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Days protein achieved
  const daysWithProteinAchieved = uniqueDates.filter(d => {
    const dayProtein = meals
      .filter(m => m.date === d)
      .reduce((sum, m) => sum + (m.macros?.protein || 0), 0);
    return dayProtein >= target.protein * 0.95;
  }).length;

  // Hydration Hero days (water >= target)
  const hydrationAchievedDays = Object.values(waterMap).filter(ml => ml >= target.waterGoalMl).length;

  // Hybrid meals (photo + description)
  const hybridCount = meals.filter(m => m.photoUrl && m.description).length;

  // Fiber days (>= 28g)
  const fiberDays = uniqueDates.filter(d => {
    const dayFiber = meals
      .filter(m => m.date === d)
      .reduce((sum, m) => sum + (m.macros?.fiber || 0), 0);
    return dayFiber >= 28;
  }).length;

  // Micronutrient Vitality Vanguard check (days with >= 80% average RDA fulfillment)
  const vitalityDays = uniqueDates.filter(d => {
    const dayMeals = meals.filter(m => m.date === d);
    if (dayMeals.length === 0) return false;

    const vitD = dayMeals.reduce((s, m) => s + (m.micronutrients?.vitaminD_iu || 0), 0);
    const vitB12 = dayMeals.reduce((s, m) => s + (m.micronutrients?.vitaminB12_mcg || 0), 0);
    const vitC = dayMeals.reduce((s, m) => s + (m.micronutrients?.vitaminC_mg || 0), 0);
    const iron = dayMeals.reduce((s, m) => s + (m.micronutrients?.iron_mg || 0), 0);
    const magnesium = dayMeals.reduce((s, m) => s + (m.micronutrients?.magnesium_mg || 0), 0);
    const zinc = dayMeals.reduce((s, m) => s + (m.micronutrients?.zinc_mg || 0), 0);

    const score = (
      Math.min(1.2, vitD / MICRONUTRIENT_RDAS.vitaminD_iu.rda) +
      Math.min(1.2, vitB12 / MICRONUTRIENT_RDAS.vitaminB12_mcg.rda) +
      Math.min(1.2, vitC / MICRONUTRIENT_RDAS.vitaminC_mg.rda) +
      Math.min(1.2, iron / MICRONUTRIENT_RDAS.iron_mg.rda) +
      Math.min(1.2, magnesium / MICRONUTRIENT_RDAS.magnesium_mg.rda) +
      Math.min(1.2, zinc / MICRONUTRIENT_RDAS.zinc_mg.rda)
    ) / 6;

    return score >= 0.8;
  }).length;

  const badges: BadgeItem[] = [
    {
      id: 'streak-30',
      title: '30-Day Master Rhythm',
      category: 'Milestone Streak',
      description: 'Log your meals for 30 consecutive days to permanently anchor mindful nutrition.',
      icon: Flame,
      color: 'text-amber-600',
      bgGradient: 'from-amber-500/20 via-orange-500/10 to-transparent border-amber-400',
      progress: Math.min(100, Math.round((currentStreak / 30) * 100)),
      progressText: `${currentStreak} / 30 days streak`,
      isUnlocked: currentStreak >= 30,
      unlockedDate: currentStreak >= 30 ? 'Unlocked' : undefined,
      rewardTip: '30 consecutive days shifts eating from willpower into an effortless, intuitive biological rhythm.',
    },
    {
      id: 'vitality-vanguard',
      title: 'Vitality Vanguard',
      category: 'Micronutrients',
      description: 'Achieve 80%+ fulfillment across Essential Vitality vitamins and minerals.',
      icon: Zap,
      color: 'text-emerald-600',
      bgGradient: 'from-emerald-500/20 via-teal-500/10 to-transparent border-emerald-400',
      progress: Math.min(100, Math.round((vitalityDays / 3) * 100)),
      progressText: `${vitalityDays} / 3 optimal days`,
      isUnlocked: vitalityDays >= 3,
      unlockedDate: vitalityDays >= 3 ? 'Unlocked' : undefined,
      rewardTip: 'Holistic cellular nutrition shields against hidden subclinical fatigue and supports long-term metabolic health.',
    },
    {
      id: 'streak-14',
      title: '14-Day Consistency',
      category: 'Habit Anchor',
      description: 'Log 14 consecutive days of mindful nourishment.',
      icon: Flame,
      color: 'text-orange-500',
      bgGradient: 'from-orange-500/15 via-amber-500/5 to-transparent border-orange-300',
      progress: Math.min(100, Math.round((currentStreak / 14) * 100)),
      progressText: `${currentStreak} / 14 days streak`,
      isUnlocked: currentStreak >= 14,
      unlockedDate: currentStreak >= 14 ? 'Unlocked' : undefined,
      rewardTip: 'Two weeks of unbroken consistency solidifies neural pathways for healthier choices.',
    },
    {
      id: 'streak-7',
      title: '7-Day Streak',
      category: 'Consistency',
      description: 'Log your meals for 7 consecutive days to build intuitive mindfulness.',
      icon: Flame,
      color: 'text-amber-500',
      bgGradient: 'from-amber-500/10 via-amber-500/5 to-transparent border-amber-300/80',
      progress: Math.min(100, Math.round((currentStreak / 7) * 100)),
      progressText: `${currentStreak} / 7 days streak`,
      isUnlocked: currentStreak >= 7,
      unlockedDate: currentStreak >= 7 ? 'Unlocked' : undefined,
      rewardTip: 'Consistency eliminates the mental weight of guesswork and creates lasting habit loops.',
    },
    {
      id: 'protein-goal',
      title: 'Protein Goal Achieved',
      category: 'Fuel',
      description: `Hit or exceed your daily protein target (${target.protein}g) across 3 different days.`,
      icon: Dumbbell,
      color: 'text-emerald-600',
      bgGradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-300/80',
      progress: Math.min(100, Math.round((daysWithProteinAchieved / 3) * 100)),
      progressText: `${daysWithProteinAchieved} / 3 days hit`,
      isUnlocked: daysWithProteinAchieved >= 3,
      unlockedDate: daysWithProteinAchieved >= 3 ? 'Unlocked' : undefined,
      rewardTip: 'Optimal amino acids preserve lean mass, boost thermogenesis, and anchor lasting satiety.',
    },
    {
      id: 'hydration-hero',
      title: 'Hydration Hero',
      category: 'Vitality',
      description: `Drink and log ${target.waterGoalMl}ml of water in a day.`,
      icon: Droplet,
      color: 'text-sky-500',
      bgGradient: 'from-sky-500/10 via-sky-500/5 to-transparent border-sky-300/80',
      progress: Math.min(100, Math.round((hydrationAchievedDays / 1) * 100)),
      progressText: hydrationAchievedDays >= 1 ? 'Target Reached' : '0 / 1 day',
      isUnlocked: hydrationAchievedDays >= 1,
      unlockedDate: hydrationAchievedDays >= 1 ? 'Unlocked' : undefined,
      rewardTip: 'Hydration accelerates cellular metabolism and prevents false hunger cues caused by thirst.',
    },
    {
      id: 'hybrid-champion',
      title: 'Hybrid Log Champion',
      category: 'Accuracy Moat',
      description: 'Log 5 meals using both a photo and descriptive text/voice to maximize accuracy.',
      icon: ShieldCheck,
      color: 'text-indigo-600',
      bgGradient: 'from-indigo-500/10 via-indigo-500/5 to-transparent border-indigo-300/80',
      progress: Math.min(100, Math.round((hybridCount / 5) * 100)),
      progressText: `${hybridCount} / 5 hybrid meals`,
      isUnlocked: hybridCount >= 5,
      unlockedDate: hybridCount >= 5 ? 'Unlocked' : undefined,
      rewardTip: 'Description + Photo is Journal’s signature accuracy moat, cutting vision ambiguity by 50%.',
    },
    {
      id: 'microbiome-master',
      title: 'Microbiome Master',
      category: 'Gut Health',
      description: 'Reach 28g+ of prebiotic dietary fiber in a single day.',
      icon: Sparkles,
      color: 'text-teal-600',
      bgGradient: 'from-teal-500/10 via-teal-500/5 to-transparent border-teal-300/80',
      progress: Math.min(100, Math.round((fiberDays / 1) * 100)),
      progressText: fiberDays >= 1 ? 'Fiber Goal Met' : '0 / 1 day',
      isUnlocked: fiberDays >= 1,
      unlockedDate: fiberDays >= 1 ? 'Unlocked' : undefined,
      rewardTip: 'Dietary fiber feeds short-chain fatty acid-producing gut microbes, improving immunity and mental clarity.',
    },
  ];

  const unlockedCount = badges.filter(b => b.isUnlocked).length;

  const handleBadgeClick = (badge: BadgeItem, e: React.MouseEvent<HTMLButtonElement>) => {
    setSelectedBadge(badge);

    // If unlocked, trigger celebration
    if (badge.isUnlocked) {
      const rect = e.currentTarget.getBoundingClientRect();
      fireBotanicalConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2, 70);
      onCelebrateBadge?.(badge);
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-stone-200/80 p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-editorial text-lg font-semibold text-stone-900">
              Achievement Badges & Milestones
            </h3>
            <p className="text-xs text-stone-500">
              Tap any unlocked milestone to trigger celebration • Tap to inspect details
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            {unlockedCount} of {badges.length} Unlocked
          </span>
        </div>
      </div>

      {/* Grid of Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
        {badges.map(badge => {
          const Icon = badge.icon;
          return (
            <button
              key={badge.id}
              type="button"
              onClick={e => handleBadgeClick(badge, e)}
              className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all cursor-pointer relative overflow-hidden group ${
                badge.isUnlocked
                  ? `bg-linear-to-b ${badge.bgGradient} shadow-xs hover:scale-[1.02] hover:shadow-md ring-1 ring-emerald-500/20`
                  : 'bg-stone-50/60 border-stone-200 hover:border-stone-300 opacity-80'
              }`}
            >
              {/* Top icon & lock/completed badge */}
              <div className="flex items-center justify-between">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-transform group-hover:scale-110 ${
                    badge.isUnlocked
                      ? 'bg-white shadow-2xs ' + badge.color
                      : 'bg-stone-200/80 text-stone-400 border-stone-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                {badge.isUnlocked ? (
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded-md">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    <span>Won</span>
                  </div>
                ) : (
                  <Lock className="w-3.5 h-3.5 text-stone-400" />
                )}
              </div>

              {/* Title & Progress */}
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block">
                  {badge.category}
                </span>
                <h4 className="font-semibold text-stone-900 text-xs leading-snug line-clamp-1">
                  {badge.title}
                </h4>

                <div className="pt-1 space-y-1">
                  <div className="w-full bg-stone-200/70 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        badge.isUnlocked ? 'bg-emerald-600' : 'bg-stone-400'
                      }`}
                      style={{ width: `${badge.progress}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono-nums text-stone-500 block">
                    {badge.progressText}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Badge Detail Modal */}
      {selectedBadge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl w-full max-w-sm p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center border bg-linear-to-b ${selectedBadge.bgGradient}`}
              >
                <selectedBadge.icon className={`w-6 h-6 ${selectedBadge.color}`} />
              </div>
              <button
                type="button"
                onClick={() => setSelectedBadge(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-semibold text-stone-400">
                  {selectedBadge.category}
                </span>
                {selectedBadge.isUnlocked && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Completed
                  </span>
                )}
              </div>
              <h3 className="font-editorial text-xl font-bold text-stone-900">
                {selectedBadge.title}
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                {selectedBadge.description}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/70 space-y-1.5 text-xs">
              <div className="flex items-center justify-between font-medium">
                <span className="text-stone-600">Current Progress</span>
                <span className="font-mono-nums font-semibold text-stone-900">
                  {selectedBadge.progress}% ({selectedBadge.progressText})
                </span>
              </div>
              <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    selectedBadge.isUnlocked ? 'bg-emerald-600' : 'bg-amber-500'
                  }`}
                  style={{ width: `${selectedBadge.progress}%` }}
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100 text-xs space-y-1">
              <span className="font-semibold text-emerald-950 block">Why it matters:</span>
              <p className="text-stone-600 leading-relaxed">{selectedBadge.rewardTip}</p>
            </div>

            {selectedBadge.isUnlocked ? (
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    fireBotanicalConfetti(window.innerWidth / 2, window.innerHeight * 0.45, 90);
                    onCelebrateBadge?.(selectedBadge);
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-medium text-xs flex items-center justify-center gap-2 transition-transform active:scale-98 cursor-pointer shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Celebrate Achievement
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedBadge(null)}
                  className="w-full py-2 rounded-xl text-stone-500 hover:text-stone-800 text-xs font-medium cursor-pointer"
                >
                  Close
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSelectedBadge(null)}
                className="w-full py-2.5 rounded-xl bg-stone-900 text-white font-medium text-xs hover:bg-stone-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
