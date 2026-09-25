import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export { transactionsToCsv, type CsvLabels } from './csv';

/** Saves the CSV to a temp file and opens the share sheet (native) or triggers a browser download (web). */
export async function exportCsv(csv: string, filename: string): Promise<void> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    // Revoking right away can cancel the download in some browsers (same as privacy/export.ts).
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return;
  }

  const dir = new Directory(Paths.cache, 'exports');
  if (!dir.exists) dir.create({ intermediates: true });
  const file = new File(dir, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(csv);

  try {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: filename, UTI: 'public.comma-separated-values-text' });
    }
  } finally {
    // The share target has its own copy by now; don't leave financial data in the cache.
    if (file.exists) file.delete();
  }
}
