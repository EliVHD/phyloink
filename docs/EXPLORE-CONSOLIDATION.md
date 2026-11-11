# A07 — one read-only relationship viewer

Development verification, 2026-11-11. Topology inspection is consolidated into Explore. A08 starting shapes and the later biology labs remain separate planned packages.

## Workflow

- **Explore** opens **Complete source**. **Inspect relationships** opens **Current drawing** at the selected original source identity. The scope selector can switch between them.
- Current drawing uses the accepted reduction or active saved structured/artistic graph. It preserves its exact junctions, selected tips, authored collapsed endpoints, represented/original/omitted counts and ordered original source-edge paths. It does not regenerate artwork or silently switch a saved view to newer scientific metadata.
- Solid diamonds identify authored collapsed groups, which remain fixed when zooming. Dashed shaded regions are temporary density/budget summaries. The viewer counts represented source tips separately from authored endpoint slots and omitted source tips.
- Search covers the complete source in both scopes. A hidden represented tip or omitted tip remains identified in the inspector, with an explicit action to open Complete source at that identity. This does not expand or edit the drawing. A virtual traversal junction is not an original source identity; its temporary selection is not transferred between scopes.
- Both scopes use the same rectangular/circular/fan renderer with screen-based strokes and labels. Artwork dimensions, taper, curve routing and collision avoidance are not inputs. Spacing carries no source distance, date, confidence or rank meaning. Classification membership and unrooted display direction do not establish ancestry.
- Root explanations and evidence remain available under Scientific context. Numeric internal labels remain verbatim in Original source fields without assuming support semantics. Selected labels and terminal names take priority over internal labels.

Returning to the editor retains artwork, reduction, saved scientific context, selection, pins, QA, camera, undo and unsaved state. The viewer exposes no editing, history, save or export mutation callback. Its index, camera, summaries and temporary selection are not saved or exported. Obsolete workers are terminated and their replies are rejected by sequence, scope, layout and source identity.

## Legacy coordinates

The separate inspection tab and `createInspectionLayout` generator are removed. The legacy `scientific` layout mode and `legacy-inspection` saved intent remain compatibility identifiers. Existing files open and save with the exact stored coordinates, curves, pins and source records. No import path computes a replacement inspection layout.

Stored legacy artwork stays read-only. **Arrange → Make artistic** explicitly adopts the coordinates without changing them, with normal provenance and undo. New inspection generation is rejected rather than silently replacing legacy geometry. Project schemas, historical fixtures, method definitions and release records remain unchanged.

## Verification

Strict TypeScript checking, build and the full **256-test** suite pass. Six new drawing-scope regressions cover the Hug 150-endpoint / 3,083-tip reduction, partial sampled groups and their exact omissions/paths, fixed authored groups versus temporary summaries, saved versus current scientific context, classification/unrooted graphs and rejection of foreign/broken paths, memberships and identities. Three compatibility tests preserve migration/save, explicit artistic adoption and rejection of implicit legacy regeneration. Tests of the retired layout generator are replaced by these compatibility checks. Existing full-source 50,000-way-polytomy and 99,997-node bounded-view tests continue to pass.

Actual Microsoft Edge checks at 1440 × 1050 and 390 × 844 verify:

- Selected-group entry, fixed collapsed endpoints through repeated zoom, all three viewer layouts, source search and hidden-tip navigation.
- The six-mammal saved drawing (six represented tips and 4,093 omissions), original connection-path inspection, omitted-identity navigation and rapid scope/layout switching without stale replies.
- Classification and unrooted accepted views, plus an accepted drawing whose current metadata has changed. Each keeps the appropriate declared context and graph.
- An exactly identical serialized editor project and SVG before/after navigation, including pins and selection; unchanged QA, camera and undo availability; the original editor change still undoes/redoes correctly.
- Exact legacy load/save coordinates and explicit artistic adoption without reshaping, including undo.
- Prior A01/A02 browser workflows. No browser exceptions or external network requests. The narrow page has no horizontal overflow; its canvas spans the viewport and the inspector stacks below it. Canvas labels were visually inspected with terminal names prioritized.

The existing work and label limits remain visible. Some dense details or long names require zoom, search or the inspector; viewing summaries do not become authored groups or biological conclusions. No new scientific data, dependency, project field, teaching scenario or maintenance commitment is introduced by A07.
