import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Audio } from 'expo-av';
import Slider from '@react-native-community/slider';
import { Play, Pause } from '@tamagui/lucide-icons';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type Props = {
  audioUrl: string | null;
};

export function LessonAudioPlayer({ audioUrl }: Props) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!audioUrl?.trim()) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        const { sound: s } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: false }
        );
        if (!mounted) {
          s.unloadAsync();
          return;
        }
        const status = await s.getStatusAsync();
        if (status.isLoaded && status.durationMillis) {
          setDuration(status.durationMillis / 1000);
        }
        s.setOnPlaybackStatusUpdate((st) => {
          if (st.isLoaded) {
            setPosition(st.positionMillis / 1000);
            if (st.durationMillis) setDuration(st.durationMillis / 1000);
            setIsPlaying(st.isPlaying);
          }
        });
        setSound(s);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'No se pudo cargar el audio');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [audioUrl]);

  useEffect(() => {
    if (!sound) return;
    return () => {
      sound.unloadAsync();
    };
  }, [sound]);

  async function togglePlayPause() {
    if (!sound) return;
    try {
      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        if (status.isPlaying) {
          await sound.pauseAsync();
        } else {
          await sound.playAsync();
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al reproducir');
    }
  }

  function onValueChange(value: number) {
    setPosition(value);
  }

  async function onSlidingComplete(value: number) {
    if (!sound) return;
    try {
      await sound.setPositionAsync(value * 1000);
    } catch {
      // ignore
    }
  }

  if (!audioUrl?.trim()) return null;
  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando audio...</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Escucha la lección</Text>
        <Pressable
          style={({ pressed }) => [styles.playButton, pressed && styles.playButtonPressed]}
          onPress={togglePlayPause}
        >
          {isPlaying ? (
            <Pause size={36} color="#fff" strokeWidth={2.5} />
          ) : (
            <Play size={36} color="#fff" strokeWidth={2.5} style={{ marginLeft: 4 }} />
          )}
        </Pressable>
        <Text style={styles.statusText}>{isPlaying ? 'Reproduciendo' : 'Pausado'}</Text>
        <View style={styles.sliderRow}>
          <Text style={styles.timeText}>{formatTime(position)}</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={duration || 1}
            value={position}
            onValueChange={onValueChange}
            onSlidingComplete={onSlidingComplete}
            minimumTrackTintColor="#2563eb"
            maximumTrackTintColor="#e2e8f0"
            thumbTintColor="#2563eb"
          />
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 24 },
  card: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 24,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 4 },
      web: { boxShadow: '0 2px 12px rgba(0,0,0,0.08)' },
    }),
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
    textAlign: 'center',
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  playButtonPressed: { opacity: 0.85 },
  statusText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  slider: { flex: 1, height: 40 },
  timeText: { fontSize: 12, color: '#64748b', minWidth: 36 },
  loadingText: { fontSize: 14, color: '#64748b', textAlign: 'center', padding: 24 },
  errorText: { fontSize: 14, color: '#dc2626', textAlign: 'center', padding: 24 },
});
