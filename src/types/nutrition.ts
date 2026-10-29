export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Ingredient {
  name: string;
  portion: string;
  calories: number;
  confidence: number;
}

export interface MacroSplit {
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface MicronutrientProfile {
  vitaminD_iu?: number;       // RDA: ~800 IU
  vitaminB12_mcg?: number;    // RDA: ~2.4 mcg
  vitaminC_mg?: number;       // RDA: ~90 mg
  iron_mg?: number;           // RDA: ~18 mg
  magnesium_mg?: number;      // RDA: ~400 mg
  zinc_mg?: number;           // RDA: ~11 mg
}

export const MICRONUTRIENT_RDAS: Record<keyof MicronutrientProfile, { name: string; rda: number; unit: string; category: 'vitamin' | 'mineral'; role: string; topFoodSources: string[] }> = {
  vitaminD_iu: {
    name: 'Vitamin D',
    rda: 800,
    unit: 'IU',
    category: 'vitamin',
    role: 'Immune defense, bone mineral density & mood regulation',
    topFoodSources: ['Wild Salmon', 'Egg Yolks', 'Fortified Plant Milk', 'Sardines'],
  },
  vitaminB12_mcg: {
    name: 'Vitamin B12',
    rda: 2.4,
    unit: 'mcg',
    category: 'vitamin',
    role: 'Nerve sheath integrity, red blood cell synthesis & mental energy',
    topFoodSources: ['Greek Yogurt', 'Nutritional Yeast', 'Lean Beef', 'Clams & Mussels'],
  },
  vitaminC_mg: {
    name: 'Vitamin C',
    rda: 90,
    unit: 'mg',
    category: 'vitamin',
    role: 'Collagen synthesis, immune activation & plant-iron absorption',
    topFoodSources: ['Bell Peppers', 'Citrus Fruit', 'Strawberries', 'Broccoli Florets'],
  },
  iron_mg: {
    name: 'Iron',
    rda: 18,
    unit: 'mg',
    category: 'mineral',
    role: 'Hemoglobin oxygen delivery to cells & fatigue prevention',
    topFoodSources: ['Lentils', 'Baby Spinach', 'Pumpkin Seeds', 'Grass-Fed Beef'],
  },
  magnesium_mg: {
    name: 'Magnesium',
    rda: 400,
    unit: 'mg',
    category: 'mineral',
    role: '300+ cellular biochemical reactions, muscle relaxation & sleep quality',
    topFoodSources: ['Dark Cacao / Cocoa', 'Pumpkin Seeds', 'Avocado', 'Quinoa'],
  },
  zinc_mg: {
    name: 'Zinc',
    rda: 11,
    unit: 'mg',
    category: 'mineral',
    role: 'Enzyme defense, wound healing, protein synthesis & taste acuity',
    topFoodSources: ['Hemp Seeds', 'Chickpeas', 'Oysters', 'Cashews'],
  },
};

export interface MealEntry {
  id: string;
  name: string;
  mealType: MealType;
  timestamp: string; // ISO
  date: string; // YYYY-MM-DD
  photoUrl?: string;
  description?: string;
  calories: number;
  calorieRange: {
    min: number;
    max: number;
  };
  macros: MacroSplit;
  micronutrients?: MicronutrientProfile;
  ingredients: Ingredient[];
  confidenceScore: number; // 0 - 100
  confidenceLevel: 'high' | 'moderate' | 'low';
  confidenceReason: string;
  clarificationPrompts: string[];
  wellnessNotes: string;
  dietaryTags: string[];
  syncStatus?: 'synced' | 'pending_sync' | 'syncing';
  isOfflineOptimistic?: boolean;
}

export interface DailyTarget {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  waterGoalMl: number;
  adaptiveMode: boolean;
}

export interface CoachInsight {
  headline: string;
  message: string;
  actionableTip: string;
  type: 'kudos' | 'balance' | 'suggestion';
  suggestedSnackOrFood: string;
  updatedAt: string;
}

export interface UserPreferences {
  name: string;
  dietaryPreference: 'Mindful Omnivore' | 'Mediterranean' | 'High-Protein' | 'Vegetarian' | 'Plant-Based' | 'Low-Carb';
  dailyTarget: DailyTarget;
}

export interface ProTipData {
  id: string;
  type: 'pairing' | 'swap';
  headline: string;
  contextMealName: string;
  tip: string;
  benefit: string;
  timestamp: string;
}
