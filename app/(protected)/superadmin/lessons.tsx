import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, ScrollView, StyleSheet, Alert, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from 'tamagui';
import { ExternalLink, Music } from '@tamagui/lucide-icons';
import { listDocuments, updateDocument, COLLECTIONS, Query, type AppwriteDocument } from '@/lib/appwrite';

type Lesson = {
  day: number;
  title: string;
  summary: string | null;
  mission: string | null;
  audio_url: string | null;
};

export default function SuperadminLessonsScreen() {
  const router = useRouter();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editMission, setEditMission] = useState('');
  const [editAudioUrl, setEditAudioUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const loadLessons = useCallback(async () => {
    const { data } = await listDocuments<AppwriteDocument & { day?: number; title?: string; summary?: string | null; mission?: string | null; audio_url?: string | null }>(
      COLLECTIONS.lessons,
      [Query.limit(50)]
    );
    const rows = [...data]
      .sort((a, b) => {
        const idA = parseInt((a as { $id?: string }).$id ?? '0', 10);
        const idB = parseInt((b as { $id?: string }).$id ?? '0', 10);
        return idA - idB;
      })
      .map((doc) => {
      const id = (doc as { $id?: string }).$id ?? (doc as { id?: string }).id;
      const dayNum = typeof doc.day === 'number' ? doc.day : parseInt(String(id ?? '0'), 10);
      return {
        day: dayNum,
        title: doc.title ?? '',
        summary: doc.summary ?? null,
        mission: doc.mission ?? null,
        audio_url: doc.audio_url ?? null,
      };
    });
    setLessons(rows as Lesson[]);
  }, []);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  function startEdit(lesson: Lesson) {
    setEditing(lesson);
    setEditTitle(lesson.title);
    setEditSummary(lesson.summary ?? '');
    setEditMission(lesson.mission ?? '');
    setEditAudioUrl(lesson.audio_url ?? '');
  }

  function removeAudio() {
    setEditAudioUrl('');
  }

  async function saveLesson() {
    if (!editing) return;
    setSaving(true);
    try {
      await updateDocument(COLLECTIONS.lessons, String(editing.day), {
        title: editTitle.trim() || editing.title,
        summary: editSummary.trim() || null,
        mission: editMission.trim() || null,
        audio_url: editAudioUrl.trim() || null,
      });
    } catch (err) {
      setSaving(false);
      Alert.alert('Error', err instanceof Error ? err.message : 'Error al guardar');
      return;
    }
    setSaving(false);
    setEditing(null);
    await loadLessons();
  }

  function openCloudinary() {
    Linking.openURL('https://console.cloudinary.com/');
  }

  if (editing) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.editContainer}>
        <Text style={styles.editTitle}>Editar lección día {editing.day}</Text>
        <TextInput
          style={styles.input}
          placeholder="Título"
          value={editTitle}
          onChangeText={setEditTitle}
          editable={!saving}
        />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Resumen"
          value={editSummary}
          onChangeText={setEditSummary}
          multiline
          editable={!saving}
        />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Misión"
          value={editMission}
          onChangeText={setEditMission}
          multiline
          editable={!saving}
        />
        
        <Text style={styles.label}>Audio de la lección</Text>
        <Text style={styles.hint}>
          Sube el audio a Cloudinary y pega aquí la URL directa del archivo.
        </Text>
        
        <View style={styles.audioUrlContainer}>
          <TextInput
            style={[styles.input, styles.audioUrlInput]}
            placeholder="https://res.cloudinary.com/..."
            value={editAudioUrl}
            onChangeText={setEditAudioUrl}
            editable={!saving}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          {editAudioUrl ? (
            <View style={styles.audioStatus}>
              <Music size={16} color="#16a34a" />
              <Text style={styles.audioStatusText}>Audio configurado</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.audioActions}>
          <Button 
            theme="gray" 
            size="$2" 
            onPress={openCloudinary}
            icon={<ExternalLink size={14} />}
          >
            Abrir Cloudinary
          </Button>
          {editAudioUrl ? (
            <Button theme="gray" size="$2" onPress={removeAudio} disabled={saving}>
              Quitar audio
            </Button>
          ) : null}
        </View>

        <View style={styles.editActions}>
          <Button theme="blue" onPress={saveLesson} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
          <Button theme="gray" onPress={() => setEditing(null)} disabled={saving}>
            Cancelar
          </Button>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={lessons}
        keyExtractor={(item) => String(item.day)}
        style={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.day}>Día {item.day}</Text>
              {item.audio_url ? (
                <View style={styles.audioIndicator}>
                  <Music size={12} color="#16a34a" />
                  <Text style={styles.audioIndicatorText}>Audio</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.name}>{item.title}</Text>
            {item.summary ? <Text style={styles.summary} numberOfLines={1}>{item.summary}</Text> : null}
            <Button theme="blue" size="$3" onPress={() => startEdit(item)}>
              Editar
            </Button>
          </View>
        )}
      />
      <Button onPress={() => router.back()} theme="gray" size="$3">
        Volver
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  list: { flex: 1 },
  card: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  day: { fontSize: 12, color: '#888' },
  audioIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  audioIndicatorText: { fontSize: 11, color: '#16a34a', fontWeight: '500' },
  name: { fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  summary: { fontSize: 14, color: '#666', marginBottom: 12 },
  editContainer: { padding: 16, paddingBottom: 48 },
  editTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 4, marginTop: 8 },
  hint: { fontSize: 12, color: '#64748b', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  textArea: { minHeight: 72 },
  audioUrlContainer: { marginBottom: 8 },
  audioUrlInput: { marginBottom: 8 },
  audioStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  audioStatusText: { fontSize: 13, color: '#16a34a', fontWeight: '500' },
  audioActions: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  editActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
});
