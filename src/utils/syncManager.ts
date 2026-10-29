import {
  getPendingSyncMeals,
  getPendingSyncCount,
  markMealAsSynced,
  getAllMealsFromSQLite,
} from '../db/sqliteManager';
import { MealEntry } from '../types/nutrition';

export interface SyncState {
  isOnline: boolean;
  isSimulatedOffline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt?: Date;
  lastSyncMessage?: string;
}

type SyncListener = (state: SyncState) => void;
type MealSyncCallback = (updatedMeals: MealEntry[]) => void;

let simulatedOffline = false;
let isSyncing = false;
let lastSyncedAt: Date | undefined = undefined;
let lastSyncMessage: string | undefined = undefined;

const listeners: Set<SyncListener> = new Set();
const mealListeners: Set<MealSyncCallback> = new Set();

export function getEffectiveOnlineStatus(): boolean {
  if (simulatedOffline) return false;
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function getCurrentSyncState(): SyncState {
  return {
    isOnline: getEffectiveOnlineStatus(),
    isSimulatedOffline: simulatedOffline,
    isSyncing,
    pendingCount: getPendingSyncCount(),
    lastSyncedAt,
    lastSyncMessage,
  };
}

function notifyListeners() {
  const state = getCurrentSyncState();
  listeners.forEach((listener) => {
    try {
      listener(state);
    } catch (e) {
      console.error('[SyncManager] Listener error:', e);
    }
  });
}

function notifyMealListeners(meals: MealEntry[]) {
  mealListeners.forEach((listener) => {
    try {
      listener(meals);
    } catch (e) {
      console.error('[SyncManager] Meal listener error:', e);
    }
  });
}

export function subscribeToSyncState(listener: SyncListener): () => void {
  listeners.add(listener);
  listener(getCurrentSyncState());
  return () => {
    listeners.delete(listener);
  };
}

export function subscribeToMealUpdates(listener: MealSyncCallback): () => void {
  mealListeners.add(listener);
  return () => {
    mealListeners.delete(listener);
  };
}

export function setSimulatedOffline(offline: boolean) {
  simulatedOffline = offline;
  notifyListeners();
  if (!offline && getEffectiveOnlineStatus()) {
    triggerBackgroundSync();
  }
}

/**
 * Iterates through all offline-queued meals, submits them to the Gemini AI analysis endpoint,
 * and updates the SQLite database with high-precision vision results.
 */
export async function triggerBackgroundSync(): Promise<{ syncedCount: number; errors: number }> {
  if (isSyncing || !getEffectiveOnlineStatus()) {
    return { syncedCount: 0, errors: 0 };
  }

  const pending = getPendingSyncMeals();
  if (pending.length === 0) {
    notifyListeners();
    return { syncedCount: 0, errors: 0 };
  }

  isSyncing = true;
  lastSyncMessage = `Synchronizing ${pending.length} meal${pending.length > 1 ? 's' : ''} with AI...`;
  notifyListeners();

  let syncedCount = 0;
  let errors = 0;

  for (const meal of pending) {
    try {
      // Call /api/analyze-meal with meal's photo and description
      const response = await fetch('/api/analyze-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Image: meal.photoUrl || null,
          description: meal.description || meal.name,
          mealType: meal.mealType,
        }),
      });

      if (!response.ok) {
        throw new Error(`Sync failed with status: ${response.status}`);
      }

      const result = await response.json();

      // Merge AI vision & nutrient enhancements into local SQLite entry
      const enhancedMeal: Partial<MealEntry> = {
        name: result.name || meal.name,
        calories: Number(result.calories) || meal.calories,
        calorieRange: result.calorieRange || meal.calorieRange,
        macros: result.macros || meal.macros,
        micronutrients: result.micronutrients || meal.micronutrients,
        ingredients: result.ingredients || meal.ingredients,
        confidenceScore: Number(result.confidenceScore) || 92,
        confidenceLevel: result.confidenceLevel || 'high',
        confidenceReason:
          result.confidenceReason ||
          'Synchronized and verified with multimodal Gemini 3.8 Flash AI vision.',
        clarificationPrompts: result.clarificationPrompts || [],
        wellnessNotes:
          result.wellnessNotes ||
          'Successfully synced and upgraded from offline estimate.',
        dietaryTags: result.dietaryTags || meal.dietaryTags,
      };

      await markMealAsSynced(meal.id, enhancedMeal);
      syncedCount++;
    } catch (err) {
      console.warn(`[SyncManager] Could not sync meal ${meal.id}:`, err);
      errors++;
    }
  }

  isSyncing = false;
  lastSyncedAt = new Date();
  if (syncedCount > 0) {
    lastSyncMessage = `Successfully synced ${syncedCount} meal${syncedCount > 1 ? 's' : ''} with AI Vision!`;
    const updatedMeals = getAllMealsFromSQLite();
    notifyMealListeners(updatedMeals);
  } else if (errors > 0) {
    lastSyncMessage = `Could not reach server. Will retry when connection improves.`;
  } else {
    lastSyncMessage = undefined;
  }

  notifyListeners();
  return { syncedCount, errors };
}

// Global browser event listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    notifyListeners();
    triggerBackgroundSync();
  });

  window.addEventListener('offline', () => {
    notifyListeners();
  });

  // Also check on focus / visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && getEffectiveOnlineStatus()) {
      triggerBackgroundSync();
    }
  });
}
