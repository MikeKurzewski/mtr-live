import test from 'node:test';
import assert from 'node:assert/strict';
import { stations } from '../src/network.js';
import { nearestStation,distanceMetres,locationDescription,locationError } from '../src/location.js';
test('Every station resolves to itself from its geographic coordinates',()=>{
  for(const s of Object.values(stations))assert.equal(nearestStation(s).station.id,s.id);
});
test('Nearby coordinates select Admiralty and distance is measured in metres',()=>{
  const result=nearestStation({latitude:stations.ADM.latitude+.0001,longitude:stations.ADM.longitude});
  assert.equal(result.station.id,'ADM');assert.ok(result.distance>10&&result.distance<12);
  assert.ok(distanceMetres(51.5,-.1,stations.ADM)>9000000);
});
test('Invalid locations are rejected',()=>{
  for(const coords of [null,{}, {latitude:NaN,longitude:114},{latitude:91,longitude:114},{latitude:22,longitude:181}])assert.throws(()=>nearestStation(coords));
});
test('Location descriptions distinguish nearest station from confirmed presence and expose uncertainty',()=>{
  const nearest={station:stations.ADM,distance:2500};
  assert.match(locationDescription(nearest,1500),/2.5 km.*straight line.*accuracy.*1500 m/);
  assert.match(locationError({code:1}),/denied/);assert.match(locationError({code:3}),/timed out/);
});
