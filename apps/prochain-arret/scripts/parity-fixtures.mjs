import {writeFileSync} from 'node:fs';
import {TripEngine} from '../dist/engine.js';
import {trajectories,NOW} from '../tests/trajectories.mjs';
const scenarios=trajectories();
const config={target:{name:'Edge',lat:48.85,lon:2.35},radius:800};
const p=(time,accuracy=60,lat=48.85)=>({lat,lon:2.35,accuracy,timestamp:time});
scenarios.push({name:'dual-provider and invalid reports',config,points:[{p:null,now:NOW},{p:p(NOW),now:NOW},{p:p(NOW+5),now:NOW+5},{p:p(NOW+5000,900),now:NOW+5000},{p:p(NOW-50000),now:NOW+6000},{p:p(NOW+7000),now:NOW+7000},{p:p(NOW+10000),now:NOW+10000}]});
let count=0;const lines=scenarios.map(s=>{const e=new TripEngine(s.config);const points=s.points.map(({p,now})=>{const events=e.ingest(p,now);count++;return {p,now,event:events[0]||null,early:e.early,arrived:e.arrived,status:e.health(now),distance:e.distance}});return JSON.stringify({name:s.name,config:s.config,points})});
writeFileSync(process.argv[2],lines.join('\n')+'\n');console.log(`Parity fixtures: ${scenarios.length} trajectories, ${count} GPS reports.`);
