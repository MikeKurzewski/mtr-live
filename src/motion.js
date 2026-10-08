import { incomingStation, segmentSeconds } from './network.js';
import { isFresh } from './live.js';

const DWELL_SECONDS = 6;
const FADE_SECONDS = 0.6;

// The feed has no train IDs. Match nearby predictions within one approach only;
// never move a DOM marker back to the start for a following train.
export class TrainMotion {
  tracks = new Map();
  snapshots = new Map();
  serial = 0;

  reconcile(boards, now) {
    for (const [boardKey, board] of boards) {
      if (!isFresh(board, now)) {
        for (const track of this.tracks.values()) if (track.boardKey === boardKey) track.retiring = true;
        continue;
      }
      if (this.snapshots.get(boardKey) === board) continue;
      this.snapshots.set(boardKey, board);
      const candidates = board.rows.flatMap(row => {
        const from = incomingStation(board.line, board.station, row.dest);
        if (!from || row.arrival < now - DWELL_SECONDS * 1000) return [];
        return [{ ...row, from, to: board.station, line: board.line,
          duration: segmentSeconds(board.line, from, board.station), delay: board.delay }];
      });
      const existing = [...this.tracks.values()].filter(t => t.boardKey === boardKey && !t.retiring);
      const matches = [];
      for (const track of existing) for (const candidate of candidates) {
        if (track.direction !== candidate.direction || track.dest !== candidate.dest || track.platform !== candidate.platform || track.from !== candidate.from) continue;
        const headway = Math.min(...candidates.filter(c => c !== candidate && c.direction === candidate.direction).map(c => Math.abs(c.arrival - candidate.arrival)));
        const tolerance = Math.min(90_000, headway * 0.45);
        const difference = Math.abs(track.arrival - candidate.arrival);
        // Once a marker has stopped, a later prediction belongs to another estimate.
        if (difference <= tolerance && (!track.stopped || difference < 1000)) matches.push({ track, candidate, difference });
      }
      matches.sort((a, b) => a.difference - b.difference);
      const usedTracks = new Set(), usedCandidates = new Set();
      for (const { track, candidate } of matches) {
        if (usedTracks.has(track) || usedCandidates.has(candidate)) continue;
        usedTracks.add(track); usedCandidates.add(candidate);
        // Preserve position and velocity. Only the destination time changes.
        Object.assign(track, candidate);
      }
      for (const track of existing) {
        track.delay = board.delay;
        if (!usedTracks.has(track) && !track.stopped) track.retiring = true;
      }
      for (const candidate of candidates) {
        if (usedCandidates.has(candidate)) continue;
        const remaining = (candidate.arrival - now) / 1000;
        if (remaining < 0 || remaining > candidate.duration) continue;
        const track = { ...candidate, boardKey, key: `approach-${++this.serial}`,
          progress: 1 - remaining / candidate.duration, speed: 1 / candidate.duration,
          opacity: 0, stopped: false, dwell: 0, retiring: false, pulseSent: false };
        this.tracks.set(track.key, track);
      }
    }
  }

  step(boards, now, elapsed, paused = false) {
    this.reconcile(boards, now);
    // Returning from a background tab must not fast-forward through an arrival.
    const dt = Math.max(0, Math.min(elapsed, 0.1));
    const arrivals = [];
    for (const [key, track] of this.tracks) {
      if (!isFresh(boards.get(track.boardKey), now)) track.retiring = true;
      if (track.retiring) {
        track.opacity = Math.max(0, track.opacity - dt / FADE_SECONDS);
        if (!track.opacity) this.tracks.delete(key);
        continue;
      }
      track.opacity = Math.min(1, track.opacity + dt / FADE_SECONDS);
      if (paused) continue;
      if (track.stopped) {
        track.dwell += dt;
        if (track.dwell >= DWELL_SECONDS) track.retiring = true;
        continue;
      }
      const remaining = (track.arrival - now) / 1000;
      const targetSpeed = Math.min(4 / track.duration, (1 - track.progress) / Math.max(remaining, 0.5));
      // A continuous velocity response absorbs a revised ETA without rewinding.
      track.speed += (targetSpeed - track.speed) * (1 - Math.exp(-dt / 1.8));
      track.progress = Math.min(1, track.progress + track.speed * dt);
      if (track.progress >= 1 - 0.0001 && remaining <= 0) {
        track.progress = 1;
        track.speed = 0;
        track.stopped = true;
        if (!track.pulseSent) { arrivals.push({ station: track.to, line: track.line }); track.pulseSent = true; }
      }
    }
    return { trains: [...this.tracks.values()], arrivals };
  }
}
