import React, { useEffect, useState } from 'react';
import { Award, Sparkles, X, RotateCw, CheckCircle2 } from 'lucide-react';
import { fireBotanicalConfetti } from '../utils/botanicalConfetti';

export interface MilestoneCelebrationData {
  id: string;
  title: string;
  category: string;
  description: string;
  payoff: string;
  icon?: React.ComponentType<any>;
  metricText: string;
  isUnlocked: boolean;
}

interface MilestoneCelebrationBannerProps {
  milestone: MilestoneCelebrationData | null;
  onClose: () => void;
}

export const MilestoneCelebrationBanner: React.FC<MilestoneCelebrationBannerProps> = ({
  milestone,
  onClose,
}) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!milestone) return;

    // Reset countdown
    setProgress(100);
    const duration = 7000; // 7 seconds
    const intervalTime = 50;
    const step = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev <= step) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [milestone, onClose]);

  if (!milestone) return null;

  const Icon = milestone.icon || Award;

  const handleCelebrateAgain = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    fireBotanicalConfetti(rect.left + rect.width / 2, rect.top, 85);
    setProgress(100); // reset countdown
  };

  return (
    <aside
      aria-label="Milestone celebration notification"
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300"
    >
      <div className="pointer-events-auto bg-stone-900/95 backdrop-blur-md text-stone-100 rounded-3xl p-4 sm:p-5 shadow-2xl border border-emerald-500/40 relative overflow-hidden">
        {/* Subtle radial glow background */}
        <div className="absolute -top-10 -right-10 w-36 h-36 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* Top Progress countdown line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-stone-800">
          <div
            className="h-full bg-linear-to-r from-emerald-500 via-teal-400 to-amber-400 transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-start justify-between gap-3 relative z-10 pt-1">
          <div className="flex items-start gap-3">
            {/* Radiant Icon badge */}
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-emerald-500/30 to-amber-500/20 border border-emerald-400/40 flex items-center justify-center shadow-inner shrink-0 text-emerald-300">
                <Icon className="w-6 h-6" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-stone-950 flex items-center justify-center text-[10px] font-bold shadow-xs">
                ✓
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Milestone Achieved
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                  {milestone.metricText}
                </span>
              </div>

              <h4 className="font-editorial text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                {milestone.title}
              </h4>

              <p className="text-xs text-stone-300 leading-relaxed font-sans">
                {milestone.payoff}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-xl transition-colors cursor-pointer shrink-0"
            aria-label="Dismiss milestone"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action bar */}
        <div className="mt-3.5 pt-3 border-t border-stone-800 flex items-center justify-between text-xs relative z-10">
          <span className="text-[11px] text-stone-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Added to your trophy cabinet
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCelebrateAgain}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-medium transition-all active:scale-95 cursor-pointer shadow-xs"
            >
              <RotateCw className="w-3 h-3" />
              Celebrate Again
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1.5 rounded-xl text-stone-400 hover:text-white text-xs transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
