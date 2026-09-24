import { useTranslation } from 'react-i18next';

import { Card, Screen, Text } from '@/components/ui';
import { useNotes } from '@/features/notes/queries';

export default function NotesScreen() {
  const { t } = useTranslation();
  const notes = useNotes();
  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">{t('nav.notes')}</Text>
      {notes.length === 0 ? (
        <Text color="textSecondary" style={{ textAlign: 'center', marginTop: 24 }}>{t('notes.empty')}</Text>
      ) : (
        notes.map((n) => (
          <Card key={n.id}>
            <Text variant="heading">{n.title || '(untitled)'}</Text>
            <Text color="textSecondary" numberOfLines={2}>{n.body}</Text>
          </Card>
        ))
      )}
    </Screen>
  );
}
