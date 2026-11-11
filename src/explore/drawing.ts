import type { Correction, Layout, Reduction, Rooted, RootSpec, Source } from '../types.ts';
import type { RootState, ScientificBasis } from '../model/document.ts';
import type { StructuredView } from '../structured/types.ts';
import { displayLabel } from '../science.ts';

export type DrawingNode = { id: string; parent: string | null; children: string[]; label: string; represented: number; original: number; omitted: number; authoredGroup: boolean };
export type DrawingTopology = {
  sourceSha: string; rootId: string; nodes: Record<string, DrawingNode>; order: string[];
  representedTips: string[]; omittedTips: string[]; tipEndpoints: Record<string, string>;
  paths: Record<string, { sourcePath: string[]; sourceEdgeIds: string[] }>;
};
export type ExploreContext = { root: RootSpec; childOrder: Record<string, string[]>; corrections: Correction[]; basis: ScientificBasis; rootState: RootState; title: string };
export type ExploreInput = ExploreContext & { source: Source; drawing: ExploreContext & { topology: DrawingTopology; unrooted: boolean; note: string } };

/** Read-only snapshot of the accepted reduction; every visible junction is retained. */
export function reductionTopology(source: Source, rooted: Rooted, reduction: Reduction, layout: Layout, corrections: Correction[]): DrawingTopology {
  const visible = new Set(reduction.visible), frontier = new Map(reduction.frontier.map(entry => [entry.id, entry]));
  const nodes: Record<string, DrawingNode> = {}, order: string[] = [], paths: DrawingTopology['paths'] = {}, tipEndpoints: Record<string, string> = {};
  const stack = [rooted.rootId];
  while (stack.length) {
    const id = stack.pop()!, node = rooted.nodes[id], entry = frontier.get(id);
    const children = entry ? [] : (layout.childOrder[id] ?? node.children).filter(child => visible.has(child));
    const authoredGroup = !!entry && node.children.length > 0;
    nodes[id] = { id, parent: node.parent, children: [...children], label: authoredGroup ? `Source group ${id}` : displayLabel(source, id, corrections), represented: node.count, original: node.count, omitted: 0, authoredGroup };
    order.push(id);
    if (node.parent) paths[id] = { sourcePath: [node.parent, id], sourceEdgeIds: [node.sourceEdgeId!] };
    if (entry) for (const tip of entry.members) tipEndpoints[tip] = id;
    for (const child of [...children].reverse()) stack.push(child);
  }
  if (order.length !== visible.size || source.tips.some(id => !Object.hasOwn(tipEndpoints, id))) throw new Error('The drawing reduction does not cover the source exactly.');
  return { sourceSha: source.sha256, rootId: rooted.rootId, nodes, order, representedTips: [...source.tips], omittedTips: [], tipEndpoints, paths };
}

/** Use the saved graph, including its sampled/omitted memberships and suppressed paths. */
export function structuredTopology(source: Source, view: StructuredView): DrawingTopology {
  const graph = view.graph;
  if (graph.sourceSha256 !== source.sha256) throw new Error('The accepted drawing belongs to another source.');
  const nodes: Record<string, DrawingNode> = {}, paths: DrawingTopology['paths'] = {}, tipEndpoints: Record<string, string> = {};
  for (const id of graph.order) {
    const node = graph.nodes[id];
    nodes[id] = { id, parent: node.parent, children: [...node.children], label: node.label, represented: node.selectedMembers.length, original: node.originalMembers.length, omitted: node.omittedMembers.length, authoredGroup: node.aggregate };
  }
  for (const id of graph.endpoints) for (const tip of graph.nodes[id].selectedMembers) tipEndpoints[tip] = id;
  for (const edge of Object.values(graph.edges)) paths[edge.child] = { sourcePath: [...edge.sourcePath], sourceEdgeIds: [...edge.sourceEdgeIds] };
  return { sourceSha: source.sha256, rootId: graph.rootId, nodes, order: [...graph.order], representedTips: [...graph.representedTips], omittedTips: [...graph.omittedTips], tipEndpoints, paths };
}
