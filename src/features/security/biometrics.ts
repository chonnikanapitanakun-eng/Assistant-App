import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

export type BiometricKind = 'face' | 'fingerprint' | null;

async function detect(): Promise<{ available: boolean; kind: BiometricKind }> {
  const [hardware, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  const kind: BiometricKind = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
    ? 'face'
    : types.some((t) => t === LocalAuthentication.AuthenticationType.FINGERPRINT || t === LocalAuthentication.AuthenticationType.IRIS)
      ? 'fingerprint'
      : null;
  return { available: hardware && enrolled, kind };
}

/** Whether Face ID / fingerprint is set up on this device, and which kind to show in copy. */
export function useBiometricSupport() {
  const [state, setState] = useState<{ available: boolean; kind: BiometricKind }>({ available: false, kind: null });
  useEffect(() => {
    let live = true;
    void detect().then((r) => {
      if (live) setState(r);
    });
    return () => {
      live = false;
    };
  }, []);
  return state;
}

/** i18n key for the biometric kind's display name, e.g. "Face ID" / "Touch ID" / "Fingerprint". */
export function biometricLabelKey(kind: BiometricKind): string {
  if (kind === 'face') return 'security.face_id';
  if (kind === 'fingerprint') return Platform.OS === 'ios' ? 'security.touch_id' : 'security.fingerprint';
  return 'security.biometric';
}

export async function authenticateWithBiometrics(promptMessage: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage });
    return result.success;
  } catch {
    return false;
  }
}
