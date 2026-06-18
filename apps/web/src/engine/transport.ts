// Shared transport / clock — DESIGN-NOW seam (plan §6, §3-D8).
//
// Phase 0 (the tile game) keeps its own performance.now()-based clock inside
// GameEngine, exactly as the original. This module exists so that Phase 2's
// two render targets (tile game + OSMD sheet view) can be driven by ONE shared
// clock and a highlight bus, instead of each renderer rolling its own timing.
// It is intentionally minimal and not yet wired into GameEngine — building it
// out is deferred to the teacher phases.

export class Transport {
  private t0 = 0;
  private pausedAt = 0;
  private running = false;
  private paused = false;

  start(): void {
    this.t0 = performance.now();
    this.running = true;
    this.paused = false;
  }

  /** Milliseconds elapsed since start(), excluding paused spans. */
  now(): number {
    return performance.now() - this.t0;
  }

  pause(): void {
    if (!this.running || this.paused) return;
    this.paused = true;
    this.pausedAt = performance.now();
  }

  resume(): void {
    if (!this.running || !this.paused) return;
    this.paused = false;
    this.t0 += performance.now() - this.pausedAt;
  }

  stop(): void {
    this.running = false;
    this.paused = false;
  }
}
