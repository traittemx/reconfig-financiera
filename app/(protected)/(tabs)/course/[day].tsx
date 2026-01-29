import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from 'tamagui';
import { useAuth } from '@/contexts/auth-context';
import { addBusinessDays } from 'date-fns';
import { getDayUnlocked } from '@/lib/business-days';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type Lesson = { day: number; title: string; summary: string | null; mission: string | null; content: Record<string, unknown> };

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
      const { data } = await supabase.from('lessons').select('*').eq('day', dayNum).single();
      if (data) setLesson(data);
      if (!profile?.id || !profile.org_id) return;
      const { data: prog } = await supabase
        .from('user_lesson_progress')
        .select('completed_at')
        .eq('user_id', profile.id)
        .eq('day', dayNum)
        .single();
      if (prog) setCompletedAt(prog.completed_at);
    })();
  }, [dayNum, profile?.id, profile?.org_id]);

  async function markComplete() {
    if (!profile?.id || !profile.org_id || completedAt) return;
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from('user_lesson_progress').upsert(
      {
        user_id: profile.id,
        org_id: profile.org_id,
        day: dayNum,
        unlocked_at: now,
        completed_at: now,
      },
      { onConflict: 'user_id,day' }
    );
    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{lesson.title}</Text>
      {lesson.summary && <Text style={styles.summary}>{lesson.summary}</Text>}
      {lesson.mission && (
        <View style={styles.missionBox}>
          <Text style={styles.missionLabel}>Misión</Text>
          <Text style={styles.mission}>{lesson.mission}</Text>
        </View>
      )}
      {completedAt ? (
        <Text style={styles.completed}>Completada</Text>
      ) : (
        <Button theme="blue" onPress={markComplete} disabled={saving}>
          {saving ? 'Guardando...' : 'Marcar como completada'}
        </Button>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  summary: { color: '#555', marginBottom: 16, lineHeight: 22 },
  missionBox: { backgroundColor: '#f0f9ff', padding: 16, borderRadius: 8, marginBottom: 24 },
  missionLabel: { fontWeight: 'bold', marginBottom: 8 },
  mission: { color: '#333' },
  completed: { color: '#16a34a', fontWeight: '600', marginTop: 16 },
  lockedTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  lockedText: { textAlign: 'center', color: '#666', marginBottom: 8 },
  nextText: { textAlign: 'center', color: '#888', marginBottom: 24, fontSize: 14 },
});
