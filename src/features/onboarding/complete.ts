import { db, seedSampleData } from '@/db';
import { useProfile } from '@/features/profile/store';

/** Finish onboarding: optionally add sample content, then mark the profile as onboarded. */
export function completeOnboarding({ sample }: { sample: boolean }) {
  if (sample) {
    try {
      seedSampleData(db);
    } catch {
      // Sample data is a nicety; never block entering the app over it.
    }
  }
  useProfile.getState().update({ onboarded: true });
}
