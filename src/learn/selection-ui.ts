import { parseProbability } from './inheritance.ts';
import { selectedFrequency } from './population.ts';
import { SELECTION_COMPARISON_DEMO, simulateSelectionComparison, validateSelectionComparison } from './selection.ts';
import type { SelectionResult, SelectionSetup } from './selection.ts';
import { selectionFigure } from './selection-render.ts';
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => $<HTMLInputElement>(id);
const percent = (p: number) => `${Number((100 * p).toFixed(4))}%`;
const fields = { size: 'size', aCopies: 'copies', generations: 'generations', replicates: 'replicates', seed: 'seed' } as const;

/** Temporary synthetic comparison only; no host, tree, artwork, history or persistence access. */
export class SelectionController {
  private result: SelectionResult | null = null;
  constructor() {
    for (const id of [...Object.values(fields), ...['1', '2'].flatMap(c => ['AA', 'Aa', 'aa'].map(g => `${c}-${g}`))]) input('selection-' + id).oninput = () => this.changed();
    $('selection-reset').onclick = () => this.reset();
    $('selection-check').onclick = () => this.run(() => {
      const s = this.setup(), p = s.aCopies / (2 * s.size), a = parseProbability(input('selection-prediction-1').value), b = parseProbability(input('selection-prediction-2').value);
      const match = Math.abs(a - selectedFrequency(p, s.fitness1)) <= 1e-6 && Math.abs(b - selectedFrequency(p, s.fitness2)) <= 1e-6;
      $('selection-feedback').textContent = (match ? 'Both predictions match the pre-sampling references. ' : 'Compare both predictions with the genotype-weighted calculation. ') + this.explanation(s);
    });
    $('selection-explain').onclick = () => this.run(() => { $('selection-feedback').textContent = this.explanation(this.setup()); });
    for (const id of ['selection-prediction-1', 'selection-prediction-2']) input(id).oninput = () => { $('selection-feedback').textContent = ''; };
    $('selection-run').onclick = () => this.run(() => { this.result = simulateSelectionComparison(this.setup()); input('selection-generation').max = String(this.result.setup.generations); input('selection-generation').value = '0'; this.paint(); $('selection-notice').textContent = 'Both conditions ran explicitly. All generations are retained; repeating restarts the same seeded comparison.'; });
    input('selection-generation').oninput = () => this.run(() => this.paint()); this.reset();
  }
  reset(): void {
    const s = SELECTION_COMPARISON_DEMO;
    for (const [key, id] of Object.entries(fields)) input('selection-' + id).value = String(s[key as keyof typeof fields]);
    for (const c of [1, 2] as const) for (const g of ['AA', 'Aa', 'aa'] as const) input(`selection-${c}-${g}`).value = String(s[c === 1 ? 'fitness1' : 'fitness2'][g]);
    this.changed();
  }
  worksheetCapture(): import('./worksheet.ts').WorksheetCapture { return { kind: 'selection', setup: this.setup() }; }
  private setup(): SelectionSetup {
    const value = (id: string) => input('selection-' + id).value.trim() ? Number(input('selection-' + id).value) : NaN;
    const weights = (c: number) => ({ AA: value(`${c}-AA`), Aa: value(`${c}-Aa`), aa: value(`${c}-aa`) });
    const s: SelectionSetup = { size: value('size'), aCopies: value('copies'), generations: value('generations'), replicates: value('replicates'), seed: value('seed'), fitness1: weights(1), fitness2: weights(2) }; validateSelectionComparison(s); return s;
  }
  private run(action: () => void): void { try { $('selection-notice').textContent = ''; action(); } catch (error) { $('selection-notice').textContent = error instanceof Error ? error.message : String(error); } }
  private changed(): void {
    this.result = null; $('selection-results').hidden = true;
    for (const id of ['selection-plot-1', 'selection-plot-2', 'selection-table', 'selection-summary', 'selection-feedback', 'selection-notice', 'selection-start']) $(id).textContent = '';
    for (const id of ['selection-prediction-1', 'selection-prediction-2']) input(id).value = '';
    this.run(() => { const s = this.setup(); $('selection-start').textContent = `Both conditions start with N = ${s.size}, ${s.aCopies} A + ${2 * s.size - s.aCopies} a copies; p(A) ≈ ${percent(s.aCopies / (2 * s.size))}. ${s.replicates} trials per condition use separate streams. All six genotype fitness weights are explicit.`; });
  }
  private explanation(s: SelectionSetup): string {
    const p = s.aCopies / (2 * s.size);
    return `Before finite sampling, next p(A) is ${percent(selectedFrequency(p, s.fitness1))} in S1 and ${percent(selectedFrequency(p, s.fitness2))} in S2. Use (p²wAA + p(1−p)wAa)/(p²wAA + 2p(1−p)wAa + (1−p)²waa). The weights describe relative contributions, not survival percentages. Phenotype dominance does not assign heterozygote fitness; wAa must be specified separately. A no-drift recursion is not the mean of nonlinear finite trajectories. Heterozygote advantage can balance a no-drift reference, but finite populations can still lose or fix an allele.`;
  }
  private paint(): void {
    const result = this.result; if (!result) return;
    const g = Number(input('selection-generation').value), s = result.setup, copies = 2 * s.size;
    if (!Number.isInteger(g) || g < 0 || g > s.generations) throw new Error('Inspect a recorded integer generation.');
    $('selection-results').hidden = false; result.conditions.forEach((condition, i) => { $('selection-plot-' + (i + 1)).innerHTML = selectionFigure(condition, true, g); });
    $('selection-generation-label').textContent = `Inspect generation ${g} of ${s.generations} in both conditions`;
    $('selection-table').innerHTML = `<table><caption>Exact counts at generation ${g} · N = ${s.size} in both conditions</caption><thead><tr><th scope="col">Condition / trial</th><th scope="col">A copies</th><th scope="col">a copies</th><th scope="col">p(A)</th><th scope="col">Locus state</th></tr></thead><tbody>${result.conditions.flatMap(c => c.population.trials.map(t => { const a = t.counts[g]; return `<tr><th scope="row">${c.id} / ${t.index}</th><td>${a}</td><td>${copies - a}</td><td>${percent(a / copies)}</td><td>${a === 0 ? 'A lost' : a === copies ? 'A fixed' : 'Both alleles present'}</td></tr>`; })).join('')}</tbody></table>`;
    $('selection-summary').textContent = result.conditions.map(c => { const fixed = c.population.trials.filter(t => t.boundary?.kind === 'A fixed').length, lost = c.population.trials.filter(t => t.boundary?.kind === 'A lost').length; return `${c.id}: no-drift p(A) ≈ ${percent(c.population.reference[g])} at this generation; ${fixed} A-fixed and ${lost} A-lost across the full runs.`; }).join(' ') + ` All ${s.generations + 1} generations are retained. Conditions use separate streams, not the same individuals. A few traces cannot establish selection, reliably estimate fixation probability or guarantee a ranking between conditions. Fixation by the recorded final generation differs from eventual fixation. Model N is not an empirical estimate; missing alleles stay absent and locus fixation/loss is not species extinction.`;
  }
}
