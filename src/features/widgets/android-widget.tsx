/**
 * Android home screen widget (react-native-android-widget). Rendered to native RemoteViews,
 * so only the library's widget primitives work here — no app components or hooks.
 * The name must match `widgets[].name` for react-native-android-widget in app.json.
 */
import { FlexWidget, TextWidget, type ColorProp, type HexColor } from 'react-native-android-widget';

import type { WidgetData } from './model';

type Palette = { bg: ColorProp; card: ColorProp; text: HexColor; muted: HexColor; accent: HexColor; track: ColorProp };

const light: Palette = { bg: '#FFFFFF', card: '#F1F5F9', text: '#0F172A', muted: '#64748B', accent: '#6366F1', track: '#E2E8F0' };
const dark: Palette = { bg: '#111827', card: '#1F2937', text: '#F8FAFC', muted: '#94A3B8', accent: '#818CF8', track: '#334155' };

function uri(url: string) {
  return { clickAction: 'OPEN_URI', clickActionData: { uri: url } } as const;
}

function Body({ data: d, c, wide }: { data: WidgetData; c: Palette; wide: boolean }) {
  const hasNext = d.nextTitle !== '';
  const ratio = d.total > 0 ? d.done / d.total : 0;
  return (
    <FlexWidget style={{ height: 'match_parent', width: 'match_parent', flexDirection: 'row', backgroundColor: c.bg, borderRadius: 20, padding: 14, flexGap: 12 }} {...uri(d.openUrl)}>
      <FlexWidget style={{ flex: 1, height: 'match_parent', flexDirection: 'column', justifyContent: 'space-between' }} {...uri(d.nextUrl)} accessibilityLabel={`${d.nextLabel}: ${hasNext ? `${d.nextTitle}, ${d.nextTime}` : d.emptyLabel}`}>
        <FlexWidget style={{ flexDirection: 'column', flexGap: 2 }}>
          <TextWidget text={d.nextLabel} style={{ fontSize: 12, fontWeight: '600', color: c.accent }} />
          <TextWidget text={hasNext ? d.nextTitle : d.emptyLabel} maxLines={2} truncate="END" style={{ fontSize: 16, fontWeight: '600', color: c.text }} />
          {hasNext ? <TextWidget text={d.nextTime} style={{ fontSize: 12, color: c.muted }} /> : null}
        </FlexWidget>
        <FlexWidget style={{ flexDirection: 'column', flexGap: 4, width: 'match_parent' }}>
          <FlexWidget style={{ height: 6, width: 'match_parent', borderRadius: 3, backgroundColor: c.track, flexDirection: 'row' }}>
            {ratio > 0 ? <FlexWidget style={{ height: 6, flex: ratio, borderRadius: 3, backgroundColor: c.accent }} /> : null}
            {ratio < 1 ? <FlexWidget style={{ height: 6, flex: 1 - ratio }} /> : null}
          </FlexWidget>
          <TextWidget text={d.progressLabel} style={{ fontSize: 11, color: c.muted }} />
        </FlexWidget>
      </FlexWidget>
      {wide ? (
        <FlexWidget style={{ width: 128, height: 'match_parent', flexDirection: 'column', justifyContent: 'space-between' }}>
          {d.billName !== '' ? (
            <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', backgroundColor: c.card, borderRadius: 12, padding: 8 }} {...uri(d.billUrl)} accessibilityLabel={`${d.billName}, ${d.billDetail}`}>
              <TextWidget text={d.billName} maxLines={1} truncate="END" style={{ fontSize: 12, fontWeight: '600', color: c.text }} />
              <TextWidget text={d.billDetail} maxLines={2} truncate="END" style={{ fontSize: 11, color: c.muted }} />
            </FlexWidget>
          ) : (
            <FlexWidget style={{ height: 1 }} />
          )}
          <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: c.accent, borderRadius: 18, paddingVertical: 8 }} {...uri(d.captureUrl)} accessibilityLabel={d.captureLabel}>
            <TextWidget text={`+  ${d.captureLabel}`} style={{ fontSize: 13, fontWeight: '600', color: '#FFFFFF' }} />
          </FlexWidget>
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}

/** Light and dark variants; the launcher picks one from the system theme. `width` is in dp. */
export function renderAndroidWidget(data: WidgetData, width: number) {
  const wide = width >= 250;
  return { light: <Body data={data} c={light} wide={wide} />, dark: <Body data={data} c={dark} wide={wide} /> };
}
