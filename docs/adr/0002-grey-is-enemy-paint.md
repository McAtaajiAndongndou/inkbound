# Grey is enemy paint

`ENEMIES.md` described the Sprayer as firing bursts that "strip" the player's territory, which was ambiguous between deleting paint and repainting it. We decided both sides paint the same surface: grey is Corrupt Corp's colour, not the absence of colour, and enemy fire converts your territory to theirs using the same operation your gun uses in reverse.

## Considered Options

An eraser model, where enemy fire reverts ground to unpainted. Cheaper to reason about, but it gives the two sides different verbs, so the arena stops being a contested object and the fiction loses its mechanical footing.

Splitting the behaviour by enemy — ranged enemies repaint, the Drainer deletes. Rejected because it hands the player two different mental models for "my paint is going away" with no gameplay payoff.

## Consequences

- Grey reads as a faction colour, not as emptiness, which constrains the art direction: drained ground is something someone *did*, not something nobody has touched yet.
- The Drainer re-greys ground at melee range rather than consuming it, so its threat stays legible under the same rule.
- Territory immediately becomes worth defending, which is what gives the final level's contested-arena pressure something to grind against.
