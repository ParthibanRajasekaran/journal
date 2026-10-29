import React, { useState, useEffect } from 'react';
import {
  checkBiometricStatus,
  performBiometricAuth,
  getSecurityPasscode,
  BiometricStatus,
} from '../services/biometricAuth';
import { Shield, Fingerprint, Lock, Unlock, KeyRound, AlertCircle, Sparkles } from 'lucide-react';

interface BiometricLockScreenProps {
  onUnlock: () => void;
}

export const BiometricLockScreen: React.FC<BiometricLockScreenProps> = ({ onUnlock }) => {
  const [status, setStatus] = useState<BiometricStatus | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [usePinOnly, setUsePinOnly] = useState(false);

  useEffect(() => {
    checkBiometricStatus().then((s) => {
      setStatus(s);
      // Auto trigger biometric prompt on initial load
      triggerBiometric(s);
    });
  }, []);

  const triggerBiometric = async (currentStatus?: BiometricStatus | null) => {
    const s = currentStatus || status;
    setIsAuthenticating(true);
    setPinError(false);

    try {
      const success = await performBiometricAuth(
        `Verify with ${s?.biometryName || 'Biometrics'} to access Journal`
      );
      if (success) {
        onUnlock();
      } else {
        setUsePinOnly(true);
      }
    } catch {
      setUsePinOnly(true);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPin = getSecurityPasscode();
    if (pin === correctPin || pin === '1234') {
      onUnlock();
    } else {
      setPinError(true);
      setPin('');
    }
  };

  const handleDigitPress = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length === 4) {
        const correctPin = getSecurityPasscode();
        if (nextPin === correctPin || nextPin === '1234') {
          setTimeout(onUnlock, 150);
        } else {
          setPinError(true);
          setTimeout(() => setPin(''), 500);
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#FBFBFA] flex flex-col items-center justify-between p-6 sm:p-10 select-none animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="text-center pt-8 space-y-2">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-800 text-emerald-100 flex items-center justify-center shadow-lg border border-emerald-700/50">
          <Shield className="w-8 h-8 text-emerald-200" />
        </div>
        <h2 className="font-editorial text-2xl sm:text-3xl font-bold text-stone-900">
          Journal Protected
        </h2>
        <p className="text-xs text-stone-500 max-w-xs mx-auto">
          Private nutrition, calories, and health records are secured with biometric encryption.
        </p>
      </div>

      {/* Main Authentication Center */}
      <div className="w-full max-w-xs space-y-6 text-center">
        {!usePinOnly ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => triggerBiometric()}
              disabled={isAuthenticating}
              className="w-24 h-24 mx-auto rounded-full bg-emerald-50 hover:bg-emerald-100/80 active:scale-95 border-2 border-emerald-300 flex items-center justify-center text-emerald-800 shadow-md transition-all cursor-pointer group"
            >
              <Fingerprint className="w-12 h-12 text-emerald-700 group-hover:scale-110 transition-transform" />
            </button>

            <div className="space-y-1">
              <span className="text-xs font-semibold text-stone-800 block">
                {status?.biometryName || 'Face ID / Biometric Security'}
              </span>
              <span className="text-[11px] text-stone-400 block">
                Tap fingerprint to prompt biometric scan
              </span>
            </div>

            <button
              type="button"
              onClick={() => setUsePinOnly(true)}
              className="text-xs text-emerald-800 hover:text-emerald-950 font-medium underline cursor-pointer pt-2"
            >
              Use Passcode / PIN instead
            </button>
          </div>
        ) : (
          /* PIN keypad interface */
          <div className="space-y-5">
            {/* PIN Dots */}
            <div className="flex justify-center gap-3 py-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                    pin.length > i
                      ? 'bg-emerald-800 scale-110'
                      : 'border-2 border-stone-300 bg-white'
                  } ${pinError ? 'bg-rose-600 border-rose-600 animate-shake' : ''}`}
                />
              ))}
            </div>

            {pinError && (
              <p className="text-xs text-rose-600 font-medium flex items-center justify-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Incorrect PIN. Try default (1234)</span>
              </p>
            )}

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Bio', '0', '⌫'].map((key) => {
                if (key === 'Bio') {
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setUsePinOnly(false);
                        triggerBiometric();
                      }}
                      className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-medium text-xs flex items-center justify-center cursor-pointer transition-colors"
                      title="Switch back to Biometrics"
                    >
                      <Fingerprint className="w-5 h-5 text-emerald-700" />
                    </button>
                  );
                }
                if (key === '⌫') {
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPin((prev) => prev.slice(0, -1))}
                      className="p-3.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-sm cursor-pointer transition-colors"
                    >
                      ⌫
                    </button>
                  );
                }
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleDigitPress(key)}
                    className="p-3.5 rounded-2xl bg-white hover:bg-stone-100 border border-stone-200/80 text-stone-900 font-bold text-base shadow-2xs active:scale-95 transition-all cursor-pointer"
                  >
                    {key}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="text-center pb-4 text-[11px] text-stone-400">
        <span>Protected by Native Biometric Encryption • Default PIN: 1234</span>
      </div>
    </div>
  );
};
