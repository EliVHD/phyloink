# Learn workspace verification

A01 development verification, 2026-11-11. This is a bounded tree-interpretation demonstration, not a course, learner-record system or release announcement. A02–A06 remain separate future packages.

## Automated checks

`npm run check`, `npm test` and `npm run build` pass. The full suite contains 246 tests, including seven Learn model regressions covering:

- Correct, older and unrelated ancestor choices; duplicate or absent answer identities.
- Missing/extra displayed clade members and unresolved three-way forks.
- Frozen source/project inputs, repeated complete-subtree rotations and exact relationship/path equivalence.
- Full-source versus sampled clade membership (human/chimp: six source descendants, two displayed, four omitted).
- Classification, similarity, unspecified entities and undeclared/unrooted-source gates.
- Duplicate labels with distinct source identities, selection limits and deeply annotated paths that exceed the work budget.

No scientific input, historical fixture, project schema or dependency lock changes. New original files are included in the component allowlist; Learn CSS is explicitly included in the runtime inventory. Source checksums and local browser/source archive manifests are verified.

## Browser checks

Microsoft Edge on Windows, 1440 × 1000 and 390 × 844. Text uses actual browser canvas measurements and font availability. Both bundled mammal diagrams were visually inspected, including separated numbered junctions and readable source names. At narrow widths the controls stack, diagrams scroll inside their cards, and the page has no horizontal overflow.

The exercised workflow:

1. Make one undoable editor appearance change, save a baseline and record the exact SVG and undo/redo availability.
2. Open Learn and the separate six-mammal Upham demonstration. Check a correct human/chimp ancestor, an older ancestor, and the revealed explanation.
3. Select the human/chimp node’s two displayed tips. Confirm correct feedback with six full-source descendants and four omissions; add gorilla and confirm explicit extra-member feedback.
4. Rotate a chosen node, compare layouts, change the prediction, switch to rectangular and tip codes, and choose a node through the keyboard.
5. Press Ctrl+Z inside Learn. Return to the editor and save: the entire serialized project, source records and SVG remain exactly identical to the baseline; undo/redo availability is unchanged. Undo then redo the original editor change successfully.
6. Reopen Learn and confirm the mammal demonstration did not replace the editor’s source. Use the synthetic five-tip source, remove/search/re-add a tip, and rotate its unresolved three-way fork. Classification input disables ancestry checks; the independent demo remains available and returning retains the classification project.

No browser exceptions or external network requests occurred. The six-mammal diagrams report no label, branch-clearance, marker-crowding or incomplete-check findings in this tested configuration. Other educator samples may report conflicts or work limits; these remain visible, with dropdown node selection available for crowded markers. The diagrams are automatically framed practice drawings, not measured print exports. Geometry checks do not validate biological evidence.

## Scope and limits

Learn receives a cloned source/context and has no project, history, save or export mutation callback. Its state is discarded on return. It supports 2–16 tips and at most 512 retained displayed nodes; intermediate annotated source nodes and unresolved forks are not removed to fit those limits. Only declared rooted phylogenies with stated entities can produce ancestry answers. Gene/sequence ancestry remains distinct from species ancestry.

Saved activity scenarios, inheritance/population simulations, worksheet generation, grades and student tracking are outside A01. The education repository’s existing examples remain compatible; this package adds no ongoing content-maintenance commitment.

## A02 follow-up — 2026-11-11

Local scenario open/save is implemented in a separate follow-up change. Strict TypeScript checking, build and the full 253-test suite pass. Seven new scenario regressions cover source/context round trips, exact Unicode/CRLF/comments and duplicate identities, immutable polytomy-preserving replay, invalid identities/roots/versions, unknown answer fields and work bounds, protected citations/rights and display-only corrections.

Actual Edge checks at 1440 × 1050 and 390 × 844 open both education scenarios, select/reset questions, calculate ancestry/clade feedback, replay layouts/rotations, update and add question setups, save/reopen them exactly, and fall back to the current setup when no questions are kept. A rejected version retains the exact existing diagrams/title; HTML-like question text stays literal. Changing the sample clears kept setups. No browser exceptions or external requests occurred; the narrow page has no horizontal overflow. The complete saved editor project and SVG remain identical before/after scenario use.

The two demonstrations reuse the reviewed complete Upham source and the original synthetic A–E topology. Existing education PDFs, SVGs, projects and packs are unchanged. No runtime dependency, source dataset or artwork project schema is added. Scenario files retain setups and visible educator notes, while learner answers/progress and editor artwork/images stay excluded. See [the scenario contract and workflow](LEARNING-SCENARIOS.md).
