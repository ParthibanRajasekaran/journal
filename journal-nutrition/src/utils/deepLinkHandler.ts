import { MealType } from '../types/nutrition';

export interface DeepLinkPayload {
  action: 'log' | 'quick-water' | 'open-settings';
  description?: string;
  mealType?: MealType;
  calories?: number;
  waterMl?: number;
}

const STORAGE_KEY_INGESTION_TOKEN = 'journal_assistant_ingestion_token';

/**
 * Gets or creates a persistent personal ingestion token for external AI assistants
 */
export function getOrCreateIngestionToken(): string {
  if (typeof window === 'undefined') return 'jnl_local_user_token';
  let token = localStorage.getItem(STORAGE_KEY_INGESTION_TOKEN);
  if (!token) {
    const randomBytes = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    token = `jnl_live_${randomBytes}`;
    localStorage.setItem(STORAGE_KEY_INGESTION_TOKEN, token);
  }
  return token;
}

/**
 * Generates a deep link URL for Apple Shortcuts / Siri / Claude Assistant
 */
export function generateAssistantDeepLink(desc = '2 poached eggs and avocado toast', type: MealType = 'breakfast'): string {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://journal.app';
  const encodedDesc = encodeURIComponent(desc);
  return `${base}/?action=log&desc=${encodedDesc}&type=${type}`;
}

/**
 * Checks URL parameters on app mount for external incoming assistant payloads
 */
export function parseIncomingDeepLink(): DeepLinkPayload | null {
  if (typeof window === 'undefined') return null;

  try {
    const searchParams = new URLSearchParams(window.location.search);
    const action = searchParams.get('action');

    if (action === 'log') {
      const desc = searchParams.get('desc') || undefined;
      const type = (searchParams.get('type') as MealType) || 'snack';
      const cal = searchParams.get('cal') ? Number(searchParams.get('cal')) : undefined;

      // Clean URL after consuming to avoid repeated captures on refresh
      window.history.replaceState({}, document.title, window.location.pathname);

      return {
        action: 'log',
        description: desc,
        mealType: type,
        calories: cal,
      };
    }

    if (action === 'water') {
      const ml = searchParams.get('ml') ? Number(searchParams.get('ml')) : 250;
      window.history.replaceState({}, document.title, window.location.pathname);
      return {
        action: 'quick-water',
        waterMl: ml,
      };
    }
  } catch (e) {
    console.warn('[DeepLink] Error parsing parameters:', e);
  }

  return null;
}
