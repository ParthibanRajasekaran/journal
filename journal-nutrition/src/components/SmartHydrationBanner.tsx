import React, { useState } from 'react';
import {
  analyzeHydrationPace,
  HydrationPaceAnalysis,
  sendHydrationNotification,
} from '../utils/hydrationIntelligence';
import {
  Droplet,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Bell,
  Clock,
  Plus,
  ChevronDown,
  ChevronUp,
  X,
  Volume2,
} from 'lucide-react';

interface SmartHydrationBannerProps {
  currentMl: number;
  targetMl: number;
  onAddWater: (amountMl: number) => void;
}

export const SmartHydrationBanner: React.FC<SmartHydrationBannerProps> = ({
  currentMl,
  targetMl,
  onAddWater,
}) => {
  const [overrideHour, setOverrideHour] = useState<number | undefined>(undefined);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [notifSuccess, setNotifSuccess] = useState<string | null>(null);

  const analysis: HydrationPaceAnalysis = analyzeHydrationPace(
    currentMl,
    targetMl,
    overrideHour
  );

  const handleQuickAdd = (amount: number) => {
    onAddWater(amount);
  };

  const handleRequestPushAlerts = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotifSuccess('Push notifications not supported on this device');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      sendHydrationNotification(analysis);
      setNotifSuccess('Smart Hydration alerts active! Test alert sent.');
      setTimeout(() => setNotifSuccess(null), 4000);
    } else {
      setNotifSuccess('Notification permission declined.');
      setTimeout(() => setNotifSuccess(null), 3000);
    }
  };

  if (isDismissed) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setIsDismissed(false)}
          className="text-xs text-sky-700 hover:text-sky-900 font-medium flex items-center gap-1.5 px-3 py-1 bg-sky-50 rounded-full border border-sky-200 cursor-pointer"
        >
          <Droplet className="w-3.5 h-3.5 text-sky-600" />
          <span>Show Smart Hydration Tracker</span>
        </button>
      </div>
    );
  }

  const isLagging = analysis.status === 'lagging';
  const isCompleted = analysis.status === 'completed';

  return (
    <aside
      aria-label="Smart Hydration alert banner"
      className={`rounded-2xl border transition-all duration-300 relative overflow-hidden shadow-xs ${
        isLagging
          ? 'bg-linear-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-300/90'
          : isCompleted
          ? 'bg-linear-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-300/90'
          : 'bg-linear-to-r from-sky-500/10 via-sky-500/5 to-transparent border-sky-200/90'
      }`}
    >
      <div className="p-4 sm:p-5 space-y-3">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                isLagging
                  ? 'bg-amber-100 text-amber-700 border-amber-200 shadow-2xs'
                  : isCompleted
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200 shadow-2xs'
                  : 'bg-sky-100 text-sky-700 border-sky-200 shadow-2xs'
              }`}
            >
              <Droplet className={`w-5 h-5 ${isLagging ? 'animate-bounce' : ''}`} />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Smart Hydration Pace ({analysis.timeSlotName})
                </span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    isLagging
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : isCompleted
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-sky-100 text-sky-800 border border-sky-200'
                  }`}
                >
                  {isLagging ? 'Behind Schedule' : isCompleted ? 'Goal Smashed' : 'On Track'}
                </span>
              </div>
              <h4 className="font-editorial text-base sm:text-lg font-bold text-stone-900 leading-snug">
                {analysis.headline}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Quick action buttons */}
            <button
              type="button"
              onClick={() => handleQuickAdd(250)}
              className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-sky-50 text-sky-800 border border-sky-200 text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+250ml Glass</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickAdd(500)}
              className="px-2.5 py-1.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+500ml Bottle</span>
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-xl hover:bg-stone-200/60 text-stone-500 transition-colors cursor-pointer"
              title="Toggle smart hydration details & simulation"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="p-1.5 rounded-xl hover:bg-stone-200/60 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
              title="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Biological rationale */}
        <p className="text-xs text-stone-600 leading-relaxed font-sans">
          {analysis.biologicalReason}
        </p>

        {/* Progress Bar & Pace Guideline */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span className="font-mono-nums font-medium">
              Current: <strong className="text-stone-900">{currentMl} ml</strong> / {targetMl} ml
            </span>
            <span className="font-mono-nums font-medium text-stone-600">
              Circadian Benchmark: <strong>{analysis.expectedMl} ml</strong> ({analysis.percentGoal}%)
            </span>
          </div>

          <div className="relative w-full h-2.5 bg-stone-200/70 rounded-full overflow-hidden">
            {/* Expected pace marker */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-stone-500/50 z-10"
              style={{ left: `${Math.min(100, (analysis.expectedMl / targetMl) * 100)}%` }}
              title="Expected Pace by this hour"
            />
            {/* Current Fill */}
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isLagging
                  ? 'bg-amber-500'
                  : isCompleted
                  ? 'bg-emerald-600'
                  : 'bg-sky-500'
              }`}
              style={{ width: `${Math.min(100, (currentMl / targetMl) * 100)}%` }}
            />
          </div>
        </div>

        {/* Expandable Panel: Notification Trigger & Circadian Hour Simulator */}
        {isExpanded && (
          <div className="pt-3 border-t border-stone-200/70 space-y-3 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-white/70 p-3 rounded-xl border border-stone-200/80">
              <div className="space-y-0.5">
                <span className="font-semibold text-stone-900 block flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-sky-600" />
                  System Push Notifications
                </span>
                <span className="text-[11px] text-stone-500 block">
                  Receive browser prompts if you trail behind your personal hydration curve.
                </span>
              </div>

              <button
                type="button"
                onClick={handleRequestPushAlerts}
                className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-medium text-xs transition-colors shrink-0 cursor-pointer shadow-xs"
              >
                Enable Push Alerts
              </button>
            </div>

            {notifSuccess && (
              <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-2 rounded-lg font-medium">
                {notifSuccess}
              </p>
            )}

            {/* Time of Day Simulation Bar */}
            <div className="p-3 rounded-xl bg-white/70 border border-stone-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-stone-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-stone-500" />
                  Simulate Time-of-Day Pace:
                </span>
                <span className="font-mono-nums font-semibold text-stone-900">
                  {overrideHour !== undefined
                    ? `${overrideHour}:00 (${overrideHour < 12 ? 'AM' : 'PM'})`
                    : 'Current Real Time'}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setOverrideHour(10)}
                  className={`py-1 px-2 rounded-lg border transition-all cursor-pointer ${
                    overrideHour === 10
                      ? 'bg-sky-600 text-white border-sky-600 font-semibold'
                      : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  10 AM (Morning)
                </button>
                <button
                  type="button"
                  onClick={() => setOverrideHour(14)}
                  className={`py-1 px-2 rounded-lg border transition-all cursor-pointer ${
                    overrideHour === 14
                      ? 'bg-sky-600 text-white border-sky-600 font-semibold'
                      : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  2 PM (Midday)
                </button>
                <button
                  type="button"
                  onClick={() => setOverrideHour(17)}
                  className={`py-1 px-2 rounded-lg border transition-all cursor-pointer ${
                    overrideHour === 17
                      ? 'bg-sky-600 text-white border-sky-600 font-semibold'
                      : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  5 PM (Afternoon)
                </button>
                <button
                  type="button"
                  onClick={() => setOverrideHour(undefined)}
                  className={`py-1 px-2 rounded-lg border transition-all cursor-pointer ${
                    overrideHour === undefined
                      ? 'bg-stone-900 text-white border-stone-900 font-semibold'
                      : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  Live Clock
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
