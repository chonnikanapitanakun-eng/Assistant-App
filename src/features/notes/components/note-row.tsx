import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon, PressableScale, Text } from '@/components/ui';
import type { Note } from '@/db';
import { daysFromToday, toDateKey } from '@/lib/date';
import { useTheme } from '@/theme';

import { plainText } from '../markdown';

export function NoteRow({ note, onPress, selected }: { note: Note; onPress: () => void; selected?: boolean }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const snippet = plainText(note.body);
  const edited = new Date(note.updatedAt);
  const diff = daysFromToday(toDateKey(edited));
  const when =
    diff === 0
      ? edited.toLocaleTimeString(i18n.language === 'th' ? 'th-TH' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
      : diff === -1
        ? t('tasks.yesterday')
        : edited.toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short' });

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${note.title || t('notes.untitled')}${note.pinned ? `, ${t('notes.pinned')}` : ''}`}
      onPress={onPress}
      style={{ gap: 4, paddingVertical: spacing.md, paddingHorizontal: spacing.md, marginHorizontal: -spacing.md + 4, borderRadius: radius.md, backgroundColor: selected ? colors.primarySoft : 'transparent' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {note.pinned ? <Icon name="bookmark" size={14} /> : null}
        <Text variant="subheading" numberOfLines={1} style={{ flex: 1 }}>{note.title || t('notes.untitled')}</Text>
        <Text variant="caption" color="textTertiary">{when}</Text>
      </View>
      {snippet ? <Text variant="bodySm" color="textSecondary" numberOfLines={2}>{snippet}</Text> : null}
      {note.tags?.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {note.tags.map((tag) => (
            <Text key={tag} variant="caption" color="primary">#{tag}</Text>
          ))}
        </View>
      ) : null}
    </PressableScale>
  );
}
