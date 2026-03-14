import { MotiView } from 'moti';
import React from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type HistoryDataPoint = {
    label: string;
    amount: number;
    fullDate?: string;
};

type Props = {
    data: HistoryDataPoint[];
    color: string;
    kind: 'EXPENSE' | 'INCOME';
};

export function HistoryChart({ data, color, kind }: Props) {
    if (!data || data.length === 0) {
        return (
            <View style={styles.empty}>
                <Text style={styles.emptyText}>No hay datos para mostrar</Text>
            </View>
        );
    }

    const maxVal = Math.max(...data.map(d => d.amount), 1);
    const chartHeight = 180;
    const barWidth = data.length > 7 ? 40 : (SCREEN_WIDTH - 60) / data.length;

    return (
        <View style={styles.container}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                <View style={[styles.chartWrapper, { height: chartHeight + 40 }]}>
                    <View style={styles.barsContainer}>
                        {data.map((item, index) => {
                            const barHeight = (item.amount / maxVal) * chartHeight;

                            return (
                                <View key={`${item.label}-${index}`} style={[styles.column, { width: barWidth }]}>
                                    <View style={styles.barTrack}>
                                        <MotiView
                                            from={{ height: 0, opacity: 0 }}
                                            animate={{ height: barHeight, opacity: 1 }}
                                            transition={{ type: 'timing', duration: 600, delay: index * 40 }}
                                            style={[styles.bar, { backgroundColor: color }]}
                                        />
                                    </View>
                                    <Text style={styles.label} numberOfLines={1}>
                                        {item.label}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </View>
            </ScrollView>

            <View style={styles.summary}>
                <Text style={styles.summaryLabel}>Total {kind === 'EXPENSE' ? 'Gastado' : 'Recibido'}</Text>
                <Text style={[styles.summaryAmount, { color }]}>
                    ${data.reduce((sum, d) => sum + d.amount, 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 10,
    },
    scrollContent: {
        paddingHorizontal: 10,
    },
    chartWrapper: {
        flexDirection: 'column',
        justifyContent: 'flex-end',
    },
    barsContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: '100%',
    },
    column: {
        alignItems: 'center',
        height: '100%',
        justifyContent: 'flex-end',
    },
    barTrack: {
        flex: 1,
        width: '60%',
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
        justifyContent: 'flex-end',
        overflow: 'hidden',
        marginBottom: 8,
    },
    bar: {
        width: '100%',
        borderRadius: 8,
    },
    label: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: '600',
        textAlign: 'center',
    },
    empty: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#94a3b8',
        fontSize: 14,
    },
    summary: {
        marginTop: 24,
        padding: 16,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    summaryAmount: {
        fontSize: 18,
        fontWeight: '800',
    },
});
