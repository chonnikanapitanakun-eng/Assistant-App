import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TextInput, View } from 'react-native';

import { Mascot } from '@/components/brand/mascot';
import { Card, Chip, Icon, IconButton, Screen, Text } from '@/components/ui';
import { NoteEditor } from '@/features/notes/components/note-editor';
import { NoteRow } from '@/features/notes/components/note-row';
import { allTags, matchesQuery } from '@/features/notes/model';
import { createNote, useNotes } from '@/features/notes/queries';
import { background } from '@/lib/background';
import { useBreakpoint, useTheme } from '@/theme';

export default function NotesScreen() {
  const { t } = useTranslation();
  const { colors, spacing, radius, typography, fontFamily } = useTheme();
  const { isDesktop } = useBreakpoint();
  const notes = useNotes();
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ id: string; fresh: boolean } | null>(null);

  const tags = useMemo(() => allTags(notes), [notes]);
  const visible = notes.filter((n) => matchesQuery(n, query) && (!tag || (n.tags ?? []).includes(tag)));
  const pinned = visible.filter((n) => n.pinned);
  const others = visible.filter((n) => !n.pinned);
  // Desktop keeps a note open in the reading pane; default to the first one.
  const openId = selected?.id ?? (isDesktop ? visible[0]?.id : undefined);

  const open = (id: string, fresh = false) => {
    if (isDesktop) setSelected({ id, fresh });
    else router.push({ pathname: '/note/[id]', params: fresh ? { id, edit: '1' } : { id } });
  };
  const add = () => background(createNote(tag ? { tags: [tag] } : {}).then((id) => open(id, true)), 'Create note');

  const list = (
    <View style={{ gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text variant="title" accessibilityRole="header" style={{ flex: 1 }}>{t('nav.notes')}</Text>
        <IconButton icon="plus" label={t('notes.new')} color="primary" filled onPress={add} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.lg, minHeight: 48 }}>
        <Icon name="search" size={18} color="textSecondary" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('notes.search')}
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel={t('notes.search')}
          style={{ flex: 1, minWidth: 0, minHeight: 44, color: colors.text, fontSize: typography.body.fontSize, fontFamily: fontFamily.regular }}
        />
        {query ? <IconButton icon="x-circle" label={t('capture.clear')} onPress={() => setQuery('')} /> : null}
      </View>

      {tags.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          <Chip label={t('tasks.filter_all')} selected={!tag} onPress={() => setTag(null)} />
          {tags.map((x) => (
            <Chip key={x} label={`#${x}`} selected={tag === x} onPress={() => setTag(tag === x ? null : x)} />
          ))}
        </ScrollView>
      ) : null}

      {visible.length === 0 ? (
        <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxxl }}>
          <Mascot pose={query || tag ? 'search' : 'idea'} size={104} />
          <Text variant="heading" align="center">{query || tag ? t('notes.no_results') : t('notes.empty')}</Text>
          <Text variant="bodySm" color="textSecondary" align="center">{query || tag ? t('notes.no_results_body') : t('notes.empty_body')}</Text>
        </View>
      ) : (
        [
          { key: 'pinned', rows: pinned },
          { key: 'others', rows: others },
        ]
          .filter((g) => g.rows.length)
          .map((g) => (
            <View key={g.key} style={{ gap: spacing.xs }}>
              {pinned.length ? <Text variant="overline" color="textSecondary">{t(`notes.section_${g.key}`).toUpperCase()}</Text> : null}
              <Card padding="md" style={{ gap: 0, paddingVertical: spacing.xs }}>
                {g.rows.map((n, i) => (
                  <View key={n.id} style={i ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}>
                    <NoteRow note={n} selected={isDesktop && openId === n.id} onPress={() => open(n.id)} />
                  </View>
                ))}
              </Card>
            </View>
          ))
      )}
    </View>
  );

  if (!isDesktop) return <Screen maxWidth={720}>{list}</Screen>;

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }}>
      <View style={{ width: 400, borderRightWidth: 1, borderRightColor: colors.border }}>
        <Screen>{list}</Screen>
      </View>
      <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: spacing.xl }}>
        {openId ? (
          <NoteEditor key={openId} id={openId} startInEdit={selected?.fresh && selected.id === openId} onDeleted={() => setSelected(null)} />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
            <Mascot pose="idea" size={104} />
            <Text variant="bodySm" color="textSecondary">{t('notes.pick_one')}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
