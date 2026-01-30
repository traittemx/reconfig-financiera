import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from 'tamagui';
import { MotiView } from 'moti';
import { CheckCircle2, Sparkles } from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/auth-context';
import { addBusinessDays } from 'date-fns';
import { getDayUnlocked } from '@/lib/business-days';
import {
  getDocument,
  listDocuments,
  createDocument,
  updateDocument,
  COLLECTIONS,
  Query,
  ID,
  type AppwriteDocument,
} from '@/lib/appwrite';
import { awardPoints } from '@/lib/points';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { LessonAudioPlayer } from '@/components/course/LessonAudioPlayer';

type Lesson = { day: number; title: string; summary: string | null; mission: string | null; audio_url: string | null };

export default function LessonScreen() {
  const { day } = useLocalSearchParams<{ day: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const dayNum = parseInt(day ?? '1', 10);
  const dayUnlocked = profile?.start_date ? getDayUnlocked(new Date(profile.start_date)) : 0;
  const isLocked = dayNum > dayUnlocked || dayNum < 1 || dayNum > 23;
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dayNum || dayNum < 1 || dayNum > 23) return;
    (async () => {
      try {
        const doc = await getDocument<AppwriteDocument>(COLLECTIONS.lessons, String(dayNum));
        setLesson({
          day: dayNum,
          title: (doc.title as string) ?? '',
          summary: (doc.summary as string | null) ?? null,
          mission: (doc.mission as string | null) ?? null,
          audio_url: (doc.audio_url as string | null) ?? null,
        });
      } catch {
        setLesson(null);
      }
      if (!profile?.id || !profile.org_id) return;
      try {
        const { data: progList } = await listDocuments<AppwriteDocument>(
          COLLECTIONS.user_lesson_progress,
          [
            Query.equal('user_id', [profile.id]),
            Query.equal('day', [String(dayNum)]),
            Query.limit(1),
          ]
        );
        const prog = progList[0];
        if (prog?.completed_at) setCompletedAt(prog.completed_at as string);
      } catch {}
    })();
  }, [dayNum, profile?.id, profile?.org_id]);

  async function markComplete() {
    if (!profile?.id || !profile.org_id || completedAt) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setSaving(true);
    const now = new Date().toISOString();
    try {
      const { data: existing } = await listDocuments<AppwriteDocument>(
        COLLECTIONS.user_lesson_progress,
        [
          Query.equal('user_id', [profile.id]),
          Query.equal('day', [String(dayNum)]),
          Query.limit(1),
        ]
      );
      const doc = existing[0];
      if (doc) {
        await updateDocument(COLLECTIONS.user_lesson_progress, (doc as AppwriteDocument).$id!, {
          unlocked_at: now,
          completed_at: now,
        });
      } else {
        await createDocument(
          COLLECTIONS.user_lesson_progress,
          {
            user_id: profile.id,
            org_id: profile.org_id,
            day: String(dayNum),
            unlocked_at: now,
            completed_at: now,
          },
          ID.unique()
        );
      }
      await awardPoints(
        profile.org_id,
        profile.id,
        'LESSON_COMPLETED',
        'user_lesson_progress',
        String(dayNum)
      );
    } catch (e) {
      setSaving(false);
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo guardar.');
      return;
    }
    setSaving(false);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setCompletedAt(now);
  }

  if (isLocked) {
    const startDate = profile?.start_date ? new Date(profile.start_date + 'T12:00:00') : null;
    const unlockDate = startDate ? addBusinessDays(startDate, dayNum - 1) : null;
    return (
      <View style={styles.container}>
        <Text style={styles.lockedTitle}>Lección bloqueada</Text>
        <Text style={styles.lockedText}>
          Se desbloquea el próximo día hábil (Lunes a Viernes).
        </Text>
        {unlockDate && (
          <Text style={styles.nextText}>
            Se desbloquea: {format(unlockDate, "EEEE d 'de' MMMM", { locale: es })}
          </Text>
        )}
        <Button onPress={() => router.back()}>Volver</Button>
      </View>
    );
  }

  if (!lesson) {
    return (
      <View style={styles.container}>
        <Text>Cargando...</Text>
      </View>
    );
  }

  const summaryParagraphs = lesson.summary?.split(/\n\n+/) ?? [];
  const missionParagraphs = lesson.mission?.split(/\n\n+/) ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{lesson.title}</Text>
      {summaryParagraphs.length > 0 ? (
        <View style={styles.summaryBlock}>
          {summaryParagraphs.map((para, i) => (
            <Text key={i} style={[styles.summary, i < summaryParagraphs.length - 1 && styles.summaryParagraph]}>
              {para}
            </Text>
          ))}
        </View>
      ) : null}
      <LessonAudioPlayer audioUrl={lesson.audio_url} />
      {lesson.mission ? (
        <View style={styles.missionBox}>
          <Text style={styles.missionLabel}>Misión</Text>
          {missionParagraphs.length > 0 ? (
            missionParagraphs.map((para, i) => (
              <Text key={i} style={[styles.mission, i < missionParagraphs.length - 1 && styles.missionParagraph]}>
                {para}
              </Text>
            ))
          ) : (
            <Text style={styles.mission}>{lesson.mission}</Text>
          )}
        </View>
      ) : null}
      {completedAt ? (
        <MotiView
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            type: 'timing',
            duration: 400,
            scale: { type: 'spring', damping: 12, stiffness: 120 },
          }}
          style={styles.completedCard}
        >
          <View style={styles.completedIconWrap}>
            <CheckCircle2 size={56} color="#16a34a" strokeWidth={2.5} />
          </View>
          <Text style={styles.completedTitle}>¡Lección completada!</Text>
          <Text style={styles.completedSubtitle}>
            Día {dayNum} listo. Sigue así.
          </Text>
          <View style={styles.completedSparkle}>
            <Sparkles size={20} color="#f59e0b" />
            <Text style={styles.completedSparkleText}>¡Buen trabajo!</Text>
          </View>
        </MotiView>
      ) : (
        <Button
          theme="blue"
          size="$4"
          onPress={markComplete}
          disabled={saving}
          borderRadius={14}
          backgroundColor="#2563eb"
          pressStyle={{ opacity: 0.9, scale: 0.98 }}
          animation="quick"
        >
          {saving ? 'Guardando...' : 'Marcar como completada'}
        </Button>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 12, color: '#0f172a' },
  summaryBlock: { marginBottom: 16 },
  summary: { color: '#475569', lineHeight: 22 },
  summaryParagraph: { marginBottom: 14 },
  missionBox: { backgroundColor: '#eff6ff', padding: 16, borderRadius: 12, marginBottom: 24, borderLeftWidth: 4, borderLeftColor: '#2563eb' },
  missionLabel: { fontWeight: 'bold', marginBottom: 8, color: '#1e40af' },
  mission: { color: '#334155' },
  missionParagraph: { marginBottom: 10 },
  completedCard: {
    marginTop: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#bbf7d0',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  completedIconWrap: {
    marginBottom: 16,
  },
  completedTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#166534',
    marginBottom: 6,
  },
  completedSubtitle: {
    fontSize: 15,
    color: '#15803d',
    marginBottom: 16,
  },
  completedSparkle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  completedSparkleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#b45309',
  },
  lockedTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  lockedText: { textAlign: 'center', color: '#666', marginBottom: 8 },
  nextText: { textAlign: 'center', color: '#888', marginBottom: 24, fontSize: 14 },
});
