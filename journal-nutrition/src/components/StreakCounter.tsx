import React, { useState } from 'react';
import { MealEntry, DailyTarget } from '../types/nutrition';
import { fireBotanicalConfetti } from '../utils/botanicalConfetti';
import {
  Flame,
  Sparkles,
  Trophy,
  Zap,
  ShieldAlert,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Award,
  Crown,
} from 'lucide-react';

interface StreakCounterProps {
  meals: MealEntry[];
  target: DailyTarget;
  onCelebrateStreak?: () => void;
}

interface MilestoneGoal {
  days: number;
  title: string;
  badgeName: string;
  perk: string;
}

const MILESTONES: MilestoneGoal[] = [
  { days: 3, title: 'Seedling Spark', badgeName: '🌱 3-Day Spark', perk: '+10% Coaching Context' },
  { days: 7, title: 'Weekly Rhythm', badgeName: '🔥 7-Day Rhythm', perk: 'Weekly Macro Forecast' },
  { days: 14, title: 'Metabolic Groove', badgeName: '⚡ 14-Day Momentum', perk: 'Micronutrient Heatmaps' },
  { days: 21, title: 'Habit Anchor', badgeName: '🛡️ 21-Day Habit', perk: 'Circadian Pacing Alerts' },
  { days: 30, title: 'Mindful Master', badgeName: '👑 30-Day Master', perk: 'Exclusive Botanical Themes' },
  { days: 60, title: 'Iron Discipline', badgeName: '💎 60-Day Diamond', perk: 'Predictive Energy Modeling' },
  { days: 90, title: 'Centurion Legend', badgeName: '🏆 90-Day Titan', perk: 'Master Alumnus Status' },
];

export const StreakCounter: React.FC<StreakCounterProps> = ({ meals, target, onCelebrateStreak }) => {
  const [showPerkModal, setShowPerkModal] = useState(false);

  // 1. Calculate consecutive days of meeting targets / logging
  // Group meals by date and evaluate if daily goals are respected
  const mealsByDate: Record<string, { totalCal: number; protein: number; mealCount: number }> = {};

  meals.forEach((m) => {
    if (!mealsByDate[m.date]) {
      mealsByDate[m.date] = { totalCal: 0, protein: 0, mealCount: 0 };
    }
    mealsByDate[m.date].totalCal += m.calories || 0;
    mealsByDate[m.date].protein += m.macros?.protein || 0;
    mealsByDate[m.date].mealCount += 1;
  });

  // Calculate current streak backward from today
  const today = new Date();
  let currentStreak = 0;
  let cursor = new Date(today);

  // Check today first
  const todayStr = cursor.toISOString().slice(0, 10);
  const todayHasMeals = (mealsByDate[todayStr]?.mealCount || 0) > 0;

  if (todayHasMeals) {
    currentStreak++;
    cursor.setDate(cursor.getDate() - 1);
  } else {
    // If user hasn't logged yet today, check yesterday to keep streak active but at risk
    cursor.setDate(cursor.getDate() - 1);
  }

  // Count past consecutive days
  while (true) {
    const dStr = cursor.toISOString().slice(0, 10);
    if (mealsByDate[dStr] && mealsByDate[dStr].mealCount > 0) {
      currentStreak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  // Calculate all-time longest streak
  const uniqueSortedDates = Object.keys(mealsByDate).sort();
  let longestStreak = 0;
  let tempStreak = 0;

  for (let i = 0; i < uniqueSortedDates.length; i++) {
    if (i === 0) {
      tempStreak = 1;
    } else {
      const prevDate = new Date(uniqueSortedDates[i - 1] + 'T00:00:00');
      const currDate = new Date(uniqueSortedDates[i] + 'T00:00:00');
      const diff = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diff === 1) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
    }
    if (tempStreak > longestStreak) {
      longestStreak = tempStreak;
    }
  }
  longestStreak = Math.max(longestStreak, currentStreak);

  // Next milestone lookup
  const nextMilestone = MILESTONES.find((m) => m.days > currentStreak) || MILESTONES[MILESTONES.length - 1];
  const prevMilestoneDays = MILESTONES.filter((m) => m.days <= currentStreak).pop()?.days || 0;
  const progressToNext = Math.min(
    100,
    Math.max(0, Math.round(((currentStreak - prevMilestoneDays) / (nextMilestone.days - prevMilestoneDays)) * 100))
  );

  // Flame tier styling
  const getFlameConfig = () => {
    if (currentStreak >= 30) {
      return {
        bg: 'from-amber-500 via-rose-500 to-emerald-600',
        text: 'text-amber-500',
        glow: 'shadow-amber-500/30',
        title: 'Master Flame',
        tier: 'Legendary Rhythm',
      };
    }
    if (currentStreak >= 14) {
      return {
        bg: 'from-amber-400 to-rose-500',
        text: 'text-amber-500',
        glow: 'shadow-amber-500/25',
        title: 'Radiant Blaze',
        tier: 'Advanced Momentum',
      };
    }
    if (currentStreak >= 7) {
      return {
        bg: 'from-amber-400 to-orange-500',
        text: 'text-amber-600',
        glow: 'shadow-orange-500/20',
        title: 'Steady Hearth',
        tier: 'Weekly Habit',
      };
    }
    return {
      bg: 'from-emerald-600 to-teal-500',
      text: 'text-emerald-700',
      glow: 'shadow-emerald-500/20',
      title: 'Kindling Spark',
      tier: 'Active Flow',
    };
  };

  const flame = getFlameConfig();

  // Past 7 days status strip
  const recentWeekDays: { dateStr: string; label: string; active: boolean; isToday: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const label = i === 0 ? 'Today' : i === 1 ? 'Yest' : d.toLocaleDateString('en-US', { weekday: 'narrow' });
    const hasLogged = !!mealsByDate[dateStr] && mealsByDate[dateStr].mealCount > 0;
    recentWeekDays.push({
      dateStr,
      label,
      active: hasLogged,
      isToday: i === 0,
    });
  }

  const handleCelebrate = () => {
    fireBotanicalConfetti();
    if (onCelebrateStreak) {
      onCelebrateStreak();
    }
  };

  return (
    <div className="p-6 rounded-3xl bg-linear-to-br from-stone-900 via-stone-850 to-stone-900 text-white shadow-xl border border-stone-800 space-y-5 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -left-16 -bottom-16 w-56 h-56 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`w-14 h-14 rounded-2xl bg-linear-to-tr ${flame.bg} flex items-center justify-center shadow-lg ${flame.glow} animate-pulse`}>
              <Flame className="w-8 h-8 text-white fill-white/80" />
            </div>
            {currentStreak >= 7 && (
              <span className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-amber-400 text-stone-900">
                <Crown className="w-3 h-3 fill-stone-900" />
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                {flame.tier}
              </span>
              <span className="text-xs text-stone-400">• Personal Best: {longestStreak}d</span>
            </div>
            <h2 className="font-editorial text-2xl font-bold text-white tracking-tight flex items-center gap-2 pt-0.5">
              <span>{currentStreak} Day Streak</span>
            </h2>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCelebrate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Celebrate Streak</span>
          </button>
        </div>
      </div>

      {/* 7-Day Day Tracker Pills */}
      <div className="relative z-10 pt-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 block pb-2">
          Weekly Consistency Rhythm
        </span>
        <div className="grid grid-cols-7 gap-2">
          {recentWeekDays.map((day, idx) => (
            <div
              key={idx}
              className={`p-2.5 rounded-2xl border flex flex-col items-center justify-between gap-1.5 transition-all ${
                day.active
                  ? 'bg-stone-800/90 border-amber-500/40 text-amber-300 shadow-2xs shadow-amber-500/10'
                  : 'bg-stone-800/40 border-stone-700/50 text-stone-500'
              } ${day.isToday ? 'ring-2 ring-amber-400/80 ring-offset-2 ring-offset-stone-900' : ''}`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {day.label}
              </span>
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                  day.active
                    ? 'bg-amber-500 text-stone-950 font-bold shadow-2xs'
                    : 'bg-stone-700/50 text-stone-500'
                }`}
              >
                {day.active ? (
                  <Flame className="w-4 h-4 fill-stone-950" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-600" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Milestone Progress Bar */}
      <div className="relative z-10 p-4 rounded-2xl bg-stone-800/60 border border-stone-700/60 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-stone-200">
              Next Goal: {nextMilestone.days} Days ({nextMilestone.title})
            </span>
          </div>
          <span className="font-mono-nums font-bold text-amber-400">
            {currentStreak}/{nextMilestone.days} Days ({progressToNext}%)
          </span>
        </div>

        {/* Bar */}
        <div className="w-full bg-stone-700/60 h-2.5 rounded-full overflow-hidden p-0.5">
          <div
            className="h-full rounded-full bg-linear-to-r from-amber-500 via-orange-400 to-amber-300 transition-all duration-700"
            style={{ width: `${progressToNext}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-stone-400 pt-0.5">
          <span>Unlocks reward: <strong className="text-amber-300 font-medium">{nextMilestone.perk}</strong></span>
          <span className="text-stone-400 font-medium">{nextMilestone.days - currentStreak} days to go</span>
        </div>
      </div>
    </div>
  );
};
