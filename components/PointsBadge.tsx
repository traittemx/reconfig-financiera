import { View, Text, StyleSheet } from 'react-native';
import { Trophy } from '@tamagui/lucide-icons';
import { usePoints } from '@/contexts/points-context';

export function PointsBadge() {
  const points = usePoints();
  const total = points?.totalPoints ?? 0;

  return (
    <View style={styles.badge}>
      <Trophy size={18} color="#0d9488" />
      <Text style={styles.text}>{total} pts</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(13, 148, 136, 0.12)',
    borderRadius: 20,
    marginRight: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f766e',
  },
});
