import { View } from 'react-native';

import { useTheme } from '@/theme';

import { PressableScale } from './pressable-scale';
import { Text } from './text';

type Props = { title: string; action?: string; onAction?: () => void };

export function SectionHeader({ title, action, onAction }: Props) {
  const { spacing, touchTarget } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
      <Text variant="heading" accessibilityRole="header">{title}</Text>
      {action ? (
        <PressableScale accessibilityRole="button" accessibilityLabel={action} onPress={onAction} style={{ minHeight: touchTarget, justifyContent: 'center', paddingHorizontal: spacing.xs }}>
          <Text variant="label" color="primary">{action}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}
