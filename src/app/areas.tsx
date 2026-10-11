import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Mascot } from '@/components/brand/mascot';
import { Button, Card, Icon, IconButton, PressableScale, Screen, Text } from '@/components/ui';
import type { Area } from '@/db';
import { areaIcon, groupAreas, moveArea } from '@/features/areas/queries';
import { background } from '@/lib/background';
import { useAreas } from '@/features/tasks/queries';
import { useTheme } from '@/theme';

/** Life areas (top level) and the projects under them, used to file tasks, notes, money and contacts. */
export default function AreasScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius, motion } = useTheme();
  const all = useAreas();
  const groups = useMemo(() => groupAreas(all), [all]);
  const th = i18n.language === 'th';
  const label = (a: Area) => (th ? a.nameTh : a.nameEn);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const move = (id: string, dir: -1 | 1) => background(moveArea(all, id, dir), 'Reorder area');
  const badge = (a: Area, parent?: Area) => (
    <View style={{ width: 28, height: 28, borderRadius: radius.md, backgroundColor: a.color ?? parent?.color ?? colors.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={areaIcon(a, parent)} size={14} tone="#FFFFFF" />
    </View>
  );
  const arrows = (a: Area, index: number, count: number) => (
    <>
      <IconButton icon="chevron-up" label={t('areas.move_up', { name: label(a) })} disabled={index === 0} onPress={() => move(a.id, -1)} />
      <IconButton icon="chevron-down" label={t('areas.move_down', { name: label(a) })} disabled={index === count - 1} onPress={() => move(a.id, 1)} />
    </>
  );
  const open = (id: string, parent?: string) => router.push({ pathname: '/area/[id]', params: parent ? { id, parent } : { id } });

  return (
    <Screen maxWidth={720}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: -spacing.sm }}>
        <IconButton icon="chevron-left" label={t('common.back')} onPress={back} />
        <Text variant="title" accessibilityRole="header" style={{ flex: 1 }}>{t('areas.title')}</Text>
        <IconButton icon="plus" label={t('areas.add_area')} color="primary" filled onPress={() => open('new')} />
      </View>
      <Text variant="bodySm" color="textSecondary">{t('areas.intro')}</Text>

      {groups.length === 0 ? (
        <Animated.View entering={FadeIn.duration(motion.base)} style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxxl }}>
          <Mascot pose="calm" size={112} />
          <Text variant="heading" align="center">{t('areas.empty_title')}</Text>
          <Button icon="plus" label={t('areas.add_area')} onPress={() => open('new')} />
        </Animated.View>
      ) : (
        groups.map(({ parent, children }, gi) => (
          <Animated.View key={parent.id} entering={FadeIn.duration(motion.base)} style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <PressableScale accessibilityRole="button" accessibilityLabel={t('areas.edit_named', { name: label(parent) })} onPress={() => open(parent.id)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.xs }}>
                {badge(parent)}
                <Text variant="overline" color="textSecondary" accessibilityRole="header" style={{ flex: 1 }}>{label(parent).toUpperCase()}</Text>
                <Icon name="edit-2" size={14} color="textTertiary" />
              </PressableScale>
              {arrows(parent, gi, groups.length)}
            </View>
            <Card padding="md" style={{ gap: 0, paddingVertical: spacing.xs }}>
              {children.map((c, i) => (
                <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={t('areas.edit_named', { name: label(c) })}
                    onPress={() => open(c.id)}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 }}
                  >
                    {badge(c, parent)}
                    <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>{label(c)}</Text>
                  </PressableScale>
                  {arrows(c, i, children.length)}
                </View>
              ))}
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t('areas.add_project_in', { name: label(parent) })}
                onPress={() => open('new', parent.id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, borderTopWidth: children.length ? 1 : 0, borderTopColor: colors.border }}
              >
                <Icon name="plus" size={16} color="primary" />
                <Text variant="label" color="primary">{t('areas.add_project')}</Text>
              </PressableScale>
            </Card>
          </Animated.View>
        ))
      )}
    </Screen>
  );
}
