# Local SQLite Meal Storage & Offline Background Sync

A robust, offline-first client architecture using a **WebAssembly SQLite engine backed by persistent IndexedDB storage**. Users can seamlessly log meals, view 90-day analytics, and track nutrition without an active internet connection, with automatic background synchronization and AI enhancement once connectivity is restored.

### User Review & Critical Decisions

> [!IMPORTANT]
> The design choices confirmed through your answers:
> - **Local Database Engine**: **WebAssembly SQLite engine backed by persistent storage** (`sql.js` / WASM SQLite saving binary snapshots to IndexedDB), executing real SQL tables, indices, and transactions.
> - **Offline Meal Logging**: **Save with optimistic estimates and enhance with AI upon reconnect**, ensuring instant response times even in airplane mode with full macro and micronutrient placeholders.
> - **Offline UI & Sync Display**: **Status indicator with pending count and auto-sync banner**, providing clear visual cues for connection status, pending sync queue length, and a "Sync Now" action.

- **Confirmed Decision 1 (Real Relational SQLite Tables)**:
  - `meals`: Structured table storing `id`, `date`, `time`, `name`, `meal_type`, `calories`, `macros_json`, `micronutrients_json`, `sync_status`, `confidence_score`.
  - `sync_queue`: Queue storing offline logged entries, base64 photo buffers, and retry counts for automatic server synchronization.
- **Confirmed Decision 2 (Optimistic Offline Heuristic Engine)**:
  - If offline, an on-device heuristic parser parses the meal description (e.g. "Grilled chicken salad with avocado and olive oil") and estimates baseline calories, macros, and vitality micronutrients so the UI, graphs, and daily targets update immediately.
- **Confirmed Decision 3 (Zero Data Loss Sync Protocol)**:
  - On `online` window events or manual sync trigger, background workers batch-process pending queue items with the server's Gemini 3.8 Flash multimodal API, updating local SQLite rows in-place and triggering a smooth UI update.

---

### 1. Architecture & Data Flow

```
┌────────────────────────────────────────────────────────┐
│                        User UI                         │
│  - MealLogger / Camera / Voice / AnalyticsView        │
└───────────────────────────┬────────────────────────────┘
                            │
               Read / Write │ (Transactions)
                            ▼
┌────────────────────────────────────────────────────────┐
│            SQLite WebAssembly Engine (WASM)            │
│  - Table: `meals` (full relational schema)             │
│  - Table: `sync_queue` (pending mutations)             │
│  - Real SQL: SELECT, INSERT OR REPLACE, UPDATE, DELETE │
└───────────────────────────┬────────────────────────────┘
                            │
               Periodic     │ Binary Export / Import
               Persistence  ▼
┌────────────────────────────────────────────────────────┐
│           Persistent Storage (IndexedDB Blob)          │
│  - Database: `journal_sqlite_db`                       │
│  - Survives browser restarts, refreshes & iOS PWA tabs │
└────────────────────────────────────────────────────────┘
                            ▲
                            │ Background Sync on 'online'
┌───────────────────────────┴────────────────────────────┐
│                  Sync Manager Worker                   │
│  - Detects network reconnection                        │
│  - Flushes `sync_queue` to `/api/analyze-meal`         │
│  - Upgrades optimistic meals to AI-verified meals      │
└────────────────────────────────────────────────────────┘
```

---

### 2. Component & Implementation Breakdown

1. **`src/db/sqliteManager.ts`**:
   - Manages SQLite WebAssembly initialization (`sql.js`).
   - Handles schema creation (`CREATE TABLE IF NOT EXISTS meals ...`, `CREATE TABLE IF NOT EXISTS sync_queue ...`).
   - Automatically synchronizes SQLite binary state to IndexedDB (`idb-keyval` / standard IndexedDB) on write operations.
   - Initial hydration from pre-existing seed data or restored SQLite snapshot.

2. **`src/utils/offlineEstimator.ts`**:
   - On-device lightweight nutrition estimator for offline logging.
   - Extracts food entities from input text (e.g. eggs, oatmeal, salmon, steak, rice, greens, protein shake) to provide reasonable calorie, macro, and micronutrient estimates immediately.

3. **`src/utils/syncManager.ts`**:
   - Network status listener (`navigator.onLine`, `online` / `offline` window events).
   - Sync runner: iterates over pending meals, calls `/api/analyze-meal`, updates SQLite records with high-precision AI vision results, and notifies the React state.

4. **`src/components/SyncStatusIndicator.tsx` & Banner**:
   - Displays real-time database and sync state:
     - 🟢 *Online • All meals synced to SQLite*
     - 🟠 *Offline Mode • 2 meals pending AI sync*
     - 🔵 *Syncing 2 meals...*
   - Includes manual "Sync Now" button and an "Offline Simulator" toggle so you can test offline behavior directly in the browser without turning off your Wi-Fi!

5. **`src/App.tsx` Integration**:
   - Initialize SQLite manager on app mount.
   - Route meal creation, editing, and deletion through SQLite instead of plain in-memory state.
   - Seamlessly propagate updates to Daily Tracker, Analytics, and Micronutrient views.

---

### 3. Verification Plan

1. **SQLite Storage Verification**: Verify SQLite initializes, creates tables, executes SQL queries, and restores from IndexedDB after page refresh.
2. **Offline Mode Test**: Toggle offline mode simulator or disconnect; log a new meal with photo and description; verify it saves to SQLite with optimistic estimates and displays the `pending_sync` badge.
3. **Reconnection & AI Enhancement**: Reconnect; verify the background sync manager detects connection, submits the queued meal to Gemini 3.8 Flash, updates the SQLite record with precise macros and micronutrients, and marks it as `synced`.
4. **App Build & Lint Check**: Run `lint_applet` and `compile_applet` to confirm clean TypeScript and zero build errors.
