import { simulatePopulation, validatePopulation } from './population.ts';
import type { GenotypeFitness, PopulationResult, PopulationSetup } from './population.ts';

/** Original bounded comparison protocol; the reviewed single-locus model is unchanged. */
export const SELECTION_COMPARISON_MODEL = 'selection-comparison-v1';
export const SELECTION_COMPARISON_OFFSET = 0xc2b2ae35;
export type SelectionSetup = { size: number; aCopies: number; generations: number; replicates: number; seed: number; fitness1: GenotypeFitness; fitness2: GenotypeFitness };
export type SelectionCondition = { id: 'S1' | 'S2'; population: PopulationResult };
export type SelectionResult = { model: typeof SELECTION_COMPARISON_MODEL; setup: SelectionSetup; conditions: SelectionCondition[]; maxDraws: number };
export const SELECTION_COMPARISON_DEMO: Readonly<SelectionSetup> = Object.freeze({ size: 100, aCopies: 100, generations: 40, replicates: 4, seed: 1, fitness1: Object.freeze({ AA: 1.2, Aa: 1.1, aa: 1 }), fitness2: Object.freeze({ AA: 1.2, Aa: 1.4, aa: 1 }) });
export const SELECTION_ASSUMPTIONS = 'Synthetic diploid autosomal A/a locus; closed constant-size population, random mating and non-overlapping generations. Expected random-mating genotype proportions are weighted by each condition’s fixed positive relative genotype fitnesses before 2N binomial gene-copy sampling. Fitness weights are relative contributions, not survival percentages or phenotype-dominance assignments. No individual genotypes, survival events or pedigrees are tracked. Conditions share N and initial A copies, but use separate seeded streams; matching trial numbers are not paired individuals or guaranteed counterfactuals. No mutation, migration, linked loci, changing environment, size changes, sex structure, zero-fitness extinction or empirical inference. Missing alleles stay absent; locus loss/fixation is not species extinction. Model N is an input, not an estimate of real populations. No traits or fitnesses are inferred from a tree.';
export const SELECTION_REFERENCES = [
  'Original synthetic comparison setup; protocol ' + SELECTION_COMPARISON_MODEL + ', underlying model wright-fisher-selection-v1. No organism dataset.',
  'Background: Graham Coop, Notes on Population Genetics (2013), diploid selection, https://gcbias.org/wp-content/uploads/2013/03/popgen_notes3.pdf ; MIT HST.508 population-genetics notes (2005), https://ocw.mit.edu/courses/hst-508-quantitative-genomics-fall-2005/aad420032640a927d69dc1a8b2a08750_hst508lecture1.pdf . Reading links only; no upstream text, figures or code bundled.'
];
const fitness = (value: GenotypeFitness): GenotypeFitness => ({ AA: value.AA, Aa: value.Aa, aa: value.aa });
function conditionSetup(setup: SelectionSetup, second: boolean): PopulationSetup {
  return { size: setup.size, aCopies: setup.aCopies, generations: setup.generations, replicates: setup.replicates, seed: second ? (setup.seed + SELECTION_COMPARISON_OFFSET) >>> 0 : setup.seed, fitness: fitness(second ? setup.fitness2 : setup.fitness1) };
}
export function validateSelectionComparison(setup: SelectionSetup): void {
  if (!setup || !Number.isInteger(setup.replicates) || setup.replicates < 1 || setup.replicates > 4) throw new Error('Choose 1–4 trials per condition, at most eight paths total.');
  // Validate the unmodified master seed before calculating a wrapped condition seed.
  validatePopulation({ ...setup, fitness: setup.fitness1 }); validatePopulation({ ...setup, fitness: setup.fitness2 });
}
export function simulateSelectionComparison(input: SelectionSetup): SelectionResult {
  validateSelectionComparison(input);
  const setup: SelectionSetup = { size: input.size, aCopies: input.aCopies, generations: input.generations, replicates: input.replicates, seed: input.seed, fitness1: fitness(input.fitness1), fitness2: fitness(input.fitness2) };
  const conditions: SelectionCondition[] = [{ id: 'S1', population: simulatePopulation(conditionSetup(setup, false)) }, { id: 'S2', population: simulatePopulation(conditionSetup(setup, true)) }];
  return { model: SELECTION_COMPARISON_MODEL, setup, conditions, maxDraws: conditions.reduce((sum, c) => sum + c.population.maxDraws, 0) };
}
