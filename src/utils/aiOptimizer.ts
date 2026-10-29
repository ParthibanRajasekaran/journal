export type AIProvider = 'gemini-flash' | 'openai-gpt4o' | 'claude-3-5' | 'grok-vision';

export interface AIProviderConfig {
  id: AIProvider;
  name: string;
  tagline: string;
  isFreeTier: boolean;
  costNote: string;
}

export const AI_PROVIDERS: AIProviderConfig[] = [
  {
    id: 'gemini-flash',
    name: 'Google Gemini 2.5 Flash',
    tagline: 'Default • Free Tier Included',
    isFreeTier: true,
    costNote: 'Covered by default high-speed multimodal quota.',
  },
  {
    id: 'openai-gpt4o',
    name: 'OpenAI GPT-4o Mini',
    tagline: 'Bring Your Own OpenAI Key',
    isFreeTier: false,
    costNote: 'Direct user-billed via OpenAI platform API key.',
  },
  {
    id: 'claude-3-5',
    name: 'Anthropic Claude 3.5 Sonnet',
    tagline: 'High-Nuance Culinary Vision',
    isFreeTier: false,
    costNote: 'Direct user-billed via Anthropic API console.',
  },
  {
    id: 'grok-vision',
    name: 'xAI Grok Vision',
    tagline: 'Rapid Multi-Ingredient Analysis',
    isFreeTier: false,
    costNote: 'Direct user-billed via xAI developer access.',
  },
];

const STORAGE_KEY_PROVIDER = 'journal_ai_selected_provider';
const STORAGE_KEY_SEMANTIC_CACHE = 'journal_ai_semantic_cache_enabled';
const STORAGE_KEY_DISH_CACHE = 'journal_dish_analysis_cache_v1';

export function getSelectedAIProvider(): AIProvider {
  if (typeof window === 'undefined') return 'gemini-flash';
  return (localStorage.getItem(STORAGE_KEY_PROVIDER) as AIProvider) || 'gemini-flash';
}

export function setSelectedAIProvider(provider: AIProvider) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_PROVIDER, provider);
}

export function isSemanticCacheEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const val = localStorage.getItem(STORAGE_KEY_SEMANTIC_CACHE);
  return val === null ? true : val === 'true';
}

export function setSemanticCacheEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_SEMANTIC_CACHE, enabled ? 'true' : 'false');
}

/**
 * Normalizes text for semantic cache lookup (lowercase, trimmed)
 */
function normalizeDishKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function getCachedDishAnalysis(description: string): any | null {
  if (!isSemanticCacheEnabled() || !description || description.trim().length < 4) return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY_DISH_CACHE);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    const key = normalizeDishKey(description);
    const hit = cache[key];
    if (hit && Date.now() - hit.timestamp < 30 * 24 * 60 * 60 * 1000) {
      return hit.data;
    }
  } catch (e) {
    console.warn('[Cache] Lookup error:', e);
  }
  return null;
}

export function cacheDishAnalysis(description: string, data: any) {
  if (!isSemanticCacheEnabled() || !description) return;

  try {
    const raw = localStorage.getItem(STORAGE_KEY_DISH_CACHE);
    const cache = raw ? JSON.parse(raw) : {};
    const key = normalizeDishKey(description);
    cache[key] = {
      timestamp: Date.now(),
      data,
    };
    // Keep max 100 recent entries to stay lightweight
    const keys = Object.keys(cache);
    if (keys.length > 100) {
      delete cache[keys[0]];
    }
    localStorage.setItem(STORAGE_KEY_DISH_CACHE, JSON.stringify(cache));
  } catch (e) {
    console.warn('[Cache] Save error:', e);
  }
}

/**
 * High-performance client-side image downsampler
 * Resizes 12MB-48MB smartphone camera photos to max 1024px JPEG at 80% quality.
 * Reduces payload by 85-95% and saves thousands of vision tokens per meal.
 */
export function optimizeImageForVision(file: File, maxDim = 1024, quality = 0.8): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => {
        resolve(e.target?.result as string);
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}
