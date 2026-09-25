import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NoteEditor } from '@/features/notes/components/note-editor';
import { createNote } from '@/features/notes/queries';
import { background } from '@/lib/background';
import { useTheme } from '@/theme';

/** Full-screen note (phones). Desktop opens notes in the Notes split view instead. `/note/new` starts a blank note. */
export default function NoteScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/notes'));
  const isNew = id === 'new';

  // Like task/event/tx `new`: create the row once, then swap the URL to its real id.
  const creating = useRef(false);
  useEffect(() => {
    if (!isNew || creating.current) return;
    creating.current = true;
    background(createNote().then((noteId) => router.replace({ pathname: '/note/[id]', params: { id: noteId, edit: '1' } })), 'Create note');
  }, [isNew]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
      {isNew ? null : <NoteEditor id={id} startInEdit={edit === '1'} onBack={back} onDeleted={back} />}
    </View>
  );
}
