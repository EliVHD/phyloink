# A08 — Free arrangement starting shapes

Development verification, 2026-11-16. Five original starting forms broaden the free-artwork workflow. Biology labs remain separate planned packages; no new teaching course or continuing content commitment is introduced.

## Workflow and meaning

Choose **Free arrangement → Arrange**, select **Tree-like**, **Radial**, **Fan**, **Upright branching** or **Horizontal**, then **Preview**. The current page and straight/curved style remain in use. **Show original** compares the accepted artwork; **Use shape / Use draft shape** accepts one undoable edit. **Discard**, Escape or the pending calculation's **Cancel** leaves the accepted project intact. Saving and exporting wait until previews are settled.

Tree-like uses the existing crown-and-roots initializer. Other forms place complete ordered child subtrees using endpoint spans and topological depth, with bounded curve controls. Radial follows an ellipse on a non-square page. Fan opens above a lower origin; upright grows upward; horizontal grows across the page. None uses source branch lengths, supplies a biological root or carries calibrated distance/time meaning. A preset is a starting arrangement, not a constraint on later edits, a collision optimizer or an arbitrary silhouette fitter. Use Shape/Fit for authored guides, structured Layout for scientific layouts, and Explore for read-only inspection.

Only visible junction positions and bends are replaced. Original source bytes, identities, duplicate labels, complete child order, unresolved forks, reduction memberships/omissions, scientific context, hidden geometry, page, label offsets, guides, fit settings and editing images remain intact. Conflicting pinned junctions or edges reject the entire proposal, including hidden pinned edges whose incident junction would move. Pins are never silently released. Compatible pins retain their exact stored coordinates and curves. Legacy inspection coordinates require explicit Make artistic adoption first.

## Bounds and persistence

Starting shapes support at most **20,000 visible junctions and 5,000 endpoints**. Exceeding a limit rejects the operation without pruning taxa. Geometry validation reports contacts, clearance, bounds, numbered-label issues and incomplete work. Draft proposals remain drafts; passing geometry checks does not authenticate biology. Blue preview markers identify at most the first 800 moved junctions; all proposed artwork is drawn and the summary reports the full moved count. These editing markers never enter artwork exports.

Workers are cancellable and stale replies are rejected. Acceptance also checks the document revision and active view, then uses the normal accepted-command pipeline. An identical result adds no undo step. The versioned original method `artistic-starting-shape@1.0.0` records the selected form, page, line style, ordering, pins and QA result; Tree-like also credits the organic initializer. Accepted coordinates persist exactly in V4 projects. The selected preset button is temporary UI state, with no project schema change. Historical methods and fixtures remain unchanged.

## Verification

Strict TypeScript checking, the full **264-test** suite and the build pass. Eight preset regressions cover deterministic distinct forms, frozen inputs, complete polytomies/order, duplicate labels, unary/single-tip trees, nonmetric source lengths, visible and hidden pin conflicts, exact compatible pins, hidden artwork, work limits, crowded drafts, guide/image retention, versioned provenance, exact V4 replay, one-step undo/redo and identical branch artwork in paired SVGs. All five preserve the Hug reduction's 150 endpoints and exact accounting for 3,083 source tips.

Actual Microsoft Edge checks at 1440 × 1050 and 390 × 844 cover all five forms on the Hug reduction and invented five-tip tree; exact serialized project/QA/history/artwork restoration after comparison and discard; acceptance, save/reopen and undo/redo; atomic pin rejection; cancellation with a deliberately delayed worker; Escape; straight-line mode; source/scientific preservation and recorded provenance. Small-form and dense previews are visually inspected. There are no browser exceptions, external network requests or narrow-page horizontal overflow. Earlier Learn, local-scenario and Explore workflows are checked again.

Distribution and release checks verify local browser/source archives and their inventories. An extracted source archive rebuilds offline from the reviewed lockfile using an existing dependency cache, with the same build identity. Archives remain image-free; the synthetic pixel used by tests is an inline fixture, not an external asset. No dependency, scientific dataset, private image, saved project field or public release is added by A08.
