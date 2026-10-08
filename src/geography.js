import { stationCoordinates, railSegments, landPolygons } from './data/geography.js';
const mercator = latitude => Math.log(Math.tan(Math.PI/4 + latitude*Math.PI/360))*180/Math.PI;
export function project([longitude, latitude]) {
  return { x:770+(longitude-114.10)*3000, y:35+(mercator(22.565)-mercator(latitude))*3000 };
}
export const geographicStations = Object.fromEntries(Object.entries(stationCoordinates).map(([id,coordinate])=>[id,{...project(coordinate),longitude:coordinate[0],latitude:coordinate[1]}]));
export const coastPaths = landPolygons.map(polygon=>polygon.map(ring=>ring.map((p,i)=>{const q=project(p);return `${i?'L':'M'}${q.x.toFixed(2)} ${q.y.toFixed(2)}`;}).join(' ')+'Z').join(' '));
export function segmentGeometry(line,a,b,offset=0) {
  const pair=[a,b].sort(),coordinates=railSegments[`${line}-${pair.join('-')}`];
  if(!coordinates) throw Error(`Missing geographic rail geometry: ${line}-${a}-${b}`);
  let points=coordinates.map(project);
  if(offset) points=points.map((p,i)=>{
    const before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)],dx=after.x-before.x,dy=after.y-before.y,length=Math.hypot(dx,dy)||1;
    const taper=Math.min(1,i/3,(points.length-1-i)/3);
    return {x:p.x-dy/length*offset*taper,y:p.y+dx/length*offset*taper};
  });
  const distances=[0];for(let i=1;i<points.length;i++)distances.push(distances[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
  return { points,distances,length:distances.at(-1),start:pair[0],d:points.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') };
}
export function pointAlong(geometry,from,progress) {
  const forward=from===geometry.start,target=geometry.length*(forward?progress:1-progress);
  let i=1;while(i<geometry.distances.length-1&&geometry.distances[i]<target)i++;
  const a=geometry.points[i-1],b=geometry.points[i],span=geometry.distances[i]-geometry.distances[i-1],fraction=span?(target-geometry.distances[i-1])/span:0;
  return { x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction,angle:Math.atan2((b.y-a.y)*(forward?1:-1),(b.x-a.x)*(forward?1:-1))*180/Math.PI };
}
