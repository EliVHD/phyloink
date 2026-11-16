import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DRIFT_DEMO, SELECTION_DEMO, POPULATION_MODEL, POPULATION_LIMITS, selectedFrequency, simulatePopulation, validatePopulation } from '../src/learn/population.ts';
import type { PopulationSetup } from '../src/learn/population.ts';
const near = (a: number, b: number, tolerance = 1e-12) => assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);
const freeze = (value: object) => { Object.freeze(value); for (const child of Object.values(value)) if (child && typeof child === 'object') Object.freeze(child); };

test('neutral and fitness-weighted frequencies use diploid allele contributions with correct limits', () => {
  for (const p of [0, .001, .25, .5, .9, 1]) assert.equal(selectedFrequency(p, DRIFT_DEMO.fitness), p);
  near(selectedFrequency(.5, SELECTION_DEMO.fitness), 23 / 44);
  near(selectedFrequency(.25, { AA: 2, Aa: 1, aa: 1 }), 5 / 17);
  for (const p of [0, 1]) assert.equal(selectedFrequency(p, SELECTION_DEMO.fitness), p);
  for (const p of [.01, .2, .5, .8, .99]) assert.ok(selectedFrequency(p, SELECTION_DEMO.fitness) > p);
});
test('relative-fitness scaling and allele relabelling preserve the expected recursion', () => {
  const fitness = { AA: .7, Aa: .5, aa: .3 }, scaled = { AA: 1.4, Aa: 1, aa: .6 };
  for (const p of [.01, .25, .5, .8, .99]) {
    near(selectedFrequency(p, fitness), selectedFrequency(p, scaled));
    near(selectedFrequency(p, fitness), 1 - selectedFrequency(1 - p, { AA: fitness.aa, Aa: fitness.Aa, aa: fitness.AA }));
  }
});
test('no-drift reference depends on initial frequency and fitness, not finite size, seed or number of trials', () => {
  const drift = simulatePopulation(DRIFT_DEMO); assert.ok(drift.reference.every(p => p === .5));
  const selection = simulatePopulation(SELECTION_DEMO), other = simulatePopulation({ ...SELECTION_DEMO, size: 200, aCopies: 200, seed: 4294967295, replicates: 1 });
  assert.deepEqual(selection.reference, other.reference); near(selection.reference[1], 23 / 44);
  assert.ok(selection.reference.slice(1).every((p, i) => p >= selection.reference[i]));
});
test('seeded finite trials replay exactly, vary across seeds and use a fixed v1 count sequence', () => {
  const setup: PopulationSetup = { ...DRIFT_DEMO, size: 2, aCopies: 2, generations: 8, replicates: 1, seed: 1 };
  const result = simulatePopulation(setup); assert.equal(result.model, POPULATION_MODEL);
  assert.deepEqual(result, simulatePopulation(setup));
  assert.deepEqual(result.trials[0].counts, [2, 1, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(result.trials[0].boundary, { generation: 2, kind: 'A lost' });
  assert.notDeepEqual(simulatePopulation({ ...DRIFT_DEMO, seed: 0 }).trials, simulatePopulation(DRIFT_DEMO).trials);
});
test('per-trial streams keep prefixes stable when generation or replicate counts change', () => {
  const short = simulatePopulation({ ...SELECTION_DEMO, generations: 10, replicates: 3, seed: 0 }), long = simulatePopulation({ ...SELECTION_DEMO, generations: 30, replicates: 8, seed: 0 });
  for (const [index, trial] of short.trials.entries()) { assert.deepEqual(trial.counts, long.trials[index].counts.slice(0, 11)); assert.equal(trial.seed, long.trials[index].seed); }
  assert.equal(new Set(long.trials.map(trial => trial.seed)).size, 8);
});
test('exact counts, all generations and first boundary records preserve a frozen caller', () => {
  const setup = structuredClone(DRIFT_DEMO), before = JSON.stringify(setup); freeze(setup);
  const result = simulatePopulation(setup), copies = 2 * setup.size;
  assert.equal(result.trials.length, setup.replicates); assert.equal(result.reference.length, setup.generations + 1);
  for (const trial of result.trials) {
    assert.equal(trial.counts.length, setup.generations + 1); assert.equal(trial.counts[0], setup.aCopies);
    assert.ok(trial.counts.every(count => Number.isInteger(count) && count >= 0 && count <= copies));
    const first = trial.counts.findIndex(count => count === 0 || count === copies);
    assert.equal(trial.boundary?.generation ?? -1, first);
    if (first >= 0) assert.ok(trial.counts.slice(first).every(count => count === trial.counts[first]));
  }
  result.setup.fitness.AA = 2; assert.equal(JSON.stringify(setup), before);
});
test('loss and fixation at generation zero are absorbing under positive unequal fitnesses', () => {
  for (const aCopies of [0, 2 * SELECTION_DEMO.size]) {
    const result = simulatePopulation({ ...SELECTION_DEMO, aCopies, fitness: { AA: .05, Aa: 2, aa: .1 } });
    assert.ok(result.reference.every(p => p === aCopies / (2 * SELECTION_DEMO.size)));
    for (const trial of result.trials) { assert.ok(trial.counts.every(count => count === aCopies)); assert.equal(trial.boundary?.generation, 0); }
  }
});
test('a fixed neutral one-generation ensemble follows the 2N binomial mean and variance', () => {
  const values = Array.from({ length: 2048 }, (_, seed) => simulatePopulation({ ...DRIFT_DEMO, size: 2, aCopies: 1, generations: 1, replicates: 1, seed }).trials[0].counts[1]);
  const mean = values.reduce((sum, count) => sum + count, 0) / values.length, variance = values.reduce((sum, count) => sum + (count - mean) ** 2, 0) / values.length;
  near(mean, 1, .08); near(variance, .75, .12); assert.ok(values.includes(0) && values.includes(4));
});
test('invalid counts, horizons, trial counts, seeds, frequencies and fitnesses reject rather than clamp', () => {
  const cases = [null, {}, ...[0, 1, 501, 2.5, NaN, '20'].map(size => ({ ...DRIFT_DEMO, size })), ...[-1, 41, .5, NaN, '20'].map(aCopies => ({ ...DRIFT_DEMO, aCopies })), ...[0, 101, 1.5, NaN].map(generations => ({ ...DRIFT_DEMO, generations })), ...[0, 9, 1.5].map(replicates => ({ ...DRIFT_DEMO, replicates })), ...[-1, 4294967296, NaN, Infinity, .5, '1'].map(seed => ({ ...DRIFT_DEMO, seed })), ...[null, {}, { AA: 0, Aa: 1, aa: 1 }, { AA: .049, Aa: 1, aa: 1 }, { AA: 2.001, Aa: 1, aa: 1 }, { AA: 1, Aa: Infinity, aa: 1 }, { AA: 1, Aa: 1, aa: '1' }].map(fitness => ({ ...DRIFT_DEMO, fitness }))];
  for (const bad of cases) assert.throws(() => simulatePopulation(bad as PopulationSetup));
  for (const p of [-.01, 1.01, NaN, Infinity, '0.5']) assert.throws(() => selectedFrequency(p as number, DRIFT_DEMO.fitness));
  validatePopulation({ ...DRIFT_DEMO, seed: 0 }); validatePopulation({ ...DRIFT_DEMO, seed: 4294967295 });
});
test('maximum supported work remains bounded with all 808 generation records present', () => {
  const result = simulatePopulation({ ...SELECTION_DEMO, size: 500, aCopies: 500, generations: 100, replicates: 8 });
  assert.equal(result.maxDraws, 800000); assert.equal(result.trials.flatMap(trial => trial.counts).length, 808);
  assert.deepEqual(POPULATION_LIMITS, { minSize: 2, maxSize: 500, maxGenerations: 100, maxReplicates: 8, minFitness: .05, maxFitness: 2 });
});
