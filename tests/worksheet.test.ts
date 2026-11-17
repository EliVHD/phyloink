import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { sampleTree } from '../src/structured/example.ts';
import { createLearningTree, commonAncestor } from '../src/learn/model.ts';
import { scenarioFromTree, activityTree } from '../src/learn/scenario.ts';
import { parseNewick } from '../src/newick.ts';
import { defaultRecipe } from '../src/science.ts';
import { prepareBundledDataset } from '../src/import.ts';
import { DEFAULT_STRUCTURED, layoutCluster } from '../src/structured/layout.ts';
import { validateScene } from '../src/structured/validate.ts';
import { defaultWorksheetPrompts, prepareWorksheet, worksheetHTML, worksheetPackage, MAX_WORKSHEET_BYTES } from '../src/learn/worksheet.ts';
import { sampleOffspring } from '../src/learn/inheritance.ts';
import { DRIFT_DEMO } from '../src/learn/population.ts';
import type { LearningInput } from '../src/learn/model.ts';
import type { LearningActivity } from '../src/learn/scenario.ts';
import type { WorksheetCapture, WorksheetDrawing, WorksheetOptions } from '../src/learn/worksheet.ts';
const inheritance: WorksheetCapture = { kind: 'inheritance', setup: { loci: 2, parent1: 'AaBb', parent2: 'AaBb' }, count: 1000, seed: 0 };
const population: WorksheetCapture = { kind: 'population', setup: structuredClone(DRIFT_DEMO) };
const options = (capture: WorksheetCapture): WorksheetOptions => ({ title: 'My worksheet', instructions: 'Explain your reasoning.', teacherNotes: 'PRIVATE_EDUCATOR_NOTE', paper: 'A4', answerLines: 3, tipCodes: true, includeData: true, prompts: defaultWorksheetPrompts(capture) });
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
function freeze(value: unknown): void { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) freeze(child); } }
// Deliberately estimated unit-test metrics. Runtime worksheets require actual browser measurement.
const draw: WorksheetDrawing = async (tree, kind, codes) => {
  const graph = structuredClone(tree.graph); if (codes) for (const [i, id] of tree.tipIds.entries()) graph.nodes[id].label = `T${i + 1}`;
  const settings = { ...DEFAULT_STRUCTURED, kind, widthMm: 150, heightMm: 140, fontSizePt: 14, curves: false, labelPlacement: 'horizontal' as const, innerRadiusMm: 5, outerRadiusMm: 42 };
  const measurements = { fontFamily: settings.fontFamily, fontSizePt: settings.fontSizePt, fontStatus: 'estimated' as const, metrics: Object.fromEntries(graph.endpoints.map(id => [id, { text: graph.nodes[id].label, widthMm: graph.nodes[id].label.length * 2.1, ascentMm: 3.5, descentMm: 1 }])) };
  const scene = layoutCluster(graph, settings, measurements); return { scene, qa: validateScene(graph, scene), findings: ['Estimated unit-test font metrics; browser measurement required for delivery.'] };
};
async function treeFixture() {
  const f = await sampleTree(), input: LearningInput = { source: f.source, root: f.project.recipe.root, rootState: f.project.authoring.root, basis: f.project.authoring.basis, corrections: [], childOrder: {}, title: f.project.title, references: [] }, tree = createLearningTree(input, f.source.tips);
  const pair = f.source.tips.slice(0, 2) as [string, string], nodeId = commonAncestor(tree, ...pair), common = { prompt: 'Original prompt to replace', layout: 'circular' as const, rotations: [] };
  const activities: LearningActivity[] = [{ ...common, id: 'ancestor', kind: 'ancestor', tipIds: pair }, { ...common, id: 'clade', kind: 'clade', nodeId }, { ...common, id: 'compare', kind: 'compare', rotations: [tree.rooted.rootId, nodeId] }];
  const scenario = scenarioFromTree(tree, { title: 'Example', introduction: '', teacherNotes: 'OLD_SCENARIO_NOTE', tipCodes: false }, activities);
  return { ...f, tree, capture: { kind: 'tree' as const, scenario } };
}

test('student and teacher packages stay separate, with explicit editable prompts and no learner fields', async () => {
  const capture = { ...inheritance, learnerAnswer: 'LEARNER_SECRET', feedback: 'PROGRESS_SECRET' }, settings = { ...options(inheritance), currentAnswer: 'LEARNER_SECRET' }; freeze(capture); freeze(settings);
  const prepared = await prepareWorksheet(capture, settings, null), student = await worksheetPackage(prepared, 'student'), teacher = await worksheetPackage(prepared, 'teacher');
  assert.ok(!Object.hasOwn(student.files, 'authoring.json')); assert.ok(Object.hasOwn(teacher.files, 'authoring.json'));
  assert.doesNotMatch(JSON.stringify(student.files), /PRIVATE_EDUCATOR_NOTE|LEARNER_SECRET|PROGRESS_SECRET|Configured source\/model reference/);
  assert.doesNotMatch(JSON.stringify(teacher.files), /LEARNER_SECRET|PROGRESS_SECRET/); assert.match(teacher.files['teacher.html'], /PRIVATE_EDUCATOR_NOTE/);
  assert.match(student.files['README.txt'], /STUDENT PACKAGE/); assert.match(teacher.files['README.txt'], /TEACHER PACKAGE/);
  assert.equal(student.files['student.txt'].split('Answer:').length - 1, 3);
});
test('escaped plain-text authoring cannot create active HTML, SVG, remote embeds or executable worksheet content', async () => {
  const bad = '<img src="https://example.invalid/pixel" onerror="alert(1)"><script>globalThis.bad=true</script>';
  const settings = options(inheritance); settings.title = bad; settings.instructions = bad; settings.teacherNotes = bad; settings.prompts[0] = bad;
  const sheet = await prepareWorksheet(inheritance, settings, null), html = worksheetHTML(sheet, 'teacher');
  assert.doesNotMatch(html, /<script|<img|<iframe|<[^>]+onerror=/); // Attribute-like text is escaped, not executable.
  assert.match(html, /&lt;img/); assert.match(html, /default-src 'none'/); assert.match(html, /style-src 'unsafe-inline'/);
  assert.match(worksheetHTML(sheet, 'student'), /Name: /);
});
test('tree exports rebuild all configured questions without answer overlays and retain exact memberships/paths', async () => {
  const f = await treeFixture(), settings = options(f.capture); settings.prompts = ['My ancestor prompt', 'My clade prompt', 'My comparison prompt']; const before = JSON.stringify(f); freeze(f);
  const sheet = await prepareWorksheet(f.capture, settings, null, draw), student = await worksheetPackage(sheet, 'student'), teacher = await worksheetPackage(sheet, 'teacher');
  assert.equal(JSON.stringify(f), before); assert.equal(sheet.questions.length, 3); assert.equal(Object.keys(sheet.files).filter(path => path.endsWith('.svg')).length, 4);
  assert.doesNotMatch(JSON.stringify(student.files), /OLD_SCENARIO_NOTE|Original prompt to replace|PRIVATE_EDUCATOR_NOTE|data-learn-node|aria-pressed/);
  const context = JSON.parse(student.files['context.json']).setup;
  for (const [i, activity] of f.capture.scenario.activities.entries()) {
    const graph = activityTree(f.tree, activity).graph; assert.deepEqual(context.drawings.find((drawing: { question: number; drawing: number }) => drawing.question === i + 1 && drawing.drawing === (activity.kind === 'compare' ? 2 : 1)).graph, graph);
    assert.equal(context.activities[i].prompt, settings.prompts[i]);
  }
  assert.match(teacher.files['teacher.html'], /first shared ancestor|Displayed descendants|relationships are the same/);
  assert.match(student.files['student.html'], /Draft drawing findings/); assert.ok(context.drawings.every((drawing: { qa: { status: string } }) => drawing.qa.status === 'draft'));
  assert.equal(student.files['source.nwk'], f.source.text); assert.equal(sha(student.files['source.nwk']), f.source.sha256);
});
test('original BOM/CRLF Newick bytes and duplicate source identities survive worksheet packaging', async () => {
  const f = await sampleTree(), source = await parseNewick('\uFEFF(Same:1,Same:2,(C:1,D:1,E:1):2);\r\n'), recipe = defaultRecipe(source);
  const input: LearningInput = { source, root: recipe.root, rootState: f.project.authoring.root, basis: { ...f.project.authoring.basis, sourceIds: [`source-${source.sha256}`] }, corrections: [], childOrder: {}, title: 'Duplicates', references: [] }, tree = createLearningTree(input, source.tips);
  const scenario = scenarioFromTree(tree, { title: 'Duplicate identities', introduction: '', teacherNotes: '', tipCodes: true }, [{ id: 'compare', kind: 'compare', prompt: 'Compare.', layout: 'rectangular', rotations: [] }]), capture: WorksheetCapture = { kind: 'tree', scenario };
  const output = await worksheetPackage(await prepareWorksheet(capture, options(capture), null, draw), 'student');
  assert.equal(output.files['source.nwk'], source.text); assert.equal(sha(output.files['source.nwk']), source.sha256);
  assert.equal(JSON.parse(output.files['context.json']).setup.tipIds.length, 5); assert.equal(new Set(source.tips).size, 5);
});
test('bundled source citations/rights stay protected and sampled omissions remain explicit', async () => {
  const f = await prepareBundledDataset('upham-2019', await readFile('data/datasets/upham-2019.nwk', 'utf8'), null);
  const tree = createLearningTree({ source: f.source, root: f.project.recipe.root, rootState: f.project.authoring.root, basis: f.project.authoring.basis, title: 'Mammals', corrections: [], childOrder: {}, references: Object.values(f.project.authoring.provenance.references) }, [f.source.tips[0], f.source.tips[Math.floor(f.source.tips.length / 2)], f.source.tips.at(-1)!]);
  const scenario = scenarioFromTree(tree, { title: 'Mammals', introduction: '', teacherNotes: '', tipCodes: true }, [{ id: 'clade', kind: 'clade', prompt: 'Explain omissions.', nodeId: tree.rooted.rootId, layout: 'rectangular', rotations: [] }]), capture: WorksheetCapture = { kind: 'tree', scenario };
  const sheet = await prepareWorksheet(capture, options(capture), null, draw), files = (await worksheetPackage(sheet, 'student')).files;
  assert.match(files['student.html'], /4096 tips omitted|4096.*omitted/); assert.match(sheet.questions[0].answer, /omitted.*4096/); assert.ok(sheet.sources.some(source => source.includes('CC0')));
  const changed = structuredClone(capture); changed.scenario.context.references[0].license = '0BSD'; await assert.rejects(prepareWorksheet(changed, options(changed), null, draw), /citation|reference|Bundled/i);
});
test('inheritance samples are regenerated from setups/seeds with all counts and optional data omission', async () => {
  const sheet = await prepareWorksheet(inheritance, options(inheritance), null), sample = sampleOffspring(inheritance.setup, inheritance.count, inheritance.seed);
  for (const row of sample.genotypes) assert.ok(sheet.studentData.includes(`<th scope="row">${row.label}</th><td>${row.count}</td>`));
  assert.match(sheet.teacherData, /Expected probabilities/); assert.doesNotMatch(sheet.studentData, /Expected probabilities/);
  const settings = options(inheritance); settings.includeData = false; const omitted = await prepareWorksheet(inheritance, settings, null); assert.equal(omitted.studentData, ''); assert.ok(omitted.teacherData.includes('Expected probabilities'));
});
test('population exports retain complete CSV generation counts and role-specific plots without leaking the reference', async () => {
  const capture: WorksheetCapture = { kind: 'population', setup: { ...DRIFT_DEMO, size: 500, aCopies: 500, generations: 100, replicates: 8, seed: 4294967295 } }, sheet = await prepareWorksheet(capture, options(capture), null);
  const student = await worksheetPackage(sheet, 'student'), teacher = await worksheetPackage(sheet, 'teacher');
  assert.ok(!student.files['figures/population-teacher.svg']); assert.ok(!teacher.files['figures/population-student.svg']);
  assert.doesNotMatch(student.files['figures/population-student.svg'], /#172e25/); assert.match(teacher.files['figures/population-teacher.svg'], /#172e25/);
  const rows = student.files['population-counts.csv'].trim().split('\r\n'); assert.equal(rows.length, 809);
  for (const row of rows.slice(1)) { const [, generation, a, b] = row.split(',').map(Number); assert.equal(a + b, 1000); assert.ok(generation >= 0 && generation <= 100); }
  assert.match(sheet.studentData, /Selected generations 0, 50, 100/);
  const settings = options(capture); settings.includeData = false; const omitted = await prepareWorksheet(capture, settings, null); assert.equal(omitted.studentData, ''); assert.equal(Object.keys(omitted.files).length, 0);
});
test('oversized or invalid measured figures reject without shrinking labels or changing a setup', async () => {
  const f = await treeFixture(); await assert.rejects(prepareWorksheet(f.capture, options(f.capture), null), /browser font/);
  for (const maxX of [1000, NaN]) await assert.rejects(prepareWorksheet(f.capture, options(f.capture), null, async (...args) => { const value = await draw(...args); value.scene.bounds.maxX = maxX; return value; }), /printable|bounds/);
  const source = await parseNewick('('.repeat(10) + '(' + Array.from({ length: 30000 }, (_, i) => `T${i}`).join(',') + ')' + ')'.repeat(10) + ';'), recipe = defaultRecipe(source);
  const input: LearningInput = { ...f.tree.input, source, root: recipe.root, basis: { ...f.tree.input.basis, sourceIds: [`source-${source.sha256}`] } }, tree = createLearningTree(input, source.tips.slice(0, 2));
  const scenario = scenarioFromTree(tree, { title: 'Large exact memberships', introduction: '', teacherNotes: '', tipCodes: true }, Array.from({ length: 12 }, (_, i) => ({ id: `question-${i + 1}`, kind: 'compare' as const, prompt: 'Compare.', layout: 'rectangular' as const, rotations: [] }))), capture: WorksheetCapture = { kind: 'tree', scenario };
  await assert.rejects(prepareWorksheet(capture, options(capture), null, draw), /1,000,000/); assert.equal(source.tips.length, 30000);
});
test('authoring bounds, artifact allowlists, source changes and package work limits reject atomically', async () => {
  for (const patch of [{ title: '' }, { paper: 'A3' }, { answerLines: 1 }, { answerLines: 9 }, { prompts: [] }, { prompts: ['x'.repeat(5001), 'x', 'x'] }]) await assert.rejects(prepareWorksheet(inheritance, { ...options(inheritance), ...patch } as WorksheetOptions, null));
  const sheet = await prepareWorksheet(population, options(population), null); sheet.files['../private.txt'] = 'not allowed'; await assert.rejects(worksheetPackage(sheet, 'student'), /artifact path/); delete sheet.files['../private.txt'];
  sheet.files['figures/population-student.svg'] = 'x'.repeat(MAX_WORKSHEET_BYTES + 1); await assert.rejects(worksheetPackage(sheet, 'student'), /30 MB/);
  const largeContext = await prepareWorksheet(population, options(population), null); largeContext.context = { record: 'x'.repeat(MAX_WORKSHEET_BYTES + 1) }; await assert.rejects(worksheetPackage(largeContext, 'student'), /30 MB/);
  const f = await treeFixture(), tree = await prepareWorksheet(f.capture, options(f.capture), null, draw); tree.files['source.nwk'] += '\n'; await assert.rejects(worksheetPackage(tree, 'student'), /source text changed/);
});
test('A4/Letter exports are deterministic with exact inventories, payload hashes and valid ZIP signatures', async () => {
  for (const paper of ['A4', 'Letter'] as const) {
    const settings = { ...options(inheritance), paper }, sheet = await prepareWorksheet(inheritance, settings, null), output = await worksheetPackage(sheet, 'student');
    assert.deepEqual((await worksheetPackage(sheet, 'student')).zip, output.zip); assert.match(output.files['student.html'], new RegExp(`size:${paper}`));
    const manifest = JSON.parse(output.files['manifest.json']); assert.deepEqual(manifest.files.map((file: { path: string }) => file.path).sort(), Object.keys(output.files).filter(path => path !== 'manifest.json').sort());
    for (const file of manifest.files) { assert.equal(file.sha256, sha(output.files[file.path])); assert.equal(file.bytes, Buffer.byteLength(output.files[file.path])); }
    assert.equal(new DataView(output.zip.buffer).getUint32(0, true), 0x04034b50); assert.equal(manifest.audience, 'student');
  }
});
