// Laya's answers to the questions in services/api (questions.json, role_question.json).

export interface Answer {
  /** Probability of "yes" for yes/no questions. */
  noul?: number;
  /** Chosen option for choice questions. */
  choice?: string;
  /** Value for score questions (traffic 0–3). */
  score?: number;
  confidence?: number;
}

export type Answers = Readonly<Record<string, Answer | undefined>>;

export interface AnalysisResponse {
  answers: Answers;
  /** Measurements found in the text, in reading order ("90 cm", "3x2 m", "12 stück"). */
  candidates: string[];
  model: string;
  ms: number;
}

export const FACT_IDS = [
  'indoor_dry', 'rain', 'ground', 'frost', 'deicing_salt', 'horizontal', 'reinforced', 'watertight',
] as const;
export type FactId = (typeof FACT_IDS)[number];

export const ELEMENTS = ['foundation', 'slab', 'wall', 'paving', 'small'] as const;
export type Element = (typeof ELEMENTS)[number];

export function probability(answers: Answers, id: string): number {
  return answers[id]?.noul ?? 0;
}

export function yes(answers: Answers, id: string): boolean {
  return probability(answers, id) >= 0.5;
}

/** Three-way reading of a yes/no answer for display. */
export function certainty(p: number): 'yes' | 'no' | 'unsure' {
  return p >= 0.65 ? 'yes' : p <= 0.35 ? 'no' : 'unsure';
}
