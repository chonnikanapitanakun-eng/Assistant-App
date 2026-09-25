import { CryptoDigestAlgorithm, digestStringAsync, getRandomBytes } from 'expo-crypto';

export const PIN_LENGTH = 4;

export function randomSalt(): string {
  return Array.from(getRandomBytes(16), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function hashPin(pin: string, salt: string): Promise<string> {
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}
