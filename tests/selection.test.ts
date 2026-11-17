import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { SELECTION_COMPARISON_DEMO as DEMO, SELECTION_COMPARISON_OFFSET, simulateSelectionComparison } from '../src/learn/selection.ts';
import type { SelectionSetup } from '../src/learn/selection.ts';
import { selectionFigure } from '../src/learn/selection-render.ts';
import { selectedFrequency, simulatePopulation } from '../src/learn/population.ts';
import { defaultWorksheetPrompts, prepareWorksheet, worksheetPackage } from '../src/learn/worksheet.ts';
import type { WorksheetCapture, WorksheetOptions } from '../src/learn/worksheet.ts';
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-14, `${a} versus ${b}`);
const capture: WorksheetCapture = { kind: 'selection', setup: DEMO };
const options = (): WorksheetOptions => ({ title: 'My selection comparison', instructions: '<img src="https://invalid.test/"> is literal.', teacherNotes: 'PRIVATE_SELECTION_NOTE', paper: 'A4', answerLines: 3, tipCodes: true, includeData: true, prompts: defaultWorksheetPrompts(capture) });

test('comparison reuses the unchanged population model with only explicit weights and separate seeds', () => {
  const r = simulateSelectionComparison(DEMO);
  for (const [i, c] of r.conditions.entries()) assert.deepEqual(c.population, simulatePopulation({ size: 100, aCopies: 100, generations: 40, replicates: 4, seed: i ? (1 + SELECTION_COMPARISON_OFFSET) >>> 0 : 1, fitness: i ? DEMO.fitness2 : DEMO.fitness1 }));
  assert.equal(new Set(r.conditions.flatMap(c => c.population.trials.map(t => t.seed))).size, 8);
  assert.deepEqual(r.conditions[1].population.trials.map(t => [t.counts[1], t.counts[20], t.counts[40]]), [[96, 129, 161], [111, 169, 121], [104, 130, 150], [108, 134, 137]]);
  assert.equal(DEMO.fitness1.AA, DEMO.fitness2.AA); assert.equal(DEMO.fitness1.aa, DEMO.fitness2.aa); assert.notEqual(DEMO.fitness1.Aa, DEMO.fitness2.Aa);
});
test('genotype-weighted first references and heterozygote-advantage equilibrium match analytic values', () => {
  const [s1, s2] = simulateSelectionComparison(DEMO).conditions.map(c => c.population);
  close(s1.reference[1], 23 / 44); close(s2.reference[1], 13 / 25);
  close(selectedFrequency(2 / 3, DEMO.fitness2), 2 / 3);
  assert.ok(s1.reference.every((p, i, all) => !i || p > all[i - 1]));
  assert.ok(s2.reference.every((p, i, all) => p < 2 / 3 && (!i || p > all[i - 1])));
});
test('all generations conserve integer 2N counts, including absorbing loss and fixation', () => {
  for (const aCopies of [0, 1, 100, 200]) for (const c of simulateSelectionComparison({ ...DEMO, aCopies }).conditions) for (const t of c.population.trials) {
    assert.equal(t.counts.length, 41); t.counts.forEach(a => assert.ok(Number.isInteger(a) && a >= 0 && a <= 200));
    if (!aCopies || aCopies === 200) { assert.equal(t.boundary?.generation, 0); assert.ok(t.counts.every(a => a === aCopies)); }
    if (t.boundary) assert.ok(t.counts.slice(t.boundary.generation).every(a => a === t.counts[t.boundary!.generation]));
  }
});
test('maximum comparison retains all 808 records within 800000 potential draws', () => {
  const r = simulateSelectionComparison({ ...DEMO, size: 500, aCopies: 500, generations: 100 });
  assert.equal(r.maxDraws, 800000); assert.equal(r.conditions.flatMap(c => c.population.trials).reduce((n, t) => n + t.counts.length, 0), 808);
});
test('replay and horizon/trial prefixes remain deterministic without mutating frozen or extra inputs', () => {
  const input = Object.freeze({ ...DEMO, learnerAnswer: 'LEARNER_SECRET', fitness1: Object.freeze({ ...DEMO.fitness1, feedback: 'SECRET' }) });
  const before = JSON.stringify(input), r = simulateSelectionComparison(input), long = simulateSelectionComparison({ ...DEMO, generations: 100 }), few = simulateSelectionComparison({ ...DEMO, replicates: 1 });
  assert.equal(JSON.stringify(input), before); assert.deepEqual(r.setup, DEMO); assert.deepEqual(r, simulateSelectionComparison(input));
  for (const [i, c] of r.conditions.entries()) { assert.deepEqual(c.population.trials[0], few.conditions[i].population.trials[0]); c.population.trials.forEach((t, j) => assert.deepEqual(t.counts, long.conditions[i].population.trials[j].counts.slice(0, 41))); }
  assert.notDeepEqual(r.conditions[0].population.trials, simulateSelectionComparison({ ...DEMO, seed: 2 }).conditions[0].population.trials);
});
test('equal fitness gives neutral references but separate finite trials, including wrapped seeds', () => {
  const fitness = { AA: .5, Aa: .5, aa: .5 }, r = simulateSelectionComparison({ ...DEMO, seed: 0xffffffff, fitness1: fitness, fitness2: fitness });
  assert.equal(r.conditions[1].population.setup.seed, (0xffffffff + SELECTION_COMPARISON_OFFSET) >>> 0);
  for (const c of r.conditions) assert.ok(c.population.reference.every(p => p === .5));
  assert.notDeepEqual(r.conditions[0].population.trials[0].counts, r.conditions[1].population.trials[0].counts);
});
test('common positive fitness scaling leaves the analytic selection frequency unchanged', () => {
  for (const p of [0, .001, .25, .5, .99, 1]) close(selectedFrequency(p, { AA: 1.2, Aa: 1.4, aa: 1 }), selectedFrequency(p, { AA: .6, Aa: .7, aa: .5 }));
});
test('all shared bounds and all six fitness weights reject invalid values without seed coercion', () => {
  const bad: [keyof SelectionSetup, unknown[]][] = [['size', [1, 501, 2.5, NaN, '100']], ['aCopies', [-1, 201, .5, NaN]], ['generations', [0, 101, .5]], ['replicates', [0, 5, .5]], ['seed', [-1, .5, 0x100000000, Infinity]]];
  for (const [key, values] of bad) for (const value of values) assert.throws(() => simulateSelectionComparison({ ...DEMO, [key]: value } as SelectionSetup));
  for (const condition of ['fitness1', 'fitness2'] as const) for (const genotype of ['AA', 'Aa', 'aa']) for (const value of [0, .049, 2.01, NaN, Infinity, undefined, '1']) assert.throws(() => simulateSelectionComparison({ ...DEMO, [condition]: { ...DEMO[condition], [genotype]: value } } as SelectionSetup));
});
test('static role figures retain all finite paths and explicit weights without cursors or external assets', () => {
  for (const c of simulateSelectionComparison(DEMO).conditions) {
    const student = selectionFigure(c, false), teacher = selectionFigure(c, true);
    assert.equal([...student.matchAll(/data-selection-trial=/g)].length, 4); assert.match(student, /width="175mm" height="103mm"/);
    assert.doesNotMatch(student, /data-selection-reference|data-selection-cursor|<script|<image|href=/); assert.match(teacher, /data-selection-reference/); assert.doesNotMatch(teacher, /data-selection-cursor/);
    assert.match(selectionFigure(c, true, 20), /data-selection-cursor/); assert.throws(() => selectionFigure(c, true, 40.5));
  }
});
test('worksheet role boundaries exclude learner state and regenerate every CSV count and exact manifest', async () => {
  const input = { ...capture, setup: { ...DEMO, generations: 100 }, learnerAnswer: 'LEARNER_SECRET', progress: 'PROGRESS_SECRET' } as WorksheetCapture;
  const sheet = await prepareWorksheet(input, options(), null), student = await worksheetPackage(sheet, 'student'), teacher = await worksheetPackage(sheet, 'teacher');
  assert.doesNotMatch(JSON.stringify(student.files), /PRIVATE_SELECTION_NOTE|LEARNER_SECRET|PROGRESS_SECRET|Configured source\/model reference|data-selection-reference|data-selection-cursor/); assert.doesNotMatch(JSON.stringify(teacher.files), /LEARNER_SECRET|PROGRESS_SECRET/);
  assert.match(student.files['student.html'], /&lt;img/); assert.match(teacher.files['teacher.html'], /PRIVATE_SELECTION_NOTE/); assert.ok(!student.files['authoring.json'] && teacher.files['authoring.json']);
  for (const id of ['s1', 's2']) { assert.ok(student.files[`figures/selection-${id}-student.svg`] && !student.files[`figures/selection-${id}-teacher.svg`]); assert.ok(teacher.files[`figures/selection-${id}-teacher.svg`] && !teacher.files[`figures/selection-${id}-student.svg`]); }
  const rows = student.files['selection-comparison-counts.csv'].trim().split('\r\n'); assert.equal(rows.length, 809);
  const r = simulateSelectionComparison({ ...DEMO, generations: 100 });
  for (const row of rows.slice(1)) { const [condition, trial, g, n, a, other, p] = row.split(','), c = r.conditions.find(c => c.id === condition)!; assert.equal(Number(n), 100); assert.equal(Number(a), c.population.trials[Number(trial) - 1].counts[Number(g)]); assert.equal(Number(a) + Number(other), 2 * Number(n)); assert.equal(Number(p), Number(a) / (2 * Number(n))); }
  const context = JSON.parse(student.files['context.json']); assert.deepEqual(context.setup.setup, r.setup); assert.deepEqual(context.setup.selectedPrintedGenerations, [0, 50, 100]);
  for (const output of [student, teacher]) for (const file of JSON.parse(output.files['manifest.json']).files) { assert.equal(file.bytes, Buffer.byteLength(output.files[file.path])); assert.equal(file.sha256, createHash('sha256').update(output.files[file.path]).digest('hex')); }
  assert.deepEqual(student.zip, (await worksheetPackage(sheet, 'student')).zip);
});
test('worksheet data omission retains validated setup but no finite plots or records', async () => {
  const sheet = await prepareWorksheet(capture, { ...options(), includeData: false, paper: 'Letter' }, null), output = await worksheetPackage(sheet, 'student');
  assert.ok(!output.files['selection-comparison-counts.csv']); assert.ok(!Object.keys(output.files).some(p => p.startsWith('figures/'))); assert.match(output.files['student.html'], /size:Letter/); assert.equal(JSON.parse(output.files['context.json']).setup.sampleDataIncluded, false);
});
test('worksheet rejects invalid selection setup and foreign artifact paths', async () => {
  await assert.rejects(prepareWorksheet({ ...capture, setup: { ...DEMO, fitness2: { AA: 0, Aa: 1, aa: 1 } } } as WorksheetCapture, options(), null));
  const sheet = await prepareWorksheet(capture, options(), null); sheet.files['figures/population-teacher.svg'] = '<svg/>'; await assert.rejects(worksheetPackage(sheet, 'student'), /artifact path/);
});
