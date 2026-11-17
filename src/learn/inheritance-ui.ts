import { MAX_SHOWN_OFFSPRING, createMendelianCross, parseProbability, probabilityText, sampleOffspring } from './inheritance.ts';
import type { CrossSetup, Distribution, MendelianCross, OffspringSample, Probability } from './inheritance.ts';
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => $<HTMLInputElement>(id);
const select = (id: string) => $<HTMLSelectElement>(id);
const percent = (value: Probability) => `${100 * value.ways / value.denominator}%`;

/** Owns only local synthetic practice. No host, tree, project, download or network capability. */
export class InheritanceController {
  private cross!: MendelianCross;
  private sample?: OffspringSample;
  private revealed = false;
  constructor() {
    for (const [id, choices] of [['inheritance-p1-a', ['AA', 'Aa', 'aa']], ['inheritance-p2-a', ['AA', 'Aa', 'aa']], ['inheritance-p1-b', ['BB', 'Bb', 'bb']], ['inheritance-p2-b', ['BB', 'Bb', 'bb']]] as const) select(id).innerHTML = choices.map(choice => `<option>${choice}</option>`).join('');
    for (const id of ['inheritance-loci', 'inheritance-p1-a', 'inheritance-p2-a', 'inheritance-p1-b', 'inheritance-p2-b']) $(id).onchange = () => this.run(() => this.changeCross());
    for (const id of ['inheritance-size', 'inheritance-seed']) $(id).oninput = () => { this.sample = undefined; $('inheritance-notice').textContent = ''; this.paint(); };
    $('inheritance-monohybrid').onclick = () => this.reset(1);
    $('inheritance-dihybrid').onclick = () => this.reset(2);
    $('inheritance-reset').onclick = () => this.reset();
    $('inheritance-check').onclick = () => this.run(() => {
      const predicted = parseProbability(input('inheritance-prediction').value), expected = this.cross.phenotypes.at(-1)!;
      this.revealed = true; this.paint();
      $('inheritance-feedback').textContent = (Math.abs(predicted - expected.ways / expected.denominator) < 1e-10 ? 'Your prediction matches this model. ' : 'Compare your prediction with the gamete combinations. ') + this.explanation();
    });
    $('inheritance-explain').onclick = () => { this.revealed = true; this.paint(); $('inheritance-feedback').textContent = this.explanation(); };
    input('inheritance-prediction').oninput = () => { $('inheritance-feedback').textContent = ''; };
    $('inheritance-sample').onclick = () => this.run(() => {
      const number = (id: string) => input(id).value.trim() ? Number(input(id).value) : NaN;
      const sample = sampleOffspring(this.cross.setup, number('inheritance-size'), number('inheritance-seed'));
      this.sample = sample; this.revealed = true; this.paint();
      $('inheritance-notice').textContent = `Sampled ${sample.count} offspring with seed ${sample.seed}. Draws are independent within the model; repeating the same settings reproduces this sample.`;
    });
    $('inheritance-square').onclick = event => {
      const id = (event.target as Element).closest<HTMLElement>('[data-inheritance-cell]')?.dataset.inheritanceCell;
      if (id === undefined) return;
      const cell = this.cross.cells[Number(id)]; if (!cell) return;
      $('inheritance-cell-explanation').textContent = `Parent 1 contributes ${cell.parent1}; Parent 2 contributes ${cell.parent2}. Offspring genotype: ${cell.genotype}. Complete-dominance phenotype: ${cell.phenotype}. Probability of this parental gamete combination: ${probabilityText(cell)} (${percent(cell)}). Other cells can produce the same genotype; the genotype table adds their probabilities. Each locus receives one allele from each parent.`;
    };
    this.reset();
  }
  reset(loci: 1 | 2 = 1): void {
    select('inheritance-loci').value = String(loci);
    for (const id of ['inheritance-p1-a', 'inheritance-p2-a']) select(id).value = 'Aa';
    for (const id of ['inheritance-p1-b', 'inheritance-p2-b']) select(id).value = 'Bb';
    input('inheritance-size').value = '32'; input('inheritance-seed').value = '1'; this.changeCross();
  }
  private run(action: () => void): void {
    try { $('inheritance-notice').textContent = ''; action(); }
    catch (error) { $('inheritance-notice').textContent = error instanceof Error ? error.message : String(error); }
  }
  private changeCross(): void {
    const loci = select('inheritance-loci').value === '2' ? 2 : 1;
    const setup: CrossSetup = { loci, parent1: select('inheritance-p1-a').value + (loci === 2 ? select('inheritance-p1-b').value : ''), parent2: select('inheritance-p2-a').value + (loci === 2 ? select('inheritance-p2-b').value : '') };
    this.cross = createMendelianCross(setup); this.sample = undefined; this.revealed = false;
    for (const id of ['inheritance-p1-b-label', 'inheritance-p2-b-label']) $(id).hidden = loci === 1;
    for (const id of ['inheritance-feedback', 'inheritance-notice', 'inheritance-cell-explanation']) $(id).textContent = '';
    input('inheritance-prediction').value = ''; this.paint();
  }
  private explanation(): string {
    const expected = this.cross.phenotypes.at(-1)!;
    return `The chance of ${this.cross.recessive} is ${probabilityText(expected)} (${percent(expected)}) per offspring. One allele at each locus comes from each parent, with equal segregation of the parent's two copies. ${this.cross.setup.loci === 2 ? 'The two loci assort independently in this model; multiply the independent locus probabilities. ' : ''}Expected probabilities describe repeated trials, not a guaranteed ratio in a finite family. Dominant does not mean more common or more likely to be transmitted.`;
  }
  private paint(): void {
    const cross = this.cross;
    $('inheritance-cross-title').textContent = `${cross.setup.parent1} × ${cross.setup.parent2}`;
    $('inheritance-prediction-label').textContent = `Predicted probability of ${cross.recessive} offspring`;
    $('inheritance-results').hidden = !this.revealed;
    const gametes = (choices: MendelianCross['gametes1']) => choices.map(choice => `${choice.alleles}: ${probabilityText(choice)} (${percent(choice)})`).join(' · ');
    $('inheritance-gametes').textContent = `Parent 1 gametes — ${gametes(cross.gametes1)}. Parent 2 gametes — ${gametes(cross.gametes2)}.`;
    $('inheritance-square').innerHTML = `<table><caption>Possible offspring from independent parental gametes</caption><thead><tr><th scope="col">Parent 1 ↓ / Parent 2 →</th>${cross.gametes2.map(choice => `<th scope="col">${choice.alleles}<small>${probabilityText(choice)}</small></th>`).join('')}</tr></thead><tbody>${cross.gametes1.map((choice, i) => `<tr><th scope="row">${choice.alleles}<small>${probabilityText(choice)}</small></th>${cross.gametes2.map((_, j) => { const cell = cross.cells[i * cross.gametes2.length + j]; return `<td><button type="button" class="inheritance-cell" data-inheritance-cell="${i * cross.gametes2.length + j}" aria-label="Parent 1 ${cell.parent1}, Parent 2 ${cell.parent2}: ${cell.genotype}, probability ${probabilityText(cell)}"><strong>${cell.genotype}</strong><small>${probabilityText(cell)} · ${percent(cell)}</small></button></td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
    const table = (rows: Distribution[], kind: 'genotypes' | 'phenotypes') => `<table><caption>${kind === 'genotypes' ? 'Genotypes' : 'Complete-dominance phenotypes'} · expected and sampled</caption><thead><tr><th scope="col">${kind === 'genotypes' ? 'Genotype' : 'Phenotype'}</th><th scope="col">Probability</th><th scope="col">Expected count${this.sample ? ` in ${this.sample.count}` : ''}</th><th scope="col">Sampled count</th></tr></thead><tbody>${rows.map(row => `<tr><th scope="row">${row.label}</th><td>${probabilityText(row)}<small>${percent(row)}</small></td><td>${this.sample ? Number((this.sample.count * row.ways / row.denominator).toFixed(4)) : '—'}</td><td>${this.sample ? this.sample[kind].find(item => item.label === row.label)!.count : '—'}</td></tr>`).join('')}</tbody></table>`;
    $('inheritance-genotypes').innerHTML = table(cross.genotypes, 'genotypes'); $('inheritance-phenotypes').innerHTML = table(cross.phenotypes, 'phenotypes');
    $('inheritance-sample-summary').textContent = this.sample ? `${this.sample.count} offspring · seed ${this.sample.seed}. Counts include all offspring; showing the first ${Math.min(this.sample.count, MAX_SHOWN_OFFSPRING)} individual genotypes below. Expected counts may be fractional. Samples can differ from the expected ratio; changing the seed produces a different trial, which may still give the same counts.` : 'No sampled offspring yet. Exact probabilities do not depend on sample size or seed.';
    $('inheritance-offspring').innerHTML = this.sample ? this.sample.offspring.slice(0, MAX_SHOWN_OFFSPRING).map((child, i) => `<li><span>${i + 1}</span><strong>${child.genotype}</strong><small>${child.parent1} + ${child.parent2}</small></li>`).join('') : '';
  }
}
