import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createMendelianCross, probabilityText } from '../src/learn/inheritance.ts';
import { HAPLOTYPES, LINKAGE_TEST_CROSS, createLinkageCross, linkedGametes, sampleLinkedOffspring } from '../src/learn/linkage.ts';
import { linkageDiagram } from '../src/learn/linkage-render.ts';
import type { LinkageSetup } from '../src/learn/linkage.ts';
import { defaultWorksheetPrompts, prepareWorksheet, worksheetPackage } from '../src/learn/worksheet.ts';
import type { WorksheetCapture, WorksheetOptions } from '../src/learn/worksheet.ts';
const phases = HAPLOTYPES.flatMap(a => HAPLOTYPES.map(b => a + '/' + b));
const reverse = (parent: string) => parent.split('/').reverse().join('/');
const unphased = (parent: string) => [0, 1].map(i => parent.split('/').map(h => h[i]).sort().join('')).join('');
const value = (row: { ways: number; denominator: number }) => row.ways / row.denominator;
const capture: WorksheetCapture = { kind: 'linkage', setup: { ...LINKAGE_TEST_CROSS }, count: 100, seed: 1 };
const options = (): WorksheetOptions => ({ title: 'My linked cross', instructions: 'Explain <img src="https://invalid.test/"> literally.', teacherNotes: 'PRIVATE_TEACHER_NOTE', paper: 'A4', answerLines: 3, tipCodes: true, includeData: true, prompts: defaultWorksheetPrompts(capture) });

test('the adaptable test cross retains exact 45:5:5:45 probabilities and zero outcomes', () => {
  const cross = createLinkageCross(LINKAGE_TEST_CROSS);
  assert.deepEqual(cross.gametes1.map(row => probabilityText(row)), ['9/20', '1/20', '1/20', '9/20']);
  assert.deepEqual(cross.gametes1.map(row => row.origin), ['parental', 'recombinant', 'recombinant', 'parental']);
  assert.deepEqual(cross.gametes2.map(row => row.ways), [0, 0, 0, 200]);
  assert.deepEqual(cross.genotypes.filter(row => row.ways).map(row => [row.label, value(row)]), [['AaBb', .45], ['Aabb', .05], ['aaBb', .05], ['aabb', .45]]);
  assert.equal(cross.cells.length, 16); assert.equal(cross.genotypes.length, 9); assert.equal(cross.phenotypes.length, 4);
});
test('phase changes common gametes; zero recombination retains only parental chromosomes', () => {
  assert.equal(unphased('AB/ab'), unphased('Ab/aB'));
  assert.deepEqual(linkedGametes('Ab/aB', 10).map(row => value(row)), [.05, .45, .45, .05]);
  for (const parent of phases) {
    const rows = linkedGametes(parent, 0);
    assert.ok(rows.filter(row => row.ways).every(row => parent.split('/').includes(row.alleles)));
    assert.deepEqual(linkedGametes(reverse(parent), 10), linkedGametes(parent, 10));
  }
});
test('all phased parents and all 51 rates preserve exact totals, Mendelian marginals and uninformative markers', () => {
  for (const parent of phases) for (let rate = 0; rate <= 50; rate++) {
    const rows = linkedGametes(parent, rate), copies = parent.split('/');
    assert.equal(rows.reduce((sum, row) => sum + row.ways, 0), 200);
    assert.ok(rows.every(row => Number.isInteger(row.ways) && row.ways >= 0 && row.denominator === 200));
    for (const [index, allele] of [[0, 'A'], [1, 'B']] as const) assert.equal(rows.filter(row => row.alleles[index] === allele).reduce((sum, row) => sum + row.ways, 0), 100 * copies.filter(copy => copy[index] === allele).length);
    if (copies[0][0] === copies[1][0] || copies[0][1] === copies[1][1]) {
      assert.ok(rows.every(row => row.origin === 'uninformative')); assert.deepEqual(rows, linkedGametes(parent, 0));
    }
  }
});
test('all 256 ordered parental pairs preserve weighted totals, parent symmetry and identical 50% independent probabilities', () => {
  for (const parent1 of phases) for (const parent2 of phases) for (const recombinationPercent of [0, 10, 50]) {
    const cross = createLinkageCross({ parent1, parent2, recombinationPercent }), swapped = createLinkageCross({ parent1: parent2, parent2: parent1, recombinationPercent });
    for (const rows of [cross.cells, cross.genotypes, cross.phenotypes]) assert.equal(rows.reduce((sum, row) => sum + row.ways, 0), 40000);
    assert.deepEqual(cross.genotypes, swapped.genotypes); assert.deepEqual(cross.phenotypes, swapped.phenotypes);
    if (recombinationPercent === 50) {
      const independent = createMendelianCross({ loci: 2, parent1: unphased(parent1), parent2: unphased(parent2) });
      assert.deepEqual(cross.genotypes.map(value), independent.genotypes.map(value)); assert.deepEqual(cross.phenotypes.map(value), independent.phenotypes.map(value));
    }
  }
});
test('offspring retain both inherited chromosomes and correct unphased genotype/phenotype identities', () => {
  const sample = sampleLinkedOffspring({ ...LINKAGE_TEST_CROSS, parent2: 'Ab/aB' }, 1000, 42);
  for (const child of sample.offspring) {
    assert.equal(child.phase, child.parent1 + '/' + child.parent2); assert.equal(child.genotype, unphased(child.phase));
    assert.equal(child.phenotype, (child.genotype.startsWith('aa') ? 'aa' : 'A_') + ' ' + (child.genotype.endsWith('bb') ? 'bb' : 'B_'));
  }
  for (const rows of [sample.gametes1, sample.gametes2, sample.genotypes, sample.phenotypes]) assert.equal(rows.reduce((sum, row) => sum + row.count, 0), 1000);
});
test('seeded trials replay with stable prefixes, a fixed stream and all sample counts retained', () => {
  const small = sampleLinkedOffspring(LINKAGE_TEST_CROSS, 10, 1), large = sampleLinkedOffspring(LINKAGE_TEST_CROSS, 1000, 1);
  assert.deepEqual(small, sampleLinkedOffspring(LINKAGE_TEST_CROSS, 10, 1)); assert.deepEqual(small.offspring, large.offspring.slice(0, 10));
  assert.deepEqual(small.offspring.map(row => row.phase), ['ab/ab', 'aB/ab', 'ab/ab', 'ab/ab', 'AB/ab', 'Ab/ab', 'AB/ab', 'AB/ab', 'Ab/ab', 'AB/ab']);
  assert.deepEqual(sampleLinkedOffspring(LINKAGE_TEST_CROSS, 100, 1).gametes1.map(row => row.count), [52, 2, 7, 39]);
  assert.notDeepEqual(large.offspring, sampleLinkedOffspring(LINKAGE_TEST_CROSS, 1000, 2).offspring);
});
test('a finite observed recombinant proportion can exceed the 50% model bound', () => {
  const setup = { ...LINKAGE_TEST_CROSS, recombinationPercent: 50 };
  const sample = sampleLinkedOffspring(setup, 1, 1);
  assert.equal(createLinkageCross(setup).gametes1.find(row => row.alleles === sample.offspring[0].parent1)!.origin, 'recombinant');
});
test('frozen educator setups stay unchanged and extra learner fields are excluded from model setup', () => {
  const setup = Object.freeze({ ...LINKAGE_TEST_CROSS, learnerAnswer: 'LEARNER_SECRET' });
  const before = JSON.stringify(setup), cross = createLinkageCross(setup); sampleLinkedOffspring(setup, 1000, 0xffffffff);
  assert.equal(JSON.stringify(setup), before); assert.deepEqual(cross.setup, LINKAGE_TEST_CROSS);
});
test('invalid phases, recombination units, sample counts and seeds reject without coercion', () => {
  for (const parent1 of ['AaBb', 'AB/ab\n', ' AB/ab', 'BA/ba', 'AB//ab', 'AB/xy', 'AB/<script>', null, 1]) assert.throws(() => createLinkageCross({ ...LINKAGE_TEST_CROSS, parent1 } as LinkageSetup));
  for (const recombinationPercent of [-1, .5, 50.1, 51, NaN, Infinity, '10', null]) assert.throws(() => createLinkageCross({ ...LINKAGE_TEST_CROSS, recombinationPercent } as LinkageSetup));
  for (const count of [0, 1.5, 1001, NaN, Infinity]) assert.throws(() => sampleLinkedOffspring(LINKAGE_TEST_CROSS, count, 1));
  for (const seed of [-1, .5, 0x100000000, NaN, Infinity]) assert.throws(() => sampleLinkedOffspring(LINKAGE_TEST_CROSS, 10, seed));
});
test('native chromosome schematic retains explicit phase and declares nonmetric spacing', () => {
  const svg = linkageDiagram(LINKAGE_TEST_CROSS); assert.match(svg, /AB\/ab/); assert.match(svg, /ab\/ab/); assert.match(svg, /No physical\/map distance/);
  assert.doesNotMatch(svg, /<script|<image|href=/); assert.throws(() => linkageDiagram({ ...LINKAGE_TEST_CROSS, parent1: 'AB/ab\n' }));
});
test('linkage worksheets regenerate counts with explicit phase/rate, role separation and exact manifests', async () => {
  const source = Object.freeze({ ...capture, learnerAnswer: 'LEARNER_SECRET', feedback: 'FEEDBACK_SECRET' });
  const sheet = await prepareWorksheet(source, options(), null), student = await worksheetPackage(sheet, 'student'), teacher = await worksheetPackage(sheet, 'teacher');
  assert.doesNotMatch(JSON.stringify(student.files), /PRIVATE_TEACHER_NOTE|LEARNER_SECRET|FEEDBACK_SECRET|Configured source\/model reference/);
  assert.doesNotMatch(student.files['student.html'], /<caption>Parent [12] gametes|<caption>Expected offspring/);
  assert.doesNotMatch(JSON.stringify(teacher.files), /LEARNER_SECRET|FEEDBACK_SECRET/); assert.match(teacher.files['teacher.html'], /PRIVATE_TEACHER_NOTE/);
  assert.match(student.files['student.html'], /&lt;img/); assert.match(student.files['student.html'], /52<\/td>/); assert.match(student.files['student.html'], /39<\/td>/);
  assert.deepEqual(JSON.parse(student.files['context.json']).setup, { model: 'linked-two-locus-v1', setup: LINKAGE_TEST_CROSS, sample: { count: 100, seed: 1, included: true } });
  assert.ok(student.files['figures/linkage-parents.svg']); assert.ok(!student.files['authoring.json']); assert.ok(teacher.files['authoring.json']);
  for (const output of [student, teacher]) {
    const manifest = JSON.parse(output.files['manifest.json']); assert.deepEqual(manifest.files.map((file: { path: string }) => file.path).sort(), Object.keys(output.files).filter(path => path !== 'manifest.json').sort());
    for (const file of manifest.files) { assert.equal(file.sha256, createHash('sha256').update(output.files[file.path]).digest('hex')); assert.equal(file.bytes, Buffer.byteLength(output.files[file.path])); }
  }
  assert.deepEqual(student.zip, (await worksheetPackage(sheet, 'student')).zip);
});
test('worksheet omission retains phase but excludes finite data; invalid settings and foreign artifact paths reject', async () => {
  const sheet = await prepareWorksheet(capture, { ...options(), includeData: false, paper: 'Letter' }, null), output = await worksheetPackage(sheet, 'student');
  assert.ok(output.files['figures/linkage-parents.svg']); assert.doesNotMatch(output.files['student.html'], /Observed synthetic offspring|Observed complete-dominance phenotype counts/); assert.match(output.files['student.html'], /size:Letter/);
  await assert.rejects(prepareWorksheet({ ...capture, setup: { ...LINKAGE_TEST_CROSS, recombinationPercent: 51 } } as WorksheetCapture, options(), null));
  await assert.rejects(prepareWorksheet({ ...capture, count: 1001 } as WorksheetCapture, options(), null));
  sheet.files['figures/population-teacher.svg'] = '<svg/>'; await assert.rejects(worksheetPackage(sheet, 'student'), /artifact path/);
});
