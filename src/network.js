import { geographicStations } from './geography.js';
// Retain schematic distances only for the existing illustrative travel-time model.
const raw = `
KET|Kennedy Town|堅尼地城|400|900
HKU|HKU|香港大學|445|900
SYP|Sai Ying Pun|西營盤|490|900
SHW|Sheung Wan|上環|535|900
CEN|Central|中環|590|900
ADM|Admiralty|金鐘|685|900
WAC|Wan Chai|灣仔|750|900
CAB|Causeway Bay|銅鑼灣|815|900
TIH|Tin Hau|天后|875|900
FOH|Fortress Hill|炮台山|935|900
NOP|North Point|北角|995|900
QUB|Quarry Bay|鰂魚涌|1060|900
TAK|Tai Koo|太古|1120|900
SWH|Sai Wan Ho|西灣河|1180|900
SKW|Shau Kei Wan|筲箕灣|1240|900
HFC|Heng Fa Chuen|杏花邨|1300|940
CHW|Chai Wan|柴灣|1345|985
HOK|Hong Kong|香港|570|845
KOW|Kowloon|九龍|500|735
OLY|Olympic|奧運|455|640
NAC|Nam Cheong|南昌|405|575
LAK|Lai King|荔景|320|445
TSY|Tsing Yi|青衣|245|495
SUN|Sunny Bay|欣澳|145|620
TUC|Tung Chung|東涌|100|770
AIR|Airport|機場|100|490
AWE|AsiaWorld-Expo|博覽館|100|410
DIS|Disneyland Resort|迪士尼|240|715
TSW|Tsuen Wan|荃灣|385|325
TWH|Tai Wo Hau|大窩口|385|365
KWH|Kwai Hing|葵興|365|405
KWF|Kwai Fong|葵芳|345|435
MEF|Mei Foo|美孚|365|505
LCK|Lai Chi Kok|荔枝角|420|505
CSW|Cheung Sha Wan|長沙灣|465|505
SSP|Sham Shui Po|深水埗|510|530
PRE|Prince Edward|太子|570|580
MOK|Mong Kok|旺角|570|630
YMT|Yau Ma Tei|油麻地|570|680
JOR|Jordan|佐敦|610|730
TST|Tsim Sha Tsui|尖沙咀|650|775
WHA|Whampoa|黃埔|850|745
HOM|Ho Man Tin|何文田|785|680
SKM|Shek Kip Mei|石硤尾|625|535
KOT|Kowloon Tong|九龍塘|705|495
LOF|Lok Fu|樂富|785|495
WTS|Wong Tai Sin|黃大仙|845|495
DIH|Diamond Hill|鑽石山|920|495
CHH|Choi Hung|彩虹|995|520
KOB|Kowloon Bay|九龍灣|1040|570
NTK|Ngau Tau Kok|牛頭角|1080|615
KWT|Kwun Tong|觀塘|1120|660
LAT|Lam Tin|藍田|1160|705
YAT|Yau Tong|油塘|1200|750
TIK|Tiu Keng Leng|調景嶺|1270|750
TKO|Tseung Kwan O|將軍澳|1340|750
HAH|Hang Hau|坑口|1340|675
POA|Po Lam|寶琳|1340|605
LHP|LOHAS Park|康城|1430|830
EXC|Exhibition Centre|會展|785|840
HUH|Hung Hom|紅磡|785|775
MKK|Mong Kok East|旺角東|705|605
TAW|Tai Wai|大圍|705|390
SHT|Sha Tin|沙田|705|320
FOT|Fo Tan|火炭|705|250
RAC|Racecourse|馬場|785|250
UNI|University|大學|705|185
TAP|Tai Po Market|大埔墟|650|145
TWO|Tai Wo|太和|580|145
FAN|Fanling|粉嶺|510|145
SHS|Sheung Shui|上水|440|145
LOW|Lo Wu|羅湖|380|80
LMC|Lok Ma Chau|落馬洲|340|145
WKS|Wu Kai Sha|烏溪沙|1130|145
MOS|Ma On Shan|馬鞍山|1060|145
HEO|Heng On|恆安|1000|190
TSH|Tai Shui Hang|大水坑|945|245
SHM|Shek Mun|石門|890|300
CIO|City One|第一城|845|345
STW|Sha Tin Wai|沙田圍|800|390
CKT|Che Kung Temple|車公廟|750|425
HIK|Hin Keng|顯徑|800|455
KAT|Kai Tak|啟德|920|550
SUW|Sung Wong Toi|宋皇臺|875|595
TKW|To Kwa Wan|土瓜灣|830|640
ETS|East Tsim Sha Tsui|尖東|705|795
AUS|Austin|柯士甸|470|700
TWW|Tsuen Wan West|荃灣西|290|340
KSR|Kam Sheung Road|錦上路|265|270
YUL|Yuen Long|元朗|230|225
LOP|Long Ping|朗屏|185|225
TIS|Tin Shui Wai|天水圍|140|225
SIH|Siu Hong|兆康|100|270
TUM|Tuen Mun|屯門|100|330
OCP|Ocean Park|海洋公園|760|975
WCH|Wong Chuk Hang|黃竹坑|695|1030
LET|Lei Tung|利東|610|1030
SOH|South Horizons|海怡半島|530|1030`;
export const stations = Object.fromEntries(raw.trim().split('\n').map(row => { const [id, name, zh, x, y] = row.split('|'); return [id, { id, name, zh, schematicX:+x,schematicY:+y,...geographicStations[id] }]; }));
const line = (id, name, zh, color, routes) => ({ id, name, zh, color, routes: routes.map(r => r.split(' ')), stations: [...new Set(routes.join(' ').split(' '))] });
export const lines = [
  line('TWL','Tsuen Wan Line','荃灣綫','#f4555e',['CEN ADM TST JOR YMT MOK PRE SSP CSW LCK MEF LAK KWF KWH TWH TSW']),
  line('ISL','Island Line','港島綫','#4193ee',['KET HKU SYP SHW CEN ADM WAC CAB TIH FOH NOP QUB TAK SWH SKW HFC CHW']),
  line('KTL','Kwun Tong Line','觀塘綫','#55be70',['WHA HOM YMT MOK PRE SKM KOT LOF WTS DIH CHH KOB NTK KWT LAT YAT TIK']),
  line('TKL','Tseung Kwan O Line','將軍澳綫','#b980db',['NOP QUB YAT TIK TKO HAH POA','TKO LHP']),
  line('TML','Tuen Ma Line','屯馬綫','#b99067',['WKS MOS HEO TSH SHM CIO STW CKT TAW HIK DIH KAT SUW TKW HOM HUH ETS AUS NAC MEF TWW KSR YUL LOP TIS SIH TUM']),
  line('EAL','East Rail Line','東鐵綫','#62c6e7',['ADM EXC HUH MKK KOT TAW SHT FOT UNI TAP TWO FAN SHS LOW','SHS LMC','SHT RAC UNI']),
  line('TCL','Tung Chung Line','東涌綫','#efa547',['HOK KOW OLY NAC LAK TSY SUN TUC']),
  line('AEL','Airport Express','機場快綫','#42b7af',['HOK KOW TSY AIR AWE']),
  line('SIL','South Island Line','南港島綫','#c5d954',['ADM OCP WCH LET SOH']),
  line('DRL','Disneyland Resort Line','迪士尼綫','#e6a6c5',['SUN DIS']),
];
export const byLine = Object.fromEntries(lines.map(l => [l.id, l]));
export const stationLines = id => lines.filter(l => l.stations.includes(id));
export const majorStations = new Set(['KET','CEN','ADM','NOP','QUB','CHW','HOK','KOW','NAC','LAK','TSY','SUN','TUC','AIR','AWE','DIS','TSW','MEF','PRE','MOK','YMT','TST','WHA','HOM','KOT','DIH','KWT','YAT','TIK','TKO','POA','LHP','HUH','TAW','SHT','UNI','TAP','SHS','LOW','LMC','WKS','MOS','TWW','YUL','TIS','TUM','OCP','SOH']);
export function neighbors(lineId, id) {
  const result = new Set();
  for (const route of byLine[lineId].routes) { const i = route.indexOf(id); if (i >= 0) { if(i) result.add(route[i-1]); if(i < route.length-1) result.add(route[i+1]); } }
  return [...result];
}
export function pathTo(lineId, start, dest) {
  const queue = [[start]], seen = new Set([start]);
  while(queue.length) { const path = queue.shift(), end = path.at(-1); if(end === dest) return path;
    for(const next of neighbors(lineId, end)) if(!seen.has(next)) { seen.add(next); queue.push([...path,next]); }
  }
  return null;
}
export function incomingStation(lineId, station, destination) {
  if(!byLine[lineId]?.stations.includes(destination)) return null;
  const path = pathTo(lineId, station, destination);
  if(!path) return null;
  const candidates = neighbors(lineId, station).filter(n => n !== path[1]);
  // Branch junctions and the Racecourse alternate route cannot be resolved from arrivals alone.
  if (lineId === 'EAL' && ['SHT','FOT','RAC','UNI'].includes(station)) return null;
  return candidates.length === 1 ? candidates[0] : null;
}
export function segmentSeconds(lineId, a, b) {
  const special = { 'AIR-TSY': 780, 'KOW-TSY': 600, 'HOK-KOW': 180, 'SUN-TSY': 360, 'SUN-TUC': 390, 'KSR-TWW': 360, 'HUH-MKK': 240, 'DIH-HIK': 240 };
  return special[[a,b].sort().join('-')] ?? Math.max(90, Math.min(240, Math.hypot(stations[a].schematicX-stations[b].schematicX, stations[a].schematicY-stations[b].schematicY) * 1.5));
}
