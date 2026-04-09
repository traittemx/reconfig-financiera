import { Check, Eye, EyeOff } from '@tamagui/lucide-icons';
import { MotiView } from 'moti';
import * as React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface HeroCardProps {
  balance: number;
  income: number;
  expense: number;
  debt?: number;
  loading?: boolean;
  showBalance?: boolean;
  onToggleShowBalance?: () => void;
}

const TEAL = '#14b8a6';
const ORANGE = '#fb923c';
const NAVY = '#0f172a';

function SquiggleDown() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 6c4 0 4 8 8 8s4-8 8-8"
        stroke={TEAL}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function SquiggleUp() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 18c4 0 4-8 8-8s4 8 8 8"
        stroke={ORANGE}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function HeroCard({
  balance,
  income,
  expense,
  debt: _debt,
  showBalance = true,
  onToggleShowBalance,
}: HeroCardProps) {
  const formatCurrency = (val: number) => {
    return val.toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
    });
  };

  const savingsPct =
    income > 0 ? Math.max(0, Math.min(100, Math.round(((income - expense) / income) * 100))) : 0;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ duration: 450 }}
      style={styles.container}
    >
      <View style={styles.card}>
        <View style={styles.topRow}>
          <Text style={styles.balanceTotalLabel}>BALANCE TOTAL</Text>
          <View style={styles.topRight}>
            <View style={styles.pctBadge}>
              <Check size={14} color={TEAL} strokeWidth={3} />
              <Text style={styles.pctText}>{savingsPct}%</Text>
            </View>
            <TouchableOpacity
              onPress={onToggleShowBalance}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={showBalance ? 'Ocultar saldo' : 'Mostrar saldo'}
            >
              {showBalance ? <Eye size={20} color="rgba(255,255,255,0.85)" /> : <EyeOff size={20} color="rgba(255,255,255,0.55)" />}
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.mainBalance} numberOfLines={1} adjustsFontSizeToFit>
          {showBalance ? formatCurrency(balance) : '••••••'}
        </Text>

        <View style={styles.divider} />

        <View style={styles.splitRow}>
          <View style={styles.splitCol}>
            <View style={styles.splitHead}>
              <SquiggleDown />
              <Text style={styles.splitLabel}>INGRESOS</Text>
            </View>
            <Text style={styles.incomeAmount}>{showBalance ? formatCurrency(income) : '••••'}</Text>
          </View>
          <View style={styles.vLine} />
          <View style={styles.splitCol}>
            <View style={styles.splitHead}>
              <SquiggleUp />
              <Text style={[styles.splitLabel, { color: 'rgba(255,255,255,0.75)' }]}>GASTOS</Text>
            </View>
            <Text style={styles.expenseAmount}>{showBalance ? formatCurrency(expense) : '••••'}</Text>
          </View>
        </View>
      </View>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 20,
  },
  card: {
    backgroundColor: NAVY,
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceTotalLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.65)',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pctBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pctText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  mainBalance: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 18,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  splitCol: {
    flex: 1,
    alignItems: 'flex-start',
  },
  splitHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  splitLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.55)',
  },
  incomeAmount: {
    fontSize: 17,
    fontWeight: '800',
    color: TEAL,
  },
  expenseAmount: {
    fontSize: 17,
    fontWeight: '800',
    color: ORANGE,
  },
  vLine: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 14,
  },
});
