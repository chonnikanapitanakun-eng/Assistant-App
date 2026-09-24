import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NoteEditor } from '@/features/notes/components/note-editor';
import { useTheme } from '@/theme';

/** Full-screen note (phones). Desktop opens notes in the Notes split view instead. */
export default function NoteScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/notes'));
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
      <NoteEditor id={id} startInEdit={edit === '1'} onBack={back} onDeleted={back} />
    </View>
  );
}
