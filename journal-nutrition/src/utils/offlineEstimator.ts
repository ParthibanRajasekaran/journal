import { MealEntry, MealType, MicronutrientProfile, MacroSplit } from '../types/nutrition';

interface FoodKeywordRule {
  keywords: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  vitD?: number;
  vitB12?: number;
  vitC?: number;
  iron?: number;
  magnesium?: number;
  zinc?: number;
}

const FOOD_RULES: FoodKeywordRule[] = [
  // High protein sources
  {
    keywords: ['chicken', 'turkey', 'poultry'],
    calories: 220,
    protein: 38,
    carbs: 0,
    fat: 6,
    fiber: 0,
    vitB12: 0.6,
    iron: 1.5,
    magnesium: 35,
    zinc: 2.2,
  },
  {
    keywords: ['salmon', 'trout', 'fish', 'tuna', 'sardine'],
    calories: 240,
    protein: 34,
    carbs: 0,
    fat: 11,
    fiber: 0,
    vitD: 420,
    vitB12: 2.1,
    iron: 1.2,
    magnesium: 40,
    zinc: 1.5,
  },
  {
    keywords: ['steak', 'beef', 'burger', 'ground beef'],
    calories: 290,
    protein: 36,
    carbs: 0,
    fat: 15,
    fiber: 0,
    vitB12: 2.2,
    iron: 3.5,
    zinc: 6.0,
    magnesium: 28,
  },
  {
    keywords: ['egg', 'eggs', 'omelet', 'frittata'],
    calories: 150,
    protein: 13,
    carbs: 1,
    fat: 10,
    fiber: 0,
    vitD: 88,
    vitB12: 0.9,
    iron: 1.8,
    zinc: 1.3,
  },
  {
    keywords: ['greek yogurt', 'yogurt', 'cottage cheese', 'skyr'],
    calories: 140,
    protein: 18,
    carbs: 8,
    fat: 2,
    fiber: 0,
    vitB12: 1.1,
    magnesium: 20,
    zinc: 1.2,
  },
  {
    keywords: ['protein shake', 'whey', 'protein powder'],
    calories: 160,
    protein: 28,
    carbs: 4,
    fat: 2,
    fiber: 1,
    vitB12: 0.5,
    iron: 1.0,
    magnesium: 45,
  },

  // Complex Carbs & Grains
  {
    keywords: ['rice', 'brown rice', 'jasmine rice'],
    calories: 215,
    protein: 5,
    carbs: 45,
    fat: 2,
    fiber: 2,
    magnesium: 40,
    zinc: 1.2,
    iron: 1.0,
  },
  {
    keywords: ['oatmeal', 'oats', 'porridge', 'granola'],
    calories: 200,
    protein: 7,
    carbs: 36,
    fat: 4,
    fiber: 5,
    iron: 2.2,
    magnesium: 70,
    zinc: 1.8,
  },
  {
    keywords: ['quinoa', 'couscous', 'farro'],
    calories: 190,
    protein: 7,
    carbs: 34,
    fat: 3,
    fiber: 4,
    iron: 2.5,
    magnesium: 60,
    zinc: 1.6,
  },
  {
    keywords: ['potato', 'sweet potato', 'yam'],
    calories: 140,
    protein: 3,
    carbs: 32,
    fat: 0,
    fiber: 4,
    vitC: 22,
    iron: 1.1,
    magnesium: 30,
  },
  {
    keywords: ['bread', 'toast', 'sourdough', 'bagel', 'pita'],
    calories: 160,
    protein: 6,
    carbs: 30,
    fat: 2,
    fiber: 2,
    iron: 1.5,
    magnesium: 22,
  },

  // Healthy Fats
  {
    keywords: ['avocado', 'guacamole'],
    calories: 180,
    protein: 2,
    carbs: 9,
    fat: 16,
    fiber: 7,
    vitC: 10,
    magnesium: 30,
    zinc: 0.6,
  },
  {
    keywords: ['olive oil', 'oil', 'butter'],
    calories: 120,
    protein: 0,
    carbs: 0,
    fat: 14,
    fiber: 0,
  },
  {
    keywords: ['almonds', 'walnuts', 'nuts', 'peanut butter', 'seeds'],
    calories: 170,
    protein: 6,
    carbs: 6,
    fat: 15,
    fiber: 3,
    magnesium: 75,
    iron: 1.3,
    zinc: 1.1,
  },

  // Greens & Vegetables
  {
    keywords: ['salad', 'spinach', 'kale', 'lettuce', 'greens'],
    calories: 45,
    protein: 3,
    carbs: 6,
    fat: 1,
    fiber: 4,
    vitC: 35,
    iron: 2.8,
    magnesium: 65,
    zinc: 0.8,
  },
  {
    keywords: ['broccoli', 'cauliflower', 'asparagus', 'bell pepper', 'pepper'],
    calories: 55,
    protein: 4,
    carbs: 10,
    fat: 0.5,
    fiber: 4,
    vitC: 75,
    iron: 1.2,
    magnesium: 25,
    zinc: 0.7,
  },

  // Fruits
  {
    keywords: ['berries', 'blueberry', 'blueberries', 'strawberry', 'strawberries'],
    calories: 70,
    protein: 1,
    carbs: 16,
    fat: 0.5,
    fiber: 4,
    vitC: 45,
    magnesium: 15,
  },
  {
    keywords: ['banana', 'apple', 'orange', 'fruit'],
    calories: 95,
    protein: 1,
    carbs: 24,
    fat: 0.3,
    fiber: 3,
    vitC: 25,
    magnesium: 28,
  },
];

/**
 * Estimates nutritional data from text/meal type when offline.
 */
export function estimateOfflineMeal(
  description: string,
  mealType: MealType,
  photoUrl?: string
): MealEntry {
  const text = (description || '').toLowerCase();

  // Baseline defaults based on meal type
  let baseCalories = mealType === 'snack' ? 220 : mealType === 'breakfast' ? 420 : 580;
  let baseProtein = mealType === 'snack' ? 10 : mealType === 'breakfast' ? 24 : 32;
  let baseCarbs = mealType === 'snack' ? 24 : mealType === 'breakfast' ? 40 : 55;
  let baseFat = mealType === 'snack' ? 8 : mealType === 'breakfast' ? 16 : 22;
  let baseFiber = 4;

  let vitD = 120;
  let vitB12 = 0.8;
  let vitC = 25;
  let iron = 3.5;
  let magnesium = 85;
  let zinc = 2.8;

  const matchedKeywords: string[] = [];

  // Match keyword rules
  FOOD_RULES.forEach((rule) => {
    const matched = rule.keywords.some((kw) => text.includes(kw));
    if (matched) {
      matchedKeywords.push(rule.keywords[0]);
      baseCalories += rule.calories * 0.5;
      baseProtein += rule.protein * 0.5;
      baseCarbs += rule.carbs * 0.5;
      baseFat += rule.fat * 0.5;
      baseFiber += rule.fiber * 0.5;

      if (rule.vitD) vitD += rule.vitD * 0.5;
      if (rule.vitB12) vitB12 += rule.vitB12 * 0.5;
      if (rule.vitC) vitC += rule.vitC * 0.5;
      if (rule.iron) iron += rule.iron * 0.5;
      if (rule.magnesium) magnesium += rule.magnesium * 0.5;
      if (rule.zinc) zinc += rule.zinc * 0.5;
    }
  });

  const finalCalories = Math.round(baseCalories);
  const macros: MacroSplit = {
    protein: Math.round(baseProtein),
    carbs: Math.round(baseCarbs),
    fat: Math.round(baseFat),
    fiber: Math.round(baseFiber),
  };

  const micronutrients: MicronutrientProfile = {
    vitaminD_iu: Math.round(vitD),
    vitaminB12_mcg: Number(vitB12.toFixed(1)),
    vitaminC_mg: Math.round(vitC),
    iron_mg: Number(iron.toFixed(1)),
    magnesium_mg: Math.round(magnesium),
    zinc_mg: Number(zinc.toFixed(1)),
  };

  const id = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Determine a readable name
  let name = description.trim();
  if (!name || name.length > 50) {
    if (matchedKeywords.length > 0) {
      name = matchedKeywords
        .slice(0, 3)
        .map((k) => k.charAt(0).toUpperCase() + k.slice(1))
        .join(' & ') + ` Plate`;
    } else {
      name = `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} Entry`;
    }
  }

  return {
    id,
    date,
    name,
    mealType,
    timestamp: now.toISOString(),
    photoUrl,
    description: description || 'Logged while offline',
    calories: finalCalories,
    calorieRange: {
      min: Math.round(finalCalories * 0.88),
      max: Math.round(finalCalories * 1.14),
    },
    macros,
    micronutrients,
    ingredients: matchedKeywords.map((kw) => ({
      name: kw.charAt(0).toUpperCase() + kw.slice(1),
      portion: '1 serving',
      calories: Math.round(finalCalories / Math.max(1, matchedKeywords.length)),
      confidence: 65,
    })),
    confidenceScore: 68,
    confidenceLevel: 'moderate',
    confidenceReason:
      'Optimistic local SQLite estimate calculated offline. AI vision will recalculate when connectivity is restored.',
    clarificationPrompts: ['Confirm exact portion sizes when back online'],
    wellnessNotes: 'Cached securely in local SQLite storage. Ready for cloud sync.',
    dietaryTags: ['Offline Logged', 'SQLite Cached'],
    syncStatus: 'pending_sync',
    isOfflineOptimistic: true,
  };
}
