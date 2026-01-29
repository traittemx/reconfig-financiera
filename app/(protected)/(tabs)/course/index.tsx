import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { getDayUnlocked } from '@/lib/business-days';
import { supabase } from '@/lib/supabase';

type Lesson = { day: number; title: string; summary: string | null };
type Progress = { day: number; completed_at: string | null };

export default function CourseListScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<Record<number, string | null>>({});
  const dayUnlocked = profile?.start_date
    ? getDayUnlocked(new Date(profile.start_date))
    : 0;

  useEffect(() => {
    (async () => {
      const { data: l } = await supabase.from('lessons').select('day, title, summary').order('day');
      if (l) setLessons(l);
      if (!profile?.id) return;
      const { data: p } = await supabase
        .from('user_lesson_progress')
        .select('day, completed_at')
        .eq('user_id', profile.id);
      const map: Record<number, string | null> = {};
      (p ?? []).forEach((r: Progress) => (map[r.day] = r.completed_at));
      setProgress(map);
    })();
  }, [profile?.id]);

  function getStatus(day: number) {
    if (day > dayUnlocked) return 'locked';
    if (progress[day]) return 'completed';
    return 'unlocked';
  }

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>
        Día desbloqueado: {dayUnlocked} de 23 (solo días hábiles)
      </Text>
      <FlatList
        data={lessons}
        keyExtractor={(item) => String(item.day)}
        renderItem={({ item }) => {
          const status = getStatus(item.day);
          return (
            <TouchableOpacity
              style={[
                styles.row,
                status === 'locked' && styles.rowLocked,
              ]}
              onPress={() => {
                if (status === 'locked') return;
                router.push(`/(tabs)/course/${item.day}`);
              }}
              disabled={status === 'locked'}
            >
              <Text style={styles.day}>Día {item.day}</Text>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.badge}>
                {status === 'completed' ? 'Completado' : status === 'unlocked' ? 'Disponible' : 'Bloqueado'}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  subtitle: { marginBottom: 16, color: '#666', fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 12,
  },
  rowLocked: { opacity: 0.6 },
  day: { fontWeight: 'bold', width: 48 },
  title: { flex: 1 },
  badge: { fontSize: 12, color: '#666' },
});
