import test from 'node:test';
import assert from 'node:assert/strict';
import { TrainMotion } from '../src/motion.js';

const start = Date.parse('2026-10-08T12:00:00+08:00');
function board(seconds = 60, extra = {}) {
  return { line:'ISL',station:'ADM',ok:true,stamp:start,delay:false,
    rows:[{arrival:start + seconds*1000,direction:'UP',dest:'CHW',platform:'3',seq:'1'}],...extra };
}
const wrap = b => new Map([['ISL-ADM',b]]);
function advance(motion, boards, from, seconds) {
  let result, pulses=[];
  for(let t=0;t<seconds;t+=1/60) { result=motion.step(boards,from+t*1000,1/60);pulses.push(...result.arrivals); }
  return {...result,pulses};
}
test('A later ETA retains position and identity and smoothly reduces speed',()=>{
  const m=new TrainMotion(),boards=wrap(board());
  advance(m,boards,start,10);
  const before={...[...m.tracks.values()][0]};
  boards.set('ISL-ADM',board(90,{stamp:start+10000,delay:true}));
  const current=m.step(boards,start+10000,0).trains[0];
  assert.equal(current.key,before.key);assert.equal(current.progress,before.progress);assert.equal(current.speed,before.speed);assert.equal(current.delay,true);
  advance(m,boards,start+10000,5);
  assert.ok(current.progress>before.progress);assert.ok(current.speed<before.speed);
});
test('Earlier ETAs accelerate continuously without snapping or going backwards',()=>{
  const m=new TrainMotion(),boards=wrap(board());advance(m,boards,start,5);
  const before={...[...m.tracks.values()][0]};boards.set('ISL-ADM',board(30,{stamp:start+5000}));
  const t=m.step(boards,start+5000,1/60).trains[0];
  assert.equal(t.key,before.key);assert.ok(t.progress>=before.progress);assert.ok(t.progress-before.progress<0.001);
  advance(m,boards,start+5000,2);assert.ok(t.speed>before.speed);
});
test('Following trains have distinct markers; an old marker never rewinds on rollover',()=>{
  const m=new TrainMotion(),first=board(30),second={...first.rows[0],arrival:start+150000,seq:'2'};
  const boards=wrap({...first,rows:[first.rows[0],second]});advance(m,boards,start,2);
  const old=[...m.tracks.values()][0],position=old.progress;
  boards.set('ISL-ADM',board(150,{stamp:start+20000}));
  m.step(boards,start+20000,1/60);
  assert.equal(old.retiring,true);assert.equal(old.progress,position);
  assert.ok([...m.tracks.values()].some(t=>t.key!==old.key&&!t.retiring));
});
test('Arrival pulses once, dwells briefly, then fades out without respawning',()=>{
  const m=new TrainMotion(),boards=wrap(board(2));
  const result=advance(m,boards,start,5);
  assert.equal(result.pulses.length,1);assert.equal(result.pulses[0].station,'ADM');assert.ok(result.trains[0].stopped);
  const end=advance(m,boards,start+5000,10);assert.equal(end.trains.length,0);assert.equal(end.pulses.length,0);
  boards.set('ISL-ADM',board(2,{stamp:start+15000}));assert.equal(m.step(boards,start+15000,1/60).trains.length,0);
});
test('Pause holds position and suppresses arrival pulses',()=>{
  const m=new TrainMotion(),boards=wrap(board(2));const first=m.step(boards,start,0).trains[0],p=first.progress;
  const result=m.step(boards,start+3000,3,true);assert.equal(first.progress,p);assert.equal(result.arrivals.length,0);
});
test('Stale or failed feeds fade without generating false station arrivals',()=>{
  const m=new TrainMotion(),boards=wrap(board());advance(m,boards,start,2);
  boards.set('ISL-ADM',board(60,{error:'offline'}));
  const result=advance(m,boards,start+2000,1);assert.equal(result.trains.length,0);assert.equal(result.pulses.length,0);
});
test('Long frame gaps cannot teleport a marker to its station',()=>{
  const m=new TrainMotion(),boards=wrap(board());const t=m.step(boards,start,0).trains[0],p=t.progress;
  m.step(boards,start+70000,70);assert.ok(t.progress-p<0.01);assert.equal(t.stopped,false);
});
