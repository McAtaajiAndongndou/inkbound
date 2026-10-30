// OWNER: E (UI & Audio)
// The campaign: the Primer → Outskirts → the Ascent → Last Colour, in the
// order of the ONE level list (levels/index.js). This file knows only that
// order; it never holds a second copy of the list.
//
//   next mission   the win screen offers the next level (Enter); the last
//                  level's win is the campaign's end instead
//   progress       the furthest level a player has reached, kept in their
//                  browser so the title menu can offer "Continue"
//   totals         each mission's time on its latest win this session, so the
//                  campaign-complete screen can add them up

const STORAGE_KEY = 'inkbound.progress';

/** The level after `id` in `levels`, or null after the last (or an unknown id). */
export function nextLevelId(levels, id) {
  const i = levels.findIndex((l) => l.id === id);
  return i >= 0 && i < levels.length - 1 ? levels[i + 1].id : null;
}

/** The further of two level ids along the campaign (an unknown id counts as none). */
export function furthest(levels, a, b) {
  const ia = levels.findIndex((l) => l.id === a);
  const ib = levels.findIndex((l) => l.id === b);
  return ib > ia ? b : (ia >= 0 ? a : null);
}

export class Campaign {
  /**
   * @param {{ id: string, name: string }[]} levels   the ONE list, in order
   * @param {Storage | null} [storage]                 localStorage, or none
   */
  constructor(levels, storage = globalThis.localStorage ?? null) {
    this.levels = levels;
    this.storage = storage;
    this.times = new Map(); // level id → seconds, its latest win this session
    this.reached = this._load();
  }

  next(id) { return nextLevelId(this.levels, id); }

  name(id) { return this.levels.find((l) => l.id === id)?.name ?? id; }

  /** Is `id` the last mission — its win ends the campaign? */
  isFinale(id) { return this.levels.length > 0 && this.levels[this.levels.length - 1].id === id; }

  /**
   * A mission won in `seconds`. Moves progress on to the next mission (or
   * keeps the finale), never backwards: replaying the Primer does not undo
   * reaching Last Colour.
   */
  recordWin(id, seconds) {
    this.times.set(id, seconds);
    const reached = furthest(this.levels, this.reached, this.next(id) ?? id);
    if (reached !== this.reached) {
      this.reached = reached;
      this._save();
    }
  }

  /** For the campaign-complete screen: missions won this session, and their total time. */
  totals() {
    const won = this.levels.filter((l) => this.times.has(l.id));
    return {
      cleared: won.length,
      of: this.levels.length,
      time: won.reduce((sum, l) => sum + this.times.get(l.id), 0),
    };
  }

  // Per-player, so it lives in their browser. Storage can throw (private mode,
  // blocked site data) — then there is simply no "Continue".
  _load() {
    try {
      const saved = JSON.parse(this.storage?.getItem(STORAGE_KEY) ?? 'null');
      return this.levels.some((l) => l.id === saved?.reached) ? saved.reached : null;
    } catch {
      return null;
    }
  }

  _save() {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify({ reached: this.reached }));
    } catch { /* not persisted; this session still works */ }
  }
}
