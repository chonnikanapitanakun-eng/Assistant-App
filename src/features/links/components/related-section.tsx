import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Button, Chip, Field, Icon, IconButton, PressableScale, Text, useInputStyle } from '@/components/ui';
import type { LinkableType } from '@/db';
import { background } from '@/lib/background';
import { useTheme } from '@/theme';

import { linkableInPicker, refKey, relationKey, routeFor, typeStyle, type Candidate, type LinkRef, type RelatedItem } from '../model';
import { addLink, removeLink, useLinkCandidates, useRelated } from '../queries';

type Props = {
  /** The saved record being viewed. */
  self: LinkRef;
  /** Types offered by the picker (default: everything but areas). */
  types?: LinkableType[];
};

/**
 * "เกี่ยวข้องกับ" — every record linked to `self`, tappable, with an inline picker to add more.
 * Render only for saved records (needs an id). Writes go straight to the DB, not through the form.
 */
export function RelatedSection({ self, types = linkableInPicker }: Props) {
  const { t } = useTranslation();
  const items = useRelated(self);
  const [adding, setAdding] = useState(false);

  return (
    <Field label={`${t('links.title')}${items.length ? ` · ${items.length}` : ''}`} icon="link">
      {items.length ? (
        items.map((item) => <RelatedRow key={item.linkId} item={item} />)
      ) : !adding ? (
        <Text variant="bodySm" color="textTertiary">{t('links.empty')}</Text>
      ) : null}
      {adding ? (
        <LinkPicker self={self} types={types} linked={new Set(items.map((i) => refKey(i.ref)))} onDone={() => setAdding(false)} />
      ) : (
        <View style={{ flexDirection: 'row' }}>
          <Button variant="secondary" size="sm" icon="plus" label={t('links.add')} onPress={() => setAdding(true)} />
        </View>
      )}
    </Field>
  );
}

function RelatedRow({ item }: { item: RelatedItem }) {
  const { t } = useTranslation();
  const { tints, spacing, colors, radius } = useTheme();
  const style = typeStyle[item.ref.type];
  const tint = tints[style.tint];
  const typeLabel = t(`links.type_${item.ref.type}`);
  const title = item.title || typeLabel;
  const route = routeFor(item.ref);
  const sub = [typeLabel, t(`links.${relationKey(item.relation, item.direction)}`), item.subtitle].filter(Boolean).join(' · ');

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted, paddingLeft: spacing.md, paddingRight: spacing.xs }}>
      <PressableScale
        accessibilityRole={route ? 'button' : 'text'}
        accessibilityLabel={route ? t('links.open', { title }) : title}
        disabled={!route}
        onPress={() => route && router.push(route)}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingVertical: spacing.sm }}
      >
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: tint.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={style.icon} size={16} tone={tint.fg} />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text variant="label" numberOfLines={1}>{title}</Text>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>{sub}</Text>
        </View>
        {route ? <Icon name="chevron-right" size={16} color="textTertiary" /> : null}
      </PressableScale>
      <IconButton icon="x" label={t('links.remove', { title })} onPress={() => background(removeLink(item.linkId), 'Remove link')} />
    </View>
  );
}

type PickerProps = { self: LinkRef; types: LinkableType[]; linked: Set<string>; onDone: () => void };

function LinkPicker({ self, types, linked, onDone }: PickerProps) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const input = useInputStyle();
  const [type, setType] = useState<LinkableType>(types[0]);
  const [q, setQ] = useState('');
  const candidates = useLinkCandidates(type, q, self).filter((c) => !linked.has(refKey(c.ref)));

  const pick = (c: Candidate) => {
    background(addLink(self, c.ref), 'Add link');
    setQ('');
    onDone();
  };

  return (
    <Animated.View entering={FadeIn.duration(150)} style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={{ gap: spacing.sm }}>
        {types.map((k) => (
          <Chip key={k} icon={typeStyle[k].icon} label={t(`links.type_${k}`)} selected={type === k} onPress={() => setType(k)} />
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <TextInput
          autoFocus
          value={q}
          onChangeText={setQ}
          placeholder={t('links.search_placeholder')}
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel={t('links.search_placeholder')}
          style={[input(), { flex: 1 }]}
        />
        <IconButton icon="x" label={t('common.cancel')} filled onPress={onDone} />
      </View>
      {candidates.length ? (
        candidates.map((c) => <CandidateRow key={refKey(c.ref)} candidate={c} onPress={() => pick(c)} />)
      ) : (
        <Text variant="caption" color="textTertiary" style={{ paddingVertical: spacing.sm }}>{t('links.no_results')}</Text>
      )}
    </Animated.View>
  );
}

function CandidateRow({ candidate, onPress }: { candidate: Candidate; onPress: () => void }) {
  const { t } = useTranslation();
  const { tints, spacing } = useTheme();
  const style = typeStyle[candidate.ref.type];
  const tint = tints[style.tint];
  const title = candidate.title || t(`links.type_${candidate.ref.type}`);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('links.link_to', { title })}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 }}
    >
      <Icon name={style.icon} size={16} tone={tint.fg} />
      <View style={{ flex: 1 }}>
        <Text variant="bodySm" numberOfLines={1}>{title}</Text>
        {candidate.subtitle ? <Text variant="caption" color="textSecondary" numberOfLines={1}>{candidate.subtitle}</Text> : null}
      </View>
      <Icon name="plus" size={16} color="primary" />
    </PressableScale>
  );
}
