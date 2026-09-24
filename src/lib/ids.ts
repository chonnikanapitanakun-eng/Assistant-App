import { randomUUID } from 'expo-crypto';

export const newId = (): string => randomUUID();
export const now = (): number => Date.now();
