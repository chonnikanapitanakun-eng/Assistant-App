import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Mascot } from '@/components/brand/mascot';
import { Button, Card, Icon, IconButton, PressableScale, Screen, Text, useInputStyle } from '@/components/ui';
import type { Contact } from '@/db';
import { filterContacts, useContacts } from '@/features/contacts/queries';
import { useTheme } from '@/theme';

export default function ContactsScreen() {
  const { t } = useTranslation();
  const { colors, spacing, motion } = useTheme();
  const input = useInputStyle();
  const all = useContacts();
  const [query, setQuery] = useState('');
  const list = useMemo(() => filterContacts(all, query), [all, query]);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const open = (id: string) => router.push({ pathname: '/contact/[id]', params: { id } });

  return (
    <Screen maxWidth={720}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: -spacing.sm }}>
        <IconButton icon="chevron-left" label={t('common.back')} onPress={back} />
        <Text variant="title" accessibilityRole="header" style={{ flex: 1 }}>{t('contacts.title')}</Text>
        <IconButton icon="plus" label={t('contacts.add')} color="primary" filled onPress={() => open('new')} />
      </View>

      {all.length ? (
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('contacts.search')}
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel={t('contacts.search')}
          autoCorrect={false}
          style={input()}
        />
      ) : null}

      {all.length === 0 ? (
        <Animated.View entering={FadeIn.duration(motion.base)} style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxxl }}>
          <Mascot pose="calm" size={112} />
          <Text variant="heading" align="center">{t('contacts.empty_title')}</Text>
          <Text variant="bodySm" color="textSecondary" align="center">{t('contacts.empty_body')}</Text>
          <Button icon="plus" label={t('contacts.add')} onPress={() => open('new')} />
        </Animated.View>
      ) : list.length === 0 ? (
        <Text variant="bodySm" color="textSecondary" align="center" style={{ paddingVertical: spacing.xl }}>{t('contacts.no_match')}</Text>
      ) : (
        <Card padding="md" style={{ gap: 0, paddingVertical: spacing.xs }}>
          {list.map((c, i) => (
            <View key={c.id} style={i ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}>
              <ContactRow contact={c} onPress={() => open(c.id)} />
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

function ContactRow({ contact, onPress }: { contact: Contact; onPress: () => void }) {
  const { spacing, radius, colors, touchTarget } = useTheme();
  const meta = [contact.role, contact.company].filter(Boolean).join(' · ') || contact.email || contact.phone || '';
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={contact.name} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: touchTarget + 8, paddingVertical: spacing.sm }}>
      <View style={{ width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="label" weight="semibold" color="primary">{[...contact.name.trim()][0]?.toUpperCase() ?? '?'}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="subheading" numberOfLines={1}>{contact.name}</Text>
        {meta ? <Text variant="caption" color="textSecondary" numberOfLines={1}>{meta}</Text> : null}
      </View>
      <Icon name="chevron-right" size={18} color="textTertiary" />
    </PressableScale>
  );
}
