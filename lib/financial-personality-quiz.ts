import type { QuizQuestion, PersonalityScores, QuizResult, PersonalityType } from '@/types/financial-personality';

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: 'Cuando recibes dinero extra (bono, regalo, etc.), lo primero que haces es:',
    options: {
      A: 'Lo asigno a ahorro o metas específicas',
      B: 'Me doy un gusto inmediato',
      C: 'Lo guardo "por si acaso"',
      D: 'Compro algo que se note o eleve mi estatus',
    },
  },
  {
    id: 2,
    question: 'Antes de comprar algo caro tú:',
    options: {
      A: 'Comparas precios y analizas opciones',
      B: 'Compras si te emociona',
      C: 'Dudas mucho, aunque lo necesites',
      D: 'Piensas en cómo se verá o qué dirán',
    },
  },
  {
    id: 3,
    question: 'Tu relación con el presupuesto es:',
    options: {
      A: 'Lo sigues al pie de la letra',
      B: 'Lo intentas, pero lo rompes seguido',
      C: 'Te hace sentir seguro',
      D: 'Te parece limitante y aburrido',
    },
  },
  {
    id: 4,
    question: 'Cuando ves una oferta "por tiempo limitado":',
    options: {
      A: 'Evalúas si realmente lo necesitas',
      B: 'Compras antes de que se acabe',
      C: 'Te da ansiedad y dudas',
      D: 'Aprovechas para comprar algo llamativo',
    },
  },
  {
    id: 5,
    question: 'Comprar cosas nuevas te hace sentir:',
    options: {
      A: 'Tranquilo si estaba planeado',
      B: 'Emocionado',
      C: 'Nervioso o culpable',
      D: 'Importante o exitoso',
    },
  },
  {
    id: 6,
    question: 'Tu estado de cuenta idealmente debería:',
    options: {
      A: 'Cuadrar exactamente con tus registros',
      B: 'No mirarlo muy seguido',
      C: 'Tener siempre un colchón grande',
      D: 'Reflejar que "te va bien"',
    },
  },
  {
    id: 7,
    question: 'Si pierdes dinero inesperadamente:',
    options: {
      A: 'Ajustas el plan',
      B: 'Te frustras y gastas para sentirte mejor',
      C: 'Te angustias mucho',
      D: 'Buscas compensarlo con algo visible',
    },
  },
  {
    id: 8,
    question: 'Para ti, ahorrar significa:',
    options: {
      A: 'Una estrategia',
      B: 'Algo que harás después',
      C: 'Seguridad y alivio',
      D: 'Dinero que podrías estar disfrutando',
    },
  },
  {
    id: 9,
    question: 'Cuando alguien gana más que tú:',
    options: {
      A: 'Analizas qué puedes aprender',
      B: 'Te comparas y te frustras',
      C: 'Te preocupa tu futuro',
      D: 'Sientes presión por "alcanzar" su nivel',
    },
  },
  {
    id: 10,
    question: 'Tu historial de compras impulsivas es:',
    options: {
      A: 'Muy bajo',
      B: 'Frecuente',
      C: 'Casi nulo, por miedo',
      D: 'Frecuente en cosas visibles',
    },
  },
  {
    id: 11,
    question: 'Al pensar en el futuro financiero:',
    options: {
      A: 'Tienes metas claras',
      B: 'Prefieres no pensarlo mucho',
      C: 'Te genera ansiedad',
      D: 'Imaginas un estilo de vida alto',
    },
  },
  {
    id: 12,
    question: 'Cuando te sientes estresado tú:',
    options: {
      A: 'Reorganizas tus finanzas',
      B: 'Compras algo',
      C: 'Te paralizas',
      D: 'Te das un "premio" costoso',
    },
  },
  {
    id: 13,
    question: 'Si tuvieras que describirte financieramente:',
    options: {
      A: 'Precavido',
      B: 'Emocional',
      C: 'Conservador',
      D: 'Ambicioso',
    },
  },
  {
    id: 14,
    question: 'Para ti el dinero es principalmente:',
    options: {
      A: 'Una herramienta',
      B: 'Un medio para disfrutar',
      C: 'Un respaldo',
      D: 'Un símbolo de éxito',
    },
  },
  {
    id: 15,
    question: 'Cuando alguien te critica por gastar:',
    options: {
      A: 'Revisas si tiene razón',
      B: 'Te justificas',
      C: 'Te sientes culpable',
      D: 'Lo ignoras',
    },
  },
  {
    id: 16,
    question: 'En una decisión financiera importante tú:',
    options: {
      A: 'Buscas datos',
      B: 'Sigues tu intuición',
      C: 'Postergas la decisión',
      D: 'Piensas en el impacto social',
    },
  },
  {
    id: 17,
    question: 'Tu peor miedo financiero es:',
    options: {
      A: 'Tomar malas decisiones',
      B: 'Perder oportunidades',
      C: 'Quedarte sin dinero',
      D: '"No ser suficiente"',
    },
  },
  {
    id: 18,
    question: 'Si tu dinero hablara diría que tú:',
    options: {
      A: 'Lo controlas',
      B: 'Lo disfrutas',
      C: 'Lo proteges',
      D: 'Lo usas para destacar',
    },
  },
  {
    id: 19,
    question: 'Cuando ganas más dinero del esperado:',
    options: {
      A: 'Ajustas tus objetivos',
      B: 'Gastas más',
      C: 'Ahorras más',
      D: 'Subes tu nivel de vida',
    },
  },
  {
    id: 20,
    question: 'La frase que más resuena contigo es:',
    options: {
      A: '"Lo que no se mide, no se mejora"',
      B: '"La vida es hoy"',
      C: '"Más vale prevenir que lamentar"',
      D: '"Hay que vivir bien"',
    },
  },
];

/**
 * Calcula los puntajes basados en las respuestas del quiz.
 * Cada respuesta suma 1 punto a la personalidad correspondiente:
 * A → Analítico
 * B → Impulsivo
 * C → Temeroso
 * D → Derrochador
 */
export function calculateScores(answers: ('A' | 'B' | 'C' | 'D')[]): PersonalityScores {
  const scores: PersonalityScores = {
    analitico: 0,
    impulsivo: 0,
    temeroso: 0,
    derrochador: 0,
  };

  answers.forEach((answer) => {
    switch (answer) {
      case 'A':
        scores.analitico += 1;
        break;
      case 'B':
        scores.impulsivo += 1;
        break;
      case 'C':
        scores.temeroso += 1;
        break;
      case 'D':
        scores.derrochador += 1;
        break;
    }
  });

  return scores;
}

/**
 * Determina la personalidad dominante y secundaria basada en los puntajes.
 */
export function determinePersonality(scores: PersonalityScores): QuizResult {
  const entries = Object.entries(scores) as [PersonalityType, number][];
  
  // Ordenar por puntaje descendente
  entries.sort((a, b) => b[1] - a[1]);
  
  const dominant = entries[0][0];
  const secondary = entries[1][1] > 0 && entries[1][1] === entries[0][1] ? null : entries[1][0];
  
  return {
    dominant,
    secondary: secondary && secondary !== dominant ? secondary : null,
    scores,
  };
}

/**
 * Interpreta un puntaje según los rangos:
 * 0-6: Rasgo bajo
 * 7-12: Rasgo presente
 * 13-20: Rasgo dominante
 */
export function interpretScore(score: number): 'bajo' | 'presente' | 'dominante' {
  if (score <= 6) return 'bajo';
  if (score <= 12) return 'presente';
  return 'dominante';
}
