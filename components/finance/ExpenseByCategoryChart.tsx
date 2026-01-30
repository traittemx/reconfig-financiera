import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';

const CATEGORY_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#7c3aed', '#ea580c', '#0d9488', '#be185d', '#64748b'];

export type CategoryExpense = {
  categoryName: string;
  amount: number;
  percentage: number;
  categoryColor?: string | null;
};

type Props = {
  data: CategoryExpense[];
  totalExpense: number;
};

export function ExpenseByCategoryChart({ data, totalExpense }: Props) {
  if (data.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No hay gastos por categoría este mes</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {data.map((item, index) => {
        const color = item.categoryColor ?? CATEGORY_COLORS[index % CATEGORY_COLORS.length];
        return (
          <View key={`${item.categoryName}-${index}`} style={styles.row}>
            <View style={styles.labelRow}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Text style={styles.categoryName} numberOfLines={1}>{item.categoryName}</Text>
              <Text style={styles.amount}>
                {item.amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
              </Text>
            </View>
            <View style={styles.barTrack}>
              <MotiView
                from={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ type: 'timing', duration: 600, delay: 100 + index * 80 }}
                style={[
                  styles.barFill,
                  { backgroundColor: color, width: `${Math.min(item.percentage, 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.pct}>{item.percentage.toFixed(0)}%</Text>
          </View>
        );
      })}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total gastos del mes</Text>
        <Text style={styles.totalAmount}>
          {totalExpense.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingVertical: 8, paddingHorizontal: 4 },
  empty: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#94a3b8' },
  row: { marginBottom: 14 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  categoryName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  amount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  barTrack: {
    height: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  pct: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  totalLabel: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  totalAmount: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
});
