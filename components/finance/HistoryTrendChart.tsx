import { MotiView } from 'moti';
import { StyleSheet, Text, View } from 'react-native';

export type HistoryItem = {
    label: string;
    amount: number;
};

type Props = {
    data: HistoryItem[];
    type: 'EXPENSE' | 'INCOME';
};

export function HistoryTrendChart({ data, type }: Props) {
    const isExpense = type === 'EXPENSE';
    const color = isExpense ? '#ef4444' : '#22c55e';

    if (!data || data.length === 0) {
        return (
            <View style={styles.empty}>
                <Text style={styles.emptyText}>No hay datos históricos para este periodo</Text>
            </View>
        );
    }

    const maxAmount = Math.max(...data.map(d => d.amount), 1);
    const chartHeight = 150;

    return (
        <View style={styles.container}>
            <View style={[styles.chartArea, { height: chartHeight }]}>
                {data.map((item, index) => {
                    const barHeight = (item.amount / maxAmount) * chartHeight;
                    return (
                        <View key={`${item.label}-${index}`} style={styles.column}>
                            <View style={styles.barContainer}>
                                <MotiView
                                    from={{ height: 0, opacity: 0 }}
                                    animate={{ height: barHeight, opacity: 1 }}
                                    transition={{ type: 'timing', duration: 600, delay: index * 50 }}
                                    style={[styles.bar, { backgroundColor: color }]}
                                />
                            </View>
                            <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
                            <Text style={styles.amountText}>
                                {item.amount > 1000
                                    ? `${(item.amount / 1000).toFixed(1)}k`
                                    : Math.round(item.amount)}
                            </Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 20,
        paddingHorizontal: 10,
        backgroundColor: '#fff',
        borderRadius: 12,
    },
    empty: {
        padding: 24,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: '#94a3b8',
    },
    chartArea: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        width: '100%',
    },
    column: {
        flex: 1,
        alignItems: 'center',
        marginHorizontal: 2,
    },
    barContainer: {
        height: '100%',
        width: '100%',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginBottom: 8,
    },
    bar: {
        width: '80%',
        minWidth: 8,
        borderRadius: 4,
    },
    label: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: '600',
        textAlign: 'center',
    },
    amountText: {
        fontSize: 9,
        color: '#94a3b8',
        marginTop: 2,
    },
});
