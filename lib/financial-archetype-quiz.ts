import type {
  ArchetypeQuizQuestion,
  ArchetypeScores,
  ArchetypeResult,
  ArchetypeType,
} from '@/types/financial-archetype';

export const ARCHETYPE_QUESTIONS: ArchetypeQuizQuestion[] = [
  {
    id: 1,
    question: 'Para ti, el dinero es principalmente:',
    options: {
      A: 'Energía para crear impacto',
      B: 'Un medio para conectar personas',
      C: 'Seguridad',
      D: 'Un sistema que cuestionar',
      E: 'Poder y estructura',
      F: 'Visibilidad',
      G: 'Apoyo para otros',
      H: 'Libertad y disfrute',
    },
  },
  {
    id: 2,
    question: 'Cuando ganas más dinero del esperado:',
    options: {
      A: 'Piensas cómo transformarlo en algo significativo',
      B: 'Lo usas para invitar, compartir o unir',
      C: 'Lo guardas',
      D: 'Rompes una regla establecida',
      E: 'Refuerzas tu posición',
      F: 'Mejoras tu imagen',
      G: 'Ayudas a alguien',
      H: 'Planeas una experiencia',
    },
  },
  {
    id: 3,
    question: 'Gastar dinero te hace sentir mejor cuando:',
    options: {
      A: 'Genera un cambio positivo',
      B: 'Fortalece relaciones',
      C: 'Apenas gastas',
      D: 'Vas contra lo establecido',
      E: 'Te da control',
      F: 'Te hace destacar',
      G: 'Alivia a otros',
      H: 'Creas recuerdos',
    },
  },
  {
    id: 4,
    question: 'Tu mayor conflicto con el dinero suele ser:',
    options: {
      A: 'No tener suficiente impacto',
      B: 'Depender de otros',
      C: 'Gastar',
      D: 'Encajar en el sistema',
      E: 'Perder control',
      F: 'No ser visto',
      G: 'Ponerte primero',
      H: 'Pensar en el futuro',
    },
  },
  {
    id: 5,
    question: 'Cuando alguien te pide ayuda económica:',
    options: {
      A: 'Evalúas el impacto',
      B: 'Ayudas para fortalecer el vínculo',
      C: 'Te incomoda',
      D: 'Desconfías del sistema',
      E: 'Pones condiciones',
      F: 'Depende de quién lo vea',
      G: 'Ayudas sin pensarlo',
      H: 'Si se siente bien, sí',
    },
  },
  {
    id: 6,
    question: 'Tu frase interna más común es:',
    options: {
      A: '"El dinero puede cambiar cosas"',
      B: '"Juntos es mejor"',
      C: '"Por si acaso..."',
      D: '"No necesito ese sistema"',
      E: '"Debo tener el control"',
      F: '"Quiero brillar"',
      G: '"Los demás primero"',
      H: '"La vida es ahora"',
    },
  },
  {
    id: 7,
    question: 'Tu estilo de gasto es:',
    options: {
      A: 'Con propósito',
      B: 'Social',
      C: 'Mínimo',
      D: 'Irregular',
      E: 'Estratégico',
      F: 'Visible',
      G: 'Sacrificado',
      H: 'Espontáneo',
    },
  },
  {
    id: 8,
    question: 'Lo que más te motiva a ganar dinero es:',
    options: {
      A: 'Transformar',
      B: 'Conectar',
      C: 'Protegerte',
      D: 'Ser libre del sistema',
      E: 'Dominar',
      F: 'Brillar',
      G: 'Cuidar',
      H: 'Vivir',
    },
  },
  {
    id: 9,
    question: 'Cuando piensas en riqueza imaginas:',
    options: {
      A: 'Impacto colectivo',
      B: 'Comunidad',
      C: 'Tranquilidad',
      D: 'Autonomía total',
      E: 'Poder',
      F: 'Reconocimiento',
      G: 'Seguridad para otros',
      H: 'Experiencias memorables',
    },
  },
  {
    id: 10,
    question: 'Si tuvieras que renunciar a algo sería:',
    options: {
      A: 'Lujo personal',
      B: 'Aislamiento',
      C: 'Gasto innecesario',
      D: 'Normas',
      E: 'Caos',
      F: 'Invisibilidad',
      G: 'Egoísmo',
      H: 'Rutina',
    },
  },
  {
    id: 11,
    question: 'En una crisis financiera tú:',
    options: {
      A: 'Buscas soluciones creativas',
      B: 'Pides apoyo',
      C: 'Te retraes',
      D: 'Rompes esquemas',
      E: 'Tomas mando',
      F: 'Mantienes imagen',
      G: 'Proteges a otros',
      H: 'Improvisas',
    },
  },
  {
    id: 12,
    question: 'Tu relación con el ahorro es:',
    options: {
      A: 'Medio, no fin',
      B: 'Compartido',
      C: 'Excesivo',
      D: 'Irrelevante',
      E: 'Controlado',
      F: 'Secundario',
      G: 'Para otros',
      H: 'Poco constante',
    },
  },
  {
    id: 13,
    question: 'El dinero mal usado es cuando:',
    options: {
      A: 'No genera impacto',
      B: 'No une',
      C: 'Se pierde',
      D: 'Sigue reglas absurdas',
      E: 'Se desperdicia',
      F: 'No se luce',
      G: 'No ayuda',
      H: 'Se guarda sin vivir',
    },
  },
  {
    id: 14,
    question: 'En grupos tú sueles ser quien:',
    options: {
      A: 'Inspira',
      B: 'Conecta',
      C: 'Observa',
      D: 'Cuestiona',
      E: 'Lidera',
      F: 'Destaca',
      G: 'Cuida',
      H: 'Disfruta',
    },
  },
  {
    id: 15,
    question: 'Si mañana duplicas tus ingresos:',
    options: {
      A: 'Lanzas un proyecto',
      B: 'Organizas encuentros',
      C: 'Ahorras extremo',
      D: 'Cambias todo',
      E: 'Inviertes estratégicamente',
      F: 'Elevas tu estilo',
      G: 'Apoyas a tu entorno',
      H: 'Viajas',
    },
  },
  {
    id: 16,
    question: 'Tu mayor miedo financiero es:',
    options: {
      A: 'No dejar huella',
      B: 'Quedarte solo',
      C: 'Quedarte sin dinero',
      D: 'Perder libertad',
      E: 'Perder poder',
      F: 'Pasar desapercibido',
      G: 'Fallarle a otros',
      H: 'Perder momentos',
    },
  },
  {
    id: 17,
    question: 'Para ti el éxito financiero es:',
    options: {
      A: 'Transformación',
      B: 'Comunidad',
      C: 'Estabilidad',
      D: 'Independencia',
      E: 'Autoridad',
      F: 'Visibilidad',
      G: 'Bienestar colectivo',
      H: 'Plenitud',
    },
  },
  {
    id: 18,
    question: 'Cuando compras algo caro lo haces porque:',
    options: {
      A: 'Tiene propósito',
      B: 'Se comparte',
      C: 'Dudas mucho',
      D: 'No sigues reglas',
      E: 'Refuerza tu control',
      F: 'Se nota',
      G: 'Beneficia a alguien',
      H: 'Te emociona',
    },
  },
  {
    id: 19,
    question: 'El dinero ideal debería:',
    options: {
      A: 'Fluir',
      B: 'Circular',
      C: 'Acumularse',
      D: 'Liberar',
      E: 'Gobernar',
      F: 'Brillar',
      G: 'Sostener',
      H: 'Disfrutarse',
    },
  },
  {
    id: 20,
    question: 'La frase que más resuena contigo es:',
    options: {
      A: '"El dinero transforma"',
      B: '"Las relaciones lo son todo"',
      C: '"Más vale prevenir"',
      D: '"No sigo reglas ajenas"',
      E: '"El control da paz"',
      F: '"La imagen importa"',
      G: '"Cuidar es amar"',
      H: '"Solo se vive una vez"',
    },
  },
];

/**
 * Calcula los puntajes basados en las respuestas del quiz.
 * Cada respuesta suma 1 punto al arquetipo correspondiente:
 * A → Alquimista
 * B → Conector
 * C → Acumulador
 * D → Disidente
 * E → Gobernante
 * F → Celebridad
 * G → Cuidador
 * H → Romántico
 */
export function calculateArchetypeScores(
  answers: ('A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H')[]
): ArchetypeScores {
  const scores: ArchetypeScores = {
    alquimista: 0,
    conector: 0,
    acumulador: 0,
    disidente: 0,
    gobernante: 0,
    celebridad: 0,
    cuidador: 0,
    romantico: 0,
  };

  answers.forEach((answer) => {
    switch (answer) {
      case 'A':
        scores.alquimista += 1;
        break;
      case 'B':
        scores.conector += 1;
        break;
      case 'C':
        scores.acumulador += 1;
        break;
      case 'D':
        scores.disidente += 1;
        break;
      case 'E':
        scores.gobernante += 1;
        break;
      case 'F':
        scores.celebridad += 1;
        break;
      case 'G':
        scores.cuidador += 1;
        break;
      case 'H':
        scores.romantico += 1;
        break;
    }
  });

  return scores;
}

/**
 * Determina el arquetipo dominante y los secundarios (2do y 3ro) basado en los puntajes.
 */
export function determineArchetype(scores: ArchetypeScores): ArchetypeResult {
  const entries = Object.entries(scores) as [ArchetypeType, number][];

  // Ordenar por puntaje descendente
  entries.sort((a, b) => b[1] - a[1]);

  const dominant = entries[0][0];
  const secondary =
    entries[1][1] > 0 && entries[1][1] !== entries[0][1]
      ? entries[1][0]
      : null;
  const tertiary =
    entries[2][1] > 0 &&
    entries[2][1] !== entries[0][1] &&
    entries[2][1] !== entries[1][1]
      ? entries[2][0]
      : null;

  return {
    dominant,
    secondary,
    tertiary,
    scores,
  };
}

/**
 * Interpreta un puntaje según los rangos:
 * 0-5: Influencia baja
 * 6-10: Influencia activa
 * 11-20: Arquetipo dominante
 */
export function interpretScore(
  score: number
): 'bajo' | 'activo' | 'dominante' {
  if (score <= 5) return 'bajo';
  if (score <= 10) return 'activo';
  return 'dominante';
}
