import { parseProbability } from './inheritance.ts';
import { BOTTLENECK_DEMO, geneDiversity, simulateBottleneck, validateBottleneck } from './bottleneck.ts';
import type { BottleneckResult, BottleneckSetup } from './bottleneck.ts';
import { bottleneckFigure, conditionName } from './bottleneck-render.ts';
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => $<HTMLInputElement>(id);
const percent = (value: number) => `${Number((100 * value).toFixed(4))}%`;
const fields = { initialSize: 'size', aCopies: 'copies', bottleneckSize: 'small', bottleneckStart: 'start', bottleneckDuration: 'duration', generations: 'generations', replicates: 'replicates', seed: 'seed' } as const;

/** Temporary neutral practice; no tree, host, history, import or document access. */
export class BottleneckController {
  private result: BottleneckResult | null = null;
  constructor() {
    for (const id of Object.values(fields)) input('bottleneck-' + id).oninput = () => this.changed();
    $('bottleneck-reset').onclick = () => this.reset();
    $('bottleneck-check').onclick = () => this.run(() => {
      const setup = this.setup(), answer = parseProbability(input('bottleneck-prediction').value), expected = setup.aCopies / (2 * setup.initialSize);
      $('bottleneck-feedback').textContent = (Math.abs(answer - expected) <= 1e-6 ? 'Your prediction matches the no-drift reference. ' : 'Compare with the initial A frequency. ') + this.explanation(setup);
    });
    $('bottleneck-explain').onclick = () => this.run(() => { $('bottleneck-feedback').textContent = this.explanation(this.setup()); });
    input('bottleneck-prediction').oninput = () => { $('bottleneck-feedback').textContent = ''; };
    $('bottleneck-run').onclick = () => this.run(() => {
      this.result = simulateBottleneck(this.setup()); input('bottleneck-generation').max = String(this.result.setup.generations); input('bottleneck-generation').value = '0'; this.paint();
      $('bottleneck-notice').textContent = `Ran ${this.result.setup.replicates} trials per condition; all generations retained. Each click restarts the seeded experiment. Inspect generation counts below.`;
    });
    input('bottleneck-generation').oninput = () => this.run(() => this.paint()); this.reset();
  }
  reset(): void { for (const [key, id] of Object.entries(fields)) input('bottleneck-' + id).value = String(BOTTLENECK_DEMO[key as keyof BottleneckSetup]); this.changed(); }
  worksheetCapture(): import('./worksheet.ts').WorksheetCapture { return { kind: 'bottleneck', setup: this.setup() }; }
  private setup(): BottleneckSetup {
    const value = (id: string) => input('bottleneck-' + id).value.trim() ? Number(input('bottleneck-' + id).value) : NaN;
    const setup: BottleneckSetup = { initialSize: value('size'), aCopies: value('copies'), bottleneckSize: value('small'), bottleneckStart: value('start'), bottleneckDuration: value('duration'), generations: value('generations'), replicates: value('replicates'), seed: value('seed') };
    validateBottleneck(setup); return setup;
  }
  private run(action: () => void): void {
    try { $('bottleneck-notice').textContent = ''; action(); } catch (error) { $('bottleneck-notice').textContent = error instanceof Error ? error.message : String(error); }
  }
  private changed(): void {
    this.result = null; $('bottleneck-results').hidden = true; input('bottleneck-prediction').value = '';
    for (const id of ['bottleneck-plot', 'bottleneck-table', 'bottleneck-summary', 'bottleneck-feedback', 'bottleneck-notice', 'bottleneck-start-summary']) $(id).textContent = '';
    this.run(() => { const s = this.setup(), recovery = s.bottleneckStart + s.bottleneckDuration;
      $('bottleneck-start-summary').textContent = `Generation 0: ${s.aCopies} A + ${2 * s.initialSize - s.aCopies} a copies in N = ${s.initialSize}. Bottleneck N = ${s.bottleneckSize} at generations ${s.bottleneckStart}–${recovery - 1}; N returns to ${s.initialSize} at generation ${recovery}. Constant-size comparison keeps N = ${s.initialSize}.`;
    });
  }
  private explanation(s: BottleneckSetup): string {
    return `Without drift, A frequency remains ${percent(s.aCopies / (2 * s.initialSize))} despite the size schedule. Actual target generations draw 2N_t gene copies from the previous frequency. Recovery changes the number of copies sampled, not the set of available alleles; an absent allele stays absent. A single path or four trials need not match an expectation or show greater loss than every control. H = 2p(1−p) describes this locus only, not counted heterozygous individuals or genome-wide diversity.`;
  }
  private paint(): void {
    const result = this.result; if (!result) return;
    const generation = Number(input('bottleneck-generation').value), s = result.setup, recovery = s.bottleneckStart + s.bottleneckDuration;
    if (!Number.isInteger(generation) || generation < 0 || generation > s.generations) throw new Error('Inspect a recorded integer generation.');
    $('bottleneck-results').hidden = false; $('bottleneck-plot').innerHTML = bottleneckFigure(result, true, generation);
    $('bottleneck-generation-label').textContent = `Inspect generation ${generation} of ${s.generations} · ${generation < s.bottleneckStart ? 'before bottleneck' : generation < recovery ? 'bottleneck' : 'recovered size'}`;
    $('bottleneck-table').innerHTML = `<table><caption>Exact counts at generation ${generation} · H is derived gene diversity</caption><thead><tr><th scope="col">Condition / trial</th><th scope="col">N</th><th scope="col">A</th><th scope="col">a</th><th scope="col">p(A)</th><th scope="col">H = 2pq</th><th scope="col">Locus state</th></tr></thead><tbody>${result.conditions.flatMap(condition => condition.trials.map(trial => { const n = condition.sizes[generation], count = trial.counts[generation]; return `<tr><th scope="row">${conditionName(condition.id)} ${trial.index}</th><td>${n}</td><td>${count}</td><td>${2 * n - count}</td><td>${percent(count / (2 * n))}</td><td>${Number(geneDiversity(count, n).toFixed(6))}</td><td>${count === 0 ? 'A lost' : count === 2 * n ? 'A fixed' : 'Both alleles present'}</td></tr>`; })).join('')}</tbody></table>`;
    const summaries = result.conditions.map(condition => { const fixed = condition.trials.filter(t => t.boundary?.kind === 'A fixed').length, lost = condition.trials.filter(t => t.boundary?.kind === 'A lost').length; return `${conditionName(condition.id)}: ${fixed} A-fixed, ${lost} A-lost, ${s.replicates - fixed - lost} retaining both at the final generation.`; });
    $('bottleneck-summary').textContent = `${summaries.join(' ')} All ${s.generations + 1} generations per trial are retained, with counts summing to each generation’s 2N. B and C use separate streams, not the same individuals. The no-drift frequency is not the mean of these few traces. Loss/fixation concerns this locus, not species extinction. H can rise in an individual run; recovery does not recreate an absent allele or reset frequency/diversity. Model N is not an empirical estimate. Work bound: ${result.maxDraws.toLocaleString()} gene-copy draws before absorbing-boundary shortcuts.`;
  }
}
