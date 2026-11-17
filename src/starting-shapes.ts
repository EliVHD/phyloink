import type { Layout, Point, Presentation, QA, Recipe, Reduction, Rooted, Source } from './types.ts';
import { add, distance, generateLayout, lerp, orderedChildren, validateGeometry } from './geometry.ts';
import { validateLayout, validatePresentation } from './project.ts';

export const STARTING_SHAPES = [
  { id: 'tree-like', name: 'Tree-like', description: 'Crown and roots' },
  { id: 'radial', name: 'Radial', description: 'Spokes around a centre' },
  { id: 'fan', name: 'Fan', description: 'An open arc' },
  { id: 'upright', name: 'Upright branching', description: 'Branches grow upward' },
  { id: 'horizontal', name: 'Horizontal', description: 'Branches run across' },
] as const;
export type StartingShape = typeof STARTING_SHAPES[number]['id'];
export const MAX_STARTING_NODES = 20000, MAX_STARTING_ENDPOINTS = 5000;
export type StartingShapeResult = {
  kind: 'starting-shape'; shape: StartingShape; layout: Layout; beforeQA: QA; afterQA: QA;
  movedJunctions: { id: string; from: Point; to: Point }[]; movedEndpoints: number;
  retainedHiddenNodes: number; retainedPinnedNodes: number; retainedPinnedEdges: number;
};
export function startingShapeName(shape: StartingShape): string { return STARTING_SHAPES.find(item => item.id === shape)!.name; }
const close = (a: Point | undefined, b: Point | undefined) => !!a && !!b && distance(a, b) <= 1e-9;

/** Deterministic free artwork only; no new topology, scale or biological root. */
export function createStartingLayout(rooted: Rooted, reduction: Reduction, presentation: Presentation, current: Layout, shape: StartingShape): Layout {
  if (!STARTING_SHAPES.some(item => item.id === shape)) throw new Error('Unknown starting shape.');
  validateLayout(current, rooted, reduction); validatePresentation(presentation);
  if (current.mode !== 'organic') throw new Error('Adopt legacy artwork with Make artistic before choosing a starting shape.');
  if (reduction.visible.length > MAX_STARTING_NODES || reduction.frontier.length > MAX_STARTING_ENDPOINTS) throw new Error('Starting shapes support at most 20,000 visible junctions and 5,000 endpoints. Reduce the drawing or choose a smaller source. No taxa were removed.');
  const fresh: Layout = shape === 'tree-like' ? generateLayout(rooted, reduction, presentation, 'organic', current) : { nodes: {}, routes: {}, pinnedNodes: [], pinnedEdges: [], childOrder: structuredClone(current.childOrder), mode: 'organic', ...(current.lineStyle ? { lineStyle: current.lineStyle } : {}) };
  if (shape !== 'tree-like') {
    const frontier = new Set(reduction.frontier.map(entry => entry.id)), order: string[] = [], stack = [rooted.rootId];
    const spans: Record<string, [number, number]> = {}, heights: Record<string, number> = {};
    let terminal = 0;
    while (stack.length) {
      const id = stack.pop()!; order.push(id);
      if (frontier.has(id)) { spans[id] = [terminal, terminal++]; heights[id] = 0; }
      else for (const child of [...orderedChildren(rooted, current, id)].reverse()) stack.push(child);
    }
    for (const id of [...order].reverse()) if (!frontier.has(id)) {
      const children = orderedChildren(rooted, current, id);
      spans[id] = [spans[children[0]][0], spans[children.at(-1)!][1]];
      heights[id] = children.reduce((height, child) => Math.max(height, heights[child] + 1), 0);
    }
    const p = presentation, maxHeight = heights[rooted.rootId], total = Math.max(1, terminal - 1), marginX = p.widthMm * .08, marginY = p.heightMm * .08;
    for (const id of order) {
      const mid = (spans[id][0] + spans[id][1]) / 2, slot = terminal === 1 ? .5 : mid / total, depth = maxHeight ? 1 - heights[id] / maxHeight : 0;
      let point: Point;
      if (!maxHeight) point = { x: p.widthMm / 2, y: p.heightMm / 2 };
      else if (shape === 'horizontal') point = { x: marginX + depth * (p.widthMm - 2 * marginX), y: marginY + slot * (p.heightMm - 2 * marginY) };
      else if (shape === 'upright') point = { x: marginX + slot * (p.widthMm - 2 * marginX), y: p.heightMm - marginY - depth * (p.heightMm - 2 * marginY) };
      else {
        const radial = shape === 'radial', angle = (radial ? -90 + 360 * (mid + .5) / terminal : -165 + slot * 150) * Math.PI / 180;
        const origin = { x: p.widthMm / 2, y: p.heightMm * (radial ? .5 : .9) };
        point = { x: origin.x + Math.cos(angle) * p.widthMm * .42 * depth, y: origin.y + Math.sin(angle) * p.heightMm * (radial ? .42 : .8) * depth };
      }
      fresh.nodes[id] = point;
    }
    for (const id of order) {
      const parent = rooted.nodes[id].parent; if (!parent) continue;
      const a = fresh.nodes[parent], b = fresh.nodes[id], length = distance(a, b), bend = Math.min(1.2, length * .06), sign = spans[id][0] % 2 ? -1 : 1;
      const offset = length ? { x: -(b.y - a.y) / length * bend * sign, y: (b.x - a.x) / length * bend * sign } : { x: 0, y: 0 };
      fresh.routes[id] = { segments: [{ c1: add(lerp(a, b, 1 / 3), offset), c2: add(lerp(a, b, 2 / 3), offset), end: { ...b } }] };
    }
  }
  // Hidden artwork and all source-order/pin records survive the visible replacement.
  const result = structuredClone(current);
  for (const id of reduction.visible) { result.nodes[id] = fresh.nodes[id]; if (fresh.routes[id]) result.routes[id] = fresh.routes[id]; }
  const conflicts: string[] = [];
  for (const id of current.pinnedNodes) if (!close(current.nodes[id], result.nodes[id])) conflicts.push(`junction ${id}`);
  for (const id of current.pinnedEdges) {
    const parent = rooted.nodes[id].parent, before = current.routes[id], after = result.routes[id];
    const routeMatches = before && after && before.segments.length === after.segments.length && before.segments.every((segment, i) => (['c1', 'c2', 'end'] as const).every(key => close(segment[key], after.segments[i][key])));
    if (!parent || !routeMatches || !close(current.nodes[id], result.nodes[id]) || !close(current.nodes[parent], result.nodes[parent])) conflicts.push(`edge ${id}`);
  }
  if (conflicts.length) throw new Error(`Starting shape conflicts with pinned ${conflicts.slice(0, 5).join(', ')}${conflicts.length > 5 ? ` and ${conflicts.length - 5} more` : ''}. Unpin explicitly or keep the current arrangement. Artwork retained.`);
  // Preserve hard pins byte-for-byte even if equivalent calculations differ below tolerance.
  for (const id of current.pinnedNodes) result.nodes[id] = structuredClone(current.nodes[id]);
  for (const id of current.pinnedEdges) { result.routes[id] = structuredClone(current.routes[id]); result.nodes[id] = structuredClone(current.nodes[id]); result.nodes[rooted.nodes[id].parent!] = structuredClone(current.nodes[rooted.nodes[id].parent!]); }
  for (const id of reduction.visible) if (result.routes[id] && !current.pinnedEdges.includes(id)) result.routes[id].segments.at(-1)!.end = { ...result.nodes[id] };
  validateLayout(result, rooted, reduction); return result;
}

/** Runs in a cancellable worker. Geometry findings are disclosed, not optimized away. */
export function previewStartingShape(source: Source, rooted: Rooted, recipe: Recipe, reduction: Reduction, presentation: Presentation, current: Layout, shape: StartingShape): StartingShapeResult {
  const layout = createStartingLayout(rooted, reduction, presentation, current, shape);
  const movedJunctions = reduction.visible.filter(id => !close(current.nodes[id], layout.nodes[id])).map(id => ({ id, from: { ...current.nodes[id] }, to: { ...layout.nodes[id] } }));
  const movedIds = new Set(movedJunctions.map(node => node.id));
  return { kind: 'starting-shape', shape, layout, beforeQA: validateGeometry(source, rooted, recipe, reduction, current, presentation), afterQA: validateGeometry(source, rooted, recipe, reduction, layout, presentation), movedJunctions, movedEndpoints: reduction.frontier.filter(node => movedIds.has(node.id)).length,
    retainedHiddenNodes: Object.keys(current.nodes).length - reduction.visible.length, retainedPinnedNodes: current.pinnedNodes.length, retainedPinnedEdges: current.pinnedEdges.length };
}
