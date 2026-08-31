// OWNER: D (Enemies & Combat)
// Pooled spawning. Reuse instances — allocating enemies mid-wave causes GC stutter,
// which loses marks under Polish (lag is explicitly penalised).
export class Spawner {
  constructor() { throw new Error('TODO: D'); }
}
