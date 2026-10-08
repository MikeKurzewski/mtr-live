import test from 'node:test';
import assert from 'node:assert/strict';
import { lines, stations, incomingStation, pathTo } from '../src/network.js';
import { normalize, hkTime, estimates, isFresh, LiveNetwork } from '../src/live.js';
const now=Date.parse('2026-10-08T12:00:00+08:00');
function payload(overrides={}) {return {status:1,isdelay:'N',data:{'ISL-ADM':{curr_time:'2026-10-08 12:00:00',UP:[{valid:'Y',time:'2026-10-08 12:01:00',dest:'CHW',plat:'3',seq:'1'}]}},...overrides};}
test('Hong Kong timestamps are parsed with an explicit UTC+8 offset',()=>{assert.equal(hkTime('2026-10-08 12:00:00'),now);assert.ok(Number.isNaN(hkTime('-')));});
test('Every line station exists, is unique within its index, and connects to every other station',()=>{for(const line of lines){assert.equal(line.stations.length,new Set(line.stations).size);for(const station of line.stations){assert.ok(stations[station]);assert.ok(pathTo(line.id,line.stations[0],station));}}assert.equal(lines.length,10);});
test('Directional estimates select the segment behind an arrival',()=>{assert.equal(incomingStation('ISL','ADM','CHW'),'CEN');assert.equal(incomingStation('ISL','ADM','KET'),'WAC');assert.equal(incomingStation('ISL','CHW','CHW'),'HFC');assert.equal(incomingStation('ISL','KET','CHW'),null);});
test('Ambiguous branch approaches and unknown destinations are not fabricated',()=>{assert.equal(incomingStation('EAL','SHS','LOW'),null);assert.equal(incomingStation('TKL','TKO','POA'),null);assert.equal(incomingStation('EAL','RAC','ADM'),null);assert.equal(incomingStation('ISL','ADM','XXX'),null);});
test('Positions advance towards an arrival and disappear after it',()=>{const board=normalize(payload(),'ISL','ADM',now),boards=new Map([['ISL-ADM',board]]);const first=estimates(boards,now);assert.equal(first.length,1);assert.equal(first[0].from,'CEN');assert.ok(estimates(boards,now+30000)[0].progress>first[0].progress);assert.equal(estimates(boards,now+61000).length,0);});
test('Stale, invalid, errored, future-clock, or suspended feeds never animate',()=>{const board=normalize(payload(),'ISL','ADM',now);assert.equal(isFresh(board,now+91000),false);assert.equal(isFresh({...board,stamp:now+120000},now),false);for(const b of [{...board,error:'offline'},normalize(payload({status:0}),'ISL','ADM',now),normalize(payload({data:{}}),'ISL','ADM',now)])assert.equal(estimates(new Map([['x',b]]),now).length,0);});
test('Invalid predictions are filtered without hiding a valid board',()=>{const p=payload();p.data['ISL-ADM'].UP[0].valid='N';const b=normalize(p,'ISL','ADM',now);assert.equal(b.ok,true);assert.equal(b.rows.length,0);});
test('Empty overnight boards are preserved without imaginary trains',()=>{const p=payload();p.data['ISL-ADM'].UP=[];const b=normalize(p,'ISL','ADM',now);assert.equal(estimates(new Map([['x',b]]),now).length,0);});
test('Browser fetches one shared snapshot and preserves unchanged board identity',async()=>{
  let calls=0;const board=normalize(payload(),'ISL','ADM',now);
  const client=new LiveNetwork(()=>{},async url=>{assert.equal(url,'/api/network');calls++;return {ok:true,status:200,json:async()=>({refreshMs:12000,total:1,boards:[structuredClone(board)]})};});
  await client.refresh();const first=client.boards.get('ISL-ADM');await client.refresh();assert.equal(client.boards.get('ISL-ADM'),first);assert.equal(calls,2);
});
test('Cache failures retain timestamped data and never fall back to MTR',async()=>{
  const client=new LiveNetwork(()=>{},async url=>{assert.equal(url,'/api/network');throw Error('offline');});
  const board=normalize(payload(),'ISL','ADM',now);client.boards.set('ISL-ADM',board);await client.refresh();
  assert.equal(client.boards.get('ISL-ADM'),board);assert.ok(client.error);assert.equal(isFresh(board,now+91000),false);
});
