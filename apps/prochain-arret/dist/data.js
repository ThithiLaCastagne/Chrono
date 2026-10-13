import {distance,validPoint} from './engine.js';
const clean=s=>String(s||'').slice(0,160);
export function normalizeFeatures(features) {
  const seen=new Set();return (features||[]).flatMap(f=>{
    const p=f.properties||{},coords=f.geometry?.coordinates||[];
    const s={name:clean(p.name||p.street),lat:Number(coords[1]),lon:Number(coords[0]),city:clean(p.city||p.district||p.county||p.state||p.country),id:`${p.osm_type||'N'}${p.osm_id||''}`,kind:clean(p.osm_value||'lieu')};
    if(!validPoint(s)||!s.name||coords.length<2)return [];
    const key=s.name+':'+s.lat.toFixed(3)+':'+s.lon.toFixed(3);if(seen.has(key))return [];seen.add(key);return [s];
  }).sort((a,b)=>Number(/station|stop|halt|platform/.test(b.kind))-Number(/station|stop|halt|platform/.test(a.kind)));
}
export async function searchStations(q,signal) {
  const url=new URL('https://photon.komoot.io/api/');url.search=new URLSearchParams({q,lang:'fr',limit:'12'});
  const res=await fetch(url,{signal});if(!res.ok)throw new Error('Le service de recherche est momentanément indisponible. Réessayez ou utilisez les coordonnées.');
  const json=await res.json();return normalizeFeatures(json.features);
}
async function overpass(query,signal) {
  const r=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:new URLSearchParams({data:query}),signal});
  if(!r.ok)throw new Error('Le réseau de transport ne répond pas pour le moment. Le mode par distance reste disponible.');
  const j=await r.json();if(j.remark&&!j.elements?.length)throw new Error('Recherche de ligne indisponible.');return j.elements||[];
}
export async function nearbyStops(p,signal) {
  const els=await overpass(`[out:json][timeout:18];(nwr(around:1300,${p.lat},${p.lon})[railway~"^(station|halt|tram_stop)$"];node(around:1300,${p.lat},${p.lon})[highway=bus_stop];);out center tags;`,signal);
  const list=els.map(e=>({name:clean(e.tags?.name),lat:e.lat??e.center?.lat,lon:e.lon??e.center?.lon,city:'À proximité',kind:e.tags?.railway||'bus_stop',id:e.type[0].toUpperCase()+e.id})).filter(s=>s.name&&validPoint(s));
  const seen=new Set();return list.sort((a,b)=>distance(p,a)-distance(p,b)).filter(s=>{if(seen.has(s.name))return false;seen.add(s.name);return true;}).slice(0,16);
}
export function parseRoutes(els,target) {
  const routes=[];
  for(const e of els.filter(e=>e.type==='relation')) {
    const stops=[];
    for(const m of e.members||[]) {
      if(!/^(stop|platform)(_|$)/.test(m.role||''))continue;
      const node=els.find(n=>n.type===m.type&&n.id===m.ref);if(!node)continue;
      const p={name:clean(node.tags?.name),lat:node.lat??node.center?.lat,lon:node.lon??node.center?.lon};
      if(!validPoint(p)||!p.name)continue;
      if(stops.at(-1)?.name===p.name)continue;stops.push(p);
    }
    const normalized=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
    let idx=stops.findIndex(s=>normalized(s.name)===normalized(target.name)&&distance(s,target)<900);
    if(idx<0)idx=stops.findIndex(s=>distance(s,target)<160);
    if(idx<=0)continue;
    const prev=stops[idx-1];if(distance(prev,target)<100)continue;
    routes.push({id:e.id,ref:clean(e.tags?.ref||'Ligne'),name:clean(e.tags?.name),direction:clean(e.tags?.to||stops.at(-1)?.name),previous:prev,destination:stops[idx],stops:stops.slice(Math.max(0,idx-3),idx+1)});
  }
  return routes.slice(0,20);
}
export async function findRoutes(target,signal) {
  const q=`[out:json][timeout:20];(node(around:350,${target.lat},${target.lon})[public_transport];node(around:350,${target.lat},${target.lon})[railway];node(around:350,${target.lat},${target.lon})[highway=bus_stop];way(around:350,${target.lat},${target.lon})[public_transport=platform];)->.s;rel(bn.s)[type=route][route~"^(bus|tram|subway|train|light_rail)$"]->.n;rel(bw.s)[type=route][route~"^(bus|tram|subway|train|light_rail)$"]->.w;(.n;.w;);out body;>;out body center;`;
  return parseRoutes(await overpass(q,signal),target);
}
