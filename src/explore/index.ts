import type { RootSpec, Source } from '../types.ts';
import type { DrawingTopology } from './drawing.ts';

export type ExploreMode = 'rectangular' | 'circular' | 'fan';
export type Box = { x: number; y: number; w: number; h: number };
export type ExploreIndex = {
  mode: ExploreMode; sourceSha: string; ids: string[]; root: number; tips: number; slots: number; scope: 'source' | 'drawing';
  authored: Uint8Array; originalCount: Uint32Array;
  parent: Int32Array; offsets: Uint32Array; children: Uint32Array;
  start: Uint32Array; end: Uint32Array; count: Uint32Array;
  radius: Float64Array; angle: Float64Array; x: Float64Array; y: Float64Array;
  bounds: Float64Array; extent: Box; angleStart: number; angleSpan: number;
};
export const NODE_BUDGET = 1800, LABEL_BUDGET = 160;
const TAU = Math.PI * 2;
export function intersects(a: Box, b: Box): boolean {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
}
/** Conservative annular sector bounds, including cardinal extrema and the center. */
export function sectorBox(inner: number, outer: number, a: number, b: number): Box {
  const xs: number[] = [], ys: number[] = [];
  const add = (t: number) => { for (const r of [inner, outer]) { xs.push(r * Math.cos(t)); ys.push(r * Math.sin(t)); } };
  add(a); add(b);
  for (let k = Math.ceil(a / (Math.PI / 2)); k <= Math.floor(b / (Math.PI / 2)); k++) add(k * Math.PI / 2);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
export function nodeBox(index: ExploreIndex, i: number): Box {
  const b = index.bounds, k = i * 4;
  return { x: b[k], y: b[k + 1], w: b[k + 2], h: b[k + 3] };
}
/** Iterative, O(nodes + edges). No descendant-member arrays or authored coordinates. */
export function buildExploreIndex(source: Source, rootSpec: RootSpec, childOrder: Record<string, string[]>, mode: ExploreMode): ExploreIndex {
  const ids = [...source.order], lookup = new Map(ids.map((id, i) => [id, i]));
  const adjacency: number[][] = ids.map(() => []);
  for (let i = 0; i < ids.length; i++) for (const id of source.nodes[ids[i]].children) {
    const c = lookup.get(id)!; adjacency[i].push(c); adjacency[c].push(i);
  }
  let root: number;
  if (rootSpec.kind === 'edge') {
    const a = lookup.get(rootSpec.sourceEdge[0]), b = lookup.get(rootSpec.sourceEdge[1]);
    if (a === undefined || b === undefined || !adjacency[a].includes(b) || !(rootSpec.fraction > 0 && rootSpec.fraction < 1)) throw new Error('Invalid source traversal edge.');
    root = ids.length; ids.push('virtual-root');
    adjacency[a] = adjacency[a].filter(n => n !== b); adjacency[b] = adjacency[b].filter(n => n !== a);
    adjacency[a].push(root); adjacency[b].push(root);
    adjacency.push(source.nodes[ids[a]].children.includes(ids[b]) ? [b, a] : [a, b]);
  } else {
    const r = lookup.get(rootSpec.sourceNodeId);
    if (r === undefined || (source.tips.length > 1 && !source.nodes[ids[r]].children.length)) throw new Error('Invalid source traversal node.');
    root = r;
  }
  const n = ids.length, parent = new Int32Array(n).fill(-1), offsets = new Uint32Array(n + 1), children = new Uint32Array(n - 1);
  const order: number[] = [], stack = [root];
  while (stack.length) {
    const i = stack.pop()!; order.push(i);
    const list = adjacency[i].filter(c => c !== parent[i]), requested = childOrder[ids[i]];
    if (requested?.length === list.length) {
      const ranks = new Map(requested.map((id, k) => [id, k]));
      if (list.every(c => ranks.has(ids[c]))) list.sort((a, b) => ranks.get(ids[a])! - ranks.get(ids[b])!);
    }
    adjacency[i] = list;
    for (let k = list.length - 1; k >= 0; k--) { parent[list[k]] = i; stack.push(list[k]); }
  }
  let cursor = 0;
  for (let i = 0; i < n; i++) { offsets[i] = cursor; children.set(adjacency[i], cursor); cursor += adjacency[i].length; }
  offsets[n] = cursor;
  const weights = Uint32Array.from(ids, id => source.nodes[id]?.children.length === 0 ? 1 : 0);
  return positionIndex(source.sha256, ids, root, parent, offsets, children, order, weights, new Uint8Array(n), mode, 'source');
}

/** Compact accepted-drawing topology; authored collapsed endpoints never open on zoom. */
export function buildDrawingIndex(source: Source, drawing: DrawingTopology, mode: ExploreMode): ExploreIndex {
  const ids = drawing.order, n = ids.length, lookup = new Map(ids.map((id, i) => [id, i]));
  if (drawing.sourceSha !== source.sha256 || !n || n > 100001 || lookup.size !== n || Object.keys(drawing.nodes).length !== n) throw new Error('Invalid drawing/source identity.');
  const sourceTips = new Set(source.tips), represented = new Set(drawing.representedTips), omitted = new Set(drawing.omittedTips);
  if (represented.size !== drawing.representedTips.length || omitted.size !== drawing.omittedTips.length || represented.size + omitted.size !== sourceTips.size || [...represented].some(id => !sourceTips.has(id) || omitted.has(id)) || [...omitted].some(id => !sourceTips.has(id))) throw new Error('Invalid represented/omitted drawing partition.');
  const root = lookup.get(drawing.rootId);
  if (root === undefined) throw new Error('Missing drawing root.');
  const sourceEdges = new Map<string, [string, string]>();
  for (const id of source.order) for (const child of source.nodes[id].children) sourceEdges.set(`e-${child}`, [id, child]);
  const endpointCounts = new Map<string, number>();
  if (Object.keys(drawing.tipEndpoints).length !== represented.size) throw new Error('Missing or extra represented tip identities.');
  for (const [tip, endpoint] of Object.entries(drawing.tipEndpoints)) {
    if (!represented.has(tip) || !Object.hasOwn(drawing.nodes, endpoint) || drawing.nodes[endpoint].children.length) throw new Error('Invalid drawing tip-to-endpoint mapping.');
    endpointCounts.set(endpoint, (endpointCounts.get(endpoint) ?? 0) + 1);
  }
  if (Object.keys(drawing.paths).length !== n - 1) throw new Error('Missing or extra original source paths.');
  const parent = new Int32Array(n).fill(-1), offsets = new Uint32Array(n + 1), childIds: number[] = [], weights = new Uint32Array(n), authored = new Uint8Array(n), original = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const node = drawing.nodes[ids[i]];
    if (!node || node.id !== ids[i] || (!Object.hasOwn(source.nodes, node.id) && node.id !== 'virtual-root') || [node.represented, node.original, node.omitted].some(v => !Number.isInteger(v) || v < 0 || v > sourceTips.size) || node.original - node.represented !== node.omitted) throw new Error('Invalid drawing node or membership counts.');
    if (i === root ? node.parent !== null : node.parent === null || !lookup.has(node.parent)) throw new Error('Invalid drawing parent.');
    if (node.parent !== null) parent[i] = lookup.get(node.parent)!;
    if (node.parent !== null) {
      const path = drawing.paths[node.id];
      if (!path || path.sourcePath[0] !== node.parent || path.sourcePath.at(-1) !== node.id || path.sourcePath.length < 2 || path.sourceEdgeIds.length !== path.sourcePath.length - 1) throw new Error('Invalid original drawing connection path.');
      for (let k = 0; k < path.sourceEdgeIds.length; k++) {
        const edge = sourceEdges.get(path.sourceEdgeIds[k]), a = path.sourcePath[k], b = path.sourcePath[k + 1];
        if (!edge || a === b || !(a === 'virtual-root' && node.parent === 'virtual-root' && k === 0 ? edge.includes(b) : edge.includes(a) && edge.includes(b))) throw new Error('Drawing path invents or changes a source edge.');
      }
    }
    if (new Set(node.children).size !== node.children.length || node.authoredGroup && node.children.length) throw new Error('Invalid drawing children/group.');
    offsets[i] = childIds.length;
    for (const child of node.children) {
      const index = lookup.get(child);
      if (index === undefined || drawing.nodes[child].parent !== node.id) throw new Error('Invalid drawing connection.');
      childIds.push(index);
    }
    if (!node.children.length) {
      if (node.represented !== (endpointCounts.get(node.id) ?? 0)) throw new Error('Drawing endpoint count disagrees with represented tip identities.');
      weights[i] = node.represented;
    }
    authored[i] = node.authoredGroup ? 1 : 0; original[i] = node.original;
  }
  offsets[n] = childIds.length;
  const children = Uint32Array.from(childIds), order: number[] = [], visited = new Set<number>(), stack = [root];
  while (stack.length) { const i = stack.pop()!; if (visited.has(i)) throw new Error('Drawing contains a cycle.'); visited.add(i); order.push(i); for (let k = offsets[i + 1] - 1; k >= offsets[i]; k--) stack.push(children[k]); }
  if (order.length !== n || children.length !== n - 1) throw new Error('Disconnected drawing.');
  const index = positionIndex(source.sha256, [...ids], root, parent, offsets, children, order, weights, authored, mode, 'drawing', original);
  if (index.tips !== represented.size || ids.some((id, i) => drawing.nodes[id].represented !== index.count[i])) throw new Error('Drawing endpoint memberships do not agree with its junctions.');
  return index;
}

function positionIndex(sourceSha: string, ids: string[], root: number, parent: Int32Array, offsets: Uint32Array, children: Uint32Array, order: number[], weights: Uint32Array, authored: Uint8Array, mode: ExploreMode, scope: 'source' | 'drawing', original?: Uint32Array): ExploreIndex {
  const n = ids.length;
  const start = new Uint32Array(n), end = new Uint32Array(n), count = new Uint32Array(n), height = new Uint32Array(n);
  let slots = 0;
  for (const i of order) if (offsets[i] === offsets[i + 1]) { start[i] = slots; count[i] = weights[i]; slots += weights[i] > 0 ? 1 : 0; end[i] = slots; }
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k], first = offsets[i], last = offsets[i + 1];
    if (first === last) continue;
    start[i] = start[children[first]]; end[i] = end[children[last - 1]];
    for (let j = first; j < last; j++) { count[i] += count[children[j]]; height[i] = Math.max(height[i], height[children[j]] + 1); }
  }
  const radius = new Float64Array(n), angle = new Float64Array(n), x = new Float64Array(n), y = new Float64Array(n), bounds = new Float64Array(n * 4);
  const angleStart = mode === 'circular' ? -Math.PI / 2 : -Math.PI * 2 / 3, angleSpan = mode === 'circular' ? TAU : Math.PI * 4 / 3;
  const tips = count[root];
  if (!tips || !slots) throw new Error('Explore needs represented source tips.');
  const index: ExploreIndex = { mode, scope, sourceSha, ids, root, tips, slots, authored, originalCount: original ?? count.slice(), parent, offsets, children, start, end, count, radius, angle, x, y, bounds, extent: { x: 0, y: 0, w: 1000, h: 1000 }, angleStart, angleSpan };
  for (const i of order) {
    radius[i] = 1000 * (height[root] - height[i]) / Math.max(1, height[root]);
    const middle = (start[i] + end[i]) / (2 * slots);
    angle[i] = angleStart + angleSpan * middle;
    x[i] = mode === 'rectangular' ? radius[i] : radius[i] * Math.cos(angle[i]);
    y[i] = mode === 'rectangular' ? middle * 1000 : radius[i] * Math.sin(angle[i]);
    const inner = parent[i] < 0 ? 0 : radius[parent[i]];
    const box = mode === 'rectangular'
      ? { x: inner, y: start[i] * 1000 / slots, w: 1000 - inner, h: (end[i] - start[i]) * 1000 / slots }
      : sectorBox(inner, 1000, angleStart + angleSpan * start[i] / slots, angleStart + angleSpan * end[i] / slots);
    bounds.set([box.x, box.y, box.w, box.h], i * 4);
  }
  index.extent = nodeBox(index, root);
  return index;
}
export type DetailFrame = { nodes: number[]; summaries: Map<number, 'density' | 'budget'>; expanded: Set<number>; coveredTips: number; visited: number };
/** Cull ordered child ranges BEFORE reserving the render budget, including for polytomies. */
export function visibleChildren(index: ExploreIndex, i: number, view: Box, limit = NODE_BUDGET): number[] | null {
  const { offsets, children, start, end, slots, mode, radius, angleStart, angleSpan } = index;
  const found: number[] = [], ranges = [[offsets[i], offsets[i + 1]]];
  while (ranges.length) {
    const [lo, hi] = ranges.pop()!; if (lo === hi) continue;
    const a = start[children[lo]], b = end[children[hi - 1]];
    const box = mode === 'rectangular' ? { x: radius[i], y: a * 1000 / slots, w: 1000 - radius[i], h: (b - a) * 1000 / slots }
      : sectorBox(radius[i], 1000, angleStart + angleSpan * a / slots, angleStart + angleSpan * b / slots);
    if (!intersects(box, view)) continue;
    if (hi - lo === 1) { found.push(children[lo]); if (found.length > limit) return null; }
    else { const mid = (lo + hi) >>> 1; ranges.push([mid, hi], [lo, mid]); }
  }
  return found;
}
export function selectDetail(index: ExploreIndex, view: Box, pixelsPerUnit: number, previous = new Set<number>(), budget = NODE_BUDGET): DetailFrame {
  const frame: DetailFrame = { nodes: [], summaries: new Map(), expanded: new Set(), coveredTips: 0, visited: 0 }, stack = [index.root];
  while (stack.length) {
    const i = stack.pop()!; frame.visited++;
    if (!intersects(nodeBox(index, i), view)) continue;
    frame.nodes.push(i);
    if (index.offsets[i] === index.offsets[i + 1]) { frame.coveredTips += index.count[i]; continue; }
    // Use the outer circumference: even a polytomy at radius zero can open when its tips fill the viewport.
    const span = (index.end[i] - index.start[i]) / index.slots * 1000 * (index.mode === 'rectangular' ? 1 : index.angleSpan) * pixelsPerUnit;
    const dense = span < (previous.has(i) ? 9 : 14);
    const available = Math.max(0, budget - frame.nodes.length - stack.length);
    const children = dense ? [] : visibleChildren(index, i, view, available);
    if (dense || children === null) {
      frame.summaries.set(i, dense ? 'density' : 'budget'); frame.coveredTips += index.count[i];
    } else {
      frame.expanded.add(i);
      for (let k = children.length - 1; k >= 0; k--) stack.push(children[k]);
    }
  }
  return frame;
}
/** SVG viewBox-equivalent uniform fit; camera always matches the actual CSS aspect ratio. */
export function fitBox(box: Box, width: number, height: number, padding = 1.14): Box {
  const aspect = Math.max(1, width) / Math.max(1, height), h = Math.max(box.h, box.w / aspect, .02) * padding, w = h * aspect;
  return { x: box.x + box.w / 2 - w / 2, y: box.y + box.h / 2 - h / 2, w, h };
}
export function focusBox(index: ExploreIndex, i: number, width: number, height: number): Box {
  if (index.offsets[i] !== index.offsets[i + 1]) {
    const fit = fitBox(nodeBox(index, i), width, height, 1.22);
    const span = (index.end[i] - index.start[i]) / index.slots * 1000 * (index.mode === 'rectangular' ? 1 : index.angleSpan);
    const h = Math.min(fit.h, Math.max(.02, span * height / 100)), w = h * width / height;
    return { x: index.x[i] - w / 2, y: index.y[i] - h / 2, w, h };
  }
  const size = Math.max(.02, Math.min(200, 1000 / index.slots * 18));
  return fitBox({ x: index.x[i] - size / 2, y: index.y[i] - size / 2, w: size, h: size }, width, height, 1.8);
}
export function sourcePath(index: ExploreIndex, i: number): number[] {
  const result: number[] = [];
  for (let j = i; j >= 0; j = index.parent[j]) result.push(j);
  return result;
}
