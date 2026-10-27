import React, { useState } from 'react';
import { ProTipData, MealEntry } from '../types/nutrition';
import {
  Sparkles,
  ArrowLeftRight,
  X,
  Check,
  RotateCw,
  Lightbulb,
  ExternalLink,
  ChevronUp
} from 'lucide-react';

interface ProTipCardProps {
  proTip: ProTipData | null;
  onRefreshTip: () => void;
  isLoading?: boolean;
}

export const ProTipCard: React.FC<ProTipCardProps> = ({
  proTip,
  onRefreshTip,
  isLoading = false,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);

  if (!proTip) return null;

  // When dismissed, render an unobtrusive floating badge so user can re-open
  if (isDismissed) {
    return (
      <aside aria-label="AI Pro-Tips" className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40">
        <button
          type="button"
          onClick={() => setIsDismissed(false)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/95 text-stone-800 text-xs font-semibold shadow-lg hover:shadow-xl border border-stone-200/90 hover:border-emerald-600 transition-all cursor-pointer backdrop-blur-md group animate-in fade-in"
          title="Open AI Pro-Tip"
        >
          <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-emerald-700" />
          </div>
          <span>AI Pro-Tip</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </button>
      </aside>
    );
  }

  const isSwap = proTip.type === 'swap';

  return (
    <aside aria-label="AI Pro-Tips" className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40 max-w-sm w-[calc(100vw-2rem)] sm:w-96 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-stone-200/90 shadow-xl overflow-hidden ring-1 ring-stone-900/5">
        {/* Top Header Bar */}
        <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                isSwap ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {isSwap ? <ArrowLeftRight className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
            </div>
            <span className="text-xs font-bold text-stone-900">AI Pro-Tip</span>
            <span
              className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${
                isSwap
                  ? 'bg-amber-50 text-amber-900 border-amber-200'
                  : 'bg-emerald-50 text-emerald-900 border-emerald-200'
              }`}
            >
              {isSwap ? 'Smart Swap' : 'Nutrient Synergy'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onRefreshTip}
              disabled={isLoading}
              className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer disabled:opacity-50"
              title="Next Pro-Tip"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-700' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
              title="Dismiss tip"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-4 space-y-2.5 text-left">
          {proTip.contextMealName && (
            <span className="text-[11px] font-medium text-stone-400 block line-clamp-1">
              {proTip.contextMealName}
            </span>
          )}

          <h4 className="font-editorial text-base font-bold text-stone-900 leading-snug">
            {proTip.headline}
          </h4>

          <p className="text-xs text-stone-600 leading-relaxed">
            {proTip.tip}
          </p>

          {/* Key Benefit Pill */}
          <div className="pt-1 flex items-center justify-between">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 border border-stone-200/80">
              <span className="text-emerald-700 font-bold">Benefit:</span> {proTip.benefit}
            </span>

            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Got It</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
