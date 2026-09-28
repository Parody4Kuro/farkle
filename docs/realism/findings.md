# Implementation findings

- Baseline branch: codex/mac-desktop-adventure, c2b475d. Working tree initially clean.
- Existing scene uses MeshToonMaterial and primitive humanoids; dice already have Rapier worker trajectories and weighted-result face offsets.
- Existing RollPresentation only covers rolls. BANK and BUST immediately clear meshes; GamePlayback already supports paused time and cancellation.
- Adventure reducer can lock and draw in one transition; capture before/after state for collection before rolling. Winning BANK immediately changes stage, so results must wait for the visual sequence.
- FriendSession is authoritative outside the animation clock; only rolls currently have replay records. Add optional presentation metadata without delaying authority.
- node_modules, release folder and Chrome exist; Blender and ffmpeg not found on usual paths.
- MakeHuman official base assets/export are CC0; Poly Haven assets are CC0. Record downloaded source/version/checksum and modifications.
- Actual game screenshot shows oversized dice relative to hands/head and primitive faces. Scene proportions must change alongside materials.
