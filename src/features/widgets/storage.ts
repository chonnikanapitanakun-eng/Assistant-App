import { readJSON } from '@/features/profile/storage';

import type { WidgetData } from './model';

/** Where the app leaves the Android widget timeline for the headless task handler. */
export const TIMELINE_KEY = 'veyra.widget.timeline';

export const readTimeline = (): { at: number; data: WidgetData }[] => readJSON<{ at: number; data: WidgetData }[]>(TIMELINE_KEY) ?? [];
