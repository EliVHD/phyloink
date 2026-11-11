import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sampleTree, classificationSample } from '../src/structured/example.ts';
import { parseNewick } from '../src/newick.ts';
import { defaultRecipe, orient, reduce } from '../src/science.ts';
import { DEFAULT_PRESENTATION, generateLayout } from '../src/geometry.ts';
import { reductionTopology, structuredTopology } from '../src/explore/drawing.ts';
import { prepareExploreInput } from '../src/explore/input.ts';
import { buildDrawingIndex, fitBox, focusBox, selectDetail } from '../src/explore/index.ts';
import { renderExplore } from '../src/explore/render.ts';
import { projectTree } from '../src/structured/projection.ts';
import { DEFAULT_STRUCTURED, estimatedMeasurements } from '../src/structured/layout.ts';
import { makeStructuredView, makeClassificationView, makeUnrootedView } from '../src/structured/view.ts';
import { defaultUnrootedSpec, projectUnrooted } from '../src/structured/unrooted.ts';
import { projectClassification } from '../src/structured/classification.ts';
import type { ExploreMode } from '../src/explore/index.ts';
const modes: ExploreMode[] = ['rectangular', 'circular', 'fan'];
const projection = { selection: { kind: 'all' as const }, collapse: [], expand: [], reveal: [], childOrder: {} };
async function partial() {
  const f = await sampleTree(), group = f.rooted.nodes[f.source.tips[2]].parent!;
  const spec = { ...projection, selection: { kind: 'explicit-tips' as const, tipIds: [f.source.tips[0], f.source.tips[2], f.source.tips[4]] }, collapse: [group] };
  const graph = projectTree(f.source, f.rooted, spec, []), measurements = estimatedMeasurements(graph, DEFAULT_STRUCTURED);
  const view = makeStructuredView(f.project, f.source, spec, DEFAULT_STRUCTURED, measurements, 'view-test', 'Sampled drawing');
  return { ...f, group, spec, view, topology: structuredTopology(f.source, view) };
}

test('the Hug accepted reduction retains exactly 150 authored endpoints covering all 3,083 source tips', async () => {
  const source = await parseNewick(await readFile('data/source_tree.nwk', 'utf8'));
  const recipe = { ...defaultRecipe(source), ...JSON.parse(await readFile('data/example_reduction_recipe.json', 'utf8')) };
  const rooted = orient(source, recipe.root), reduction = reduce(source, rooted, recipe, true), layout = generateLayout(rooted, reduction, DEFAULT_PRESENTATION, 'organic');
  const before = JSON.stringify({ source, recipe, layout }), topology = reductionTopology(source, rooted, reduction, layout, []);
  assert.deepEqual(new Set(topology.order), new Set(reduction.visible));
  for (const mode of modes) {
    const index = buildDrawingIndex(source, topology, mode), camera = fitBox(index.extent, 1000, 700), frame = selectDetail(index, camera, 1000 / camera.w);
    assert.equal(index.tips, 3083); assert.equal(index.slots, 150); assert.equal(frame.coveredTips, 3083);
    assert.deepEqual(index.ids.filter((_, i) => index.offsets[i] === index.offsets[i + 1]).sort(), reduction.frontier.map(n => n.id).sort());
    for (const entry of reduction.frontier) assert.equal(index.count[index.ids.indexOf(entry.id)], entry.members.length);
  }
  assert.equal(JSON.stringify({ source, recipe, layout }), before);
});

test('sampled collapsed groups keep selected/original/omitted counts and exact suppressed source paths', async () => {
  const f = await partial(), before = JSON.stringify(f.view);
  assert.deepEqual(f.topology.representedTips, f.view.graph.representedTips);
  assert.deepEqual(f.topology.omittedTips, f.view.graph.omittedTips);
  const node = f.topology.nodes[f.group]; assert.equal(node.represented, 2); assert.equal(node.original, 3); assert.equal(node.omitted, 1); assert.ok(node.authoredGroup);
  assert.deepEqual(f.topology.paths[f.source.tips[0]].sourcePath, [f.rooted.rootId, f.rooted.nodes[f.source.tips[0]].parent!, f.source.tips[0]]);
  for (const mode of modes) {
    const index = buildDrawingIndex(f.source, f.topology, mode); assert.equal(index.tips, 3); assert.equal(index.slots, 2);
    const i = index.ids.indexOf(f.group); assert.equal(index.authored[i], 1); assert.equal(index.originalCount[i], 3);
    for (const factor of [1, 20, 1000]) {
      const camera = focusBox(index, i, 1000, 700), frame = selectDetail(index, camera, factor);
      assert.equal(index.offsets[i], index.offsets[i + 1]); assert.ok(!frame.expanded.has(i));
    }
  }
  assert.equal(JSON.stringify(f.view), before);
});

test('solid authored-group diamonds remain distinct from temporary density/budget summaries', async () => {
  const f = await partial(), index = buildDrawingIndex(f.source, f.topology, 'rectangular'), camera = fitBox(index.extent, 1000, 700);
  const render = (scale: number, budget = 1800) => renderExplore(index, selectDetail(index, camera, scale, new Set(), budget), camera, 1000, 700, undefined, i => f.topology.nodes[index.ids[i]].label, text => text.length * 7).svg;
  const full = render(1); assert.match(full, /class="explore-authored"/); assert.match(full, /2 represented \/ 3 full-source/);
  assert.doesNotMatch(full, /class="explore-summary"/);
  const limited = render(.001); assert.match(limited, /Temporary viewing summary/); assert.match(limited, /3 represented source tips/);
  assert.equal(index.authored[index.root], 0); assert.equal(f.topology.nodes[f.group].children.length, 0);
});

test('current drawing uses the accepted scientific snapshot even when current metadata changes', async () => {
  const f = await partial(), project = structuredClone(f.project), before = JSON.stringify(f.view);
  project.authoring.basis.name = 'Changed current description';
  const input = prepareExploreInput(f.source, f.rooted, f.reduction, project, f.view);
  assert.equal(input.basis.name, 'Changed current description'); assert.equal(input.drawing.basis.name, f.view.input.basis.name);
  assert.match(input.drawing.note, /differs from the current scientific metadata/); assert.deepEqual(input.drawing.topology, f.topology);
  input.drawing.basis.name = 'Temporary view metadata'; assert.equal(JSON.stringify(f.view), before);
});

test('classification and unrooted saved graphs retain their own parent/display traversal without ancestry conversion', async () => {
  const c = await classificationSample(), cg = projectClassification(c.source, projection, []);
  const cv = makeClassificationView(c.project, c.source, projection, DEFAULT_STRUCTURED, estimatedMeasurements(cg, DEFAULT_STRUCTURED), c.spec, 'classification-view', 'Classification');
  const ci = prepareExploreInput(c.source, c.rooted, c.reduction, c.project, cv);
  assert.equal(ci.drawing.basis.relationshipKind, 'classification');
  const f = await sampleTree(), spec = defaultUnrootedSpec(f.source), graph = projectUnrooted(f.source, projection, spec), settings = { ...DEFAULT_STRUCTURED, kind: 'circular' as const, curves: false };
  const view = makeUnrootedView(f.project, f.source, projection, settings, estimatedMeasurements(graph, settings), spec, 'unrooted-view', 'Unrooted');
  const input = prepareExploreInput(f.source, f.rooted, f.reduction, f.project, view);
  assert.ok(input.drawing.unrooted);
  for (const mode of modes) {
    const index = buildDrawingIndex(f.source, input.drawing.topology, mode);
    assert.equal(index.ids[index.root], view.graph.rootId);
    for (const id of view.graph.order) assert.deepEqual(Array.from(index.children.slice(index.offsets[index.ids.indexOf(id)], index.offsets[index.ids.indexOf(id) + 1])).map(i => index.ids[i]), view.graph.nodes[id].children);
  }
});

test('drawing index rejects foreign sources, broken partitions, invented children and false membership counts', async () => {
  const f = await partial();
  for (const change of [
    (t: typeof f.topology) => { t.sourceSha = '0'.repeat(64); },
    (t: typeof f.topology) => { t.omittedTips = []; },
    (t: typeof f.topology) => { t.nodes[t.rootId].children.push('invented'); },
    (t: typeof f.topology) => { t.nodes[t.rootId].represented++; t.nodes[t.rootId].original++; },
    (t: typeof f.topology) => { t.nodes[f.group].children = [f.source.tips[1]]; },
    (t: typeof f.topology) => { t.paths[f.source.tips[0]].sourceEdgeIds[0] = 'e-foreign'; },
    (t: typeof f.topology) => { t.tipEndpoints[f.source.tips[0]] = f.group; },
  ]) { const topology = structuredClone(f.topology); change(topology); assert.throws(() => buildDrawingIndex(f.source, topology, 'rectangular')); }
});
