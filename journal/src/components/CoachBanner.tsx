import React, { useState } from 'react';
import { CoachInsight, MealEntry, DailyTarget } from '../types/nutrition';
import { Sparkles, RefreshCw, Lightbulb, HeartHandshake, CheckCircle2 } from 'lucide-react';

interface CoachBannerProps {
  insight: CoachInsight;
  meals: MealEntry[];
  target: DailyTarget;
  onUpdateInsight: (newInsight: CoachInsight) => void;
}

export const CoachBanner: React.FC<CoachBannerProps> = ({
  insight,
  meals,
  target,
  onUpdateInsight,
}) => {
  const [loading, setLoading] = useState(false);

  const getTimeOfDay = () => {
    const hr = new Date().getHours();
    if (hr < 12) return 'morning';
    if (hr < 17) return 'afternoon';
    return 'evening';
  };

  const handleRefreshAdvice = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          todayMeals: meals,
          dailyTarget: target,
          timeOfDay: getTimeOfDay(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdateInsight({
          ...data,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Coaching update error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStyleConfig = () => {
    switch (insight.type) {
      case 'kudos':
        return {
          border: 'border-emerald-200/90',
          bg: 'bg-emerald-50/70',
          badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          icon: CheckCircle2,
          iconColor: 'text-emerald-700',
        };
      case 'suggestion':
        return {
          border: 'border-amber-200/90',
          bg: 'bg-amber-50/70',
          badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
          icon: Lightbulb,
          iconColor: 'text-amber-700',
        };
      default:
        return {
          border: 'border-stone-200/90',
          bg: 'bg-stone-50/70',
          badgeBg: 'bg-stone-200 text-stone-800 border-stone-300',
          icon: HeartHandshake,
          iconColor: 'text-stone-700',
        };
    }
  };

  const style = getStyleConfig();
  const Icon = style.icon;

  return (
    <section className={`rounded-2xl border ${style.border} ${style.bg} p-5 shadow-xs transition-all space-y-3`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-white shadow-2xs border border-stone-200/60">
            <Sparkles className="w-4 h-4 text-emerald-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-600">
                AI Well-Being Coach
              </span>
              <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${style.badgeBg}`}>
                {insight.type === 'kudos' ? 'Affirmation' : insight.type === 'suggestion' ? 'Smart Calibration' : 'Balance Focus'}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefreshAdvice}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 bg-white/90 hover:bg-white px-2.5 py-1.5 rounded-lg border border-stone-200/80 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
          title="Re-analyze current day meals for fresh coaching"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-700' : ''}`} />
          <span className="hidden sm:inline">{loading ? 'Analyzing...' : 'Refresh Coach'}</span>
        </button>
      </div>

      <div>
        <h3 className="font-editorial text-lg font-semibold text-stone-900 leading-snug">
          {insight.headline}
        </h3>
        <p className="text-xs sm:text-sm text-stone-600 mt-1 leading-relaxed">
          {insight.message}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-stone-200/60 bg-white/60 p-3 rounded-xl">
        <div className="flex items-start sm:items-center gap-2">
          <Icon className={`w-4 h-4 shrink-0 mt-0.5 sm:mt-0 ${style.iconColor}`} />
          <p className="text-xs font-medium text-stone-800">
            <span className="font-semibold text-stone-900">Actionable step:</span> {insight.actionableTip}
          </p>
        </div>

        {insight.suggestedSnackOrFood && (
          <div className="shrink-0 flex items-center gap-1.5 text-xs bg-emerald-100/70 text-emerald-900 px-2.5 py-1 rounded-lg border border-emerald-200/80 font-medium">
            <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">Idea:</span>
            <span>{insight.suggestedSnackOrFood}</span>
          </div>
        )}
      </div>
    </section>
  );
};
