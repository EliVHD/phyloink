import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleTree } from '../src/structured/example.ts';
import { DEFAULT_PRESENTATION, generateLayout, reconcileLayout } from '../src/geometry.ts';
import { loadAnyProject, serializeProject } from '../src/project-v2.ts';
import { acceptCommand } from '../src/commands.ts';

async function fixture() {
  const f = await sampleTree(), project: import('../src/types.ts').Project = structuredClone(f.project);
  delete project.authoring;
  project.layout.mode = 'scientific'; project.layout.pinnedNodes = [f.rooted.rootId];
  for (const route of Object.values(project.layout.routes)) route.segments[0].c1.y += 5;
  return { ...f, legacy: project };
}
test('legacy inspection artwork migrates and saves with exact stored coordinates, curves and pins', async () => {
  const f = await fixture(), loaded = await loadAnyProject(JSON.stringify(f.legacy));
  assert.deepEqual(loaded.project.layout, f.legacy.layout);
  const reopened = await loadAnyProject(serializeProject(loaded.project));
  assert.deepEqual(reopened.project.layout, f.legacy.layout);
  assert.equal(reopened.project.layout.mode, 'scientific');
  assert.equal(reopened.project.authoring.viewName, 'Legacy normalized inspection');
});
test('legacy inspection editing needs explicit artistic adoption, which preserves all stored artwork', async () => {
  const f = await fixture(), loaded = await loadAnyProject(JSON.stringify(f.legacy));
  const changed = structuredClone(loaded.project); changed.layout.nodes[f.rooted.rootId].x += 1;
  assert.throws(() => acceptCommand(loaded.project, changed, f.source), /read-only/);
  const proposal = structuredClone(loaded.project); proposal.layout.mode = 'organic'; proposal.authoring.viewName = 'Artistic arrangement';
  const adopted = acceptCommand(loaded.project, proposal, f.source, { notes: 'Explicitly adopted preserved legacy artwork.' });
  assert.deepEqual(adopted.layout, { ...f.legacy.layout, mode: 'organic' });
  assert.deepEqual(adopted.presentation, f.legacy.presentation);
});
test('retired inspection generation refuses to replace legacy coordinates implicitly', async () => {
  const f = await fixture(), before = structuredClone(f.legacy.layout);
  assert.throws(() => generateLayout(f.rooted, f.reduction, DEFAULT_PRESENTATION, 'scientific'), /preserved, not regenerated/);
  assert.throws(() => reconcileLayout(f.rooted, f.reduction, DEFAULT_PRESENTATION, f.legacy.layout), /Make artistic/);
  assert.deepEqual(f.legacy.layout, before);
});
