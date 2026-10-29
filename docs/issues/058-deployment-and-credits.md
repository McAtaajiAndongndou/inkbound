**Lane:** ui (Moses), with everyone on their own credits entry
**Priority:** MUST
**PRD:** L1, L2, M9, M12
**Cost:** S
**Depends on:** every model issue — do this last

### Context

Nothing in the project has ever been verified on the department server. The build passes locally, `deploy:zip` exists with path and case checking, and nobody has run the published URL. Deployment problems are the classic way a finished project loses easy marks.

The credits screen also has to be complete and accurate, and `docs/ASSETS.md` currently claims the Sci-Fi Gun Pack replaced the Kenney blaster when the build ships `pistol.glb`.

### Scope — files you may touch

- `src/ui/credits.js` — attribution
- `docs/ASSETS.md` — correct the gun-model record
- `docs/PRD.md` — set M9, L1 and L2 to built

### Out of scope — do not touch

- Game behaviour
- Any asset that is not being shipped

### Acceptance criteria

- [ ] `npm run build` then `npm run serve:dist` plays all four levels through without a console error
- [ ] `npm run deploy:zip` produces a zip that unpacks with `index.html` at the top level
- [ ] The published URL loads in Chrome with no 404s in the console
- [ ] Every CC-BY asset in the build is named in the credits screen
- [ ] The gun in the build is the one the docs and credits describe
- [ ] All asset paths are relative and all filenames match case on disk

### Manual check

Play the **published** build, not the dev server, from first room to last. The dev server rewrites paths and the department server does not — this is the one test that catches the failure mode the whole deployment section of the README exists for.

### Design note

Do this **before** the deadline, not on it. Every previous cohort's "it worked locally" story ends the same way.

### Definition of done

- [ ] Published URL played end to end
- [ ] PRD status for L1, L2, M9 and M12 updated
- [ ] `docs/ASSETS.md` matches what actually ships
