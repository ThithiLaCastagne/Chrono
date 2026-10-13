import {distance,validPoint} from './engine.js';
const clean=s=>String(s||'').slice(0,160);
export function normalizeFeatures(features) {
  const seen=new Set();return (Array.isArray(features)?features:[]).flatMap(f=>{
    if(!f||typeof f!=='object')return [];
    const p=f.properties||{},coords=f.geometry?.coordinates||[];
    const s={name:clean(p.name||p.street),lat:coords[1],lon:coords[0],city:clean(p.city||p.district||p.county||p.state||p.country),id:`${p.osm_type||'N'}${p.osm_id||''}`,kind:clean(p.osm_value||'lieu')};
    if(!validPoint(s)||!s.name||coords.length<2)return [];
    const key=s.name+':'+s.lat.toFixed(3)+':'+s.lon.toFixed(3);if(seen.has(key))return [];seen.add(key);return [s];
  }).sort((a,b)=>Number(/station|stop|halt|platform/.test(b.kind))-Number(/station|stop|halt|platform/.test(a.kind)));
}
export async function searchStations(q,signal) {
  const url=new URL('https://photon.komoot.io/api/');url.search=new URLSearchParams({q,lang:'fr',limit:'12'});
  const res=await fetch(url,{signal});if(!res.ok)throw new Error('Le service de recherche est momentanément indisponible. Réessayez ou utilisez les coordonnées.');
  const json=await res.json();return normalizeFeatures(json?.features);
}
export const OVERPASS_ENDPOINTS=['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter'];
async function overpass(query,signal) {
  const message='Le réseau de transport ne répond pas pour le moment. Le mode par distance reste disponible.';
  for(const endpoint of OVERPASS_ENDPOINTS){
    if(signal?.aborted)throw new DOMException('Recherche annulée','AbortError');
    const ac=new AbortController(),abort=()=>ac.abort();signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,10000);
    try{
      const r=await fetch(endpoint,{method:'POST',body:new URLSearchParams({data:query}),signal:ac.signal});
      // Respect a rate-limit or rejected query: do not route around it.
      if(r.status===429||(r.status>=400&&r.status<500)){const error=new Error(message);error.noRetry=true;throw error;}
      if(!r.ok)throw new Error(message);
      const j=await r.json();if(!j||!Array.isArray(j.elements)||j.remark)throw new Error(message);return j.elements;
    }catch(e){if(signal?.aborted)throw new DOMException('Recherche annulée','AbortError');if(e.noRetry)throw e;}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }
  throw new Error(message);
}
export async function nearbyStops(p,signal) {
  const els=await overpass(`[out:json][timeout:9];(nwr(around:1300,${p.lat},${p.lon})[railway~"^(station|halt|tram_stop)$"];node(around:1300,${p.lat},${p.lon})[highway=bus_stop];);out center tags;`,signal);
  const list=els.filter(e=>e&&typeof e.type==='string').map(e=>({name:clean(e.tags?.name),lat:e.lat??e.center?.lat,lon:e.lon??e.center?.lon,city:'À proximité',kind:e.tags?.railway||'bus_stop',id:e.type[0].toUpperCase()+e.id})).filter(s=>s.name&&validPoint(s));
  const seen=new Set();return list.sort((a,b)=>distance(p,a)-distance(p,b)).filter(s=>{if(seen.has(s.name))return false;seen.add(s.name);return true;}).slice(0,16);
}
export function parseRoutes(els,target) {
  if(!Array.isArray(els)||!validPoint(target)||typeof target.name!=='string')return [];
  const routes=[],items=els.filter(e=>e&&typeof e==='object');
  const nodes=new Map(items.map(e=>[e.type+':'+e.id,e]));
  const normalized=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  for(const e of items.filter(e=>e.type==='relation')) {
    if(!Array.isArray(e.members))continue;
    const stops=[];
    for(const m of e.members) {
      if(!m||!/^(stop|platform)(_|$)/.test(m.role||''))continue;
      const node=nodes.get(m.type+':'+m.ref);
      const p=node?{name:clean(node.tags?.name),lat:node.lat??node.center?.lat,lon:node.lon??node.center?.lon}:null;
      // Missing members remain barriers: never invent adjacency across incomplete data.
      if(!validPoint(p)||!p.name.trim()){stops.push(null);continue;}
      const last=stops.at(-1);
      if(last&&normalized(last.name)===normalized(p.name)&&distance(last,p)<250)continue;
      stops.push(p);
    }
    const matches=stops.map((s,i)=>s&&normalized(s.name)===normalized(target.name)&&distance(s,target)<900?i:-1).filter(i=>i>=0);
    if(matches.length!==1)continue; // Loop/branch ambiguity requires manual selection.
    const idx=matches[0],prev=stops[idx-1];if(!prev||distance(prev,target)<100)continue;
    routes.push({id:e.id,ref:clean(e.tags?.ref||'Ligne'),name:clean(e.tags?.name),direction:clean(e.tags?.to||stops.at(-1)?.name),previous:prev,destination:stops[idx],stops:stops.slice(Math.max(0,idx-3),idx+1).filter(Boolean)});
  }
  return routes.slice(0,20);
}
export async function findRoutes(target,signal) {
  const q=`[out:json][timeout:9];(node(around:350,${target.lat},${target.lon})[public_transport];node(around:350,${target.lat},${target.lon})[railway];node(around:350,${target.lat},${target.lon})[highway=bus_stop];way(around:350,${target.lat},${target.lon})[public_transport=platform];)->.s;rel(bn.s)[type=route][route~"^(bus|tram|subway|train|light_rail)$"]->.n;rel(bw.s)[type=route][route~"^(bus|tram|subway|train|light_rail)$"]->.w;(.n;.w;);out body;>;out body center;`;
  return parseRoutes(await overpass(q,signal),target);
}
