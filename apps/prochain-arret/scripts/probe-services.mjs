// A bounded integration probe: no user location, one known public station.
const origin='https://prochain-arret.thibautgiuseppi.chatgpt.site';
const search=await fetch('https://photon.komoot.io/api/?q=Gare%20de%20Lyon%20Paris&limit=3&lang=fr',{headers:{Origin:origin},signal:AbortSignal.timeout(15000)});
const cors=search.headers.get('access-control-allow-origin');
if(!search.ok)throw new Error(`Photon HTTP ${search.status}`);
const json=await search.json();if(!json.features?.length)throw new Error('Photon returned no station results');
if(cors!=='*'&&cors!==origin)throw new Error('Photon does not allow the app origin');
console.log('Photon search and browser CORS: passed ('+json.features.length+' results)');
const query='[out:json][timeout:12];node(around:300,48.8449,2.3735)[railway=station];out tags center;';
const r=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{Origin:origin},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(18000)});
if(!r.ok)throw new Error(`Overpass HTTP ${r.status}`);
const oc=r.headers.get('access-control-allow-origin');if(oc!=='*'&&oc!==origin)throw new Error('Overpass does not allow the app origin');
const out=await r.json();if(!Array.isArray(out.elements))throw new Error('Invalid Overpass response');console.log('Overpass query and browser CORS: passed');
