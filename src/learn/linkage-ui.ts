import { MAX_SHOWN_OFFSPRING, parseProbability, probabilityText } from './inheritance.ts';
import type { Distribution, Probability } from './inheritance.ts';
import { HAPLOTYPES, LINKAGE_TEST_CROSS, createLinkageCross, sampleLinkedOffspring } from './linkage.ts';
import type { LinkedGamete, LinkageCross, LinkageSample, LinkageSetup } from './linkage.ts';
import { linkageDiagram } from './linkage-render.ts';
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => $<HTMLInputElement>(id);
const percent = (value: Probability) => `${Number((100 * value.ways / value.denominator).toFixed(4))}%`;
const origin = (value: LinkedGamete['origin']) => value === 'uninformative' ? 'Not distinguishable at these markers' : value === 'parental' ? 'Parental' : 'Recombinant';

/** Temporary synthetic cross only. No host, source, artwork, history or persistence access. */
export class LinkageController {
  private cross: LinkageCross | null = null;
  private sample?: LinkageSample;
  private revealed = false;
  constructor() {
    for (const id of ['linkage-p1-first', 'linkage-p1-second', 'linkage-p2-first', 'linkage-p2-second']) {
      $(id).innerHTML = HAPLOTYPES.map(value => `<option>${value}</option>`).join(''); $(id).onchange = () => this.change();
    }
    input('linkage-rate').oninput = () => this.change();
    for (const id of ['linkage-size', 'linkage-seed']) input(id).oninput = () => { this.clear(); this.paint(); };
    $('linkage-reset').onclick = () => this.reset();
    $('linkage-check').onclick = () => this.run(() => {
      const cross = this.requireCross(), prediction = parseProbability(input('linkage-prediction').value), expected = cross.gametes1.find(row => row.alleles === 'ab')!;
      this.revealed = true; this.paint(); $('linkage-feedback').textContent = (Math.abs(prediction - expected.ways / expected.denominator) < 1e-10 ? 'Your prediction matches this model. ' : 'Compare your prediction with the phased chromosomes and gamete probabilities. ') + this.explanation();
    });
    $('linkage-explain').onclick = () => this.run(() => { this.requireCross(); this.revealed = true; this.paint(); $('linkage-feedback').textContent = this.explanation(); });
    input('linkage-prediction').oninput = () => { $('linkage-feedback').textContent = ''; };
    $('linkage-sample').onclick = () => this.run(() => {
      this.sample = sampleLinkedOffspring(this.requireCross().setup, this.number('linkage-size'), this.number('linkage-seed')); this.revealed = true; this.paint();
    });
    $('linkage-square').onclick = event => this.run(() => {
      const index = (event.target as Element).closest<HTMLElement>('[data-linkage-cell]')?.dataset.linkageCell;
      if (index === undefined) return;
      const cell = this.requireCross().cells[Number(index)]; if (!cell) return;
      $('linkage-cell-explanation').textContent = `Parent 1 contributes chromosome ${cell.parent1}; Parent 2 contributes ${cell.parent2}. Offspring phase: ${cell.parent1}/${cell.parent2}; unphased genotype: ${cell.genotype}; complete-dominance phenotype: ${cell.phenotype}. This gamete pair has probability ${probabilityText(cell)} (${percent(cell)}). Genotype/phenotype tables aggregate all matching pairs, including zero-probability outcomes.`;
    });
    this.reset();
  }
  private number(id: string): number { return input(id).value.trim() ? Number(input(id).value) : NaN; }
  private setup(): LinkageSetup {
    const phase = (parent: string) => `${input(`linkage-${parent}-first`).value}/${input(`linkage-${parent}-second`).value}`;
    return { parent1: phase('p1'), parent2: phase('p2'), recombinationPercent: this.number('linkage-rate') };
  }
  private requireCross(): LinkageCross { if (!this.cross) throw new Error('Correct the phased parents and recombination setting first.'); return this.cross; }
  worksheetCapture(): import('./worksheet.ts').WorksheetCapture {
    const cross = createLinkageCross(this.setup());
    return { kind: 'linkage', setup: cross.setup, count: this.number('linkage-size'), seed: this.number('linkage-seed') };
  }
  reset(): void {
    for (const [parent, value] of [['p1', LINKAGE_TEST_CROSS.parent1], ['p2', LINKAGE_TEST_CROSS.parent2]]) {
      const [a, b] = value.split('/'); input(`linkage-${parent}-first`).value = a; input(`linkage-${parent}-second`).value = b;
    }
    input('linkage-rate').value = String(LINKAGE_TEST_CROSS.recombinationPercent); input('linkage-size').value = '100'; input('linkage-seed').value = '1'; this.change();
  }
  private clear(): void {
    this.sample = undefined; this.revealed = false; input('linkage-prediction').value = '';
    for (const id of ['linkage-notice', 'linkage-feedback', 'linkage-cell-explanation']) $(id).textContent = '';
  }
  private change(): void {
    this.clear(); this.cross = null;
    this.run(() => { this.cross = createLinkageCross(this.setup()); }); this.paint();
  }
  private run(action: () => void): void {
    try { $('linkage-notice').textContent = ''; action(); }
    catch (error) { $('linkage-notice').textContent = error instanceof Error ? error.message : String(error); }
  }
  private explanation(): string {
    const cross = this.requireCross(), expected = cross.gametes1.find(row => row.alleles === 'ab')!;
    return `Parent 1 produces ab with probability ${probabilityText(expected)} (${percent(expected)}). For a double heterozygote, each parental type has (1−r)/2 and each recombinant type r/2; r = ${cross.setup.recombinationPercent}%. If either locus is homozygous, parental/recombinant routes cannot be distinguished at these two markers and duplicate outcomes are combined. At r = 50%, probabilities match independent assortment, which does not prove loci are on different chromosomes. Model r is capped at 50%; a small sample's observed recombinant fraction can exceed 50%. No distance or crossover count is inferred.`;
  }
  private paint(): void {
    const cross = this.cross;
    $('linkage-results').hidden = !cross || !this.revealed;
    $('linkage-diagram').innerHTML = cross ? linkageDiagram(cross.setup) : '';
    $('linkage-cross-title').textContent = cross ? `${cross.setup.parent1} × ${cross.setup.parent2} · r = ${cross.setup.recombinationPercent}%` : 'Correct the cross settings';
    if (!cross) return;
    const gametes = (rows: LinkedGamete[], parent: 1 | 2) => `<table><caption>Parent ${parent} gametes · ${parent === 1 ? cross.setup.parent1 : cross.setup.parent2}</caption><thead><tr><th scope="col">Gamete</th><th scope="col">Marker class</th><th scope="col">Probability</th><th scope="col">Sampled count</th></tr></thead><tbody>${rows.map(row => `<tr><th scope="row">${row.alleles}</th><td>${origin(row.origin)}</td><td>${probabilityText(row)}<small>${percent(row)}</small></td><td>${this.sample ? this.sample[parent === 1 ? 'gametes1' : 'gametes2'].find(item => item.label === row.alleles)!.count : '—'}</td></tr>`).join('')}</tbody></table>`;
    $('linkage-gametes').innerHTML = gametes(cross.gametes1, 1) + gametes(cross.gametes2, 2);
    $('linkage-square').innerHTML = `<table><caption>Parental gamete pairs · probabilities are weighted, not equal cells</caption><thead><tr><th scope="col">Parent 1 ↓ / Parent 2 →</th>${cross.gametes2.map(row => `<th scope="col">${row.alleles}<small>${probabilityText(row)}</small></th>`).join('')}</tr></thead><tbody>${cross.gametes1.map((row, i) => `<tr><th scope="row">${row.alleles}<small>${probabilityText(row)}</small></th>${cross.gametes2.map((_, j) => { const cell = cross.cells[i * 4 + j]; return `<td><button class="inheritance-cell" type="button" data-linkage-cell="${i * 4 + j}" aria-label="Parent 1 ${cell.parent1}, Parent 2 ${cell.parent2}: ${cell.genotype}, probability ${probabilityText(cell)}"><strong>${cell.genotype}</strong><small>${probabilityText(cell)} · ${percent(cell)}</small></button></td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
    const table = (rows: Distribution[], key: 'genotypes' | 'phenotypes') => `<table><caption>${key === 'genotypes' ? 'Unphased genotypes' : 'Complete-dominance phenotypes'} · exact probabilities and counts</caption><thead><tr><th scope="col">Outcome</th><th scope="col">Probability</th><th scope="col">Expected count</th><th scope="col">Sampled count</th></tr></thead><tbody>${rows.map(row => `<tr><th scope="row">${row.label}</th><td>${probabilityText(row)}<small>${percent(row)}</small></td><td>${this.sample ? Number((this.sample.count * row.ways / row.denominator).toFixed(4)) : '—'}</td><td>${this.sample ? this.sample[key].find(item => item.label === row.label)!.count : '—'}</td></tr>`).join('')}</tbody></table>`;
    $('linkage-genotypes').innerHTML = table(cross.genotypes, 'genotypes'); $('linkage-phenotypes').innerHTML = table(cross.phenotypes, 'phenotypes');
    $('linkage-sample-summary').textContent = this.sample ? `${this.sample.count} offspring · seed ${this.sample.seed}. All offspring are counted; the first ${Math.min(this.sample.count, MAX_SHOWN_OFFSPRING)} phased genotypes are shown. Expected counts may be fractional; finite samples need not match them. Each click restarts the trial, not another generation.` : 'No sample yet. Exact probabilities are independent of sample size and seed.';
    $('linkage-offspring').innerHTML = this.sample ? this.sample.offspring.slice(0, MAX_SHOWN_OFFSPRING).map((child, i) => `<li><span>${i + 1}</span><strong>${child.genotype}</strong><small>${child.phase}</small></li>`).join('') : '';
  }
}
