import { NativeBiometric, BiometryType } from '@capgo/capacitor-native-biometric';
import { Capacitor } from '@capacitor/core';

export interface BiometricStatus {
  isAvailable: boolean;
  biometryType: 'face_id' | 'touch_id' | 'fingerprint' | 'biometric' | 'none';
  biometryName: string;
  isNative: boolean;
}

const STORAGE_KEY_BIOMETRICS_ENABLED = 'journal_biometric_lock_enabled';
const STORAGE_KEY_PASSCODE = 'journal_security_passcode';

export async function checkBiometricStatus(): Promise<BiometricStatus> {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    try {
      const result = await NativeBiometric.isAvailable();
      if (result.isAvailable) {
        let biometryType: BiometricStatus['biometryType'] = 'biometric';
        let biometryName = 'Biometric Security';

        if (result.biometryType === BiometryType.FACE_ID || result.biometryType === BiometryType.FACE_AUTHENTICATION) {
          biometryType = 'face_id';
          biometryName = 'Face ID';
        } else if (result.biometryType === BiometryType.TOUCH_ID || result.biometryType === BiometryType.FINGERPRINT) {
          biometryType = 'touch_id';
          biometryName = 'Touch ID / Fingerprint';
        }

        return {
          isAvailable: true,
          biometryType,
          biometryName,
          isNative: true,
        };
      }
    } catch (e) {
      console.warn('[BiometricAuth] Native availability check note:', e);
    }
  }

  const hasWebAuthn = typeof window !== 'undefined' && !!window.PublicKeyCredential;
  return {
    isAvailable: true,
    biometryType: hasWebAuthn ? 'biometric' : 'none',
    biometryName: hasWebAuthn ? 'Device Biometrics / Passkey' : 'PIN Lock',
    isNative: false,
  };
}

export async function performBiometricAuth(reason = 'Authenticate to access private health records'): Promise<boolean> {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    try {
      await NativeBiometric.verifyIdentity({
        reason,
        title: 'Journal Security',
        subtitle: 'Protected Nutrition Data',
        description: 'Verify your face or fingerprint to continue.',
        negativeButtonText: 'Use PIN',
      });
      return true;
    } catch (error: any) {
      console.warn('[BiometricAuth] Verification error:', error);
      return false;
    }
  }

  return true;
}

export function isBiometricLockEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY_BIOMETRICS_ENABLED) === 'true';
}

export function setBiometricLockEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_BIOMETRICS_ENABLED, enabled ? 'true' : 'false');
}

export function getSecurityPasscode(): string {
  if (typeof window === 'undefined') return '1234';
  return localStorage.getItem(STORAGE_KEY_PASSCODE) || '1234';
}

export function setSecurityPasscode(code: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_PASSCODE, code);
}
