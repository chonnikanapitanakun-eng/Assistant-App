import { QueryClient, useQuery } from '@tanstack/react-query';

import { onDatabaseWrite } from './client';

/**
 * แทน useLiveQuery ของ drizzle-orm/expo-sqlite (ซึ่งเป็น sync-only):
 * อ่านผ่าน react-query แล้ว invalidate ทุก query ของ DB เมื่อมีการเขียนใดๆ (onDatabaseWrite)
 * — ข้อมูลส่วนตัวขนาดเล็ก refetch ทั้งหมดถูกและง่ายกว่าไล่ key ทีละตาราง
 */
export const queryClient = new QueryClient();

const DB_KEY = 'db';

onDatabaseWrite(() => {
  void queryClient.invalidateQueries({ queryKey: [DB_KEY] });
});

/** อ่านข้อมูลจาก DB แบบ reactive — `undefined` ระหว่างโหลดครั้งแรก */
export function useDbQuery<T>(key: readonly unknown[], query: () => Promise<T>): T | undefined {
  const { data, error } = useQuery({ queryKey: [DB_KEY, ...key], queryFn: query, staleTime: Infinity });
  if (error) throw error;
  return data;
}
