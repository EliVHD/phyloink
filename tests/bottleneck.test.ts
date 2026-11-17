import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { BOTTLENECK_DEMO, CONSTANT_SEED_OFFSET, bottleneckSizes, geneDiversity, simulateBottleneck } from '../src/learn/bottleneck.ts';
import type { BottleneckSetup } from '../src/learn/bottleneck.ts';
import { bottleneckFigure } from '../src/learn/bottleneck-render.ts';
import { simulatePopulation } from '../src/learn/population.ts';
import { defaultWorksheetPrompts, prepareWorksheet, worksheetPackage } from '../src/learn/worksheet.ts';
import type { WorksheetCapture, WorksheetOptions } from '../src/learn/worksheet.ts';
const close = (actual: number, expected: number, tolerance = 1e-14) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} versus ${expected}`);
const capture: WorksheetCapture = { kind: 'bottleneck', setup: { ...BOTTLENECK_DEMO } };
const options = (): WorksheetOptions => ({ title: 'My bottleneck', instructions: '<img src="https://invalid.test/"> is literal.', teacherNotes: 'PRIVATE_BOTTLENECK_NOTE', paper: 'A4', answerLines: 3, tipCodes: true, includeData: true, prompts: defaultWorksheetPrompts(capture) });

test('one episode has exact inclusive small generations and a recorded one-step recovery', () => {
  const sizes = bottleneckSizes(BOTTLENECK_DEMO);
  assert.equal(sizes.length, 41); assert.ok(sizes.slice(0, 10).every(n => n === 100)); assert.ok(sizes.slice(10, 20).every(n => n === 5)); assert.ok(sizes.slice(20).every(n => n === 100));
  assert.deepEqual(bottleneckSizes({ ...BOTTLENECK_DEMO, initialSize: 3, bottleneckSize: 2, aCopies: 3, generations: 2, bottleneckStart: 1, bottleneckDuration: 1 }), [3, 2, 3]);
  assert.equal(bottleneckSizes({ ...BOTTLENECK_DEMO, generations: 100, bottleneckStart: 99, bottleneckDuration: 1 })[100], 100);
});
test('default fixed streams use previous-size frequency and target-size counts across both transitions', () => {
  const r = simulateBottleneck(BOTTLENECK_DEMO), b = r.conditions[0], c = r.conditions[1], generations = [0, 9, 10, 19, 20, 40];
  assert.deepEqual(b.trials.map(t => generations.map(g => t.counts[g])), [[100, 106, 5, 9, 183, 186], [100, 99, 4, 10, 200, 200], [100, 108, 6, 0, 0, 0], [100, 91, 8, 2, 38, 93]]);
  assert.deepEqual(c.trials.map(t => t.counts.at(-1)), [128, 155, 175, 94]);
  assert.deepEqual(b.trials[1].boundary, { generation: 18, kind: 'A fixed' }); assert.deepEqual(b.trials[2].boundary, { generation: 14, kind: 'A lost' });
  assert.equal(r.maxDraws, 56400);
});
test('all recorded generations conserve exact 2N counts and valid frequencies for each condition', () => {
  for (const setup of [BOTTLENECK_DEMO, { ...BOTTLENECK_DEMO, initialSize: 7, aCopies: 1, bottleneckSize: 2, bottleneckStart: 1, bottleneckDuration: 1, seed: 0xffffffff }]) {
    const result = simulateBottleneck(setup);
    for (const condition of result.conditions) for (const trial of condition.trials) {
      assert.equal(trial.counts.length, setup.generations + 1);
      trial.counts.forEach((count, g) => { const n = condition.sizes[g]; assert.ok(Number.isInteger(count) && count >= 0 && count <= 2 * n); assert.equal(count + (2 * n - count), 2 * n); assert.ok(geneDiversity(count, n) >= 0 && geneDiversity(count, n) <= .5); });
    }
  }
});
test('loss and fixation stay absorbing while fixed copy counts rescale with N, including generation zero', () => {
  for (const aCopies of [0, 200]) {
    const r = simulateBottleneck({ ...BOTTLENECK_DEMO, aCopies });
    for (const c of r.conditions) for (const t of c.trials) {
      assert.equal(t.boundary?.generation, 0); assert.equal(t.boundary?.kind, aCopies ? 'A fixed' : 'A lost');
      t.counts.forEach((count, g) => { assert.equal(count, aCopies ? 2 * c.sizes[g] : 0); assert.equal(geneDiversity(count, c.sizes[g]), 0); });
    }
  }
  const b = simulateBottleneck(BOTTLENECK_DEMO).conditions[0]; assert.equal(b.trials[1].counts[19], 10); assert.equal(b.trials[1].counts[20], 200); assert.ok(b.trials[2].counts.slice(14).every(n => n === 0));
});
test('constant-size condition reuses the unchanged neutral model on separate stable streams', () => {
  const result = simulateBottleneck(BOTTLENECK_DEMO), reference = simulatePopulation({ size: 100, aCopies: 100, generations: 40, replicates: 4, seed: (1 + CONSTANT_SEED_OFFSET) >>> 0, fitness: { AA: 1, Aa: 1, aa: 1 } });
  assert.deepEqual(result.conditions[1].trials, reference.trials);
  const seeds = result.conditions.flatMap(c => c.trials.map(t => t.seed)); assert.equal(new Set(seeds).size, 8); assert.ok(result.conditions[1].sizes.every(n => n === 100));
});
test('neutral p reference and expected H match closed-form size histories, without forcing finite-path H to decline', () => {
  const result = simulateBottleneck(BOTTLENECK_DEMO), s = result.setup, h0 = .5;
  assert.equal(result.referenceFrequency, .5);
  for (let g = 0; g <= s.generations; g++) {
    const small = Math.max(0, Math.min(g - s.bottleneckStart + 1, s.bottleneckDuration));
    close(result.conditions[0].expectedDiversity[g], h0 * (1 - 1 / 200) ** (g - small) * (1 - 1 / 10) ** small);
    close(result.conditions[1].expectedDiversity[g], h0 * (1 - 1 / 200) ** g);
  }
  assert.ok(result.conditions[0].expectedDiversity[40] < result.conditions[1].expectedDiversity[40]);
  const b = result.conditions[0], t = b.trials[3]; assert.ok(geneDiversity(t.counts[40], b.sizes[40]) > geneDiversity(t.counts[19], b.sizes[19]));
  assert.equal(geneDiversity(0, 100), 0); assert.equal(geneDiversity(100, 100), .5); assert.equal(geneDiversity(200, 100), 0);
});
test('replay and horizon/replicate prefixes are deterministic; frozen inputs and extra learner fields are untouched', () => {
  const input = Object.freeze({ ...BOTTLENECK_DEMO, learnerAnswer: 'LEARNER_SECRET' }), before = JSON.stringify(input), result = simulateBottleneck(input);
  assert.equal(JSON.stringify(input), before); assert.deepEqual(result.setup, BOTTLENECK_DEMO); assert.deepEqual(result, simulateBottleneck(input));
  const long = simulateBottleneck({ ...BOTTLENECK_DEMO, generations: 100 }), few = simulateBottleneck({ ...BOTTLENECK_DEMO, replicates: 1 });
  for (const [c, condition] of result.conditions.entries()) { assert.deepEqual(condition.trials[0], few.conditions[c].trials[0]); condition.trials.forEach((trial, i) => assert.deepEqual(trial.counts, long.conditions[c].trials[i].counts.slice(0, 41))); }
  assert.notDeepEqual(result.conditions[0].trials[0].counts, simulateBottleneck({ ...BOTTLENECK_DEMO, seed: 2 }).conditions[0].trials[0].counts);
});
test('fixed neutral ensembles agree with one-transition binomial frequency mean and gene diversity', () => {
  // A deterministic ensemble checks the distribution, not an unseeded stochastic pass criterion.
  let mean = 0, h = 0; const repetitions = 2048, p0 = .25;
  for (let seed = 0; seed < repetitions; seed++) { const c = simulateBottleneck({ initialSize: 8, aCopies: 4, bottleneckSize: 2, bottleneckStart: 1, bottleneckDuration: 1, generations: 2, replicates: 1, seed }).conditions[0]; mean += c.trials[0].counts[1] / 4; h += geneDiversity(c.trials[0].counts[1], 2); }
  close(mean / repetitions, p0, .02); close(h / repetitions, 2 * p0 * (1 - p0) * (1 - 1 / 4), .02);
});
test('maximum schedule retains all 808 condition/trial/generation records within 800,000 draws', () => {
  const r = simulateBottleneck({ ...BOTTLENECK_DEMO, initialSize: 500, bottleneckSize: 499, aCopies: 500, bottleneckStart: 1, bottleneckDuration: 1, generations: 100, replicates: 4 });
  assert.equal(r.maxDraws, 799992); assert.ok(r.maxDraws <= 800000); assert.equal(r.conditions.flatMap(c => c.trials).reduce((sum, t) => sum + t.counts.length, 0), 808);
});
test('invalid sizes, episode ordering, work limits, counts, seeds and metrics reject without coercion', () => {
  const bad: [keyof BottleneckSetup, unknown[]][] = [['initialSize', [2, 501, 3.5, NaN, '100']], ['bottleneckSize', [1, 100, 101, 5.5, Infinity]], ['aCopies', [-1, 201, .5, NaN]], ['bottleneckStart', [0, 40, 1.5]], ['bottleneckDuration', [0, 31, .5]], ['generations', [1, 19, 101]], ['replicates', [0, 5, .5]], ['seed', [-1, .5, 0x100000000]]];
  for (const [key, values] of bad) for (const value of values) assert.throws(() => simulateBottleneck({ ...BOTTLENECK_DEMO, [key]: value } as BottleneckSetup), undefined, key + ':' + value);
  assert.throws(() => geneDiversity(201, 100)); assert.throws(() => geneDiversity(1.5, 100)); assert.throws(() => geneDiversity(1, 1));
});
test('static figures preserve all paths, explicit N and role/cursor boundaries', () => {
  const result = simulateBottleneck(BOTTLENECK_DEMO), student = bottleneckFigure(result, false), teacher = bottleneckFigure(result, true), interactive = bottleneckFigure(result, true, 20);
  assert.equal([...student.matchAll(/data-bottleneck-trial=/g)].length, 8); assert.match(student, /recovery g20/); assert.match(student, /100 → 5 → 100/);
  assert.doesNotMatch(student, /data-bottleneck-reference|data-bottleneck-cursor|<script|<image|href=/); assert.match(teacher, /data-bottleneck-reference/); assert.doesNotMatch(teacher, /data-bottleneck-cursor/); assert.match(interactive, /data-bottleneck-cursor/); assert.throws(() => bottleneckFigure(result, true, 40.5));
});
test('worksheet roles regenerate complete bounded CSV with generation-specific N and exclude learner state', async () => {
  const source = { ...capture, setup: { ...BOTTLENECK_DEMO, generations: 100 }, learnerAnswer: 'LEARNER_SECRET', progress: 'PROGRESS_SECRET' } as WorksheetCapture;
  const sheet = await prepareWorksheet(source, options(), null), student = await worksheetPackage(sheet, 'student'), teacher = await worksheetPackage(sheet, 'teacher');
  assert.doesNotMatch(JSON.stringify(student.files), /PRIVATE_BOTTLENECK_NOTE|LEARNER_SECRET|PROGRESS_SECRET|Configured source\/model reference|data-bottleneck-reference|data-bottleneck-cursor/); assert.doesNotMatch(JSON.stringify(teacher.files), /LEARNER_SECRET|PROGRESS_SECRET/);
  assert.match(student.files['student.html'], /&lt;img/); assert.match(teacher.files['teacher.html'], /PRIVATE_BOTTLENECK_NOTE/); assert.ok(!student.files['figures/bottleneck-teacher.svg'] && teacher.files['figures/bottleneck-teacher.svg']); assert.ok(!teacher.files['figures/bottleneck-student.svg']);
  const rows = student.files['bottleneck-counts.csv'].trim().split('\r\n'); assert.equal(rows.length, 809);
  const result = simulateBottleneck({ ...BOTTLENECK_DEMO, generations: 100 });
  for (const row of rows.slice(1)) { const [condition, trial, g, n, a, other, p, h] = row.split(','), c = result.conditions.find(c => c.id === condition)!; assert.equal(Number(n), c.sizes[Number(g)]); assert.equal(Number(a), c.trials[Number(trial) - 1].counts[Number(g)]); assert.equal(Number(a) + Number(other), 2 * Number(n)); assert.equal(Number(p), Number(a) / (2 * Number(n))); assert.equal(Number(h), geneDiversity(Number(a), Number(n))); }
  const context = JSON.parse(student.files['context.json']); assert.deepEqual(context.setup.setup, result.setup); assert.deepEqual(context.setup.selectedPrintedGenerations, [0, 19, 20, 100]);
  for (const output of [student, teacher]) for (const file of JSON.parse(output.files['manifest.json']).files) { assert.equal(file.bytes, Buffer.byteLength(output.files[file.path])); assert.equal(file.sha256, createHash('sha256').update(output.files[file.path]).digest('hex')); }
  assert.deepEqual(student.zip, (await worksheetPackage(sheet, 'student')).zip);
});
test('worksheet omission retains validated setup but no finite data; invalid setups and foreign artifacts reject', async () => {
  const sheet = await prepareWorksheet(capture, { ...options(), includeData: false, paper: 'Letter' }, null), output = await worksheetPackage(sheet, 'student');
  assert.ok(!output.files['bottleneck-counts.csv']); assert.ok(!Object.keys(output.files).some(path => path.startsWith('figures/'))); assert.match(output.files['student.html'], /size:Letter/); assert.equal(JSON.parse(output.files['context.json']).setup.sampleDataIncluded, false);
  await assert.rejects(prepareWorksheet({ ...capture, setup: { ...BOTTLENECK_DEMO, bottleneckDuration: 40 } } as WorksheetCapture, options(), null));
  sheet.files['figures/population-teacher.svg'] = '<svg/>'; await assert.rejects(worksheetPackage(sheet, 'student'), /artifact path/);
});
