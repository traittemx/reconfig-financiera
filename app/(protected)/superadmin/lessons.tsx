import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from 'tamagui';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '@/lib/supabase';

const BUCKET = 'lesson-audios';

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
  const [editAudioUrl, setEditAudioUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadLessons = useCallback(async () => {
    const { data } = await supabase.from('lessons').select('day, title, summary, mission, audio_url').order('day');
    setLessons((data ?? []) as Lesson[]);
  }, []);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  function startEdit(lesson: Lesson) {
    setEditing(lesson);
    setEditTitle(lesson.title);
    setEditSummary(lesson.summary ?? '');
    setEditMission(lesson.mission ?? '');
    setEditAudioUrl(lesson.audio_url);
  }

  async function pickAndUploadAudio() {
    if (!editing) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/m4a'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      setUploading(true);
      const ext = file.name?.split('.').pop() ?? 'mp3';
      const path = `${editing.day}.${ext}`;
      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const byteChars = atob(base64);
      const byteNumbers = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteNumbers], { type: file.mimeType ?? 'audio/mpeg' });
      const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: file.mimeType ?? 'audio/mpeg',
        upsert: true,
      });
      setUploading(false);
      if (error) {
        Alert.alert('Error al subir', error.message);
        return;
      }
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      setEditAudioUrl(urlData.publicUrl);
    } catch (e) {
      setUploading(false);
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo seleccionar el archivo');
    }
  }

  function removeAudio() {
    setEditAudioUrl(null);
  }

  async function saveLesson() {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from('lessons')
      .update({
        title: editTitle.trim() || editing.title,
        summary: editSummary.trim() || null,
        mission: editMission.trim() || null,
        audio_url: editAudioUrl,
      })
      .eq('day', editing.day);
    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setEditing(null);
    await loadLessons();
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
        {editAudioUrl ? (
          <View style={styles.audioSection}>
            <Text style={styles.audioStatus} numberOfLines={1}>Audio cargado</Text>
            <Button theme="gray" size="$2" onPress={removeAudio} disabled={saving || uploading}>
              Eliminar audio
            </Button>
          </View>
        ) : (
          <Button theme="blue" onPress={pickAndUploadAudio} disabled={saving || uploading}>
            {uploading ? 'Subiendo...' : 'Subir audio'}
          </Button>
        )}
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
            <Text style={styles.day}>Día {item.day}</Text>
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
  day: { fontSize: 12, color: '#888', marginBottom: 4 },
  name: { fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  summary: { fontSize: 14, color: '#666', marginBottom: 12 },
  editContainer: { padding: 16, paddingBottom: 48 },
  editTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  textArea: { minHeight: 72 },
  audioSection: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  audioStatus: { flex: 1, color: '#16a34a', fontSize: 14 },
  editActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
});
