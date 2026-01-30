import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

const DEFAULT_SIZE = 88;
const STROKE_WIDTH = 8;

type Props = {
  progressPct: number;
  currentAmount: number;
  targetAmount: number;
  label: string;
  size?: number;
};

export function SavingsGoalProgress({
  progressPct,
  currentAmount,
  targetAmount,
  label,
  size = DEFAULT_SIZE,
}: Props) {
  const radius = (size - STROKE_WIDTH) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPct = Math.min(100, Math.max(0, progressPct));
  const strokeDashoffset = circumference * (1 - clampedPct / 100);

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke="#e2e8f0"
          strokeWidth={STROKE_WIDTH}
          fill="transparent"
        />
        <G rotation={-90} originX={cx} originY={cy}>
          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke="#0d9488"
            strokeWidth={STROKE_WIDTH}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={styles.pctText} numberOfLines={1}>
          {Math.round(clampedPct)}%
        </Text>
        <Text style={styles.amountText} numberOfLines={1}>
          {currentAmount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })}
        </Text>
        <Text style={styles.targetText} numberOfLines={1}>
          / {targetAmount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })}
        </Text>
      </View>
      {label ? <Text style={styles.label} numberOfLines={1}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pctText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  amountText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  targetText: {
    fontSize: 10,
    color: '#94a3b8',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginTop: 8,
    textAlign: 'center',
  },
});
