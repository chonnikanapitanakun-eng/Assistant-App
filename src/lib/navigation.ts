import { router } from 'expo-router';

/** ปิดหน้าปัจจุบัน — ถ้าไม่มีประวัติให้ย้อน (เช่น reload หน้า /task/[id] บน web) กลับไปหน้าแรก */
export function closeScreen() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
