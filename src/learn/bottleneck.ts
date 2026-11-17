import { simulatePopulation } from './population.ts';
import type { PopulationTrial } from './population.ts';

/** Original neutral, one-episode teaching model. No individuals, source trees or inference. */
export const BOTTLENECK_MODEL = 'neutral-bottleneck-recovery-v1';
export const BOTTLENECK_LIMITS = { minSize: 2, maxSize: 500, maxGenerations: 100, maxReplicates: 4, maxDraws: 800000 } as const;
export const CONSTANT_SEED_OFFSET = 0x85ebca6b;
export type BottleneckSetup = { initialSize: number; aCopies: number; bottleneckSize: number; bottleneckStart: number; bottleneckDuration: number; generations: number; replicates: number; seed: number };
export type BottleneckCondition = { id: 'bottleneck' | 'constant'; sizes: number[]; expectedDiversity: number[]; trials: PopulationTrial[] };
export type BottleneckResult = { model: typeof BOTTLENECK_MODEL; setup: BottleneckSetup; conditions: BottleneckCondition[]; referenceFrequency: number; maxDraws: number };
export const BOTTLENECK_DEMO: Readonly<BottleneckSetup> = Object.freeze({ initialSize: 100, aCopies: 100, bottleneckSize: 5, bottleneckStart: 10, bottleneckDuration: 10, generations: 40, replicates: 4, seed: 1 });
export const BOTTLENECK_ASSUMPTIONS = 'Synthetic neutral diploid A/a locus; closed, random-mating population and non-overlapping generations. Each target generation resamples 2N_t gene copies with replacement using the previous generation’s A frequency. One temporary reduction is followed by one-step recovery to initial N. This is reproduction/gene-copy resampling, not an instantaneous mortality cull or a sample of surviving individuals. No mutation, migration, selection, sex structure, linked loci, individual genotypes or pedigrees. Missing alleles cannot return through recovery alone. N is a model input, not an empirical population-size estimate; locus loss/fixation is not species extinction. H = 2p(1−p) is gene diversity at this one biallelic locus, not measured heterozygous individuals or whole-genome diversity. Conditions use separate seeded streams; matching trial numbers are not the same individuals or guaranteed counterfactual pairs.';
export const BOTTLENECK_REFERENCES = [
  'Original synthetic teaching setup; model ' + BOTTLENECK_MODEL + '. No organism dataset.',
  'Background: MIT HST.508, population-genetics notes (2005), drift and fluctuating population sizes, https://ocw.mit.edu/courses/hst-508-quantitative-genomics-fall-2005/aad420032640a927d69dc1a8b2a08750_hst508lecture1.pdf ; UC Berkeley Understanding Evolution, Bottlenecks and founder effects, https://evolution.berkeley.edu/bottlenecks-and-founder-effects/ . Reading links only; no upstream text, figures or code bundled.'
];
export function validateBottleneck(setup: BottleneckSetup): void {
  if (!setup || !Number.isInteger(setup.initialSize) || setup.initialSize < 3 || setup.initialSize > 500) throw new Error('Initial/recovered N must be an integer from 3 to 500.');
  if (!Number.isInteger(setup.bottleneckSize) || setup.bottleneckSize < 2 || setup.bottleneckSize >= setup.initialSize) throw new Error('Bottleneck N must be an integer from 2 to initial N minus 1.');
  if (!Number.isInteger(setup.aCopies) || setup.aCopies < 0 || setup.aCopies > 2 * setup.initialSize) throw new Error(`Initial A copies must be an integer from 0 to ${2 * setup.initialSize}; values are not rounded or clamped.`);
  if (!Number.isInteger(setup.generations) || setup.generations < 2 || setup.generations > 100) throw new Error('Choose 2–100 generations, including at least one recovered generation.');
  if (!Number.isInteger(setup.bottleneckStart) || setup.bottleneckStart < 1 || setup.bottleneckStart >= setup.generations) throw new Error('The first bottleneck generation must be an integer from 1 to horizon minus 1.');
  if (!Number.isInteger(setup.bottleneckDuration) || setup.bottleneckDuration < 1 || setup.bottleneckStart + setup.bottleneckDuration > setup.generations) throw new Error('Duration must be a positive integer and recovery must occur within the horizon.');
  if (!Number.isInteger(setup.replicates) || setup.replicates < 1 || setup.replicates > 4) throw new Error('Choose 1–4 trials per condition, at most eight paths in total.');
  if (!Number.isInteger(setup.seed) || setup.seed < 0 || setup.seed > 0xffffffff) throw new Error('Seed must be an integer from 0 to 4294967295.');
}
export function bottleneckSizes(setup: BottleneckSetup): number[] {
  validateBottleneck(setup);
  return Array.from({ length: setup.generations + 1 }, (_, g) => g >= setup.bottleneckStart && g < setup.bottleneckStart + setup.bottleneckDuration ? setup.bottleneckSize : setup.initialSize);
}
export function geneDiversity(count: number, size: number): number {
  if (!Number.isInteger(size) || size < 2 || size > 500 || !Number.isInteger(count) || count < 0 || count > 2 * size) throw new Error('Gene diversity requires exact A-copy count and model N.');
  const p = count / (2 * size); return 2 * p * (1 - p);
}
/** Neutral expectation across independent model repetitions, not a finite-trial average. */
function diversityReference(sizes: number[], initial: number): number[] {
  const values = [initial]; for (const size of sizes.slice(1)) values.push(values.at(-1)! * (1 - 1 / (2 * size))); return values;
}
export function simulateBottleneck(input: BottleneckSetup): BottleneckResult {
  validateBottleneck(input);
  const setup: BottleneckSetup = { initialSize: input.initialSize, aCopies: input.aCopies, bottleneckSize: input.bottleneckSize, bottleneckStart: input.bottleneckStart, bottleneckDuration: input.bottleneckDuration, generations: input.generations, replicates: input.replicates, seed: input.seed };
  const sizes = bottleneckSizes(setup), p0 = setup.aCopies / (2 * setup.initialSize), h0 = geneDiversity(setup.aCopies, setup.initialSize);
  const trials = Array.from({ length: setup.replicates }, (_, index): PopulationTrial => {
    const seed = (setup.seed + Math.imul(index, 0x9e3779b9)) >>> 0; let state = seed;
    const random = () => { state = (state + 0x6d2b79f5) >>> 0; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const counts = [setup.aCopies];
    for (let g = 1; g <= setup.generations; g++) {
      const probability = counts[g - 1] / (2 * sizes[g - 1]), copies = 2 * sizes[g]; let next = probability === 1 ? copies : 0;
      if (probability > 0 && probability < 1) for (let copy = 0; copy < copies; copy++) if (random() < probability) next++;
      counts.push(next);
    }
    const boundaryIndex = counts.findIndex((count, g) => count === 0 || count === 2 * sizes[g]);
    return { index: index + 1, seed, counts, boundary: boundaryIndex < 0 ? null : { generation: boundaryIndex, kind: counts[boundaryIndex] === 0 ? 'A lost' : 'A fixed' } };
  });
  const control = simulatePopulation({ size: setup.initialSize, aCopies: setup.aCopies, generations: setup.generations, replicates: setup.replicates, seed: (setup.seed + CONSTANT_SEED_OFFSET) >>> 0, fitness: { AA: 1, Aa: 1, aa: 1 } });
  const constantSizes = sizes.map(() => setup.initialSize), maxDraws = (sizes.slice(1).reduce((sum, n) => sum + 2 * n, 0) + 2 * setup.initialSize * setup.generations) * setup.replicates;
  if (maxDraws > BOTTLENECK_LIMITS.maxDraws) throw new Error('Bottleneck work limit exceeded.');
  return { model: BOTTLENECK_MODEL, setup, referenceFrequency: p0, maxDraws, conditions: [{ id: 'bottleneck', sizes, expectedDiversity: diversityReference(sizes, h0), trials }, { id: 'constant', sizes: constantSizes, expectedDiversity: diversityReference(constantSizes, h0), trials: control.trials }] };
}
