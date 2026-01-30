import { useEffect } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, Platform } from 'react-native';
import { MotiView } from 'moti';
import { Button } from 'tamagui';
import * as Haptics from 'expo-haptics';

interface PointsRewardModalProps {
  visible: boolean;
  points: number;
  message: string;
  onDismiss: () => void;
}

export function PointsRewardModal({ visible, points, message, onDismiss }: PointsRewardModalProps) {
  useEffect(() => {
    if (visible && points > 0 && Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [visible, points]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable style={styles.contentWrapper} onPress={(e) => e.stopPropagation()}>
          <MotiView
            from={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              type: 'timing',
              duration: 350,
              scale: { type: 'spring', damping: 14, stiffness: 150 },
            }}
            style={styles.card}
          >
            <Text style={styles.pointsLabel}>+{points} pts</Text>
            <Text style={styles.message}>{message}</Text>
            <Button
              onPress={onDismiss}
              theme="blue"
              size="$4"
              width="100%"
              marginTop={24}
            >
              ¡Genial!
            </Button>
          </MotiView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 320,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#fbbf24',
  },
  pointsLabel: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 8,
  },
  message: {
    fontSize: 18,
    color: '#334155',
    textAlign: 'center',
    fontWeight: '500',
  },
});
