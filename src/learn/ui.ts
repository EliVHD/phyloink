import { bundledDataset } from '../datasets.ts';
import { prepareBundledDataset } from '../import.ts';
import { searchSource } from '../search.ts';
import { displayLabel } from '../science.ts';
import { DEFAULT_STRUCTURED, layoutCluster } from '../structured/layout.ts';
import { sceneAnnotations, sceneArtwork } from '../structured/render.ts';
import { validateScene } from '../structured/validate.ts';
import type { RenderScene, StructuredSettings, TextMeasurements } from '../structured/types.ts';
import { MAX_LEARN_TIPS, checkAncestor, checkClade, commonAncestor, createLearningTree, learningAvailability, rotateLearningBranch, sameLearningRelationships } from './model.ts';
import type { LearningInput, LearningTree } from './model.ts';

type Task = 'ancestor' | 'clade' | 'compare';
type Selection = { input: LearningInput; tipIds: string[] };
type Host = { current: () => Selection };
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const field = (id: string) => $<HTMLSelectElement>(id);
const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

/** Ephemeral practice only: the host exposes reads, never project/history/export writes. */
export class LearnController {
  active = false;
  private input?: LearningInput;
  private tips: string[] = [];
  private original?: LearningTree;
  private tree?: LearningTree;
  private scenes: { left: RenderScene; right: RenderScene } | null = null;
  private task: Task = 'ancestor';
  private node: string | null = null;
  private answers = new Set<string>();
  private revealed = false;
  private sequence = 0;
  private loadSequence = 0;
  private offset = 0;
  private searchTimer?: ReturnType<typeof setTimeout>;
  private busy = false;
  private host: Host;

  constructor(host: Host) {
    this.host = host;
    $('learn-back').onclick = () => this.close();
    $('learn-current').onclick = () => this.run(() => this.use(this.host.current()));
    $('learn-demo').onclick = () => void this.run(() => this.demo());
    $('learn-task').onchange = () => {
      this.task = field('learn-task').value as Task; this.resetAnswer();
      if (this.task === 'clade') this.node = this.preferredNode();
      this.updateTask(); this.paint();
    };
    $('learn-reset-answer').onclick = () => { this.resetAnswer(); this.updateTask(); this.paint(); };
    for (const id of ['learn-first', 'learn-second']) $(id).onchange = () => { this.clearFeedback(); this.paint(); };
    $('learn-node').onchange = () => { this.node = field('learn-node').value || null; this.clearFeedback(); this.updateTask(); this.paint(); };
    $('learn-check').onclick = () => this.run(() => this.check(false));
    $('learn-explain').onclick = () => this.run(() => this.check(true));
    $('learn-rotate').onclick = () => this.run(() => {
      if (!this.tree || !this.node) throw new Error('Choose a numbered branching point to rotate.');
      this.tree = rotateLearningBranch(this.tree, this.node); this.clearFeedback();
      $('learn-notice').textContent = `Rotated Node ${this.tree.nodeNumbers[this.node]}. Connections and clade memberships are preserved.`;
      void this.draw();
    });
    $('learn-reset-order').onclick = () => { this.tree = this.original; this.clearFeedback(); void this.draw(); };
    $('learn-layout').onchange = () => void this.draw();
    $('learn-codes').onchange = () => void this.draw();
    $('learn-search').oninput = () => {
      clearTimeout(this.searchTimer); this.offset = 0; this.searchTimer = setTimeout(() => this.search(), 120);
    };
    $('learn-results').onclick = event => this.run(() => {
      if (this.busy) return;
      const target = (event.target as Element).closest<HTMLElement>('[data-learn-add],[data-learn-page]');
      if (target?.dataset.learnAdd) {
        if (this.tips.length >= MAX_LEARN_TIPS) throw new Error(`Remove a tip before adding another; practice samples are limited to ${MAX_LEARN_TIPS}.`);
        if (!this.tips.includes(target.dataset.learnAdd)) this.tips.push(target.dataset.learnAdd);
        this.rebuild(); this.search();
      } else if (target?.dataset.learnPage) { this.offset = Number(target.dataset.learnPage); this.search(); }
    });
    $('learn-sample').onclick = event => {
      if (this.busy) return;
      const id = (event.target as Element).closest<HTMLElement>('[data-learn-remove]')?.dataset.learnRemove;
      if (id) { this.tips = this.tips.filter(tip => tip !== id); this.rebuild(); this.search(); }
    };
    $('learn-clade-tips').onchange = event => {
      const checkbox = event.target as HTMLInputElement, id = checkbox.dataset.learnTip;
      if (id) { if (checkbox.checked) this.answers.add(id); else this.answers.delete(id); this.clearFeedback(); this.paint(); }
    };
    $('learn-comparison').onchange = () => { this.clearFeedback(); this.paint(); };
    for (const id of ['learn-left', 'learn-right']) {
      const choose = (event: Event) => {
        const target = (event.target as Element).closest<SVGElement>('[data-learn-node]');
        if (!target || !this.tree || this.busy) return;
        this.node = target.dataset.learnNode!; this.clearFeedback(); this.updateTask(); this.paint();
        if (event.type === 'keydown') $(id).querySelector<SVGElement>(`[data-learn-node="${this.node}"]`)?.focus();
      };
      $(id).addEventListener('click', choose);
      $(id).addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(event); } });
    }
    document.fonts.addEventListener('loadingdone', () => { if (this.active && this.tree) void this.draw(); });
  }

  open(): void {
    this.active = true;
    document.querySelector<HTMLElement>('.workspace')!.hidden = true;
    $('learn-view').hidden = false;
    for (const id of ['datasets-btn', 'import-btn', 'save-btn', 'export-btn']) $(id).hidden = true;
    this.use(this.host.current()); $('learn-back').focus();
  }
  close(): void {
    this.active = false; this.sequence++; this.loadSequence++; clearTimeout(this.searchTimer);
    this.input = undefined; this.tree = this.original = undefined; this.scenes = null; this.tips = []; this.busy = false;
    $('learn-view').hidden = true; document.querySelector<HTMLElement>('.workspace')!.hidden = false;
    for (const id of ['datasets-btn', 'import-btn', 'save-btn', 'export-btn']) $(id).hidden = false;
    $('learn-view-btn').focus();
  }
  private async run(action: () => unknown): Promise<void> {
    try { await action(); } catch (error) { if (this.active) $('learn-notice').textContent = error instanceof Error ? error.message : String(error); }
  }
  private use(selection: Selection): void {
    this.loadSequence++;
    this.input = structuredClone(selection.input); this.tips = [...selection.tipIds]; this.offset = 0;
    $<HTMLInputElement>('learn-search').value = ''; this.sourceSummary(); this.rebuild(); this.search();
  }
  private async demo(): Promise<void> {
    if (this.busy) return;
    const request = ++this.loadSequence; this.busy = true;
    $<HTMLButtonElement>('learn-demo').disabled = true; $<HTMLButtonElement>('learn-current').disabled = true;
    $('learn-notice').textContent = 'Opening the bundled mammal demonstration locally…';
    try {
      const response = await fetch('/data/datasets/upham-2019.nwk'); if (!response.ok) throw new Error('The bundled mammal source could not be loaded.');
      const f = await prepareBundledDataset('upham-2019', await response.text(), null);
      if (!this.active || request !== this.loadSequence) return;
      const names = ['Homo_sapiens', 'Pan_troglodytes', 'Gorilla_gorilla', 'Mus_musculus', 'Rattus_norvegicus', 'Oryctolagus_cuniculus'];
      const tips = names.map(name => { const matches = f.source.tips.filter(id => f.source.nodes[id].rawLabel.startsWith(name + '_')); if (matches.length !== 1) throw new Error('The demonstration source identities do not match.'); return matches[0]; });
      const corrections = tips.map((id, i) => ({ source_node_id: id, raw_label: f.source.nodes[id].rawLabel, display_taxonomy: names[i].replaceAll('_', ' '), status: 'display-only shortening in Learn', evidence_url: 'https://doi.org/10.5061/dryad.tb03d03', review_date: '2026-11-11' }));
      this.use({ input: { source: f.source, root: f.project.recipe.root, rootState: f.project.authoring.root, basis: f.project.authoring.basis, corrections, childOrder: {}, title: 'Six mammals · Upham et al. (2019)', references: Object.values(f.project.authoring.provenance.references) }, tipIds: tips });
    } finally { this.busy = false; $<HTMLButtonElement>('learn-demo').disabled = false; $<HTMLButtonElement>('learn-current').disabled = false; }
  }
  private label(id: string): string { return this.input ? displayLabel(this.input.source, id, this.input.corrections) : id; }
  private tipName(id: string): string { return `T${this.tips.indexOf(id) + 1} · ${this.label(id)}`; }
  private preferredNode(): string | null {
    return this.tree?.branchIds.find(id => this.tree!.graph.nodes[id].selectedMembers.length < this.tips.length) ?? this.tree?.branchIds[0] ?? null;
  }
  private resetAnswer(): void {
    this.node = null; this.answers.clear(); this.clearFeedback();
    for (const element of $('learn-clade-tips').querySelectorAll<HTMLInputElement>('input')) element.checked = false;
    for (const element of $('learn-comparison').querySelectorAll<HTMLInputElement>('input')) element.checked = false;
  }
  private clearFeedback(): void { this.revealed = false; $('learn-feedback').textContent = ''; }
  private sourceSummary(): void {
    if (!this.input) return;
    const { basis, rootState, references } = this.input, dataset = bundledDataset(this.input.source.sha256);
    $('learn-source-title').textContent = this.input.title;
    $('learn-source-summary').textContent = `${basis.name} · Entities: ${basis.entityKind}. ${basis.entityKind === 'genes-sequences' ? 'Gene/sequence ancestry does not establish species ancestry. ' : ''}Root: ${rootState.status}${rootState.status === 'rooted' ? ` (${rootState.basis})` : ''}. ${rootState.explanation}`;
    $('learn-source-detail').innerHTML = `<p>${esc(basis.evidenceBasis || 'Evidence not supplied.')}</p><p>${esc(basis.limitations)}</p>${dataset ? `<p>Source terms: <a href="${esc(dataset.licenseUrl)}" target="_blank" rel="noopener">${esc(dataset.license)}</a> · ${esc(dataset.release)}.</p>` : '<p>Source rights and user-supplied evidence have not been independently verified.</p>'}` + references.map(ref => `<p>${ref.url && /^https?:\/\//.test(ref.url) ? `<a href="${esc(ref.url)}" target="_blank" rel="noopener">${esc(ref.title)}</a>` : esc(ref.title)}${ref.verification === 'unverified' ? ' (user-supplied, unverified)' : ''}</p>`).join('');
  }
  private rebuild(): void {
    if (!this.input) return;
    this.sequence++; this.tree = this.original = undefined; this.scenes = null; this.resetAnswer();
    $('learn-sample').innerHTML = this.tips.map(id => `<li><span>${esc(this.tipName(id))}<small>${esc(id)}</small></span><button class="button compact" data-learn-remove="${esc(id)}" aria-label="Remove ${esc(this.label(id))} from practice sample">Remove</button></li>`).join('');
    $('learn-count').textContent = `${this.tips.length} of ${this.input.source.tips.length.toLocaleString()} source tips in the practice sample. Choose 2–${MAX_LEARN_TIPS}.`;
    const reason = learningAvailability(this.input);
    if (reason) $('learn-notice').textContent = reason + ' You can still try the separate six-mammal demonstration.';
    else if (this.tips.length < 2) $('learn-notice').textContent = 'Choose at least two source tips, or try the six-mammal demonstration.';
    else try { this.tree = this.original = createLearningTree(this.input, this.tips); $('learn-notice').textContent = ''; } catch (error) { $('learn-notice').textContent = error instanceof Error ? error.message : String(error); }
    const options = this.tips.map(id => `<option value="${esc(id)}">${esc(this.tipName(id))}</option>`).join('');
    for (const id of ['learn-first', 'learn-second']) field(id).innerHTML = options;
    if (this.tips.length > 1) field('learn-second').value = this.tips[1];
    field('learn-node').innerHTML = '<option value="">Choose a numbered node</option>' + (this.tree?.branchIds.map(id => `<option value="${esc(id)}">Node ${this.tree!.nodeNumbers[id]} · ${esc(id)}</option>`).join('') ?? '');
    $('learn-clade-tips').innerHTML = this.tips.map(id => `<label><input type="checkbox" data-learn-tip="${esc(id)}"> <span>${esc(this.tipName(id))}</span></label>`).join('');
    if (this.task === 'clade') this.node = this.preferredNode();
    for (const element of $('learn-exercise').querySelectorAll<HTMLButtonElement | HTMLSelectElement | HTMLInputElement>('button,select,input')) element.disabled = !this.tree;
    this.updateTask(); void this.draw();
  }
  private updateTask(): void {
    for (const element of $('learn-exercise').querySelectorAll<HTMLElement>('[data-learn-task]')) element.hidden = element.dataset.learnTask !== this.task;
    field('learn-node').value = this.node ?? '';
    $('learn-node-label').textContent = this.task === 'ancestor' ? 'Your ancestor choice' : this.task === 'clade' ? 'Clade to identify' : 'Node to rotate';
    $('learn-node-note').textContent = this.node && this.tree ? `Node ${this.tree.nodeNumbers[this.node]} marks branching point ${this.node} in this supplied rooted tree.` : 'Choose a numbered branching point in either drawing or in the list above.';
  }
  private search(): void {
    if (!this.input) return;
    const query = $<HTMLInputElement>('learn-search').value;
    if (!query.trim()) { $('learn-results').innerHTML = '<p>Search the supplied tip names or exact source IDs. Identical names retain separate identities.</p>'; return; }
    const page = searchSource(this.input.source, query, this.input.corrections, { tipsOnly: true, offset: this.offset, limit: 15 }); this.offset = page.offset;
    $('learn-results').innerHTML = `<p>${page.total ? `${page.offset + 1}–${page.offset + page.results.length} of ${page.total}` : 'No'} matching tips</p>` + page.results.map(result => `<button class="search-result" data-learn-add="${esc(result.id)}" ${this.tips.includes(result.id) ? 'disabled' : ''}>${esc(result.label)}<span>${esc(result.id)} · ${this.tips.includes(result.id) ? 'already in sample' : 'add to practice sample'}</span></button>`).join('') + (page.total > 15 ? `<div class="button-row"><button class="button" data-learn-page="${Math.max(0, page.offset - 15)}" ${!page.offset ? 'disabled' : ''}>Previous</button><button class="button" data-learn-page="${page.offset + 15}" ${page.offset + 15 >= page.total ? 'disabled' : ''}>Next</button></div>` : '');
  }
  private async draw(): Promise<void> {
    const tree = this.tree, original = this.original, sequence = ++this.sequence;
    this.scenes = null; this.paint();
    if (!tree || !original) return;
    try {
      await document.fonts.ready;
      const make = async (model: LearningTree, kind: 'rectangular' | 'circular') => {
        const settings: StructuredSettings = { ...DEFAULT_STRUCTURED, kind, widthMm: 150, heightMm: 140, marginMm: 12, fontSizePt: 14, fontFamily: 'sans-serif', curves: false, labelPlacement: 'horizontal', innerRadiusMm: 5, outerRadiusMm: 42 };
        const codes = $<HTMLInputElement>('learn-codes').checked;
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
        return { scene, findings };
      };
      const [left, right] = await Promise.all([make(original, 'rectangular'), make(tree, field('learn-layout').value === 'rectangular' ? 'rectangular' : 'circular')]);
      if (!this.active || sequence !== this.sequence) return;
      this.scenes = { left: left.scene, right: right.scene };
      const findings = [left, right].flatMap((drawing, i) => drawing.findings.length ? [`Drawing ${i + 1}: ${drawing.findings.join('; ')}.`] : []);
      $('learn-layout-note').textContent = (findings.length ? findings.join(' ') + ' Try fewer tips, tip codes or a rectangular drawing. ' : 'Both drawings use the same source identities and relationships. ') + 'Spacing is nonmetric; node numbers are practice markers. On small screens, scroll each drawing sideways.';
      this.paint();
    } catch (error) { if (this.active && sequence === this.sequence) $('learn-notice').textContent = error instanceof Error ? error.message : String(error); }
  }
  private paint(): void {
    const tree = this.tree;
    if (!tree || !this.scenes) { for (const id of ['learn-left', 'learn-right']) $(id).innerHTML = ''; return; }
    let answerNode: string | null = null;
    if (this.revealed && this.task === 'ancestor') try { answerNode = commonAncestor(tree, field('learn-first').value, field('learn-second').value); } catch { /* An incomplete pair has no answer. */ }
    for (const [id, scene] of [['learn-left', this.scenes.left], ['learn-right', this.scenes.right]] as const) {
      const svg = $<HTMLElement>(id), b = scene.bounds, pad = 10;
      svg.setAttribute('viewBox', `${b.minX - pad} ${b.minY - pad} ${Math.max(20, b.maxX - b.minX + pad * 2)} ${Math.max(20, b.maxY - b.minY + pad * 2)}`);
      svg.style.aspectRatio = `${Math.max(20, b.maxX - b.minX + pad * 2)} / ${Math.max(20, b.maxY - b.minY + pad * 2)}`;
      const markers = scene.junctionGlyphs.filter(g => tree.branchIds.includes(g.nodeId)).map(g => `<g data-learn-node="${esc(g.nodeId)}" role="button" tabindex="0" aria-label="Choose Node ${tree.nodeNumbers[g.nodeId]}, source ${esc(g.nodeId)}" aria-pressed="${this.node === g.nodeId}" class="learn-node${this.node === g.nodeId ? ' chosen' : ''}${answerNode === g.nodeId ? ' answer' : ''}"><circle cx="${g.anchor.x}" cy="${g.anchor.y}" r="3.2"/><text x="${g.anchor.x}" y="${g.anchor.y + 1}" text-anchor="middle">${tree.nodeNumbers[g.nodeId]}</text><title>Node ${tree.nodeNumbers[g.nodeId]} · ${esc(g.nodeId)}</title></g>`).join('');
      const artwork = (sceneArtwork(scene, this.task === 'clade' ? [...this.answers] : []) + sceneAnnotations(scene)).replaceAll(/\bid="([^"]+)"/g, `id="${id}-$1"`);
      svg.innerHTML = artwork + markers;
    }
    $('learn-compare-state').textContent = sameLearningRelationships(this.original!, tree) ? 'Source identities and paths are preserved during practice.' : 'Relationship comparison unavailable.';
  }
  private check(explain: boolean): void {
    if (!this.tree) throw new Error('Choose a rooted source and a practice sample first.');
    const tree = this.tree; this.revealed = explain;
    let message = '';
    if (this.task === 'ancestor') {
      const first = field('learn-first').value, second = field('learn-second').value;
      const answer = commonAncestor(tree, first, second);
      if (!this.node && !explain) throw new Error('Choose a numbered branching point before checking your answer.');
      const result = this.node ? checkAncestor(tree, first, second, this.node) : null;
      message = result?.kind === 'correct' ? 'Correct: the two branches first meet at this node when traced toward the declared root.' : result?.kind === 'older' ? 'This is a shared ancestor, but a more recent shared ancestor is represented. Trace the branches back until they first meet.' : 'Trace both tips toward the declared root and look for the first node shared by their paths.';
      if (explain) message += ` In this supplied tree, ${this.tipName(first)} and ${this.tipName(second)} first meet at Node ${tree.nodeNumbers[answer]} (${answer}). Apparent label distance does not determine relatedness.`;
    } else if (this.task === 'clade') {
      if (!this.node) throw new Error('Choose a numbered branching point first.');
      const result = checkClade(tree, this.node, [...this.answers]);
      message = result.correct ? 'Correct: you selected every displayed descendant of this node and no displayed tips outside it.' : 'The selected set is incomplete or includes tips outside this represented group.';
      if (result.missing.length) message += ` Missing: ${result.missing.map(id => this.tipName(id)).join('; ')}.`;
      if (result.extra.length) message += ` Outside this group: ${result.extra.map(id => this.tipName(id)).join('; ')}.`;
      if (explain) message += ` Displayed descendants: ${result.expected.map(id => this.tipName(id)).join('; ')}.`;
      message += ` This node has ${result.fullSourceCount} descendants in the full source; ${result.omittedCount} are outside this practice sample. A complete source clade includes those descendants too.`;
    } else {
      const choice = $('learn-comparison').querySelector<HTMLInputElement>('input:checked')?.value;
      if (!choice && !explain) throw new Error('Choose whether the relationships are the same or different.');
      message = choice === 'same' ? 'Correct. ' : '';
      message += 'The relationships are the same. The drawings retain the same tips, ancestor identities and source paths. Layout changes and rotations exchange drawing positions while preserving complete child subtrees, including unresolved forks.';
    }
    $('learn-feedback').textContent = message; $('learn-notice').textContent = ''; this.paint();
  }
}
