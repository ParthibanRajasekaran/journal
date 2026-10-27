import React from 'react';
import { ShieldCheck, AlertCircle, HelpCircle, Check, Plus } from 'lucide-react';

interface ConfidenceMeterProps {
  score: number; // 0 - 100
  level: 'high' | 'moderate' | 'low';
  reason: string;
  clarifications?: string[];
  onApplyClarification?: (clarificationText: string) => void;
  compact?: boolean;
}

export const ConfidenceMeter: React.FC<ConfidenceMeterProps> = ({
  score,
  level,
  reason,
  clarifications = [],
  onApplyClarification,
  compact = false,
}) => {
  const getBadgeConfig = () => {
    if (score >= 80) {
      return {
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
        barBg: 'bg-emerald-600',
        text: 'High Certainty',
        icon: ShieldCheck,
        hint: 'Visuals & description match standard portion models.',
      };
    }
    if (score >= 55) {
      return {
        bg: 'bg-amber-50 text-amber-800 border-amber-200/80',
        barBg: 'bg-amber-500',
        text: 'Moderate Certainty',
        icon: AlertCircle,
        hint: 'Some ingredients or cooking oils were estimated.',
      };
    }
    return {
      bg: 'bg-stone-100 text-stone-800 border-stone-300',
      barBg: 'bg-stone-500',
      text: 'Low Certainty',
      icon: HelpCircle,
      hint: 'Mixed dish or hidden fats detected. Clarification recommended.',
    };
  };

  const config = getBadgeConfig();
  const Icon = config.icon;

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bg}`}>
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="font-mono-nums font-semibold">{score}%</span>
        <span className="text-stone-500">·</span>
        <span>{config.text}</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-4 bg-stone-50/80 border border-stone-200/70 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg border ${config.bg}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-600">
                AI Confidence Meter
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${config.bg}`}>
                {score}% Certainty ({config.text})
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">{config.hint}</p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-stone-200/80 h-2 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${config.barBg}`}
          style={{ width: `${Math.min(100, Math.max(5, score))}%` }}
        />
      </div>

      {/* Detailed reason */}
      {reason && (
        <p className="text-xs text-stone-600 leading-relaxed bg-white/70 p-2.5 rounded-lg border border-stone-200/60">
          <strong className="text-stone-800 font-medium">Analysis note:</strong> {reason}
        </p>
      )}

      {/* Clarification prompt chips for low/moderate accuracy */}
      {clarifications.length > 0 && onApplyClarification && (
        <div className="pt-1">
          <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
            Tap to clarify & refine estimate:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {clarifications.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onApplyClarification(prompt)}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-white border border-stone-300 hover:border-emerald-600 hover:bg-emerald-50/50 hover:text-emerald-900 transition-colors text-stone-700 cursor-pointer shadow-xs"
              >
                <Plus className="w-3 h-3 text-emerald-600" />
                <span>{prompt}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
