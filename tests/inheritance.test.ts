import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMendelianCross, MAX_OFFSPRING, parseProbability, probabilityText, sampleOffspring } from '../src/learn/inheritance.ts';
import type { CrossSetup } from '../src/learn/inheritance.ts';
const mono: CrossSetup = { loci: 1, parent1: 'Aa', parent2: 'Aa' };
const di: CrossSetup = { loci: 2, parent1: 'AaBb', parent2: 'AaBb' };

test('Aa crosses separate genotype 1:2:1 from complete-dominance phenotype 3:1', () => {
  const cross = createMendelianCross(mono);
  assert.deepEqual(cross.gametes1, [{ alleles: 'A', ways: 1, denominator: 2 }, { alleles: 'a', ways: 1, denominator: 2 }]);
  assert.deepEqual(cross.genotypes.map(row => [row.label, row.ways]), [['AA', 1], ['Aa', 2], ['aa', 1]]);
  assert.deepEqual(cross.phenotypes.map(row => [row.label, row.ways]), [['A_', 3], ['aa', 1]]);
  assert.deepEqual(cross.cells.map(cell => cell.genotype), ['AA', 'Aa', 'Aa', 'aa']);
  assert.ok(cross.cells.every(cell => cell.denominator === 4));
});
test('test crosses and homozygotes retain zero-probability outcomes and weighted gametes', () => {
  const cross = createMendelianCross({ ...mono, parent2: 'aa' });
  assert.deepEqual(cross.genotypes.map(row => row.ways), [0, 2, 2]);
  assert.deepEqual(cross.gametes2, [{ alleles: 'a', ways: 2, denominator: 2 }]);
  assert.deepEqual(cross.cells.map(cell => probabilityText(cell)), ['1/2', '1/2']);
  const fixed = createMendelianCross({ loci: 2, parent1: 'AAbb', parent2: 'aaBB' });
  assert.equal(fixed.cells.length, 1); assert.equal(fixed.cells[0].genotype, 'AaBb'); assert.equal(probabilityText(fixed.cells[0]), '1/1');
  assert.equal(fixed.genotypes.find(row => row.label === 'AaBb')!.ways, 16);
  assert.equal(probabilityText(fixed.phenotypes.at(-1)!), '0/1');
});
test('independent AaBb crosses yield four equally likely gametes and 9:3:3:1 phenotypes', () => {
  const cross = createMendelianCross(di);
  assert.deepEqual(cross.gametes1.map(row => row.alleles), ['AB', 'Ab', 'aB', 'ab']);
  assert.ok(cross.gametes1.every(row => probabilityText(row) === '1/4'));
  assert.equal(cross.cells.length, 16); assert.ok(cross.cells.every(row => probabilityText(row) === '1/16'));
  assert.deepEqual(cross.phenotypes.map(row => row.ways), [9, 3, 3, 1]);
  assert.deepEqual(cross.genotypes.map(row => row.ways), [1, 2, 1, 2, 4, 2, 1, 2, 1]);
});
test('all 81 two-locus parental pairs factor into independent one-locus distributions and preserve parent symmetry', () => {
  const parents = ['AA', 'Aa', 'aa'].flatMap(a => ['BB', 'Bb', 'bb'].map(b => a + b));
  for (const parent1 of parents) for (const parent2 of parents) {
    const cross = createMendelianCross({ loci: 2, parent1, parent2 });
    const a = createMendelianCross({ loci: 1, parent1: parent1.slice(0, 2), parent2: parent2.slice(0, 2) });
    const b = createMendelianCross({ loci: 1, parent1: parent1.slice(2).replaceAll('B', 'A').replaceAll('b', 'a'), parent2: parent2.slice(2).replaceAll('B', 'A').replaceAll('b', 'a') });
    for (const row of cross.genotypes) assert.equal(row.ways, a.genotypes.find(x => x.label === row.label.slice(0, 2))!.ways * b.genotypes.find(x => x.label === row.label.slice(2).replaceAll('B', 'A').replaceAll('b', 'a'))!.ways);
    for (const rows of [cross.cells, cross.genotypes, cross.phenotypes]) { assert.equal(rows.reduce((sum, row) => sum + row.ways, 0), 16); assert.ok(rows.every(row => Number.isInteger(row.ways) && row.ways >= 0 && row.denominator === 16)); }
    for (const choices of [cross.gametes1, cross.gametes2]) assert.equal(choices.reduce((sum, row) => sum + row.ways, 0), 4);
    const reversed = createMendelianCross({ loci: 2, parent1: parent2, parent2: parent1 });
    assert.deepEqual(reversed.genotypes, cross.genotypes); assert.deepEqual(reversed.phenotypes, cross.phenotypes);
  }
});
test('invalid loci and noncanonical or missing allele pairs reject without changing caller state', () => {
  const before = JSON.stringify(mono); Object.freeze(mono); createMendelianCross(mono);
  for (const bad of [null, {}, { ...mono, loci: 0 }, { ...mono, loci: 3 }, { ...mono, parent1: 'aA' }, { ...mono, parent2: 'BB' }, { ...di, parent1: 'Aa' }, { ...di, parent2: 'AaCc' }, { ...di, parent2: 'AaBbx' }, { ...mono, parent1: ['A', 'a'] }]) assert.throws(() => createMendelianCross(bad as CrossSetup));
  assert.equal(JSON.stringify(mono), before);
});
test('seeded samples replay exactly and retain each parental gamete and all counted offspring', () => {
  assert.deepEqual(sampleOffspring(di, 8, 1).offspring.map(child => child.genotype), ['AaBB', 'aaBb', 'Aabb', 'aaBB', 'Aabb', 'AAbb', 'AABb', 'AABB']);
  const sample = sampleOffspring(di, 1000, 0);
  assert.deepEqual(sampleOffspring(di, 1000, 0), sample);
  assert.deepEqual(sampleOffspring(di, 32, 0).offspring, sample.offspring.slice(0, 32));
  assert.equal(sample.offspring.length, 1000); assert.equal(sample.genotypes.reduce((sum, row) => sum + row.count, 0), 1000); assert.equal(sample.phenotypes.reduce((sum, row) => sum + row.count, 0), 1000);
  for (const child of sample.offspring) {
    for (const gamete of [child.parent1, child.parent2]) assert.ok(['AB', 'Ab', 'aB', 'ab'].includes(gamete));
    assert.equal(child.genotype, [...child.parent1].map((allele, i) => [allele, child.parent2[i]].sort().join('')).join(''));
  }
  assert.notDeepEqual(sampleOffspring(di, 32, 1).offspring, sample.offspring.slice(0, 32));
});
test('finite samples need not follow expected ratios; fixed parental genotypes never invent alleles', () => {
  const sample = sampleOffspring(mono, 1, 1);
  assert.equal(sample.offspring.length, 1); assert.ok(sample.phenotypes.some(row => row.count === 0));
  const fixed = sampleOffspring({ loci: 2, parent1: 'AAbb', parent2: 'aaBB' }, 1000, 4294967295);
  assert.ok(fixed.offspring.every(child => child.parent1 === 'Ab' && child.parent2 === 'aB' && child.genotype === 'AaBb' && child.phenotype === 'A_ B_'));
  assert.equal(fixed.genotypes.filter(row => row.count === 0).length, 8);
});
test('bounded sampling rejects invalid sizes and seeds, including blank-like and nonfinite values', () => {
  assert.equal(MAX_OFFSPRING, 1000);
  for (const count of [0, -1, 1001, 1.5, NaN, Infinity, '32', null]) assert.throws(() => sampleOffspring(mono, count as number, 1), /Sample size/);
  for (const seed of [-1, 4294967296, .5, NaN, Infinity, '1', null]) assert.throws(() => sampleOffspring(mono, 32, seed as number), /Seed/);
  assert.equal(sampleOffspring(mono, 1, 0).count, 1); assert.equal(sampleOffspring(mono, 1, 4294967295).count, 1);
});
test('probability answers accept explicit fractions, decimals and percentages and reject executable or ambiguous input', () => {
  for (const text of ['1/4', ' 1 / 4 ', '0.25', '.25', '25%']) assert.equal(parseProbability(text), .25);
  assert.equal(parseProbability('6.25%'), 1 / 16); assert.equal(parseProbability('0'), 0); assert.equal(parseProbability('1'), 1);
  for (const text of ['', ' ', '1/0', '2', '101%', '-1', 'Infinity', 'NaN', '1e-2', '3:1', '1+1', '<script>', '0.5;alert(1)', '0'.repeat(33)]) assert.throws(() => parseProbability(text));
});
