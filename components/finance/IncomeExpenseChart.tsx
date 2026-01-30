import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';

const MAX_BAR_WIDTH = 100;

type Props = {
  income: number;
  expense: number;
  height?: number;
};

export function IncomeExpenseChart({ income, expense, height = 120 }: Props) {
  const max = Math.max(income, expense, 1);
  const incomePct = (income / max) * MAX_BAR_WIDTH;
  const expensePct = (expense / max) * MAX_BAR_WIDTH;

  return (
    <View style={[styles.wrapper, { height }]}>
      <View style={styles.barRow}>
        <View style={styles.barLabel}>
          <Text style={styles.labelText}>Ingresos</Text>
          <Text style={styles.amountIncome}>
            ${income.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </Text>
        </View>
        <View style={styles.barTrack}>
          <MotiView
            from={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ type: 'timing', duration: 600, delay: 200 }}
            style={[
              styles.barFill,
              styles.barIncome,
              { width: `${Math.min(incomePct, MAX_BAR_WIDTH)}%` },
            ]}
          />
        </View>
      </View>
      <View style={styles.barRow}>
        <View style={styles.barLabel}>
          <Text style={styles.labelText}>Gastos</Text>
          <Text style={styles.amountExpense}>
            ${expense.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </Text>
        </View>
        <View style={styles.barTrack}>
          <MotiView
            from={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ type: 'timing', duration: 600, delay: 350 }}
            style={[
              styles.barFill,
              styles.barExpense,
              { width: `${Math.min(expensePct, MAX_BAR_WIDTH)}%` },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  barLabel: {
    width: 90,
  },
  labelText: {
    fontSize: 13,
    color: '#64748b',
  },
  amountIncome: {
    fontSize: 14,
    fontWeight: '700',
    color: '#16a34a',
  },
  amountExpense: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dc2626',
  },
  barTrack: {
    flex: 1,
    height: 24,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 12,
  },
  barIncome: {
    backgroundColor: '#22c55e',
  },
  barExpense: {
    backgroundColor: '#ef4444',
  },
});
