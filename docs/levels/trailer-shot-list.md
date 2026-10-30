# Trailer shot list: the Levels side

For Moses (trailer, `src/ui/`) from Renda (Levels). These are the moments each level was built to show. The edit, music and pacing are Moses's call. The trailer's job is the pitch in one line: **the world is grey, and you paint it back.**

## How to frame a shot

- **Frame it in the viewer:** `npm run dev`, then `/src/levels/viewer.html?level=<id>&shot=<name>`. `H` hides the helpers, and `G` toggles fog. The "copy camera" button gives you the position, so a shot can be framed again exactly.
- **Record it in the game:** `/?level=<id>`. The viewer has no player, paint or enemies, so it is for framing only.
- **Watch for this:** the viewer's camera sees to 1000 m, but the game's only sees to 400 m. Check every wide shot in the game before recording it.

## The shots

| # | Level | Where (viewer shot) | What to capture | Why it sells the game |
|---|---|---|---|---|
| 1 | Outskirts | `spawn` | The grey trailhead before any paint. Hold for 2 seconds. | The "before": grey is the enemy. |
| 2 | Outskirts | `gap1` → `island-b` | A slide across a blue strip over the gap. | Colour is movement, not decoration. |
| 3 | Outskirts | `ledge` | The reveal: every prop near your paint takes your colour. | The payoff of the loop in one beat. |
| 4 | The Ascent | `spawn`, looking south | The jagged ridges in a grey sky. | Scale: the climb ahead. |
| 5 | The Ascent | summit, position `[0, 41.5, 4]`, target `[33, 45.6, 26]` | **The dawn sun.** Start with the sky drained, then paint until the sky turns blue and the sun breaks through behind the peak. | **The hero shot:** painting brings back the colour *and* the dawn. |
| 6 | The Ascent | `catwalk` | Running the collapsing catwalk as segments drop behind you. | Tension and movement for the CoD half. |
| 7 | Last Colour | `crusher` | The crusher, with blue paint underfoot. | A trap the player turns against the Corp. |
| 8 | Last Colour | `overview` | The Siphon fight: grey drains in, and your paint pushes back. | The finale stakes. |

## The grey-to-colour beat

The strongest cut uses the same camera on the same spot twice: once grey, once painted. Shot 5 does this in a single take, because the sky itself warms up as you paint (#197). For a hard cut instead, record the drained take first, then paint the area and record the same framing again.

## Credits

The music and models need attribution in the trailer's end card: see `docs/ASSETS.md`.
