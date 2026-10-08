import test from 'node:test';
import assert from 'node:assert/strict';
import { lines,stations } from '../src/network.js';
import { project,coastPaths,segmentGeometry,pointAlong } from '../src/geography.js';
test('All 98 stations have geographic coordinates and fit in the network view',()=>{
  assert.equal(Object.keys(stations).length,98);
  for(const s of Object.values(stations)){
    assert.ok(s.longitude>113.8&&s.longitude<114.4,s.id);
    assert.ok(s.latitude>22.2&&s.latitude<22.6,s.id);
    assert.ok(s.x>0&&s.x<1540&&s.y>0&&s.y<1100,s.id);
  }
});
test('All supported station pairs follow geographic curves with exact endpoints in both directions',()=>{
  for(const line of lines)for(const route of line.routes)for(let i=1;i<route.length;i++){
    const a=route[i-1],b=route[i],geometry=segmentGeometry(line.id,a,b);
    assert.ok(geometry.points.length>=2);assert.ok(geometry.length>0);
    for(const [from,to]of [[a,b],[b,a]]){
      const begin=pointAlong(geometry,from,0),end=pointAlong(geometry,from,1);
      assert.ok(Math.hypot(begin.x-stations[from].x,begin.y-stations[from].y)<.001,`${line.id}-${from}`);
      assert.ok(Math.hypot(end.x-stations[to].x,end.y-stations[to].y)<.001,`${line.id}-${to}`);
      for(const p of [0,.25,.5,.75,1]){const point=pointAlong(geometry,from,p);assert.ok(Number.isFinite(point.angle));}
    }
  }
});
test('Projection preserves geographic ordering and coastline geometry is bundled',()=>{
  assert.ok(stations.AIR.x<stations.CEN.x&&stations.CEN.x<stations.TKO.x);
  assert.ok(stations.LOW.y<stations.TAW.y&&stations.TAW.y<stations.ADM.y);
  assert.ok(project([114.1,22.3]).y>project([114.1,22.4]).y);
  assert.ok(coastPaths.length>10);assert.ok(coastPaths.every(p=>p.startsWith('M')&&!p.includes('NaN')));
});
