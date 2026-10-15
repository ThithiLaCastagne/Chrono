import {distance,validPoint} from './engine.js';

const clean=s=>typeof s==='string'?s.trim().slice(0,160):'';
const normalized=s=>clean(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const isTransit=s=>/station|stop|halt|platform|ferry_terminal/.test(s.kind);
const aliases=tags=>[...new Set(Object.entries(tags||{}).filter(([k])=>/^(name(:[^:]+)?|official_name|short_name|alt_name|int_name)$/.test(k)).flatMap(([,v])=>clean(v).split(';').map(clean)).filter(Boolean))].slice(0,32);
const placeName=tags=>[tags?.['name:fr'],tags?.name,tags?.['name:en'],tags?.int_name,tags?.official_name].map(clean).find(Boolean)||'';
const pointOf=e=>({lat:e?.lat??e?.center?.lat,lon:e?.lon??e?.center?.lon});
const osmId=e=>/^(node|way|relation)$/.test(e?.type)&&Number.isSafeInteger(e.id)&&e.id>0?e.type[0].toUpperCase()+e.id:'';
const duplicate=(list,s,meters=60)=>list.some(p=>normalized(p.name)===normalized(s.name)&&distance(p,s)<meters);
const abortError=()=>new DOMException('Recherche annulée','AbortError');
const checkAbort=signal=>{if(signal?.aborted)throw abortError();};

// Fixed-route OSM modes. Flexible share taxis and hail-and-ride retain distance mode.
export const ROUTE_MODES=Object.freeze(['bus','minibus','trolleybus','tram','subway','train','light_rail','monorail','ferry','funicular','aerialway']);
export const OVERPASS_ENDPOINTS=Object.freeze(['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter']);
const MEMBER_ROLES=['stop','platform','stop_entry_only','stop_exit_only','platform_entry_only','platform_exit_only'];
const STOP_FILTERS=['[railway~"^(station|halt|tram_stop|platform|stop)$"]','[highway~"^(bus_stop|platform)$"]','[public_transport~"^(station|platform|stop_position)$"]','[amenity~"^(bus_station|ferry_terminal)$"]','[aerialway=station]'];

export function normalizeFeatures(features) {
  const result=[];
  for(const f of Array.isArray(features)?features:[]){
    if(!f||typeof f!=='object'||(f.geometry?.type&&f.geometry.type!=='Point'))continue;
    const p=f.properties||{},coords=f.geometry?.coordinates||[];
    const type=typeof p.osm_type==='string'?p.osm_type.toUpperCase():'';
    const id=/^[NWR]$/.test(type)&&Number.isSafeInteger(p.osm_id)&&p.osm_id>0?type+p.osm_id:'';
    const locality=clean(p.city||p.district||p.county||p.state),country=clean(p.country);
    const s={name:clean(p.name||p.street),lat:coords[1],lon:coords[0],city:[locality,country].filter((v,i,a)=>v&&a.indexOf(v)===i).join(' · '),id,kind:clean(p.osm_value)||'lieu'};
    if(!validPoint(s)||!s.name||coords.length<2||duplicate(result,s))continue;
    result.push(s);
  }
  return result.sort((a,b)=>Number(isTransit(b))-Number(isTransit(a)));
}

export function buildNearbyQuery(p) {
  if(!validPoint(p))throw new Error('Coordonnées invalides. Choisissez un autre point.');
  return `[out:json][timeout:9][maxsize:16777216];(${STOP_FILTERS.map(f=>`nwr(around:1300,${p.lat},${p.lon})${f};`).join('')});out body center;`;
}

export function buildRouteQuery(target) {
  if(!validPoint(target))throw new Error('Coordonnées invalides. Choisissez un autre point.');
  const anchor=typeof target.id==='string'?target.id.match(/^([NWR])([1-9][0-9]{0,15})$/):null;
  const exact=anchor&&Number.isSafeInteger(Number(anchor[2]))?`${({N:'node',W:'way',R:'rel'})[anchor[1]]}(${anchor[2]});`:'';
  const filter=`[type=route][route~"^(${ROUTE_MODES.join('|')})$"]["public_transport:version"="2"]`;
  // Fetch only stops/platforms, not every geometry vertex of intercity routes.
  const members=MEMBER_ROLES.flatMap(role=>['node','way','rel'].map(type=>`${type}(r.routes:"${role}");`)).join('');
  return `[out:json][timeout:9][maxsize:16777216];(${exact}${STOP_FILTERS.map(f=>`nwr(around:500,${target.lat},${target.lon})${f};`).join('')})->.s;(rel(bn.s)${filter};rel(bw.s)${filter};rel(br.s)${filter};)->.routes;.routes out body;(${members});out body center;`;
}

export function normalizeNearby(els,p) {
  if(!Array.isArray(els)||!validPoint(p))return [];
  const list=els.filter(e=>e&&/^(node|way|relation)$/.test(e.type)).map(e=>({name:placeName(e.tags),...pointOf(e),city:'À proximité',kind:clean(e.tags?.amenity||e.tags?.railway||e.tags?.highway||(e.tags?.aerialway==='station'?'aerialway_station':e.tags?.public_transport))||'stop',id:osmId(e)})).filter(s=>s.name&&validPoint(s)&&distance(p,s)<=1350);
  const result=[];
  for(const s of list.sort((a,b)=>distance(p,a)-distance(p,b))){if(!duplicate(result,s))result.push(s);if(result.length===24)break;}
  return result;
}

export function parseRoutes(els,target) {
  if(!Array.isArray(els)||!validPoint(target)||!clean(target.name))return [];
  const routes=[],items=els.filter(e=>e&&typeof e==='object');
  const nodes=new Map(items.map(e=>[e.type+':'+e.id,e]));
  const targetName=normalized(target.name);
  for(const e of items.filter(e=>e.type==='relation')) {
    // PTv1 can combine both directions and has no dependable stop ordering.
    if(!Array.isArray(e.members)||e.tags?.type!=='route'||e.tags?.['public_transport:version']!=='2'||!ROUTE_MODES.includes(e.tags?.route))continue;
    if(e.tags?.on_demand==='yes'||e.members.some(m=>m?.role==='hail_and_ride'||/^(forward|backward)/.test(m?.role||'')))continue;
    const stops=[];
    for(const m of e.members) {
      if(!m)continue;
      if(!MEMBER_ROLES.includes(m.role)){if(/^(stop|platform)(_|$)/.test(m.role||''))stops.push(null);continue;}
      const node=nodes.get(m.type+':'+m.ref),name=placeName(node?.tags);
      const p=node?{name,...pointOf(node),id:osmId(node),aliases:aliases(node.tags),roles:[m.role],ids:[osmId(node)]}:null;
      // Missing members remain barriers: never invent adjacency across gaps.
      if(!validPoint(p)||!p.name){stops.push(null);continue;}
      const last=stops.at(-1),roleType=m.role.split('_')[0];
      const isPair=last&&last.roles.length===1&&last.roles[0].split('_')[0]==='stop'&&roleType==='platform'&&distance(last,p)<250&&last.aliases.some(a=>p.aliases.some(b=>normalized(a)===normalized(b)));
      if(isPair){last.roles.push(m.role);last.ids.push(p.id);last.aliases=[...new Set([...last.aliases,...p.aliases])];continue;}
      stops.push(p);
    }
    const matches=stops.map((s,i)=>s&&distance(s,target)<900&&((target.id&&s.ids.includes(target.id))||(targetName&&s.aliases.some(n=>normalized(n)===targetName)))?i:-1).filter(i=>i>=0);
    if(matches.length!==1)continue; // Loops need an explicit trip occurrence.
    const idx=matches[0],destination=stops[idx],prev=stops[idx-1];
    if(!prev||distance(prev,destination)<100||destination.roles.some(r=>r.endsWith('_entry_only')))continue;
    const asPlace=s=>({name:s.name,lat:s.lat,lon:s.lon,id:s.id});
    routes.push({id:e.id,ref:clean(e.tags.ref)||'Ligne',name:clean(e.tags.name),direction:clean(e.tags.to)||stops.at(-1)?.name||'',mode:e.tags.route,network:clean(e.tags.network),operator:clean(e.tags.operator),via:clean(e.tags.via),previous:asPlace(prev),destination:asPlace(destination),stops:stops.slice(Math.max(0,idx-3),idx+1).filter(Boolean).map(asPlace)});
  }
  return routes.slice(0,30);
}

/** Short-lived memory-only caching reduces load without retaining travel searches. */
export function createTransitClient({fetcher=(...args)=>fetch(...args),clock=()=>Date.now(),timeoutMs=10000}={}) {
  const cache=new Map(),blockedUntil={photon:0,overpass:0};
  let cacheEpoch=0;
  const messages={photon:'Le service de recherche est momentanément indisponible. Réessayez ou utilisez les coordonnées.',overpass:'Le réseau de transport ne répond pas pour le moment. Le mode par distance reste disponible.'};
  const clone=value=>JSON.parse(JSON.stringify(value));
  function fromCache(key){const hit=cache.get(key);if(!hit)return null;if(hit.expires<=clock()){cache.delete(key);return null;}return clone(hit.value);}
  function remember(key,value,ttl,epoch){if(epoch!==cacheEpoch)return value;cache.delete(key);cache.set(key,{value:clone(value),expires:clock()+ttl});while(cache.size>32)cache.delete(cache.keys().next().value);return value;}
  function fail(kind,noRetry=false){const e=new Error(messages[kind]);e.noRetry=noRetry;return e;}
  async function request(url,options,signal,kind){
    checkAbort(signal);
    if(blockedUntil[kind]>clock())throw fail(kind,true);
    const ac=new AbortController(),abort=()=>ac.abort();signal?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(abort,timeoutMs);
    try{
      const response=await fetcher(url,{...options,signal:ac.signal});checkAbort(signal);if(ac.signal.aborted)throw fail(kind);
      if(response.status===429||response.status===406){
        const header=response.headers?.get?.('Retry-After'),seconds=header&&/^\d+$/.test(header)?Number(header):null;
        const delay=seconds!==null?seconds*1000:header?Date.parse(header)-clock():30000;
        blockedUntil[kind]=clock()+Math.max(30000,Number.isFinite(delay)?delay:30000);
        throw fail(kind,true);
      }
      if(!response.ok)throw fail(kind,response.status>=400&&response.status<500);
      const json=await response.json();checkAbort(signal);if(ac.signal.aborted)throw fail(kind);return json;
    }catch(e){if(signal?.aborted)throw abortError();if(e?.noRetry)throw e;throw fail(kind);}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }
  async function overpass(query,signal){
    for(const endpoint of OVERPASS_ENDPOINTS){
      try{const json=await request(endpoint,{method:'POST',body:new URLSearchParams({data:query})},signal,'overpass');if(!json||!Array.isArray(json.elements)||json.remark)throw fail('overpass');return json.elements;}
      catch(e){if(signal?.aborted)throw abortError();if(e.noRetry)throw e;}
    }
    throw fail('overpass');
  }
  return {
    async searchStations(query,signal){
      checkAbort(signal);const q=clean(query);if(q.length<2||q.length>120)return [];
      const epoch=cacheEpoch,key='search:'+q.toLocaleLowerCase('fr'),hit=fromCache(key);if(hit!==null)return hit;
      const url=new URL('https://photon.komoot.io/api/');url.search=new URLSearchParams({q,lang:'fr',limit:'20'});
      const json=await request(url,{},signal,'photon');if(!Array.isArray(json?.features))throw fail('photon');
      return remember(key,normalizeFeatures(json.features),300000,epoch);
    },
    async nearbyStops(p,signal){
      checkAbort(signal);const epoch=cacheEpoch,query=buildNearbyQuery(p),key='nearby:'+p.lat.toFixed(4)+','+p.lon.toFixed(4),hit=fromCache(key);if(hit!==null)return hit;
      return remember(key,normalizeNearby(await overpass(query,signal),p),120000,epoch);
    },
    async findRoutes(target,signal){
      checkAbort(signal);const epoch=cacheEpoch,query=buildRouteQuery(target),key='routes:'+target.lat.toFixed(5)+','+target.lon.toFixed(5)+':'+clean(target.id)+':'+clean(target.name),hit=fromCache(key);if(hit!==null)return hit;
      return remember(key,parseRoutes(await overpass(query,signal),target),900000,epoch);
    },
    clearCache(){cacheEpoch++;cache.clear();}
  };
}
const client=createTransitClient();
export const searchStations=client.searchStations,nearbyStops=client.nearbyStops,findRoutes=client.findRoutes,clearSearchCache=client.clearCache;
