import React, { useState, useEffect } from 'react';
import {
  subscribeToSyncState,
  triggerBackgroundSync,
  setSimulatedOffline,
  SyncState,
  getCurrentSyncState,
} from '../utils/syncManager';
import {
  Database,
  CloudOff,
  Cloud,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  ChevronDown,
  X,
} from 'lucide-react';

export const SyncStatusIndicator: React.FC = () => {
  const [syncState, setSyncState] = useState<SyncState>(getCurrentSyncState());
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToSyncState((state) => {
      setSyncState(state);
      if (state.pendingCount > 0) {
        setBannerDismissed(false);
      }
    });
    return unsubscribe;
  }, []);

  const handleManualSync = async () => {
    await triggerBackgroundSync();
  };

  const toggleSimulatedOffline = () => {
    setSimulatedOffline(!syncState.isSimulatedOffline);
  };

  const isOffline = !syncState.isOnline;

  return (
    <>
      {/* 1. Header Status Pill */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer shadow-2xs ${
            syncState.isSyncing
              ? 'bg-sky-50 text-sky-800 border-sky-300 animate-pulse'
              : isOffline
              ? 'bg-amber-50 text-amber-900 border-amber-300'
              : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
          }`}
          title="Click to view local SQLite storage & sync controls"
        >
          {syncState.isSyncing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
          ) : isOffline ? (
            <CloudOff className="w-3.5 h-3.5 text-amber-600" />
          ) : (
            <Database className="w-3.5 h-3.5 text-emerald-600" />
          )}

          <span className="hidden sm:inline">
            {syncState.isSyncing
              ? 'Syncing AI...'
              : isOffline
              ? `Offline${syncState.pendingCount > 0 ? ` (${syncState.pendingCount} queued)` : ''}`
              : 'SQLite Cached'}
          </span>

          <span className="sm:hidden font-mono-nums">
            {isOffline && syncState.pendingCount > 0 ? `${syncState.pendingCount}Q` : 'SQLite'}
          </span>

          <ChevronDown className="w-3 h-3 text-stone-400" />
        </button>

        {/* Dropdown Panel */}
        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white border border-stone-200 shadow-xl p-4 z-50 space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-xs text-stone-900">
                  SQLite Local Storage
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Connection status card */}
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-stone-500">Connection State:</span>
                <span
                  className={`font-semibold flex items-center gap-1 ${
                    isOffline ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                >
                  {isOffline ? (
                    <>
                      <CloudOff className="w-3.5 h-3.5" /> Offline Mode
                    </>
                  ) : (
                    <>
                      <Cloud className="w-3.5 h-3.5" /> Online
                    </>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-stone-500">Pending Sync Queue:</span>
                <span className="font-mono-nums font-semibold text-stone-900">
                  {syncState.pendingCount} meal{syncState.pendingCount !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-stone-500">Local Engine:</span>
                <span className="text-stone-800 font-medium font-mono text-[11px]">
                  WebAssembly SQLite (IndexedDB)
                </span>
              </div>
            </div>

            {/* Offline Simulation Switch */}
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-stone-200 hover:bg-stone-50/70 transition-colors">
              <div className="space-y-0.5">
                <span className="text-xs font-medium text-stone-800 block">
                  Offline Mode Simulator
                </span>
                <span className="text-[10px] text-stone-500 block">
                  Test offline logging & optimistic heuristic analysis
                </span>
              </div>
              <button
                type="button"
                onClick={toggleSimulatedOffline}
                className="text-stone-700 hover:text-stone-900 cursor-pointer"
              >
                {syncState.isSimulatedOffline ? (
                  <ToggleRight className="w-7 h-7 text-amber-600" />
                ) : (
                  <ToggleLeft className="w-7 h-7 text-stone-400" />
                )}
              </button>
            </div>

            {/* Manual Sync Trigger */}
            <button
              type="button"
              disabled={isOffline || syncState.isSyncing || syncState.pendingCount === 0}
              onClick={handleManualSync}
              className={`w-full py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                isOffline || syncState.pendingCount === 0
                  ? 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed'
                  : 'bg-emerald-800 hover:bg-emerald-900 text-white shadow-xs cursor-pointer'
              }`}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${syncState.isSyncing ? 'animate-spin' : ''}`}
              />
              {syncState.isSyncing
                ? 'Syncing with AI Vision...'
                : syncState.pendingCount > 0
                ? `Sync ${syncState.pendingCount} Queued Meal${syncState.pendingCount > 1 ? 's' : ''} Now`
                : 'All Meals Synced'}
            </button>

            {syncState.lastSyncMessage && (
              <p className="text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded-lg text-center font-medium">
                {syncState.lastSyncMessage}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 2. Top Banner when Offline or when Pending Items Exist */}
      {(isOffline || syncState.pendingCount > 0) && !bannerDismissed && (
        <aside
          aria-label="Offline meal synchronization banner"
          className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg px-4 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <div className="pointer-events-auto bg-stone-900/95 backdrop-blur-md text-stone-100 rounded-2xl p-3.5 sm:p-4 shadow-xl border border-amber-500/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                {isOffline ? (
                  <CloudOff className="w-4 h-4" />
                ) : (
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-semibold text-white">
                  {isOffline
                    ? syncState.isSimulatedOffline
                      ? 'Offline Mode Active (Simulator)'
                      : 'No Internet Connection'
                    : 'Unsynced Meals Ready'}
                </h4>
                <p className="text-[11px] text-stone-300 leading-tight">
                  {isOffline
                    ? `Meals save locally to SQLite with instant estimates. ${
                        syncState.pendingCount > 0
                          ? `(${syncState.pendingCount} queued for AI sync)`
                          : ''
                      }`
                    : `${syncState.pendingCount} meal${
                        syncState.pendingCount > 1 ? 's' : ''
                      } saved in SQLite awaiting AI enhancement.`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {!isOffline && syncState.pendingCount > 0 && (
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={syncState.isSyncing}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${syncState.isSyncing ? 'animate-spin' : ''}`}
                  />
                  <span>Sync</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setBannerDismissed(true)}
                className="text-stone-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                aria-label="Dismiss banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      )}
    </>
  );
};
