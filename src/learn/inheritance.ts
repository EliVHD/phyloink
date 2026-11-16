/** Original bounded teaching model. No tree, organism, artwork or persistence inputs. */
export const INHERITANCE_MODEL = 'mendelian-independent-v1';
export const MAX_OFFSPRING = 1000;
export const MAX_SHOWN_OFFSPRING = 64;
export type CrossSetup = { loci: 1 | 2; parent1: string; parent2: string };
export type Probability = { ways: number; denominator: number };
export type Gamete = Probability & { alleles: string };
export type CrossCell = Probability & { parent1: string; parent2: string; genotype: string; phenotype: string };
export type Distribution = Probability & { label: string };
export type MendelianCross = {
  model: typeof INHERITANCE_MODEL; setup: CrossSetup; gametes1: Gamete[]; gametes2: Gamete[];
  cells: CrossCell[]; genotypes: Distribution[]; phenotypes: Distribution[]; recessive: string;
};
export type Offspring = { parent1: string; parent2: string; genotype: string; phenotype: string };
export type OffspringSample = { seed: number; count: number; offspring: Offspring[]; genotypes: { label: string; count: number }[]; phenotypes: { label: string; count: number }[] };
const pairs = [['AA', 'Aa', 'aa'], ['BB', 'Bb', 'bb']] as const;

export function validateCross(setup: CrossSetup): void {
  if (!setup || (setup.loci !== 1 && setup.loci !== 2)) throw new Error('Choose one or two independent loci.');
  for (const parent of [setup.parent1, setup.parent2]) {
    if (typeof parent !== 'string' || parent.length !== setup.loci * 2 || !pairs.slice(0, setup.loci).every((options, i) => (options as readonly string[]).includes(parent.slice(i * 2, i * 2 + 2)))) throw new Error('Each parent needs AA, Aa or aa, and BB, Bb or bb for a second locus.');
  }
}
function combinations(options: readonly (readonly string[])[]): string[] { return options.reduce<string[]>((result, choices) => result.flatMap(prefix => choices.map(choice => prefix + choice)), ['']); }
function gametes(parent: string, loci: 1 | 2): Gamete[] {
  const tickets = combinations(Array.from({ length: loci }, (_, i) => [parent[i * 2], parent[i * 2 + 1]])), counts = new Map<string, number>();
  for (const alleles of tickets) counts.set(alleles, (counts.get(alleles) ?? 0) + 1);
  return [...counts].map(([alleles, ways]) => ({ alleles, ways, denominator: tickets.length }));
}
function offspring(parent1: string, parent2: string): Offspring {
  const genotype = [...parent1].map((allele, i) => [allele, parent2[i]].sort().join('')).join('');
  const phenotype = [...parent1].map((_, i) => genotype[i * 2] === genotype[i * 2].toUpperCase() ? `${genotype[i * 2]}_` : genotype.slice(i * 2, i * 2 + 2)).join(' ');
  return { parent1, parent2, genotype, phenotype };
}
export function createMendelianCross(setup: CrossSetup): MendelianCross {
  validateCross(setup);
  const gametes1 = gametes(setup.parent1, setup.loci), gametes2 = gametes(setup.parent2, setup.loci), denominator = 4 ** setup.loci;
  const cells = gametes1.flatMap(a => gametes2.map(b => ({ ...offspring(a.alleles, b.alleles), ways: a.ways * b.ways, denominator })));
  const distribution = (labels: string[], key: 'genotype' | 'phenotype'): Distribution[] => labels.map(label => ({ label, ways: cells.filter(cell => cell[key] === label).reduce((sum, cell) => sum + cell.ways, 0), denominator }));
  const genotypeLabels = combinations(pairs.slice(0, setup.loci));
  const phenotypeLabels = setup.loci === 1 ? ['A_', 'aa'] : ['A_ B_', 'A_ bb', 'aa B_', 'aa bb'];
  return { model: INHERITANCE_MODEL, setup: { ...setup }, gametes1, gametes2, cells, genotypes: distribution(genotypeLabels, 'genotype'), phenotypes: distribution(phenotypeLabels, 'phenotype'), recessive: phenotypeLabels.at(-1)! };
}

/** Deterministic Mulberry32 stream, v1. Each offspring draws one gamete from each parent independently. */
export function sampleOffspring(setup: CrossSetup, count: number, seed: number): OffspringSample {
  const cross = createMendelianCross(setup);
  if (!Number.isInteger(count) || count < 1 || count > MAX_OFFSPRING) throw new Error(`Sample size must be an integer from 1 to ${MAX_OFFSPRING}.`);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Seed must be an integer from 0 to 4294967295.');
  let state = seed;
  const random = () => { state = (state + 0x6d2b79f5) >>> 0; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const draw = (choices: Gamete[]) => {
    let ticket = Math.floor(random() * choices[0].denominator);
    for (const choice of choices) { if (ticket < choice.ways) return choice.alleles; ticket -= choice.ways; }
    throw new Error('Invalid gamete probabilities.');
  };
  const children = Array.from({ length: count }, () => offspring(draw(cross.gametes1), draw(cross.gametes2)));
  const counts = (rows: Distribution[], key: 'genotype' | 'phenotype') => rows.map(row => ({ label: row.label, count: children.filter(child => child[key] === row.label).length }));
  return { seed, count, offspring: children, genotypes: counts(cross.genotypes, 'genotype'), phenotypes: counts(cross.phenotypes, 'phenotype') };
}
export function probabilityText(value: Probability): string {
  let a = value.ways, b = value.denominator; while (b) [a, b] = [b, a % b];
  return `${value.ways / a}/${value.denominator / a}`;
}
/** Explicit fractions, decimals or percentages only; never eval, ratios or executable expressions. */
export function parseProbability(text: string): number {
  if (typeof text !== 'string' || text.length > 32) throw new Error('Enter a probability such as 1/4, 0.25 or 25%.');
  const value = text.trim(), fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(value), decimal = /^(?:\d+(?:\.\d+)?|\.\d+)%?$/.test(value);
  const result = fraction ? Number(fraction[1]) / Number(fraction[2]) : decimal ? Number(value.replace('%', '')) / (value.endsWith('%') ? 100 : 1) : NaN;
  if (!Number.isFinite(result) || result < 0 || result > 1) throw new Error('Enter a probability between 0 and 1, such as 1/4, 0.25 or 25%.');
  return result;
}
