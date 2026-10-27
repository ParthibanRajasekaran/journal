import React, { useState, useRef, useEffect } from 'react';
import { MealEntry, MealType, Ingredient, MacroSplit, MicronutrientProfile } from '../types/nutrition';
import { ConfidenceMeter } from './ConfidenceMeter';
import { getEffectiveOnlineStatus } from '../utils/syncManager';
import { estimateOfflineMeal } from '../utils/offlineEstimator';
import {
  optimizeImageForVision,
  getCachedDishAnalysis,
  cacheDishAnalysis,
  getSelectedAIProvider,
} from '../utils/aiOptimizer';
import {
  Camera,
  Mic,
  MicOff,
  Upload,
  X,
  Sparkles,
  Check,
  RefreshCw,
  Plus,
  Trash2,
  AlertCircle,
  HelpCircle,
  Image as ImageIcon,
  Flame,
  ArrowRight,
  Database,
  CloudOff,
} from 'lucide-react';

interface HybridCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveMeal: (meal: MealEntry) => void;
  initialMealType?: MealType;
  selectedDate: string;
}

// Demo quick-pick images for instant testing
const SAMPLE_MEALS = [
  {
    name: 'Sourdough Avocado & Eggs',
    type: 'breakfast' as MealType,
    url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80',
    desc: '2 poached eggs on toasted sourdough with half avocado and red chili flakes',
  },
  {
    name: 'Grain Bowl with Salmon & Greens',
    type: 'lunch' as MealType,
    url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
    desc: 'Baked salmon fillet over quinoa, roasted chickpeas, cherry tomatoes, and tahini dressing',
  },
  {
    name: 'Berries & Greek Yogurt Parfait',
    type: 'snack' as MealType,
    url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80',
    desc: '1 cup plain Greek yogurt with fresh blueberries, raspberries, and 1 tbsp chia seeds',
  }
];

export const HybridCaptureModal: React.FC<HybridCaptureModalProps> = ({
  isOpen,
  onClose,
  onSaveMeal,
  initialMealType = 'lunch',
  selectedDate,
}) => {
  // Capture states
  const [mealType, setMealType] = useState<MealType>(initialMealType);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [description, setDescription] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Analysis Result state for user verification
  const [analysisResult, setAnalysisResult] = useState<{
    name: string;
    calories: number;
    calorieRange: { min: number; max: number };
    macros: MacroSplit;
    micronutrients?: MicronutrientProfile;
    ingredients: Ingredient[];
    confidenceScore: number;
    confidenceLevel: 'high' | 'moderate' | 'low';
    confidenceReason: string;
    clarificationPrompts: string[];
    wellnessNotes: string;
    dietaryTags: string[];
  } | null>(null);

  // Video and audio references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setMealType(initialMealType);
  }, [initialMealType]);

  // Clean up media streams on unmount or close
  useEffect(() => {
    return () => {
      stopCamera();
      stopVoice();
    };
  }, []);

  if (!isOpen) return null;

  // Camera handling
  const startCamera = async () => {
    setAnalysisError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn('Camera access issue:', err);
      setAnalysisError('Camera access not granted. You can upload a photo or pick a sample instead.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setImagePreview(dataUrl);
      stopCamera();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const optimized = await optimizeImageForVision(file);
      setImagePreview(optimized);
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setImagePreview(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePickSample = (sample: typeof SAMPLE_MEALS[0]) => {
    setImagePreview(sample.url);
    setDescription(sample.desc);
    setMealType(sample.type);
    stopCamera();
  };

  // Voice dictation handling
  const startVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setAnalysisError('Speech recognition is not supported in this browser. Please type your meal details.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        setDescription(prev => (prev ? `${prev} ${transcript}` : transcript));
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Failed to start speech recognition:', err);
      setIsRecording(false);
    }
  };

  const stopVoice = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  };

  // Multimodal AI Analysis Call with Offline SQLite Fallback
  const handleAnalyze = async () => {
    if (!imagePreview && !description.trim()) {
      setAnalysisError('Please provide a photo or type/speak what you had.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    // Check instant zero-token semantic dish cache if no image
    if (!imagePreview && description.trim()) {
      const cached = getCachedDishAnalysis(description.trim());
      if (cached) {
        setAnalysisResult({
          ...cached,
          wellnessNotes: (cached.wellnessNotes || '') + ' • Verified from local zero-token cache',
        });
        setIsAnalyzing(false);
        return;
      }
    }

    // If offline or simulated offline: generate instant optimistic estimate
    if (!getEffectiveOnlineStatus()) {
      const estimate = estimateOfflineMeal(description, mealType, imagePreview || undefined);
      setAnalysisResult({
        name: estimate.name,
        calories: estimate.calories,
        calorieRange: estimate.calorieRange,
        macros: estimate.macros,
        micronutrients: estimate.micronutrients,
        ingredients: estimate.ingredients,
        confidenceScore: estimate.confidenceScore,
        confidenceLevel: estimate.confidenceLevel,
        confidenceReason: estimate.confidenceReason,
        clarificationPrompts: estimate.clarificationPrompts,
        wellnessNotes: estimate.wellnessNotes,
        dietaryTags: estimate.dietaryTags,
      });
      setIsAnalyzing(false);
      return;
    }

    try {
      const res = await fetch('/api/analyze-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imagePreview,
          description: description.trim(),
          mealType,
          provider: getSelectedAIProvider(),
        }),
      });

      if (!res.ok) {
        throw new Error('Analysis failed with status ' + res.status);
      }

      const data = await res.json();
      setAnalysisResult(data);
      if (description.trim()) {
        cacheDishAnalysis(description.trim(), data);
      }
    } catch (err: any) {
      console.warn('Online analysis failed, falling back to local SQLite estimate:', err);
      // Fallback to offline heuristic
      const estimate = estimateOfflineMeal(description, mealType, imagePreview || undefined);
      setAnalysisResult({
        name: estimate.name,
        calories: estimate.calories,
        calorieRange: estimate.calorieRange,
        macros: estimate.macros,
        micronutrients: estimate.micronutrients,
        ingredients: estimate.ingredients,
        confidenceScore: estimate.confidenceScore,
        confidenceLevel: estimate.confidenceLevel,
        confidenceReason: 'Calculated using local on-device heuristics (offline). Will synchronize when connectivity is restored.',
        clarificationPrompts: estimate.clarificationPrompts,
        wellnessNotes: 'Cached in local SQLite database. Queued for AI vision sync.',
        dietaryTags: estimate.dietaryTags,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // User applies clarification chip (e.g. "Did you use olive oil or butter?")
  const handleApplyClarification = (clarificationText: string) => {
    if (!analysisResult) return;

    // Apply smart calibration based on common clarifications
    let updatedCals = analysisResult.calories;
    let updatedFat = analysisResult.macros.fat;
    let updatedScore = Math.min(96, analysisResult.confidenceScore + 15);
    const updatedIngredients = [...analysisResult.ingredients];

    if (clarificationText.toLowerCase().includes('butter') || clarificationText.toLowerCase().includes('oil')) {
      updatedCals += 90;
      updatedFat += 10;
      updatedIngredients.push({
        name: 'Cooking Oil / Butter confirmed',
        portion: '1 tbsp (14g)',
        calories: 90,
        confidence: 95,
      });
    } else if (clarificationText.toLowerCase().includes('dressing')) {
      updatedCals += 80;
      updatedFat += 8;
      updatedIngredients.push({
        name: 'Dressing portion calibrated',
        portion: '1.5 tbsp',
        calories: 80,
        confidence: 90,
      });
    } else if (clarificationText.toLowerCase().includes('milk') || clarificationText.toLowerCase().includes('sweetener')) {
      updatedCals += 40;
      updatedIngredients.push({
        name: 'Beverage base confirmed',
        portion: 'Standard pour',
        calories: 40,
        confidence: 92,
      });
    } else {
      updatedScore = 95;
    }

    setAnalysisResult({
      ...analysisResult,
      calories: updatedCals,
      calorieRange: {
        min: Math.round(updatedCals * 0.95),
        max: Math.round(updatedCals * 1.05),
      },
      macros: {
        ...analysisResult.macros,
        fat: updatedFat,
      },
      ingredients: updatedIngredients,
      confidenceScore: updatedScore,
      confidenceLevel: 'high',
      confidenceReason: `Calibrated with your confirmation: "${clarificationText}".`,
      clarificationPrompts: analysisResult.clarificationPrompts.filter(p => p !== clarificationText),
    });
  };

  // User ingredient edit
  const handleRemoveIngredient = (index: number) => {
    if (!analysisResult) return;
    const removed = analysisResult.ingredients[index];
    const newIngredients = analysisResult.ingredients.filter((_, i) => i !== index);
    const newCalories = Math.max(0, analysisResult.calories - (removed.calories || 0));

    setAnalysisResult({
      ...analysisResult,
      calories: newCalories,
      ingredients: newIngredients,
    });
  };

  // Save confirmed meal
  const handleSaveConfirmed = () => {
    if (!analysisResult) return;

    const isOffline = !getEffectiveOnlineStatus();

    const newEntry: MealEntry = {
      id: `meal-${Date.now()}`,
      name: analysisResult.name,
      mealType,
      timestamp: `${selectedDate}T${new Date().toTimeString().slice(0, 8)}.000Z`,
      date: selectedDate,
      photoUrl: imagePreview || undefined,
      description: description.trim() || undefined,
      calories: analysisResult.calories,
      calorieRange: analysisResult.calorieRange,
      macros: analysisResult.macros,
      micronutrients: analysisResult.micronutrients,
      ingredients: analysisResult.ingredients,
      confidenceScore: analysisResult.confidenceScore,
      confidenceLevel: analysisResult.confidenceLevel,
      confidenceReason: analysisResult.confidenceReason,
      clarificationPrompts: analysisResult.clarificationPrompts,
      wellnessNotes: analysisResult.wellnessNotes,
      dietaryTags: analysisResult.dietaryTags,
      syncStatus: isOffline ? 'pending_sync' : 'synced',
      isOfflineOptimistic: isOffline,
    };

    onSaveMeal(newEntry);
    handleResetModal();
    onClose();
  };

  const handleResetModal = () => {
    stopCamera();
    stopVoice();
    setImagePreview(null);
    setDescription('');
    setAnalysisResult(null);
    setAnalysisError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl border border-stone-200 shadow-xl w-full max-w-2xl my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-800 text-white flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-200" />
            </div>
            <div>
              <h2 className="font-editorial text-xl font-semibold text-stone-900">
                {analysisResult ? 'Review & Calibrate Meal' : 'Hybrid Meal Capture'}
              </h2>
              <p className="text-xs text-stone-500">
                {analysisResult
                  ? 'Verify ingredients, adjust portions, and check accuracy'
                  : 'Photo + Description delivers ~50% higher accuracy'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              handleResetModal();
              onClose();
            }}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {analysisError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{analysisError}</span>
            </div>
          )}

          {!analysisResult ? (
            /* STEP 1: CAPTURE & CONTEXT INPUT */
            <div className="space-y-5">
              {/* Meal Type selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">
                  Meal Category
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setMealType(t)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer border ${
                        mealType === t
                          ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                          : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Photo Section: Live Webcam, Upload, or Sample */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500">
                    Meal Photo (Visual Evidence)
                  </label>
                  {imagePreview && (
                    <button
                      type="button"
                      onClick={() => setImagePreview(null)}
                      className="text-xs text-rose-600 hover:text-rose-800 font-medium cursor-pointer"
                    >
                      Remove photo
                    </button>
                  )}
                </div>

                {/* Live Webcam Stream */}
                {isCameraActive ? (
                  <div className="relative rounded-2xl overflow-hidden bg-stone-900 border border-stone-300 aspect-video flex items-center justify-center">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <div className="absolute bottom-4 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="px-5 py-2.5 rounded-full bg-white text-stone-900 font-semibold text-xs shadow-lg hover:bg-emerald-50 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                      >
                        <Camera className="w-4 h-4 text-emerald-800" />
                        <span>Take Snap</span>
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-4 py-2.5 rounded-full bg-stone-800/80 text-stone-200 text-xs font-medium hover:bg-stone-800 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : imagePreview ? (
                  /* Image Preview */
                  <div className="relative rounded-2xl overflow-hidden border border-stone-200 group aspect-video sm:aspect-21/9 max-h-56 bg-stone-100">
                    <img src={imagePreview} alt="Meal capture" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-stone-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg bg-white/95 text-stone-800 text-xs font-medium shadow-xs"
                      >
                        Replace
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Capture Buttons / Dropzone */
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="p-5 rounded-2xl border-2 border-dashed border-stone-300 hover:border-emerald-600 hover:bg-emerald-50/30 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer group"
                    >
                      <div className="p-3 rounded-xl bg-stone-100 group-hover:bg-emerald-100 text-stone-600 group-hover:text-emerald-800 transition-colors">
                        <Camera className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-semibold text-stone-800">Use Webcam / Camera</span>
                      <span className="text-[11px] text-stone-400">Live shutter snapshot</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-5 rounded-2xl border-2 border-dashed border-stone-300 hover:border-emerald-600 hover:bg-emerald-50/30 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer group"
                    >
                      <div className="p-3 rounded-xl bg-stone-100 group-hover:bg-emerald-100 text-stone-600 group-hover:text-emerald-800 transition-colors">
                        <Upload className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-semibold text-stone-800">Upload Food Photo</span>
                      <span className="text-[11px] text-stone-400">From camera roll or file</span>
                    </button>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {/* Instant Sample Image Buttons */}
                {!imagePreview && !isCameraActive && (
                  <div className="pt-1">
                    <span className="text-[11px] text-stone-400 font-medium block mb-1.5">
                      Or try with a quick sample meal:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {SAMPLE_MEALS.map((sample, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handlePickSample(sample)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-stone-100 hover:bg-emerald-50 hover:text-emerald-900 border border-stone-200 transition-colors text-stone-600 cursor-pointer"
                        >
                          <ImageIcon className="w-3 h-3 text-emerald-700" />
                          <span>{sample.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Voice & Text Description (The Hybrid Moat) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500">
                    Voice Note or Text Description (Context Boost)
                  </label>
                  <button
                    type="button"
                    onClick={isRecording ? stopVoice : startVoice}
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border transition-all cursor-pointer ${
                      isRecording
                        ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    <span>{isRecording ? 'Listening... (tap to finish)' : 'Voice Dictate'}</span>
                  </button>
                </div>

                <div className="relative">
                  <textarea
                    rows={3}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Speak or type what's on your plate (e.g., '2 eggs, avocado on sourdough toast, cooked in 1 tsp olive oil with a side of black coffee')..."
                    className="w-full p-3.5 rounded-xl border border-stone-200 text-xs sm:text-sm text-stone-800 placeholder:text-stone-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition-all bg-stone-50/50"
                  />
                </div>
                <p className="text-[11px] text-stone-400 leading-normal">
                  <strong className="text-stone-600">The Hybrid Moat:</strong> Mentioning cooking oils, dressings, or milk choices eliminates guess-work and maximizes AI accuracy.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || (!imagePreview && !description.trim())}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 active:scale-95 text-white text-xs font-semibold shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{getEffectiveOnlineStatus() ? 'Deconstructing Meal with AI...' : 'Calculating Local SQLite Estimate...'}</span>
                    </>
                  ) : !getEffectiveOnlineStatus() ? (
                    <>
                      <Database className="w-4 h-4 text-amber-200" />
                      <span>Estimate & Save to SQLite (Offline)</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-emerald-200" />
                      <span>Analyze Calorie & Nutrition</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* STEP 2: REVIEW & CONFIDENCE CALIBRATION */
            <div className="space-y-5 animate-in fade-in duration-200">
              {!getEffectiveOnlineStatus() && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-900 text-xs">
                  <CloudOff className="w-4 h-4 text-amber-700 shrink-0" />
                  <div>
                    <span className="font-semibold block">Offline Logging Active (SQLite)</span>
                    <span className="text-[11px] text-amber-800 leading-tight block">
                      This meal will be cached locally in SQLite with instant estimates. Once reconnected, Gemini AI vision will automatically enhance it in the background.
                    </span>
                  </div>
                </div>
              )}
              {/* Top Summary Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
                    Recognized Dish
                  </span>
                  <input
                    type="text"
                    value={analysisResult.name}
                    onChange={e => setAnalysisResult({ ...analysisResult, name: e.target.value })}
                    className="font-editorial text-xl font-bold text-stone-900 bg-transparent border-b border-transparent hover:border-stone-400 focus:border-emerald-700 focus:outline-hidden w-full"
                  />
                </div>

                <div className="text-left sm:text-right">
                  <div className="flex items-baseline gap-1.5 sm:justify-end">
                    <span className="font-mono-nums text-3xl font-bold text-stone-900">
                      {analysisResult.calories}
                    </span>
                    <span className="text-xs font-medium text-stone-500">kcal approx</span>
                  </div>
                  <span className="text-[11px] text-stone-500 font-mono-nums block">
                    Range: {analysisResult.calorieRange.min} – {analysisResult.calorieRange.max} kcal
                  </span>
                </div>
              </div>

              {/* Confidence Meter with Interactive Clarifications */}
              <ConfidenceMeter
                score={analysisResult.confidenceScore}
                level={analysisResult.confidenceLevel}
                reason={analysisResult.confidenceReason}
                clarifications={analysisResult.clarificationPrompts}
                onApplyClarification={handleApplyClarification}
              />

              {/* Macro Pills */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70">
                  <span className="text-[10px] text-stone-500 uppercase tracking-wider block font-semibold">Protein</span>
                  <span className="font-mono-nums font-bold text-emerald-800 text-sm">
                    {analysisResult.macros.protein}g
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70">
                  <span className="text-[10px] text-stone-500 uppercase tracking-wider block font-semibold">Carbs</span>
                  <span className="font-mono-nums font-bold text-amber-800 text-sm">
                    {analysisResult.macros.carbs}g
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70">
                  <span className="text-[10px] text-stone-500 uppercase tracking-wider block font-semibold">Fats</span>
                  <span className="font-mono-nums font-bold text-rose-800 text-sm">
                    {analysisResult.macros.fat}g
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70">
                  <span className="text-[10px] text-stone-500 uppercase tracking-wider block font-semibold">Fiber</span>
                  <span className="font-mono-nums font-bold text-teal-800 text-sm">
                    {analysisResult.macros.fiber}g
                  </span>
                </div>
              </div>

              {/* Deconstructed Ingredient List with adjustment */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-stone-600">
                    Deconstructed Ingredients ({analysisResult.ingredients.length})
                  </span>
                  <span className="text-[11px] text-stone-400">Tap trash to remove item</span>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {analysisResult.ingredients.map((ing, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-stone-200/80 hover:border-stone-300 transition-colors text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                        <div>
                          <p className="font-medium text-stone-900">{ing.name}</p>
                          <p className="text-[11px] text-stone-400">{ing.portion}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono-nums font-semibold text-stone-800">
                          {ing.calories} kcal
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveIngredient(idx)}
                          className="p-1 rounded text-stone-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Remove ingredient"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Wellness Note */}
              {analysisResult.wellnessNotes && (
                <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100 text-xs text-stone-700 space-y-1">
                  <span className="font-semibold text-emerald-950 block">Mindful Nutrition Note:</span>
                  <p className="leading-relaxed text-stone-600">{analysisResult.wellnessNotes}</p>
                </div>
              )}

              {/* Confirmation Action Buttons */}
              <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setAnalysisResult(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  Back to Edit Input
                </button>

                <button
                  type="button"
                  onClick={handleSaveConfirmed}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 active:scale-95 text-white text-xs font-semibold shadow-sm hover:shadow transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Log to Journal</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
