import { LessonAudioPlayer } from '@/components/course/LessonAudioPlayer';
import { PointsRewardModal } from '@/components/PointsRewardModal';
import { useAuth } from '@/contexts/auth-context';
import { usePoints } from '@/contexts/points-context';
import {
  COLLECTIONS,
  createDocument,
  getDocument,
  ID,
  listDocuments,
  Query,
  updateDocument,
  type AppwriteDocument,
} from '@/lib/appwrite';
import { getDayUnlocked, getUnlockDateForLesson, parseLocalDateString } from '@/lib/business-days';
import { awardPoints } from '@/lib/points';
import { CheckCircle2, ChevronLeft, PenLine, Sparkles, Target } from '@tamagui/lucide-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MotiView } from 'moti';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Button } from 'tamagui';

type Lesson = { id: number; day: number; title: string; summary: string | null; mission: string | null; audio_url: string | null };

/** En web usamos View con onClick (el div recibe el clic). En móvil TouchableOpacity. */
function CompleteButton({
  onPress,
  disabled,
  label,
}: {
  onPress: () => void;
  disabled: boolean;
  label: string;
}) {
  const handlePress = () => {
    if (!disabled) onPress();
  };

  if (Platform.OS === 'web') {
    return (
      <View
        style={[styles.completeButton, disabled && styles.completeButtonDisabled, styles.completeButtonWeb]}
        {...({ onMouseDown: handlePress } as Record<string, unknown>)}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
      >
        <Text style={styles.completeButtonText}>{label}</Text>
      </View>
    );
  }
  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[styles.completeButton, disabled && styles.completeButtonDisabled]}
    >
      <Text style={styles.completeButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function LessonScreen() {
  const { day } = useLocalSearchParams<{ day: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const pointsContext = usePoints();
  const dayNum = parseInt(day ?? '1', 10);
  const dayUnlocked = profile?.start_date ? getDayUnlocked(parseLocalDateString(profile.start_date)) : 0;
  const isLocked = dayNum > dayUnlocked || dayNum < 1 || dayNum > 23;
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [rewardToShow, setRewardToShow] = useState<{ points: number; message: string } | null>(null);

  useEffect(() => {
    if (!dayNum || dayNum < 1 || dayNum > 23) return;
    (async () => {
      try {
        const doc = await getDocument<AppwriteDocument>(COLLECTIONS.lessons, String(dayNum));
        setLesson({
          id: doc.id as number,
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
        setNotes((prog?.notes as string) ?? '');
      } catch { }
    })();
  }, [dayNum, profile?.id, profile?.org_id]);

  async function markComplete() {
    if (completedAt) return;
    if (!profile?.id || !profile.org_id) {
      Alert.alert(
        'No se puede guardar',
        'Tu perfil o organización no está cargada. Cierra sesión y vuelve a entrar, o intenta más tarde.'
      );
      return;
    }
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
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
          day: dayNum,
          lesson_id: lesson?.id,
          unlocked_at: now,
          completed_at: now,
          notes: notes.trim() || '',
        });
      } else {
        await createDocument(
          COLLECTIONS.user_lesson_progress,
          {
            user_id: profile.id,
            org_id: profile.org_id,
            day: dayNum,
            lesson_id: lesson?.id,
            unlocked_at: now,
            completed_at: now,
            notes: notes.trim() || '',
          },
          ID.unique()
        );
      }
      const earnedPoints = await awardPoints(
        profile.org_id,
        profile.id,
        'LESSON_COMPLETED',
        'user_lesson_progress',
        String(dayNum)
      );
      if (earnedPoints > 0) {
        setRewardToShow({ points: earnedPoints, message: '¡Lección completada!' });
      }
    } catch (e) {
      setSaving(false);
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo guardar.');
      return;
    }
    setSaving(false);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
    }
    setCompletedAt(now);
  }

  async function saveNotes() {
    if (!profile?.id || !profile.org_id || saving) return;
    setSaving(true);
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
          day: dayNum,
          lesson_id: lesson?.id,
          notes: notes.trim() || '',
        });
      } else {
        await createDocument(
          COLLECTIONS.user_lesson_progress,
          {
            user_id: profile.id,
            org_id: profile.org_id,
            day: dayNum,
            lesson_id: lesson?.id,
            unlocked_at: new Date().toISOString(),
            completed_at: null,
            notes: notes.trim() || '',
          },
          ID.unique()
        );
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudieron guardar las notas.');
    } finally {
      setSaving(false);
    }
  }

  if (isLocked) {
    const startDate = profile?.start_date ? parseLocalDateString(profile.start_date) : null;
    const unlockDate = startDate ? getUnlockDateForLesson(startDate, dayNum) : null;
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push('/course')}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ChevronLeft size={24} color="#0f172a" strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Lección</Text>
        </View>
        <Text style={styles.lockedTitle}>Lección bloqueada</Text>
        <Text style={styles.lockedText}>
          Se desbloquea el próximo día hábil (Lunes a Viernes).
        </Text>
        {unlockDate && (
          <Text style={styles.nextText}>
            Se desbloquea: {format(unlockDate, "EEEE d 'de' MMMM", { locale: es })}
          </Text>
        )}
        <Button onPress={() => router.push('/course')}>Atrás</Button>
      </View>
    );
  }

  if (!lesson) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push('/course')}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ChevronLeft size={24} color="#0f172a" strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Lección</Text>
        </View>
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  const summaryParagraphs = lesson.summary?.split(/\n\n+/) ?? [];
  const missionParagraphs = lesson.mission?.split(/\n\n+/) ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push('/course')}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft size={24} color="#0f172a" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lección</Text>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
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
          <View style={styles.missionCard}>
            <View style={styles.missionHeader}>
              <View style={styles.missionIconBadge}>
                <Target size={18} color="#2563eb" strokeWidth={2.5} />
              </View>
              <Text style={styles.missionLabel}>Misión del día</Text>
            </View>
            <View style={styles.missionContent}>
              {missionParagraphs.length > 0 ? (
                missionParagraphs.map((para, i) => (
                  <Text key={i} style={[styles.missionText, i < missionParagraphs.length - 1 && styles.missionParagraph]}>
                    {para}
                  </Text>
                ))
              ) : (
                <Text style={styles.missionText}>{lesson.mission}</Text>
              )}
            </View>
          </View>
        ) : null}

        <View style={styles.notesSection}>
          <View style={styles.notesHeader}>
            <View style={styles.notesIconBadge}>
              <PenLine size={16} color="#64748b" strokeWidth={2.5} />
            </View>
            <Text style={styles.notesLabel}>Mis Notas</Text>
          </View>
          <TextInput
            style={styles.notesInput}
            placeholder="Escribe tus reflexiones aquí..."
            placeholderTextColor="#94a3b8"
            value={notes}
            onChangeText={setNotes}
            onBlur={completedAt ? saveNotes : undefined}
            multiline
          />
        </View>
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
        ) : null}
      </ScrollView>
      {/* Botón flotante: en web usa <button> nativo para que el clic funcione */}
      {!completedAt ? (
        <View style={styles.floatingButtonWrap} pointerEvents="box-none">
          <View style={styles.floatingButtonInner}>
            <CompleteButton
              onPress={() => markComplete()}
              disabled={saving}
              label={saving ? 'Guardando...' : 'Marcar como completada'}
            />
          </View>
        </View>
      ) : null}
      <PointsRewardModal
        visible={rewardToShow !== null}
        points={rewardToShow?.points ?? 0}
        message={rewardToShow?.message ?? ''}
        onDismiss={() => {
          setRewardToShow(null);
          pointsContext?.refresh();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fdfdfe' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 48 : 32, // More standard padding
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backButton: {
    padding: 8,
    marginRight: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  loadingText: { padding: 24, color: '#64748b', textAlign: 'center' },
  scrollView: { flex: 1 },
  content: {
    padding: 20,
    paddingBottom: 160,
    flexGrow: 1,
  },
  floatingButtonWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 30, // Brought slightly higher
    backgroundColor: 'transparent',
    zIndex: 1000,
  },
  floatingButtonInner: {
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 8,
    borderRadius: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 16,
    color: '#0f172a',
    lineHeight: 30,
    letterSpacing: -0.6,
  },
  summaryBlock: {
    marginBottom: 20,
  },
  summary: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 24,
  },
  summaryParagraph: { marginBottom: 12 },

  missionCard: {
    backgroundColor: '#f0f7ff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  missionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  missionIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 1,
  },
  missionLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e40af',
  },
  missionContent: {
    paddingLeft: 2,
  },
  missionText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 22,
  },
  missionParagraph: { marginBottom: 10 },

  notesSection: {
    marginBottom: 20,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  notesIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  notesInput: {
    minHeight: 120,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#f1f5f9',
    color: '#0f172a',
    fontSize: 15,
    textAlignVertical: 'top',
  },

  completedCard: {
    marginTop: 10,
    backgroundColor: '#f0fdf4',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#dcfce7',
  },
  completedIconWrap: {
    marginBottom: 16,
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: 20,
  },
  completedTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#14532d',
    marginBottom: 6,
    textAlign: 'center',
  },
  completedSubtitle: {
    fontSize: 15,
    color: '#166534',
    marginBottom: 20,
    textAlign: 'center',
    opacity: 0.8,
  },
  completedSparkle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  completedSparkleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400e',
  },

  completeButton: {
    backgroundColor: '#2563eb',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonWeb: {
    cursor: 'pointer',
  },
  completeButtonDisabled: {
    opacity: 0.6,
  },
  completeButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  lockedTitle: { fontSize: 22, fontWeight: '900', marginBottom: 12, textAlign: 'center', color: '#0f172a', paddingTop: 40 },
  lockedText: { textAlign: 'center', color: '#64748b', marginBottom: 12, fontSize: 16, paddingHorizontal: 40 },
  nextText: { textAlign: 'center', color: '#94a3b8', marginBottom: 32, fontSize: 14, fontWeight: '600' },
});
