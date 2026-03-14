import { MotiView } from 'moti';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface BudgetProgressBarProps {
    categoryName: string;
    spent: number;
    limit: number;
    color?: string;
}

export const BudgetProgressBar: React.FC<BudgetProgressBarProps> = ({
    categoryName,
    spent,
    limit,
    color = '#6366f1'
}) => {
    const percentage = Math.min((spent / limit) * 100, 100);
    const isOverBudget = spent > limit;
    const remaining = limit - spent;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.categoryName}>{categoryName}</Text>
                <Text style={[styles.amount, isOverBudget && styles.overBudgetAmount]}>
                    {spent.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} / {limit.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                </Text>
            </View>

            <View style={styles.barBackground}>
                <MotiView
                    from={{ width: '0%' }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ type: 'timing', duration: 1000, delay: 200 }}
                    style={[
                        styles.barForeground,
                        { backgroundColor: isOverBudget ? '#ef4444' : color }
                    ]}
                />
            </View>

            <View style={styles.footer}>
                <Text style={styles.percentageText}>{percentage.toFixed(0)}% gastado</Text>
                <Text style={[styles.remainingText, isOverBudget && styles.overBudgetText]}>
                    {isOverBudget
                        ? `Excedido por ${(spent - limit).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}`
                        : `Quedan ${remaining.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}`
                    }
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    categoryName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
    },
    amount: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
    },
    overBudgetAmount: {
        color: '#ef4444',
    },
    barBackground: {
        height: 8,
        backgroundColor: '#f1f5f9',
        borderRadius: 4,
        overflow: 'hidden',
    },
    barForeground: {
        height: '100%',
        borderRadius: 4,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 6,
    },
    percentageText: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '500',
    },
    remainingText: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
    },
    overBudgetText: {
        color: '#ef4444',
    },
});
