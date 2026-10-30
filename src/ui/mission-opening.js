// OWNER: E (UI & Audio)
// What opens a mission, and what must go when you leave one. The menu owns two
// overlays that start a level — the mission intro (G4) and the Primer's
// briefing still (#111) — and this is their rule book, free of the DOM so the
// tests can drive it with stand-ins.
//
//   a NEW mission   gets its intro; the Primer gets its briefing instead
//   a restart       (the same id again) gets neither
//   leaving a level takes BOTH overlays down. #221: the briefing stayed up
//                   through pause → level select, so the next level's intro
//                   panned under the old sergeant line.

export const BRIEFING_LEVEL = 'primer';

export class MissionOpening {
  /**
   * @param {object} deps
   * @param {{ show(): void, hide(): void }} deps.briefing
   * @param {{ play(data: object): void, hide(): void }} deps.intro
   * @param {(id: string) => object | null} deps.introFor   the intro data for a level
   * @param {string} level                                   the level loaded at start
   */
  constructor({ briefing, intro, introFor }, level) {
    this.briefing = briefing;
    this.intro = intro;
    this.introFor = introFor;
    this.level = level;
    this.introPending = level !== BRIEFING_LEVEL;
    this.briefingPending = level === BRIEFING_LEVEL;
  }

  /**
   * A level has loaded. Returns true when it is a different mission (so the
   * caller may start it at once, e.g. "next mission" with the pointer locked).
   */
  levelLoaded(id) {
    if (id === this.level) return false; // a restart: nothing reopens
    // Leaving a level takes down whatever was opening it (#221).
    this.intro.hide();
    this.briefing.hide();
    this.level = id;
    this.introPending = id !== BRIEFING_LEVEL;
    this.briefingPending = id === BRIEFING_LEVEL;
    return true;
  }

  /** Play whatever opens the mission: the intro, or (Primer) the briefing. */
  start() {
    if (this.introPending) {
      this.introPending = false;
      const data = this.introFor(this.level);
      if (data) this.intro.play(data);
    }
    if (this.briefingPending) {
      this.briefingPending = false;
      this.briefing.show();
    }
  }
}
