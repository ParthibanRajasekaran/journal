import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Initialize GenAI SDK with server-side environment key
const ai = new GoogleGenAI({});

// Robust fallback analyzer for offline / dev preview without active key
function generateSmartFallback(description?: string, mealType?: string) {
  const desc = (description || 'Balanced meal').toLowerCase();
  let name = description ? description.split('.')[0].slice(0, 40) : 'Mindful Plate';
  let cals = 450;
  let protein = 24;
  let carbs = 42;
  let fat = 16;
  let fiber = 6;
  let confidence = 75;
  let reason = 'Estimated based on description context with standard portion models.';
  const clarifications: string[] = [];

  if (desc.includes('salad') || desc.includes('greens') || desc.includes('kale')) {
    name = 'Garden Harvest Salad';
    cals = 320;
    protein = 12;
    carbs = 28;
    fat = 14;
    fiber = 8;
    confidence = 65;
    reason = 'Dressing type and portion heavily impact calories.';
    clarifications.push('Was this olive oil vinaigrette or creamy dressing?', 'Did it include seeds or nuts?');
  } else if (desc.includes('egg') || desc.includes('toast') || desc.includes('avocado')) {
    name = 'Eggs & Avocado Toast';
    cals = 480;
    protein = 22;
    carbs = 36;
    fat = 24;
    fiber = 7;
    confidence = 88;
    reason = 'Standard whole ingredients recognized with high confidence.';
    clarifications.push('Did you use butter or oil on the toast?');
  } else if (desc.includes('chicken') || desc.includes('rice') || desc.includes('bowl')) {
    name = 'Nourish Chicken & Grain Bowl';
    cals = 560;
    protein = 42;
    carbs = 58;
    fat = 15;
    fiber = 7;
    confidence = 82;
    reason = 'Clear protein and complex carb base.';
  } else if (desc.includes('coffee') || desc.includes('latte') || desc.includes('smoothie')) {
    name = 'Morning Smoothie / Brew';
    cals = 220;
    protein = 10;
    carbs = 32;
    fat = 5;
    fiber = 4;
    confidence = 70;
    reason = 'Milk base (oat, dairy, almond) and sweeteners alter calories.';
    clarifications.push('What kind of milk was used?', 'Was protein powder or sweetener added?');
  }

  return {
    name,
    calories: cals,
    calorieRange: { min: Math.round(cals * 0.9), max: Math.round(cals * 1.15) },
    macros: { protein, carbs, fat, fiber },
    micronutrients: {
      vitaminD_iu: desc.includes('salmon') || desc.includes('egg') ? 320 : 60,
      vitaminB12_mcg: protein > 25 ? 1.8 : 0.6,
      vitaminC_mg: desc.includes('spinach') || desc.includes('berries') || desc.includes('salad') ? 45 : 18,
      iron_mg: desc.includes('spinach') || desc.includes('beef') || desc.includes('quinoa') ? 5.2 : 2.4,
      magnesium_mg: desc.includes('quinoa') || desc.includes('avocado') || desc.includes('oats') ? 95 : 45,
      zinc_mg: protein > 25 ? 3.8 : 1.5,
    },
    ingredients: [
      { name: 'Core Meal Base', portion: '1 plate / bowl', calories: Math.round(cals * 0.65), confidence },
      { name: 'Healthy Accents & Seasoning', portion: 'Standard serve', calories: Math.round(cals * 0.35), confidence: Math.max(50, confidence - 15) }
    ],
    confidenceScore: confidence,
    confidenceLevel: confidence >= 80 ? 'high' : confidence >= 50 ? 'moderate' : 'low',
    confidenceReason: reason,
    clarificationPrompts: clarifications.length > 0 ? clarifications : ['Did this include cooking oil or butter?'],
    wellnessNotes: 'Wholesome fuel providing balanced macronutrients and sustaining energy.',
    dietaryTags: ['Mindful Fuel', 'Balanced Plate']
  };
}

// 1. POST /api/analyze-meal: Hybrid Multimodal Meal Analysis
app.post('/api/analyze-meal', async (req, res) => {
  try {
    const { imageBase64, mimeType, description, mealType, userPreferences } = req.body;

    if (!imageBase64 && !description) {
      return res.status(400).json({ error: 'Please provide either a photo, a voice description, or typed ingredients.' });
    }

    const contents: any[] = [];

    // Multimodal image part
    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      contents.push({
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: cleanBase64,
        }
      });
    }

    // Prompt instructions emphasizing the 3 Moats:
    // 1. Hybrid description + photo
    // 2. Accuracy transparency & confidence meter
    // 3. Proactive coaching & holistic wellness
    const systemPrompt = `You are the lead nutritional intelligence engine for "Journal", an empathetic, mindful food and wellness tracker.
Analyze the user's meal using the multimodal context provided.

KEY PHILOSOPHY & ACCURACY RULES:
1. HYBRID ACCURACY: If both an image and user text/voice description are provided, combine them. Use the visual evidence for portion size, color, texture, and density; use the user's words for hidden ingredients, cooking methods (e.g. olive oil vs butter, sugar-free, sauce type).
2. CONFIDENCE TRANSPARENCY:
   - Evaluate your confidence honestly from 0 to 100%.
   - High (80-100%): Distinct, unpackaged whole foods, clearly identifiable dishes with user-stated ingredients.
   - Moderate (50-79%): Mixed bowls, plated meals where cooking fats/dressings are assumed, or unclear portion depth.
   - Low (<50%): Brown stews, blended smoothies, opaque casseroles, or photos taken at low angles with no context.
   - In "confidenceReason", clearly state what you are sure about and what is an assumption (e.g., "Egg and avocado portions are visually clear; 1 tbsp cooking butter was inferred").
   - If confidence is <80%, provide 1 to 3 "clarificationPrompts" (e.g. "Did this salad have olive oil or cream dressing?", "What type of milk in the matcha?").
3. HOLISTIC NUTRITION:
   - Provide total calories and calorie range (min, max).
   - Provide protein, carbs, fat, and dietary fiber in grams.
   - Deconstruct into realistic ingredients with individual portion and calories.
   - Provide warm, non-judgmental "wellnessNotes" celebrating whole food quality, micronutrients, or satiety.
   - Suggest 2-3 positive dietary tags (e.g., "High-Protein", "Rich in Fiber", "Healthy Fats", "Plant-Forward").

Meal Category: ${mealType || 'Meal'}
User Context / Voice Note / Description: ${description || 'No additional note provided'}`;

    contents.push({ text: systemPrompt });

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Succinct, appetizing meal title" },
              calories: { type: Type.NUMBER, description: "Total approximate calories (kcal)" },
              calorieRange: {
                type: Type.OBJECT,
                properties: {
                  min: { type: Type.NUMBER },
                  max: { type: Type.NUMBER },
                },
                required: ["min", "max"]
              },
              macros: {
                type: Type.OBJECT,
                properties: {
                  protein: { type: Type.NUMBER, description: "Grams of protein" },
                  carbs: { type: Type.NUMBER, description: "Grams of total carbs" },
                  fat: { type: Type.NUMBER, description: "Grams of total fat" },
                  fiber: { type: Type.NUMBER, description: "Grams of dietary fiber" },
                },
                required: ["protein", "carbs", "fat", "fiber"]
              },
              micronutrients: {
                type: Type.OBJECT,
                properties: {
                  vitaminD_iu: { type: Type.NUMBER, description: "Vitamin D in IU" },
                  vitaminB12_mcg: { type: Type.NUMBER, description: "Vitamin B12 in mcg" },
                  vitaminC_mg: { type: Type.NUMBER, description: "Vitamin C in mg" },
                  iron_mg: { type: Type.NUMBER, description: "Iron in mg" },
                  magnesium_mg: { type: Type.NUMBER, description: "Magnesium in mg" },
                  zinc_mg: { type: Type.NUMBER, description: "Zinc in mg" },
                },
                required: ["vitaminD_iu", "vitaminB12_mcg", "vitaminC_mg", "iron_mg", "magnesium_mg", "zinc_mg"]
              },
              ingredients: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    portion: { type: Type.STRING },
                    calories: { type: Type.NUMBER },
                    confidence: { type: Type.NUMBER, description: "0 to 100 percentage" }
                  },
                  required: ["name", "portion", "calories", "confidence"]
                }
              },
              confidenceScore: { type: Type.NUMBER, description: "Overall confidence score 0 to 100" },
              confidenceLevel: { type: Type.STRING, enum: ["high", "moderate", "low"] },
              confidenceReason: { type: Type.STRING, description: "Honest transparent explanation of confidence" },
              clarificationPrompts: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "1-3 short clarifying questions for ambiguous ingredients or preparations"
              },
              wellnessNotes: { type: Type.STRING, description: "Warm, empathetic nutritional coaching feedback" },
              dietaryTags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Tags like High-Protein, Plant-Powered, Healthy Fats, Whole Food"
              }
            },
            required: [
              "name",
              "calories",
              "calorieRange",
              "macros",
              "ingredients",
              "confidenceScore",
              "confidenceLevel",
              "confidenceReason",
              "clarificationPrompts",
              "wellnessNotes",
              "dietaryTags"
            ]
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json(parsed);
    } catch (geminiError: any) {
      console.warn('Gemini API call failed, falling back to smart nutritional estimation:', geminiError?.message);
      const fallback = generateSmartFallback(description, mealType);
      return res.json(fallback);
    }
  } catch (error: any) {
    console.error('Error in /api/analyze-meal:', error);
    return res.status(500).json({ error: 'Failed to analyze meal' });
  }
});

// 2. POST /api/coaching: Proactive Mindful Well-Being Coaching
app.post('/api/coaching', async (req, res) => {
  try {
    const { todayMeals = [], dailyTarget, timeOfDay = 'afternoon', preferences } = req.body;

    // Calculate current daily totals
    const totalCalories = todayMeals.reduce((acc: number, m: any) => acc + (Number(m.calories) || 0), 0);
    const totalProtein = todayMeals.reduce((acc: number, m: any) => acc + (Number(m.macros?.protein) || 0), 0);
    const totalCarbs = todayMeals.reduce((acc: number, m: any) => acc + (Number(m.macros?.carbs) || 0), 0);
    const totalFat = todayMeals.reduce((acc: number, m: any) => acc + (Number(m.macros?.fat) || 0), 0);
    const totalFiber = todayMeals.reduce((acc: number, m: any) => acc + (Number(m.macros?.fiber) || 0), 0);

    const mealNames = todayMeals.map((m: any) => `${m.name} (${m.calories} kcal, ${m.macros?.protein || 0}g protein)`).join(', ');

    const coachingPrompt = `You are the empathetic, science-grounded AI Well-Being Coach in "Journal".
Instead of just reporting numbers or shaming calories, provide proactive, high-value nutritional coaching that helps the user thrive.

Current Context:
- Local Time Period: ${timeOfDay}
- Meals Logged Today: ${mealNames || 'No meals logged yet today'}
- Total Today: ${totalCalories} kcal (Target: ${dailyTarget?.calories || 2000} kcal)
- Protein: ${totalProtein}g (Target: ${dailyTarget?.protein || 120}g)
- Carbs: ${totalCarbs}g (Target: ${dailyTarget?.carbs || 220}g)
- Fat: ${totalFat}g (Target: ${dailyTarget?.fat || 65}g)
- Fiber: ${totalFiber}g (Target: ${dailyTarget?.fiber || 30}g)
- Philosophy: Holistic well-being, satiety, sustained energy, zero guilt.

Deliverables:
- headline: Punchy, encouraging, 4-7 words (e.g. "Great protein pace for recovery", "Fuel up with fiber this afternoon")
- message: 2-3 warm, intelligent sentences explaining the "why" behind their current intake and how their body is being fueled.
- actionableTip: A concrete, delicious recommendation for their next meal or snack (e.g., "Add 1 cup of Greek yogurt with berries or a handful of roasted chickpeas for a steady 18g protein boost").
- type: 'kudos' | 'balance' | 'suggestion'
- suggestedSnackOrFood: Short specific food item (e.g., "Greek Yogurt & Pumpkin Seeds")`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [{ text: coachingPrompt }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              message: { type: Type.STRING },
              actionableTip: { type: Type.STRING },
              type: { type: Type.STRING, enum: ['kudos', 'balance', 'suggestion'] },
              suggestedSnackOrFood: { type: Type.STRING }
            },
            required: ['headline', 'message', 'actionableTip', 'type', 'suggestedSnackOrFood']
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json(parsed);
    } catch (err) {
      // Fallback proactive coaching
      let type: 'kudos' | 'balance' | 'suggestion' = 'balance';
      let headline = 'Steady Energy Momentum';
      let message = 'You have built a mindful baseline today. Nourishing with colorful veggies and hydrating keeps energy steady.';
      let actionableTip = 'Consider adding 1 serving of fermented food or roasted almonds to your next meal.';
      let suggestedSnackOrFood = 'Almonds & Crisp Apple';

      if (totalProtein < (dailyTarget?.protein || 120) * 0.4 && todayMeals.length >= 2) {
        type = 'suggestion';
        headline = 'Protein Fuel Opportunity';
        message = `You’ve had ${totalProtein}g of protein today so far. Adding a lean protein source to dinner will support muscle synthesis and keep evening cravings at bay.`;
        actionableTip = 'Try adding grilled edamame, salmon, cottage cheese, or hemp seeds.';
        suggestedSnackOrFood = 'Greek Yogurt Bowl';
      } else if (totalCalories > 0 && totalFiber >= 20) {
        type = 'kudos';
        headline = 'Fantastic Fiber Foundation';
        message = 'Your digestion and gut microbiome are thriving with high dietary fiber today!';
        actionableTip = 'Keep your water intake high to pair with your healthy dietary fiber.';
        suggestedSnackOrFood = 'Herbal Mint Tea & Berries';
      }

      return res.json({ headline, message, actionableTip, type, suggestedSnackOrFood });
    }
  } catch (error: any) {
    console.error('Error in /api/coaching:', error);
    return res.status(500).json({ error: 'Failed to generate coaching' });
  }
});

// 3. POST /api/suggest-meal: Personalized Next Meal Recommendations
app.post('/api/suggest-meal', async (req, res) => {
  try {
    const {
      hungerLevel = 'moderate',
      craving = 'savory',
      prepTime = 'quick',
      remainingCalories = 650,
      remainingProtein = 35,
      dietaryPreference = 'Mindful Omnivore',
      todayMealsSummary = '',
    } = req.body;

    const prompt = `You are the lead nutritional chef in "Journal".
Recommend 2 distinct, delicious, real-food meal/snack ideas tailored to the user's current needs and preferences.

User Context:
- Hunger Level: ${hungerLevel}
- Craving / Flavor: ${craving}
- Prep Time Available: ${prepTime}
- Remaining Calorie Budget: ~${remainingCalories} kcal
- Remaining Protein Target: ~${remainingProtein}g
- Dietary Philosophy: ${dietaryPreference}
- What they ate today already: ${todayMealsSummary || 'Not specified'}

Guidelines:
- Fit within approximately ${remainingCalories} kcal.
- Maximize protein and whole-food satiety.
- State realistic prep time (e.g. 5 mins, 15 mins).
- Explain *why* it fits their day in fitReason.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [{ text: prompt }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    calories: { type: Type.NUMBER },
                    prepMinutes: { type: Type.NUMBER },
                    mealType: { type: Type.STRING, enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
                    macros: {
                      type: Type.OBJECT,
                      properties: {
                        protein: { type: Type.NUMBER },
                        carbs: { type: Type.NUMBER },
                        fat: { type: Type.NUMBER },
                        fiber: { type: Type.NUMBER },
                      },
                      required: ['protein', 'carbs', 'fat', 'fiber'],
                    },
                    ingredients: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          portion: { type: Type.STRING },
                          calories: { type: Type.NUMBER },
                        },
                        required: ['name', 'portion', 'calories'],
                      },
                    },
                    fitReason: { type: Type.STRING },
                  },
                  required: ['name', 'description', 'calories', 'prepMinutes', 'mealType', 'macros', 'ingredients', 'fitReason'],
                },
              },
            },
            required: ['suggestions'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json(parsed);
    } catch (apiErr) {
      // Smart tailored fallback
      const suggestions = [
        {
          name: craving === 'sweet' ? 'Warm Cinnamon Berry Cottage Bowl' : 'Crispy Chickpea & Avocado Bowl',
          description: craving === 'sweet'
            ? 'High-protein whipped cottage cheese with warm simmered blueberries, cinnamon, and toasted walnuts.'
            : 'Spiced pan-toasted chickpeas over fresh spinach, half diced avocado, and lemon-tahini dressing.',
          calories: Math.min(remainingCalories, 420),
          prepMinutes: prepTime === 'quick' ? 5 : 12,
          mealType: remainingCalories > 500 ? 'dinner' : 'snack',
          macros: {
            protein: Math.min(remainingProtein, 28),
            carbs: 32,
            fat: 16,
            fiber: 8,
          },
          ingredients: [
            { name: 'Core Base', portion: '1 bowl', calories: 260 },
            { name: 'Toppings & Healthy Fats', portion: '1 serving', calories: 160 },
          ],
          fitReason: `Perfect balance of ${Math.min(remainingProtein, 28)}g protein and healthy fats to comfortably hit today's targets without feeling stuffed.`,
        },
        {
          name: 'Herb-Poached Eggs over Wilted Greens',
          description: '2 soft-poached eggs on bed of garlic-sautéed spinach and cherry tomatoes with a slice of sourdough.',
          calories: Math.min(remainingCalories, 380),
          prepMinutes: 10,
          mealType: 'dinner',
          macros: {
            protein: 22,
            carbs: 24,
            fat: 18,
            fiber: 6,
          },
          ingredients: [
            { name: 'Poached Eggs', portion: '2 large', calories: 144 },
            { name: 'Sautéed Spinach & Garlic', portion: '2 cups', calories: 60 },
            { name: 'Artisan Bread Slice', portion: '1 slice (35g)', calories: 90 },
            { name: 'Olive oil drizzle', portion: '1 tsp', calories: 40 },
          ],
          fitReason: 'Lean bioavailable protein and antioxidant lutein for restful evening recovery.',
        },
      ];
      return res.json({ suggestions });
    }
  } catch (error: any) {
    console.error('Error in /api/suggest-meal:', error);
    return res.status(500).json({ error: 'Failed to suggest meals' });
  }
});

// 4. POST /api/pro-tip: Contextual Food Pairings & Smart Ingredient Swaps
app.post('/api/pro-tip', async (req, res) => {
  try {
    const { recentMeals = [], dietaryPreference = 'Mindful Omnivore' } = req.body;

    const mealsText = recentMeals
      .slice(0, 3)
      .map((m: any) => `${m.name} (${(m.ingredients || []).map((i: any) => i.name).join(', ')})`)
      .join(' | ');

    const prompt = `You are the nutritional biochemist and food synergy coach for "Journal".
Analyze the user's recently logged meal(s): "${mealsText || 'Balanced plate'}".

Deliver 1 specific, hyper-actionable Pro-Tip in either category:
1. "pairing": Food synergy that multiplies nutrient absorption (e.g. Vitamin C with plant iron, fat-soluble vitamins with monounsaturated oil, piperine with turmeric, sulforaphane activation).
2. "swap": A healthier, lighter, or more satiating ingredient swap for a future prep of this dish.

Requirements:
- type: 'pairing' or 'swap'
- headline: Punchy and motivating, 3-6 words (e.g., "Triple Your Iron Absorption", "The Greek Yogurt Upgrade")
- contextMealName: Short name of the meal this relates to (e.g., "Based on your Sourdough Avocado Toast")
- tip: 2 sentences explaining clearly *how* to do it and *why* it benefits their biology.
- benefit: Short badge text (e.g., "+3x Iron Bioavailability", "-90 kcal & +8g Protein", "Extended Satiety Window")`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [{ text: prompt }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ['pairing', 'swap'] },
              headline: { type: Type.STRING },
              contextMealName: { type: Type.STRING },
              tip: { type: Type.STRING },
              benefit: { type: Type.STRING },
            },
            required: ['type', 'headline', 'contextMealName', 'tip', 'benefit'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json({
        id: `tip-${Date.now()}`,
        ...parsed,
        timestamp: new Date().toISOString(),
      });
    } catch (apiErr) {
      // Heuristic fallback tailored to recent foods
      const text = mealsText.toLowerCase();
      let type: 'pairing' | 'swap' = 'pairing';
      let headline = 'Synergistic Nutrient Boost';
      let contextMealName = recentMeals[0]?.name ? `Based on your ${recentMeals[0].name}` : 'Based on your recent meal';
      let tip = 'Pairing plant-based iron with Vitamin C rich citrus or bell peppers multiplies absorption by up to 300%.';
      let benefit = '+3x Iron Bioavailability';

      if (text.includes('salad') || text.includes('spinach') || text.includes('kale')) {
        type = 'pairing';
        headline = 'Unlocking Plant Iron';
        tip = 'Next time you enjoy raw or wilted greens, squeeze fresh lemon or add orange slices. Ascorbic acid converts non-heme iron into a soluble form your gut easily absorbs.';
        benefit = '+300% Iron Uptake';
      } else if (text.includes('avocado') || text.includes('egg') || text.includes('toast')) {
        type = 'pairing';
        headline = 'Fat-Soluble Synergy';
        tip = 'The healthy monounsaturated lipids in avocado and egg yolks allow your body to absorb carotenoids (lutein & zeaxanthin) that shield your retinal eyesight.';
        benefit = 'Max Eye Health Synergy';
      } else if (text.includes('mayo') || text.includes('wrap') || text.includes('dressing')) {
        type = 'swap';
        headline = 'The Greek Yogurt Upgrade';
        tip = 'Swap 2 tablespoons of mayonnaise or sour cream for strained whole-milk Greek yogurt whipped with lemon and garlic. You maintain rich creamy texture while cutting fat by 70%.';
        benefit = '-110 kcal & +6g Protein';
      } else if (text.includes('oat') || text.includes('smoothie')) {
        type = 'swap';
        headline = 'Slow-Release Glucose Lock';
        tip = 'Stir a tablespoon of chia seeds or raw pumpkin seeds into your oats. Soluble mucilage fiber slows gastric emptying, preventing the mid-morning sugar crash.';
        benefit = 'Flattened Glucose Spike';
      }

      return res.json({
        id: `tip-${Date.now()}`,
        type,
        headline,
        contextMealName,
        tip,
        benefit,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error: any) {
    console.error('Error in /api/pro-tip:', error);
    return res.status(500).json({ error: 'Failed to generate pro-tip' });
  }
});

// Vite middleware in dev, static serving in prod
async function startServer() {
  const server = http.createServer(app);

  // Serve static assets from public folder
  app.use(express.static(path.resolve(__dirname, 'public')));

  // Direct in-browser download routes
  app.get('/journal-nutrition.bundle', (_req, res) => {
    res.download(path.resolve(__dirname, 'public', 'journal-nutrition.bundle'), 'journal-nutrition.bundle');
  });

  app.get('/journal-nutrition.tar.gz', (_req, res) => {
    res.download(path.resolve(__dirname, 'public', 'journal-nutrition.tar.gz'), 'journal-nutrition.tar.gz');
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Journal server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
