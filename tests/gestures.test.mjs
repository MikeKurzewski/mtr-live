import test from 'node:test';
import assert from 'node:assert/strict';
import {gestureView,attachMapGestures} from '../src/gestures.js';
const initial={x:0,y:0,w:1540,h:1100};
const bounds={left:14,top:200,width:360,height:560};
test('pinch doubles zoom around the fingers, including SVG letterboxing',()=>{
  const center={x:194,y:480};
  const next=gestureView(initial,bounds,center,center,2);
  assert.equal(next.w,770);assert.equal(next.x,385);assert.equal(next.y,275);
  const shifted=gestureView(initial,bounds,center,{x:230,y:480},2);
  assert.ok(Math.abs(shifted.x-(385-77))<1e-8);
  assert.equal(gestureView(initial,bounds,center,center,100).w,180);
});
test('pinch can transition to one-finger panning and cancel cleanly',()=>{
  const events={},captured=new Set();let view={...initial},dragged=false;
  const map={addEventListener:(t,f)=>events[t]=f,getBoundingClientRect:()=>bounds,
    hasPointerCapture:id=>captured.has(id),setPointerCapture:id=>captured.add(id),releasePointerCapture:id=>captured.delete(id)};
  attachMapGestures(map,()=>view,v=>view=v,v=>dragged=v);
  const send=(type,id,x,y)=>events[type]({pointerId:id,clientX:x,clientY:y,button:0});
  send('pointerdown',1,144,480);send('pointerdown',2,244,480);
  send('pointermove',1,94,480);send('pointermove',2,294,480);
  assert.equal(view.w,770);assert.equal(dragged,true);
  send('pointerup',2,294,480);const before={...view};
  send('pointermove',1,104,480);assert.equal(view.w,before.w);assert.ok(view.x<before.x);
  send('pointercancel',1,104,480);const after={...view};
  send('pointermove',1,200,480);assert.deepEqual(view,after);assert.equal(captured.size,0);
  send('pointerdown',3,150,400);assert.equal(dragged,false);
});
