import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { useTasksInRange } from '@/features/tasks/queries';
import { monthGrid } from '@/lib/calendar';
import { toDateKey } from '@/lib/date';
import { useTheme } from '@/theme';

import { formatDate } from './format';

const MAX_DOTS = 3;

/** ปฏิทินเดือน (เริ่มวันจันทร์) จุด = จำนวนงานที่ยังไม่เสร็จ กดวันเพื่อเปิดมุมมองวัน */
export function MonthView({ date, onSelectDay }: { date: string; onSelectDay: (date: string) => void }) {
  const { i18n } = useTranslation();
  const { colors, radius } = useTheme();
  const grid = monthGrid(date);
  const tasks = useTasksInRange(grid[0][0], grid[5][6]);
  const month = date.slice(0, 7);
  const today = toDateKey();

  const counts = new Map<string, { open: number; total: number }>();
  for (const task of tasks) {
    if (!task.date) continue;
    const c = counts.get(task.date) ?? { open: 0, total: 0 };
    c.total++;
    if (!task.isDone) c.open++;
    counts.set(task.date, c);
  }

  return (
    <View>
      <View style={{ flexDirection: 'row' }}>
        {grid[0].map((d) => (
          <Text key={d} variant="caption" color="textSecondary" style={{ flex: 1, textAlign: 'center' }}>
            {formatDate(d, i18n.language, { weekday: 'narrow' })}
          </Text>
        ))}
      </View>
      {grid.map((week) => (
        <View key={week[0]} style={{ flexDirection: 'row' }}>
          {week.map((d) => {
            const c = counts.get(d);
            const isToday = d === today;
            const isSelected = d === date;
            return (
              <Pressable
                key={d}
                onPress={() => onSelectDay(d)}
                accessibilityRole="button"
                accessibilityLabel={`${formatDate(d, i18n.language, { day: 'numeric', month: 'long' })}${c ? `, ${c.total}` : ''}`}
                style={{ flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 4, opacity: d.startsWith(month) ? 1 : 0.35 }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: radius.pill,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isToday ? colors.primary : 'transparent',
                    borderWidth: isSelected && !isToday ? 1 : 0,
                    borderColor: colors.primary,
                  }}
                >
                  <Text color={isToday ? 'onPrimary' : 'text'}>{Number(d.slice(8))}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 2, height: 5 }}>
                  {c
                    ? Array.from({ length: Math.min(c.total, MAX_DOTS) }, (_, i) => (
                        <View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: i < c.open ? colors.accent : colors.textSecondary }} />
                      ))
                    : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
