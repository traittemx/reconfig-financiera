export type ArchetypeType =
  | 'alquimista'
  | 'conector'
  | 'acumulador'
  | 'disidente'
  | 'gobernante'
  | 'celebridad'
  | 'cuidador'
  | 'romantico';

export interface ArchetypeScores {
  alquimista: number;
  conector: number;
  acumulador: number;
  disidente: number;
  gobernante: number;
  celebridad: number;
  cuidador: number;
  romantico: number;
}

export interface ArchetypeQuizQuestion {
  id: number;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
    E: string;
    F: string;
    G: string;
    H: string;
  };
}

export interface ArchetypeResult {
  dominant: ArchetypeType;
  secondary: ArchetypeType | null;
  tertiary: ArchetypeType | null;
  scores: ArchetypeScores;
}

export interface FinancialArchetypeResult {
  id: string;
  user_id: string;
  org_id: string;
  dominant_archetype: ArchetypeType;
  secondary_archetype: ArchetypeType | null;
  tertiary_archetype: ArchetypeType | null;
  scores: string; // JSON stringified ArchetypeScores
  completed_at: string;
  created_at: string;
}

export const ARCHETYPE_LABELS: Record<ArchetypeType, string> = {
  alquimista: 'Alquimista',
  conector: 'Conector',
  acumulador: 'Acumulador',
  disidente: 'Disidente',
  gobernante: 'Gobernante',
  celebridad: 'Celebridad',
  cuidador: 'Cuidador',
  romantico: 'Romántico',
};

export const ARCHETYPE_COLORS: Record<ArchetypeType, string> = {
  alquimista: '#8b5cf6', // Purple
  conector: '#10b981', // Green
  acumulador: '#3b82f6', // Blue
  disidente: '#f59e0b', // Amber
  gobernante: '#6366f1', // Indigo
  celebridad: '#ec4899', // Pink
  cuidador: '#14b8a6', // Teal
  romantico: '#f97316', // Orange
};

export const ARCHETYPE_DESCRIPTIONS: Record<
  ArchetypeType,
  { title: string; description: string }
> = {
  alquimista: {
    title: 'Alquimista',
    description:
      'Para ti, el dinero es energía para crear impacto y transformar el mundo. Usas tus recursos para generar cambios positivos, invertir en proyectos significativos y crear valor que trasciende lo personal. Tu relación con el dinero está guiada por un propósito mayor.',
  },
  conector: {
    title: 'Conector',
    description:
      'El dinero es un medio para fortalecer relaciones y crear comunidad. Lo usas para invitar, compartir, unir y generar vínculos. Tu enfoque financiero está centrado en cómo el dinero puede fortalecer conexiones y crear experiencias compartidas.',
  },
  acumulador: {
    title: 'Acumulador',
    description:
      'La seguridad viene primero. Ahorras en exceso y te cuesta gastar incluso cuando puedes permitírtelo. El dinero acumulado te da tranquilidad, aunque a veces esta precaución puede limitar tu capacidad de disfrutar y crecer.',
  },
  disidente: {
    title: 'Disidente',
    description:
      'Rechazas las reglas tradicionales del dinero y cuestionas el sistema establecido. No sigues convenciones financieras y prefieres crear tu propio camino. Tu relación con el dinero desafía lo establecido y busca alternativas.',
  },
  gobernante: {
    title: 'Gobernante',
    description:
      'El dinero es poder y control. Buscas estructurar tu patrimonio para tener autoridad y dominio sobre tus decisiones financieras. El control te da paz y seguridad, y usas el dinero para reforzar tu posición y autonomía.',
  },
  celebridad: {
    title: 'Celebridad',
    description:
      'Disfrutas ser visto y que tu éxito financiero sea visible. Gastas para brillar, elevar tu imagen y proyectar prosperidad. El dinero es una forma de expresión personal y reconocimiento social.',
  },
  cuidador: {
    title: 'Cuidador',
    description:
      'Priorizas el bienestar de otros antes que el tuyo propio. Usas el dinero para apoyar, ayudar y cuidar a quienes te importan. Tu generosidad es tu forma de expresar amor y responsabilidad.',
  },
  romantico: {
    title: 'Romántico',
    description:
      'Vives el presente y gastas en experiencias memorables. El dinero es para crear recuerdos, disfrutar momentos y vivir la vida ahora. Prefieres invertir en vivencias que en cosas materiales.',
  },
};
