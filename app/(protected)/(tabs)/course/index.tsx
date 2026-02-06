import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, CirclePlay, CheckCircle2, Play } from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/auth-context';
import { getDayUnlocked, parseLocalDateString, toLocalDateString } from '@/lib/business-days';
import { listDocuments, updateDocument, COLLECTIONS, Query, type AppwriteDocument } from '@/lib/appwrite';
import { requestNotificationPermissions, scheduleLessonReminders } from '@/lib/notifications';

type Lesson = { day: number; title: string; summary: string | null };
type Progress = { day: number; completed_at: string | null };

const COLORS = {
  locked: { bg: '#fafbfc', border: '#e8ecf0', text: '#6b7280', icon: '#9ca3af' },
  unlocked: { bg: '#f0fdf9', border: '#99d6c4', accent: '#0d9488', text: '#0f766e', badgeBg: '#0d9488' },
  completed: { bg: '#f0fdf4', border: '#86efac', accent: '#22c55e', text: '#15803d', badgeBg: '#22c55e' },
} as const;

export default function CourseListScreen() {
  const router = useRouter();
  const { profile, refresh } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<Record<number, string | null>>({});
  const [starting, setStarting] = useState(false);
  const dayUnlocked = profile?.start_date
    ? getDayUnlocked(parseLocalDateString(profile.start_date))
    : 0;

  useEffect(() => {
    (async () => {
      const { data: l } = await listDocuments<AppwriteDocument>(COLLECTIONS.lessons, [
        Query.limit(50),
      ]);
      if (l?.length) {
        const sorted = [...l].sort((a, b) => {
          const idA = parseInt((a as { $id?: string }).$id ?? '0', 10);
          const idB = parseInt((b as { $id?: string }).$id ?? '0', 10);
          return idA - idB;
        });
        setLessons(
          sorted.map((d) => {
            const doc = d as AppwriteDocument;
            const day = Number(doc.day ?? doc.$id ?? 0);
            return {
              day,
              title: (doc.title as string) ?? '',
              summary: (doc.summary as string | null) ?? null,
            };
          })
        );
      }
      if (!profile?.id) return;
      const { data: p } = await listDocuments<AppwriteDocument>(COLLECTIONS.user_lesson_progress, [
        Query.equal('user_id', [profile.id]),
        Query.limit(100),
      ]);
      const map: Record<number, string | null> = {};
      (p ?? []).forEach((doc) => {
        const d = doc as AppwriteDocument;
        const dayNum = Number(d.day ?? d.$id ?? 0);
        map[dayNum] = (d.completed_at as string | null) ?? null;
      });
      setProgress(map);
    })();
  }, [profile?.id]);

  useEffect(() => {
    if (Platform.OS === 'web' || !profile?.start_date) return;
    scheduleLessonReminders(profile.start_date).catch(() => {});
  }, [profile?.start_date]);

  function getStatus(day: number) {
    if (day > dayUnlocked) return 'locked';
    if (progress[day]) return 'completed';
    return 'unlocked';
  }

  async function handleStartCourse() {
    if (!profile?.id) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setStarting(true);
    try {
      const now = new Date();
      const startDateStr = toLocalDateString(now);
      await updateDocument(COLLECTIONS.profiles, profile.id, {
        start_date: startDateStr,
        updated_at: now.toISOString(),
      });
      await refresh();
      if (Platform.OS !== 'web') {
        const granted = await requestNotificationPermissions();
        if (granted) await scheduleLessonReminders(startDateStr);
      }
    } catch (e) {
      Alert.alert(
        'Error',
        e instanceof Error ? e.message : 'No se pudo iniciar el curso. Intenta de nuevo.'
      );
    } finally {
      setStarting(false);
    }
  }

  return (
    <View style={styles.container}>
      {!profile?.start_date && (
        <TouchableOpacity
          style={[styles.startButton, starting && styles.startButtonDisabled]}
          onPress={handleStartCourse}
          disabled={starting}
          activeOpacity={0.85}
        >
          {starting ? (
            <ActivityIndicator color="#fff" size="small" style={styles.startButtonSpinner} />
          ) : (
            <Play size={22} color="#fff" style={styles.startButtonIcon} />
          )}
          <Text style={styles.startButtonText}>
            {starting ? 'Iniciando...' : 'Iniciar curso'}
          </Text>
        </TouchableOpacity>
      )}
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
              <View style={styles.rowHeader}>
                <View style={styles.dayIconRow}>
                  {status === 'locked' && <Lock size={20} color={c.icon} style={styles.rowIcon} />}
                  {status === 'unlocked' && <CirclePlay size={22} color={c.accent} style={styles.rowIcon} />}
                  {status === 'completed' && <CheckCircle2 size={22} color={c.accent} style={styles.rowIcon} />}
                  <Text style={[styles.day, status !== 'locked' && { color: c.text }]}>Día {item.day}</Text>
                </View>
                <View style={[styles.badge, status !== 'locked' && { backgroundColor: c.badgeBg }]}>
                  <Text style={[styles.badgeText, status === 'locked' && styles.badgeTextMuted]}>
                    {status === 'completed' ? 'Completada' : status === 'unlocked' ? 'Disponible' : 'Bloqueado'}
                  </Text>
                </View>
              </View>
              <Text style={[styles.title, status !== 'locked' && { color: '#0f172a' }]}>
                {item.title}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f8fafc' },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d9488',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginBottom: 20,
    gap: 10,
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  startButtonDisabled: { opacity: 0.8 },
  startButtonIcon: { marginRight: 0 },
  startButtonSpinner: { marginRight: 0 },
  startButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  subtitle: { marginBottom: 20, color: '#64748b', fontSize: 14, fontWeight: '500' },
  listContent: { paddingBottom: 24 },
  empty: { flex: 1, justifyContent: 'center', padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#64748b' },
  row: {
    flexDirection: 'column',
    padding: 18,
    marginBottom: 12,
    borderRadius: 14,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rowLocked: { opacity: 0.9 },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  rowIcon: { marginRight: 8 },
  dayIconRow: { flexDirection: 'row', alignItems: 'center' },
  day: { fontWeight: '700', fontSize: 15, color: '#6b7280' },
  title: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 24,
    letterSpacing: 0.15,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  badgeTextMuted: { color: '#6b7280' },
});
