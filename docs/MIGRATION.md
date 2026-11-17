# PhyloInk naming migration

**PhyloInk — Phylogenetic Tree Editor & Illustrator** is the new name of Clade Studio. The working version is **0.1.2-dev.0**; this is a development build, not a replacement for an existing release.

## Compatibility

Existing `.treeproject.json` files remain supported. The `phylogenetic-tree-studio` project discriminator, project versions V1–V4, `clade-build-*` identity formats, release/component manifest formats and component IDs are compatibility identifiers, not current product names. They remain unchanged. Source IDs, checksums, scientific references, stored artwork and historical provenance are preserved.

New export ZIPs and locally assembled browser/source archives use the `phyloink-` prefix. Existing Clade Studio release tags, release notes and published archive names remain historical records. Do not move an old tag or replace its assets with a renamed build.

The existing repository is to be renamed to `EliVHD/phyloink` while retaining its history and configured visibility. Update local remotes to the new URL after the repository rename. The education companion is `EliVHD/phyloink-education`. The local checkout folder can retain its existing name; it is not part of the file format or build identity.

Existing screenshots document the original Clade Studio release. Their names and credits do not imply that the old header is the current interface.

## Bounded education plan

Both the usage guide and Teacher's Guide belong in this repository. Complete teaching examples and the annotated Newick directory belong in the education repository. Resources demonstrate possibilities and include adaptation notes; they are not a course or a promise of recurring lessons, support or updates.

| Package | Scope |
| --- | --- |
| P00 | Naming, compatibility and packaging migration. |
| P01 | Education repository foundation and contribution/content conventions. |
| P02 | Review and incorporate the attached Teacher's Guide. |
| P03 | Offline/print guide presentation, navigation and distribution integration. |
| P04 | A common-ancestry and clades example. |
| P05 | Equivalent drawings from the same source and selected taxa. |
| P06 | A reproducible, evidence-based illustration example. |
| P07 | A small annotated directory of additional Newick sources. |
| P08 | Cross-repository verification of projects, exports, sources and print materials. |

A01 adds a temporary Learn workspace for tree interpretation: common ancestors, displayed clade membership, and equivalent rectangular/circular drawings with topology-preserving rotations. One six-mammal demonstration and bounded samples from educators’ current rooted sources demonstrate the approach. Answers and rotations never enter project/history/export state. This is not an ongoing lesson collection or a full course.

| Application package | Scope and status |
| --- | --- |
| A01 | Temporary tree-interpretation workspace; implemented in its own draft PR. |
| A02 | Local, versioned activity scenarios: reusable source/sample/question setups, local open/save, educator adaptation notes and two finite demonstrations in the education repository. Implemented in a separate draft change; no learner tracking or course system. |
| A03 | Bounded Inheritance lab, implemented in a separate draft change. One/two-locus synthetic autosomal crosses with explicit complete-dominance and independent-assortment assumptions, prediction/explanation, exact Punnett/genotype/phenotype probabilities and reproducible bounded offspring samples. Two adaptable starting crosses; no inference from trees, saved lab format or learner tracking. See [model and verification](INHERITANCE-LAB.md). |
| A04 | Bounded Population evolution lab, implemented in a separate draft change. Two synthetic starting demonstrations: neutral drift and selection plus drift at one diploid locus. Explicit integer allele counts, positive relative fitness, complete seeded replicate trajectories, no-drift reference and exact-generation inspector. Temporary state only; no inference from trees or saved lab format. See [model and verification](POPULATION-LAB.md). |
| A05 | Worksheet export, implemented in a separate draft change. Explicit authoring/preview from current or kept tree questions, inheritance or population setups; edited prompts and teacher notes, A4/Letter, separate student/teacher ZIPs, printable offline HTML/editable text/SVG, source/model provenance and exact manifests. Source figures are browser-measured and learner overlays/responses/progress are excluded. Lab data are deliberately regenerated from educator setup/seeds; no project/scenario format change or course generation. See [workflow and verification](WORKSHEETS.md). |
| A06 | Individually scoped advanced experiments. A06.1 linkage/recombination is implemented in a separate draft change: explicit phased two-locus crosses, shared bounded recombination, exact probabilities/seeded samples, worksheet support and one adaptable test-cross example. See [scope and verification](LINKAGE-LAB.md). A06.2 is also implemented in a separate draft change: one bounded neutral bottleneck/recovery schedule, constant-size comparison, complete counts and worksheet/CSV support with one adaptable example. See [scope and verification](BOTTLENECK-LAB.md). Other experiments remain unselected. |
| A07 | Consolidate Topology inspection into Explore. Implemented in a separate draft change. Add Complete source / Current drawing scopes; the latter respects the active accepted view’s selected taxa, collapsed groups and omitted memberships. Open at the selected identity and return without changing artwork, selection, pins, QA or history. Distinguish authored groups from temporary zoom summaries. Use clear nonmetric screen-based branches; retire the separate inspection button/generator while retaining legacy saved-coordinate compatibility. |
| A08 | Free arrangement starting shapes. Implemented in a separate draft change: Tree-like, Radial, Fan, Upright branching and Horizontal. Compare/use/discard worker previews; accepted changes use the command/provenance/undo pipeline and preserve exact source identities, unresolved branches, complete child order and hidden artwork. Conflicting pins reject the whole proposal. Nonmetric geometry findings remain visible; structured scientific layouts and guide fitting remain separate. See [workflow and verification](STARTING-SHAPES.md). |

The core A01–A05 and A07–A08 packages are implemented as separately reviewable draft changes. A06.1 linkage/recombination and A06.2 bottleneck/recovery are the explicitly selected advanced experiments. Select any further advanced experiment explicitly before implementation. Keep the small educator-adaptable demonstration scope throughout; no continuing course-production obligation follows. The bounded inheritance/population models do not add linked loci, migration, mutation, changing environments or empirical inference incidentally.

Reusable application code lives here; demonstration scenarios and teaching resources live in the education repository. Each selected lab should have only a small number of adaptable demonstrations. There is no ongoing lesson-production or support commitment.

P00, P02 and P03 implement the naming/compatibility migration, canonical Teacher's Guide, and offline/print integration. P01 and P04–P08 are delivered in the companion education repository, including a dated verification record and an explicitly untested insect-source download. A01 is a separate application change stacked on the migration branch. It adds no phylogenetic inference, new scientific dataset, saved scenario format or genetics lab.

## Verification

Run strict TypeScript checking, the existing regression suite and the build. Check both legacy and structured exports, historical fixture replay, distribution inventories, dependency declarations and locally assembled archives. For browser checks, inspect the new header at desktop and narrow widths and open/save an existing project. Geometry QA is not biological validation.
