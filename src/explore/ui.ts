import type { RootSpec } from '../types.ts';
import { searchSource } from '../search.ts';
import { fitBox, focusBox, selectDetail, sourcePath, NODE_BUDGET, LABEL_BUDGET } from './index.ts';
import type { Box, ExploreIndex, ExploreMode } from './index.ts';
import { renderExplore } from './render.ts';
import type { ExploreContext, ExploreInput } from './drawing.ts';
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/** Owns only ephemeral viewing state. No project mutation, QA, export or history callbacks. */
export class ExploreController {
  active = false;
  private input?: ExploreInput;
  private scope: 'source' | 'drawing' = 'source';
  private returnFocusId = 'explore-view-btn';
  private sourceParents = new Map<string, string>();
  private index?: ExploreIndex;
  private worker?: Worker;
  private sequence = 0;
  private mode: ExploreMode = 'rectangular';
  private camera: Box = { x: 0, y: 0, w: 1000, h: 1000 };
  private expanded = new Set<number>();
  private selectedId?: string;
  private lookup = new Map<string, number>();
  private corrections = new Map<string, string>();
  private raf = 0;
  private offset = 0;
  private searchTimer?: ReturnType<typeof setTimeout>;
  private drag?: { x: number; y: number; camera: Box; moved: boolean };
  private width = 1;
  private height = 1;
  private indexMs = 0;
  private context = document.createElement('canvas').getContext('2d')!;

  constructor() {
    $('explore-back').onclick = () => this.close();
    $('explore-home').onclick = () => this.home();
    $('explore-in').onclick = () => this.zoom(.65);
    $('explore-out').onclick = () => this.zoom(1 / .65);
    $('explore-focus').onclick = () => { if (this.selectedId) this.focus(this.selectedId); };
    $('explore-layout').onchange = () => { this.mode = $<HTMLSelectElement>('explore-layout').value as ExploreMode; this.build(); };
    $('explore-scope').onchange = () => { if (this.selectedId === 'virtual-root') this.selectedId = undefined; this.scope = $<HTMLSelectElement>('explore-scope').value as 'source' | 'drawing'; this.offset = 0; this.build(); this.search(); };
    $('explore-search').oninput = () => { clearTimeout(this.searchTimer); this.offset = 0; this.searchTimer = setTimeout(() => this.search(), 140); };
    $('explore-results').onclick = event => {
      const target = (event.target as Element).closest<HTMLElement>('[data-explore-id],[data-explore-page]');
      if (target?.dataset.exploreId) this.focus(target.dataset.exploreId);
      else if (target?.dataset.explorePage) { this.offset = Number(target.dataset.explorePage); this.search(); }
    };
    $('explore-inspector').onclick = event => {
      if ((event.target as Element).closest('[data-explore-source]')) { if (this.selectedId === 'virtual-root') this.selectedId = undefined; this.scope = 'source'; $<HTMLSelectElement>('explore-scope').value = 'source'; this.build(); this.search(); return; }
      const target = (event.target as Element).closest<HTMLElement>('[data-explore-id]'); if (target?.dataset.exploreId) this.focus(target.dataset.exploreId);
    };
    const stage = $('explore-stage');
    stage.addEventListener('wheel', event => { event.preventDefault(); const rect = stage.getBoundingClientRect(); this.zoom(Math.exp(Math.max(-.35, Math.min(.35, event.deltaY * .0015))), event.clientX - rect.left, event.clientY - rect.top); }, { passive: false });
    stage.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      stage.focus(); this.drag = { x: event.clientX, y: event.clientY, camera: { ...this.camera }, moved: false }; stage.setPointerCapture(event.pointerId);
    });
    stage.addEventListener('pointermove', event => {
      if (!this.drag) return;
      const dx = event.clientX - this.drag.x, dy = event.clientY - this.drag.y;
      if (Math.hypot(dx, dy) > 3) this.drag.moved = true;
      if (!this.drag.moved) return;
      this.camera = { ...this.drag.camera, x: this.drag.camera.x - dx * this.drag.camera.w / this.width, y: this.drag.camera.y - dy * this.drag.camera.h / this.height }; this.schedule();
    });
    stage.addEventListener('pointerup', event => {
      const moved = this.drag?.moved; this.drag = undefined;
      if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
      if (!moved) {
        const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-explore-node]');
        if (hit && this.index) { this.selectedId = this.index.ids[Number(hit.dataset.exploreNode)]; this.inspect(); this.schedule(); }
      }
    });
    stage.addEventListener('pointercancel', () => { this.drag = undefined; });
    stage.addEventListener('dblclick', event => {
      const hit = (event.target as Element).closest<HTMLElement>('[data-explore-node]');
      if (hit && this.index) this.focus(this.index.ids[Number(hit.dataset.exploreNode)]); else this.zoom(.5);
    });
    stage.addEventListener('keydown', event => {
      if (event.key === 'Home') this.home();
      else if (['+', '='].includes(event.key)) this.zoom(.65);
      else if (event.key === '-') this.zoom(1 / .65);
      else if (event.key === 'Enter' && this.selectedId) this.focus(this.selectedId);
      else if (event.key.startsWith('Arrow')) {
        this.camera.x += (event.key === 'ArrowLeft' ? -.15 : event.key === 'ArrowRight' ? .15 : 0) * this.camera.w;
        this.camera.y += (event.key === 'ArrowUp' ? -.15 : event.key === 'ArrowDown' ? .15 : 0) * this.camera.h; this.schedule();
      } else return;
      event.preventDefault();
    });
    new ResizeObserver(() => {
      if (!this.active) return;
      const old = this.camera, size = stage.getBoundingClientRect();
      this.width = Math.max(1, size.width); this.height = Math.max(1, size.height);
      this.camera = fitBox(old, this.width, this.height, 1); this.schedule();
    }).observe(stage);
    document.fonts?.addEventListener('loadingdone', () => this.schedule());
  }
  open(input: ExploreInput, scope: 'source' | 'drawing' = 'source', selectedId?: string, returnFocusId = 'explore-view-btn'): void {
    this.input = input; this.active = true; this.scope = scope; this.selectedId = selectedId; this.returnFocusId = returnFocusId;
    $<HTMLSelectElement>('explore-scope').value = scope;
    this.sourceParents.clear(); for (const id of input.source.order) for (const child of input.source.nodes[id].children) this.sourceParents.set(child, id);
    document.querySelector<HTMLElement>('.workspace')!.hidden = true; $('explore-view').hidden = false;
    for (const id of ['datasets-btn', 'import-btn', 'save-btn', 'export-btn']) $(id).hidden = true;
    $<HTMLInputElement>('explore-search').value = ''; this.offset = 0;
    const size = $('explore-stage').getBoundingClientRect(); this.width = Math.max(1, size.width); this.height = Math.max(1, size.height);
    this.build(); this.search(); $('explore-back').focus();
  }
  close(): void {
    this.active = false; this.sequence++; this.worker?.terminate(); this.worker = undefined; cancelAnimationFrame(this.raf); this.raf = 0; clearTimeout(this.searchTimer); this.drag = undefined;
    $('explore-view').hidden = true; document.querySelector<HTMLElement>('.workspace')!.hidden = false;
    for (const id of ['datasets-btn', 'import-btn', 'save-btn', 'export-btn']) $(id).hidden = false;
    $(this.returnFocusId)?.focus();
    this.input = undefined; this.index = undefined; this.lookup.clear(); this.sourceParents.clear();
  }
  private currentContext(): ExploreContext { return this.scope === 'drawing' ? this.input!.drawing : this.input!; }
  private describe(): void {
    const input = this.input!, context = this.currentContext(), drawing = input.drawing;
    this.corrections = new Map(context.corrections.filter(c => c.display_taxonomy).map(c => [c.source_node_id, c.display_taxonomy!]));
    $('explore-title').textContent = this.scope === 'drawing' ? drawing.title : input.title;
    const meaning = context.basis.relationshipKind === 'classification' ? 'Classification · supplied membership links, not evolutionary ancestors.'
      : this.scope === 'drawing' && drawing.unrooted ? 'Unrooted drawing · display direction and parent links do not establish ancestry.'
      : context.rootState.status === 'rooted' && context.basis.relationshipKind === 'phylogeny' ? `Rooted source topology · root basis: ${context.rootState.basis}. Evidence is available in Scientific context below.`
      : 'Source traversal only · no biological root or ancestry claim. This is not an unrooted embedding.';
    $('explore-meaning').textContent = (this.scope === 'drawing' ? `Current accepted drawing · ${drawing.topology.representedTips.length.toLocaleString()} represented / ${input.source.tips.length.toLocaleString()} source tips; ${drawing.topology.omittedTips.length.toLocaleString()} omitted. ${drawing.note} ` : 'Complete source · ') + meaning + ' Nonmetric viewing spacing; source distances, dates, ranks and confidence are not encoded.';
    $('explore-legend').textContent = this.scope === 'drawing' ? '◆ Solid diamond = authored collapsed group, fixed on zoom · dashed shaded region = temporary viewing summary · click to inspect, double-click to focus' : 'Dashed shaded region = temporary viewing summary · zoom or search for detail · click to inspect, double-click to focus';
  }
  private build(): void {
    if (!this.input || !this.active) return;
    this.describe(); this.worker?.terminate(); this.index = undefined; this.lookup.clear(); this.expanded.clear();
    const canvas = $('explore-canvas'); for (const key of Object.keys(canvas.dataset)) delete canvas.dataset[key];
    canvas.innerHTML = ''; $('explore-status').textContent = `Preparing ${this.scope === 'drawing' ? 'accepted drawing' : 'complete source'} in a cancellable background worker…`;
    $('explore-inspector').textContent = 'Preparing source identities…';
    const sequence = ++this.sequence, input = this.input, mode = this.mode, scope = this.scope, context = this.currentContext();
    const worker = new Worker(new URL('./worker.ts', import.meta.url).href.replace(/\.ts$/, '.js'), { type: 'module' }); this.worker = worker;
    worker.onmessage = ({ data }) => {
      if (!this.active || sequence !== this.sequence || this.worker !== worker) return;
      worker.terminate(); this.worker = undefined;
      if (data.error) { $('explore-status').textContent = `Explore unavailable: ${data.error}`; return; }
      if (data.sequence !== sequence || data.sourceSha !== input.source.sha256 || data.mode !== mode || data.index.scope !== scope) return;
      this.index = data.index; this.indexMs = data.indexMs; this.lookup = new Map(this.index!.ids.map((id, i) => [id, i]));
      this.home(); this.inspect(); if (this.selectedId) this.focus(this.selectedId);
    };
    worker.onerror = event => { if (this.active && sequence === this.sequence) $('explore-status').textContent = `Explore unavailable: ${event.message}`; worker.terminate(); };
    const root: RootSpec = context.basis.relationshipKind === 'classification' ? { kind: 'node', sourceNodeId: input.source.rootId, status: 'classification_parent_links' } : context.root;
    worker.postMessage({ sequence, sourceSha: input.source.sha256, sourceText: input.source.text, root, childOrder: context.childOrder, mode, ...(scope === 'drawing' ? { drawing: input.drawing.topology } : {}) });
  }
  private label(i: number): string {
    const id = this.index!.ids[i], node = this.input!.source.nodes[id];
    if (this.scope === 'drawing') {
      const drawn = this.input!.drawing.topology.nodes[id];
      // Preserve numeric internal labels verbatim in source fields, without assigning support semantics.
      return drawn.children.length && (!node?.rawLabel.trim() || /^[\d.eE+\-/\s]+$/.test(drawn.label)) ? `Source node ${id}` : drawn.label;
    }
    if (!node) return 'Virtual traversal junction';
    if (!node.children.length) return this.corrections.get(id) ?? node.label;
    return node.rawLabel.trim() && !/^[\d.eE+\-/\s]+$/.test(node.label) ? node.label : `Source node ${id}`;
  }
  private home(): void { if (this.index) { this.camera = fitBox(this.index.extent, this.width, this.height, 1.24); this.schedule(); } }
  private focus(id: string): void {
    this.selectedId = id;
    const i = this.lookup.get(id); if (i === undefined || !this.index) { this.inspect(); this.schedule(); return; }
    this.camera = focusBox(this.index, i, this.width, this.height); this.inspect(); this.schedule();
  }
  private zoom(factor: number, px = this.width / 2, py = this.height / 2): void {
    if (!this.index) return;
    const next = this.camera.h * factor; if (next < .002 || next > 20000) return;
    const x = this.camera.x + px / this.width * this.camera.w, y = this.camera.y + py / this.height * this.camera.h;
    this.camera = { x: x + (this.camera.x - x) * factor, y: y + (this.camera.y - y) * factor, w: this.camera.w * factor, h: next }; this.schedule();
  }
  private schedule(): void { if (this.active && !this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.draw(); }); }
  private draw(): void {
    if (!this.index || !this.active) return;
    const began = performance.now(), frame = selectDetail(this.index, this.camera, this.width / this.camera.w, this.expanded);
    this.expanded = frame.expanded; this.context.font = '12px system-ui';
    const render = renderExplore(this.index, frame, this.camera, this.width, this.height, this.selectedId ? this.lookup.get(this.selectedId) : undefined, i => this.label(i), text => this.context.measureText(text).width);
    const canvas = $('explore-canvas'); canvas.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`); canvas.innerHTML = render.svg;
    const ms = performance.now() - began, outside = this.index.tips - frame.coveredTips, budget = [...frame.summaries.values()].filter(v => v === 'budget').length;
    $('explore-status').textContent = `${this.index.tips.toLocaleString()} represented source tips${this.scope === 'drawing' ? ` · ${this.index.slots.toLocaleString()} authored endpoints · ${this.input!.drawing.topology.omittedTips.length.toLocaleString()} omitted source tips` : ''} · ${frame.nodes.length.toLocaleString()} drawn nodes/groups · ${frame.summaries.size} viewing summaries · ${outside.toLocaleString()} represented tips outside displayed groups${budget ? ` · ${budget} budget-limited groups; zoom or search for detail` : ''}`;
    $('explore-performance').textContent = `Index ${this.indexMs.toFixed(0)} ms · last SVG update ${ms.toFixed(1)} ms · ${render.labels} labels · limits ${NODE_BUDGET} nodes / ${LABEL_BUDGET} labels`;
    canvas.dataset.nodes = String(frame.nodes.length); canvas.dataset.summaries = String(frame.summaries.size); canvas.dataset.updateMs = ms.toFixed(2); canvas.dataset.sourceSha = this.index.sourceSha; canvas.dataset.selectedId = this.selectedId ?? ''; canvas.dataset.camera = JSON.stringify(this.camera);
    canvas.dataset.scope = this.scope; canvas.dataset.represented = String(this.index.tips); canvas.dataset.endpoints = String(this.index.slots); canvas.dataset.authoredGroups = String(this.index.authored.reduce((sum, n) => sum + n, 0));
    canvas.dataset.layout = this.mode;
  }
  private drawingLocation(id: string): string {
    const topology = this.input!.drawing.topology;
    if (Object.hasOwn(topology.nodes, id)) return topology.nodes[id].authoredGroup ? 'authored collapsed group' : 'drawing junction/tip';
    if (Object.hasOwn(topology.tipEndpoints, id)) return `represented inside group ${topology.tipEndpoints[id]}`;
    if (topology.omittedTips.includes(id)) return 'omitted from drawing sample';
    return 'not a displayed junction; inspect its complete-source path';
  }
  private search(): void {
    if (!this.input) return;
    const query = $<HTMLInputElement>('explore-search').value;
    if (!query.trim()) { $('explore-results').innerHTML = '<p class="help">Search the complete source in either scope. Results identify drawing junctions, hidden represented tips and omitted tips. Opening a result does not expand an authored group. Duplicate names stay separate.</p>'; return; }
    const page = searchSource(this.input.source, query, this.currentContext().corrections, { offset: this.offset, limit: 25 }); this.offset = page.offset;
    $('explore-results').innerHTML = `<p class="help">${page.total ? `${page.offset + 1}–${page.offset + page.results.length} of ${page.total}` : 'No'} matches in the full input</p>` + page.results.map(r => `<button class="search-result" data-explore-id="${esc(r.id)}">${esc(r.label)}<span>${esc(r.id)} · ${this.scope === 'drawing' ? esc(this.drawingLocation(r.id)) : r.kind}</span></button>`).join('') + (page.total > 25 ? `<div class="button-row"><button class="button" data-explore-page="${Math.max(0, page.offset - 25)}" ${page.offset === 0 ? 'disabled' : ''}>Previous</button><button class="button" data-explore-page="${page.offset + 25}" ${page.offset + 25 >= page.total ? 'disabled' : ''}>Next</button></div>` : '');
  }
  private inspect(): void {
    const i = this.selectedId ? this.lookup.get(this.selectedId) : undefined;
    if (!this.index) return;
    const context = this.currentContext();
    const evidence = `<details><summary>Scientific context / root evidence</summary><p>${esc(context.basis.name)}</p><p>${esc(context.basis.edgeMeaning)}</p><p>${esc(context.basis.evidenceBasis)}</p><p>${esc(context.rootState.explanation)}</p><p>${esc(context.basis.limitations)}</p></details>`;
    if (i === undefined) {
      const id = this.selectedId, node = id ? this.input!.source.nodes[id] : undefined;
      $('explore-inspector').innerHTML = node ? `<h2>${esc(node.label || id!)}</h2><code>${esc(id!)}</code><p>${esc(this.drawingLocation(id!))}. This source identity is not a separate junction in the accepted drawing.</p><button class="button" data-explore-source>Open complete source at this identity</button>${this.input!.drawing.topology.tipEndpoints[id!] ? `<button class="button" data-explore-id="${esc(this.input!.drawing.topology.tipEndpoints[id!])}">Inspect containing drawing group</button>` : ''}` : '<h2>Inspect relationships</h2><p>Choose Complete source or Current drawing. Click a junction, solid authored-group diamond or dashed viewing summary. Double-click to focus; scroll to zoom and drag to pan.</p><p>Authored collapsed groups remain fixed. Viewing summaries change with zoom. Search can reach any source identity without changing the drawing.</p><p>Keyboard: arrows pan, + / − zoom, Home fits, Enter focuses selection.</p>';
      $('explore-inspector').insertAdjacentHTML('beforeend', evidence); return;
    }
    const node = this.input!.source.nodes[this.selectedId!], parent = this.index.parent[i], path = sourcePath(this.index, i), sourceParent = node ? this.sourceParents.get(node.id) : undefined;
    let drawingInfo = '';
    if (this.scope === 'drawing') {
      const topology = this.input!.drawing.topology, current = topology.nodes[this.selectedId!], edge = topology.paths[this.selectedId!];
      const members = current.authoredGroup ? Object.entries(topology.tipEndpoints).filter(([, endpoint]) => endpoint === current.id).map(([tip]) => tip) : [];
      drawingInfo = `<p class="explore-drawing-note"><strong>${current.authoredGroup ? 'Authored collapsed group · fixed on zoom' : 'Accepted drawing identity'}</strong><br>${current.represented.toLocaleString()} represented / ${current.original.toLocaleString()} full-source tips in this oriented group; ${current.omitted.toLocaleString()} omitted.<br>${topology.omittedTips.length.toLocaleString()} omitted from the entire drawing sample.</p><button class="button" data-explore-source>Inspect in complete source</button>${members.length ? `<details><summary>Represented tip identities (${members.length})</summary><p>${members.slice(0, 20).map(id => `<button class="text-button" data-explore-id="${esc(id)}">${esc(id)}</button>`).join(' ')}${members.length > 20 ? ' · first 20 shown; search any source ID for the rest.' : ''}</p></details>` : ''}${edge ? `<details><summary>Original path of this drawing connection (${edge.sourcePath.length} junctions)</summary><p>${edge.sourcePath.map(id => `<button class="text-button" data-explore-id="${esc(id)}">${esc(id)}</button>`).join(' → ')}</p><p>Source edges: ${edge.sourceEdgeIds.map(esc).join(', ')}</p></details>` : ''}`;
    }
    $('explore-inspector').innerHTML = `${drawingInfo}<p class="eyebrow">SOURCE IDENTITY</p><h2>${esc(this.label(i))}</h2><code>${esc(this.selectedId!)}</code><p><strong>${this.index.count[i].toLocaleString()}</strong> represented source tips in this oriented group.</p><p>Selection stays attached to this identity at every zoom. Its traversal path is highlighted where visible.</p>${parent >= 0 ? `<button class="button" data-explore-id="${esc(this.index.ids[parent])}">Inspect parent junction</button>` : ''}<p>${path.length} displayed junctions on the traversal path.</p>${node ? `<details open><summary>Original source fields</summary><p>Label (verbatim; internal meaning unspecified):</p><pre>${esc(node.rawLabel || '(unnamed)')}</pre><p>Serialized parent: <code>${esc(sourceParent ?? '(top of input)')}</code></p><p>Incoming source length token: <code>${esc(node.lengthToken ?? '(missing)')}</code></p><p>Source annotations (uninterpreted):</p><pre>${esc(JSON.stringify(node.annotations, null, 2))}</pre></details>` : '<p>Temporary junction on the declared traversal edge; not a new source taxon. The original edge and its annotations remain unchanged.</p>'}`;
    $('explore-inspector').insertAdjacentHTML('beforeend', evidence);
  }
}
