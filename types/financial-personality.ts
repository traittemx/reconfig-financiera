export type PersonalityType = 'analitico' | 'impulsivo' | 'temeroso' | 'derrochador';

export interface PersonalityScores {
  analitico: number;
  impulsivo: number;
  temeroso: number;
  derrochador: number;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
}

export interface QuizResult {
  dominant: PersonalityType;
  secondary: PersonalityType | null;
  scores: PersonalityScores;
}

export interface FinancialPersonalityResult {
  id: string;
  user_id: string;
  org_id: string;
  dominant_personality: PersonalityType;
  secondary_personality: PersonalityType | null;
  scores: string; // JSON stringified PersonalityScores
  completed_at: string;
  created_at: string;
}

export const PERSONALITY_LABELS: Record<PersonalityType, string> = {
  analitico: 'Analítico',
  impulsivo: 'Impulsivo',
  temeroso: 'Temeroso',
  derrochador: 'Derrochador',
};

export const PERSONALITY_COLORS: Record<PersonalityType, string> = {
  analitico: '#2563eb',
  impulsivo: '#f59e0b',
  temeroso: '#10b981',
  derrochador: '#a855f7',
};

export const PERSONALITY_DESCRIPTIONS: Record<PersonalityType, { title: string; description: string }> = {
  analitico: {
    title: 'Analítico',
    description: 'Te caracterizas por tomar decisiones financieras basadas en datos y análisis cuidadoso. Planificas meticulosamente, comparas opciones y sigues presupuestos al pie de la letra. Tu enfoque racional te ayuda a evitar gastos innecesarios, aunque a veces puedes ser demasiado cauteloso y perder oportunidades por sobreanalizar.',
  },
  impulsivo: {
    title: 'Impulsivo',
    description: 'Tus decisiones financieras están guiadas por emociones y el momento presente. Te emocionas fácilmente con compras y ofertas, y gastas para sentirte mejor cuando estás estresado. Aunque disfrutas la vida al máximo, este patrón puede llevarte a gastos que no estaban planeados y dificultar el ahorro a largo plazo.',
  },
  temeroso: {
    title: 'Temeroso',
    description: 'La seguridad financiera es tu prioridad. Prefieres mantener un colchón grande de dinero y te angustias cuando hay pérdidas inesperadas. Aunque esta precaución te protege, puede limitar tu crecimiento al evitar inversiones o decisiones que requieren cierto nivel de riesgo calculado.',
  },
  derrochador: {
    title: 'Derrochador',
    description: 'El dinero para ti es un símbolo de éxito y estatus. Te gusta que se note tu nivel económico y gastas en cosas visibles que proyecten una imagen de prosperidad. Aunque disfrutas los beneficios de tu trabajo, este patrón puede llevarte a vivir por encima de tus posibilidades reales.',
  },
};
