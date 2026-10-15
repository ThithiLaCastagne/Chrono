// A bounded integration probe: no user location, one known public station.
const origin='https://prochain-arret.thibautgiuseppi.chatgpt.site';
const search=await fetch('https://photon.komoot.io/api/?q=Gare%20de%20Lyon%20Paris&limit=3&lang=fr',{headers:{Origin:origin},signal:AbortSignal.timeout(15000)});
const cors=search.headers.get('access-control-allow-origin');
if(!search.ok)throw new Error(`Photon HTTP ${search.status}`);
const json=await search.json();if(!json.features?.length)throw new Error('Photon returned no station results');
if(cors!=='*'&&cors!==origin)throw new Error('Photon does not allow the app origin');
console.log('Photon search and browser CORS: passed ('+json.features.length+' results)');
const {OVERPASS_ENDPOINTS,buildNearbyQuery}=await import('../dist/data.js');
const query=buildNearbyQuery({lat:48.8449,lon:2.3735});
let healthy=0;
for(const endpoint of OVERPASS_ENDPOINTS){
 try{
  const r=await fetch(endpoint,{method:'POST',headers:{Origin:origin},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(18000)});
  if(r.status>=400&&r.status<500){console.warn(endpoint+': explicit refusal HTTP '+r.status+'; no alternate request');break}
  if(!r.ok)throw new Error(`HTTP ${r.status}`);
  const oc=r.headers.get('access-control-allow-origin');if(oc!=='*'&&oc!==origin)throw new Error('CORS does not allow app origin');
  const out=await r.json();if(!Array.isArray(out.elements)||out.remark)throw new Error('Invalid or incomplete response');healthy++;console.log(endpoint+': query and browser CORS passed');break;
 }catch(e){console.warn(endpoint+': unavailable during this probe ('+e.message+')')}
}
if(!healthy)throw new Error('All Overpass services were unavailable during this probe');
