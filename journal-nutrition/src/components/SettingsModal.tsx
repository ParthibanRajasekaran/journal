import React, { useState, useEffect } from 'react';
import { DailyTarget, UserPreferences, MealEntry } from '../types/nutrition';
import {
  Settings,
  Save,
  RotateCcw,
  Download,
  Upload,
  Check,
  Sparkles,
  Shield,
  Fingerprint,
  Lock,
  FolderArchive,
  ExternalLink,
  KeyRound,
  Bot,
  Scale,
  Link2,
  Copy,
  Zap,
} from 'lucide-react';
import { DEFAULT_TARGET, getSeedMeals } from '../data/seedMeals';
import {
  isBiometricLockEnabled,
  setBiometricLockEnabled,
  getSecurityPasscode,
  setSecurityPasscode,
} from '../services/biometricAuth';
import {
  AI_PROVIDERS,
  AIProvider,
  getSelectedAIProvider,
  setSelectedAIProvider,
  isSemanticCacheEnabled,
  setSemanticCacheEnabled,
} from '../utils/aiOptimizer';
import { getOrCreateIngestionToken, generateAssistantDeepLink } from '../utils/deepLinkHandler';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: DailyTarget;
  onUpdateTarget: (newTarget: DailyTarget) => void;
  dietaryPreference: UserPreferences['dietaryPreference'];
  onUpdateDietaryPreference: (pref: UserPreferences['dietaryPreference']) => void;
  allMeals: MealEntry[];
  onImportMeals: (meals: MealEntry[]) => void;
  onResetSeedData: () => void;
  onLockApp?: () => void;
  onOpenDisclaimer?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  target,
  onUpdateTarget,
  dietaryPreference,
  onUpdateDietaryPreference,
  allMeals,
  onImportMeals,
  onResetSeedData,
  onLockApp,
  onOpenDisclaimer,
}) => {
  const [formData, setFormData] = useState<DailyTarget>(target);
  const [selectedPref, setSelectedPref] = useState(dietaryPreference);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [bioEnabled, setBioEnabled] = useState<boolean>(() => isBiometricLockEnabled());
  const [passcode, setPasscode] = useState<string>(() => getSecurityPasscode());
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(() => getSelectedAIProvider());
  const [cacheEnabled, setCacheEnabled] = useState<boolean>(() => isSemanticCacheEnabled());
  const [ingestionToken] = useState<string>(() => getOrCreateIngestionToken());
  const [copiedToken, setCopiedToken] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateTarget(formData);
    onUpdateDietaryPreference(selectedPref);
    setBiometricLockEnabled(bioEnabled);
    setSecurityPasscode(passcode);
    setSelectedAIProvider(selectedProvider);
    setSemanticCacheEnabled(cacheEnabled);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 600);
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({ meals: allMeals, target }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `journal-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        if (json.meals && Array.isArray(json.meals)) {
          onImportMeals(json.meals);
          if (json.target) onUpdateTarget(json.target);
          alert('Successfully imported journal data!');
        }
      } catch (err) {
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl border border-stone-200 shadow-xl w-full max-w-lg my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-stone-800 text-white flex items-center justify-center">
              <Settings className="w-4 h-4 text-stone-200" />
            </div>
            <div>
              <h2 className="font-editorial text-xl font-semibold text-stone-900">
                Goals & Target Calibration
              </h2>
              <p className="text-xs text-stone-500">
                Personalize your calorie budget, macros, and coaching style
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 text-xs font-semibold cursor-pointer p-1"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Adaptive Mode Switch */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-950 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                <span>Smart Adaptive Mode</span>
              </div>
              <p className="text-xs text-stone-600">
                Adjusts meal pacing guidance throughout the day based on actual intake.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.adaptiveMode}
                onChange={e => setFormData({ ...formData, adaptiveMode: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-stone-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-700"></div>
            </label>
          </div>

          {/* Dietary Philosophy */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600">
              Dietary Philosophy & Coaching Focus
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                ['Mindful Omnivore', 'Mediterranean', 'High-Protein', 'Vegetarian', 'Plant-Based', 'Low-Carb'] as const
              ).map(pref => (
                <button
                  key={pref}
                  type="button"
                  onClick={() => setSelectedPref(pref)}
                  className={`p-2.5 rounded-xl text-xs font-medium text-left border transition-all cursor-pointer ${
                    selectedPref === pref
                      ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                      : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  {pref}
                </button>
              ))}
            </div>
          </div>

          {/* Daily Numerical Targets */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600">
              Daily Nutrition Targets
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-stone-500 font-medium">Daily Calories (kcal)</span>
                <input
                  type="number"
                  value={formData.calories}
                  onChange={e => setFormData({ ...formData, calories: Number(e.target.value) || 0 })}
                  className="w-full mt-1 p-2.5 rounded-xl border border-stone-200 font-mono-nums text-sm focus:border-emerald-700 focus:outline-hidden"
                />
              </div>

              <div>
                <span className="text-xs text-stone-500 font-medium">Protein Target (g)</span>
                <input
                  type="number"
                  value={formData.protein}
                  onChange={e => setFormData({ ...formData, protein: Number(e.target.value) || 0 })}
                  className="w-full mt-1 p-2.5 rounded-xl border border-stone-200 font-mono-nums text-sm focus:border-emerald-700 focus:outline-hidden"
                />
              </div>

              <div>
                <span className="text-xs text-stone-500 font-medium">Carbohydrates Target (g)</span>
                <input
                  type="number"
                  value={formData.carbs}
                  onChange={e => setFormData({ ...formData, carbs: Number(e.target.value) || 0 })}
                  className="w-full mt-1 p-2.5 rounded-xl border border-stone-200 font-mono-nums text-sm focus:border-emerald-700 focus:outline-hidden"
                />
              </div>

              <div>
                <span className="text-xs text-stone-500 font-medium">Healthy Fats Target (g)</span>
                <input
                  type="number"
                  value={formData.fat}
                  onChange={e => setFormData({ ...formData, fat: Number(e.target.value) || 0 })}
                  className="w-full mt-1 p-2.5 rounded-xl border border-stone-200 font-mono-nums text-sm focus:border-emerald-700 focus:outline-hidden"
                />
              </div>

              <div>
                <span className="text-xs text-stone-500 font-medium">Fiber Target (g)</span>
                <input
                  type="number"
                  value={formData.fiber}
                  onChange={e => setFormData({ ...formData, fiber: Number(e.target.value) || 0 })}
                  className="w-full mt-1 p-2.5 rounded-xl border border-stone-200 font-mono-nums text-sm focus:border-emerald-700 focus:outline-hidden"
                />
              </div>

              <div>
                <span className="text-xs text-stone-500 font-medium">Water Target (ml)</span>
                <input
                  type="number"
                  value={formData.waterGoalMl}
                  onChange={e => setFormData({ ...formData, waterGoalMl: Number(e.target.value) || 0 })}
                  className="w-full mt-1 p-2.5 rounded-xl border border-stone-200 font-mono-nums text-sm focus:border-emerald-700 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Biometric Security (Face ID / Touch ID / Android Biometrics) */}
          <div className="pt-4 border-t border-stone-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Fingerprint className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-stone-900 block">
                    Biometric Privacy Lock
                  </span>
                  <span className="text-[11px] text-stone-500 block">
                    Requires Face ID, Touch ID, or PIN when launching Journal
                  </span>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={bioEnabled}
                  onChange={(e) => setBioEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-stone-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-800"></div>
              </label>
            </div>

            {bioEnabled && (
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-stone-600 font-medium">Backup Security PIN:</span>
                  <input
                    type="password"
                    maxLength={4}
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="w-20 p-1 text-center font-mono-nums font-bold rounded-lg border border-stone-300 bg-white"
                  />
                </div>
                {onLockApp && (
                  <button
                    type="button"
                    onClick={() => {
                      onLockApp();
                      onClose();
                    }}
                    className="w-full py-1.5 px-3 rounded-lg bg-stone-900 text-white font-medium text-xs flex items-center justify-center gap-1.5 hover:bg-stone-800 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Lock App Immediately</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Direct In-Browser Export (Bypasses curl session blocks) */}
          <div className="pt-4 border-t border-stone-100 space-y-2.5">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 block">
                Export Native Codebase & GitHub Bundle
              </span>
              <span className="text-[11px] text-stone-500 block">
                Download directly in your active browser session (no curl authentication required).
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <a
                href="/journal-nutrition.bundle"
                download="journal-nutrition.bundle"
                className="flex items-center justify-between p-3 rounded-xl border border-emerald-300/80 bg-emerald-50/50 hover:bg-emerald-100/60 transition-colors text-xs font-medium text-emerald-950 group"
              >
                <div className="flex items-center gap-2">
                  <FolderArchive className="w-4 h-4 text-emerald-700" />
                  <div>
                    <span className="font-semibold block">Git Bundle</span>
                    <span className="text-[10px] text-stone-500 block">Includes git history & tags (~0.9 MB)</span>
                  </div>
                </div>
                <Download className="w-4 h-4 text-emerald-700 group-hover:translate-y-0.5 transition-transform" />
              </a>

              <a
                href="/journal-nutrition.tar.gz"
                download="journal-nutrition.tar.gz"
                className="flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 transition-colors text-xs font-medium text-stone-900 group"
              >
                <div className="flex items-center gap-2">
                  <FolderArchive className="w-4 h-4 text-stone-600" />
                  <div>
                    <span className="font-semibold block">Full Archive (.tar.gz)</span>
                    <span className="text-[10px] text-stone-500 block">iOS, Android & Web source code</span>
                  </div>
                </div>
                <Download className="w-4 h-4 text-stone-600 group-hover:translate-y-0.5 transition-transform" />
              </a>
            </div>
          </div>

          {/* AI Model Engine & BYOM Configuration */}
          <div className="pt-4 border-t border-stone-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-indigo-700" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-stone-900 block">
                    AI Vision Model Engine
                  </span>
                  <span className="text-[11px] text-stone-500 block">
                    Model-agnostic selection (BYOM: Bring Your Own Model)
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AI_PROVIDERS.map((prov) => (
                <button
                  key={prov.id}
                  type="button"
                  onClick={() => setSelectedProvider(prov.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedProvider === prov.id
                      ? 'border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-600'
                      : 'border-stone-200 bg-white hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-900">{prov.name}</span>
                    {prov.isFreeTier && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-800">
                        Default
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-stone-500 block pt-0.5">{prov.tagline}</span>
                  <span className="text-[10px] text-stone-400 block pt-1">{prov.costNote}</span>
                </button>
              ))}
            </div>

            {/* Zero-Token Semantic Cache Toggle */}
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-stone-900 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  <span>Instant Semantic Dish Cache</span>
                </span>
                <span className="text-[11px] text-stone-500 block">
                  Reuses local verified macros for repeat meals with 0 tokens consumed.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={cacheEnabled}
                  onChange={(e) => setCacheEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-stone-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-800"></div>
              </label>
            </div>
          </div>

          {/* External Assistant Integration (Siri, Claude, Muse, Duet) */}
          <div className="pt-4 border-t border-stone-100 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
                <Link2 className="w-4 h-4 text-teal-700" />
              </div>
              <div>
                <span className="text-xs font-semibold text-stone-900 block">
                  AI Assistant & Siri Integration
                </span>
                <span className="text-[11px] text-stone-500 block">
                  Allow external assistants (Claude, Duet, Siri) to log meals securely.
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-stone-600 font-medium">Personal Ingestion Token:</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(ingestionToken);
                    setCopiedToken(true);
                    setTimeout(() => setCopiedToken(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-1 rounded-md bg-white border border-stone-200 text-stone-800 hover:bg-stone-100 cursor-pointer"
                >
                  {copiedToken ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-stone-500" />
                      <span>{ingestionToken.slice(0, 14)}...</span>
                    </>
                  )}
                </button>
              </div>

              <div className="pt-1 text-[11px] text-stone-500 flex items-center justify-between border-t border-stone-200/60">
                <span>Deep Link: <code className="bg-white px-1 py-0.5 rounded border border-stone-200 font-mono">journal://log-meal?desc=...</code></span>
                <a
                  href={generateAssistantDeepLink()}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-800 font-semibold hover:underline"
                >
                  Test Link
                </a>
              </div>
            </div>
          </div>

          {/* Store Policy & Medical Disclaimer Button */}
          {onOpenDisclaimer && (
            <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-stone-500" />
                <span className="text-xs font-medium text-stone-700">Health & Store Disclaimers</span>
              </div>
              <button
                type="button"
                onClick={onOpenDisclaimer}
                className="text-xs text-emerald-800 hover:text-emerald-950 font-semibold underline cursor-pointer"
              >
                View App Store Policy 1.4.1 Terms
              </button>
            </div>
          )}

          {/* Save Footer */}
          <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 active:scale-95 text-white text-xs font-semibold shadow-sm hover:shadow transition-all cursor-pointer"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-200" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Target Goals</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
