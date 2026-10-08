import { SharedCache, FEEDS, REFRESH_MS } from './cache.mjs';

// Bounded refresh work: no timers or polling continue after the invocation.
export async function collectSnapshot({previous, fetcher, clock=Date.now, feeds=FEEDS, budgetMs=40_000}={}) {
  const cache=new SharedCache({fetcher,clock,feeds});
  cache.boards=new Map((previous?.boards??[]).map(b=>[`${b.line}-${b.station}`,b]));
  cache.backoffUntil=previous?.backoffUntil??0;
  cache.rateLimits=previous?.rateLimits??0;
  if(clock()<cache.backoffUntil)return previous;
  const deadline=clock()+budgetMs;
  let index=0;
  async function worker(){
    while(index<cache.jobs.length&&clock()<deadline&&clock()>=cache.backoffUntil){
      const job=cache.jobs[index++];
      await cache.fetchJob(job);
    }
  }
  await Promise.all(Array.from({length:6},worker));
  // Missing boards remain missing; original timestamps still govern freshness.
  return {...cache.snapshot(),version:clock(),completedAt:clock(),rateLimits:cache.rateLimits};
}

export function createSnapshotReader(store,options={}) {
  let pending;
  return function read(){
    if(pending)return pending;
    pending=(async()=>{
      const previous=await store.get('snapshot-v1');
      const now=(options.clock??Date.now)();
      if(previous&&(now<previous.backoffUntil||now-previous.completedAt<REFRESH_MS))return previous;
      const snapshot=await collectSnapshot({...options,previous});
      await store.set('snapshot-v1',snapshot,{ttl:86400});
      return snapshot;
    })().finally(()=>{pending=null;});
    return pending;
  };
}
