import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sampleTree } from '../src/structured/example.ts';
import { parseNewick } from '../src/newick.ts';
import { prepareBundledDataset } from '../src/import.ts';
import { createLearningTree, commonAncestor, sameLearningRelationships } from '../src/learn/model.ts';
import { MAX_ACTIVITIES, activityTree, prepareScenario, scenarioFromTree } from '../src/learn/scenario.ts';
import type { LearningInput } from '../src/learn/model.ts';
import type { LearningActivity, LearningScenario } from '../src/learn/scenario.ts';

async function fixture() {
  const f = await sampleTree();
  const input: LearningInput = { source: f.source, root: f.project.recipe.root, rootState: f.project.authoring.root, basis: f.project.authoring.basis, corrections: [], childOrder: {}, title: f.project.title, references: [] };
  const tree = createLearningTree(input, f.source.tips);
  const common = { prompt: 'Explain the branching connections.', layout: 'circular' as const, rotations: [] };
  const pair = f.source.tips.slice(0, 2) as [string, string], nodeId = commonAncestor(tree, ...pair);
  const activities: LearningActivity[] = [{ ...common, id: 'ancestor-1', kind: 'ancestor', tipIds: pair }, { ...common, id: 'clade-1', kind: 'clade', nodeId }, { ...common, id: 'compare-1', kind: 'compare', rotations: [tree.rooted.rootId, nodeId] }];
  const scenario = scenarioFromTree(tree, { title: 'Adaptable example', introduction: 'A starting point.', teacherNotes: 'Adapt for your learners; these notes are visible.', tipCodes: false }, activities);
  return { ...f, input, tree, scenario };
}
const serialize = (value: unknown) => JSON.stringify(value);

test('a self-contained scenario round-trips source, context and question setups without project or answer state', async () => {
  const f = await fixture(), before = serialize(f.project);
  const prepared = await prepareScenario(serialize(f.scenario));
  assert.deepEqual(prepared.scenario, f.scenario);
  assert.deepEqual(prepared.tree.graph, f.tree.graph);
  assert.equal(serialize(f.project), before);
  assert.deepEqual(Object.keys(prepared.scenario).sort(), ['format', 'version', 'title', 'introduction', 'teacherNotes', 'source', 'context', 'tipIds', 'tipCodes', 'activities'].sort());
  assert.ok(!/"(?:answers|progress|views|layout|provenance)":/.test(serialize(f.scenario).replaceAll('"layout":"circular"', '')));
});

test('embedded Unicode, CRLF, comments and duplicate labels retain exact text and distinct identities', async () => {
  const f = await fixture(), source = await parseNewick("(\r\n  'Même nom'[one], 'Même nom'[two], Third\r\n);\r\n");
  const input = { ...f.input, source, root: { kind: 'node' as const, sourceNodeId: source.rootId, status: 'declared_assumption' }, basis: { ...f.input.basis, sourceIds: [`source-${source.sha256}`] } };
  const tree = createLearningTree(input, source.tips), question: LearningActivity = { id: 'q', kind: 'ancestor', prompt: 'Follow identities.', layout: 'rectangular', rotations: [], tipIds: source.tips.slice(0, 2) as [string, string] };
  const scenario = scenarioFromTree(tree, f.scenario, [question]);
  const loaded = await prepareScenario(serialize(scenario));
  assert.equal(loaded.tree.input.source.text, source.text); assert.equal(loaded.tree.input.source.sha256, source.sha256);
  assert.notEqual(loaded.tree.tipIds[0], loaded.tree.tipIds[1]);
  assert.equal(commonAncestor(loaded.tree, ...question.tipIds), source.rootId);
});

test('question replay preserves polytomies, source paths and a frozen base while reversing complete subtrees', async () => {
  const f = await fixture(), nodeId = commonAncestor(f.tree, f.source.tips[2], f.source.tips[4]);
  const before = serialize(f.tree);
  Object.freeze(f.tree.childOrder); Object.freeze(f.tree.tipIds);
  const question: LearningActivity = { id: 'q', kind: 'compare', prompt: 'Same relationships?', layout: 'circular', rotations: [nodeId] };
  const rotated = activityTree(f.tree, question);
  assert.equal(rotated.graph.nodes[nodeId].children.length, 3);
  assert.deepEqual(rotated.graph.nodes[nodeId].children, [...f.tree.graph.nodes[nodeId].children].reverse());
  assert.ok(sameLearningRelationships(f.tree, rotated)); assert.equal(serialize(f.tree), before);
  assert.deepEqual(activityTree(f.tree, { ...question, rotations: [nodeId, nodeId] }).graph, f.tree.graph);
});

test('changed source, foreign identities, malformed roots and incompatible versions reject before applying a scenario', async () => {
  const f = await fixture();
  const changes: ((s: LearningScenario) => void)[] = [
    s => { s.source.newick += ' '; },
    s => { (s as unknown as { version: number }).version = 2; },
    s => { s.context.rootState = { status: 'unrooted', explanation: 'Undirected.', referenceIds: [] }; },
    s => { s.context.basis.relationshipKind = 'classification'; },
    s => { s.tipIds[0] = 'foreign'; },
    s => { (s.activities[0] as Extract<LearningActivity, { kind: 'ancestor' }>).tipIds = [f.source.tips[0], f.source.tips[0]]; },
    s => { (s.activities[1] as Extract<LearningActivity, { kind: 'clade' }>).nodeId = f.source.tips[0]; },
    s => { s.context.childOrder[f.tree.rooted.rootId] = [f.source.tips[0]]; },
  ];
  for (const change of changes) { const scenario = structuredClone(f.scenario); change(scenario); await assert.rejects(prepareScenario(serialize(scenario))); }
  assert.equal(f.scenario.source.sha256, f.source.sha256);
});

test('unknown answer fields, duplicate questions and excessive setups or rotations cannot enter the format', async () => {
  const f = await fixture();
  for (const mutate of [
    (s: LearningScenario) => Object.assign(s, { answers: { q: 'correct' } }),
    (s: LearningScenario) => Object.assign(s.activities[0], { answer: 'secret' }),
    (s: LearningScenario) => s.activities.push(structuredClone(s.activities[0])),
    (s: LearningScenario) => { s.activities = Array.from({ length: MAX_ACTIVITIES + 1 }, (_, i) => ({ ...s.activities[0], id: `q${i}` })); },
    (s: LearningScenario) => { s.activities[0].rotations = Array(33).fill(f.tree.rooted.rootId); },
    (s: LearningScenario) => { s.activities[0].prompt = 'x'.repeat(5001); },
  ]) { const scenario = structuredClone(f.scenario); mutate(scenario); await assert.rejects(prepareScenario(serialize(scenario))); }
});

test('canonical bundled citations and rights are protected; custom citations remain unverified and local', async () => {
  const sourceText = await readFile(new URL('../data/datasets/upham-2019.nwk', import.meta.url), 'utf8');
  const f = await prepareBundledDataset('upham-2019', sourceText, null);
  const input: LearningInput = { source: f.source, root: f.project.recipe.root, rootState: f.project.authoring.root, basis: f.project.authoring.basis, corrections: [], childOrder: {}, title: 'Mammals', references: Object.values(f.project.authoring.provenance.references) };
  const tree = createLearningTree(input, f.source.tips.slice(0, 3));
  const scenario = scenarioFromTree(tree, { title: 'Example', introduction: '', teacherNotes: '', tipCodes: false }, [{ id: 'q', kind: 'compare', prompt: 'Compare.', layout: 'circular', rotations: [] }]);
  await prepareScenario(serialize(scenario));
  for (const mutate of [
    (s: LearningScenario) => { s.context.references[0].title = 'Changed canonical title'; },
    (s: LearningScenario) => { s.context.basis.rightsRecordIds = []; },
    (s: LearningScenario) => { s.context.references = []; },
  ]) { const changed = structuredClone(scenario); mutate(changed); await assert.rejects(prepareScenario(serialize(changed))); }
  const custom = structuredClone(scenario.context.references[0]); custom.id = 'teacher-citation'; custom.verification = 'unverified'; custom.url = 'https://example.invalid/no-fetch';
  scenario.context.references.push(custom); scenario.context.basis.referenceIds.push(custom.id);
  await prepareScenario(serialize(scenario));
  custom.verification = 'verified-source'; await assert.rejects(prepareScenario(serialize(scenario)), /verified status/);
});

test('label corrections cannot overwrite raw identities or smuggle additional fields', async () => {
  const f = await fixture(), id = f.source.tips[0];
  f.scenario.context.corrections = [{ source_node_id: id, raw_label: f.source.nodes[id].rawLabel, status: 'display-only', display_taxonomy: '<img src=x onerror=alert(1)>', evidence_url: null, review_date: '2026-11-11' }];
  const loaded = await prepareScenario(serialize(f.scenario)); assert.match(loaded.tree.graph.nodes[id].label, /<img/);
  f.scenario.context.corrections[0].raw_label = 'Wrong source label'; await assert.rejects(prepareScenario(serialize(f.scenario)), /original source/);
});
