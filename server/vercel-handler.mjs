import { getCache } from '@vercel/functions';
import { createSnapshotReader } from './vercel-cache.mjs';

const read=createSnapshotReader(getCache({namespace:'mtr-live-network-v1'}));
export default async function handler(req,res){
  if(!['GET','HEAD'].includes(req.method)){
    res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return;
  }
  try{
    const snapshot=await read();
    res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=0, must-revalidate','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:JSON.stringify(snapshot));
  }catch(error){
    console.error('Shared MTR cache failed:',error.message);
    // Do not bypass the shared store by contacting MTR per visitor on failure.
    res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify({error:'Shared arrival cache temporarily unavailable'}));
  }
}
