/** Original bounded allele-count teaching model; no tree, organism or persistence inputs. */
export const POPULATION_MODEL = 'wright-fisher-selection-v1';
export const POPULATION_LIMITS = { minSize: 2, maxSize: 500, maxGenerations: 100, maxReplicates: 8, minFitness: .05, maxFitness: 2 } as const;
export type GenotypeFitness = { AA: number; Aa: number; aa: number };
export type PopulationSetup = { size: number; aCopies: number; generations: number; replicates: number; seed: number; fitness: GenotypeFitness };
export type PopulationTrial = { index: number; seed: number; counts: number[]; boundary: { generation: number; kind: 'A lost' | 'A fixed' } | null };
export type PopulationResult = { model: typeof POPULATION_MODEL; setup: PopulationSetup; reference: number[]; trials: PopulationTrial[]; maxDraws: number };
export const DRIFT_DEMO: PopulationSetup = { size: 20, aCopies: 20, generations: 40, replicates: 4, seed: 1, fitness: { AA: 1, Aa: 1, aa: 1 } };
export const SELECTION_DEMO: PopulationSetup = { size: 100, aCopies: 100, generations: 40, replicates: 4, seed: 1, fitness: { AA: 1.2, Aa: 1.1, aa: 1 } };
function validateFitness(fitness: GenotypeFitness): void {
  if (!fitness || !(['AA', 'Aa', 'aa'] as const).every(key => typeof fitness[key] === 'number' && Number.isFinite(fitness[key]) && fitness[key] >= POPULATION_LIMITS.minFitness && fitness[key] <= POPULATION_LIMITS.maxFitness)) throw new Error('Each relative fitness weight must be a finite number from 0.05 to 2. Zero-fitness extinction is outside this model.');
}
export function validatePopulation(setup: PopulationSetup): void {
  if (!setup || !Number.isInteger(setup.size) || setup.size < POPULATION_LIMITS.minSize || setup.size > POPULATION_LIMITS.maxSize) throw new Error('Population size N must be an integer from 2 to 500 diploid individuals.');
  if (!Number.isInteger(setup.aCopies) || setup.aCopies < 0 || setup.aCopies > 2 * setup.size) throw new Error(`Initial A copies must be an integer from 0 to ${2 * setup.size}. Counts are never rounded or clamped.`);
  if (!Number.isInteger(setup.generations) || setup.generations < 1 || setup.generations > POPULATION_LIMITS.maxGenerations) throw new Error('Choose 1–100 generations.');
  if (!Number.isInteger(setup.replicates) || setup.replicates < 1 || setup.replicates > POPULATION_LIMITS.maxReplicates) throw new Error('Choose 1–8 replicate trials.');
  if (!Number.isInteger(setup.seed) || setup.seed < 0 || setup.seed > 0xffffffff) throw new Error('Seed must be an integer from 0 to 4294967295.');
  validateFitness(setup.fitness);
}
/** Expected random-mating genotype proportions are weighted before finite allele-copy sampling. */
export function selectedFrequency(p: number, fitness: GenotypeFitness): number {
  if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) throw new Error('Allele frequency must be between 0 and 1.');
  validateFitness(fitness);
  if (p === 0 || p === 1 || fitness.AA === fitness.Aa && fitness.Aa === fitness.aa) return p;
  const q = 1 - p, mean = p * p * fitness.AA + 2 * p * q * fitness.Aa + q * q * fitness.aa;
  return Math.max(0, Math.min(1, (p * p * fitness.AA + p * q * fitness.Aa) / mean));
}
/** Mulberry32 v1. Trial-specific seeds keep prefixes stable when horizon/replicate count change. */
function stream(seed: number): () => number {
  let state = seed;
  return () => { state = (state + 0x6d2b79f5) >>> 0; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function simulatePopulation(setup: PopulationSetup): PopulationResult {
  validatePopulation(setup);
  const copies = 2 * setup.size, reference = [setup.aCopies / copies];
  for (let generation = 1; generation <= setup.generations; generation++) reference.push(selectedFrequency(reference.at(-1)!, setup.fitness));
  const trials = Array.from({ length: setup.replicates }, (_, index): PopulationTrial => {
    const seed = (setup.seed + Math.imul(index, 0x9e3779b9)) >>> 0, random = stream(seed), counts = [setup.aCopies];
    for (let generation = 1; generation <= setup.generations; generation++) {
      const probability = selectedFrequency(counts.at(-1)! / copies, setup.fitness);
      let next = probability === 1 ? copies : 0;
      if (probability > 0 && probability < 1) for (let copy = 0; copy < copies; copy++) if (random() < probability) next++;
      counts.push(next);
    }
    const boundaryIndex = counts.findIndex(count => count === 0 || count === copies);
    return { index: index + 1, seed, counts, boundary: boundaryIndex < 0 ? null : { generation: boundaryIndex, kind: counts[boundaryIndex] === 0 ? 'A lost' : 'A fixed' } };
  });
  return { model: POPULATION_MODEL, setup: { ...setup, fitness: { ...setup.fitness } }, reference, trials, maxDraws: copies * setup.generations * setup.replicates };
}
