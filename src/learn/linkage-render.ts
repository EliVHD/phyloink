import { validateLinkage } from './linkage.ts';
import type { LinkageSetup } from './linkage.ts';

/** Native vector schematic, independent of artwork and learner selections. Spacing is not a map. */
export function linkageDiagram(setup: LinkageSetup): string {
  validateLinkage(setup);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="175mm" height="56mm" viewBox="0 0 700 224" role="img" aria-label="Parent 1 chromosomes ${setup.parent1}; Parent 2 chromosomes ${setup.parent2}; schematic marker spacing" font-family="sans-serif" font-size="17" fill="#20362b"><title>Explicit parental phase; schematic marker spacing only</title><text x="15" y="22">Two marker loci · schematic spacing only</text>${[setup.parent1, setup.parent2].map((parent, i) => `<g transform="translate(${i * 350},0)"><text x="20" y="61">Parent ${i + 1} · ${parent}</text>${parent.split('/').map((haplotype, j) => `<g transform="translate(0,${j * 55})"><text x="20" y="107" font-size="14">Copy ${j + 1}</text><path d="M85 103H295" fill="none" stroke="#41684e" stroke-width="4"/><circle cx="125" cy="103" r="16" fill="white" stroke="#41684e"/><circle cx="255" cy="103" r="16" fill="white" stroke="#41684e"/><text x="125" y="109" text-anchor="middle">${haplotype[0]}</text><text x="255" y="109" text-anchor="middle">${haplotype[1]}</text></g>`).join('')}</g>`).join('')}<text x="15" y="210" font-size="14">Each gamete carries one allele at each locus. No physical/map distance is shown.</text></svg>`;
}
