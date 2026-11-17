import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sampleTree, classificationSample } from '../src/structured/example.ts';
import { prepareBundledDataset } from '../src/import.ts';
import { parseNewick } from '../src/newick.ts';
import { MAX_LEARN_TIPS, createLearningTree, commonAncestor, checkAncestor, checkClade, rotateLearningBranch, sameLearningRelationships, learningAvailability } from '../src/learn/model.ts';
import type { LearningInput } from '../src/learn/model.ts';

async function fixture() {
  const f = await sampleTree();
  const input: LearningInput = { source: f.source, root: f.project.recipe.root, rootState: f.project.authoring.root, basis: f.project.authoring.basis, corrections: f.project.corrections, childOrder: {}, title: f.project.title, references: [] };
  const tip = (label: string) => f.source.tips.find(id => f.source.nodes[id].rawLabel === label)!;
  return { ...f, input, tip, tree: createLearningTree(input, f.source.tips) };
}
function freeze(value: unknown): void { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) freeze(child); } }

test('ancestor feedback distinguishes the first shared ancestor from an older or unrelated node', async () => {
  const f = await fixture(), ab = commonAncestor(f.tree, f.tip('A'), f.tip('B')), ce = commonAncestor(f.tree, f.tip('C'), f.tip('E'));
  assert.equal(checkAncestor(f.tree, f.tip('A'), f.tip('B'), ab).kind, 'correct');
  assert.equal(checkAncestor(f.tree, f.tip('A'), f.tip('B'), f.rooted.rootId).kind, 'older');
  assert.equal(checkAncestor(f.tree, f.tip('A'), f.tip('B'), ce).kind, 'unrelated');
  assert.throws(() => commonAncestor(f.tree, f.tip('A'), f.tip('A')), /distinct/);
  assert.throws(() => checkAncestor(f.tree, f.tip('A'), f.tip('B'), f.tip('A')), /branching/);
});

test('clade feedback reports missing and extra represented descendants without resolving a polytomy', async () => {
  const f = await fixture(), node = commonAncestor(f.tree, f.tip('C'), f.tip('E'));
  const result = checkClade(f.tree, node, [f.tip('C'), f.tip('A')]);
  assert.deepEqual(result.missing, [f.tip('D'), f.tip('E')]);
  assert.deepEqual(result.extra, [f.tip('A')]);
  assert.equal(checkClade(f.tree, node, [f.tip('E'), f.tip('C'), f.tip('D')]).correct, true);
  const rotated = rotateLearningBranch(f.tree, node);
  assert.equal(rotated.graph.nodes[node].children.length, 3);
  assert.deepEqual(rotated.graph.nodes[node].children, [...f.tree.graph.nodes[node].children].reverse());
  assert.equal(sameLearningRelationships(f.tree, rotated), true);
  assert.equal(commonAncestor(rotated, f.tip('C'), f.tip('E')), node);
});

test('practice and repeated rotations leave a frozen source, project, pins and provenance unchanged', async () => {
  const f = await fixture(), before = JSON.stringify({ input: f.input, project: f.project });
  freeze(f.input); freeze(f.project);
  const node = commonAncestor(f.tree, f.tip('C'), f.tip('E'));
  const twice = rotateLearningBranch(rotateLearningBranch(createLearningTree(f.input, f.source.tips), node), node);
  assert.deepEqual(twice.graph, f.tree.graph);
  assert.equal(JSON.stringify({ input: f.input, project: f.project }), before);
});

test('a sampled clade retains exact full-source counts and omitted identities', async () => {
  const text = await readFile(new URL('../data/datasets/upham-2019.nwk', import.meta.url), 'utf8');
  const f = await prepareBundledDataset('upham-2019', text, null), names = ['Homo_sapiens', 'Pan_troglodytes', 'Gorilla_gorilla'];
  const ids = names.map(name => f.source.tips.find(id => f.source.nodes[id].rawLabel.startsWith(name + '_'))!);
  const input: LearningInput = { source: f.source, root: f.project.recipe.root, rootState: f.project.authoring.root, basis: f.project.authoring.basis, corrections: [], childOrder: {}, title: 'Sample', references: [] };
  const tree = createLearningTree(input, ids), node = commonAncestor(tree, ids[0], ids[1]), answer = checkClade(tree, node, ids.slice(0, 2));
  assert.equal(answer.correct, true); assert.equal(answer.fullSourceCount, 6); assert.equal(answer.omittedCount, 4);
  const rotated = rotateLearningBranch(tree, node);
  assert.equal(sameLearningRelationships(tree, rotated), true);
  assert.equal(rotated.input.source.sha256, f.source.sha256);
  assert.deepEqual(rotated.graph.omittedTips, tree.graph.omittedTips);
});

test('classification, similarity, unspecified entities and absent biological roots cannot produce ancestry answers', async () => {
  const f = await fixture(), c = await classificationSample();
  for (const changed of [
    { ...f.input, basis: c.project.authoring.basis },
    { ...f.input, basis: { ...f.input.basis, relationshipKind: 'similarity' as const } },
    { ...f.input, basis: { ...f.input.basis, entityKind: 'unspecified' as const } },
    { ...f.input, rootState: { status: 'unrooted' as const, explanation: 'No directed root', referenceIds: [] } },
    { ...f.input, rootState: { status: 'unspecified' as const, explanation: 'Serialization only', referenceIds: [] } },
  ]) { assert.ok(learningAvailability(changed)); assert.throws(() => createLearningTree(changed, f.source.tips)); }
});

test('selection bounds and identity checks reject ambiguous answers rather than merging labels', async () => {
  const f = await fixture();
  for (const ids of [[], [f.tip('A')], [f.tip('A'), f.tip('A')], [f.tip('A'), 'unknown']]) assert.throws(() => createLearningTree(f.input, ids));
  const subset = createLearningTree(f.input, [f.tip('A'), f.tip('B')]);
  assert.throws(() => commonAncestor(subset, f.tip('A'), f.tip('C')), /displayed/);
  assert.throws(() => checkClade(subset, commonAncestor(subset, f.tip('A'), f.tip('B')), [f.tip('C')]), /displayed/);
  const source = await parseNewick('(' + Array.from({ length: MAX_LEARN_TIPS + 1 }, (_, i) => `Tip${i}`).join(',') + ');');
  const context = { ...f.input, source, basis: { ...f.input.basis, sourceIds: [`source-${source.sha256}`] } };
  assert.throws(() => createLearningTree(context, source.tips), /between 2/);
  const duplicateSource = await parseNewick('(Same,Same,Different);');
  const duplicateTree = createLearningTree({ ...context, source: duplicateSource, basis: { ...context.basis, sourceIds: [`source-${duplicateSource.sha256}`] } }, duplicateSource.tips);
  assert.equal(duplicateTree.graph.endpoints.length, 3);
  assert.equal(duplicateTree.graph.nodes[duplicateSource.tips[0]].label, duplicateTree.graph.nodes[duplicateSource.tips[1]].label);
  assert.notEqual(duplicateSource.tips[0], duplicateSource.tips[1]);
});

test('a deeply annotated selection is bounded rather than dropping intervening source nodes', async () => {
  const f = await fixture(); let text = '(A,B)';
  for (let i = 0; i < 530; i++) text = `(${text})Named${i}`;
  const source = await parseNewick(text + ';');
  const input = { ...f.input, source, basis: { ...f.input.basis, sourceIds: [`source-${source.sha256}`] } };
  assert.throws(() => createLearningTree(input, source.tips), /too many intervening nodes/);
});
