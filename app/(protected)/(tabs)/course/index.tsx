import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, CirclePlay, CheckCircle2 } from '@tamagui/lucide-icons';
import { useAuth } from '@/contexts/auth-context';
import { getDayUnlocked } from '@/lib/business-days';
import { supabase } from '@/lib/supabase';

type Lesson = { day: number; title: string; summary: string | null };
type Progress = { day: number; completed_at: string | null };

const COLORS = {
  locked: { bg: '#f8fafc', border: '#e2e8f0', text: '#64748b', icon: '#94a3b8' },
  unlocked: { bg: '#ecfdf5', border: '#a7f3d0', accent: '#059669', text: '#047857', badgeBg: '#059669' },
  completed: { bg: '#eff6ff', border: '#bfdbfe', accent: '#2563eb', text: '#1d4ed8', badgeBg: '#2563eb' },
} as const;

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
      {lessons.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Cargando lecciones...</Text>
        </View>
      ) : (
      <FlatList
        data={lessons}
        keyExtractor={(item) => String(item.day)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const status = getStatus(item.day);
          const c = status === 'completed' ? COLORS.completed : status === 'unlocked' ? COLORS.unlocked : COLORS.locked;
          const isLocked = status === 'locked';
          return (
            <TouchableOpacity
              style={[
                styles.row,
                { backgroundColor: c.bg, borderLeftColor: status === 'locked' ? c.border : c.accent, borderLeftWidth: 4 },
                isLocked && styles.rowLocked,
              ]}
              onPress={() => {
                if (isLocked) return;
                router.push(`/(tabs)/course/${item.day}`);
              }}
              disabled={isLocked}
              activeOpacity={isLocked ? 1 : 0.7}
            >
              <View style={styles.dayIconRow}>
                {status === 'locked' && <Lock size={20} color={c.icon} style={styles.rowIcon} />}
                {status === 'unlocked' && <CirclePlay size={22} color={c.accent} style={styles.rowIcon} />}
                {status === 'completed' && <CheckCircle2 size={22} color={c.accent} style={styles.rowIcon} />}
                <Text style={[styles.day, status !== 'locked' && { color: c.text }]}>Día {item.day}</Text>
              </View>
              <Text style={[styles.title, status !== 'locked' && { color: '#0f172a' }]} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={[styles.badge, status !== 'locked' && { backgroundColor: c.badgeBg }]}>
                <Text style={[styles.badgeText, status === 'locked' && styles.badgeTextMuted]}>
                  {status === 'completed' ? 'Completado' : status === 'unlocked' ? 'Disponible' : 'Bloqueado'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f1f5f9' },
  subtitle: { marginBottom: 16, color: '#475569', fontSize: 14 },
  listContent: { paddingBottom: 24 },
  empty: { flex: 1, justifyContent: 'center', padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#666' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 10,
    borderRadius: 12,
    borderLeftWidth: 4,
    gap: 12,
    minHeight: 64,
  },
  rowLocked: { opacity: 0.85 },
  rowIcon: { marginRight: 4 },
  dayIconRow: { flexDirection: 'row', alignItems: 'center', width: 72 },
  day: { fontWeight: '700', fontSize: 15, color: '#64748b' },
  title: { flex: 1, fontSize: 15, color: '#475569' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
  },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  badgeTextMuted: { color: '#64748b' },
});
