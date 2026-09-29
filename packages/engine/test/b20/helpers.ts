// Shared helpers for the B 20 tests.
import { expect } from 'vitest';
import { DEFAULT_MIX, computeRecipe, type MixInput, type Recipe } from '../../src/index';

/** A full mix input: the defaults with the given fields replaced. */
export function mix(overrides: Partial<MixInput> = {}): MixInput {
  return { ...DEFAULT_MIX, ...overrides };
}

/** Runs computeRecipe and fails the test if it returns an error. */
export function recipeFor(overrides: Partial<MixInput> = {}): Recipe {
  const result = computeRecipe(mix(overrides));
  if (!result.ok) throw new Error(`computeRecipe failed: ${result.error.code}`);
  return result.recipe;
}

/** |actual − expected| ≤ tol, with a readable failure message. */
export function near(actual: number | null | undefined, expected: number, tol: number, what = 'value'): void {
  expect(actual, `${what}: expected ${expected} ± ${tol}, got ${actual}`).not.toBeNull();
  expect(Math.abs((actual as number) - expected), `${what}: expected ${expected} ± ${tol}, got ${actual}`)
    .toBeLessThanOrEqual(tol + 1e-9);
}

/**
 * Stoffraumrechnung as printed in B 20: g = (1000 − z/ρz − w/ρw − f/ρf − p) · ρg,
 * with p the air in dm³.
 */
export function aggregateMass(
  { z, rhoZ, w, f = 0, rhoF = 2.32, p, rhoG }:
  { z: number; rhoZ: number; w: number; f?: number; rhoF?: number; p: number; rhoG: number },
): number {
  return Math.round((1000 - z / rhoZ - w / 1.0 - f / rhoF - p) * rhoG);
}
