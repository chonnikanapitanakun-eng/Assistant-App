import { supabase } from '@/features/auth/client';

import type { RemoteRow } from './engine';

export class SyncError extends Error {}

export type PulledRow = RemoteRow & { server_seq: number };

/** Upsert rows on the server (last-write-wins there too). Returns how many the server took. */
export async function pushRows(rows: RemoteRow[]): Promise<number> {
  const client = supabase();
  if (!client) throw new SyncError('not_configured');
  const { data, error } = await client.rpc('sync_push', { rows });
  if (error) throw new SyncError(error.message);
  return typeof data === 'number' ? data : 0;
}

/** Rows changed on the server after `since` (a server_seq), oldest first. */
export async function pullRows(since: number, limit: number): Promise<PulledRow[]> {
  const client = supabase();
  if (!client) throw new SyncError('not_configured');
  const { data, error } = await client.from('sync_rows').select('table_name,id,data,updated_at,deleted_at,server_seq').gt('server_seq', since).order('server_seq', { ascending: true }).limit(limit);
  if (error) throw new SyncError(error.message);
  return (data ?? []).map((r) => ({
    table: String(r.table_name),
    id: String(r.id),
    data: r.data && typeof r.data === 'object' ? (r.data as Record<string, unknown>) : {},
    updated_at: Number(r.updated_at),
    deleted_at: r.deleted_at == null ? null : Number(r.deleted_at),
    server_seq: Number(r.server_seq),
  }));
}
