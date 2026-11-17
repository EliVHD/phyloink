import { MAX_OFFSPRING } from './inheritance.ts';
import type { CrossCell, Distribution, Gamete, Offspring, OffspringSample } from './inheritance.ts';

/** Original two-marker teaching model. No source trees, distances or breeding histories. */
export const LINKAGE_MODEL = 'linked-two-locus-v1';
export const HAPLOTYPES = ['AB', 'Ab', 'aB', 'ab'] as const;
export type LinkageSetup = { parent1: string; parent2: string; recombinationPercent: number };
export const LINKAGE_TEST_CROSS: Readonly<LinkageSetup> = Object.freeze({ parent1: 'AB/ab', parent2: 'ab/ab', recombinationPercent: 10 });
export const LINKAGE_ASSUMPTIONS = 'Synthetic diploid autosomal two-locus model, two alleles per locus, equal segregation, symmetric gamete probabilities, independent parental gamete draws, random fertilization and complete dominance at each locus. One shared recombination fraction applies to both parents; it is not a crossover count, physical distance or map-distance estimate. No sex-specific recombination, mutation, selection, segregation distortion, epistasis, penetrance variation, environment or multigeneration breeding. A_ means AA or Aa; B_ means BB or Bb. Dominance does not increase transmission. No organisms or genotypes are inferred from a tree.';
export const LINKAGE_REFERENCES = [
  'Original synthetic teaching setup; model ' + LINKAGE_MODEL + '. No organism dataset.',
  'Background: NHGRI, Linkage, https://www.genome.gov/genetics-glossary/Linkage ; MIT 7.014, Spring 2005, Recitation 16 answer key, https://ocw.mit.edu/courses/7-014-introductory-biology-spring-2005/ed9c0e71598f4e9683ffc4a5dd2f0f7c_section16_ak.pdf . Reading links only; no source text, figures or code bundled.'
];
export type LinkedGamete = Gamete & { origin: 'parental' | 'recombinant' | 'uninformative' };
export type PhasedOffspring = Offspring & { phase: string };
export type LinkageCross = { model: typeof LINKAGE_MODEL; setup: LinkageSetup; gametes1: LinkedGamete[]; gametes2: LinkedGamete[]; cells: CrossCell[]; genotypes: Distribution[]; phenotypes: Distribution[] };
export type LinkageSample = Omit<OffspringSample, 'offspring'> & { offspring: PhasedOffspring[]; gametes1: { label: string; count: number }[]; gametes2: { label: string; count: number }[] };

export function validateLinkage(setup: LinkageSetup): void {
  if (!setup || !Number.isInteger(setup.recombinationPercent) || setup.recombinationPercent < 0 || setup.recombinationPercent > 50) throw new Error('Recombination must be a whole percentage from 0 to 50; values are not rounded or clamped.');
  for (const parent of [setup.parent1, setup.parent2]) if (typeof parent !== 'string' || parent.length !== 5 || !/^[Aa][Bb]\/[Aa][Bb]$/.test(parent)) throw new Error('Each parent needs two explicit chromosomes: AB, Ab, aB or ab, separated by /.');
}
export function linkedGametes(parent: string, recombinationPercent: number): LinkedGamete[] {
  validateLinkage({ parent1: parent, parent2: parent, recombinationPercent });
  const [a, b] = parent.split('/'), informative = a[0] !== b[0] && a[1] !== b[1];
  // Four routes have integer weights over 200. Duplicate marker outcomes are aggregated.
  const routes = [[a, 100 - recombinationPercent], [b, 100 - recombinationPercent], [a[0] + b[1], recombinationPercent], [b[0] + a[1], recombinationPercent]] as const;
  return HAPLOTYPES.map(alleles => ({ alleles, ways: routes.filter(([label]) => label === alleles).reduce((sum, [, ways]) => sum + ways, 0), denominator: 200, origin: informative ? (alleles === a || alleles === b ? 'parental' : 'recombinant') : 'uninformative' }));
}
function offspring(parent1: string, parent2: string): PhasedOffspring {
  const genotype = [...parent1].map((allele, i) => [allele, parent2[i]].sort().join('')).join('');
  const phenotype = [0, 1].map(i => genotype[i * 2] === genotype[i * 2].toUpperCase() ? `${genotype[i * 2]}_` : genotype.slice(i * 2, i * 2 + 2)).join(' ');
  return { parent1, parent2, phase: `${parent1}/${parent2}`, genotype, phenotype };
}
export function createLinkageCross(setup: LinkageSetup): LinkageCross {
  validateLinkage(setup);
  const gametes1 = linkedGametes(setup.parent1, setup.recombinationPercent), gametes2 = linkedGametes(setup.parent2, setup.recombinationPercent);
  const cells = gametes1.flatMap(a => gametes2.map(b => ({ ...offspring(a.alleles, b.alleles), ways: a.ways * b.ways, denominator: 40000 })));
  const distribution = (labels: string[], key: 'genotype' | 'phenotype'): Distribution[] => labels.map(label => ({ label, ways: cells.filter(cell => cell[key] === label).reduce((sum, cell) => sum + cell.ways, 0), denominator: 40000 }));
  return { model: LINKAGE_MODEL, setup: { parent1: setup.parent1, parent2: setup.parent2, recombinationPercent: setup.recombinationPercent }, gametes1, gametes2, cells, genotypes: distribution(['AA', 'Aa', 'aa'].flatMap(a => ['BB', 'Bb', 'bb'].map(b => a + b)), 'genotype'), phenotypes: distribution(['A_ B_', 'A_ bb', 'aa B_', 'aa bb'], 'phenotype') };
}
/** Mulberry32 v1, fixed AB/Ab/aB/ab order; two independent gamete draws per offspring. */
export function sampleLinkedOffspring(setup: LinkageSetup, count: number, seed: number): LinkageSample {
  const cross = createLinkageCross(setup);
  if (!Number.isInteger(count) || count < 1 || count > MAX_OFFSPRING) throw new Error(`Sample size must be an integer from 1 to ${MAX_OFFSPRING}.`);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Seed must be an integer from 0 to 4294967295.');
  let state = seed;
  const draw = (choices: LinkedGamete[]) => {
    state = (state + 0x6d2b79f5) >>> 0; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    let ticket = Math.floor(((t ^ t >>> 14) >>> 0) / 4294967296 * 200);
    for (const choice of choices) { if (ticket < choice.ways) return choice.alleles; ticket -= choice.ways; }
    throw new Error('Invalid linked gamete probabilities.');
  };
  const children = Array.from({ length: count }, () => offspring(draw(cross.gametes1), draw(cross.gametes2)));
  const counts = (labels: string[], key: keyof Offspring) => labels.map(label => ({ label, count: children.filter(child => child[key] === label).length }));
  return { seed, count, offspring: children, genotypes: counts(cross.genotypes.map(row => row.label), 'genotype'), phenotypes: counts(cross.phenotypes.map(row => row.label), 'phenotype'), gametes1: counts([...HAPLOTYPES], 'parent1'), gametes2: counts([...HAPLOTYPES], 'parent2') };
}
