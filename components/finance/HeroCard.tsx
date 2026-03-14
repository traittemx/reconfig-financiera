import { Eye, EyeOff } from '@tamagui/lucide-icons';
import { MotiView } from 'moti';
import * as React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CircularProgress } from './CircularProgress';

interface HeroCardProps {
    balance: number;
    income: number;
    expense: number;
    debt?: number;
    loading?: boolean;
    showBalance?: boolean;
    onToggleShowBalance?: () => void;
}

export function HeroCard({ balance, income, expense, debt = 0, loading, showBalance = true, onToggleShowBalance }: HeroCardProps) {
    const projectedBalance = balance; // In a real scenario, this might involve more logic
    const projectedExpense = expense; // Simplification
    const remaining = projectedBalance - projectedExpense;
    const percentage = projectedBalance > 0 ? (remaining / projectedBalance) * 100 : 0;

    const formatCurrency = (val: number) => {
        return val.toLocaleString('es-MX', {
            style: 'currency',
            currency: 'MXN',
            minimumFractionDigits: 2,
        });
    };

    return (
        <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ duration: 500 }}
            style={styles.container}
        >
            <View style={styles.card}>
                <View style={styles.topRow}>
                    <View style={styles.labelsColumn}>
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Dinero Disponible</Text>
                            <Text style={styles.statValue}>
                                {showBalance ? formatCurrency(balance) : '••••••'}
                            </Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Compromisos (TC)</Text>
                            <Text style={[styles.statValue, { color: '#ef4444' }]}>
                                {showBalance ? formatCurrency(debt) : '••••••'}
                            </Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Gasto Proyectado</Text>
                            <Text style={styles.statValue}>
                                {showBalance ? formatCurrency(projectedExpense) : '••••••'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.progressContainer}>
                        <CircularProgress
                            size={140}
                            strokeWidth={12}
                            percentage={percentage}
                            color="#e2e8f0" // Success green normally, but Neko uses a light gray for the circle base and green/dots for progress?
                            remainingText="Restante"
                            amountText={showBalance ? formatCurrency(remaining) : '••••'}
                        />
                    </View>
                </View>

                <TouchableOpacity style={styles.periodSelector} activeOpacity={0.7}>
                    <Text style={styles.periodText}>Este mes</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.visibilityToggle}
                    onPress={onToggleShowBalance}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    {showBalance ? <Eye size={18} color="#94a3b8" /> : <EyeOff size={18} color="#94a3b8" />}
                </TouchableOpacity>
            </View>
        </MotiView>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginBottom: 24,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
        position: 'relative',
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    labelsColumn: {
        flex: 1,
        gap: 16,
    },
    statItem: {
        gap: 2,
    },
    statLabel: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
    },
    statValue: {
        fontSize: 15,
        color: '#1e293b',
        fontWeight: '700',
    },
    progressContainer: {
        paddingLeft: 10,
    },
    periodSelector: {
        backgroundColor: '#f0f9ff', // Light blue background for the "Este mes" pill
        borderRadius: 12,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    periodText: {
        color: '#0ea5e9',
        fontSize: 14,
        fontWeight: '600',
    },
    statValueDebt: {
        fontSize: 15,
        color: '#ef4444',
        fontWeight: '700',
    },
    visibilityToggle: {
        position: 'absolute',
        top: 24,
        right: 24,
        zIndex: 10,
    },
});
