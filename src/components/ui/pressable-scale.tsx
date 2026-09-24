import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

type Props = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> };

/** Pressable with a subtle press response shared by all tappable surfaces. */
export function PressableScale({ style, ...rest }: Props) {
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [style, { opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    />
  );
}
