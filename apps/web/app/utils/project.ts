// From an analysed description to the state of the page that handles it.
import type { ProjectPlan } from '@cretelab/engine';
import type { FineConcreteState, PlannerState } from './query';

export function plannerStateFromPlan(plan: ProjectPlan): PlannerState {
  return { q: plan.text, volume: plan.volume.volume, tab: plan.production, mix: plan.requirements.mix };
}

const toCm = (m: number | undefined) => (m === undefined ? null : Math.round(m * 1000) / 10);

/** Shape and sizes as Laya read them; a size-less piece starts as a 10 l hollow box. */
export function fineConcreteStateFromPlan(plan: ProjectPlan): FineConcreteState {
  const d = plan.volume.dimensions ?? {};
  // The fine concrete page shows a round hollow body (a pot) as a cylinder with a wall.
  const shape = plan.volume.shape === 'hollow' && d.diameter ? 'cylinder' : (plan.volume.shape ?? 'hollow');
  return {
    q: plan.text,
    shape,
    length: toCm(d.length),
    width: toCm(d.width),
    height: toCm(d.height),
    diameter: toCm(d.diameter),
    wall: toCm(d.wall),
    open: d.open ?? 'one',
    count: d.count ?? 1,
    preset: plan.decor.preset.key,
    assumed: Object.keys(plan.volume.assumed ?? {}) as FineConcreteState['assumed'],
  };
}
