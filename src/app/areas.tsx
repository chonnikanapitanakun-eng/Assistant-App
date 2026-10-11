import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Mascot } from '@/components/brand/mascot';
import { Button, Card, Icon, IconButton, PressableScale, Screen, Text } from '@/components/ui';
import type { Area } from '@/db';
import { groupAreas } from '@/features/areas/queries';
import { useAreas } from '@/features/tasks/queries';
import { useTheme } from '@/theme';

/** Life areas (top level) and the projects under them, used to file tasks, notes, money and contacts. */
export default function AreasScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing, motion } = useTheme();
  const all = useAreas();
  const groups = useMemo(() => groupAreas(all), [all]);
  const th = i18n.language === 'th';
  const label = (a: Area) => (th ? a.nameTh : a.nameEn);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
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
        groups.map(({ parent, children }) => (
          <Animated.View key={parent.id} entering={FadeIn.duration(motion.base)} style={{ gap: spacing.sm }}>
            <PressableScale accessibilityRole="button" accessibilityLabel={t('areas.edit_named', { name: label(parent) })} onPress={() => open(parent.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.xs }}>
              <Icon name="folder" size={14} color="textSecondary" />
              <Text variant="overline" color="textSecondary" accessibilityRole="header" style={{ flex: 1 }}>{label(parent).toUpperCase()}</Text>
              <Icon name="edit-2" size={14} color="textTertiary" />
            </PressableScale>
            <Card padding="md" style={{ gap: 0, paddingVertical: spacing.xs }}>
              {children.map((c, i) => (
                <PressableScale
                  key={c.id}
                  accessibilityRole="button"
                  accessibilityLabel={t('areas.edit_named', { name: label(c) })}
                  onPress={() => open(c.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}
                >
                  <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>{label(c)}</Text>
                  <Icon name="chevron-right" size={16} color="textTertiary" />
                </PressableScale>
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
