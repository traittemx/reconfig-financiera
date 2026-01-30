import { View, Text, StyleSheet } from 'react-native';
import { Trophy } from '@tamagui/lucide-icons';
import { usePoints } from '@/contexts/points-context';

export function PointsBadge() {
  const points = usePoints();
  const total = points?.totalPoints ?? 0;

  return (
    <View style={styles.badge}>
      <Trophy size={18} color="#2563eb" />
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
    backgroundColor: '#eff6ff',
    borderRadius: 20,
    marginRight: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
  },
});
