import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from 'tamagui';
import { MotiView } from 'moti';
import { useAuth } from '@/contexts/auth-context';
import {
  PERSONALITY_LABELS,
  PERSONALITY_COLORS,
  PERSONALITY_DESCRIPTIONS,
  type PersonalityType,
  type PersonalityScores,
} from '@/types/financial-personality';
import { COLLECTIONS, Query, listDocuments, type AppwriteDocument } from '@/lib/appwrite';

export default function FinancialPersonalityResultsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const params = useLocalSearchParams<{
    dominant?: string | string[];
    secondary?: string | string[];
    scores?: string | string[];
  }>();

  // Normalizar params (en web pueden venir como array)
  const dominantParam = Array.isArray(params.dominant) ? params.dominant[0] : params.dominant;
  const secondaryParam = Array.isArray(params.secondary) ? params.secondary[0] : params.secondary;
  const scoresParam = Array.isArray(params.scores) ? params.scores[0] : params.scores;

  const [dominant, setDominant] = useState<PersonalityType | null>(
    (dominantParam as PersonalityType) || null
  );
  const [secondary, setSecondary] = useState<PersonalityType | null>(
    (secondaryParam as PersonalityType) || null
  );
  const [scores, setScores] = useState<PersonalityScores | null>(() => {
    if (!scoresParam) return null;
    try {
      return JSON.parse(scoresParam) as PersonalityScores;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(!dominantParam);

  useEffect(() => {
    // Si no hay parámetros, cargar desde la base de datos
    if (!dominantParam && profile?.id) {
      let cancelled = false;
      (async () => {
        try {
          const { data: results } = await listDocuments<AppwriteDocument>(
            COLLECTIONS.financial_personality_results,
            [Query.equal('user_id', [profile.id]), Query.limit(1)]
          );
          if (cancelled) return;
          if (results[0]) {
            const result = results[0];
            setDominant(result.dominant_personality as PersonalityType);
            setSecondary((result.secondary_personality as PersonalityType) || null);
            setScores(JSON.parse(result.scores as string) as PersonalityScores);
          }
        } catch (error) {
          if (!cancelled) console.error('Error loading results:', error);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => { cancelled = true; };
    } else if (dominantParam) {
      setLoading(false);
    } else if (profile !== undefined && profile !== null) {
      // profile cargado pero sin id, o sin params
      setLoading(false);
    }
    // Si profile es null/undefined (cargando), mantener loading
  }, [dominantParam, profile?.id, profile]);

  if (loading) {
    return (
      <View style={styles.wrapper}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando resultados...</Text>
        </View>
      </View>
    );
  }

  if (!dominant || !scores) {
    return (
      <View style={styles.wrapper}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No se encontraron resultados del quiz.</Text>
          <Button theme="blue" size="$4" onPress={() => router.push('/(tabs)/profile')} style={{ marginTop: 16 }}>
            Volver al Perfil
          </Button>
        </View>
      </View>
    );
  }

  const dominantInfo = PERSONALITY_DESCRIPTIONS[dominant];
  const dominantColor = PERSONALITY_COLORS[dominant];
  const maxScore = Math.max(...Object.values(scores));

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Dominant Personality Card */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400 }}
        >
          <View style={[styles.dominantCard, { borderLeftColor: dominantColor }]}>
            <View style={styles.dominantHeader}>
              <View style={[styles.dominantBadge, { backgroundColor: dominantColor }]}>
                <Text style={styles.dominantBadgeText}>{PERSONALITY_LABELS[dominant]}</Text>
              </View>
              {secondary && (
                <Text style={styles.secondaryLabel}>
                  También presente: {PERSONALITY_LABELS[secondary]}
                </Text>
              )}
            </View>
            <Text style={styles.dominantTitle}>Tu Personalidad Financiera</Text>
            <Text style={styles.dominantDescription}>{dominantInfo.description}</Text>
          </View>
        </MotiView>

        {/* Scores Chart */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 100 }}
        >
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Tus Puntajes</Text>
            <Text style={styles.chartSubtitle}>
              Distribución de tus respuestas en cada personalidad
            </Text>
            
            {(Object.keys(scores) as PersonalityType[]).map((personality, index) => {
              const score = scores[personality];
              const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
              const color = PERSONALITY_COLORS[personality];
              const isDominant = personality === dominant;
              
              return (
                <MotiView
                  key={personality}
                  from={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ type: 'timing', duration: 500, delay: 200 + index * 100 }}
                  style={styles.scoreRow}
                >
                  <View style={styles.scoreLabelRow}>
                    <View style={[styles.scoreDot, { backgroundColor: color }]} />
                    <Text style={styles.scoreLabel}>{PERSONALITY_LABELS[personality]}</Text>
                    {isDominant && <Text style={styles.dominantTag}>Dominante</Text>}
                  </View>
                  <View style={styles.barContainer}>
                    <View style={styles.barTrack}>
                      <MotiView
                        from={{ opacity: 0, scaleX: 0 }}
                        animate={{ opacity: 1, scaleX: 1 }}
                        transition={{ type: 'timing', duration: 600, delay: 300 + index * 100 }}
                        style={[
                          styles.barFill,
                          { backgroundColor: color, width: `${Math.min(percentage, 100)}%` },
                        ]}
                      />
                    </View>
                    <Text style={[styles.scoreValue, { color }]}>{score}/20</Text>
                  </View>
                </MotiView>
              );
            })}
          </View>
        </MotiView>

        {/* Interpretation Info */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 200 }}
        >
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>¿Qué significa esto?</Text>
            <Text style={styles.infoText}>
              Tu personalidad financiera refleja cómo te relacionas con el dinero de manera inconsciente. 
              Conocerla te ayuda a entender tus decisiones y crear estrategias que realmente funcionen para ti.
            </Text>
            <Text style={styles.infoText}>
              Recuerda: no hay personalidades "buenas" o "malas". Lo importante es reconocer tus patrones 
              y trabajar con ellos para alcanzar tus metas financieras.
            </Text>
          </View>
        </MotiView>

        {/* Back Button */}
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 400, delay: 300 }}
        >
          <Button
            theme="blue"
            size="$4"
            onPress={() => router.push('/(tabs)/profile')}
            style={styles.backButton}
          >
            Volver al Perfil
          </Button>
        </MotiView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    ...(Platform.OS === 'web' && { minHeight: '100%' }),
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  dominantCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  dominantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  dominantBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  dominantBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  secondaryLabel: {
    fontSize: 14,
    color: '#64748b',
    fontStyle: 'italic',
  },
  dominantTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
  },
  dominantDescription: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 24,
  },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
  },
  scoreRow: {
    marginBottom: 20,
  },
  scoreLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  scoreDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  scoreLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  dominantTag: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  barTrack: {
    flex: 1,
    height: 28,
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 14,
  },
  scoreValue: {
    fontSize: 15,
    fontWeight: '700',
    minWidth: 50,
    textAlign: 'right',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 12,
  },
  backButton: {
    marginTop: 8,
  },
});
