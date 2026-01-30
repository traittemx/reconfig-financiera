import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';

export type MonthStats = {
  monthLabel: string;
  income: number;
  expense: number;
};

const MAX_BAR_PCT = 100;

type Props = {
  data: MonthStats[];
};

export function Last3MonthsChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No hay datos de los últimos 3 meses</Text>
      </View>
    );
  }

  const maxIncome = Math.max(...data.map((d) => d.income), 1);
  const maxExpense = Math.max(...data.map((d) => d.expense), 1);
  const maxVal = Math.max(maxIncome, maxExpense, 1);

  return (
    <View style={styles.wrapper}>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendIncome]} />
          <Text style={styles.legendText}>Ingresos</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendExpense]} />
          <Text style={styles.legendText}>Gastos</Text>
        </View>
      </View>
      <View style={styles.monthsRow}>
        {data.map((month, index) => {
          const incomePct = (month.income / maxVal) * MAX_BAR_PCT;
          const expensePct = (month.expense / maxVal) * MAX_BAR_PCT;
          return (
            <MotiView
              key={month.monthLabel}
              from={{ opacity: 0, translateY: 8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 400, delay: 100 + index * 80 }}
              style={styles.monthColumn}
            >
              <Text style={styles.monthLabel} numberOfLines={1}>
                {month.monthLabel}
              </Text>
              <View style={styles.bars}>
                <View style={styles.barRow}>
                  <View style={styles.barTrack}>
                    <MotiView
                      from={{ opacity: 0, scaleX: 0 }}
                      animate={{ opacity: 1, scaleX: 1 }}
                      transition={{ type: 'timing', duration: 500, delay: 200 + index * 60 }}
                      style={[
                        styles.barFill,
                        styles.barIncome,
                        { width: `${Math.min(incomePct, MAX_BAR_PCT)}%` },
                      ]}
                    />
                  </View>
                </View>
                <View style={styles.barRow}>
                  <View style={styles.barTrack}>
                    <MotiView
                      from={{ opacity: 0, scaleX: 0 }}
                      animate={{ opacity: 1, scaleX: 1 }}
                      transition={{ type: 'timing', duration: 500, delay: 280 + index * 60 }}
                      style={[
                        styles.barFill,
                        styles.barExpense,
                        { width: `${Math.min(expensePct, MAX_BAR_PCT)}%` },
                      ]}
                    />
                  </View>
                </View>
              </View>
              <Text style={styles.amountIncome}>
                ${month.income.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </Text>
              <Text style={styles.amountExpense}>
                ${month.expense.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </Text>
            </MotiView>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  empty: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendIncome: { backgroundColor: '#22c55e' },
  legendExpense: { backgroundColor: '#ef4444' },
  legendText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  monthsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  monthColumn: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  monthLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 10,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  bars: {
    width: '100%',
    marginBottom: 8,
  },
  barRow: {
    marginBottom: 6,
  },
  barTrack: {
    height: 14,
    backgroundColor: '#f1f5f9',
    borderRadius: 7,
    overflow: 'hidden',
    width: '100%',
  },
  barFill: {
    height: '100%',
    borderRadius: 7,
  },
  barIncome: {
    backgroundColor: '#22c55e',
  },
  barExpense: {
    backgroundColor: '#ef4444',
  },
  amountIncome: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a',
    marginTop: 2,
  },
  amountExpense: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
  },
});
