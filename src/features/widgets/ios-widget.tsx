/**
 * iOS home / lock screen widget (expo-widgets + SwiftUI via @expo/ui).
 *
 * The layout function is marked 'widget': babel turns it into a string that iOS evaluates on its
 * own, with the SwiftUI components and modifiers as globals. So it must be self-contained — only
 * its props, the environment, and the imports below; no other app code or closures.
 * The name must match `widgets[].name` for expo-widgets in app.json.
 */
import { Gauge, HStack, Image, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { background, containerBackground, font, foregroundStyle, frame, gaugeStyle, lineLimit, padding, shapes, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import { WIDGET_NAME, type WidgetData } from './model';

const VeyraToday = (p: WidgetData, env: WidgetEnvironment) => {
  'widget';
  const accent = '#6366F1';
  const family = env.widgetFamily;
  const hasNext = p.nextTitle !== '';
  const ratio = p.total > 0 ? p.done / p.total : 0;
  // iOS 17+ needs a container background on every family (the Lock Screen drops it).
  const widgetBg = containerBackground({ type: 'material', material: 'regular' }, 'widget');

  if (family === 'accessoryInline') {
    return <Text modifiers={[widgetURL(p.nextUrl), widgetBg]}>{hasNext ? `${p.nextTime.split(' ')[0]} ${p.nextTitle}` : p.progressLabel}</Text>;
  }

  if (family === 'accessoryCircular') {
    return (
      <Gauge value={ratio} modifiers={[gaugeStyle('circularCapacity'), widgetURL(p.openUrl), widgetBg]} currentValueLabel={<Text>{`${p.done}/${p.total}`}</Text>}>
        <Image systemName="checkmark" />
      </Gauge>
    );
  }

  if (family === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={1} modifiers={[widgetURL(p.nextUrl), widgetBg, frame({ maxWidth: 10000, alignment: 'leading' })]}>
        <Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' })]}>{hasNext ? p.nextTime : p.nextLabel}</Text>
        <Text modifiers={[font({ textStyle: 'headline' }), lineLimit(2)]}>{hasNext ? p.nextTitle : p.emptyLabel}</Text>
        <Text modifiers={[font({ textStyle: 'caption' })]}>{p.progressLabel}</Text>
      </VStack>
    );
  }

  const next = (
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' }), foregroundStyle(accent)]}>{p.nextLabel}</Text>
      <Text modifiers={[font({ textStyle: 'headline' }), lineLimit(2)]}>{hasNext ? p.nextTitle : p.emptyLabel}</Text>
      {hasNext ? <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>{p.nextTime}</Text> : null}
    </VStack>
  );
  const progress = (
    <HStack spacing={6}>
      <Gauge value={ratio} modifiers={[gaugeStyle('linearCapacity'), foregroundStyle(accent)]} />
      <Text modifiers={[font({ textStyle: 'caption2' }), foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>{p.progressLabel}</Text>
    </HStack>
  );

  if (family === 'systemSmall') {
    return (
      <VStack alignment="leading" spacing={8} modifiers={[widgetURL(p.nextUrl), widgetBg, frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' })]}>
        {next}
        <Spacer />
        {progress}
      </VStack>
    );
  }

  // systemMedium / systemLarge: next up + progress on the left, bill and Quick Capture on the right.
  return (
    <HStack alignment="top" spacing={12} modifiers={[widgetBg, frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' })]}>
      <Link destination={p.nextUrl} modifiers={[frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' })]}>
        <VStack alignment="leading" spacing={8} modifiers={[frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' })]}>
          {next}
          <Spacer />
          {progress}
        </VStack>
      </Link>
      <VStack alignment="leading" spacing={8} modifiers={[frame({ width: 120, maxHeight: 10000, alignment: 'topLeading' })]}>
        {p.billName !== '' ? (
          <Link destination={p.billUrl}>
            <VStack alignment="leading" spacing={2}>
              <Image systemName="creditcard" size={14} color={accent} />
              <Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' }), lineLimit(1)]}>{p.billName}</Text>
              <Text modifiers={[font({ textStyle: 'caption2' }), foregroundStyle({ type: 'hierarchical', style: 'secondary' }), lineLimit(2)]}>{p.billDetail}</Text>
            </VStack>
          </Link>
        ) : null}
        <Spacer />
        <Link destination={p.captureUrl}>
          <HStack spacing={4} modifiers={[padding({ horizontal: 10, vertical: 6 }), background(`${accent}26`, shapes.capsule())]}>
            <Image systemName="plus.circle.fill" size={14} color={accent} />
            <Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' }), foregroundStyle(accent)]}>{p.captureLabel}</Text>
          </HStack>
        </Link>
      </VStack>
    </HStack>
  );
};

export const todayWidget = createWidget<WidgetData>(WIDGET_NAME, VeyraToday);
