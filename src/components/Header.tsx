import React from 'react';
import { Leaf, Calendar, ChevronLeft, ChevronRight, Plus, Sparkles, BarChart3, Settings, Shield, FolderDown } from 'lucide-react';
import { getTodayDateString, getYesterdayDateString } from '../data/seedMeals';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  currentDate: string;
  onSelectDate: (date: string) => void;
  onOpenCapture: () => void;
  activeTab: 'log' | 'analytics' | 'settings';
  onChangeTab: (tab: 'log' | 'analytics' | 'settings') => void;
  onLockApp?: () => void;
  onOpenDownload?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentDate,
  onSelectDate,
  onOpenCapture,
  activeTab,
  onChangeTab,
  onLockApp,
  onOpenDownload,
}) => {
  const todayStr = getTodayDateString();
  const yesterdayStr = getYesterdayDateString();

  const handlePrevDay = () => {
    const d = new Date(currentDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    onSelectDate(`${yr}-${mo}-${da}`);
  };

  const handleNextDay = () => {
    const d = new Date(currentDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    onSelectDate(`${yr}-${mo}-${da}`);
  };

  const formatDisplayDate = (dateStr: string) => {
    if (dateStr === todayStr) return 'Today';
    if (dateStr === yesterdayStr) return 'Yesterday';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <header className="sticky top-0 z-30 bg-[#FBFBFA]/95 backdrop-blur-md border-b border-stone-200/80 transition-all">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Brand & Tagline */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onChangeTab('log')}>
            <div className="w-9 h-9 rounded-xl bg-emerald-800 text-emerald-50 flex items-center justify-center shadow-xs">
              <Leaf className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-editorial text-2xl font-semibold tracking-tight text-stone-900">
                  Journal
                </span>
                <span className="text-[11px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-emerald-100/70 text-emerald-800 border border-emerald-200/60">
                  Mindful AI
                </span>
              </div>
              <p className="text-xs text-stone-500">Holistic calorie & nutrition intelligence</p>
            </div>
          </div>

          {/* Mobile Log button */}
          <button
            type="button"
            onClick={onOpenCapture}
            className="sm:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-800 text-white font-medium text-xs shadow-xs hover:bg-emerald-900 active:scale-95 transition-transform"
          >
            <Plus className="w-4 h-4" />
            <span>Log</span>
          </button>
        </div>

        {/* Date Navigator */}
        <div className="flex items-center justify-between sm:justify-center gap-1.5 bg-stone-100/90 p-1 rounded-xl border border-stone-200/60">
          <button
            type="button"
            onClick={handlePrevDay}
            className="p-1.5 rounded-lg hover:bg-white text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
            title="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 px-2">
            <Calendar className="w-3.5 h-3.5 text-stone-500" />
            <span className="text-xs font-semibold text-stone-800 min-w-20 text-center">
              {formatDisplayDate(currentDate)}
            </span>
            {currentDate !== todayStr && (
              <button
                type="button"
                onClick={() => onSelectDate(todayStr)}
                className="text-[11px] font-medium text-emerald-700 hover:text-emerald-900 underline ml-1 cursor-pointer"
              >
                Go to today
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleNextDay}
            className="p-1.5 rounded-lg hover:bg-white text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
            title="Next Day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs, Sync Status, PWA Install & Desktop Action */}
        <div className="flex items-center gap-2">
          {/* Export & Download Codebase Button */}
          {onOpenDownload && (
            <button
              type="button"
              onClick={onOpenDownload}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 hover:bg-stone-200/80 text-stone-800 border border-stone-200/80 transition-all cursor-pointer shadow-2xs active:scale-95"
              title="Download full project code & push to GitHub"
            >
              <FolderDown className="w-3.5 h-3.5 text-stone-700" />
              <span className="hidden sm:inline">Export Code</span>
              <span className="sm:hidden">Code</span>
            </button>
          )}

          {/* PWA Install Button */}
          <PWAInstallButton />

          {/* SQLite Sync Status Indicator */}
          <SyncStatusIndicator />

          <nav className="flex items-center bg-stone-100/80 p-1 rounded-xl border border-stone-200/60 text-xs font-medium">
            <button
              type="button"
              onClick={() => onChangeTab('log')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'log'
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Daily Log
            </button>
            <button
              type="button"
              onClick={() => onChangeTab('analytics')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Trends</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeTab('settings')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Nutrition Goals & Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            {onLockApp && (
              <button
                type="button"
                onClick={onLockApp}
                className="p-1.5 rounded-lg text-emerald-800 hover:text-emerald-950 hover:bg-white transition-all cursor-pointer"
                title="Lock Journal with Biometrics"
              >
                <Shield className="w-4 h-4" />
              </button>
            )}
          </nav>

          {/* Desktop primary Log button */}
          <button
            type="button"
            onClick={onOpenCapture}
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-800 text-emerald-50 text-xs font-semibold hover:bg-emerald-900 shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Log Meal</span>
          </button>
        </div>
      </div>
    </header>
  );
};
