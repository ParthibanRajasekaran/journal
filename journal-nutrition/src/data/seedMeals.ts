import { MealEntry } from '../types/nutrition';

export function getTodayDateString(): string {
  const d = new Date();
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${da}`;
}

export function getYesterdayDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${da}`;
}

export const DEFAULT_TARGET = {
  calories: 2150,
  protein: 145,
  carbs: 215,
  fat: 70,
  fiber: 32,
  waterGoalMl: 2500,
  adaptiveMode: true,
};

export const INITIAL_COACH_INSIGHT = {
  headline: 'Steady Metabolic Momentum',
  message: 'Your fiber and protein foundation today is primed to stabilize blood glucose and maintain afternoon alertness.',
  actionableTip: 'Pair your dinner greens with a squeeze of fresh lemon to double non-heme iron absorption.',
  type: 'kudos' as const,
  suggestedSnackOrFood: 'Greek Yogurt with Blueberries & Chia',
  updatedAt: new Date().toISOString(),
};

export function getSeedMeals(): MealEntry[] {
  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();

  return [
    {
      id: 'seed-meal-1',
      name: 'Poached Eggs & Sourdough Avocado Toast',
      mealType: 'breakfast',
      timestamp: `${today}T08:30:00.000Z`,
      date: today,
      photoUrl: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80',
      description: '2 pasture-raised poached eggs over toasted rustic sourdough with half a smashed hass avocado, microgreens, and red pepper flakes.',
      calories: 485,
      calorieRange: { min: 450, max: 520 },
      macros: { protein: 22, carbs: 38, fat: 26, fiber: 8 },
      micronutrients: {
        vitaminD_iu: 140,
        vitaminB12_mcg: 1.3,
        vitaminC_mg: 16,
        iron_mg: 3.4,
        magnesium_mg: 88,
        zinc_mg: 2.2,
      },
      ingredients: [
        { name: 'Pasture-Raised Eggs (Poached)', portion: '2 large', calories: 144, confidence: 95 },
        { name: 'Rustic Artisan Sourdough', portion: '2 toasted slices (70g)', calories: 175, confidence: 90 },
        { name: 'Hass Avocado', portion: '1/2 medium (75g)', calories: 120, confidence: 88 },
        { name: 'Extra Virgin Olive Oil drizzle', portion: '1/2 tsp', calories: 40, confidence: 72 },
        { name: 'Microgreens & Chili Flakes', portion: 'Handful', calories: 6, confidence: 95 }
      ],
      confidenceScore: 89,
      confidenceLevel: 'high',
      confidenceReason: 'Distinct whole ingredients with clearly stated egg preparation; minor assumption on EVOO finishing drizzle.',
      clarificationPrompts: ['Did you spread butter under the avocado?'],
      wellnessNotes: 'Exceptional morning satiety. Rich in choline, carotenoids, and healthy heart monounsaturated lipids.',
      dietaryTags: ['Whole Food', 'High Fiber', 'Healthy Fats']
    },
    {
      id: 'seed-meal-2',
      name: 'Mediterranean Salmon & Quinoa Bowl',
      mealType: 'lunch',
      timestamp: `${today}T13:15:00.000Z`,
      date: today,
      photoUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
      description: 'Wild sockeye salmon fillet over warm tricolor quinoa, cucumber, cherry tomatoes, kalamata olives, and lemon-tahini dressing.',
      calories: 620,
      calorieRange: { min: 580, max: 670 },
      macros: { protein: 44, carbs: 52, fat: 24, fiber: 9 },
      micronutrients: {
        vitaminD_iu: 560,
        vitaminB12_mcg: 3.4,
        vitaminC_mg: 28,
        iron_mg: 4.6,
        magnesium_mg: 135,
        zinc_mg: 3.2,
      },
      ingredients: [
        { name: 'Wild Sockeye Salmon Fillet', portion: '170g cooked', calories: 290, confidence: 92 },
        { name: 'Tricolor Quinoa (Steamed)', portion: '1 cup cooked (185g)', calories: 222, confidence: 85 },
        { name: 'Cucumber & Cherry Tomatoes', portion: '1.5 cups diced', calories: 35, confidence: 94 },
        { name: 'Kalamata Olives', portion: '5 olives', calories: 45, confidence: 80 },
        { name: 'Lemon Herb Tahini Drizzle', portion: '1.5 tbsp', calories: 88, confidence: 68 }
      ],
      confidenceScore: 84,
      confidenceLevel: 'high',
      confidenceReason: 'Salmon volume and quinoa portion identified accurately; dressing density estimated.',
      clarificationPrompts: ['Was the salmon pan-seared in oil or baked?'],
      wellnessNotes: 'Prime anti-inflammatory fuel packed with 2,100mg EPA/DHA Omega-3s and prebiotic plant diversity.',
      dietaryTags: ['High Protein', 'Omega-3 Rich', 'Mediterranean']
    },
    {
      id: 'seed-meal-3',
      name: 'Matcha Latte with Oat Milk',
      mealType: 'snack',
      timestamp: `${today}T16:00:00.000Z`,
      date: today,
      photoUrl: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=800&q=80',
      description: 'Ceremonial grade Uji matcha whisked with 8oz unsweetened oat milk and a dash of cinnamon.',
      calories: 130,
      calorieRange: { min: 110, max: 155 },
      macros: { protein: 3, carbs: 18, fat: 4, fiber: 2 },
      micronutrients: {
        vitaminD_iu: 40,
        vitaminB12_mcg: 0.2,
        vitaminC_mg: 6,
        iron_mg: 0.8,
        magnesium_mg: 35,
        zinc_mg: 0.5,
      },
      ingredients: [
        { name: 'Ceremonial Matcha Powder', portion: '2g', calories: 6, confidence: 96 },
        { name: 'Barista Oat Milk (Unsweetened)', portion: '240ml', calories: 120, confidence: 78 },
        { name: 'Ceylon Cinnamon', portion: 'Dash', calories: 4, confidence: 90 }
      ],
      confidenceScore: 78,
      confidenceLevel: 'moderate',
      confidenceReason: 'Liquid beverages can vary significantly based on barista oat milk oil content or hidden sweeteners.',
      clarificationPrompts: ['Was this unsweetened or sweetened oat milk?'],
      wellnessNotes: 'Rich in L-theanine for sustained calm focus without afternoon caffeine jitters.',
      dietaryTags: ['Antioxidant-Rich', 'Plant-Based']
    },
    {
      id: 'seed-meal-yesterday-1',
      name: 'Greek Yogurt & Wild Berry Parfait',
      mealType: 'breakfast',
      timestamp: `${yesterday}T08:15:00.000Z`,
      date: yesterday,
      photoUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80',
      description: 'Plain 0% Greek yogurt layered with wild organic blueberries, blackberries, hemp hearts, and raw honey.',
      calories: 360,
      calorieRange: { min: 330, max: 390 },
      macros: { protein: 28, carbs: 44, fat: 7, fiber: 6 },
      micronutrients: {
        vitaminD_iu: 75,
        vitaminB12_mcg: 1.4,
        vitaminC_mg: 34,
        iron_mg: 2.2,
        magnesium_mg: 68,
        zinc_mg: 2.3,
      },
      ingredients: [
        { name: '0% Plain Greek Yogurt', portion: '220g', calories: 130, confidence: 92 },
        { name: 'Mixed Wild Berries', portion: '1 cup (150g)', calories: 84, confidence: 94 },
        { name: 'Shelled Hemp Hearts', portion: '1.5 tbsp (15g)', calories: 85, confidence: 88 },
        { name: 'Raw Clover Honey', portion: '1 tsp (7g)', calories: 21, confidence: 75 }
      ],
      confidenceScore: 88,
      confidenceLevel: 'high',
      confidenceReason: 'Portions and ingredients match standard standard cup measurements.',
      clarificationPrompts: [],
      wellnessNotes: 'Outstanding gut-healthy probiotics combined with polyphenol-dense antioxidants.',
      dietaryTags: ['High Protein', 'Probiotic', 'Whole Food']
    },
    {
      id: 'seed-meal-yesterday-2',
      name: 'Grass-Fed Beef & Sweet Potato Skillet',
      mealType: 'dinner',
      timestamp: `${yesterday}T19:30:00.000Z`,
      date: yesterday,
      photoUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
      description: 'Lean 90/10 grass-fed minced beef sautéed with roasted sweet potato cubes, sautéed bell peppers, and zucchini.',
      calories: 590,
      calorieRange: { min: 540, max: 640 },
      macros: { protein: 42, carbs: 48, fat: 22, fiber: 7 },
      micronutrients: {
        vitaminD_iu: 55,
        vitaminB12_mcg: 2.7,
        vitaminC_mg: 44,
        iron_mg: 5.4,
        magnesium_mg: 105,
        zinc_mg: 5.8,
      },
      ingredients: [
        { name: 'Grass-Fed Ground Beef (90/10)', portion: '180g cooked', calories: 340, confidence: 85 },
        { name: 'Roasted Sweet Potato', portion: '1 medium (150g)', calories: 135, confidence: 90 },
        { name: 'Sautéed Peppers & Zucchini', portion: '1.5 cups', calories: 55, confidence: 80 },
        { name: 'Avocado Oil for sautéing', portion: '1.5 tsp', calories: 60, confidence: 60 }
      ],
      confidenceScore: 79,
      confidenceLevel: 'moderate',
      confidenceReason: 'Mixed skillet makes precise oil retention difficult to verify without user clarification.',
      clarificationPrompts: ['What cooking oil did you use in the skillet?'],
      wellnessNotes: 'Bioavailable iron, zinc, and beta-carotene replenishing glycogen reserves.',
      dietaryTags: ['High Protein', 'Gluten-Free', 'Nutrient-Dense']
    }
  ];
}

// Generate rich 90-day historical data for Journal Pro, Daily Track Record & Micronutrient Trends
export function generateQuarterlyHistory(): MealEntry[] {
  const baseMeals = getSeedMeals();
  const history: MealEntry[] = [...baseMeals];

  const mealTemplates = [
    {
      name: 'Steel-Cut Oats with Berries & Hemp Seeds',
      type: 'breakfast' as const,
      calories: 390,
      protein: 15,
      carbs: 58,
      fat: 12,
      fiber: 9,
      confidence: 91,
      photoUrl: 'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?auto=format&fit=crop&w=600&q=80',
      reason: 'Standard dry measuring cup portions for whole grains and fruit.',
      micronutrients: { vitaminD_iu: 40, vitaminB12_mcg: 0.1, vitaminC_mg: 36, iron_mg: 4.1, magnesium_mg: 155, zinc_mg: 3.7 },
    },
    {
      name: 'Mediterranean Grilled Chicken & Farro Bowl',
      type: 'lunch' as const,
      calories: 580,
      protein: 46,
      carbs: 54,
      fat: 18,
      fiber: 8,
      confidence: 86,
      photoUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
      reason: 'Grilled chicken breast volume easily estimated; olive oil vinaigrette calculated.',
      micronutrients: { vitaminD_iu: 50, vitaminB12_mcg: 0.9, vitaminC_mg: 25, iron_mg: 3.7, magnesium_mg: 92, zinc_mg: 2.8 },
    },
    {
      name: 'Herb-Roasted Salmon & Asparagus',
      type: 'dinner' as const,
      calories: 520,
      protein: 40,
      carbs: 22,
      fat: 26,
      fiber: 6,
      confidence: 89,
      photoUrl: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=600&q=80',
      reason: 'Clear visual portion size for sockeye salmon fillet and roasted greens.',
      micronutrients: { vitaminD_iu: 530, vitaminB12_mcg: 3.2, vitaminC_mg: 22, iron_mg: 3.3, magnesium_mg: 110, zinc_mg: 2.5 },
    },
    {
      name: 'Greek Yogurt with Raw Walnuts',
      type: 'snack' as const,
      calories: 220,
      protein: 18,
      carbs: 12,
      fat: 12,
      fiber: 2,
      confidence: 94,
      photoUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80',
      reason: 'Single serve cup format.',
      micronutrients: { vitaminD_iu: 60, vitaminB12_mcg: 1.1, vitaminC_mg: 4, iron_mg: 1.2, magnesium_mg: 70, zinc_mg: 1.8 },
    },
    {
      name: 'Tofu & Edamame Soba Noodle Bowl',
      type: 'dinner' as const,
      calories: 490,
      protein: 32,
      carbs: 62,
      fat: 14,
      fiber: 7,
      confidence: 82,
      photoUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80',
      reason: 'Soba noodles and firm tofu recognized with sesame soy broth.',
      micronutrients: { vitaminD_iu: 30, vitaminB12_mcg: 0.2, vitaminC_mg: 18, iron_mg: 5.6, magnesium_mg: 142, zinc_mg: 3.4 },
    },
    {
      name: 'Avocado Toast with Soft Boiled Eggs',
      type: 'breakfast' as const,
      calories: 440,
      protein: 20,
      carbs: 34,
      fat: 22,
      fiber: 7,
      confidence: 90,
      photoUrl: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80',
      reason: 'Recognized with whole food certainty.',
      micronutrients: { vitaminD_iu: 120, vitaminB12_mcg: 1.1, vitaminC_mg: 14, iron_mg: 2.9, magnesium_mg: 82, zinc_mg: 2.0 },
    },
    {
      name: 'Roasted Turkey & Avocado Green Wrap',
      type: 'lunch' as const,
      calories: 480,
      protein: 38,
      carbs: 36,
      fat: 18,
      fiber: 6,
      confidence: 84,
      photoUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80',
      reason: 'Whole wheat flatbread wrap with sliced breast meat.',
      micronutrients: { vitaminD_iu: 45, vitaminB12_mcg: 1.4, vitaminC_mg: 24, iron_mg: 3.0, magnesium_mg: 78, zinc_mg: 2.8 },
    },
  ];

  // Populate days from 2 days ago up to 90 days ago
  for (let i = 2; i <= 90; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yr}-${mo}-${da}`;

    // Select 3 to 4 meals per day
    const bTemplate = mealTemplates[(i * 2) % mealTemplates.length];
    const lTemplate = mealTemplates[(i * 3 + 1) % mealTemplates.length];
    const dTemplate = mealTemplates[(i * 5 + 2) % mealTemplates.length];
    const sTemplate = mealTemplates[(i * 7 + 3) % mealTemplates.length];

    // Slight variance to feel organic
    const varC = (i % 5) * 10 - 20;

    history.push({
      id: `hist-${dateStr}-b`,
      name: bTemplate.name,
      mealType: 'breakfast',
      timestamp: `${dateStr}T08:15:00.000Z`,
      date: dateStr,
      photoUrl: bTemplate.photoUrl,
      description: `Logged via Journal hybrid mode.`,
      calories: Math.max(300, bTemplate.calories + varC),
      calorieRange: { min: bTemplate.calories - 30, max: bTemplate.calories + 40 },
      macros: {
        protein: bTemplate.protein,
        carbs: bTemplate.carbs,
        fat: bTemplate.fat,
        fiber: bTemplate.fiber,
      },
      micronutrients: bTemplate.micronutrients,
      ingredients: [{ name: bTemplate.name, portion: '1 serving', calories: bTemplate.calories, confidence: bTemplate.confidence }],
      confidenceScore: bTemplate.confidence,
      confidenceLevel: 'high',
      confidenceReason: bTemplate.reason,
      clarificationPrompts: [],
      wellnessNotes: 'Wholesome natural balance.',
      dietaryTags: ['Whole Food', 'Mindful'],
    });

    history.push({
      id: `hist-${dateStr}-l`,
      name: lTemplate.name,
      mealType: 'lunch',
      timestamp: `${dateStr}T13:00:00.000Z`,
      date: dateStr,
      photoUrl: lTemplate.photoUrl,
      description: `Midday recharge.`,
      calories: Math.max(400, lTemplate.calories + varC),
      calorieRange: { min: lTemplate.calories - 40, max: lTemplate.calories + 50 },
      macros: {
        protein: lTemplate.protein,
        carbs: lTemplate.carbs,
        fat: lTemplate.fat,
        fiber: lTemplate.fiber,
      },
      micronutrients: lTemplate.micronutrients,
      ingredients: [{ name: lTemplate.name, portion: '1 bowl', calories: lTemplate.calories, confidence: lTemplate.confidence }],
      confidenceScore: lTemplate.confidence,
      confidenceLevel: 'high',
      confidenceReason: lTemplate.reason,
      clarificationPrompts: [],
      wellnessNotes: 'Lean protein and sustained complex carbs.',
      dietaryTags: ['High Protein', 'Balanced'],
    });

    history.push({
      id: `hist-${dateStr}-d`,
      name: dTemplate.name,
      mealType: 'dinner',
      timestamp: `${dateStr}T19:30:00.000Z`,
      date: dateStr,
      photoUrl: dTemplate.photoUrl,
      description: `Evening mindful dinner.`,
      calories: Math.max(450, dTemplate.calories + varC),
      calorieRange: { min: dTemplate.calories - 40, max: dTemplate.calories + 60 },
      macros: {
        protein: dTemplate.protein,
        carbs: dTemplate.carbs,
        fat: dTemplate.fat,
        fiber: dTemplate.fiber,
      },
      micronutrients: dTemplate.micronutrients,
      ingredients: [{ name: dTemplate.name, portion: '1 plate', calories: dTemplate.calories, confidence: dTemplate.confidence }],
      confidenceScore: dTemplate.confidence,
      confidenceLevel: 'high',
      confidenceReason: dTemplate.reason,
      clarificationPrompts: [],
      wellnessNotes: 'Nourishing whole food dinner.',
      dietaryTags: ['Nutrient-Dense'],
    });

    // Add snack every other day
    if (i % 2 === 0) {
      history.push({
        id: `hist-${dateStr}-s`,
        name: sTemplate.name,
        mealType: 'snack',
        timestamp: `${dateStr}T16:20:00.000Z`,
        date: dateStr,
        photoUrl: sTemplate.photoUrl,
        description: `Afternoon satiety snack.`,
        calories: Math.max(150, sTemplate.calories),
        calorieRange: { min: sTemplate.calories - 20, max: sTemplate.calories + 25 },
        macros: {
          protein: sTemplate.protein,
          carbs: sTemplate.carbs,
          fat: sTemplate.fat,
          fiber: sTemplate.fiber,
        },
        micronutrients: sTemplate.micronutrients,
        ingredients: [{ name: sTemplate.name, portion: '1 snack', calories: sTemplate.calories, confidence: sTemplate.confidence }],
        confidenceScore: sTemplate.confidence,
        confidenceLevel: 'high',
        confidenceReason: sTemplate.reason,
        clarificationPrompts: [],
        wellnessNotes: 'Kept energy steady until dinner.',
        dietaryTags: ['Satiety'],
      });
    }
  }

  return history;
}
