import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from 'tamagui';
import { MotiView } from 'moti';
import { useAuth } from '@/contexts/auth-context';
import { QUIZ_QUESTIONS, calculateScores, determinePersonality } from '@/lib/financial-personality-quiz';
import { createDocument, COLLECTIONS } from '@/lib/appwrite';
import type { PersonalityScores } from '@/types/financial-personality';

export default function FinancialPersonalityQuizScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<(('A' | 'B' | 'C' | 'D') | null)[]>(new Array(20).fill(null));
  const [selectedAnswer, setSelectedAnswer] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [saving, setSaving] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [finishError, setFinishError] = useState<string | null>(null);

  useEffect(() => {
    // Cargar respuesta previa si existe
    if (answers[currentQuestion] !== null) {
      setSelectedAnswer(answers[currentQuestion]);
    } else {
      setSelectedAnswer(null);
    }
  }, [currentQuestion]);

  function handleAnswerSelect(answer: 'A' | 'B' | 'C' | 'D') {
    setFinishError(null);
    setSelectedAnswer(answer);
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answer;
    setAnswers(newAnswers);
  }

  async function handleNext() {
    setFinishError(null);
    if (selectedAnswer === null) {
      Alert.alert('Selecciona una opción', 'Por favor elige una respuesta antes de continuar.');
      return;
    }

    if (currentQuestion < QUIZ_QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      await handleFinish();
    }
  }

  function handlePrevious() {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  }

  async function handleFinish() {
    if (!profile?.id || !profile.org_id) {
      const msg = 'No se pudo cargar tu perfil. Vuelve a intentar.';
      setFinishError(msg);
      Alert.alert('Error', msg);
      return;
    }

    // Usar respuestas efectivas: incluir la selección actual por si el state no ha actualizado aún (ej. al pulsar Finalizar justo después de elegir)
    const effectiveAnswers = answers.map((a, i) =>
      i === currentQuestion && selectedAnswer !== null ? selectedAnswer : a
    ) as ('A' | 'B' | 'C' | 'D')[];

    if (effectiveAnswers.some((a) => a === null)) {
      const msg = 'Responde todas las preguntas antes de finalizar.';
      setFinishError(msg);
      Alert.alert('Preguntas incompletas', msg);
      return;
    }

    setFinishError(null);
    setSaving(true);

    try {
      // Calcular puntajes y determinar personalidad
      const scores = calculateScores(effectiveAnswers);
      const result = determinePersonality(scores);

      // Guardar en Appwrite
      const now = new Date().toISOString();
      await createDocument(
        COLLECTIONS.financial_personality_results,
        {
          user_id: profile.id,
          org_id: profile.org_id,
          dominant_personality: result.dominant,
          secondary_personality: result.secondary || '',
          scores: JSON.stringify(scores),
          completed_at: now,
          created_at: now,
        },
        profile.id // Usar user_id como document ID para garantizar unicidad
      );

      // Navegar a resultados (sin params para evitar URLs largas; la pantalla carga desde Appwrite)
      router.replace('/(tabs)/financial-personality-results');
    } catch (error: unknown) {
      console.error('Error saving quiz results:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      // Si el error es porque ya existe un resultado, navegar a resultados existentes
      if (errorMessage.includes('already exists') || errorMessage.includes('duplicate')) {
        router.replace('/(tabs)/financial-personality-results');
        return;
      }
      
      Alert.alert('Error', `No se pudieron guardar los resultados: ${errorMessage}`);
      setSaving(false);
    }
  }

  if (showIntro) {
    return (
      <View style={styles.wrapper}>
        <ScrollView style={styles.container} contentContainerStyle={styles.introContent}>
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400 }}
          >
            <Text style={styles.introTitle}>Descubre tu Personalidad Financiera</Text>
            
            <View style={styles.introCard}>
              <Text style={styles.introSectionTitle}>¿Qué es la personalidad financiera?</Text>
              <Text style={styles.introText}>
                La personalidad financiera es la forma en la que te relacionas con el dinero a nivel emocional, mental y conductual. Define cómo ganas, gastas, ahorras y tomas decisiones financieras, muchas veces de manera inconsciente.
              </Text>
              <Text style={styles.introText}>
                No tiene que ver con cuánto dinero tienes, sino con cómo lo usas y cómo te hace sentir. Está influida por tu historia familiar, creencias, experiencias pasadas y emociones.
              </Text>
              
              <Text style={styles.introSectionTitle}>¿Qué descubrirás?</Text>
              <Text style={styles.introText}>
                Conocer tu personalidad financiera te permite:
              </Text>
              <Text style={styles.introBullet}>• Entender por qué tomas ciertas decisiones con el dinero</Text>
              <Text style={styles.introBullet}>• Detectar hábitos que te benefician o te sabotean</Text>
              <Text style={styles.introBullet}>• Crear estrategias financieras que realmente se adapten a ti</Text>
              
              <Text style={styles.introNote}>
                No hay personalidades "buenas" o "malas", pero sí comportamientos que, si no se gestionan, pueden limitar tu estabilidad y crecimiento financiero.
              </Text>
            </View>

            <Button
              theme="blue"
              size="$4"
              onPress={() => setShowIntro(false)}
              style={styles.startButton}
            >
              Comenzar Quiz
            </Button>
          </MotiView>
        </ScrollView>
      </View>
    );
  }

  if (saving) {
    return (
      <View style={styles.wrapper}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Calculando tus resultados...</Text>
        </View>
      </View>
    );
  }

  const question = QUIZ_QUESTIONS[currentQuestion];
  const progress = ((currentQuestion + 1) / QUIZ_QUESTIONS.length) * 100;

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>
            Pregunta {currentQuestion + 1} de {QUIZ_QUESTIONS.length}
          </Text>
        </View>

        {/* Question Card */}
        <MotiView
          key={currentQuestion}
          from={{ opacity: 0, translateX: 20 }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ type: 'timing', duration: 300 }}
          style={styles.questionCard}
        >
          <Text style={styles.questionText}>{question.question}</Text>
        </MotiView>

        {/* Answer Options */}
        <View style={styles.optionsContainer}>
          {(['A', 'B', 'C', 'D'] as const).map((option) => (
            <MotiView
              key={option}
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 300, delay: option.charCodeAt(0) - 65 * 50 }}
            >
              <Button
                theme={selectedAnswer === option ? 'blue' : 'gray'}
                size="$4"
                onPress={() => handleAnswerSelect(option)}
                style={[
                  styles.optionButton,
                  selectedAnswer === option && styles.optionButtonSelected,
                ]}
                width="100%"
              >
                <View style={styles.optionContent}>
                  <View style={[
                    styles.optionLetter,
                    selectedAnswer === option && styles.optionLetterSelected,
                  ]}>
                    <Text style={[
                      styles.optionLetterText,
                      selectedAnswer === option && styles.optionLetterTextSelected,
                    ]}>
                      {option}
                    </Text>
                  </View>
                  <Text style={[
                    styles.optionText,
                    selectedAnswer === option && styles.optionTextSelected,
                  ]}>
                    {question.options[option]}
                  </Text>
                </View>
              </Button>
            </MotiView>
          ))}
        </View>

        {/* Navigation Buttons */}
        <View style={styles.navigationContainer}>
          {currentQuestion > 0 && (
            <Button
              theme="gray"
              size="$4"
              onPress={handlePrevious}
              style={styles.navButton}
              flex={1}
            >
              Anterior
            </Button>
          )}
          <Button
            theme="blue"
            size="$4"
            onPress={() => void handleNext()}
            style={styles.navButton}
            flex={currentQuestion === 0 ? 1 : 1}
            disabled={selectedAnswer === null}
          >
            {currentQuestion === QUIZ_QUESTIONS.length - 1 ? 'Finalizar' : 'Siguiente'}
          </Button>
        </View>
        {finishError ? (
          <Text style={styles.finishErrorText}>{finishError}</Text>
        ) : null}
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
  introContent: {
    padding: 24,
    paddingTop: 40,
  },
  introTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 24,
    textAlign: 'center',
  },
  introCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  introSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 20,
    marginBottom: 12,
  },
  introText: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 24,
    marginBottom: 16,
  },
  introBullet: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 24,
    marginBottom: 8,
    marginLeft: 8,
  },
  introNote: {
    fontSize: 15,
    color: '#64748b',
    fontStyle: 'italic',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  startButton: {
    marginTop: 8,
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  questionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0f172a',
    lineHeight: 28,
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  optionButton: {
    marginBottom: 0,
  },
  optionButtonSelected: {
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderTopColor: '#2563eb',
    borderRightColor: '#2563eb',
    borderBottomColor: '#2563eb',
    borderLeftColor: '#2563eb',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  optionLetter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionLetterSelected: {
    backgroundColor: '#2563eb',
  },
  optionLetterText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748b',
  },
  optionLetterTextSelected: {
    color: '#fff',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#334155',
    lineHeight: 22,
  },
  optionTextSelected: {
    color: '#0f172a',
    fontWeight: '600',
  },
  navigationContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  navButton: {
    marginBottom: 0,
  },
  finishErrorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
});
