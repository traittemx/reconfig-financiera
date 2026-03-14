import Slider from '@react-native-community/slider';
import { Pause, Play } from '@tamagui/lucide-icons';
import { Audio } from 'expo-av';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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

        <TouchableOpacity
          style={styles.playerMain}
          onPress={togglePlayPause}
          activeOpacity={0.7}
        >
          <View style={styles.playButton}>
            {isPlaying ? (
              <Pause size={24} color="#fff" fill="#fff" strokeWidth={2.5} />
            ) : (
              <Play size={24} color="#fff" fill="#fff" strokeWidth={2.5} style={{ marginLeft: 2 }} />
            )}
          </View>

          <View style={styles.statusContainer}>
            <Text style={styles.statusTitle}>
              {isPlaying ? 'Reproduciendo...' : 'Audio Pausado'}
            </Text>
            <Text style={styles.statusSubtitle}>
              {isPlaying ? 'Escuchando la clase' : 'Presiona para reproducir'}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.sliderSection}>
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
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(position)}</Text>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#3b82f6',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 20,
    opacity: 0.9,
  },
  playerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 20,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  statusContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2,
    letterSpacing: -0.4,
  },
  statusSubtitle: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  sliderSection: {
    paddingHorizontal: 4,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    fontVariant: ['tabular-nums'],
  },
  loadingText: { fontSize: 14, color: '#64748b', textAlign: 'center', padding: 24 },
  errorText: { fontSize: 14, color: '#dc2626', textAlign: 'center', padding: 24 },
});
