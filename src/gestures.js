// SVG uses xMidYMid meet: account for the empty margins on tall phone screens.
export function gestureView(start, bounds, origin, current, ratio=1) {
  const w=Math.min(2000,Math.max(180,start.w/ratio)),h=w*1100/1540;
  const oldScale=Math.min(bounds.width/start.w,bounds.height/start.h);
  const scale=Math.min(bounds.width/w,bounds.height/h);
  const offset=(point,width,height,s)=>({
    x:(point.x-bounds.left-(bounds.width-width*s)/2)/s,
    y:(point.y-bounds.top-(bounds.height-height*s)/2)/s
  });
  const before=offset(origin,start.w,start.h,oldScale),after=offset(current,w,h,scale);
  return {x:start.x+before.x-after.x,y:start.y+before.y-after.y,w,h};
}

export function attachMapGestures(map,getView,setView,onDrag){
  const pointers=new Map();let baseline=null,moved=false;
  const geometry=()=>{
    const [a,b]=[...pointers.values()];
    return b?{center:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},distance:Math.hypot(a.x-b.x,a.y-b.y)}:{center:a,distance:0};
  };
  function rebase(){baseline=pointers.size?{...geometry(),view:{...getView()},bounds:map.getBoundingClientRect()}:null;}
  function capture(){for(const id of pointers.keys())if(!map.hasPointerCapture(id))map.setPointerCapture(id);}
  map.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    if(!pointers.size){moved=false;onDrag(false);}
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size>1){moved=true;onDrag(true);capture();}
    rebase();
  });
  map.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId)||!baseline)return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    const next=geometry();
    if(!moved&&Math.hypot(next.center.x-baseline.center.x,next.center.y-baseline.center.y)<4)return;
    moved=true;onDrag(true);capture();
    const ratio=baseline.distance>2&&next.distance>2?next.distance/baseline.distance:1;
    setView(gestureView(baseline.view,baseline.bounds,baseline.center,next.center,ratio));
  });
  function release(e){
    if(!pointers.delete(e.pointerId))return;
    if(map.hasPointerCapture(e.pointerId))map.releasePointerCapture(e.pointerId);
    rebase(); // Remaining finger continues panning without a jump.
  }
  for(const type of ['pointerup','pointercancel','lostpointercapture'])map.addEventListener(type,release);
  map.addEventListener('click',e=>{if(moved&&e.detail!==0){e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
}
