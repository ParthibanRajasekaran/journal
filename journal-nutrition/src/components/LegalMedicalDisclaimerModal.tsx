import React from 'react';
import { ShieldAlert, HeartPulse, Lock, CheckCircle2, X, ExternalLink, Scale, FileText } from 'lucide-react';

interface LegalMedicalDisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
}

export const LegalMedicalDisclaimerModal: React.FC<LegalMedicalDisclaimerModalProps> = ({
  isOpen,
  onClose,
  onAccept,
}) => {
  if (!isOpen) return null;

  const handleAcknowledge = () => {
    localStorage.setItem('journal_terms_accepted_v1', 'true');
    if (onAccept) onAccept();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center border border-amber-200">
              <Scale className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                Regulatory & Store Compliance
              </span>
              <h3 className="font-editorial text-xl font-bold text-stone-900">
                Health & Medical Disclaimer
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1: Non-Diagnostic Medical Notice (Apple 1.4.1 & Google Play Compliance) */}
        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2">
          <div className="flex items-center gap-2 text-amber-900 font-semibold text-xs">
            <HeartPulse className="w-4 h-4 text-amber-700" />
            <span>Not Medical or Clinical Advice</span>
          </div>
          <p className="text-xs text-amber-950/80 leading-relaxed">
            Journal is an informational lifestyle and dietary awareness application. The nutritional calculations, macro breakdowns, and AI-assisted pacing recommendations are <strong>not clinical medical advice</strong>, diagnoses, or individualized treatment plans. Always consult a licensed physician, registered dietitian, or qualified healthcare professional before beginning any restrictive diet, fasting regime, or significant lifestyle change.
          </p>
        </div>

        {/* Section 2: AI Variance & Machine Learning Disclosure */}
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 block">
            AI Estimation & Variance Notice
          </span>
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-600 space-y-1.5">
            <p className="leading-relaxed">
              Nutrient and calorie figures are derived from computer vision and natural language models calibrated on reference USDA nutrition databases. Actual caloric density varies based on preparation methods, cooking oils, specific cultivars, and portion discrepancies.
            </p>
            <p className="text-[11px] text-stone-400">
              Always verify AI confidence ratings and adjust serving gram weights when exact medical precision is required.
            </p>
          </div>
        </div>

        {/* Section 3: Privacy & Data Sovereignty */}
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 block">
            Privacy & Biometric Data Sovereignty
          </span>
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-600 space-y-1.5">
            <div className="flex items-center gap-2 text-stone-900 font-medium">
              <Lock className="w-3.5 h-3.5 text-emerald-700" />
              <span>Local-First SQLite Encryption</span>
            </div>
            <p className="leading-relaxed">
              Your meal records and biometric credentials (Face ID, Touch ID, Fingerprint) remain strictly isolated on your device. We do not sell personal health telemetry or food intake data to third-party data brokers or advertisers.
            </p>
          </div>
        </div>

        {/* Section 4: Limitation of Liability */}
        <div className="text-[11px] text-stone-400 space-y-1 pt-1 border-t border-stone-100">
          <p>
            By using Journal, you acknowledge that you assume full responsibility for your nutritional decisions and that the developers and operators of Journal bear no liability for dietary choices or health outcomes.
          </p>
        </div>

        {/* Action Button */}
        <div className="pt-2 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleAcknowledge}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 active:scale-95 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>I Understand & Acknowledge</span>
          </button>
        </div>
      </div>
    </div>
  );
};
