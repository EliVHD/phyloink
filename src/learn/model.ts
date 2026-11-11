import type { Correction, Rooted, RootSpec, Source } from '../types.ts';
import type { ReferenceRecord, RootState, ScientificBasis } from '../model/document.ts';
import type { DisplayGraph, ProjectionSpec } from '../structured/types.ts';
import { orient } from '../science.ts';
import { validateScientificBasis } from '../model/basis.ts';
import { semanticCapabilities, validateRootState } from '../model/semantics.ts';
import { projectTree, sourceMRCA } from '../structured/projection.ts';

export const MAX_LEARN_TIPS = 16;
export const MAX_LEARN_NODES = 512;
export type LearningInput = {
  source: Source; root: RootSpec; rootState: RootState; basis: ScientificBasis;
  corrections: Correction[]; childOrder: Record<string, string[]>;
  title: string; references: ReferenceRecord[];
};
export type LearningTree = {
  input: LearningInput; rooted: Rooted; tipIds: string[];
  childOrder: Record<string, string[]>; graph: DisplayGraph;
  branchIds: string[]; nodeNumbers: Record<string, number>;
};

export function learningAvailability(input: LearningInput): string | null {
  if (input.basis.relationshipKind !== 'phylogeny') return 'These activities require a declared phylogenetic source. Classification memberships or similarity links do not establish evolutionary ancestry.';
  if (input.basis.entityKind === 'unspecified') return 'Describe what the source tips represent in Scientific basis before asking ancestry questions.';
  if (!semanticCapabilities(input.rootState, 'cladogram', null, input.basis).canClaimAncestry) return 'A biological root must be declared in Scientific basis. An unrooted drawing or serialization origin alone does not establish ancestors.';
  return null;
}

/** Builds a temporary selected-tip projection. It never edits a project or input. */
export function createLearningTree(input: LearningInput, tipIds: string[], childOrder = input.childOrder): LearningTree {
  const reason = learningAvailability(input); if (reason) throw new Error(reason);
  validateScientificBasis(input.basis, input.source.sha256);
  validateRootState(input.rootState, input.root, input.source);
  if (tipIds.length < 2 || tipIds.length > MAX_LEARN_TIPS) throw new Error(`Choose between 2 and ${MAX_LEARN_TIPS} source tips for a practice sample.`);
  if (new Set(tipIds).size !== tipIds.length || tipIds.some(id => !input.source.tips.includes(id))) throw new Error('Practice tips must be distinct terminal source identities; matching names are not merged.');
  const rooted = orient(input.source, input.root), order = structuredClone(childOrder);
  const projection: ProjectionSpec = { selection: { kind: 'explicit-tips', tipIds: [...tipIds] }, collapse: [], expand: [], reveal: [], childOrder: order };
  const graph = projectTree(input.source, rooted, projection, input.corrections);
  if (graph.order.length > MAX_LEARN_NODES) throw new Error('This selection spans too many intervening nodes for a small practice diagram. Choose a tighter group or a smaller teaching source.');
  // Number only actual branching points, keeping the same numbers after rotations.
  const branchIds = rooted.order.filter(id => graph.nodes[id]?.children.length > 1);
  return { input, rooted, tipIds: [...tipIds], childOrder: order, graph, branchIds, nodeNumbers: Object.fromEntries(branchIds.map((id, i) => [id, i + 1])) };
}

function branch(tree: LearningTree, id: string): void {
  if (!tree.branchIds.includes(id)) throw new Error('Choose a numbered branching point in this practice sample.');
}
function selectedTips(tree: LearningTree, ids: string[]): void {
  if (new Set(ids).size !== ids.length || ids.some(id => !tree.tipIds.includes(id))) throw new Error('Answers must use distinct tips from the displayed practice sample.');
}

export function commonAncestor(tree: LearningTree, first: string, second: string): string {
  selectedTips(tree, [first, second]);
  return sourceMRCA(tree.rooted, [first, second]);
}
export function checkAncestor(tree: LearningTree, first: string, second: string, chosen: string): { kind: 'correct' | 'older' | 'unrelated'; correctNodeId: string } {
  branch(tree, chosen);
  const correctNodeId = commonAncestor(tree, first, second);
  return { kind: chosen === correctNodeId ? 'correct' : tree.rooted.nodes[chosen].members.includes(first) && tree.rooted.nodes[chosen].members.includes(second) ? 'older' : 'unrelated', correctNodeId };
}

export function checkClade(tree: LearningTree, nodeId: string, answer: string[]): { correct: boolean; expected: string[]; missing: string[]; extra: string[]; fullSourceCount: number; omittedCount: number } {
  branch(tree, nodeId); selectedTips(tree, answer);
  const expected = tree.tipIds.filter(id => tree.rooted.nodes[nodeId].members.includes(id));
  const missing = expected.filter(id => !answer.includes(id)), extra = answer.filter(id => !expected.includes(id));
  const fullSourceCount = tree.rooted.nodes[nodeId].members.length;
  return { correct: !missing.length && !extra.length, expected, missing, extra, fullSourceCount, omittedCount: fullSourceCount - expected.length };
}

/** Includes identities and preserved source paths; only the drawing order is ignored. */
function relationships(tree: LearningTree): string {
  return JSON.stringify({ source: tree.input.source.sha256, tips: [...tree.tipIds].sort(),
    nodes: Object.values(tree.graph.nodes).map(n => [n.id, n.parent, [...n.children].sort(), [...n.selectedMembers].sort()]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    edges: Object.values(tree.graph.edges).map(e => [e.id, e.parent, e.child, e.sourcePath, e.sourceEdgeIds]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))) });
}
export function sameLearningRelationships(a: LearningTree, b: LearningTree): boolean { return relationships(a) === relationships(b); }

/** Permutes complete source children, including omitted ones; never resolves a fork. */
export function rotateLearningBranch(tree: LearningTree, nodeId: string): LearningTree {
  branch(tree, nodeId);
  const order = structuredClone(tree.childOrder);
  order[nodeId] = [...(order[nodeId] ?? tree.rooted.nodes[nodeId].children)].reverse();
  const rotated = createLearningTree(tree.input, tree.tipIds, order);
  if (!sameLearningRelationships(tree, rotated)) throw new Error('The proposed rotation changed a source relationship and was discarded.');
  return rotated;
}
