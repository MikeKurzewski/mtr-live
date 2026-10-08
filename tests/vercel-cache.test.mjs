import test from 'node:test';
import assert from 'node:assert/strict';
import {createSnapshotReader,collectSnapshot} from '../server/vercel-cache.mjs';
const feeds=[{line:'ISL',station:'ADM'},{line:'ISL',station:'CEN'}];
const payload={status:1,curr_time:'2026-10-08 12:00:00',data:{'ISL-ADM':{curr_time:'2026-10-08 12:00:00'}}};
test('concurrent readers share a refresh and new instances reuse stored snapshots',async()=>{
  let now=100000,calls=0;
  const values=new Map(),store={get:async k=>values.get(k),set:async(k,v)=>values.set(k,v)};
  const options={feeds,clock:()=>now,fetcher:async()=>{calls++;return {ok:true,json:async()=>payload};}};
  const read=createSnapshotReader(store,options);
  const results=await Promise.all(Array.from({length:50},()=>read()));
  assert.equal(calls,2);assert.ok(results.every(r=>r===results[0]));
  await createSnapshotReader(store,options)();assert.equal(calls,2);
  now+=12001;await read();assert.equal(calls,4);
});
test('429 backoff survives instance replacement and prevents further upstream work',async()=>{
  let calls=0;
  const first=await collectSnapshot({feeds,clock:()=>100000,fetcher:async()=>{calls++;return {status:429,headers:{get:()=> '120'}};}});
  assert.equal(first.backoffUntil,220000);
  const read=createSnapshotReader({get:async()=>first,set:async()=>assert.fail('no write needed')},{clock:()=>110000,fetcher:async()=>assert.fail('must not fetch')});
  assert.equal(await read(),first);assert.equal(calls,2);
});
test('shared-store failures fail closed instead of fetching for every visitor',async()=>{
  const read=createSnapshotReader({get:async()=>{throw Error('store offline');}},{fetcher:async()=>assert.fail('must not fetch')});
  await assert.rejects(read(),/store offline/);
});
test('refresh deadline bounds pending work and preserves old timestamps',async()=>{
  let now=100000;
  const previous={boards:[{line:'ISL',station:'OLD',stamp:1,received:1,rows:[]}]};
  const result=await collectSnapshot({previous,feeds:Array.from({length:20},(_,i)=>({line:'ISL',station:String(i)})),clock:()=>now,budgetMs:10,fetcher:async()=>{now+=20;return {ok:true,json:async()=>payload};}});
  assert.ok(result.boards.length<21);assert.equal(result.boards.find(b=>b.station==='OLD').stamp,1);
});
