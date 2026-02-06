import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from 'tamagui';
import { MotiView } from 'moti';
import { useAuth } from '@/contexts/auth-context';
import {
  ARCHETYPE_LABELS,
  ARCHETYPE_COLORS,
  ARCHETYPE_DESCRIPTIONS,
  type ArchetypeType,
  type ArchetypeScores,
} from '@/types/financial-archetype';
import { interpretScore } from '@/lib/financial-archetype-quiz';
import {
  COLLECTIONS,
  Query,
  listDocuments,
  type AppwriteDocument,
} from '@/lib/appwrite';

export default function FinancialArchetypeResultsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const params = useLocalSearchParams<{
    dominant?: string | string[];
    secondary?: string | string[];
    tertiary?: string | string[];
    scores?: string | string[];
  }>();

  // Normalizar params (en web pueden venir como array)
  const dominantParam = Array.isArray(params.dominant) ? params.dominant[0] : params.dominant;
  const secondaryParam = Array.isArray(params.secondary) ? params.secondary[0] : params.secondary;
  const tertiaryParam = Array.isArray(params.tertiary) ? params.tertiary[0] : params.tertiary;
  const scoresParam = Array.isArray(params.scores) ? params.scores[0] : params.scores;

  const [dominant, setDominant] = useState<ArchetypeType | null>(
    (dominantParam as ArchetypeType) || null
  );
  const [secondary, setSecondary] = useState<ArchetypeType | null>(
    (secondaryParam as ArchetypeType) || null
  );
  const [tertiary, setTertiary] = useState<ArchetypeType | null>(
    (tertiaryParam as ArchetypeType) || null
  );
  const [scores, setScores] = useState<ArchetypeScores | null>(() => {
    if (!scoresParam) return null;
    try {
      return JSON.parse(scoresParam) as ArchetypeScores;
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
            COLLECTIONS.financial_archetype_results,
            [Query.equal('user_id', [profile.id]), Query.limit(1)]
          );
          if (cancelled) return;
          if (results[0]) {
            const result = results[0];
            setDominant(result.dominant_archetype as ArchetypeType);
            setSecondary((result.secondary_archetype as ArchetypeType) || null);
            setTertiary((result.tertiary_archetype as ArchetypeType) || null);
            setScores(JSON.parse(result.scores as string) as ArchetypeScores);
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
      setLoading(false);
    }
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
          <Button
            theme="blue"
            size="$4"
            onPress={() => router.push('/(tabs)/profile')}
            style={{ marginTop: 16 }}
          >
            Volver al Perfil
          </Button>
        </View>
      </View>
    );
  }

  const dominantInfo = ARCHETYPE_DESCRIPTIONS[dominant];
  const dominantColor = ARCHETYPE_COLORS[dominant];
  const maxScore = Math.max(...Object.values(scores));

  // Ordenar arquetipos por score para mostrar en el gráfico
  const sortedArchetypes = (Object.keys(scores) as ArchetypeType[]).sort(
    (a, b) => scores[b] - scores[a]
  );

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Dominant Archetype Card */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400 }}
        >
          <View style={[styles.dominantCard, { borderLeftColor: dominantColor }]}>
            <View style={styles.dominantHeader}>
              <View style={[styles.dominantBadge, { backgroundColor: dominantColor }]}>
                <Text style={styles.dominantBadgeText}>{ARCHETYPE_LABELS[dominant]}</Text>
              </View>
            </View>
            <Text style={styles.dominantTitle}>Tu Arquetipo Financiero</Text>
            <Text style={styles.dominantDescription}>{dominantInfo.description}</Text>
            {(secondary || tertiary) && (
              <View style={styles.secondaryContainer}>
                {secondary && (
                  <View style={styles.secondaryBadge}>
                    <Text style={styles.secondaryLabel}>
                      También presente: {ARCHETYPE_LABELS[secondary]}
                    </Text>
                  </View>
                )}
                {tertiary && (
                  <View style={styles.secondaryBadge}>
                    <Text style={styles.secondaryLabel}>
                      Y también: {ARCHETYPE_LABELS[tertiary]}
                    </Text>
                  </View>
                )}
              </View>
            )}
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
              Distribución de tus respuestas en cada arquetipo
            </Text>

            {sortedArchetypes.map((archetype, index) => {
              const score = scores[archetype];
              const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
              const color = ARCHETYPE_COLORS[archetype];
              const isDominant = archetype === dominant;
              const isSecondary = archetype === secondary;
              const isTertiary = archetype === tertiary;
              const interpretation = interpretScore(score);

              return (
                <MotiView
                  key={archetype}
                  from={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ type: 'timing', duration: 500, delay: 200 + index * 80 }}
                  style={styles.scoreRow}
                >
                  <View style={styles.scoreLabelRow}>
                    <View style={[styles.scoreDot, { backgroundColor: color }]} />
                    <Text style={styles.scoreLabel}>{ARCHETYPE_LABELS[archetype]}</Text>
                    {isDominant && <Text style={styles.dominantTag}>Dominante</Text>}
                    {isSecondary && <Text style={styles.secondaryTag}>Secundario</Text>}
                    {isTertiary && <Text style={styles.tertiaryTag}>Terciario</Text>}
                    {!isDominant && !isSecondary && !isTertiary && (
                      <Text style={styles.interpretationTag}>
                        {interpretation === 'bajo'
                          ? 'Bajo'
                          : interpretation === 'activo'
                          ? 'Activo'
                          : 'Dominante'}
                      </Text>
                    )}
                  </View>
                  <View style={styles.barContainer}>
                    <View style={styles.barTrack}>
                      <MotiView
                        from={{ opacity: 0, scaleX: 0 }}
                        animate={{ opacity: 1, scaleX: 1 }}
                        transition={{
                          type: 'timing',
                          duration: 600,
                          delay: 300 + index * 80,
                        }}
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
              Tu arquetipo financiero refleja cómo usas el dinero como expresión de identidad,
              valores y poder personal. No eres solo un arquetipo; tienes uno dominante y otros que
              te influyen.
            </Text>
            <Text style={styles.infoText}>
              Reconocer estos patrones te ayuda a entender tus comportamientos financieros y
              trabajar en equilibrarlos para alcanzar tus metas.
            </Text>
            <Text style={styles.infoText}>
              <Text style={styles.boldText}>Rangos:</Text> 0-5 (Influencia baja), 6-10 (Influencia
              activa), 11-20 (Arquetipo dominante)
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
  secondaryContainer: {
    marginTop: 16,
    gap: 8,
  },
  secondaryBadge: {
    paddingTop: 8,
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
    marginBottom: 18,
  },
  scoreLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
    flexWrap: 'wrap',
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
  secondaryTag: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tertiaryTag: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f59e0b',
    backgroundColor: '#fffbeb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  interpretationTag: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    backgroundColor: '#f1f5f9',
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
  boldText: {
    fontWeight: '700',
  },
  backButton: {
    marginTop: 8,
  },
});
