// @ts-ignore
import initSqlJs from 'sql.js/dist/sql-wasm-inline.js';
import type { Database } from 'sql.js';
import { MealEntry, MicronutrientProfile, MacroSplit, Ingredient, MealType } from '../types/nutrition';
import { generateQuarterlyHistory } from '../data/seedMeals';

const IDB_NAME = 'Journal_SQLite_Store';
const IDB_STORE = 'sqlite_blob';
const IDB_KEY = 'journal_sqlite_db_binary';

let dbInstance: Database | null = null;
let isReady = false;
let initPromise: Promise<Database> | null = null;

// Open IndexedDB database for persistent SQLite binary storage
function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }
    const request = window.indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Load binary SQLite Uint8Array from IndexedDB
async function loadBinaryFromIDB(): Promise<Uint8Array | null> {
  try {
    const idb = await openIDB();
    return new Promise((resolve) => {
      const tx = idb.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_KEY);
      req.onsuccess = () => {
        if (req.result && req.result instanceof Uint8Array) {
          resolve(req.result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// Save binary SQLite Uint8Array to IndexedDB
async function saveBinaryToIDB(data: Uint8Array): Promise<void> {
  try {
    const idb = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.put(data, IDB_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[SQLite] Failed to persist binary to IndexedDB:', err);
  }
}

// Initialize SQLite Schema
function initSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS meals (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      name TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      photo_url TEXT,
      description TEXT,
      calories INTEGER NOT NULL,
      calorie_min INTEGER,
      calorie_max INTEGER,
      protein REAL NOT NULL,
      carbs REAL NOT NULL,
      fat REAL NOT NULL,
      fiber REAL NOT NULL,
      vit_d REAL,
      vit_b12 REAL,
      vit_c REAL,
      iron REAL,
      magnesium REAL,
      zinc REAL,
      confidence_score INTEGER,
      confidence_level TEXT,
      confidence_reason TEXT,
      ingredients_json TEXT,
      prompts_json TEXT,
      wellness_notes TEXT,
      dietary_tags_json TEXT,
      sync_status TEXT DEFAULT 'synced',
      is_offline_optimistic INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      meal_id TEXT NOT NULL,
      action TEXT NOT NULL,
      photo_url TEXT,
      description TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(date);
    CREATE INDEX IF NOT EXISTS idx_meals_sync ON meals(sync_status);
  `);
}

// Map SQLite row to MealEntry
function rowToMealEntry(row: any[]): MealEntry {
  const [
    id,
    date,
    _time,
    name,
    mealType,
    timestamp,
    photoUrl,
    description,
    calories,
    calMin,
    calMax,
    protein,
    carbs,
    fat,
    fiber,
    vitD,
    vitB12,
    vitC,
    iron,
    magnesium,
    zinc,
    confidenceScore,
    confidenceLevel,
    confidenceReason,
    ingredientsJson,
    promptsJson,
    wellnessNotes,
    dietaryTagsJson,
    syncStatus,
    isOfflineOptimistic,
  ] = row;

  let ingredients: Ingredient[] = [];
  try {
    ingredients = ingredientsJson ? JSON.parse(ingredientsJson) : [];
  } catch {}

  let clarificationPrompts: string[] = [];
  try {
    clarificationPrompts = promptsJson ? JSON.parse(promptsJson) : [];
  } catch {}

  let dietaryTags: string[] = [];
  try {
    dietaryTags = dietaryTagsJson ? JSON.parse(dietaryTagsJson) : [];
  } catch {}

  const micronutrients: MicronutrientProfile = {
    vitaminD_iu: vitD !== null && vitD !== undefined ? Number(vitD) : undefined,
    vitaminB12_mcg: vitB12 !== null && vitB12 !== undefined ? Number(vitB12) : undefined,
    vitaminC_mg: vitC !== null && vitC !== undefined ? Number(vitC) : undefined,
    iron_mg: iron !== null && iron !== undefined ? Number(iron) : undefined,
    magnesium_mg: magnesium !== null && magnesium !== undefined ? Number(magnesium) : undefined,
    zinc_mg: zinc !== null && zinc !== undefined ? Number(zinc) : undefined,
  };

  return {
    id: String(id),
    date: String(date),
    name: String(name),
    mealType: mealType as MealType,
    timestamp: String(timestamp),
    photoUrl: photoUrl ? String(photoUrl) : undefined,
    description: description ? String(description) : undefined,
    calories: Number(calories),
    calorieRange: {
      min: Number(calMin || calories),
      max: Number(calMax || calories),
    },
    macros: {
      protein: Number(protein),
      carbs: Number(carbs),
      fat: Number(fat),
      fiber: Number(fiber),
    },
    micronutrients,
    ingredients,
    confidenceScore: Number(confidenceScore || 85),
    confidenceLevel: (confidenceLevel as 'high' | 'moderate' | 'low') || 'high',
    confidenceReason: String(confidenceReason || ''),
    clarificationPrompts,
    wellnessNotes: String(wellnessNotes || ''),
    dietaryTags,
    syncStatus: (syncStatus as 'synced' | 'pending_sync' | 'syncing') || 'synced',
    isOfflineOptimistic: Boolean(isOfflineOptimistic),
  };
}

/**
 * Initializes the SQLite WebAssembly database, restores from IndexedDB,
 * and seeds initial 90-day archive if first launch.
 */
export async function initSQLite(): Promise<Database> {
  if (dbInstance && isReady) {
    return dbInstance;
  }
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const SQL = await initSqlJs();

      const existingData = await loadBinaryFromIDB();
      let db: Database;

      if (existingData && existingData.byteLength > 0) {
        db = new SQL.Database(existingData);
        initSchema(db);
      } else {
        db = new SQL.Database();
        initSchema(db);

        // Seed initial meals from SEED_MEALS
        const insertStmt = db.prepare(`
          INSERT OR REPLACE INTO meals (
            id, date, time, name, meal_type, timestamp, photo_url, description,
            calories, calorie_min, calorie_max, protein, carbs, fat, fiber,
            vit_d, vit_b12, vit_c, iron, magnesium, zinc,
            confidence_score, confidence_level, confidence_reason,
            ingredients_json, prompts_json, wellness_notes, dietary_tags_json,
            sync_status, is_offline_optimistic, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const meal of generateQuarterlyHistory()) {
          const time = meal.timestamp ? meal.timestamp.slice(11, 16) : '12:00';
          insertStmt.run([
            meal.id,
            meal.date,
            time,
            meal.name,
            meal.mealType,
            meal.timestamp,
            meal.photoUrl || null,
            meal.description || null,
            meal.calories,
            meal.calorieRange?.min || meal.calories,
            meal.calorieRange?.max || meal.calories,
            meal.macros.protein,
            meal.macros.carbs,
            meal.macros.fat,
            meal.macros.fiber,
            meal.micronutrients?.vitaminD_iu ?? null,
            meal.micronutrients?.vitaminB12_mcg ?? null,
            meal.micronutrients?.vitaminC_mg ?? null,
            meal.micronutrients?.iron_mg ?? null,
            meal.micronutrients?.magnesium_mg ?? null,
            meal.micronutrients?.zinc_mg ?? null,
            meal.confidenceScore,
            meal.confidenceLevel,
            meal.confidenceReason,
            JSON.stringify(meal.ingredients || []),
            JSON.stringify(meal.clarificationPrompts || []),
            meal.wellnessNotes || '',
            JSON.stringify(meal.dietaryTags || []),
            'synced',
            0,
            Date.now(),
          ]);
        }
        insertStmt.free();

        // Persist fresh database to IndexedDB
        const binary = db.export();
        await saveBinaryToIDB(binary);
      }

      dbInstance = db;
      isReady = true;
      return db;
    } catch (err) {
      console.error('[SQLite] Initialization failed, using in-memory fallback:', err);
      throw err;
    }
  })();

  return initPromise;
}

/**
 * Persists the current in-memory SQLite database state to IndexedDB
 */
export async function persistSQLite(): Promise<void> {
  if (!dbInstance) return;
  try {
    const binary = dbInstance.export();
    await saveBinaryToIDB(binary);
  } catch (err) {
    console.error('[SQLite] Failed to persist:', err);
  }
}

/**
 * Retrieves all meals ordered chronologically (newest first)
 */
export function getAllMealsFromSQLite(): MealEntry[] {
  if (!dbInstance) return [];

  const stmt = dbInstance.prepare(`
    SELECT
      id, date, time, name, meal_type, timestamp, photo_url, description,
      calories, calorie_min, calorie_max, protein, carbs, fat, fiber,
      vit_d, vit_b12, vit_c, iron, magnesium, zinc,
      confidence_score, confidence_level, confidence_reason,
      ingredients_json, prompts_json, wellness_notes, dietary_tags_json,
      sync_status, is_offline_optimistic
    FROM meals
    ORDER BY date DESC, timestamp DESC
  `);

  const meals: MealEntry[] = [];
  while (stmt.step()) {
    meals.push(rowToMealEntry(stmt.get()));
  }
  stmt.free();

  return meals;
}

/**
 * Inserts or updates a meal in the SQLite database and persists to IndexedDB
 */
export async function saveMealToSQLite(
  meal: MealEntry,
  syncStatus: 'synced' | 'pending_sync' | 'syncing' = 'synced',
  isOfflineOptimistic = false
): Promise<void> {
  if (!dbInstance) {
    await initSQLite();
  }
  if (!dbInstance) return;

  const time = meal.timestamp ? meal.timestamp.slice(11, 16) : '12:00';

  dbInstance.run(
    `
    INSERT OR REPLACE INTO meals (
      id, date, time, name, meal_type, timestamp, photo_url, description,
      calories, calorie_min, calorie_max, protein, carbs, fat, fiber,
      vit_d, vit_b12, vit_c, iron, magnesium, zinc,
      confidence_score, confidence_level, confidence_reason,
      ingredients_json, prompts_json, wellness_notes, dietary_tags_json,
      sync_status, is_offline_optimistic, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      meal.id,
      meal.date,
      time,
      meal.name,
      meal.mealType,
      meal.timestamp,
      meal.photoUrl || null,
      meal.description || null,
      meal.calories,
      meal.calorieRange?.min || meal.calories,
      meal.calorieRange?.max || meal.calories,
      meal.macros.protein,
      meal.macros.carbs,
      meal.macros.fat,
      meal.macros.fiber,
      meal.micronutrients?.vitaminD_iu ?? null,
      meal.micronutrients?.vitaminB12_mcg ?? null,
      meal.micronutrients?.vitaminC_mg ?? null,
      meal.micronutrients?.iron_mg ?? null,
      meal.micronutrients?.magnesium_mg ?? null,
      meal.micronutrients?.zinc_mg ?? null,
      meal.confidenceScore,
      meal.confidenceLevel,
      meal.confidenceReason,
      JSON.stringify(meal.ingredients || []),
      JSON.stringify(meal.clarificationPrompts || []),
      meal.wellnessNotes || '',
      JSON.stringify(meal.dietaryTags || []),
      syncStatus,
      isOfflineOptimistic ? 1 : 0,
      Date.now(),
    ]
  );

  // If pending sync, add to sync_queue
  if (syncStatus === 'pending_sync') {
    dbInstance.run(
      `INSERT OR REPLACE INTO sync_queue (id, meal_id, action, photo_url, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        `queue_${meal.id}`,
        meal.id,
        'create',
        meal.photoUrl || null,
        meal.description || null,
        Date.now(),
      ]
    );
  }

  await persistSQLite();
}

/**
 * Deletes a meal from SQLite database
 */
export async function deleteMealFromSQLite(mealId: string): Promise<void> {
  if (!dbInstance) return;

  dbInstance.run(`DELETE FROM meals WHERE id = ?`, [mealId]);
  dbInstance.run(`DELETE FROM sync_queue WHERE meal_id = ?`, [mealId]);

  await persistSQLite();
}

/**
 * Gets count of meals waiting for synchronization
 */
export function getPendingSyncCount(): number {
  if (!dbInstance) return 0;
  try {
    const res = dbInstance.exec(`SELECT COUNT(*) FROM meals WHERE sync_status = 'pending_sync'`);
    if (res.length > 0 && res[0].values.length > 0) {
      return Number(res[0].values[0][0]);
    }
  } catch {}
  return 0;
}

/**
 * Gets all meals marked as pending_sync
 */
export function getPendingSyncMeals(): MealEntry[] {
  if (!dbInstance) return [];

  const stmt = dbInstance.prepare(`
    SELECT
      id, date, time, name, meal_type, timestamp, photo_url, description,
      calories, calorie_min, calorie_max, protein, carbs, fat, fiber,
      vit_d, vit_b12, vit_c, iron, magnesium, zinc,
      confidence_score, confidence_level, confidence_reason,
      ingredients_json, prompts_json, wellness_notes, dietary_tags_json,
      sync_status, is_offline_optimistic
    FROM meals
    WHERE sync_status = 'pending_sync'
    ORDER BY created_at ASC
  `);

  const meals: MealEntry[] = [];
  while (stmt.step()) {
    meals.push(rowToMealEntry(stmt.get()));
  }
  stmt.free();

  return meals;
}

/**
 * Updates a meal to synced status in-place and removes from sync queue
 */
export async function markMealAsSynced(
  mealId: string,
  updatedData?: Partial<MealEntry>
): Promise<void> {
  if (!dbInstance) return;

  if (updatedData) {
    const existing = getAllMealsFromSQLite().find((m) => m.id === mealId);
    if (existing) {
      const merged: MealEntry = {
        ...existing,
        ...updatedData,
        syncStatus: 'synced',
        isOfflineOptimistic: false,
      };
      await saveMealToSQLite(merged, 'synced', false);
    }
  } else {
    dbInstance.run(
      `UPDATE meals SET sync_status = 'synced', is_offline_optimistic = 0 WHERE id = ?`,
      [mealId]
    );
    await persistSQLite();
  }

  dbInstance.run(`DELETE FROM sync_queue WHERE meal_id = ?`, [mealId]);
  await persistSQLite();
}

export function isSQLiteInitialized(): boolean {
  return isReady && dbInstance !== null;
}
