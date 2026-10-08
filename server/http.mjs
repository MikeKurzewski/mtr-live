import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve,extname,sep } from 'node:path';
import { gzipSync } from 'node:zlib';
export function createAppServer(cache,{root=resolve('.')}={}){
  root=resolve(root);
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
  const epoch=Date.now().toString(36);
  let encodedVersion=-1,json,gzip,etag;
  return http.createServer({requestTimeout:15000,headersTimeout:10000},async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Permissions-Policy','geolocation=(self)');
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{'Allow':'GET, HEAD'}).end();return;}
    try{
      const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if(path.includes('\\')||path.includes('\0')){res.writeHead(400).end();return;}
      if(path==='/api/network'){
        if(encodedVersion!==cache.version){encodedVersion=cache.version;json=Buffer.from(JSON.stringify(cache.snapshot()));gzip=gzipSync(json);etag=`"mtr-${epoch}-${cache.version}"`;}
        res.setHeader('Cache-Control','private, no-cache');res.setHeader('ETag',etag);res.setHeader('Vary','Accept-Encoding');
        if(req.headers['if-none-match']===etag){res.writeHead(304).end();return;}
        const compressed=/\bgzip\b/.test(req.headers['accept-encoding']??'');if(compressed)res.setHeader('Content-Encoding','gzip');
        res.setHeader('Content-Type','application/json; charset=utf-8');res.writeHead(200).end(req.method==='HEAD'?undefined:compressed?gzip:json);return;
      }
      if(path==='/healthz'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(req.method==='HEAD'?undefined:JSON.stringify({status:'ok',feeds:cache.boards.size,total:cache.jobs.length}));return;}
      if(!['/','/index.html','/favicon.svg'].includes(path)&&!path.startsWith('/src/')){res.writeHead(404).end();return;}
      const file=resolve(root,'.'+(path==='/'?'/index.html':path));
      if(!file.startsWith(root+sep)||!types[extname(file)]||path.split('/').some(s=>s.startsWith('.'))){res.writeHead(403).end();return;}
      const body=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)],'Cache-Control':'no-cache'}).end(req.method==='HEAD'?undefined:body);
    }catch{res.writeHead(404).end('Not found');}
  });
}
