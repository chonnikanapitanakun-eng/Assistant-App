import { beforeEach, describe, expect, it, vi } from 'vitest';

// The keychain (expo-secure-store) and the real erase (SQLite, Supabase, notifications) are native;
// the test only checks the order of operations around them.
const removeSecureKey = vi.fn();
vi.mock('../storage', () => ({ readSecureJSON: () => null, writeSecureJSON: vi.fn(), removeSecureKey: (key: string) => removeSecureKey(key) }));
vi.mock('@/features/privacy/erase', () => ({ eraseLocalData: vi.fn() }));

const { eraseForForgottenPin } = await import('../forgot-pin');
const { useSecurity } = await import('../store');

describe('eraseForForgottenPin', () => {
  beforeEach(() => {
    removeSecureKey.mockReset();
    useSecurity.setState({ pinHash: 'hash', salt: 'salt', biometricEnabled: true, locked: true });
  });

  it('erases the device, then clears the stored PIN and unlocks', async () => {
    const calls: string[] = [];
    removeSecureKey.mockImplementation(() => calls.push('clear-pin'));
    const erase = vi.fn(async () => {
      calls.push('erase');
    });

    await eraseForForgottenPin(erase);

    expect(erase).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['erase', 'clear-pin']);
    expect(removeSecureKey).toHaveBeenCalledWith('veyra.security');
    expect(useSecurity.getState()).toMatchObject({ pinHash: null, salt: null, biometricEnabled: false, locked: false });
  });

  it('keeps the lock on when the erase fails, so data left on the device stays locked', async () => {
    const erase = vi.fn(async () => {
      throw new Error('db busy');
    });

    await expect(eraseForForgottenPin(erase)).rejects.toThrow('db busy');

    expect(removeSecureKey).not.toHaveBeenCalled();
    expect(useSecurity.getState()).toMatchObject({ pinHash: 'hash', salt: 'salt', locked: true });
  });

  it('uses the PDPA erase by default', async () => {
    const { eraseLocalData } = await import('@/features/privacy/erase');
    await eraseForForgottenPin();
    expect(eraseLocalData).toHaveBeenCalledTimes(1);
    expect(useSecurity.getState().locked).toBe(false);
  });
});
