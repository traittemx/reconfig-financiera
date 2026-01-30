import { View, Text, StyleSheet } from 'react-native';
import type { PilotDayState, PilotRecommendation } from '@/types/pilot';

const STATE_LABELS: Record<PilotDayState, string> = {
  SAFE: 'Hoy con calma',
  CAUTION: 'Ve con calma',
  CONTAINMENT: 'Solo lo esencial',
  REWARD: 'Un gusto pequeño',
};

const STATE_COLORS: Record<PilotDayState, { bg: string; border: string; label: string }> = {
  SAFE: { bg: '#ecfdf5', border: '#10b981', label: '#047857' },
  CAUTION: { bg: '#fffbeb', border: '#f59e0b', label: '#b45309' },
  CONTAINMENT: { bg: '#fef2f2', border: '#ef4444', label: '#b91c1c' },
  REWARD: { bg: '#eff6ff', border: '#2563eb', label: '#1d4ed8' },
};

interface PilotCardProps {
  recommendation: PilotRecommendation;
  compact?: boolean;
}

export function PilotCard({ recommendation, compact = false }: PilotCardProps) {
  const colors = STATE_COLORS[recommendation.state];
  const label = STATE_LABELS[recommendation.state];

  if (compact) {
    return (
      <View style={[styles.card, styles.compact, { backgroundColor: colors.bg, borderLeftColor: colors.border }]}>
        <Text style={[styles.labelCompact, { color: colors.label }]}>{label}</Text>
        <Text style={styles.messageCompact} numberOfLines={2}>{recommendation.message_main}</Text>
        <Text style={styles.whyCompact} numberOfLines={1}>{recommendation.message_why}</Text>
        {recommendation.suggested_action ? (
          <Text style={styles.actionCompact}>{recommendation.suggested_action}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.bg, borderLeftColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.label }]}>{label}</Text>
      <Text style={styles.messageMain}>{recommendation.message_main}</Text>
      <Text style={styles.messageWhy}>{recommendation.message_why}</Text>
      {recommendation.suggested_action ? (
        <Text style={styles.action}>{recommendation.suggested_action}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 16,
    borderLeftWidth: 4,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  compact: {
    padding: 16,
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  labelCompact: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  messageMain: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    lineHeight: 26,
    marginBottom: 8,
  },
  messageCompact: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    lineHeight: 24,
    marginBottom: 6,
  },
  messageWhy: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 10,
  },
  whyCompact: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 6,
  },
  action: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  actionCompact: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },
});
