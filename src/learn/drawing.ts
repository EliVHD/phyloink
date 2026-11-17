import { DEFAULT_STRUCTURED, layoutCluster } from '../structured/layout.ts';
import { validateScene } from '../structured/validate.ts';
import type { RenderScene, StructuredSettings, TextMeasurements } from '../structured/types.ts';
import type { LearningTree } from './model.ts';
export type LearningDrawing = { scene: RenderScene; findings: string[]; qa: ReturnType<typeof validateScene> };
/** Browser-measured nonmetric practice drawing, shared by Learn and explicit worksheets. */
export async function drawLearningTree(model: LearningTree, kind: 'rectangular' | 'circular', codes: boolean): Promise<LearningDrawing> {
  await document.fonts.ready;
  const settings: StructuredSettings = { ...DEFAULT_STRUCTURED, kind, widthMm: 150, heightMm: 140, marginMm: 12, fontSizePt: 14, fontFamily: 'sans-serif', curves: false, labelPlacement: 'horizontal', innerRadiusMm: 5, outerRadiusMm: 42 };
  const graph = codes ? { ...model.graph, nodes: Object.fromEntries(Object.entries(model.graph.nodes).map(([id, node]) => [id, { ...node, label: model.tipIds.includes(id) ? `T${model.tipIds.indexOf(id) + 1}` : node.label }])) } : model.graph;
  await document.fonts.load(`${settings.fontSizePt}pt ${settings.fontFamily}`);
  const context = document.createElement('canvas').getContext('2d'); if (!context) throw new Error('Browser text measurement is unavailable.');
  context.font = `${settings.fontSizePt * 96 / 72}px ${settings.fontFamily}`; const k = 25.4 / 96, mm = settings.fontSizePt * 25.4 / 72;
  const measurements: TextMeasurements = { fontFamily: settings.fontFamily, fontSizePt: settings.fontSizePt, fontStatus: document.fonts.check(`${settings.fontSizePt}pt ${settings.fontFamily}`) ? 'available' : 'substituted', metrics: Object.fromEntries(graph.endpoints.map(id => { const text = graph.nodes[id].label, m = context.measureText(text); return [id, { text, widthMm: Math.max(m.width, m.actualBoundingBoxLeft + m.actualBoundingBoxRight) * k, advanceMm: m.width * k, leftMm: -m.actualBoundingBoxLeft * k, rightMm: m.actualBoundingBoxRight * k, ascentMm: Math.max(m.actualBoundingBoxAscent * k, mm * .75), descentMm: Math.max(m.actualBoundingBoxDescent * k, mm * .2) }]; })) };
  // Give branching points room without removing retained intermediate source nodes.
  // These display-only levels carry no evolutionary distance or time meaning.
  const height: Record<string, number> = {}, weighted: Record<string, number> = {};
  for (const id of [...graph.order].reverse()) {
    const children = graph.nodes[id].children;
    height[id] = children.length ? 1 + Math.max(...children.map(child => height[child])) : 0;
    weighted[id] = children.length ? (children.length > 1 ? 1 : .25) + Math.max(...children.map(child => weighted[child])) : 0;
  }
  const offsets = Object.fromEntries(graph.order.filter(id => graph.nodes[id].children.length).map(id => [id, { depth: height[id] / height[graph.rootId] - weighted[id] / weighted[graph.rootId], shift: 0 }]));
  const scene = layoutCluster(graph, settings, measurements, offsets), qa = validateScene(graph, scene);
  const markers = scene.junctionGlyphs.filter(glyph => model.branchIds.includes(glyph.nodeId));
  const crowded = markers.some((a, i) => markers.slice(i + 1).some(b => Math.hypot(a.anchor.x - b.anchor.x, a.anchor.y - b.anchor.y) < 6.8));
  const findings: string[] = [];
  if (qa.labelCollisions) findings.push('label overlaps need review');
  if (measurements.fontStatus !== 'available') findings.push('font substitution needs review');
  if (!qa.incidencePassed || !qa.crossingPassed || !qa.clearancePassed) findings.push('branch attachments, contacts or tight spacing need review');
  if (qa.limited) findings.push('geometry checks reached their work limit and are incomplete');
  if (crowded) findings.push('node markers are close; use the node dropdown for an exact choice');
  return { scene, findings, qa };
}
