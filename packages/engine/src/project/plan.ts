// From a description and Laya's answers to a project: which tool, which way of making it,
// what it needs and how much of it.
import { planBag, type BagPlan } from '../bagged/feasibility';
import { DECOR_PRESETS, type DecorPreset } from '../decor/presets';
import { ORDER_SENSIBLE_FROM_M3 } from '../order/order';
import { yes, type AnalysisResponse, type Answers } from './answers';
import { factsFromAnswers, requirementsFromFacts, type Facts, type Requirements } from './requirements';
import { parseVolume, resolveVolume, wallFromAnswers, type VolumeResult } from './volume';

/** How the user wants to make it, as Laya's `approach` question puts it. */
export type Approach = 'scratch' | 'bagged' | 'fine_mortar';
/** The planner's three ways to make a component. */
export type Production = 'bag' | 'mix' | 'order';

/** Walls thinner than this cannot be cast from site concrete with 8–32 mm aggregate. */
export const MIN_SITE_CONCRETE_WALL_M = 0.03;
/** Volume assumed for a DIY piece without a size: 10 litres. */
export const DIY_DEFAULT_VOLUME_M3 = 0.01;
/** Volume assumed for a component without a size: 1 m³. */
export const SITE_DEFAULT_VOLUME_M3 = 1;

const BAGGED_WORDS =
  /fertigbeton|fertigmischung|trockenbeton|sackware|säcke?\b.*beton|beton.*säcke?\b|baumarkt|hornbach|bauhaus|\bobi\b|\btoom\b|home ?depot|lowe'?s|quikrete|sakrete|bag(?:s|ged)? of (?:concrete|mix)|bagged|premix|pre-mix|ready[- ]?mix(?:ed)? (?:bag|concrete)/;
const EXTRA_CEMENT_WORDS =
  /mehr zement|zement dazu|zement (?:hinzu|zugeben|untermischen)|etwas zement|extra cement|more cement|add(?:ing)? (?:some )?cement/;
const PLASTICIZER_WORDS = /fließfähig|flüssiger|verflüssiger|fließmittel|plastici[sz]er|superplastici[sz]er|more fluid|flowable/;

/** Laya reads the description as a thin DIY piece rather than a component. */
export function isDiyPiece(answers: Answers): boolean {
  return yes(answers, 'fine_cast');
}

/**
 * Laya's `approach` answer; the physics overrides it where it is clear: walls under 3 cm
 * need fine mortar. A text that names bagged concrete wins over an unsure "scratch".
 * Without an answer, the DIY question and clear keywords decide.
 */
export function detectApproach(answers: Answers, text = '', wall: number | null = null): Approach {
  const choice = answers.approach?.choice;
  if (choice === 'scratch' && wall !== null && wall < MIN_SITE_CONCRETE_WALL_M) return 'fine_mortar';
  // "mit Fertigbeton aus dem Baumarkt" says it outright; an unsure model answer does not overrule it.
  const unsure = (answers.approach?.confidence ?? 1) < 0.5;
  if (choice === 'scratch' && unsure && BAGGED_WORDS.test(text.toLowerCase())) return 'bagged';
  if (choice === 'scratch' || choice === 'bagged' || choice === 'fine_mortar') return choice;
  if (BAGGED_WORDS.test(text.toLowerCase())) return 'bagged';
  return isDiyPiece(answers) ? 'fine_mortar' : 'scratch';
}

/**
 * The way to make it: bags only when the user wants them and a bag meets the requirements,
 * otherwise mixing it yourself, or ready-mixed concrete from about 1 m³.
 */
export function productionFor(approach: Approach, bag: BagPlan, volume: number): Production {
  if (approach === 'bagged' && bag.feasible) return 'bag';
  if (approach === 'bagged' && volume >= ORDER_SENSIBLE_FROM_M3) return 'order';
  return 'mix';
}

/** The user asks to add cement or a plasticiser to a bag: the bag tool, not the planner. */
export function wantsBagTuning(answers: Answers, text = ''): boolean {
  const t = text.toLowerCase();
  return yes(answers, 'add_cement') || yes(answers, 'add_plasticizer') || EXTRA_CEMENT_WORDS.test(t) || PLASTICIZER_WORDS.test(t);
}

export type DecorReason = 'outdoor' | 'small' | 'furniture';

/**
 * A fine-mortar recipe for a DIY piece: the only source that states outdoor use for rain
 * or frost, the hand-mixed one for small pieces up to 5 litres, else the furniture mix.
 */
export function chooseDecorPreset(facts: Pick<Facts, 'rain' | 'frost' | 'indoor'>, volume: VolumeResult): { preset: DecorPreset; reason: DecorReason } {
  const pick = (key: string) => DECOR_PRESETS.find((p) => p.key === key)!;
  if ((facts.rain || facts.frost) && !facts.indoor) return { preset: pick('diy-white-15kg-laminate'), reason: 'outdoor' };
  if (volume.source !== 'default' && volume.volume <= 0.005) return { preset: pick('diy-white-bowl-4kg'), reason: 'small' };
  return { preset: pick('diy-pce-30l-batch'), reason: 'furniture' };
}

export interface ProjectPlan {
  text: string;
  /** 'planner' for components, 'decor' for thin fine-mortar pieces. */
  tool: 'planner' | 'decor';
  approach: Approach;
  production: Production;
  /** Bagged concrete for these requirements: the product, or why none fits. */
  bag: BagPlan;
  /** The user asked for bags, but none meets the requirements. */
  bagRejected: boolean;
  facts: Facts;
  requirements: Requirements;
  volume: VolumeResult;
  /** Wall thickness Laya found, m. */
  wall: number | null;
  /** The piece is too thin for site concrete, whatever way the user chose. */
  thinWall: boolean;
  decor: { preset: DecorPreset; reason: DecorReason };
  wantsBagTuning: boolean;
}

export function planProject(text: string, analysis: Pick<AnalysisResponse, 'answers' | 'candidates'>): ProjectPlan {
  const { answers, candidates } = analysis;
  // Laya's wall role first; a wall thickness the text parser finds counts as well.
  const wall = wallFromAnswers(answers, candidates) ?? parseVolume(text).wall ?? null;
  const approach = detectApproach(answers, text, wall);
  const facts = factsFromAnswers(answers);
  const diy = approach === 'fine_mortar' || (approach === 'bagged' && facts.element === 'small');
  const volume = resolveVolume(text, answers, candidates, {
    defaultVolume: diy ? DIY_DEFAULT_VOLUME_M3 : SITE_DEFAULT_VOLUME_M3,
  });
  const thinWall = (volume.wall ?? wall ?? Infinity) < MIN_SITE_CONCRETE_WALL_M;
  const requirements = requirementsFromFacts(facts);
  const bag = planBag({
    strengthClass: requirements.mix.strengthClass,
    exposureClasses: requirements.exposureClasses,
    structural: facts.reinforced,
    watertight: requirements.watertight,
    volume: volume.volume,
    minThickness: volume.wall ?? wall,
  });
  return {
    text,
    tool: approach === 'fine_mortar' ? 'decor' : 'planner',
    approach,
    production: productionFor(approach, bag, volume.volume),
    bag,
    bagRejected: approach === 'bagged' && !bag.feasible,
    facts,
    requirements,
    volume,
    wall: volume.wall ?? wall,
    thinWall,
    decor: chooseDecorPreset(facts, volume),
    wantsBagTuning: wantsBagTuning(answers, text),
  };
}
