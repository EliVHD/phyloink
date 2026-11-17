# Local learning scenarios

A02 lets educators reuse a small source/sample/question setup in Learn. It does not add a course, gradebook, student identity, saved answers or scheduled content updates. Two independent demonstrations live in [PhyloInk education](https://github.com/EliVHD/phyloink-education/tree/main/scenarios): six mammals and an invented unresolved fork. Both guides remain in the application repository.

## Open and adapt

1. Open Learn, expand **Local activity scenarios**, and choose **Open scenario**. Select a downloaded `.phyloink-activity.json` file. The full source is embedded; no provider connection or original project is needed.
2. Read the activity introduction and source evidence. Choose a **Kept question**. Each choice clears previous answers and replays that question’s pair/node, layout and complete-subtree rotations.
3. Use **Check reasoning** or **Explain**. Source-based feedback is calculated locally, rather than stored as an answer key. Educator notes are ordinary visible text and may contain teaching suggestions or explanations; they are not private teacher-only fields.
4. To adapt, change the activity title/introduction/notes in the scenario panel. Expand **Adapt / keep this question** to edit its prompt; change the pair or target node, second layout or rotations, then choose **Keep question**. This updates the selected kept question. Selecting a different question type starts a new question setup.
5. Choose **Save scenario** to download your local copy. If no questions are kept, it records the current setup. Otherwise it saves the kept setups; unkept question edits are excluded. There are at most 12 independent questions, with no required lesson progression.

Changing the sample clears kept questions because their identities may no longer apply. Use Save first to keep a reusable copy. A rejected file retains the current practice. Returning to the editor discards the temporary workspace while preserving the editor’s document, source, selection, pins, QA and undo state. There is no autosave.

## Scientific context and sharing

Scenarios require a declared rooted phylogenetic source and stated entities. They preserve source text, source identities, declared root/evidence, display-only label corrections, citations and complete source-child order. A selected sample does not redefine a complete source clade. Feedback continues to disclose omitted descendants; unresolved forks stay unresolved. Gene/sequence ancestry does not establish species ancestry.

The complete source is included, not only the selected taxa. Review its separate reuse terms before sharing a scenario. Known bundled sources keep their registered citations and data terms. User-supplied citations remain unverified, and explanatory metadata/question text is supplied by the author. Format/geometry checks do not authenticate biological evidence or grant redistribution rights. No source/citation URL is fetched automatically.

Only explicit scenario fields are saved: no editor artwork, embedded pictures, private project history, answers, scores, progress or learner identifiers. Notes are visible to anyone opening the file. Use normal editor projects and exports for artwork and print materials.

## Version 1 contract

The canonical TypeScript types and strict reader are in [src/learn/scenario.ts](../src/learn/scenario.ts). JSON uses:

| Field | Contents |
| --- | --- |
| `format`, `version` | `phyloink-learning-scenario`, `1`; unsupported versions are rejected. |
| `title`, `introduction`, `teacherNotes` | Plain text; title is required. Descriptions are never interpreted as HTML. |
| `source` | Exact embedded `newick`, its SHA256, and `hashBasis: "legacy-utf8-text"`, matching the existing UTF-8-text source identity convention. |
| `context` | Traversal, declared biological-root state, scientific basis, display-label corrections, complete child-order permutations, source title and citation records. No source lookup or inference. |
| `tipIds`, `tipCodes` | 2–16 distinct terminal identities and an optional display-code preference. At most 512 retained displayed nodes. |
| `activities` | 1–12 uniquely identified question setups. Common fields: `id`, plain-text `prompt`, `layout` (`rectangular`/`circular`), `rotations` (up to 32 displayed branching identities, repeated identities allowed to reverse again). |

An `ancestor` question adds two distinct sampled `tipIds`; a `clade` question adds a displayed branching `nodeId`; a `compare` question adds no answer field. Rotations permute entire original child subtrees, including omitted descendants. Source paths and source identities remain unchanged.

The file limit is 25 MB, with the parser’s existing 20-million-character / 100,000-node / depth-800 Newick limits. Text, citation and question counts are bounded. Unknown fields, duplicate question identities, altered hashes, missing citations, changed registered citations, unsupported relationship/root metadata, invalid permutations and foreign targets are rejected before practice is replaced. This format is separate from V1–V4 artwork projects and the education repository’s printable-handout `activity.json` configuration.
