/** Wire types of the `gcal` Edge Function (supabase/functions/gcal/index.ts). Change both together. */

/** Google's start/end: `date` (YYYY-MM-DD, all-day; end is exclusive) or `dateTime` (RFC 3339 with offset). */
export type GoogleDate = { date?: string; dateTime?: string };

export type RemoteEvent = {
  /** `<calendarId>/<eventId>` — unique within one Google account. */
  id: string;
  iCalUID: string | null;
  calendarName: string | null;
  title: string;
  location: string | null;
  start: GoogleDate;
  end: GoogleDate;
};

export type AccountStatus = 'ok' | 'reauth' | 'error';

export type SyncAccount = { id: string; email: string; status: AccountStatus; events?: RemoteEvent[] };
