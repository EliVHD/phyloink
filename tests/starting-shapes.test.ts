import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sampleTree } from '../src/structured/example.ts';
import { parseNewick } from '../src/newick.ts';
import { defaultRecipe, orient, reduce } from '../src/science.ts';
import { DEFAULT_PRESENTATION, generateLayout, pathData } from '../src/geometry.ts';
import { STARTING_SHAPES, createStartingLayout, previewStartingShape } from '../src/starting-shapes.ts';
import { acceptCommand, isCurrentResult } from '../src/commands.ts';
import { documentFromWorking, treeRevision, loadAnyProject, serializeProject } from '../src/project-v2.ts';
import { History } from '../src/project.ts';
import { exportFiles } from '../src/export.ts';
import { METHOD_REGISTRY } from '../src/provenance/registry.ts';
import type { StartingShape } from '../src/starting-shapes.ts';
function freeze(value: unknown): void { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) freeze(child); } }

test('five deterministic forms preserve exact source identities, polytomies, ordering and frozen caller state', async () => {
  const f = await sampleTree(), before = JSON.stringify(f); freeze(f);
  const distinct = new Set<string>();
  for (const { id } of STARTING_SHAPES) {
    const layout = createStartingLayout(f.rooted, f.reduction, DEFAULT_PRESENTATION, f.project.layout, id);
    assert.deepEqual(layout, createStartingLayout(f.rooted, f.reduction, DEFAULT_PRESENTATION, f.project.layout, id));
    assert.deepEqual(Object.keys(layout.nodes).sort(), f.reduction.visible.toSorted());
    assert.deepEqual(layout.childOrder, f.project.layout.childOrder);
    for (const nodeId of f.reduction.visible) {
      const point = layout.nodes[nodeId]; assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
      const parent = f.rooted.nodes[nodeId].parent;
      if (parent) assert.deepEqual(layout.routes[nodeId].segments.at(-1)!.end, point);
    }
    assert.equal(f.rooted.nodes[f.rooted.nodes[f.source.tips[2]].parent!].children.length, 3);
    distinct.add(JSON.stringify(layout.nodes));
  }
  assert.equal(distinct.size, 5); assert.equal(JSON.stringify(f), before);
});

test('pins reject conflicts, including a hidden edge whose incident parent remains visible', async () => {
  const f = await sampleTree(), pinned = structuredClone(f.project.layout);
  pinned.pinnedNodes = [f.rooted.rootId]; const before = structuredClone(pinned);
  assert.throws(() => createStartingLayout(f.rooted, f.reduction, DEFAULT_PRESENTATION, pinned, 'radial'), /conflicts with pinned junction/);
  assert.deepEqual(pinned, before);
  const hidden = f.source.tips[2], group = f.rooted.nodes[hidden].parent!;
  const recipe = { ...f.project.recipe, collapse: [group] }; delete recipe.resolvedFrontierSourceNodeIds;
  const reduced = reduce(f.source, f.rooted, recipe); assert.ok(!reduced.visible.includes(hidden));
  const edgePinned = structuredClone(f.project.layout); edgePinned.pinnedEdges = [hidden];
  assert.throws(() => createStartingLayout(f.rooted, reduced, DEFAULT_PRESENTATION, edgePinned, 'radial'), /conflicts with pinned edge/);
  assert.deepEqual(edgePinned.routes[hidden], f.project.layout.routes[hidden]);
});

test('compatible hard pins and hidden artwork remain byte-identical, with straight mode and child order retained', async () => {
  const f = await sampleTree(), current = structuredClone(f.project.layout), group = f.rooted.nodes[f.source.tips[2]].parent!;
  current.childOrder[f.rooted.rootId] = [...f.rooted.nodes[f.rooted.rootId].children].reverse(); current.lineStyle = 'straight';
  const recipe = { ...f.project.recipe, collapse: [group] }; delete recipe.resolvedFrontierSourceNodeIds;
  const reduced = reduce(f.source, f.rooted, recipe);
  let result = createStartingLayout(f.rooted, reduced, DEFAULT_PRESENTATION, current, 'horizontal');
  const hiddenIds = Object.keys(current.nodes).filter(id => !reduced.visible.includes(id));
  for (const id of hiddenIds) { assert.deepEqual(result.nodes[id], current.nodes[id]); assert.deepEqual(result.routes[id], current.routes[id]); }
  result.pinnedNodes = [f.rooted.rootId]; result.pinnedEdges = [f.source.tips[0]];
  const before = JSON.stringify(result); result = createStartingLayout(f.rooted, reduced, DEFAULT_PRESENTATION, result, 'horizontal');
  assert.equal(JSON.stringify(result), before); assert.equal(result.lineStyle, 'straight');
  for (const id of reduced.visible) if (f.rooted.nodes[id].parent) assert.doesNotMatch(pathData(f.rooted, result, id), /C/);
});

test('source lengths do not determine nonmetric forms; single tips, unary chains and duplicate labels retain identities', async () => {
  for (const text of ['Only;', '(((A:0,B:100)));', '(Same,Same,Different);']) {
    const source = await parseNewick(text), recipe = defaultRecipe(source); recipe.globalThreshold = 0;
    const rooted = orient(source, recipe.root), reduction = reduce(source, rooted, recipe), current = generateLayout(rooted, reduction, DEFAULT_PRESENTATION, 'organic');
    for (const { id } of STARTING_SHAPES) {
      const result = createStartingLayout(rooted, reduction, DEFAULT_PRESENTATION, current, id);
      assert.equal(Object.keys(result.nodes).length, reduction.visible.length);
      assert.ok(Object.values(result.nodes).every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
    }
  }
  const layouts = [];
  for (const text of ['((A:1,B:2):3,C:4);', '((A:1000,B:0):0.001,C:9999);']) {
    const source = await parseNewick(text), recipe = defaultRecipe(source); recipe.globalThreshold = 0;
    const rooted = orient(source, recipe.root), reduction = reduce(source, rooted, recipe), current = generateLayout(rooted, reduction, DEFAULT_PRESENTATION, 'organic');
    layouts.push(createStartingLayout(rooted, reduction, DEFAULT_PRESENTATION, current, 'radial'));
  }
  assert.deepEqual(layouts[0], layouts[1]);
});

test('preset selection alone cannot bypass legacy, unknown-shape or display-work limits', async () => {
  const f = await sampleTree(), legacy = { ...f.project.layout, mode: 'scientific' as const };
  assert.throws(() => createStartingLayout(f.rooted, f.reduction, DEFAULT_PRESENTATION, legacy, 'fan'), /Make artistic/);
  assert.throws(() => createStartingLayout(f.rooted, f.reduction, DEFAULT_PRESENTATION, f.project.layout, 'invented' as StartingShape), /Unknown/);
  const source = await parseNewick('(' + Array.from({ length: 5001 }, (_, i) => `T${i}`).join(',') + ');'), recipe = defaultRecipe(source); recipe.globalThreshold = 0;
  const rooted = orient(source, recipe.root), reduction = reduce(source, rooted, recipe), current = generateLayout(rooted, reduction, DEFAULT_PRESENTATION, 'organic');
  assert.throws(() => createStartingLayout(rooted, reduction, DEFAULT_PRESENTATION, current, 'fan'), /5,000 endpoints/);
  assert.equal(source.tips.length, 5001);
});

test('preview QA discloses a crowded draft while keeping coverage, page and source context intact', async () => {
  const f = await sampleTree(), presentation = { ...DEFAULT_PRESENTATION, widthMm: 20, heightMm: 20, strokeMm: 2, clearanceMm: 10, labels: true }, before = JSON.stringify(f.project);
  const result = previewStartingShape(f.source, f.rooted, f.project.recipe, f.reduction, presentation, f.project.layout, 'fan');
  assert.ok(result.afterQA.coveragePassed); assert.ok(result.afterQA.incidencePassed); assert.equal(result.afterQA.status, 'draft'); assert.ok(result.afterQA.issues.length);
  assert.equal(JSON.stringify(f.project), before); assert.equal(presentation.widthMm, 20);
});

test('accepted shape uses normal provenance, exact V4 replay, one-step undo and matching paired artwork exports', async () => {
  const f = await sampleTree(), withDesign = structuredClone(f.project);
  withDesign.design = { borders: [{ id: 'guide', name: 'Retained guide', points: [{ x: 10, y: 20 }, { x: 80, y: 20 }], closed: false, placement: 'spread', insetMm: 0, variationMm: 0, seed: 1, assignments: [{ sourceNodeId: f.source.tips[0], fraction: 0, normalSign: 1 }] }], activeBorderId: 'guide', showBorders: true,
    referenceImage: { name: 'Synthetic pixel.png', dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR5kAAAAASUVORK5CYII=', pixelWidth: 1, pixelHeight: 1, x: 4, y: 12, widthMm: 60, heightMm: 60, rotationDeg: 12, opacity: .3, visible: true, layer: 'behind' } };
  f.project = acceptCommand(f.project, withDesign, f.source);
  const result = previewStartingShape(f.source, f.rooted, f.project.recipe, f.reduction, DEFAULT_PRESENTATION, f.project.layout, 'radial');
  const revision = treeRevision(documentFromWorking(f.project)), viewId = f.project.authoring.activeViewId;
  assert.ok(isCurrentResult(f.project, revision, viewId));
  const proposal = structuredClone(f.project); proposal.layout = result.layout;
  const accepted = acceptCommand(f.project, proposal, f.source, { methods: ['artistic-starting-shape'], parameters: { shape: 'radial' }, notes: 'Accepted a reviewed starting-shape preview.' });
  assert.ok(!isCurrentResult(accepted, revision, viewId));
  assert.deepEqual(accepted.recipe, f.project.recipe); assert.deepEqual(accepted.authoring.root, f.project.authoring.root); assert.deepEqual(accepted.authoring.basis, f.project.authoring.basis);
  assert.deepEqual((await loadAnyProject(serializeProject(accepted))).project.layout, accepted.layout);
  assert.deepEqual(accepted.presentation, f.project.presentation); assert.deepEqual(accepted.design, f.project.design);
  assert.deepEqual((await loadAnyProject(serializeProject(accepted))).project.design, f.project.design);
  assert.deepEqual(accepted.authoring.provenance.methods['artistic-starting-shape@1.0.0'], METHOD_REGISTRY['artistic-starting-shape@1.0.0']);
  const history = new History<typeof accepted>(); history.push(f.project); const restored = history.undo(accepted)!; assert.deepEqual(restored.layout, f.project.layout); assert.deepEqual(history.redo(restored)!.layout, accepted.layout);
  const files = exportFiles(f.source, f.rooted, f.reduction, accepted, result.afterQA);
  const branch = (text: string) => text.match(/<g id="tree-artwork"[\s\S]*?<\/g>/)?.[0];
  assert.ok(branch(String(files['tree_labeled.svg']))); assert.equal(branch(String(files['tree_labeled.svg'])), branch(String(files['tree_unlabeled.svg'])));
  assert.doesNotMatch(String(files['tree_labeled.svg']), /data:image|Retained guide|fit-junction-preview/);
});

test('all five full-source presets retain Hug reduction memberships and original source bytes', async () => {
  const source = await parseNewick(await readFile('data/source_tree.nwk', 'utf8'));
  const recipe = { ...defaultRecipe(source), ...JSON.parse(await readFile('data/example_reduction_recipe.json', 'utf8')) }, rooted = orient(source, recipe.root), reduction = reduce(source, rooted, recipe, true), current = generateLayout(rooted, reduction, DEFAULT_PRESENTATION, 'organic');
  const before = JSON.stringify({ source, recipe, reduction });
  for (const { id } of STARTING_SHAPES) { const result = previewStartingShape(source, rooted, recipe, reduction, DEFAULT_PRESENTATION, current, id); assert.ok(result.afterQA.coveragePassed); assert.ok(result.afterQA.incidencePassed); assert.equal(result.afterQA.endpoints, 150); assert.equal(result.afterQA.sourceTips, 3083); }
  assert.equal(JSON.stringify({ source, recipe, reduction }), before);
});
