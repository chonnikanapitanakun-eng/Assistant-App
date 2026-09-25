import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TextInput, View } from 'react-native';

import { Mascot } from '@/components/brand/mascot';
import { allDayKey, fromDateKey } from '@/features/calendar/model';
import { Card, Chip, Icon, IconButton, PressableScale, Screen, Text } from '@/components/ui';
import { categoryIcon } from '@/features/money/category-icon';
import { plainText } from '@/features/notes/markdown';
import { ResultRow } from '@/features/search/components/result-row';
import { searchTypes, snippet, type SearchType } from '@/features/search/model';
import { useSearch, type SearchGroups } from '@/features/search/queries';
import { formatMoney } from '@/lib/currency';
import { toDateKey } from '@/lib/date';
import { useTheme } from '@/theme';

/** Rows shown per group in the "All" view before "See all". */
const PREVIEW = 5;

export default function SearchScreen() {
  const { t } = useTranslation();
  const { colors, spacing, radius, typography, fontFamily } = useTheme();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchType | null>(null);
  const results = useSearch(query);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const groups = results ? searchTypes.filter((type) => results.groups[type].length && (!filter || filter === type)) : [];

  return (
    <Screen maxWidth={720}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: -spacing.sm }}>
        <IconButton icon="chevron-left" label={t('common.back')} onPress={back} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.lg, minHeight: 48 }}>
          <Icon name="search" size={18} color="textSecondary" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            placeholder={t('search.placeholder')}
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel={t('search.title')}
            style={{ flex: 1, minWidth: 0, minHeight: 44, color: colors.text, fontSize: typography.body.fontSize, fontFamily: fontFamily.regular }}
          />
          {query ? <IconButton icon="x-circle" label={t('capture.clear')} onPress={() => setQuery('')} /> : null}
        </View>
      </View>

      {!results ? (
        <EmptyState pose="search" title={t('search.hint_title')} body={t('search.hint_body')} />
      ) : results.total === 0 ? (
        <EmptyState pose="search" title={t('search.no_results')} body={t('search.no_results_body')} />
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }} keyboardShouldPersistTaps="handled">
            <Chip label={`${t('search.all')} · ${results.total}`} selected={!filter} onPress={() => setFilter(null)} />
            {searchTypes
              .filter((type) => results.groups[type].length)
              .map((type) => (
                <Chip key={type} label={`${t(`search.group_${type}`)} · ${results.groups[type].length}`} selected={filter === type} onPress={() => setFilter(filter === type ? null : type)} />
              ))}
          </ScrollView>

          <Text variant="caption" color="textSecondary" accessibilityLiveRegion="polite">{t('search.results', { count: results.total })}</Text>

          {groups.length === 0 ? (
            // The selected type has no hits for the new query.
            <EmptyState pose="search" title={t('search.no_results')} body={t('search.no_results_body')} />
          ) : (
            groups.map((type) => {
              const rows = results.groups[type] as SearchGroups[typeof type][number][];
              const shown = filter ? rows : rows.slice(0, PREVIEW);
              return (
                <View key={type} style={{ gap: spacing.xs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text variant="overline" color="textSecondary" accessibilityRole="header" style={{ flex: 1 }}>
                      {`${t(`search.group_${type}`)} · ${rows.length}`.toUpperCase()}
                    </Text>
                    {!filter && rows.length > PREVIEW ? (
                      <PressableScale accessibilityRole="button" onPress={() => setFilter(type)} style={{ minHeight: 32, justifyContent: 'center' }}>
                        <Text variant="label" color="primary">{t('search.see_all', { count: rows.length })}</Text>
                      </PressableScale>
                    ) : null}
                  </View>
                  <Card padding="md" style={{ gap: 0, paddingVertical: spacing.xs }}>
                    {shown.map((item, i) => (
                      <View key={item.id} style={i ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}>
                        <SearchResult type={type} item={item} terms={results.terms} />
                      </View>
                    ))}
                  </Card>
                </View>
              );
            })
          )}
        </>
      )}
    </Screen>
  );
}

function EmptyState({ pose, title, body }: { pose: 'search'; title: string; body: string }) {
  const { spacing } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxxl }}>
      <Mascot pose={pose} size={104} />
      <Text variant="heading" align="center">{title}</Text>
      <Text variant="bodySm" color="textSecondary" align="center" style={{ maxWidth: 360 }}>{body}</Text>
    </View>
  );
}

/** One result per type: icon, title, sub line, trailing meta and where it opens. */
function SearchResult({ type, item, terms }: { type: SearchType; item: SearchGroups[SearchType][number]; terms: string[] }) {
  const { t, i18n } = useTranslation();
  const { colors, tints } = useTheme();
  const locale = i18n.language === 'th' ? 'th-TH' : 'en-GB';
  const muted = { bg: colors.surfaceMuted, fg: colors.textSecondary };
  const day = (key: string | null | undefined) => {
    if (!key) return undefined;
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  };

  switch (type) {
    case 'task': {
      const task = item as SearchGroups['task'][number];
      const when = [day(task.date), task.startTime].filter(Boolean).join(' ');
      return (
        <ResultRow
          icon={task.isDone ? 'check-circle' : 'circle'}
          tint={task.isDone ? tints.done : tints.priorityMedium}
          title={task.title}
          sub={task.notes ? snippet(task.notes, terms) : undefined}
          meta={when || undefined}
          terms={terms}
          accessibilityLabel={`${t('search.group_task')}: ${task.title}${when ? `, ${when}` : ''}`}
          onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
        />
      );
    }
    case 'event': {
      const ev = item as SearchGroups['event'][number];
      // All-day rows are UTC midnight; format them via their date key so the day never shifts by timezone.
      const start = ev.isAllDay ? fromDateKey(allDayKey(ev.start)) : new Date(ev.start);
      const when = ev.isAllDay
        ? `${start.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} · ${t('search.all_day')}`
        : `${start.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} ${start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
      return (
        <ResultRow
          icon="calendar"
          tint={tints.meeting}
          title={ev.title}
          sub={ev.location ?? undefined}
          meta={when}
          terms={terms}
          accessibilityLabel={`${t('search.group_event')}: ${ev.title}, ${when}`}
          onPress={() => router.push({ pathname: '/event/[id]', params: { id: ev.id } })}
        />
      );
    }
    case 'note': {
      const note = item as SearchGroups['note'][number];
      const title = note.title || t('notes.untitled');
      const tags = note.tags?.length ? note.tags.map((x) => `#${x}`).join(' ') : '';
      return (
        <ResultRow
          icon="file-text"
          tint={tints.personal}
          title={title}
          sub={snippet(plainText(note.body), terms) || tags || undefined}
          meta={day(toDateKey(new Date(note.updatedAt)))}
          terms={terms}
          accessibilityLabel={`${t('search.group_note')}: ${title}`}
          onPress={() => router.push({ pathname: '/note/[id]', params: { id: note.id } })}
        />
      );
    }
    case 'transaction': {
      const { tx, category } = item as SearchGroups['transaction'][number];
      const catName = category ? (i18n.language === 'th' ? category.nameTh : category.nameEn) : undefined;
      const title = tx.note || catName || t(`money.type_${tx.type}`);
      const sign = tx.type === 'income' ? '+' : tx.type === 'transfer' ? '' : '−';
      const amount = `${sign}${formatMoney(tx.amount, tx.currency, 'en-GB')}`;
      return (
        <ResultRow
          icon={tx.type === 'transfer' ? 'repeat' : categoryIcon(category?.icon)}
          tint={tx.type === 'income' ? tints.done : tx.type === 'transfer' ? muted : tints.priorityHigh}
          title={title}
          sub={[tx.note ? catName : null, day(tx.date)].filter(Boolean).join(' · ')}
          meta={amount}
          metaColor={tx.type === 'income' ? 'income' : tx.type === 'transfer' ? 'textSecondary' : 'expense'}
          terms={terms}
          accessibilityLabel={`${t('search.group_transaction')}: ${title}, ${t(`money.type_${tx.type}`)} ${amount}`}
          onPress={() => router.push({ pathname: '/tx/[id]', params: { id: tx.id } })}
        />
      );
    }
    case 'contact': {
      const c = item as SearchGroups['contact'][number];
      return (
        <ResultRow
          icon="user"
          tint={muted}
          title={c.name}
          sub={[c.company, c.role].filter(Boolean).join(' · ') || undefined}
          terms={terms}
          accessibilityLabel={`${t('search.group_contact')}: ${c.name}`}
        />
      );
    }
  }
}
