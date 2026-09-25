import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TextInput, View, type NativeSyntheticEvent, type TextInputSelectionChangeEventData } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Mascot } from '@/components/brand/mascot';
import { Button, Chip, Gradient, Icon, IconButton, PressableScale, Text, type IconName } from '@/components/ui';
import type { Note } from '@/db';
import { saveCaptureItems } from '@/features/ai/save';
import { DetectedItem } from '@/features/capture/detected-item';
import { RelatedSection } from '@/features/links/components/related-section';
import { background } from '@/lib/background';
import { useConfirm } from '@/lib/use-confirm';
import { useTheme } from '@/theme';

import { applyFormat, toggleCheck, type Format } from '../markdown';
import { extractItems, normalizeTag, summarize } from '../model';
import { deleteNote, updateNote, useNote } from '../queries';

import { MarkdownView } from './markdown-view';

type Props = {
  id: string;
  /** Start in edit mode (new notes). */
  startInEdit?: boolean;
  /** Back button (phone route) vs. none (desktop reading pane). */
  onBack?: () => void;
  onDeleted: () => void;
};

/** Loads a note and hands it to the form once available. */
export function NoteEditor(props: Props) {
  const { note, loaded } = useNote(props.id);
  const { t } = useTranslation();
  const { spacing } = useTheme();
  if (!note) {
    return loaded ? (
      <View style={{ alignItems: 'center', gap: spacing.md, padding: spacing.xxl }}>
        <Mascot pose="search" size={96} />
        <Text variant="heading" align="center">{t('notes.not_found')}</Text>
        {props.onBack ? <Button label={t('common.close')} variant="secondary" onPress={props.onBack} /> : null}
      </View>
    ) : null;
  }
  return <NoteForm key={note.id} note={note} {...props} />;
}

const toolbar: { format: Format; icon: IconName; key: string }[] = [
  { format: 'heading', icon: 'type', key: 'heading' },
  { format: 'bold', icon: 'bold', key: 'bold' },
  { format: 'italic', icon: 'italic', key: 'italic' },
  { format: 'bullet', icon: 'list', key: 'bullet' },
  { format: 'check', icon: 'check-square', key: 'check' },
  { format: 'quote', icon: 'message-square', key: 'quote' },
];

type Sel = { start: number; end: number };

function NoteForm({ note, startInEdit, onBack, onDeleted }: Props & { note: Note }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius, typography, fontFamily, shadow } = useTheme();
  const { armed, confirm } = useConfirm();

  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [tags, setTags] = useState<string[]>(note.tags ?? []);
  const [editing, setEditing] = useState(!!startInEdit || (!note.title && !note.body));
  const [tagDraft, setTagDraft] = useState('');
  const [panel, setPanel] = useState<'none' | 'summary' | 'extract'>('none');
  const [forcedSel, setForcedSel] = useState<Sel | undefined>();
  const sel = useRef<Sel>({ start: body.length, end: body.length });

  // Autosave (debounced) and a final flush on leave; empty new notes are discarded.
  const latest = useRef({ title, body, tags, dirty: false });
  const deleted = useRef(false);
  useEffect(() => {
    latest.current = { title, body, tags, dirty: latest.current.dirty };
    if (!latest.current.dirty) return;
    const h = setTimeout(() => {
      background(updateNote(note.id, { title, body, tags }), 'Autosave note');
      latest.current.dirty = false;
    }, 400);
    return () => clearTimeout(h);
  }, [title, body, tags, note.id]);
  useEffect(
    () => () => {
      if (deleted.current) return;
      const l = latest.current;
      if (!l.title.trim() && !l.body.trim() && !l.tags.length) background(deleteNote(note.id), 'Discard empty note');
      else if (l.dirty) background(updateNote(note.id, { title: l.title, body: l.body, tags: l.tags }), 'Save note');
    },
    [note.id],
  );
  const touch = () => (latest.current.dirty = true);

  const summary = useMemo(() => summarize(body), [body]);
  const extracted = useMemo(() => (panel === 'extract' ? extractItems(body) : []), [panel, body]);

  const format = (f: Format) => {
    const r = applyFormat(body, sel.current, f);
    touch();
    setBody(r.text);
    sel.current = r.selection;
    setForcedSel(r.selection);
  };
  const addTag = () => {
    const tag = normalizeTag(tagDraft);
    setTagDraft('');
    if (!tag || tags.includes(tag)) return;
    touch();
    setTags([...tags, tag]);
  };
  const edited = new Date(note.updatedAt).toLocaleString(i18n.language === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        {onBack ? <IconButton icon="chevron-left" label={t('common.back')} onPress={onBack} /> : null}
        <View style={{ flex: 1 }} />
        <IconButton icon="bookmark" label={note.pinned ? t('notes.unpin') : t('notes.pin')} color={note.pinned ? 'primary' : 'textSecondary'} filled={note.pinned} onPress={() => background(updateNote(note.id, { pinned: !note.pinned }), 'Pin note')} />
        <IconButton icon={editing ? 'book-open' : 'edit-3'} label={editing ? t('notes.read') : t('common.edit')} onPress={() => setEditing(!editing)} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: spacing.xl, paddingBottom: spacing.huge, gap: spacing.lg }}>
        <TextInput
          value={title}
          onChangeText={(v) => (touch(), setTitle(v))}
          placeholder={t('notes.title_placeholder')}
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel={t('notes.title_placeholder')}
          multiline
          style={{ color: colors.text, fontSize: typography.title.fontSize, lineHeight: typography.title.lineHeight, fontFamily: fontFamily.bold, padding: 0 }}
        />
        <Text variant="caption" color="textTertiary">
          {t('notes.meta', { date: edited, words: summary.words })}
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
          {tags.map((tag) => (
            <PressableScale
              key={tag}
              accessibilityRole="button"
              accessibilityLabel={t('notes.remove_tag', { tag })}
              onPress={() => (touch(), setTags(tags.filter((x) => x !== tag)))}
              hitSlop={6}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.primarySoft }}
            >
              <Text variant="caption" weight="semibold" color="primary">#{tag}</Text>
              <Icon name="x" size={12} />
            </PressableScale>
          ))}
          <TextInput
            value={tagDraft}
            onChangeText={setTagDraft}
            onSubmitEditing={addTag}
            onBlur={addTag}
            placeholder={t('notes.add_tag')}
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel={t('notes.add_tag')}
            style={{ minWidth: 90, minHeight: 44, color: colors.text, fontSize: typography.caption.fontSize, fontFamily: fontFamily.regular, paddingHorizontal: spacing.sm }}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Chip icon="align-left" label={t('notes.summarise')} selected={panel === 'summary'} onPress={() => setPanel(panel === 'summary' ? 'none' : 'summary')} />
          <Chip icon="zap" label={t('notes.extract')} selected={panel === 'extract'} onPress={() => setPanel(panel === 'extract' ? 'none' : 'extract')} />
        </View>

        {panel !== 'none' ? (
          <Animated.View entering={FadeIn.duration(200)}>
            <Gradient variant="ai" style={{ borderRadius: radius.lg, padding: 1.5, boxShadow: shadow.sm }}>
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg - 1.5, padding: spacing.lg, gap: spacing.md }}>
                {panel === 'summary' ? <SummaryPanel summary={summary} /> : <ExtractPanel items={extracted} noteId={note.id} key={body} />}
              </View>
            </Gradient>
          </Animated.View>
        ) : null}

        {editing ? (
          <View style={{ gap: spacing.sm }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={{ gap: spacing.xs }}>
              {toolbar.map((b) => (
                <IconButton key={b.key} icon={b.icon} label={t(`notes.fmt_${b.key}`)} filled onPress={() => format(b.format)} />
              ))}
            </ScrollView>
            <TextInput
              autoFocus={!!startInEdit}
              multiline
              value={body}
              selection={forcedSel}
              onSelectionChange={(e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
                sel.current = e.nativeEvent.selection;
                if (forcedSel) setForcedSel(undefined);
              }}
              onChangeText={(v) => (touch(), setBody(v))}
              placeholder={t('notes.body_placeholder')}
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel={t('notes.body_placeholder')}
              textAlignVertical="top"
              style={{ minHeight: 320, color: colors.text, fontSize: typography.body.fontSize, lineHeight: 26, fontFamily: fontFamily.regular, padding: 0 }}
            />
            <Text variant="caption" color="textTertiary">{t('notes.markdown_hint')}</Text>
          </View>
        ) : body.trim() ? (
          <MarkdownView source={body} onToggle={(line) => (touch(), setBody(toggleCheck(body, line)))} />
        ) : (
          <PressableScale accessibilityRole="button" accessibilityLabel={t('common.edit')} onPress={() => setEditing(true)} style={{ minHeight: 120, justifyContent: 'center' }}>
            <Text variant="body" color="textTertiary">{t('notes.body_placeholder')}</Text>
          </PressableScale>
        )}

        <RelatedSection self={{ type: 'note', id: note.id }} />

        <View style={{ height: 1, backgroundColor: colors.border, marginTop: spacing.xl }} />
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            variant="ghost"
            icon="trash-2"
            size="sm"
            label={armed ? t('tasks.delete_confirm') : t('notes.delete')}
            onPress={() =>
              confirm(() => {
                deleted.current = true;
                background(deleteNote(note.id), 'Delete note');
                onDeleted();
              })
            }
          />
        </View>
      </ScrollView>
    </View>
  );
}

function SummaryPanel({ summary }: { summary: ReturnType<typeof summarize> }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text variant="overline" color="primary">{t('notes.summary_title').toUpperCase()}</Text>
      </View>
      {summary.points.length ? (
        summary.points.map((p) => (
          <View key={p} style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Text variant="bodySm" color="textSecondary">•</Text>
            <Text variant="bodySm" style={{ flex: 1 }}>{p}</Text>
          </View>
        ))
      ) : (
        <Text variant="bodySm" color="textSecondary">{t('notes.summary_empty')}</Text>
      )}
      <Text variant="caption" color="textSecondary">
        {t('notes.summary_stats', { minutes: summary.readMinutes, words: summary.words })}
        {summary.checklist.total ? ` · ${t('notes.summary_checklist', { done: summary.checklist.done, total: summary.checklist.total })}` : ''}
      </Text>
      <Text variant="caption" color="textTertiary">{t('notes.on_device')}</Text>
    </>
  );
}

function ExtractPanel({ items, noteId }: { items: ReturnType<typeof extractItems>; noteId: string }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [saved, setSaved] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const chosen = items.filter((_, i) => !excluded.has(i));

  if (saved !== null) {
    return (
      <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Mascot pose="success" size={56} />
        <View style={{ flex: 1 }}>
          <Text variant="subheading">{t('capture.saved_title')}</Text>
          <Text variant="caption" color="textSecondary">{t('notes.extract_saved', { count: saved })}</Text>
        </View>
      </View>
    );
  }
  return (
    <>
      <Text variant="overline" color="primary">{t('capture.found', { count: items.length }).toUpperCase()}</Text>
      {items.length ? (
        <>
          {items.map((item, i) => (
            <DetectedItem
              key={i}
              item={item}
              included={!excluded.has(i)}
              onToggle={() =>
                setExcluded((prev) => {
                  const next = new Set(prev);
                  if (next.has(i)) next.delete(i);
                  else next.add(i);
                  return next;
                })
              }
            />
          ))}
          <Button
            fullWidth
            icon="check"
            disabled={!chosen.length || saving}
            label={chosen.length ? t('capture.save_count', { count: chosen.length }) : t('capture.save')}
            onPress={async () => {
              setSaving(true);
              setError(false);
              try {
                setSaved(await saveCaptureItems(chosen, { sourceNoteId: noteId }));
              } catch (e) {
                console.error('Saving note items failed:', e);
                setError(true);
              } finally {
                setSaving(false);
              }
            }}
          />
          {error ? <Text variant="caption" color="danger">{t('capture.error_body')}</Text> : null}
        </>
      ) : (
        <Text variant="bodySm" color="textSecondary">{t('notes.extract_empty')}</Text>
      )}
      <Text variant="caption" color="textTertiary">{t('notes.on_device')}</Text>
    </>
  );
}
