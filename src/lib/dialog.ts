import { Alert, Platform } from 'react-native';

/**
 * Alert.alert ของ react-native-web เป็น no-op (ไม่แสดงอะไรเลย) → บน web ใช้ dialog ของ browser แทน
 */
export function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

/** ถามยืนยันการกระทำที่ย้อนไม่ได้ — resolve true เมื่อผู้ใช้กดยืนยัน */
export function confirmDestructive(opts: { title: string; message: string; confirmText: string; cancelText: string }): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${opts.title}\n\n${opts.message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(opts.title, opts.message, [
      { text: opts.cancelText, style: 'cancel', onPress: () => resolve(false) },
      { text: opts.confirmText, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
