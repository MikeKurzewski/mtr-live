import { lines } from '../src/network.js';
import { API, normalize } from '../src/live.js';
export const REFRESH_MS=12_000;
export const FEEDS=lines.flatMap(line=>line.stations.map(station=>({line:line.id,station})));
export function retryDelay(value,now){
  if(!value)return 60_000;
  const seconds=Number(value),delay=Number.isFinite(seconds)?seconds*1000:Date.parse(value)-now;
  return Number.isFinite(delay)?Math.max(60_000,delay):60_000;
}
// One scheduler per server process. Visitors only read the resulting snapshot.
export class SharedCache {
  constructor({fetcher=(...args)=>fetch(...args),clock=Date.now,feeds=FEEDS,concurrency=6}={}){
    this.fetcher=fetcher;this.clock=clock;this.concurrency=concurrency;
    const now=clock();this.jobs=feeds.map((feed,i)=>({...feed,next:now+i*REFRESH_MS/feeds.length,inFlight:false}));
    this.boards=new Map();this.active=0;this.version=0;this.backoffUntil=0;this.rateLimits=0;
    this.requests=0;this.timer=null;this.controllers=new Set();this.stopped=false;
  }
  start(){this.stopped=false;this.tick();this.timer=setInterval(()=>this.tick(),100);return this;}
  stop(){this.stopped=true;clearInterval(this.timer);for(const c of this.controllers)c.abort();}
  tick(){
    const now=this.clock();if(this.stopped||now<this.backoffUntil)return;
    const due=this.jobs.filter(j=>!j.inFlight&&j.next<=now).sort((a,b)=>a.next-b.next);
    for(const job of due){if(this.active>=this.concurrency)break;void this.fetchJob(job);}
  }
  async fetchJob(job){
    job.inFlight=true;job.next=this.clock()+REFRESH_MS;this.active++;this.requests++;
    const controller=new AbortController();this.controllers.add(controller);
    const timeout=setTimeout(()=>controller.abort(),8000),key=`${job.line}-${job.station}`;
    try{
      const response=await this.fetcher(`${API}?line=${job.line}&sta=${job.station}&lang=EN`,{signal:controller.signal});
      if(response.status===429){
        this.rateLimits++;
        const delay=Math.max(retryDelay(response.headers?.get('retry-after'),this.clock()),Math.min(900_000,60_000*2**Math.min(this.rateLimits-1,4)));
        this.backoffUntil=Math.max(this.backoffUntil,this.clock()+delay);
        this.jobs.forEach((j,i)=>{j.next=this.backoffUntil+i*REFRESH_MS/this.jobs.length;});
        throw Error('MTR rate limited requests; shared cache is backing off.');
      }
      if(!response.ok)throw Error(`MTR returned HTTP ${response.status}`);
      this.boards.set(key,normalize(await response.json(),job.line,job.station,this.clock()));
      if(this.clock()>this.backoffUntil+REFRESH_MS)this.rateLimits=0;
    }catch(error){
      if(!this.stopped)this.boards.set(key,{...this.boards.get(key),line:job.line,station:job.station,rows:this.boards.get(key)?.rows??[],error:error.name==='AbortError'?'MTR request timed out.':error.message,received:this.clock()});
    }finally{clearTimeout(timeout);this.controllers.delete(controller);job.inFlight=false;this.active--;this.version++;}
  }
  snapshot(){return {version:this.version,refreshMs:REFRESH_MS,total:this.jobs.length,backoffUntil:this.backoffUntil,boards:[...this.boards.values()]};}
}
