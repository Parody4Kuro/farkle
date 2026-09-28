# Realistic tavern and cinematic playback

## Authorized outcome
Implement the accepted full-scene upgrade: MakeHuman CC0 characters and rigged hands, local PBR assets, believable scale, continuous cup-to-dice physics, selection/collection/banking/Hot Dice/bust/ability/victory animations, cinematic cameras, skip/fast/reduced-motion controls, all three modes, offline Mac delivery and Git/LFS push.

## Phases
1. **complete** — Prepare reproducible Blender/MPFB asset pipeline and licensed materials; build first character and tabletop.
2. **complete** — Implement shared cancellable action playback, visual snapshots, scoring animation and preferences.
3. **complete** — Integrate rigged characters/hands, cup release physics, cameras and all game modes.
4. **complete** — Run unit/lint/build, browser visual/functional/performance checks, and packaged Mac tests; repair findings.
5. **in_progress** — Save evidence/licensing/source assets, rebuild and verify Mac archive, commit and push Git/LFS; verify remote.

## Decisions
- Keep pure game rules and weighted outcomes authoritative. Rendering never rolls or awards points.
- Default cinematic presentation; preserve existing fast preference; system reduced motion takes priority.
- All runtime assets local. Asset source and editable models retained; generated binary assets use Git LFS where appropriate.
- Preserve runId/revision/AbortSignal and existing single-player versus friend-pause semantics.

## Errors / resolutions
- Initial zsh glob failed on missing temporary folders; use explicit paths / Python checks.

## Completion criteria
All five phases complete with reproducible assets, real visual evidence, passing checks and verified remote application artifact. Never claim tests or visuals not actually verified.
