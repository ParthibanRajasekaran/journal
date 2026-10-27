import React, { useState, useEffect } from 'react';
import { MealEntry, DailyTarget, MICRONUTRIENT_RDAS } from '../types/nutrition';
import { AchievementBadges, BadgeItem } from './AchievementBadges';
import { DailyMealTrackRecord } from './DailyMealTrackRecord';
import { MicronutrientDashboard } from './MicronutrientDashboard';
import { MilestoneCelebrationBanner, MilestoneCelebrationData } from './MilestoneCelebrationBanner';
import { ProteinTrendLineChart } from './ProteinTrendLineChart';
import { StreakCounter } from './StreakCounter';
import { fireBotanicalConfetti } from '../utils/botanicalConfetti';
import { ShieldCheck, Heart, CheckCircle2, Sparkles, Flame } from 'lucide-react';

interface AnalyticsViewProps {
  meals: MealEntry[];
  target: DailyTarget;
  waterMap: Record<string, number>;
  isProUnlocked: boolean;
  currentDate?: string;
  onTogglePro: () => void;
  onSelectDate: (date: string) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  meals,
  target,
  waterMap,
  isProUnlocked,
  currentDate = new Date().toISOString().slice(0, 10),
  onTogglePro,
  onSelectDate,
}) => {
  const [activeMilestone, setActiveMilestone] = useState<MilestoneCelebrationData | null>(null);

  // Group meals by date (last 7 days)
  const days: { dateStr: string; label: string; calories: number; protein: number; fiber: number; confidenceAvg: number; count: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yr}-${mo}-${da}`;
    const dayLabel = i === 0 ? 'Today' : i === 1 ? 'Yest' : d.toLocaleDateString('en-US', { weekday: 'narrow' });

    const dayMeals = meals.filter(m => m.date === dateStr);
    const calories = dayMeals.reduce((sum, m) => sum + (m.calories || 0), 0);
    const protein = dayMeals.reduce((sum, m) => sum + (m.macros?.protein || 0), 0);
    const fiber = dayMeals.reduce((sum, m) => sum + (m.macros?.fiber || 0), 0);
    const confSum = dayMeals.reduce((sum, m) => sum + (m.confidenceScore || 0), 0);
    const confidenceAvg = dayMeals.length > 0 ? Math.round(confSum / dayMeals.length) : 0;

    days.push({
      dateStr,
      label: dayLabel,
      calories,
      protein,
      fiber,
      confidenceAvg,
      count: dayMeals.length,
    });
  }

  // Calculate overall metrics
  const totalEntries = meals.length;
  const hybridEntries = meals.filter(m => m.photoUrl && m.description).length;
  const hybridPercent = totalEntries > 0 ? Math.round((hybridEntries / totalEntries) * 100) : 100;

  const overallConfAvg = totalEntries > 0
    ? Math.round(meals.reduce((sum, m) => sum + (m.confidenceScore || 0), 0) / totalEntries)
    : 86;

  const maxCal = Math.max(target.calories * 1.25, ...days.map(d => d.calories));

  // Calculate consecutive days streak
  const uniqueDates = Array.from(new Set(meals.map(m => m.date)));
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

  // Check micronutrient balance for today or recent day
  const recentDayMeals = meals.filter(m => m.date === currentDate);
  let micronutrientFulfillment = 0;
  if (recentDayMeals.length > 0) {
    const vitD = recentDayMeals.reduce((s, m) => s + (m.micronutrients?.vitaminD_iu || 0), 0);
    const vitB12 = recentDayMeals.reduce((s, m) => s + (m.micronutrients?.vitaminB12_mcg || 0), 0);
    const vitC = recentDayMeals.reduce((s, m) => s + (m.micronutrients?.vitaminC_mg || 0), 0);
    const iron = recentDayMeals.reduce((s, m) => s + (m.micronutrients?.iron_mg || 0), 0);
    const magnesium = recentDayMeals.reduce((s, m) => s + (m.micronutrients?.magnesium_mg || 0), 0);
    const zinc = recentDayMeals.reduce((s, m) => s + (m.micronutrients?.zinc_mg || 0), 0);

    micronutrientFulfillment = Math.round(
      ((Math.min(1.2, vitD / MICRONUTRIENT_RDAS.vitaminD_iu.rda) +
        Math.min(1.2, vitB12 / MICRONUTRIENT_RDAS.vitaminB12_mcg.rda) +
        Math.min(1.2, vitC / MICRONUTRIENT_RDAS.vitaminC_mg.rda) +
        Math.min(1.2, iron / MICRONUTRIENT_RDAS.iron_mg.rda) +
        Math.min(1.2, magnesium / MICRONUTRIENT_RDAS.magnesium_mg.rda) +
        Math.min(1.2, zinc / MICRONUTRIENT_RDAS.zinc_mg.rda)) /
        6) *
        100
    );
  }

  // Automatic milestone check on initial render
  useEffect(() => {
    try {
      const stored = localStorage.getItem('journal_celebrated_milestones');
      const celebrated: string[] = stored ? JSON.parse(stored) : [];

      let newMilestone: MilestoneCelebrationData | null = null;

      if (currentStreak >= 30 && !celebrated.includes('streak-30')) {
        newMilestone = {
          id: 'streak-30',
          title: '30-Day Master Rhythm Unlocked!',
          category: 'Consistency Milestone',
          description: '30 consecutive days of mindful meal logging completed.',
          payoff: 'You have permanently cemented intuitive mindfulness into your daily routine. Metabolic and cellular rhythm stabilized.',
          metricText: `${currentStreak} Days`,
          isUnlocked: true,
          icon: Flame,
        };
      } else if (micronutrientFulfillment >= 90 && !celebrated.includes('vitality-vanguard')) {
        newMilestone = {
          id: 'vitality-vanguard',
          title: 'Vitality Vanguard Achieved!',
          category: 'Micronutrient Milestone',
          description: 'Achieved 90%+ Recommended Daily Allowance across all Essential Vitality nutrients.',
          payoff: 'Every vital organ and cellular pathway received optimal micronutrient density today.',
          metricText: `${micronutrientFulfillment}% RDA`,
          isUnlocked: true,
          icon: Sparkles,
        };
      } else if (currentStreak >= 14 && !celebrated.includes('streak-14')) {
        newMilestone = {
          id: 'streak-14',
          title: '14-Day Consistency Locked!',
          category: 'Habit Anchor',
          description: 'Two full weeks of uninterrupted tracking rhythm.',
          payoff: 'Neural pathways for mindful nourishment are now firmly established.',
          metricText: `${currentStreak} Days`,
          isUnlocked: true,
          icon: Flame,
        };
      } else if (currentStreak >= 7 && !celebrated.includes('streak-7')) {
        newMilestone = {
          id: 'streak-7',
          title: '7-Day Streak Accomplished!',
          category: 'Consistency Foundation',
          description: 'One complete week of intentional nourishment.',
          payoff: 'The first week is the hardest—you’ve built the foundation for effortless habit continuity.',
          metricText: `${currentStreak} Days`,
          isUnlocked: true,
          icon: Flame,
        };
      }

      if (newMilestone) {
        // Fire celebration
        const timer = setTimeout(() => {
          fireBotanicalConfetti(undefined, undefined, 95);
          setActiveMilestone(newMilestone);
          celebrated.push(newMilestone!.id);
          localStorage.setItem('journal_celebrated_milestones', JSON.stringify(celebrated));
        }, 600);

        return () => clearTimeout(timer);
      }
    } catch {
      // LocalStorage access fallback
    }
  }, [currentStreak, micronutrientFulfillment]);

  const handleCelebrateBadge = (badge: BadgeItem) => {
    setActiveMilestone({
      id: badge.id,
      title: `${badge.title} Unlocked!`,
      category: badge.category,
      description: badge.description,
      payoff: badge.rewardTip,
      metricText: badge.progressText,
      icon: badge.icon,
      isUnlocked: badge.isUnlocked,
    });
  };

  const handleManualStreakCelebration = (e?: React.MouseEvent) => {
    if (e?.currentTarget) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      fireBotanicalConfetti(rect.left + rect.width / 2, rect.top, 85);
    } else {
      fireBotanicalConfetti(window.innerWidth / 2, window.innerHeight * 0.4, 90);
    }
    setActiveMilestone({
      id: `streak-current-${currentStreak}`,
      title: `${currentStreak}-Day Active Rhythm!`,
      category: 'Momentum Celebration',
      description: `You are maintaining an active streak of ${currentStreak} consecutive mindful logging days.`,
      payoff: 'Consistency compounds quietly. Every log gives your AI health model deeper context to optimize your vitality.',
      metricText: `${currentStreak} Consecutive Days`,
      icon: Flame,
      isUnlocked: true,
    });
  };

  return (
    <div className="space-y-6 relative">
      {/* Floating Milestone Celebration Banner */}
      <MilestoneCelebrationBanner
        milestone={activeMilestone}
        onClose={() => setActiveMilestone(null)}
      />

      {/* Gamified Streak Counter Hero */}
      <StreakCounter
        meals={meals}
        target={target}
        onCelebrateStreak={handleManualStreakCelebration}
      />

      {/* 1. Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Confidence Moat card */}
        <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              AI Accuracy Moat
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono-nums text-3xl font-bold text-stone-900">
              {overallConfAvg}%
            </span>
            <span className="text-xs text-emerald-800 font-semibold">avg certainty</span>
          </div>
          <p className="text-xs text-stone-500">
            {hybridPercent}% of logged meals used the Hybrid (photo + description) method.
          </p>
        </div>

        {/* Holistic Wellness Score */}
        <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Nutrient Quality
            </span>
            <Heart className="w-4 h-4 text-rose-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono-nums text-3xl font-bold text-stone-900">
              92<span className="text-sm font-normal text-stone-400">/100</span>
            </span>
            <span className="text-xs text-stone-600 font-medium">Whole Food Balance</span>
          </div>
          <p className="text-xs text-stone-500">
            High natural fiber & unrefined healthy fats across daily intake.
          </p>
        </div>

        {/* Weekly Logging Rhythm with Celebration Affordance */}
        <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-2 relative group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Logging Momentum
            </span>
            <button
              type="button"
              onClick={handleManualStreakCelebration}
              className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded-full transition-all cursor-pointer shadow-2xs active:scale-95"
              title="Click to celebrate current streak!"
            >
              <Sparkles className="w-3 h-3 text-emerald-700 animate-pulse" />
              <span>Celebrate</span>
            </button>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono-nums text-3xl font-bold text-stone-900">
              {currentStreak}
            </span>
            <span className="text-xs text-stone-600 font-medium">consecutive days ({days.filter(d => d.count > 0).length}/7 this week)</span>
          </div>
          <p className="text-xs text-stone-500">
            Tap <span className="font-medium text-emerald-800">Celebrate</span> anytime to shower the screen with botanical confetti.
          </p>
        </div>
      </div>

      {/* 2. Achievement Badges (Interactive milestone showcase with confetti trigger) */}
      <AchievementBadges
        meals={meals}
        target={target}
        waterMap={waterMap}
        onCelebrateBadge={handleCelebrateBadge}
      />

      {/* 3. 7-Day Calorie Cadence Bar Chart */}
      <div className="p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-editorial text-lg font-semibold text-stone-900">
              7-Day Energy Cadence
            </h3>
            <p className="text-xs text-stone-500">
              Target line set at {target.calories} kcal
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-stone-500">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-700 inline-block" />
              <span>Consumed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-stone-300 inline-block" />
              <span>Target</span>
            </div>
          </div>
        </div>

        {/* Bars Container */}
        <div className="pt-6 pb-2">
          <div className="relative h-44 flex items-end justify-between gap-2 border-b border-stone-200 px-2">
            {/* Target line guideline */}
            <div
              className="absolute left-0 right-0 border-b border-dashed border-stone-300 pointer-events-none z-10"
              style={{ bottom: `${(target.calories / maxCal) * 100}%` }}
            >
              <span className="absolute -top-3 right-0 text-[10px] text-stone-400 font-mono-nums">
                {target.calories}
              </span>
            </div>

            {days.map((day, idx) => {
              const heightPercent = maxCal > 0 ? (day.calories / maxCal) * 100 : 0;
              const isOver = day.calories > target.calories;

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                  {/* Calorie tooltip */}
                  <span className="text-[10px] font-mono-nums text-stone-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {day.calories > 0 ? `${day.calories} kcal` : '—'}
                  </span>

                  {/* Bar */}
                  <div className="w-full max-w-10 bg-stone-100 rounded-t-lg overflow-hidden h-full flex items-end">
                    <div
                      className={`w-full rounded-t-lg transition-all duration-500 ${
                        isOver ? 'bg-amber-600' : 'bg-emerald-700'
                      }`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>

                  {/* Day label */}
                  <span className="text-xs font-medium text-stone-600 pt-1">
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. 30-Day Protein Intake Trajectory Line Chart */}
      <ProteinTrendLineChart meals={meals} target={target} />

      {/* 5. Micronutrient Intelligence Dashboard (Vitality Bundle) */}
      <MicronutrientDashboard meals={meals} currentDate={currentDate} />

      {/* 5. Daily Track Record by Meal & 3-Month Journal Pro Archive */}
      <DailyMealTrackRecord
        meals={meals}
        target={target}
        isProUnlocked={isProUnlocked}
        onTogglePro={onTogglePro}
        onSelectDate={onSelectDate}
      />
    </div>
  );
};
