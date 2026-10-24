**Lane:** shaders (Lethabo)
**Priority:** MUST
**PRD:** D3
**Cost:** M
**Depends on:** 042 if the model is to be seen; the behaviour can be built against the box fallback

### Context

The wall-crawler is the only enemy that turns your own traversal paint into a threat. `config.js` has `climbsGreen: true` on its config and **nothing reads it** — the flag is a promise with no behaviour behind it.

`docs/enemies/algorithms.md` specifies the numbers: 3.5 m/s on grey surfaces, 5.0 m/s on green.

### Scope — files you may touch

- `src/enemies/enemy.js` — climbing and the surface speed read
- `src/config.js` — climb and ground speeds

### Out of scope — do not touch

- The player's climb
- Green paint's behaviour for the player
- The model itself

### Acceptance criteria

- [ ] It climbs vertical surfaces, including grey ones, not only painted ones
- [ ] It climbs **faster on green** than on grey
- [ ] It prefers a green route over a grey one when both exist
- [ ] It **cannot shoot while climbing** — that is its opening
- [ ] Green pin roots it and, mid-climb, it falls
- [ ] Red knockback knocks it off a wall and it must re-climb
- [ ] Blue freeze mid-climb drops it, with a crit window on landing
- [ ] `tests/wallcrawler-climb.test.js` covers the speed difference and the mid-climb fall

### Manual check

Paint a tall green face and stand at the bottom. It should come down that face faster than it would over the grey rock beside it. Then pin it halfway up and watch it fall.

### Design note

The realisation "my route is its route" only lands if the speed difference is visible. A crawl that is merely *slightly* faster reads as noise; make green obviously the fast lane for it.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for D3 updated
- [ ] No files touched outside the lane
