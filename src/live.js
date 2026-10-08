import { lines, incomingStation, segmentSeconds } from './network.js';
export const API = 'https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php';
export const FRESH_MS = 90_000;
export const hkTime = text => typeof text === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text) ? Date.parse(text.replace(' ', 'T') + '+08:00') : NaN;
export function normalize(payload, line, station, now = Date.now()) {
  const data = payload.data?.[`${line}-${station}`];
  const stamp = hkTime(data?.curr_time ?? payload.curr_time);
  const rows = ['UP','DOWN'].flatMap(direction => (Array.isArray(data?.[direction]) ? data[direction] : []).filter(r => r.valid === 'Y' && Number.isFinite(hkTime(r.time))).map(r => ({ direction, dest: r.dest, platform: String(r.plat), arrival: hkTime(r.time), seq: String(r.seq) })));
  return { line, station, received: now, stamp, rows, ok: payload.status === 1 && Boolean(data) && Number.isFinite(stamp), delay: payload.isdelay === 'Y', message: String(payload.message || 'No arrival data') };
}
export function isFresh(board, now = Date.now()) { return board?.ok && !board.error && Number.isFinite(board.stamp) && now - board.stamp <= FRESH_MS && board.stamp - now < 60_000; }
export function estimates(boards, now = Date.now()) {
  const result = [];
  for(const board of boards.values()) {
    if(!isFresh(board, now)) continue;
    for(const direction of ['UP','DOWN']) {
      const row = board.rows.filter(r => r.direction === direction && r.arrival >= now).sort((a,b) => a.arrival-b.arrival)[0];
      if(!row) continue;
      const from = incomingStation(board.line, board.station, row.dest);
      if(!from) continue;
      const duration = segmentSeconds(board.line, from, board.station), remaining = (row.arrival-now)/1000;
      if(remaining > duration) continue;
      result.push({ ...row, key: `${board.line}-${board.station}-${direction}`, line: board.line, from, to: board.station, progress: 1-remaining/duration });
    }
  }
  return result;
}
export class LiveNetwork {
  boards = new Map(); busy = false; lastCycle = 0; backoff = 0;
  constructor(onChange, fetcher = (...args) => globalThis.fetch(...args)) { this.onChange = onChange; this.fetcher = fetcher; }
  async refresh(priority = 'ADM') {
    if(this.busy || Date.now() < this.backoff) return;
    this.busy = true;
    const jobs = lines.flatMap(line => line.stations.map(station => ({ line: line.id, station }))).sort((a,b) => Number(b.station === priority)-Number(a.station === priority));
    const worker = async () => {
      while(jobs.length && Date.now() >= this.backoff) {
        const {line, station} = jobs.shift(), key = `${line}-${station}`;
        try {
          const response = await this.fetcher(`${API}?line=${line}&sta=${station}&lang=EN`, { signal: AbortSignal.timeout(12_000), cache: 'no-store' });
          if(response.status === 429) { this.backoff = Date.now() + 60_000; throw new Error('Rate limited; retrying in one minute'); }
          if(!response.ok) throw new Error(`Arrival service returned ${response.status}`);
          this.boards.set(key, normalize(await response.json(), line, station));
        } catch(error) { this.boards.set(key, { ...this.boards.get(key), line, station, error: error.message, received: Date.now(), rows: this.boards.get(key)?.rows ?? [] }); }
        this.onChange(this);
      }
    };
    try { await Promise.all(Array.from({length: 6}, worker)); }
    finally { this.busy = false; this.lastCycle = Date.now(); this.onChange(this); }
  }
}
