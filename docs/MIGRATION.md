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

Future packages A02–A06 remain deferred: local activity scenarios; an inheritance lab; a population evolution lab; worksheet export; and individually scoped advanced experiments. They are not current features. Reusable application code would live here; demonstration scenarios and teaching resources would live in the education repository. Each selected lab should have only a small number of adaptable demonstrations.

P00, P02 and P03 implement the naming/compatibility migration, canonical Teacher's Guide, and offline/print integration. P01 and P04–P08 are delivered in the companion education repository, including a dated verification record and an explicitly untested insect-source download. A01 is a separate application change stacked on the migration branch. It adds no phylogenetic inference, new scientific dataset, saved scenario format or genetics lab.

## Verification

Run strict TypeScript checking, the existing regression suite and the build. Check both legacy and structured exports, historical fixture replay, distribution inventories, dependency declarations and locally assembled archives. For browser checks, inspect the new header at desktop and narrow widths and open/save an existing project. Geometry QA is not biological validation.
