import { stations, lines, byLine, stationLines, majorStations } from './network.js';
import { LiveNetwork, isFresh } from './live.js';
import { TrainMotion } from './motion.js';
import { coastPaths, project, segmentGeometry, pointAlong } from './geography.js';
import { nearestStation, locationDescription, locationError } from './location.js';
import { attachMapGestures, MIN_VIEW_WIDTH } from './gestures.js';
const $ = id => document.getElementById(id);
const ns = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}, parent) { const el = document.createElementNS(ns, tag); for(const [k,v] of Object.entries(attrs)) el.setAttribute(k,v); if(parent) parent.append(el); return el; }
function text(tag, content, className, parent) { const el = document.createElement(tag); el.textContent = content; if(className) el.className=className; if(parent) parent.append(el); return el; }
let selectedLine = null, selectedStation = 'ADM', paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let selectionRevision = 0;
let view = { x:0,y:0,w:1540,h:1100 }, dragged = false, lastRender = 0;
const motion = new TrainMotion();
const root = $('map-content'), lineGroups = new Map(), markerElements = new Map(), railGeometry = new Map();
const basemap=svg('g',{class:'geographic-basemap','aria-hidden':'true'},root);
for(const d of coastPaths)svg('path',{d,class:'coastline','fill-rule':'evenodd'},basemap);
for(const [label,longitude,latitude] of [['NEW TERRITORIES',114.06,22.465],['KOWLOON',114.205,22.342],['HONG KONG ISLAND',114.165,22.244],['LANTAU ISLAND',113.945,22.245]]) {
  const {x,y}=project([longitude,latitude]);svg('text',{x,y,class:'region-label'},basemap).textContent=label;
}
const harbour=project([114.10,22.305]);svg('text',{...harbour,class:'water-label'},basemap).textContent='VICTORIA HARBOUR';
const shared = new Map();
for(const line of lines) for(const route of line.routes) for(let i=1;i<route.length;i++) { const key=[route[i-1],route[i]].sort().join('-'); if(!shared.has(key)) shared.set(key,[]); if(!shared.get(key).includes(line.id)) shared.get(key).push(line.id); }
for(const line of lines) {
  const group=svg('g',{'data-line':line.id},root); lineGroups.set(line.id,group);
  for(const route of line.routes) for(let i=1;i<route.length;i++) {
    const a=stations[route[i-1]],b=stations[route[i]],pair=[a.id,b.id].sort(),key=pair.join('-'),members=shared.get(key),offset=(members.indexOf(line.id)-(members.length-1)/2)*4;
    const geometry=segmentGeometry(line.id,a.id,b.id,offset);railGeometry.set(`${line.id}-${key}`,geometry);
    svg('path',{d:geometry.d,stroke:line.color,'stroke-width':2.5,'vector-effect':'non-scaling-stroke',fill:'none',class:'line-edge',...(line.id==='EAL' && (a.id==='RAC'||b.id==='RAC') ? {'stroke-dasharray':'7 5'} : {})},group);
  }
}
// Walking interchanges are not rail segments.
for(const [a,b] of [['CEN','HOK'],['TST','ETS']]) svg('path',{d:`M${stations[a].x} ${stations[a].y}L${stations[b].x} ${stations[b].y}`,stroke:'#748a90','stroke-width':1.5,'vector-effect':'non-scaling-stroke','stroke-dasharray':'4 4'},root);
const pulseGroup=svg('g',{'aria-hidden':'true',class:'station-pulses'},root);
const stationGroup=svg('g',{},root), trainGroup=svg('g',{'aria-hidden':'true'},root);
const labelOverrides={};
for(const station of Object.values(stations)) {
  const serving=stationLines(station.id),major=majorStations.has(station.id),g=svg('g',{class:`station ${major?'major':'minor'}`,transform:`translate(${station.x} ${station.y})`,tabindex:0,role:'button','aria-label':`${station.name}, ${station.zh}, show arrivals`,'data-station':station.id},stationGroup);
  svg('circle',{r:14,fill:'transparent',stroke:'none'},g);
  svg('circle',{r:serving.length>1?7:3.8,fill:serving.length>1?'#172026':'#d8e3e5',stroke:serving.length>1?'#dce5e7':'#152026','stroke-width':serving.length>1?2.5:1.5},g);
  const [x,y,anchor]=labelOverrides[station.id]??[10,-10,'start'];
  svg('text',{x,y,'text-anchor':anchor},g).textContent=station.name;
  svg('title',{},g).textContent=`${station.name} ${station.zh}`;
  g.addEventListener('click',()=>{if(!dragged) selectStation(station.id);});
  g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectStation(station.id);}});
}
for(const line of lines) {
  const button=text('button','','line-button',$('line-index'));button.style.setProperty('--line',line.color);button.setAttribute('aria-pressed','false');button.dataset.line=line.id;
  text('span','','line-swatch',button);const copy=text('span',line.name,'line-copy',button);text('small',line.zh,'',copy);text('span',line.id,'line-code',button);
  button.addEventListener('click',()=>setLine(selectedLine===line.id?null:line.id));
}
function setLine(id) {
  selectedLine=id;
  document.querySelectorAll('.line-button').forEach(b=>{b.classList.toggle('active',b.dataset.line===id);b.setAttribute('aria-pressed',String(b.dataset.line===id));});
  for(const [line,g] of lineGroups) g.style.opacity=!id||id===line?'1':'.12';
  document.querySelectorAll('.station').forEach(g=>g.style.opacity=!id||byLine[id].stations.includes(g.dataset.station)?'1':'.15');
  $('map-title').replaceChildren(document.createTextNode(id?byLine[id].name:'Hong Kong ')); if(!id) text('span','香港','',$('map-title'));
  if(id && !byLine[id].stations.includes(selectedStation)) selectStation(byLine[id].stations[Math.floor(byLine[id].stations.length/2)]);
  renderArrivals();
  layoutLabels();
}
$('all-lines').addEventListener('click',()=>setLine(null));
function selectStation(id) {
  selectionRevision++;
  selectedStation=id;
  if(selectedLine && !byLine[selectedLine].stations.includes(id)) setLine(null);
  document.querySelectorAll('.station').forEach(g=>{g.classList.toggle('selected',g.dataset.station===id);g.querySelector('.selected-ring')?.remove();});
  svg('circle',{r:18,class:'selected-ring'},document.querySelector(`[data-station="${id}"]`));
  $('station-name').replaceChildren(document.createTextNode(stations[id].name+' '));text('span',stations[id].zh,'',$('station-name'));
  $('station-lines').replaceChildren(); for(const line of stationLines(id)) { const chip=text('span',line.name,'station-chip',$('station-lines'));chip.style.setProperty('--line',line.color); }
  renderArrivals();
  layoutLabels();
}
const network = new LiveNetwork(()=>{ if(Date.now()-lastRender>400){renderStatus();renderArrivals();lastRender=Date.now();} });
function renderArrivals() {
  const now=Date.now(),serving=stationLines(selectedStation).filter(l=>!selectedLine||l.id===selectedLine),boards=serving.map(l=>network.boards.get(`${l.id}-${selectedStation}`));
  const fresh=boards.filter(b=>isFresh(b,now));
  $('station-updated').textContent=fresh.length?`Updated ${new Date(Math.max(...fresh.map(b=>b.stamp))).toLocaleTimeString('en-GB',{timeZone:'Asia/Hong_Kong'})} HKT`:'No fresh arrival data';
  $('arrivals').replaceChildren();
  let entries=[];
  for(const board of fresh) for(const direction of ['UP','DOWN']) {
    entries.push(...board.rows.filter(r=>r.direction===direction&&r.arrival>=now-15000).sort((a,b)=>a.arrival-b.arrival).slice(0,2).map(row=>({...row,line:board.line,delay:board.delay})));
  }
  entries.sort((a,b)=>a.arrival-b.arrival);
  for(const row of entries) {
    const card=text('div','','arrival',$('arrivals'));card.style.setProperty('--line',byLine[row.line].color);
    const left=text('div','','',card);text('div',stations[row.dest]?.name??row.dest,'dest',left);text('small',`${row.line} · Platform ${row.platform}${row.delay?' · Delay reported':''}`,'',left);
    const remaining=Math.max(0,Math.ceil((row.arrival-now)/60000));const eta=text('div',remaining?String(remaining):'Due','eta',card);if(remaining) text('small','min','',eta);
  }
  if(!entries.length) text('p',network.busy&&!boards.some(Boolean)?'Connecting to MTR’s live arrival boards…':'No upcoming arrivals available for this station. Services may have ended, or the feed may be unavailable.','empty',$('arrivals'));
  const unavailable=serving.filter((l,i)=>!isFresh(boards[i],now));
  if(entries.length&&unavailable.length) text('p',`Arrival data unavailable: ${unavailable.map(l=>l.name).join(', ')}.`,'empty',$('arrivals'));
  const disruptions=boards.filter(b=>b&&!b.error&&(!b.ok||b.delay));
  for(const b of disruptions) if(b.message!=='successful'||b.delay) text('p',`${b.line}: ${b.delay?'MTR reports a delay. ':''}${b.message==='successful'?'':b.message}`,'empty',$('arrivals'));
}
function renderStatus() {
  const boards=[...network.boards.values()], fresh=boards.filter(b=>isFresh(b)),total=lines.reduce((n,l)=>n+l.stations.length,0);
  $('connection').classList.toggle('offline',fresh.length===0&&!network.busy);
  $('connection-label').textContent=network.busy&&!boards.length?'Connecting':fresh.length===total?'Live feed':fresh.length?'Partial live feed':network.busy?'Connecting':'Feed unavailable';
  $('coverage').textContent=`${fresh.length} / ${total} station feeds · 12s shared refresh`;
  const failed=boards.filter(b=>!isFresh(b)).length;
  $('notice').hidden=network.busy||(!failed&&fresh.length>0);
  $('notice').textContent=fresh.length===0?'Live arrivals are unavailable right now. The network map remains available; train estimates will return automatically when fresh data resumes.':`${failed} station feeds are unavailable or stale. Only fresh arrival data appears on the moving map.`;
  if(network.warming&&!network.error){$('connection-label').textContent='Warming shared cache';$('notice').hidden=true;}
  if(network.serverBackoff>Date.now()){$('notice').hidden=false;$('notice').textContent='MTR has limited requests. The shared cache will retry automatically; only recent arrivals remain visible.';}
  if(network.error){$('connection-label').textContent='Cache disconnected';$('connection').classList.add('offline');$('notice').hidden=false;$('notice').textContent=network.error;}
}
let lastFrame=0,lastStats=0;
function pulseStation(stationId, line) {
  if (paused || (selectedLine && selectedLine !== line)) return;
  const station = stations[stationId];
  // One quiet ring even when two arrivals at an interchange coincide.
  if (pulseGroup.querySelector(`[data-pulse-station="${stationId}"]`)) return;
  const ring = svg('circle', { cx:station.x, cy:station.y, r:7, class:'station-pulse',
    stroke:byLine[line].color, 'data-pulse-station':stationId }, pulseGroup);
  ring.addEventListener('animationend', () => ring.remove(), {once:true});
}
function animate(now) {
  requestAnimationFrame(animate);
  if(document.hidden){lastFrame=now;return;}
  const elapsed=lastFrame?(now-lastFrame)/1000:0;
  lastFrame=now;
  const {trains:items,arrivals}=motion.step(network.boards,Date.now(),elapsed,paused);
  for(const arrival of arrivals) pulseStation(arrival.station,arrival.line);
  const visible=items.filter(e=>!selectedLine||e.line===selectedLine),keys=new Set(visible.map(e=>e.key));
  for(const [key,el] of markerElements) if(!keys.has(key)){el.remove();markerElements.delete(key);}
  for(const item of visible) {
    let el=markerElements.get(item.key);
    if(!el) {
      el=svg('g',{class:'train-marker'},trainGroup);
      svg('rect',{x:-14,y:-6.5,width:28,height:13,rx:5,fill:byLine[item.line].color,class:'train-body'},el);
      svg('path',{d:'M-9 0H2M-1.5 -3.5L2 0L-1.5 3.5',class:'train-arrow'},el);
      svg('rect',{x:7,y:-3,width:3.5,height:6,rx:1.2,class:'train-light'},el);
      svg('title',{},el);el.addEventListener('click',()=>selectStation(item.to));markerElements.set(item.key,el);
    }
    el.classList.toggle('delayed',item.delay);
    el.classList.toggle('stopped',item.stopped);
    el.style.opacity=String(item.opacity);
    const b=stations[item.to],geometry=railGeometry.get(`${item.line}-${[item.from,item.to].sort().join('-')}`);
    const {x,y,angle}=pointAlong(geometry,item.from,item.progress);
    el.setAttribute('transform',`translate(${x} ${y}) rotate(${angle}) scale(${Math.max(.2,Math.min(.8,view.w/1800))})`);
    el.querySelector('title').textContent=`${byLine[item.line].name} → ${stations[item.dest]?.name??item.dest}; ${item.stopped?'at':'approaching'} ${b.name} (estimated)${item.delay?' · MTR reports a delay on this feed':''}`;
  }
  $('train-count').textContent=String(visible.length);
  if(now-lastStats>5000){renderStatus();renderArrivals();lastStats=now;}
}
$('pause').setAttribute('aria-pressed',String(paused));$('pause').setAttribute('aria-label',paused?'Resume train animation':'Pause train animation');$('pause').textContent=paused?'▷':'Ⅱ';
root.classList.toggle('motion-paused',paused);
$('pause').addEventListener('click',()=>{paused=!paused;root.classList.toggle('motion-paused',paused);$('pause').setAttribute('aria-pressed',String(paused));$('pause').setAttribute('aria-label',paused?'Resume train animation':'Pause train animation');$('pause').textContent=paused?'▷':'Ⅱ';});
function layoutLabels(){
  const scale=Math.max(.12,Math.min(1,view.w/1540)),occupied=[];
  const groups=[...document.querySelectorAll('.station')].sort((a,b)=>{
    const rank=g=>g.dataset.station===selectedStation?100:majorStations.has(g.dataset.station)?10:0;
    return rank(b)-rank(a);
  });
  for(const g of groups){
    const s=stations[g.dataset.station],label=g.querySelector('text'),important=s.id===selectedStation;
    g.setAttribute('transform',`translate(${s.x} ${s.y}) scale(${scale})`);
    label.style.display='block';label.style.visibility='hidden';
    if((selectedLine&&!byLine[selectedLine].stations.includes(s.id))||(!important&&!majorStations.has(s.id)&&view.w>850))continue;
    for(const [x,y,anchor]of [[12,-10,'start'],[12,22,'start'],[-12,-10,'end'],[-12,22,'end']]){
      label.setAttribute('x',x);label.setAttribute('y',y);label.setAttribute('text-anchor',anchor);
      const box=label.getBBox(),rect={x:s.x+box.x*scale-3*scale,y:s.y+box.y*scale-3*scale,w:box.width*scale+6*scale,h:box.height*scale+6*scale};
      if(rect.x<view.x||rect.y<view.y||rect.x+rect.w>view.x+view.w||rect.y+rect.h>view.y+view.h)continue;
      if(!occupied.some(r=>rect.x<r.x+r.w&&rect.x+rect.w>r.x&&rect.y<r.y+r.h&&rect.y+rect.h>r.y)){
        label.style.visibility='visible';occupied.push(rect);break;
      }
    }
  }
}
function applyView(){ $('network').setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);layoutLabels(); }
function zoom(factor,anchor={x:view.x+view.w/2,y:view.y+view.h/2}){
  const w=Math.min(2000,Math.max(MIN_VIEW_WIDTH,view.w*factor)),h=w*1100/1540;
  view={x:anchor.x-(anchor.x-view.x)*w/view.w,y:anchor.y-(anchor.y-view.y)*h/view.h,w,h};applyView();
}
$('zoom-in').addEventListener('click',()=>zoom(.75));$('zoom-out').addEventListener('click',()=>zoom(1/.75));$('fit').addEventListener('click',()=>{view={x:0,y:0,w:1540,h:1100};applyView();});
$('network').addEventListener('wheel',e=>{
  e.preventDefault();const p=$('network').createSVGPoint();p.x=e.clientX;p.y=e.clientY;
  zoom(e.deltaY>0?1.12:.89,p.matrixTransform($('network').getScreenCTM().inverse()));
},{passive:false});
attachMapGestures($('network'),()=>view,next=>{view=next;applyView();},value=>{dragged=value;});
$('search').addEventListener('input',()=>{
  const query=$('search').value.trim().toLowerCase(),results=$('search-results');results.replaceChildren();results.hidden=!query;if(!query)return;
  const found=Object.values(stations).filter(s=>`${s.id} ${s.name} ${s.zh}`.toLowerCase().includes(query)).slice(0,8);
  for(const s of found){const b=text('button',s.name,'',results);text('small',s.zh,'',b);b.addEventListener('click',()=>{selectStation(s.id);view={x:s.x-250,y:s.y-178.57,w:500,h:357.14};applyView();results.hidden=true;$('search').value='';});}
  if(!found.length) text('p','No matching stations.','',results);
});
$('search').addEventListener('keydown',e=>{if(e.key==='Escape'){$('search-results').hidden=true;$('search').value='';}if(e.key==='Enter')$('search-results').querySelector('button')?.click();});
$('about-open').addEventListener('click',()=>$('about').showModal());$('about-close').addEventListener('click',()=>$('about').close());
$('about').addEventListener('click',e=>{if(e.target===$('about')){const r=$('about').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('about').close();}});
function tickClock(){$('clock').textContent=new Date().toLocaleTimeString('en-GB',{timeZone:'Asia/Hong_Kong'});}tickClock();setInterval(tickClock,1000);
selectStation('ADM');document.fonts.ready.then(layoutLabels);requestAnimationFrame(animate);
function locateStation() {
  const button=$('locate'),status=$('location-status'),revision=selectionRevision;
  if(button.disabled)return;
  if(!window.isSecureContext){status.textContent='Location needs HTTPS or localhost. You can still select any station on the map.';return;}
  if(!navigator.geolocation){status.textContent='This browser does not support device location. Choose a station on the map.';return;}
  button.disabled=true;button.textContent='⌖ Finding you…';status.textContent='Waiting for your device location…';
  const finish=()=>{button.disabled=false;button.textContent='⌖ Use my location';};
  try {
    navigator.geolocation.getCurrentPosition(position=>{
      finish();
      try {
        const nearest=nearestStation(position.coords);
        status.textContent=locationDescription(nearest,position.coords.accuracy);
        if(selectionRevision!==revision){status.textContent+=' Keeping the station you selected.';return;}
        selectStation(nearest.station.id);
        const s=nearest.station;view={x:s.x-250,y:s.y-178.57,w:500,h:357.14};applyView();
      } catch {status.textContent='Your device returned an invalid location. Try again, or select a station.';}
    },error=>{finish();status.textContent=locationError(error);},{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
  } catch(error){finish();status.textContent=locationError(error);}
}
$('locate').addEventListener('click',locateStation);
// Only reuse an existing grant automatically; first-time access needs a user gesture.
const startupRevision=selectionRevision;
if(navigator.permissions && navigator.geolocation && window.isSecureContext){
  navigator.permissions.query({name:'geolocation'}).then(permission=>{
    if(permission.state==='granted'&&selectionRevision===startupRevision)locateStation();
  }).catch(()=>{});
}
async function poll(){if(!document.hidden)await network.refresh(selectedStation);setTimeout(poll,4000);}poll();
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-network.lastCycle>4000)network.refresh(selectedStation);});
