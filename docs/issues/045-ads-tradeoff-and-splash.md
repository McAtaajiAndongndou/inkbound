**Lane:** paint (Dikeledi), with Ozuko on the aim state
**Priority:** MUST
**PRD:** C6, C4
**Cost:** S
**Depends on:** #106 (the crit is the payoff this tradeoff exists to deliver)

### Context

ADS is already on the right mouse button with tighter spread, but it is currently cosmetic: precise aiming does not do anything a sloppy shot cannot. Meanwhile the gun resolves **one** enemy per shot, so hipfire has no area advantage either.

This issue makes the tradeoff real — **ADS for precision and crits, hipfire for coverage and clumps.**

### Scope — files you may touch

- `src/paint/paint-gun.js` — the impact resolution
- `src/config.js` — splash radius, splash damage fraction, spread values
- `tests/` — splash behaviour

### Out of scope — do not touch

- The ADS camera behaviour, FOV or sensitivity
- The `V` free-FPV toggle
- Painting the floor — both modes still paint

### Acceptance criteria

- [ ] A hipfire shot damages **every enemy inside the splat radius**, not just the first raycast hit
- [ ] Aiming fires a single-target shot with **no splash** — that is the cost of precision
- [ ] Splash damage is partial, so a direct hit is still worth aiming for
- [ ] Painting surfaces works identically in both modes
- [ ] Clumped enemies take meaningfully more total damage from hipfire than from aiming
- [ ] Splash never damages through walls or floors

### Manual check

Find two enemies standing close together. Hipfire into the pair — both should take damage. Then aim and fire — only one should. Then confirm the aiming shot can still crit a frozen enemy, which the hipfire shot cannot reliably do.

### Design note

The trap here is making splash so strong that aiming stops mattering. Splash should be roughly **half** a direct hit until playtests say otherwise, and it should never crit.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for C6 updated
- [ ] No files touched outside the lane
