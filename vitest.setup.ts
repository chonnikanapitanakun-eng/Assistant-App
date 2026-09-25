import { vi } from 'vitest';

// expo-crypto (used by src/lib/ids.ts) pulls in expo-modules-core → react-native, whose Flow
// syntax Vite/Rollup can't parse outside of Metro. Node has the same primitive built in.
vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));
