import test from 'node:test';
import assert from 'node:assert/strict';
import { SharedCache,retryDelay } from '../server/cache.mjs';
import { createAppServer } from '../server/http.mjs';
const feeds=[{line:'ISL',station:'ADM'},{line:'ISL',station:'CEN'}];
const success=async()=>({status:200,ok:true,json:async()=>({status:1,data:{}})});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('Feeds are staggered and each is fetched no more often than every 12 seconds',async()=>{
  let now=0;const cache=new SharedCache({clock:()=>now,feeds,fetcher:success});
  cache.tick();await flush();assert.equal(cache.requests,1);
  now=5999;cache.tick();assert.equal(cache.requests,1);
  now=6000;cache.tick();await flush();assert.equal(cache.requests,2);
  now=11999;cache.tick();assert.equal(cache.requests,2);
  now=12000;cache.tick();await flush();assert.equal(cache.requests,3);cache.stop();
});
test('Slow upstream requests cannot overlap for the same station and concurrency is bounded',async()=>{
  let now=0,release;const gate=new Promise(r=>release=r);
  const cache=new SharedCache({clock:()=>now,feeds,concurrency:1,fetcher:async()=>{await gate;return success();}});
  cache.tick();now=30000;cache.tick();assert.equal(cache.requests,1);assert.equal(cache.active,1);
  release();await flush();cache.tick();await flush();assert.equal(cache.requests,2);cache.stop();
});
test('HTTP 429 pauses the entire cache and respects Retry-After',async()=>{
  let now=0;const cache=new SharedCache({clock:()=>now,feeds,fetcher:async()=>({status:429,headers:new Headers({'Retry-After':'120'})})});
  cache.tick();await flush();assert.equal(cache.backoffUntil,120000);now=119999;cache.tick();assert.equal(cache.requests,1);cache.stop();
  assert.equal(retryDelay('garbage',0),60000);assert.equal(retryDelay('Thu, 01 Jan 1970 00:02:00 GMT',0),120000);
});
test('Upstream failures retain the original timestamp but mark old boards unavailable',async()=>{
  let now=0;const cache=new SharedCache({clock:()=>now,feeds:[feeds[0]],fetcher:async()=>{throw Error('offline');}});
  cache.boards.set('ISL-ADM',{ok:true,stamp:123,rows:[{dest:'CHW'}]});cache.tick();await flush();
  const board=cache.boards.get('ISL-ADM');assert.equal(board.stamp,123);assert.equal(board.rows[0].dest,'CHW');assert.equal(board.error,'offline');cache.stop();
});
test('Many HTTP readers share one cache, support ETags, and cannot trigger upstream refreshes',async()=>{
  const cache=new SharedCache({feeds,fetcher:success});const server=createAppServer(cache);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}`;
  try{
    const results=await Promise.all(Array.from({length:40},()=>fetch(url+'/api/network')));
    assert.ok(results.every(r=>r.ok));assert.equal(cache.requests,0);
    const first=results[0],etag=first.headers.get('etag');assert.equal(first.headers.get('content-encoding'),'gzip');assert.equal((await first.json()).refreshMs,12000);
    assert.equal((await fetch(url+'/api/network',{headers:{'If-None-Match':etag}})).status,304);
    assert.equal((await fetch(url+'/server/cache.mjs')).status,404);
    assert.equal((await fetch(url+'/api/network',{method:'POST'})).status,405);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));cache.stop();}
});
