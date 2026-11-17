# Bounded selection comparisons · A06.3

Choose **Learn → Selection comparisons**. Compare two fixed, explicit AA/Aa/aa relative-fitness triplets at one synthetic diploid autosomal A/a locus. Shared settings are constant N (2–500), initial integer A copies (0–2N), generations (1–100), trials per condition (1–4) and unsigned 32-bit seed. Each of the six positive fitness weights is 0.05–2. At most eight complete paths, 808 condition/trial/generation records and 800,000 potential gene-copy draws are retained; there is no thinning or partial result.

## One adaptable example

N = 100, initial A copies = 100, 40 generations, four trials per condition, seed 1. S1 uses 1.2/1.1/1 (directional A advantage); S2 uses 1.2/1.4/1 (heterozygote advantage). Only Aa fitness changes. Both start at p(A) = 1/2. Predict the next pre-sampling frequency in each condition, run both, inspect exact counts, then compare finite paths with the no-drift references. Change one input at a time or change seed. Equal weights provide a neutral comparison. This is one demonstration to adapt, not a course or a commitment to further lessons.

## Scientific contract

The unchanged `wright-fisher-selection-v1` model weights expected random-mating genotype proportions. For q = 1−p:

`p_selected = (p²wAA + pqwAa) / (p²wAA + 2pqwAa + q²waa)`

Then A copies are sampled binomially with 2N trials and probability p_selected. Fitnesses are relative contributions, not survival percentages. Phenotype dominance does not assign heterozygote fitness. No individual genotypes, survival events or pedigrees are simulated. The deterministic recursion is an infinite-population/no-drift reference, not the mean of finite trajectories under nonlinear selection.

For the example, the first references are 23/44 in S1 and 13/25 in S2. S2 has a stable interior no-drift equilibrium at p(A) = 2/3; the finite-horizon reference need not reach it. Finite populations can still fix or lose an allele. Missing alleles remain absent. Locus loss/fixation is not species extinction. A few paths cannot establish selection, estimate fixation probabilities or guarantee a condition ranking.

The model assumes a closed, constant-size population, random mating, non-overlapping generations and one autosomal locus. No mutation, migration, linked loci, size changes, changing environment, sex structure or zero-fitness extinction. N and weights are chosen inputs, not empirical estimates. Nothing is inferred from a tree.

## Reproducibility and boundaries

`selection-comparison-v1` composes two unchanged population simulations. S1 uses the master seed; S2 uses `(master + 0xc2b2ae35) modulo 2^32`. Each condition retains the existing Mulberry32 v1 trial offset `index * 0x9e3779b9`. Matching trial numbers are separate streams, not paired individuals or guaranteed counterfactuals. Repeating restarts; changing horizon or trial count preserves prior prefixes. Setup capture explicitly copies supported numeric fields and drops extra learner fields.

Learn owns all temporary predictions, feedback, results and the shared generation cursor. Switching modules preserves practice; leaving Learn resets it. No project/history/artwork/scenario-format changes. Two charts share fixed axes; the exact table records every path at the inspected generation. Colours, dashes and labels identify paths. Narrow screens stack the panels and allow local chart scrolling.

## Worksheets

**Create worksheet** captures validated educator setup/seeds and regenerates data. Separate student and teacher packages contain two static SVG figures and selected-generation tables (0, midpoint, final); `selection-comparison-counts.csv` contains every condition/trial/generation, exact N/A/a counts and derived p(A). Student plots exclude no-drift reference curves. Teacher plots include them with explicit limits. Neither includes cursor overlays, learner answers, progress, feedback or editor DOM/artwork. Disabling data removes figures/CSV while preserving setup context. Long material can span pages; print at the selected A4/Letter size and 100%.

The [worksheet contract](WORKSHEETS.md) covers authoring, role separation and manifests. The [education example](https://github.com/EliVHD/phyloink-education/tree/codex/selection-walkthrough/labs/selection) contains one adaptable handout, count CSV and teacher notes; authoritative usage/teacher guides stay in the application repository.

## Verification and rights

`tests/selection.test.ts` covers reuse, analytic references/equilibrium, counts and absorbing states, bounds/work ceiling, independent seeds/replay/prefixes, fitness scaling, explicit setup capture, static figures, complete CSV, role/manifests and omission/rejection. Browser verification exercises controls, exact inspection, desktop/narrow layout, print/ZIP roles, all eight paths/808 records, module isolation and unchanged editor state. Font/layout measurements and printed pages require browser review.

Code, text and figures are original 0BSD contributions. No empirical dataset, runtime dependency or external text/artwork/code is bundled. Optional background reading: [Graham Coop, Notes on Population Genetics (2013)](https://gcbias.org/wp-content/uploads/2013/03/popgen_notes3.pdf) and [MIT HST.508 notes (2005)](https://ocw.mit.edu/courses/hst-508-quantitative-genomics-fall-2005/aad420032640a927d69dc1a8b2a08750_hst508lecture1.pdf). Reading links are never fetched automatically.
