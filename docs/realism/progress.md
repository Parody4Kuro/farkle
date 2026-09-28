# Progress

## Started
- Read project guidance and accepted plan; inspected existing scene, hooks, reducers, storage, multiplayer and delivery scripts.
- Read planning-with-files and in-app browser skills.
- No implementation or verification completed yet.

## Implementation checkpoint
- Generated four rigged GLB characters and player hands using Blender 4.5.14 / MPFB 2.0.17; retained packed .blend sources and asset manifests.
- Integrated shared action snapshots, cancellable timing, skip, animated scores, preferences and optional host presentation summaries.
- Rebuilt Rapier in metres with sequential cup-mouth release; generated 14 validated fallback trajectories for both actors, 1–7 dice.
- First visual pass caught and fixed opaque skin alpha sorting, cap placement, carved-die mesh topology and hand-basis handedness.
- 190 unit tests, lint and production build passed before added multiplayer metadata tests. Browser E2E server requires escalation because the sandbox denied its localhost listener.

## Visual and regression acceptance
- Replaced clipped first-person torso with sleeves; fixed the hand-basis reflection, opaque skin sorting, cornea transparency, standing collars, seated heights and cup framing.
- Added cup-relative finger contact correction and distinct per-character motion amplitudes.
- Camera snap initially left DOM hit targets projected from the previous camera matrix. Updating the camera world matrix before projecting hits fixed the real clickability defect.
- Unit suite: 196 / 196; lint and build pass. Browser regression: 27 / 28 passed on first complete run; the recording case encountered a transient asset 404 because desktop packaging rebuilt dist while preview was running. Re-running this case with a stable build, plus the full-frame probe, before native validation.
- Browser and native evidence use isolated saves. Frame probe records all visible roll frame intervals, including long frames; automatic-quality telemetry is separate.

## Verified build ready for archival
- All 28 browser scenarios passed, with the interrupted recording re-run successfully; final victory ordering and Joker/ability regression rechecked after visual refinements.
- All nine real packaged Mac scenarios passed. Final special-die engraving build passed an additional offline/physics/audio pass and exact 1920×1080 native WebContents performance pass.
- Apple M4 / 16 GB: native full-roll median 16.7 ms, P95 17.0 ms, one 149.9 ms cold-load frame; CPU and working-set details retained without excluding the long frame. Attached display constrains OS window size, so an exact content viewport was applied in the native renderer and documented.
- Approval service timed out once when starting the exact-viewport test; the permitted retry succeeded. No validation remains blocked.
- Source/assets/evidence ready for commit; Mac ZIP archive and remote Git/LFS verification next.

- Final landing-camera follow build: 196 tests, lint, build and packaging passed; first-table browser recording and exact native 1080p rechecked. Final native sample median 16.7 ms / P95 16.8 ms / maximum 166.6 ms (one cold-load frame), superseding the prior performance sample.

- Created and extracted the 181,773,554-byte ditto archive from feebaa7; strict code signature, ASAR, all dist/desktop files and package version match. SHA-256: 9550ebfe003ff06a1368f5a9017c715e3fc899573a806bfe0ed1662cf588b0e9.
