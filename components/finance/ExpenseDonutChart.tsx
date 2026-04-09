import type { CategoryExpense } from '@/hooks/useFinanceData';
import { MotiView } from 'moti';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

const FALLBACK_COLORS = ['#0d9488', '#7c3aed', '#ef4444', '#ec4899', '#3b82f6', '#f97316', '#64748b'];

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutSegmentPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number
) {
  const startOuter = polar(cx, cy, rOuter, startAngle);
  const endOuter = polar(cx, cy, rOuter, endAngle);
  const startInner = polar(cx, cy, rInner, endAngle);
  const endInner = polar(cx, cy, rInner, startAngle);
  const sweep = endAngle - startAngle;
  const largeArc = sweep > 180 ? 1 : 0;
  return [
    'M',
    startOuter.x,
    startOuter.y,
    'A',
    rOuter,
    rOuter,
    0,
    largeArc,
    1,
    endOuter.x,
    endOuter.y,
    'L',
    startInner.x,
    startInner.y,
    'A',
    rInner,
    rInner,
    0,
    largeArc,
    0,
    endInner.x,
    endInner.y,
    'Z',
  ].join(' ');
}

type Props = {
  data: CategoryExpense[];
  total: number;
};

export function ExpenseDonutChart({ data, total }: Props) {
  if (data.length === 0 || total <= 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No hay gastos por categoría este periodo</Text>
      </View>
    );
  }

  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 78;
  const rInner = 52;
  let angle = -90;

  const segments = data.map((item, index) => {
    const sweep = (item.amount / total) * 360;
    const start = angle;
    const end = angle + sweep;
    const color = item.categoryColor ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
    const path = donutSegmentPath(cx, cy, rOuter, rInner, start, end);
    angle = end;
    return { path, color, item, index };
  });

  const formatMoney = (n: number) =>
    n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });

  return (
    <View style={styles.wrapper}>
      <View style={styles.chartRow}>
        <View style={styles.svgWrap}>
          <Svg width={size} height={size}>
            <G>
              {segments.map((s, i) => (
                <Path key={i} d={s.path} fill={s.color} />
              ))}
            </G>
          </Svg>
          <View style={styles.centerLabel} pointerEvents="none">
            <Text style={styles.centerTotal}>TOTAL</Text>
            <Text style={styles.centerAmount}>{formatMoney(total)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.legendGrid}>
        {data.map((item, index) => {
          const color = item.categoryColor ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
          return (
            <MotiView
              key={`${item.categoryName}-${index}`}
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 60 * index }}
              style={styles.legendCell}
            >
              <View style={styles.legendLeft}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text style={styles.legendName} numberOfLines={1}>
                  {item.categoryName}
                </Text>
              </View>
              <Text style={styles.legendPct}>{item.percentage.toFixed(0)}%</Text>
            </MotiView>
          );
        })}
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.footerLabel}>Total gastos</Text>
        <Text style={styles.footerAmount}>{formatMoney(total)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%' },
  empty: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#94a3b8' },
  chartRow: { alignItems: 'center', marginBottom: 8 },
  svgWrap: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  centerLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTotal: { fontSize: 11, fontWeight: '600', color: '#94a3b8', letterSpacing: 0.5 },
  centerAmount: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginTop: 2 },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    rowGap: 10,
    columnGap: 12,
  },
  legendCell: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legendLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendName: { flex: 1, fontSize: 13, fontWeight: '600', color: '#334155' },
  legendPct: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  footerLabel: { fontSize: 14, color: '#94a3b8', fontWeight: '500' },
  footerAmount: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
});
