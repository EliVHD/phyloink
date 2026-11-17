import { parseProbability } from './inheritance.ts';
import { DRIFT_DEMO, SELECTION_DEMO, selectedFrequency, simulatePopulation, validatePopulation } from './population.ts';
import type { PopulationResult, PopulationSetup } from './population.ts';
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => $<HTMLInputElement>(id);
const percent = (p: number) => `${Number((100 * p).toFixed(4))}%`;
const styles = [
  { color: '#31694d', dash: '' }, { color: '#225e9c', dash: '5 3' }, { color: '#92470c', dash: '9 3 2 3' }, { color: '#70449b', dash: '2 3' },
  { color: '#965066', dash: '12 4' }, { color: '#476b74', dash: '6 2 1 2' }, { color: '#655e20', dash: '1 4' }, { color: '#555b68', dash: '10 2 2 2 2 2' },
];

/** Owns only synthetic temporary trials. No host, document, persistence, download or network API. */
export class PopulationController {
  private result: PopulationResult | null = null;
  constructor() {
    for (const id of ['population-size', 'population-copies', 'population-generations', 'population-replicates', 'population-seed', 'population-fitness-AA', 'population-fitness-Aa', 'population-fitness-aa']) $(id).oninput = () => this.changed();
    $('population-drift').onclick = () => this.reset();
    $('population-selection').onclick = () => this.reset(SELECTION_DEMO);
    $('population-reset').onclick = () => this.reset();
    $('population-check').onclick = () => this.run(() => {
      const setup = this.setup(), answer = parseProbability(input('population-prediction').value), expected = selectedFrequency(setup.aCopies / (2 * setup.size), setup.fitness);
      $('population-feedback').textContent = (Math.abs(answer - expected) <= 1e-6 ? 'Your prediction matches the reference to the displayed precision. ' : 'Compare your prediction with the fitness-weighted reference. ') + this.explanation(setup);
    });
    $('population-explain').onclick = () => this.run(() => { $('population-feedback').textContent = this.explanation(this.setup()); });
    input('population-prediction').oninput = () => { $('population-feedback').textContent = ''; };
    $('population-run').onclick = () => this.run(() => {
      const result = simulatePopulation(this.setup()); this.result = result;
      input('population-generation').max = String(result.setup.generations); input('population-generation').value = '0'; this.paint();
      $('population-notice').textContent = `Ran ${result.setup.replicates} trials for ${result.setup.generations} generations. The same settings reproduce every count. Inspect a generation below; no generations are skipped.`;
    });
    input('population-generation').oninput = () => this.run(() => this.paint());
    this.reset();
  }
  reset(setup: PopulationSetup = DRIFT_DEMO): void {
    for (const [id, value] of Object.entries({ 'population-size': setup.size, 'population-copies': setup.aCopies, 'population-generations': setup.generations, 'population-replicates': setup.replicates, 'population-seed': setup.seed, 'population-fitness-AA': setup.fitness.AA, 'population-fitness-Aa': setup.fitness.Aa, 'population-fitness-aa': setup.fitness.aa })) input(id).value = String(value);
    this.changed();
  }
  worksheetCapture(): import('./worksheet.ts').WorksheetCapture { return { kind: 'population', setup: this.setup() }; }
  private setup(): PopulationSetup {
    const value = (id: string) => input(id).value.trim() ? Number(input(id).value) : NaN;
    const setup: PopulationSetup = { size: value('population-size'), aCopies: value('population-copies'), generations: value('population-generations'), replicates: value('population-replicates'), seed: value('population-seed'), fitness: { AA: value('population-fitness-AA'), Aa: value('population-fitness-Aa'), aa: value('population-fitness-aa') } };
    validatePopulation(setup); return setup;
  }
  private run(action: () => void): void {
    try { $('population-notice').textContent = ''; action(); }
    catch (error) { $('population-notice').textContent = error instanceof Error ? error.message : String(error); }
  }
  private changed(): void {
    this.result = null; $('population-results').hidden = true;
    for (const id of ['population-plot', 'population-table', 'population-summary', 'population-feedback', 'population-notice', 'population-legend', 'population-start']) $(id).textContent = '';
    input('population-prediction').value = '';
    const size = Number(input('population-size').value); input('population-copies').max = String(2 * size);
    this.run(() => { const setup = this.setup(); $('population-start').textContent = `Generation 0: ${setup.aCopies} A + ${2 * setup.size - setup.aCopies} a = ${2 * setup.size} gene copies in ${setup.size} diploid individuals. Initial p(A) ≈ ${percent(setup.aCopies / (2 * setup.size))}. No individual genotypes are specified.`; });
  }
  private explanation(setup: PopulationSetup): string {
    const p = setup.aCopies / (2 * setup.size), next = selectedFrequency(p, setup.fitness);
    return `Before finite sampling, the next A frequency is ${percent(next)} from ${percent(p)}. Random-mating genotype proportions p², 2p(1−p), (1−p)² are weighted by the three relative fitnesses. The finite population then samples ${2 * setup.size} gene copies using that probability. A trial can depart from the reference; an increase alone does not establish selection. The reference omits drift and is not the mean of the plotted trials under selection.`;
  }
  private paint(): void {
    const result = this.result; if (!result) return;
    const { setup } = result, copies = 2 * setup.size, generation = Number(input('population-generation').value);
    if (!Number.isInteger(generation) || generation < 0 || generation > setup.generations) throw new Error(`Inspect an integer generation from 0 to ${setup.generations}.`);
    $('population-results').hidden = false;
    const x = (t: number) => 62 + t / setup.generations * 590, y = (p: number) => 275 - p * 240;
    const path = (values: number[]) => values.map((p, t) => `${t ? 'L' : 'M'}${x(t).toFixed(3)},${y(p).toFixed(3)}`).join('');
    $('population-plot').innerHTML = `<title>A allele frequency through model generations</title><desc>Dashed black is an infinite-population reference with no drift. Numbered replicate traces use distinct colours and dash patterns; exact counts are in the generation table.</desc>${[0, .25, .5, .75, 1].map(p => `<path d="M62,${y(p)}H652" stroke="#d7ded5"/><text x="52" y="${y(p) + 4}" text-anchor="end">${100 * p}%</text>`).join('')}${[0, Math.floor(setup.generations / 2), setup.generations].filter((t, i, all) => all.indexOf(t) === i).map(t => `<text x="${x(t)}" y="296" text-anchor="middle">${t}</text>`).join('')}<text x="62" y="18">A allele frequency</text><text x="357" y="320" text-anchor="middle">Model generation</text><path data-population-reference="true" d="${path(result.reference)}" fill="none" stroke="#172e25" stroke-width="2.4" stroke-dasharray="8 5"/>${result.trials.map((trial, i) => `<path data-population-trial="${trial.index}" d="${path(trial.counts.map(count => count / copies))}" fill="none" stroke="${styles[i].color}" stroke-width="1.8" stroke-dasharray="${styles[i].dash}"/>`).join('')}<path d="M${x(generation)},35V275" stroke="#7b8581" stroke-dasharray="2 3"/>`;
    $('population-legend').innerHTML = `<span><svg viewBox="0 0 38 12" aria-hidden="true"><path d="M0 6H38" stroke="#172e25" stroke-width="2.4" stroke-dasharray="8 5"/></svg>Reference · no drift</span>${result.trials.map((trial, i) => `<span><svg viewBox="0 0 38 12" aria-hidden="true"><path d="M0 6H38" stroke="${styles[i].color}" stroke-width="1.8" stroke-dasharray="${styles[i].dash}"/></svg>Trial ${trial.index}</span>`).join('')}`;
    $('population-generation-label').textContent = `Inspect generation ${generation} of ${setup.generations}`;
    $('population-table').innerHTML = `<table><caption>Exact allele-copy counts at generation ${generation}</caption><thead><tr><th scope="col">Trial</th><th scope="col">A copies</th><th scope="col">a copies</th><th scope="col">p(A)</th><th scope="col">State at this generation</th></tr></thead><tbody>${result.trials.map(trial => { const count = trial.counts[generation]; return `<tr><th scope="row">Trial ${trial.index}</th><td>${count}</td><td>${copies - count}</td><td>${percent(count / copies)}</td><td>${count === 0 ? 'A lost' : count === copies ? 'A fixed' : 'Both alleles present'}</td></tr>`; }).join('')}</tbody></table>`;
    const fixed = result.trials.filter(trial => trial.boundary?.kind === 'A fixed').length, lost = result.trials.filter(trial => trial.boundary?.kind === 'A lost').length;
    $('population-summary').textContent = `At generation ${generation}, no-drift reference p(A) ≈ ${percent(result.reference[generation])}. Across the complete ${setup.generations}-generation runs: A fixed in ${fixed} trial(s), lost in ${lost}; ${setup.replicates - fixed - lost} retain both alleles at the final generation. Fixation/loss concern this locus only, not extinction. ${setup.size} individuals and ${copies} gene copies are retained every generation. All ${setup.generations + 1} recorded generations per trial are available. Displayed percentages are rounded to four decimal places; counts are exact. A missing allele cannot reappear without mutation or migration, which are excluded.`;
  }
}
