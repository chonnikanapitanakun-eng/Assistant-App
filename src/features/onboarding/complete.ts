import { db, seedSampleData } from '@/db';
import { useProfile } from '@/features/profile/store';

/** Finish onboarding: optionally add sample content, then mark the profile as onboarded. */
export async function completeOnboarding({ sample }: { sample: boolean }) {
  if (sample) {
    try {
      await seedSampleData(db);
    } catch (e) {
      // Sample data is a nicety; never block entering the app over it.
      console.warn('Could not add sample data:', e);
    }
  }
  useProfile.getState().update({ onboarded: true });
}
