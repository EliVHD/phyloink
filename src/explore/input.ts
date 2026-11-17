import type { Reduction, Rooted, Source } from '../types.ts';
import type { WorkingProject } from '../model/document.ts';
import type { StructuredView } from '../structured/types.ts';
import type { ExploreContext, ExploreInput } from './drawing.ts';
import { reductionTopology, structuredTopology } from './drawing.ts';
import { isStructuredStale } from '../structured/view.ts';

/** Snapshot accepted meaning/topology only; no artwork, history or editing callbacks. */
export function prepareExploreInput(source: Source, rooted: Rooted, reduction: Reduction, project: WorkingProject, view: StructuredView | null): ExploreInput {
  const context: ExploreContext = structuredClone({ root: project.recipe.root, childOrder: project.layout.childOrder, corrections: project.corrections, basis: project.authoring.basis, rootState: project.authoring.root, title: project.authoring.basis.name });
  if (!view) return { ...context, source, drawing: { ...structuredClone(context), title: `${project.title} · current reduction`, topology: reductionTopology(source, rooted, reduction, project.layout, project.corrections), unrooted: false, note: 'Accepted reduction and complete child order are retained. Authored groups stay collapsed.' } };
  const unrooted = !!(view.scene.unrooted || view.artistic?.baseScene.unrooted);
  return { ...context, source, drawing: {
    root: structuredClone(view.input.traversal), childOrder: structuredClone(view.projection.childOrder), corrections: structuredClone(view.input.corrections), basis: structuredClone(view.input.basis), rootState: structuredClone(view.input.root), title: `${project.title} · ${view.name}`, topology: structuredTopology(source, view), unrooted,
    note: `Accepted ${view.intent} topology; its own scientific snapshot is retained. ${isStructuredStale(project, view) ? 'The saved drawing differs from the current scientific metadata; no regeneration is performed. ' : ''}Viewing geometry carries no distance, date or rank scale.`,
  } };
}
