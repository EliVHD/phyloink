import { parseNewick } from '../newick.ts';
import { BUNDLED_DATASETS, bundledDataset } from '../datasets.ts';
import { HUG_REFERENCE, METHOD_REFERENCES, validateReference } from '../provenance/registry.ts';
import { digestSync } from '../provenance/sync-identity.ts';
import { validateScientificBasis } from '../model/basis.ts';
import { createLearningTree } from './model.ts';
import type { LearningInput, LearningTree } from './model.ts';

export const MAX_SCENARIO_BYTES = 25_000_000;
export const MAX_ACTIVITIES = 12;
type Question = { id: string; prompt: string; layout: 'rectangular' | 'circular'; rotations: string[] };
export type LearningActivity = Question & ({ kind: 'ancestor'; tipIds: [string, string] } | { kind: 'clade'; nodeId: string } | { kind: 'compare' });
export type LearningScenario = {
  format: 'phyloink-learning-scenario'; version: 1;
  title: string; introduction: string; teacherNotes: string;
  source: { newick: string; sha256: string; hashBasis: 'legacy-utf8-text' };
  context: Omit<LearningInput, 'source'>;
  tipIds: string[]; tipCodes: boolean; activities: LearningActivity[];
};
export type PreparedScenario = { scenario: LearningScenario; tree: LearningTree };
const idPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,150}$/;
function object(value: unknown): asserts value is Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Scenario fields must be objects.'); }
function keys(value: unknown, expected: string[]): void {
  object(value);
  if (Object.keys(value).sort().join('|') !== [...expected].sort().join('|')) throw new Error('Unsupported or missing scenario fields.');
}
function text(value: unknown, limit: number, required = false): void { if (typeof value !== 'string' || value.length > limit || (required && !value.trim())) throw new Error(`Scenario text must be ${required ? 'nonempty and ' : ''}at most ${limit} characters.`); }
function ids(value: unknown, limit: number): asserts value is string[] {
  if (!Array.isArray(value) || value.length > limit || value.some(id => typeof id !== 'string' || !idPattern.test(id)) || new Set(value).size !== value.length) throw new Error('Invalid or repeated scenario identities.');
}

/** Checks a question against the supplied source; files contain setups, never answer keys. */
export function validateActivity(activity: LearningActivity, tree: LearningTree): void {
  object(activity);
  const kind = activity.kind;
  if (!['ancestor', 'clade', 'compare'].includes(kind)) throw new Error('Unsupported scenario activity kind.');
  keys(activity, ['id', 'prompt', 'layout', 'rotations', 'kind', ...(kind === 'ancestor' ? ['tipIds'] : kind === 'clade' ? ['nodeId'] : [])]);
  if (typeof activity.id !== 'string' || !idPattern.test(activity.id)) throw new Error('Invalid activity identity.');
  text(activity.prompt, 5000, true);
  if (!['rectangular', 'circular'].includes(activity.layout)) throw new Error('Unsupported practice layout.');
  if (!Array.isArray(activity.rotations) || activity.rotations.length > 32 || activity.rotations.some(id => !tree.branchIds.includes(id))) throw new Error('Rotations must identify displayed branching points (at most 32).');
  if (kind === 'ancestor' && (!Array.isArray(activity.tipIds) || activity.tipIds.length !== 2 || new Set(activity.tipIds).size !== 2 || activity.tipIds.some(id => !tree.tipIds.includes(id)))) throw new Error('An ancestor question requires two distinct sampled source tips.');
  if (kind === 'clade' && !tree.branchIds.includes(activity.nodeId)) throw new Error('A clade question requires a displayed branching point.');
}

/** Replays complete source-child rotations without modifying the prepared base tree. */
export function activityTree(tree: LearningTree, activity: LearningActivity): LearningTree {
  validateActivity(activity, tree);
  const order = structuredClone(tree.childOrder);
  for (const id of activity.rotations) order[id] = [...(order[id] ?? tree.rooted.nodes[id].children)].reverse();
  return createLearningTree(tree.input, tree.tipIds, order);
}

/** Stage every validation before the UI changes its practice workspace. No URL fetching. */
export async function prepareScenario(serialized: string): Promise<PreparedScenario> {
  if (new TextEncoder().encode(serialized).length > MAX_SCENARIO_BYTES) throw new Error('Activity scenario exceeds the 25 MB limit.');
  const value = JSON.parse(serialized) as LearningScenario;
  keys(value, ['format', 'version', 'title', 'introduction', 'teacherNotes', 'source', 'context', 'tipIds', 'tipCodes', 'activities']);
  if (value.format !== 'phyloink-learning-scenario' || value.version !== 1) throw new Error('Unsupported learning scenario format/version.');
  text(value.title, 500, true); text(value.introduction, 10000); text(value.teacherNotes, 10000);
  keys(value.source, ['newick', 'sha256', 'hashBasis']);
  text(value.source.newick, 20_000_000, true);
  if (value.source.hashBasis !== 'legacy-utf8-text' || typeof value.source.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.source.sha256)) throw new Error('Invalid scenario source identity or hash basis.');
  const source = await parseNewick(value.source.newick);
  if (source.sha256 !== value.source.sha256) throw new Error('Scenario source checksum does not match its embedded Newick.');
  keys(value.context, ['root', 'rootState', 'basis', 'corrections', 'childOrder', 'title', 'references']);
  const context = value.context;
  validateScientificBasis(context.basis, source.sha256);
  text(context.title, 10000, true);
  object(context.root);
  if (context.root.kind === 'node') { keys(context.root, ['kind', 'sourceNodeId', 'status']); text(context.root.sourceNodeId, 151, true); }
  else if (context.root.kind === 'edge') { keys(context.root, ['kind', 'sourceEdge', 'fraction', 'status']); ids(context.root.sourceEdge, 2); if (context.root.sourceEdge.length !== 2) throw new Error('A traversal edge needs two identities.'); }
  else throw new Error('Invalid scenario traversal.');
  text(context.root.status, 500, true);
  object(context.rootState); text(context.rootState.explanation, 10000, true); ids(context.rootState.referenceIds, 100);
  if (!Array.isArray(context.references) || context.references.length > 100) throw new Error('At most 100 scenario citations are supported.');
  const known = Object.fromEntries([HUG_REFERENCE, ...Object.values(METHOD_REFERENCES), ...BUNDLED_DATASETS.flatMap(dataset => dataset.references)].map(ref => [ref.id, ref]));
  for (const ref of context.references) {
    keys(ref, ['id', 'type', 'title', 'authors', 'year', 'doi', 'url', 'license', 'verification']); validateReference(ref);
    text(ref.id, 151, true); if (!idPattern.test(ref.id)) throw new Error('Invalid citation identity.');
    text(ref.title, 10000, true);
    if (ref.authors.length > 100) throw new Error('Too many citation authors.');
    for (const author of ref.authors) text(author, 1000);
    for (const field of [ref.doi, ref.url, ref.license]) if (field !== null) text(field, 5000);
    if (Object.hasOwn(known, ref.id) ? digestSync(ref) !== digestSync(known[ref.id]) : ref.verification !== 'unverified') throw new Error('Registered citation identity changed, or an unregistered citation claims verified status.');
  }
  const references = context.references.map(ref => ref.id); ids(references, 100);
  if ([...context.basis.referenceIds, ...context.rootState.referenceIds].some(id => !references.includes(id))) throw new Error('Scientific basis or root refers to a missing citation.');
  const dataset = bundledDataset(source.sha256);
  if (dataset?.references.some(ref => !context.references.some(record => digestSync(record) === digestSync(ref)))) throw new Error('Bundled data must retain its canonical source citations and terms.');
  if (!Array.isArray(context.corrections) || context.corrections.length > 10000) throw new Error('Too many display-label corrections.');
  ids(context.corrections.map(c => c.source_node_id), 10000);
  for (const correction of context.corrections) {
    keys(correction, ['source_node_id', 'raw_label', 'status', 'display_taxonomy', 'evidence_url', 'review_date']);
    if (!Object.hasOwn(source.nodes, correction.source_node_id) || source.nodes[correction.source_node_id].rawLabel !== correction.raw_label) throw new Error('Correction does not match an original source identity and label.');
    text(correction.status, 10000); text(correction.review_date, 100);
    if (correction.display_taxonomy !== null) text(correction.display_taxonomy, 10000);
    if (correction.evidence_url !== null && (typeof correction.evidence_url !== 'string' || !/^https?:\/\//i.test(correction.evidence_url) || correction.evidence_url.length > 5000)) throw new Error('Invalid display-correction evidence URL.');
  }
  object(context.childOrder);
  if (Object.keys(context.childOrder).length > source.order.length) throw new Error('Excessive child-order records.');
  ids(value.tipIds, 16);
  if (typeof value.tipCodes !== 'boolean') throw new Error('Tip-code preference must be boolean.');
  const tree = createLearningTree({ ...context, source }, value.tipIds);
  if (!Array.isArray(value.activities) || !value.activities.length || value.activities.length > MAX_ACTIVITIES) throw new Error(`A scenario needs 1–${MAX_ACTIVITIES} question setups.`);
  ids(value.activities.map(activity => activity.id), MAX_ACTIVITIES);
  for (const activity of value.activities) validateActivity(activity, tree);
  return { scenario: value, tree };
}

export function scenarioFromTree(tree: LearningTree, metadata: Pick<LearningScenario, 'title' | 'introduction' | 'teacherNotes' | 'tipCodes'>, activities: LearningActivity[]): LearningScenario {
  const { source, ...context } = structuredClone(tree.input);
  context.childOrder = structuredClone(tree.childOrder);
  const used = new Set([...context.basis.referenceIds, ...context.rootState.referenceIds]);
  context.references = context.references.filter(ref => used.has(ref.id));
  context.corrections = context.corrections.map(c => ({ source_node_id: c.source_node_id, raw_label: c.raw_label, status: c.status, display_taxonomy: c.display_taxonomy, evidence_url: c.evidence_url, review_date: c.review_date }));
  return { format: 'phyloink-learning-scenario', version: 1, ...metadata, source: { newick: source.text, sha256: source.sha256, hashBasis: 'legacy-utf8-text' }, context, tipIds: [...tree.tipIds], activities: structuredClone(activities) };
}
