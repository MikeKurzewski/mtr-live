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
      result.push({ ...row, key: `${board.line}-${board.station}-${direction}`, line: board.line, from, to: board.station, duration, delay: board.delay, progress: 1-remaining/duration });
    }
  }
  return result;
}
export class LiveNetwork {
  boards=new Map();busy=false;lastCycle=0;backoff=0;etag=null;error=null;serverBackoff=0;warming=true;
  constructor(onChange,fetcher=(...args)=>globalThis.fetch(...args)){this.onChange=onChange;this.fetcher=fetcher;}
  async refresh(){
    if(this.busy)return;
    this.busy=true;
    try{
      const response=await this.fetcher('/api/network',{signal:AbortSignal.timeout(55000),cache:'no-store',headers:this.etag?{'If-None-Match':this.etag}:{}});
      if(response.status!==304){
        if(!response.ok)throw Error(`Shared cache returned HTTP ${response.status}`);
        const snapshot=await response.json();
        if(!Array.isArray(snapshot.boards)||snapshot.refreshMs!==12000)throw Error('Invalid shared cache response');
        const next=new Map();
        for(const board of snapshot.boards){
          if(!lines.some(l=>l.id===board.line&&l.stations.includes(board.station))||!Array.isArray(board.rows))throw Error('Invalid station board');
          const key=`${board.line}-${board.station}`,previous=this.boards.get(key);
          next.set(key,previous&&previous.received===board.received&&previous.error===board.error?previous:board);
        }
        this.boards=next;this.warming=next.size<snapshot.total;this.serverBackoff=snapshot.backoffUntil||0;
        this.etag=response.headers?.get('etag')||null;
      }
      this.error=null;
    }catch(error){this.error='Shared cache is unreachable. Retaining recent arrivals until they expire.';}
    finally{this.busy=false;this.lastCycle=Date.now();this.onChange(this);}
  }
}
