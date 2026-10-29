import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, Share, PlusSquare, X, Check } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  // If already installed in standalone mode, hide button
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else if (isIOS) {
      setShowIOSModal(true);
    } else {
      setShowIOSModal(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 border border-emerald-200/80 transition-all cursor-pointer shadow-2xs active:scale-95"
        title="Install Journal as an app on your device"
      >
        <Download className="w-3.5 h-3.5 text-emerald-700" />
        <span className="hidden sm:inline">Install App</span>
        <span className="sm:hidden">Install</span>
      </button>

      {/* Guide Modal for iOS / Browser Install */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl w-full max-w-sm p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center">
                <Smartphone className="w-6 h-6" />
              </div>
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                Progressive Web App
              </span>
              <h3 className="font-editorial text-xl font-bold text-stone-900">
                Install Journal on Device
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Enjoy full-screen standalone experience, instant offline SQLite logging, and smart hydration alerts directly on your home screen.
              </p>
            </div>

            {/* Step-by-step instructions */}
            <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  1
                </div>
                <div className="text-stone-700">
                  <span className="font-semibold block text-stone-900">Tap the Share Icon</span>
                  In Safari or your mobile browser toolbar, tap the <Share className="w-3.5 h-3.5 inline text-emerald-700 mx-0.5" /> <strong>Share</strong> button.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  2
                </div>
                <div className="text-stone-700">
                  <span className="font-semibold block text-stone-900">Add to Home Screen</span>
                  Scroll down the menu and select <PlusSquare className="w-3.5 h-3.5 inline text-emerald-700 mx-0.5" /> <strong>Add to Home Screen</strong>.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  3
                </div>
                <div className="text-stone-700">
                  <span className="font-semibold block text-stone-900">Launch from Home Screen</span>
                  Journal will open as a full standalone application without browser address bars!
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 rounded-xl bg-stone-900 text-white font-medium text-xs hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
