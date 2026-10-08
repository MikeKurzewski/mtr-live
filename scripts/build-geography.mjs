// Rebuild the bundled map from the source files documented in DATA_SOURCES.md.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { stations, lines } from '../src/network.js';
const read = async file => JSON.parse(await readFile(`output/geodata/${file}`, 'utf8'));
const stops = (await read('routeFareList.json')).stopList;
stops.RAC = {location:{lng:114.202889,lat:22.400389}}; // Wikidata Q841864 (CC0).
const stationCoordinates = Object.fromEntries(Object.keys(stations).map(id => {
  if (!stops[id]) throw new Error(`Missing station coordinate: ${id}`);
  return [id,[stops[id].location.lng,stops[id].location.lat].map(n=>+n.toFixed(6))];
}));
const distance = (a,b) => Math.hypot((a[0]-b[0])*Math.cos(22.4*Math.PI/180),a[1]-b[1]);
const segments = {};
for(const line of lines) {
  const geo = await read(`${line.id.toLowerCase()}.json`);
  const paths = geo.features.flatMap(f=>f.geometry.type==='MultiLineString'?f.geometry.coordinates:[f.geometry.coordinates]);
  const points=[],edges=[];
  for(const path of paths) {
    const start=points.length;
    for(const point of path){points.push(point);edges.push([]);}
    for(let i=start+1;i<points.length;i++){edges[i-1].push(i);edges[i].push(i-1);}
  }
  // Join branch ends to the nearest point on another shape. Preserve the curves.
  let start=0;
  for(const path of paths){
    const end=start+path.length-1;
    for(const endpoint of [start,end]) {
      let nearest=-1,best=0.0015;
      for(let j=0;j<points.length;j++)if(j<start||j>end){const d=distance(points[endpoint],points[j]);if(d<best){best=d;nearest=j;}}
      if(nearest>=0){edges[endpoint].push(nearest);edges[nearest].push(endpoint);}
    }
    start=end+1;
  }
  const nearest = p => points.reduce((best,q,i)=>distance(p,q)<distance(p,points[best])?i:best,0);
  function route(a,b) {
    const source=nearest(a),target=nearest(b),cost=points.map(()=>Infinity),previous=[],seen=new Set();cost[source]=0;
    while(seen.size<points.length){
      let at=-1;for(let i=0;i<points.length;i++)if(!seen.has(i)&&(at<0||cost[i]<cost[at]))at=i;
      if(at===target)break;if(!Number.isFinite(cost[at]))throw Error(`Disconnected geometry: ${line.id}`);
      seen.add(at);for(const next of edges[at]){const candidate=cost[at]+distance(points[at],points[next]);if(candidate<cost[next]){cost[next]=candidate;previous[next]=at;}}
    }
    const path=[];for(let at=target;at!==undefined;at=previous[at])path.unshift(points[at]);
    if(distance(a,path[0])>.003||distance(b,path.at(-1))>.003)throw Error(`Station too far from ${line.id} geometry`);
    return [a,...path,b].filter((p,i,all)=>!i||distance(p,all[i-1])>.000001).map(p=>p.map(n=>+n.toFixed(6)));
  }
  for(const itinerary of line.routes)for(let i=1;i<itinerary.length;i++){
    const pair=[itinerary[i-1],itinerary[i]].sort();
    segments[`${line.id}-${pair.join('-')}`]=route(stationCoordinates[pair[0]],stationCoordinates[pair[1]]);
  }
}
// Sutherland-Hodgman clipping retains islands and polygon holes in this extent.
function clip(ring) {
  let points=ring;
  for(const [axis,bound,sign]of [[0,113.80,1],[0,114.40,-1],[1,22.18,1],[1,22.61,-1]]) {
    const output=[];
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],insideA=sign*(a[axis]-bound)>=0,insideB=sign*(b[axis]-bound)>=0;
      if(insideA)output.push(a);
      if(insideA!==insideB){const t=(bound-a[axis])/(b[axis]-a[axis]);output.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
    }
    points=output;
  }
  return points.map(p=>p.map(n=>+n.toFixed(6)));
}
const land=(await read('land.geojson')).features.flatMap(f=>f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates]).map(poly=>poly.map(clip).filter(r=>r.length>2)).filter(poly=>poly.length);
await mkdir('src/data',{recursive:true});
await writeFile('src/data/geography.js',`// Derived geographic data. Sources and licenses: DATA_SOURCES.md.\nexport const stationCoordinates=${JSON.stringify(stationCoordinates)};\nexport const railSegments=${JSON.stringify(segments)};\nexport const landPolygons=${JSON.stringify(land)};\n`);
console.log(`Generated ${Object.keys(stationCoordinates).length} stations, ${Object.keys(segments).length} rail segments, ${land.length} land polygons.`);
